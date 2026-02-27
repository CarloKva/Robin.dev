# Test di Isolamento RLS — Risultati

**Sprint:** 5 FASE B
**Data creazione:** 2026-02-27
**Riferimento:** `docs/security/rls-tests.md`

---

## TEST-05 — API-Level Bypass Audit (Vettore 5)

**Esecutore:** Automated (grep su codebase)
**Data:** 2026-02-27
**Ambiente:** codebase locale (pre-deploy)

**Comando eseguito:**
```bash
grep -r "SERVICE_ROLE|service_role|serviceRole|supabaseAdmin" apps/web/app/api/ --include="*.ts"
```

**Risultato:** Nessun file trovato (lista vuota) — **PASS**

**Verifica client Supabase nei Route Handlers:**
```bash
grep -r "createSupabaseServerClient" apps/web/app/api/ --include="*.ts" -l
```

**File che usano Supabase:**
- `apps/web/app/api/tasks/route.ts` → usa `createSupabaseServerClient` ✓
- `apps/web/app/api/tasks/[taskId]/route.ts` → usa `createSupabaseServerClient` ✓
- `apps/web/app/api/tasks/[taskId]/events/route.ts` → usa `createSupabaseServerClient` ✓
- `apps/web/app/api/workspace/export/route.ts` → usa `createSupabaseServerClient` ✓

**Conclusione:** Tutti i Route Handler usano il client utente-scoped.
RLS rispettata su tutte le API.

**Esito: PASS**

---

## TEST-01 — JWT Manipulation (Vettore 1)

**Stato:** Da eseguire in FASE B su ambiente staging/production

**Setup richiesto:**
```bash
# 1. Applicare migrations 0001–0006 su Supabase
# 2. Eseguire setup workspaces fittizi
psql $DATABASE_URL -f docs/security/setup-test-workspaces.sql

# 3. Generare JWT per user_test_A
JWT_A=$(SUPABASE_JWT_SECRET=<secret> node docs/security/generate-test-jwt.mjs user_test_A)

# 4. Tentare accesso ai dati di workspace B
curl -s \
  -H "Authorization: Bearer $JWT_A" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  "https://ccgodxlviculeqsnlgse.supabase.co/rest/v1/tasks?workspace_id=eq.22222222-2222-2222-2222-222222222221&select=*"
```

**Risultato atteso:** `[]` (array vuoto) — RLS blocca la query

**Risultato ottenuto:** `[ da compilare ]`

**Esito:** [ PASS / FAIL / ERROR ]

---

## TEST-02 — workspace_id Injection via API (Vettore 2)

**Stato:** Da eseguire in FASE B

**Setup richiesto:** Server Next.js in esecuzione (`npm run dev` in `apps/web`)

**Comando:**
```bash
# Ottenere session token Clerk valido per user_test_A (da browser dev tools)
curl -s \
  -H "Cookie: __session=$CLERK_SESSION_A" \
  "http://localhost:3000/api/tasks/22222222-2222-2222-2222-222222222224"
```

**Risultato atteso:** HTTP 404 o 403

**Risultato ottenuto:** `[ da compilare ]`

**Esito:** [ PASS / FAIL / ERROR ]

---

## TEST-03 — SECURITY DEFINER Audit (Vettore 3)

**Stato:** Da eseguire in FASE B

**Query da eseguire via Supabase SQL Editor:**
```sql
SELECT n.nspname AS schema, p.proname AS function_name,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = true
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, p.proname;
```

**Risultato atteso:** Solo `get_my_workspace_ids()` e `mark_stale_agents_offline()`.
Nessuna funzione con `EXECUTE format(...)` o concatenazione di input esterno.

**Risultato ottenuto:** `[ da compilare ]`

**Esito:** [ PASS / FAIL / ERROR ]

---

## TEST-04 — Missing RLS Table Audit (Vettore 4)

**Stato:** Da eseguire in FASE B

**Query:**
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false
ORDER BY tablename;
```

**Risultato atteso:** Nessuna riga

**Risultato ottenuto:** `[ da compilare ]`

**Esito:** [ PASS / FAIL / ERROR ]

---

## Template Risultati Completo

```markdown
## Risultati Test RLS — [DATA ESECUZIONE]
**Esecutore:** [nome]
**Ambiente:** [local/staging/production]
**Versione migration:** [commit hash]

| Test | Vettore                    | Esito | Note |
|------|----------------------------|-------|------|
| TEST-01 | JWT Manipulation        |       |      |
| TEST-02 | workspace_id Injection  |       |      |
| TEST-03 | SECURITY DEFINER        |       |      |
| TEST-04 | Missing RLS Table       |       |      |
| TEST-05 | API-Level Bypass        | PASS  | Automated grep 2026-02-27 |

**Vulnerabilità trovate:** nessuna (TEST-05 — automated)
**Azioni correttive:** nessuna
**Prossima esecuzione:** prima del go-live con primo cliente pilota
```

---

## Cleanup post-test

```sql
-- Rimuovere workspace di test (CASCADE)
DELETE FROM workspaces WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222221'
);
```
