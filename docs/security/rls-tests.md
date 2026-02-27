# RLS Test Suite — Isolamento Multi-Tenant

**Sprint:** 5
**Stato:** Pronto per esecuzione (FASE B — TASK-05.02.2)
**Data creazione:** 2026-02-27
**Riferimento spike:** `docs/spikes/spike-12-rls-security.md`

---

## Prerequisiti

- Accesso a `psql` con connection string del database Supabase (non la pooler URL)
- Node.js 18+ per script di generazione JWT
- `SUPABASE_JWT_SECRET` — il segreto usato da Clerk nel template "supabase"
- Due workspace fittizi creati dallo script di setup (vedi §2)

---

## 1. Script di Setup: Creazione Workspace Fittizi

Eseguire una volta prima dei test. Crea 2 workspace separati con utenti distinti.

```sql
-- FILE: docs/security/setup-test-workspaces.sql
-- Eseguire con: psql $DATABASE_URL -f docs/security/setup-test-workspaces.sql

BEGIN;

-- ===================================================================
-- WORKSPACE A (cliente sicuro — attaccante simulato)
-- ===================================================================
INSERT INTO workspaces (id, name, slug, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Workspace A',
  'test-workspace-a',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111112',
  '11111111-1111-1111-1111-111111111111',
  'user_test_A',   -- Clerk user ID simulato per workspace A
  'owner',
  now(),
  now()
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO agents (id, workspace_id, name, type, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111113',
  '11111111-1111-1111-1111-111111111111',
  'Agent A',
  'claude',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, workspace_id, title, description, status, priority, created_by_user_id, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111114',
  '11111111-1111-1111-1111-111111111111',
  'Task segreto di A',
  'Questo task deve essere visibile SOLO ad utenti di workspace A',
  'pending',
  'high',
  'user_test_A',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ===================================================================
-- WORKSPACE B (vittima simulata — i dati NON devono essere accessibili da A)
-- ===================================================================
INSERT INTO workspaces (id, name, slug, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222221',
  'Test Workspace B',
  'test-workspace-b',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222221',
  'user_test_B',   -- Clerk user ID simulato per workspace B
  'owner',
  now(),
  now()
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO agents (id, workspace_id, name, type, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222223',
  '22222222-2222-2222-2222-222222222221',
  'Agent B',
  'claude',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, workspace_id, title, description, status, priority, created_by_user_id, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222224',
  '22222222-2222-2222-2222-222222222221',
  'Task segreto di B',
  'Questo task deve essere visibile SOLO ad utenti di workspace B',
  'pending',
  'high',
  'user_test_B',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_events (id, task_id, workspace_id, event_type, actor_type, actor_id, payload, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222225',
  '22222222-2222-2222-2222-222222222224',
  '22222222-2222-2222-2222-222222222221',
  'task.created',
  'human',
  'user_test_B',
  '{"confidential": true, "secret_note": "Dati riservati workspace B"}',
  now()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verifica setup
SELECT 'workspaces' as table, count(*) from workspaces WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222221'
)
UNION ALL
SELECT 'workspace_members', count(*) from workspace_members WHERE workspace_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222221'
)
UNION ALL
SELECT 'tasks', count(*) from tasks WHERE workspace_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222221'
);
-- Output atteso: 3 righe con count = 2, 2, 2
```

---

## 2. Script di Generazione JWT

```javascript
// FILE: docs/security/generate-test-jwt.mjs
// Uso: node generate-test-jwt.mjs user_test_A
// Uso: node generate-test-jwt.mjs user_test_B
// Output: JWT da usare come Bearer token nei test

import jwt from 'jsonwebtoken';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!SUPABASE_JWT_SECRET) {
  console.error('SUPABASE_JWT_SECRET env var richiesta');
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error('Uso: node generate-test-jwt.mjs <user_id>');
  process.exit(1);
}

const payload = {
  sub: userId,
  iss: 'https://clerk.test',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  role: 'authenticated',
};

const token = jwt.sign(payload, SUPABASE_JWT_SECRET);
console.log(token);
```

---

## 3. Test Suite

### TEST-01 — JWT Manipulation (Vettore 1)

**Obiettivo:** Verificare che un JWT con `sub` di workspace A NON possa accedere ai dati di workspace B, anche se il JWT è firmato correttamente (ma con sub sbagliato — ovvero l'utente A non è membro del workspace B).

**Setup:**
```bash
# Genera JWT per user_test_A (membro di workspace A, NON di workspace B)
JWT_A=$(SUPABASE_JWT_SECRET=<secret> node docs/security/generate-test-jwt.mjs user_test_A)
```

**Attacco simulato:**
```bash
# user_test_A cerca di leggere i task di workspace B
curl -s \
  -H "Authorization: Bearer $JWT_A" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  "https://ccgodxlviculeqsnlgse.supabase.co/rest/v1/tasks?workspace_id=eq.22222222-2222-2222-2222-222222222221&select=*"
```

**Query SQL equivalente (testabile via psql con SET ROLE):**
```sql
-- Imposta il JWT di user_test_A nel contesto
-- (in psql, usare la funzione di test di Supabase)
SELECT set_config('request.jwt.claims', '{"sub":"user_test_A","role":"authenticated"}', true);
SET ROLE authenticated;

-- Tentativo: leggere task di workspace B
SELECT * FROM tasks WHERE workspace_id = '22222222-2222-2222-2222-222222222221';
```

**Risultato atteso:** `0 righe` — RLS blocca la query.

**Risultato ottenuto:**
```
[ da compilare in FASE B ]
```

**Esito:** [ PASS / FAIL / ERROR ]

---

### TEST-02 — workspace_id Injection via API (Vettore 2)

**Obiettivo:** Verificare che un Route Handler di Robin.dev non consenta l'accesso a workspace non autorizzati quando il `workspace_id` viene passato da un utente autenticato di workspace A.

**Precondizione:** Il server Next.js è in esecuzione localmente (`npm run dev` in `apps/web`).

**Attacco simulato:**
```bash
# Ottieni un session token Clerk valido per user_test_A (da browser dev tools)
# Header: Cookie: __session=<clerk_session_cookie>

# Tenta di leggere i task del workspace B usando l'API Robin.dev
curl -s \
  -H "Cookie: __session=$CLERK_SESSION_A" \
  "http://localhost:3000/api/tasks?workspaceId=22222222-2222-2222-2222-222222222221"
```

**Alternativa (se l'API accetta workspaceId nel body):**
```bash
curl -s -X GET \
  -H "Cookie: __session=$CLERK_SESSION_A" \
  -H "Content-Type: application/json" \
  "http://localhost:3000/api/tasks/22222222-2222-2222-2222-222222222224"
```

**Risultato atteso:** HTTP 403 o 404, corpo `{ "error": "Forbidden" }` o simile.

**Risultato ottenuto:**
```
[ da compilare in FASE B ]
```

**Esito:** [ PASS / FAIL / ERROR ]

**File da auditare (se FAIL):**
- `apps/web/app/api/tasks/route.ts`
- `apps/web/app/api/tasks/[taskId]/route.ts`
- `apps/web/app/api/tasks/[taskId]/events/route.ts`

---

### TEST-03 — SECURITY DEFINER Audit (Vettore 3)

**Obiettivo:** Verificare che non esistano funzioni `SECURITY DEFINER` con input non sanitizzato che consentano SQL injection.

**Query di audit:**
```sql
-- Lista tutte le funzioni SECURITY DEFINER nel database
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = true  -- SECURITY DEFINER
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, p.proname;
```

**Risultato atteso:** Solo `get_my_workspace_ids()` (e funzioni di sistema). Nessuna funzione con `EXECUTE format(...)` o concatenazione di input esterno.

**Risultato ottenuto:**
```
[ da compilare in FASE B ]
```

**Analisi manuale per ogni funzione trovata:**
- [ ] Usa `EXECUTE` con input dinamico?
- [ ] Usa concatenazione di stringhe (`||`) con input dell'utente?
- [ ] Input è parametrizzato correttamente?

**Esito:** [ PASS / FAIL / ERROR ]

---

### TEST-04 — Missing RLS Table Audit (Vettore 4)

**Obiettivo:** Verificare che tutte le tabelle tenant abbiano RLS abilitata e policy complete.

**Query di audit:**
```sql
-- Tabelle senza RLS abilitata
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;
```

**Risultato atteso:** Nessuna tabella (lista vuota) — oppure solo tabelle non-tenant come lookup tables o system tables.

```sql
-- Policy RLS per tabella (verifica completezza)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

**Verifica per ogni tabella tenant:**
| Tabella | SELECT | INSERT | UPDATE | DELETE | Note |
|---------|--------|--------|--------|--------|------|
| workspaces | [ ] | [ ] | [ ] | [ ] | |
| workspace_members | [ ] | [ ] | [ ] | [ ] | |
| agents | [ ] | [ ] | [ ] | [ ] | |
| agent_status | [ ] | [ ] | [ ] | — | No DELETE intenzionale? |
| tasks | [ ] | [ ] | [ ] | [ ] | |
| task_artifacts | [ ] | [ ] | [ ] | [ ] | |
| task_events | [ ] | [ ] | — | — | Append-only: corretto |

**Risultato ottenuto:**
```
[ da compilare in FASE B ]
```

**Esito:** [ PASS / FAIL / ERROR ]

---

### TEST-05 — API-Level Bypass Audit (Vettore 5)

**Obiettivo:** Verificare che nessun Route Handler in `apps/web/app/api/` usi direttamente il `SUPABASE_SERVICE_ROLE_KEY` per query sui dati tenant.

**Grep per service role key nei Route Handlers:**
```bash
# Da eseguire nella root del monorepo
grep -r "SERVICE_ROLE\|service_role\|serviceRole" apps/web/app/api/ --include="*.ts" -l
```

**Risultato atteso:** Nessun file trovato (lista vuota).

```bash
# Verifica anche che il client Supabase usato nei Route Handlers sia quello user-scoped
grep -r "createServerClient\|createBrowserClient\|supabaseAdmin\|createClient" \
  apps/web/app/api/ --include="*.ts" -n
```

**Risultato atteso:** Tutti i file usano `createServerClient` (da `apps/web/lib/supabase/server.ts`).

**Analisi manuale file trovati:**
```
[ da compilare in FASE B — lista file + verifica ]
```

**Esito:** [ PASS / FAIL / ERROR ]

---

## 4. Template Risultati

```markdown
## Risultati Test RLS — [DATA ESECUZIONE]
**Esecutore:** [nome/role]
**Ambiente:** [local/staging/production]
**Versione migration:** [hash commit o versione]

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

---

## 5. Cleanup Post-Test

```sql
-- Rimuovere i workspace di test dopo l'esecuzione
-- ATTENZIONE: CASCADE elimina tutti i dati correlati
DELETE FROM workspaces WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222221'
);
-- CASCADE si occuperà di workspace_members, agents, tasks, task_events, task_artifacts
```

---

## Riferimenti

- `docs/spikes/spike-12-rls-security.md` — analisi vettori
- `supabase/migrations/0002_rls_policies.sql` — policy RLS
- `apps/web/lib/supabase/server.ts` — client corretto per Route Handlers
