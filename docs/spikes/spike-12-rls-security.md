# Spike-12 — Sicurezza RLS su Supabase: Pattern di Attacco e Verifica Policy

**Sprint:** 5
**Stato:** Completato
**Data:** 2026-02-27
**Autore:** Robin.dev Team
**Documentazione test:** `docs/security/rls-tests.md`

---

## Obiettivo

Analizzare i vettori di attacco più comuni contro Row Level Security (RLS) su Supabase in un contesto multi-tenant, verificare che le policy attuali di Robin.dev resistano a tali attacchi, e definire una metodologia di test riproducibile per FASE B.

---

## Contesto: Architettura RLS Robin.dev

Le policy RLS di Robin.dev (`0002_rls_policies.sql`) usano il pattern:

```sql
-- Helper function (SECURITY DEFINER)
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

-- Esempio policy
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
```

**Caratteristiche chiave:**
- `auth.jwt() ->> 'sub'` estrae il Clerk user ID come testo (es. `user_abc123`)
- **NON** usa `auth.uid()` che richiederebbe un UUID valido (Clerk IDs non sono UUID)
- `SECURITY DEFINER`: la funzione esegue con i permessi del definer, non del chiamante
- `task_events`: solo SELECT + INSERT (append-only, nessuna policy UPDATE/DELETE)
- `workspaces_insert`: `WITH CHECK (true)` — chiunque autenticato può creare workspace

---

## 5 Vettori di Attacco Principali

### Vettore 1 — JWT Manipulation

**Descrizione:** Un attaccante con un JWT valido del proprio workspace (A) ne modifica il claim `sub` per impersonare un utente del workspace B, senza avere le credenziali del workspace B.

**Obiettivo:** Leggere/modificare dati del workspace B usando un JWT manipolato.

**Come funziona (teoria):**
```
JWT originale:   { sub: "user_A123", ... }
JWT manipolato:  { sub: "user_B456", ... }
```
Il JWT manipolato non può avere firma valida senza la chiave privata JWT del provider (Clerk/Supabase), quindi l'attacco è **bloccato a livello crittografico** se JWT Verification è attiva.

**Verifica necessaria:**
- Supabase deve avere il JWT secret configurato correttamente (da Clerk Dashboard)
- `SUPABASE_JWT_SECRET` deve essere il segreto del template "supabase" di Clerk
- Verificare che Supabase rifiuti JWT con firma non valida (test in `rls-tests.md` #1)

**Stato attuale:** Dipende da configurazione corretta (non dal codice). Verificabile in FASE B.

---

### Vettore 2 — workspace_id Injection via API

**Descrizione:** Un attaccante autenticato come utente del workspace A chiama un Route Handler di Robin.dev passando un `workspace_id` del workspace B nel body della request o come path parameter.

**Obiettivo:** Accedere a dati del workspace B senza che il Route Handler verifichi l'ownership.

**Esempio di Route Handler vulnerabile:**
```typescript
// ⚠️ VULNERABILE: non verifica che workspaceId appartenga all'utente
export async function GET(req: Request, { params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const tasks = await prisma.tasks.findMany({ where: { workspace_id: workspaceId } });
  return Response.json(tasks);
}
```

**Difesa corretta (doppio layer):**
```typescript
// ✓ CORRETTO: verifica ownership + lascia RLS come backstop
const userId = await getCurrentUserId(); // Clerk
const membership = await prisma.workspace_members.findFirst({
  where: { workspace_id: workspaceId, user_id: userId }
});
if (!membership) return new Response('Forbidden', { status: 403 });
// Supabase/Prisma con RLS gestirà il resto
```

**Verifica necessaria:** Audit di tutti i Route Handlers che accettano `workspace_id` come input esterno.

---

### Vettore 3 — SECURITY DEFINER Bypass

**Descrizione:** `get_my_workspace_ids()` è una funzione `SECURITY DEFINER`. Se la funzione ha un bug (es. concatenazione non sicura, injection nel body SQL), un attaccante potrebbe sfruttarla per eseguire query arbitrarie nel contesto del definer.

**Analisi della funzione attuale:**
```sql
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

**Valutazione rischio:**
- La funzione usa `language sql` (non `plpgsql`), che non supporta esecuzione dinamica
- Il valore `auth.jwt() ->> 'sub'` è passato come parametro bind interno, non concatenato come stringa
- Non c'è `EXECUTE` o `PERFORM` con input esterno
- **Rischio: BASSO** per questa specifica funzione

**Scenario di rischio residuo:** Se in futuro si aggiungono funzioni `SECURITY DEFINER` con `plpgsql` e input non sanitizzati.

**Verifica necessaria:** Audit di tutte le funzioni `SECURITY DEFINER` nel database (test in `rls-tests.md` #3).

---

### Vettore 4 — Missing RLS su Tabelle Nuove

**Descrizione:** Nuove tabelle aggiunte tramite migration senza `ENABLE ROW LEVEL SECURITY` + policy sono accessibili a qualsiasi utente autenticato (o addirittura anonimo, dipende dalle impostazioni).

**Supabase default:** Quando RLS è disabilitato su una tabella, il comportamento dipende dal contesto:
- Con `anon` role: accessibile se non ci sono grant espliciti
- Con `authenticated` role: accessibile se `GRANT SELECT ON ... TO authenticated` è presente

**Tabelle attuali con RLS abilitata:**
```
✓ workspaces
✓ workspace_members
✓ agents
✓ agent_status
✓ tasks
✓ task_artifacts
✓ task_events
```

**Rischio per Sprint 5+:** Nuove tabelle per multi-tenancy (es. `billing`, `client_configs`, `api_keys`) potrebbero essere aggiunte senza RLS se la checklist di migration non include il controllo.

**Mitigazione:** Template di migration che include sempre:
```sql
-- OBBLIGATORIO per ogni nuova tabella tenant
ALTER TABLE <new_table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<new_table>_select" ON <new_table>
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));
-- + INSERT, UPDATE, DELETE policies appropriate
```

**Verifica necessaria:** Query di audit (test in `rls-tests.md` #4).

---

### Vettore 5 — API-Level Bypass (Route Handler senza verifica)

**Descrizione:** Anche con RLS attiva su Supabase, un Route Handler che usa il **service role key** (non il JWT dell'utente) bypasserebbe completamente RLS. Questo è il vettore più critico per Robin.dev.

**Scenario:**
```typescript
// ⚠️ PERICOLOSO: usa service_role key — RLS completamente bypassata
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const { data } = await supabase.from('tasks').select('*').eq('workspace_id', workspaceId);
// Ritorna TUTTI i task di workspaceId senza verifica di ownership
```

**Dove è usato il service role in Robin.dev:**
- `apps/orchestrator` — usa il service role per scrivere eventi come agente (corretto, è un processo trusted)
- `apps/web` Route Handlers — devono usare SEMPRE il client utente (con JWT Clerk)

**Client corretto in `apps/web`:**
```typescript
// ✓ CORRETTO: apps/web/lib/supabase/server.ts
// Attacca il Clerk JWT → RLS rispettata
const supabase = await createServerClient();
```

**Verifica necessaria:** Audit di tutti i file in `apps/web/app/api/` per assicurarsi che nessuno usi `SUPABASE_SERVICE_ROLE_KEY` direttamente (test in `rls-tests.md` #5).

---

## Checklist di Verifica per Tabella

Per ogni tabella tenant in Supabase, verificare:

| Check | workspaces | workspace_members | agents | agent_status | tasks | task_artifacts | task_events |
|-------|-----------|-------------------|--------|--------------|-------|----------------|-------------|
| RLS abilitata | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SELECT policy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| INSERT policy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| UPDATE policy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ (corretto) |
| DELETE policy | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ (corretto) |
| Usa `get_my_workspace_ids()` | ✓ | ✓ | ✓ | indir.¹ | ✓ | ✓ | ✓ |

¹ `agent_status` usa una subquery su `agents` che a sua volta chiama `get_my_workspace_ids()`.

**Note:**
- `task_events` senza UPDATE/DELETE: **corretto** — append-only per audit trail immutabile
- `agent_status` senza DELETE: da verificare se è intenzionale o mancanza

---

## Metodologia di Test

### Setup ambiente di test

I test richiedono due workspace isolati con utenti separati. Poiché Clerk non ha un test mode semplificato, si usano JWT "sintetici" firmati con il secret Supabase per simulare due utenti distinti.

**Strumenti necessari:**
1. `psql` con accesso diretto al database Supabase (connection string)
2. Script per generare JWT firmati (Node.js con `jsonwebtoken`)
3. Accesso alle API REST di Supabase (per test HTTP-level)

### Classificazione esito test

Per ogni test in `rls-tests.md`:
- **PASS:** Il dato del workspace B non è accessibile dall'utente del workspace A
- **FAIL:** Il dato del workspace B è accessibile — vulnerabilità confermata
- **ERROR:** Il test non può essere eseguito (errore di setup)

### Frequenza di esecuzione raccomandata

- **Ogni migration:** eseguire la checklist "Missing RLS table" (Vettore 4)
- **Ogni nuovo Route Handler:** eseguire il test di API bypass (Vettore 5)
- **Prima di ogni release multi-cliente:** eseguire la suite completa

---

## Conclusioni

| Vettore | Rischio attuale | Mitigazione in atto | Azione FASE B |
|---------|----------------|---------------------|---------------|
| 1. JWT Manipulation | Basso (crittografico) | JWT verification Supabase | Verificare config JWT |
| 2. workspace_id Injection | Medio | RLS come backstop | Audit Route Handlers |
| 3. SECURITY DEFINER bypass | Basso | Funzione semplice senza injection | Test query SQL |
| 4. Missing RLS table | Medio | Policy su tutte le tabelle attuali | Template migration |
| 5. API-level bypass | Alto | Server client con Clerk JWT | Audit `apps/web/app/api/` |

Il vettore più critico è il **#5 (API-level bypass)**: richiede disciplina operativa garantita da code review. Tutti gli altri vettori hanno difese strutturali solide.

---

## Riferimenti

- `supabase/migrations/0002_rls_policies.sql` — policy RLS attuali
- `supabase/migrations/0001_initial_schema.sql` — schema completo
- `docs/security/rls-tests.md` — test suite eseguibile
- [Supabase RLS documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)
