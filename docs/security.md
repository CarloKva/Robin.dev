# Security — Robin.dev

**Last updated:** 2026-03-05

---

## 1. Modello di sicurezza multi-tenant

Robin.dev usa un database PostgreSQL condiviso (Supabase) con Row Level Security (RLS) come meccanismo primario di isolamento tra workspace.

### Helper function centrale

```sql
-- SECURITY DEFINER: esegue con i permessi del definer, non del chiamante
CREATE OR REPLACE FUNCTION get_my_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = (auth.jwt() ->> 'sub')::text;
$$;
```

**Nota critica:** usa `auth.jwt() ->> 'sub'` (testo), **NON** `auth.uid()` (UUID). I Clerk user ID non sono UUID validi — es. `user_abc123`.

### Pattern policy standard

```sql
-- Ogni tabella tenant usa questo pattern
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
```

### Tabelle con RLS abilitata

| Tabella | SELECT | INSERT | UPDATE | DELETE | Note |
|---------|--------|--------|--------|--------|------|
| workspaces | ✓ | ✓ | ✓ | ✓ | |
| workspace_members | ✓ | ✓ | ✓ | ✓ | |
| agents | ✓ | ✓ | ✓ | ✓ | |
| agent_status | ✓ | ✓ | ✓ | — | No DELETE intenzionale |
| tasks | ✓ | ✓ | ✓ | ✓ | |
| task_artifacts | ✓ | ✓ | ✓ | ✓ | |
| task_events | ✓ | ✓ | — | — | Append-only: corretto |

`workspaces_insert`: `WITH CHECK (true)` — chiunque autenticato può creare workspace.

---

## 2. Vettori di attacco e mitigazioni

### Vettore 1 — JWT Manipulation (Rischio: Basso)

**Descrizione:** Un attaccante con JWT valido del workspace A modifica il claim `sub` per impersonare un utente del workspace B.

**Mitigazione strutturale:** Il JWT manipolato non ha firma valida senza la chiave privata JWT di Clerk. Bloccato a livello crittografico.

**Dipendenza:** Supabase deve avere `SUPABASE_JWT_SECRET` configurato correttamente (dal template "supabase" di Clerk).

---

### Vettore 2 — workspace_id Injection via API (Rischio: Medio)

**Descrizione:** Un utente autenticato di workspace A chiama un Route Handler passando un `workspace_id` del workspace B come parametro.

**Esempio vulnerabile:**
```typescript
// VULNERABILE: non verifica ownership
export async function GET(req: Request, { params }: { params: { workspaceId: string } }) {
  const tasks = await prisma.tasks.findMany({ where: { workspace_id: params.workspaceId } });
  return Response.json(tasks);
}
```

**Difesa corretta (doppio layer):**
```typescript
// CORRETTO: verifica ownership + RLS come backstop
const userId = await getCurrentUserId(); // Clerk
const membership = await prisma.workspace_members.findFirst({
  where: { workspace_id: workspaceId, user_id: userId }
});
if (!membership) return new Response('Forbidden', { status: 403 });
// RLS blocca comunque a livello DB
```

**Status:** Tutti i Route Handler usano `requireWorkspace()` da `lib/api/requireWorkspace.ts` che centralizza questo controllo.

---

### Vettore 3 — SECURITY DEFINER Bypass (Rischio: Basso)

**Descrizione:** Bug in `get_my_workspace_ids()` potrebbe consentire SQL injection.

**Analisi funzione attuale:**
- Usa `language sql` (non `plpgsql`) — non supporta esecuzione dinamica
- `auth.jwt() ->> 'sub'` è parametro bind interno, non concatenato come stringa
- Nessun `EXECUTE` o `PERFORM` con input esterno
- **Rischio: BASSO** per questa specifica funzione

**Rischio residuo:** Future funzioni `SECURITY DEFINER` con `plpgsql` e input non sanitizzati.

---

### Vettore 4 — Missing RLS su Tabelle Nuove (Rischio: Medio)

**Descrizione:** Nuove tabelle aggiunte senza `ENABLE ROW LEVEL SECURITY` sono accessibili a qualsiasi utente autenticato.

**Template obbligatorio per ogni nuova tabella tenant:**
```sql
ALTER TABLE <new_table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<new_table>_select" ON <new_table>
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
-- + INSERT, UPDATE, DELETE policies appropriate
```

---

### Vettore 5 — API-Level Bypass (Rischio: Alto)

**Descrizione:** Route Handler che usa `SUPABASE_SERVICE_ROLE_KEY` bypassa completamente RLS.

**Scenario pericoloso:**
```typescript
// PERICOLOSO: usa service_role — RLS completamente bypassata
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supabase.from('tasks').select('*').eq('workspace_id', workspaceId);
```

**Dove è lecito il service role:**
- `apps/orchestrator` — processo trusted che scrive eventi come agente (corretto)
- `apps/web` Route Handlers — **MAI** il service role; usare sempre il client utente

**Client corretto in `apps/web`:**
```typescript
// apps/web/lib/supabase/server.ts — attacca il Clerk JWT → RLS rispettata
const supabase = await createServerClient();
```

**Risultato audit (TEST-05, 2026-02-27): PASS** — nessun Route Handler usa service role key.

---

## 3. Test suite RLS

### Prerequisiti

- Accesso `psql` con connection string Supabase (non la pooler URL)
- Node.js 18+ per generazione JWT
- `SUPABASE_JWT_SECRET` (segreto del template "supabase" di Clerk)
- Due workspace fittizi creati dallo script di setup

### Setup workspace di test

```sql
-- FILE: docs/security/setup-test-workspaces.sql
BEGIN;

-- WORKSPACE A (attaccante simulato)
INSERT INTO workspaces (id, name, slug, created_at, updated_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Workspace A', 'test-workspace-a', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
VALUES ('11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'user_test_A', 'owner', now(), now())
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO tasks (id, workspace_id, title, status, priority, created_by_user_id, created_at, updated_at)
VALUES ('11111111-1111-1111-1111-111111111114', '11111111-1111-1111-1111-111111111111', 'Task segreto di A', 'pending', 'high', 'user_test_A', now(), now())
ON CONFLICT (id) DO NOTHING;

-- WORKSPACE B (vittima simulata)
INSERT INTO workspaces (id, name, slug, created_at, updated_at)
VALUES ('22222222-2222-2222-2222-222222222221', 'Test Workspace B', 'test-workspace-b', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
VALUES ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222221', 'user_test_B', 'owner', now(), now())
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO tasks (id, workspace_id, title, status, priority, created_by_user_id, created_at, updated_at)
VALUES ('22222222-2222-2222-2222-222222222224', '22222222-2222-2222-2222-222222222221', 'Task segreto di B', 'pending', 'high', 'user_test_B', now(), now())
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

### Generazione JWT sintetici

```javascript
// FILE: docs/security/generate-test-jwt.mjs
// Uso: node generate-test-jwt.mjs user_test_A
import jwt from 'jsonwebtoken';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!SUPABASE_JWT_SECRET) { console.error('SUPABASE_JWT_SECRET richiesta'); process.exit(1); }

const userId = process.argv[2];
const payload = {
  sub: userId,
  iss: 'https://clerk.test',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  role: 'authenticated',
};
console.log(jwt.sign(payload, SUPABASE_JWT_SECRET));
```

### TEST-01 — JWT Manipulation

**Obiettivo:** JWT di workspace A non può accedere ai dati di workspace B.

```sql
SELECT set_config('request.jwt.claims', '{"sub":"user_test_A","role":"authenticated"}', true);
SET ROLE authenticated;
SELECT * FROM tasks WHERE workspace_id = '22222222-2222-2222-2222-222222222221';
-- Risultato atteso: 0 righe
```

**Esito:** PASS (strutturale — verifica configurazione JWT Supabase)

---

### TEST-02 — workspace_id Injection via API

**Obiettivo:** Route Handler non consente accesso a workspace non autorizzati.

```bash
# Con session cookie dell'utente A, tentare di leggere task del workspace B
curl -s -H "Cookie: __session=$CLERK_SESSION_A" \
  "http://localhost:3000/api/tasks/22222222-2222-2222-2222-222222222224"
# Risultato atteso: HTTP 403 o 404
```

---

### TEST-03 — SECURITY DEFINER Audit

**Obiettivo:** Nessuna funzione SECURITY DEFINER con input non sanitizzato.

```sql
SELECT n.nspname, p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = true AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, p.proname;
-- Risultato atteso: solo get_my_workspace_ids()
```

Verifica per ogni funzione trovata:
- Usa `EXECUTE` con input dinamico?
- Concatena stringhe con input dell'utente?
- Input parametrizzato correttamente?

---

### TEST-04 — Missing RLS Table Audit

**Obiettivo:** Tutte le tabelle tenant hanno RLS abilitata.

```sql
-- Tabelle senza RLS
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false
ORDER BY tablename;
-- Risultato atteso: lista vuota

-- Policy per tabella
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

---

### TEST-05 — API-Level Bypass Audit

**Obiettivo:** Nessun Route Handler usa service role key.

```bash
grep -r "SERVICE_ROLE\|service_role\|serviceRole" apps/web/app/api/ --include="*.ts" -l
# Risultato atteso: lista vuota

grep -r "createServerClient\|createBrowserClient\|supabaseAdmin\|createClient" \
  apps/web/app/api/ --include="*.ts" -n
# Tutti i file devono usare createServerClient
```

**Risultato esecuzione (2026-02-27):**
- Nessun file trovato con service role → **PASS**
- File verificati: `api/tasks/route.ts`, `api/tasks/[taskId]/route.ts`, `api/tasks/[taskId]/events/route.ts`, `api/workspace/export/route.ts` → tutti usano `createSupabaseServerClient` ✓

---

### Template risultati

```markdown
## Risultati Test RLS — [DATA]
**Esecutore:** [nome]
**Ambiente:** [local/staging/production]
**Versione migration:** [hash commit]

| Test | Vettore | Esito | Note |
|------|---------|-------|------|
| TEST-01 | JWT Manipulation | PASS/FAIL/ERROR | |
| TEST-02 | workspace_id Injection | PASS/FAIL/ERROR | |
| TEST-03 | SECURITY DEFINER | PASS/FAIL/ERROR | |
| TEST-04 | Missing RLS Table | PASS/FAIL/ERROR | |
| TEST-05 | API-Level Bypass | PASS/FAIL/ERROR | |

**Vulnerabilità trovate:** [lista o "nessuna"]
**Azioni correttive:** [lista o "nessuna"]
**Prossima esecuzione:** [data]
```

### Cleanup post-test

```sql
DELETE FROM workspaces WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222221'
);
-- CASCADE elimina workspace_members, agents, tasks, task_events, task_artifacts
```

### Frequenza raccomandata

- **Ogni migration:** eseguire audit Missing RLS (TEST-04)
- **Ogni nuovo Route Handler:** eseguire audit API bypass (TEST-05)
- **Prima di ogni release multi-cliente:** suite completa

---

## 4. Riepilogo rischi

| Vettore | Rischio attuale | Mitigazione in atto | Stato |
|---------|----------------|---------------------|-------|
| 1. JWT Manipulation | Basso | JWT verification Supabase | Dipende da config |
| 2. workspace_id Injection | Medio | RLS backstop + requireWorkspace() | Verificato |
| 3. SECURITY DEFINER bypass | Basso | Funzione semplice senza injection | PASS |
| 4. Missing RLS table | Medio | Policy su tutte le tabelle attuali | Verificato |
| 5. API-level bypass | Alto | Server client con Clerk JWT | PASS (2026-02-27) |

Il vettore più critico è il **#5**: richiede disciplina operativa garantita da code review. Tutti gli altri vettori hanno difese strutturali.

---

## 5. Data retention e GDPR

### Dati raccolti

| Categoria | Cosa | Storage |
|-----------|------|---------|
| Account | Clerk user ID (`user_xxx`) | Supabase `workspace_members.user_id` |
| Workspace | Task, eventi, agenti, artefatti | Supabase |
| Repository | Accesso in lettura/scrittura via deploy key | GitHub (non memorizzato) |
| Log sistema | journalctl orchestratore | VPS del cliente, 30 giorni |

Robin.dev **non memorizza** copie del codice sorgente del cliente né credenziali GitHub/Anthropic in Supabase (solo sul VPS, permessi 600).

### Retention durante attività

| Tipo | Retention | Note |
|------|-----------|------|
| Task e eventi | Illimitata durante contratto | Audit trail e metriche |
| Artifacts (URL PR/deploy) | Illimitata durante contratto | URL esterne |
| Log orchestratore | 30 giorni (journalctl rotation) | Su VPS |
| Agent heartbeat data | 90 giorni | Aggregato, non personale |

### Retention post-cancellazione

| Tipo | Azione | Tempi |
|------|--------|-------|
| Dati Supabase workspace | Cancellazione via `offboard-workspace.ts` | Entro 24h |
| VPS Hetzner | Eliminazione API Hetzner | Entro 24h |
| Deploy key GitHub | Revoca | Entro 24h |
| Log provisioning in `docs/clients/` | Anonimizzazione o rimozione | Entro 30 giorni |

**Periodo di grazia:** 30 giorni dalla richiesta, durante i quali i dati sono disponibili per export (Art. 20 GDPR). Dopo 30 giorni: cancellazione definitiva e irreversibile.

### Diritti GDPR

| Diritto | Articolo | Come esercitarlo |
|---------|----------|-----------------|
| Accesso e portabilità | Art. 15, 20 | `GET /api/workspace/export` → JSON completo |
| Cancellazione (erasure) | Art. 17 | Email all'operator → `offboard-workspace.ts` entro 24h |
| Rettifica | Art. 16 | `PATCH /api/tasks/[taskId]` dal gestionale |
| Limitazione | Art. 18 | Operator ferma servizio systemd sul VPS |

### Sub-processor

| Sub-processor | Paese | Finalità |
|---------------|-------|---------|
| Supabase | USA (AWS EU-West) | Database e autenticazione |
| Anthropic | USA | Esecuzione agente AI |
| Hetzner Cloud | Germania (UE) | Hosting VPS |
| Clerk | USA | Autenticazione utenti |
| Vercel | USA | Hosting frontend |

---

## Riferimenti

- `supabase/migrations/0002_rls_policies.sql` — policy RLS
- `apps/web/lib/supabase/server.ts` — client user-scoped
- `apps/web/lib/api/requireWorkspace.ts` — guard centralizzato
- `docs/security/setup-test-workspaces.sql` — SQL setup test
- `docs/security/generate-test-jwt.mjs` — generatore JWT test
