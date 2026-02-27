# Runbook — Aggiornamento CLAUDE.md Cliente

**Sprint:** 5 FASE B — STORY-05.13
**Versione:** 1.0

---

## Quando aggiornare CLAUDE.md

Aggiornare il CLAUDE.md quando:

- **Stack cambia:** il cliente aggiunge un framework, cambia il package manager, introduce TypeScript
- **Convenzioni cambiano:** nuovo pattern per API routes, nuove regole di naming
- **Aree sensibili espanse:** nuove directory da non toccare (es. `payments/`, `infra/`)
- **Comandi cambiano:** `npm` → `pnpm`, test runner aggiornato, lint config modificata
- **Branch policy cambia:** rename `main` → `master`, introduzione di `develop`
- **Feedback post-task:** l'agente ha fatto errori ricorrenti che il CLAUDE.md avrebbe evitato

**Non aggiornare** per:
- Preferenze estetiche del cliente senza impatto sull'agente
- Commenti o documentazione che non guidano il comportamento dell'agente

---

## Procedura di aggiornamento

### 1. Identificare la modifica necessaria

Aprire `CLAUDE.md` nel repository del cliente:
```bash
cat /home/robin/repos/<CLIENT_SLUG>/CLAUDE.md
```

Identificare la sezione da modificare:
- `==INVARIANT==` — **non modificare mai** (protocollo ADWP, regole sicurezza)
- `==WORKSPACE==` — sezione modificabile (comandi, path, branch policy)
- `==STACK==` — sezione modificabile (pattern specifici dello stack)

### 2. Fare la modifica su branch dedicato

```bash
cd /home/robin/repos/<CLIENT_SLUG>
git checkout main
git pull origin main
git checkout -b chore/update-claude-md-$(date +%Y%m%d)

# Modificare CLAUDE.md
nano CLAUDE.md

# Verificare sintassi Markdown
# (opzionale) markdownlint CLAUDE.md
```

### 3. Testare la modifica con smoke test

Prima di committare, verificare manualmente:
- [ ] I comandi aggiornati funzionano nel contesto del repository
- [ ] I path sensibili aggiornati esistono nella struttura del progetto
- [ ] La branch policy è coerente con i branch esistenti su GitHub

### 4. Commit con formato standard

```bash
git add CLAUDE.md
git commit -m "chore(claude): update <cosa è cambiato>"
# Esempi:
# chore(claude): update test command to use vitest
# chore(claude): add src/payments/ to sensitive areas
# chore(claude): update main branch from master to main
```

### 5. Push e PR

```bash
git push origin chore/update-claude-md-$(date +%Y%m%d)
# Aprire PR su GitHub e chiedere review al cliente
```

### 6. Dopo il merge: verificare con test task

Creare una task di verifica:
```
Titolo: "Verifica CLAUDE.md aggiornato"
Tipo: chore
Descrizione: "Leggi il CLAUDE.md aggiornato e conferma che tutte le
sezioni siano corrette. Rispondi con un breve summary delle informazioni
principali che hai letto (stack, comandi principali, branch policy)."
```

Verificare che l'agente risponda correttamente, dimostrando che ha letto
il CLAUDE.md aggiornato.

---

## Rollback

Se la modifica peggiora il comportamento dell'agente:

```bash
cd /home/robin/repos/<CLIENT_SLUG>
git log -- CLAUDE.md --oneline
# Identificare l'ultimo commit buono

git checkout <commit_hash> -- CLAUDE.md
git commit -m "chore(claude): revert to working version"
git push
```

Il rollback è sempre possibile perché la storia di `CLAUDE.md` è tracciabile
via `git log -- CLAUDE.md`.

---

## Checklist pre-aggiornamento

- [ ] Nessuna task in esecuzione sul workspace del cliente
- [ ] La modifica è in `==WORKSPACE==` o `==STACK==` (mai `==INVARIANT==`)
- [ ] Il commit segue la convention `chore(claude): ...`
- [ ] La PR è stata reviewata dal cliente (o dall'operator se cambio tecnico)
- [ ] Test task eseguita dopo il merge con successo

---

## Riferimenti

- `docs/templates/CLAUDE.md` — template base
- `docs/templates/claude-md-questionnaire.md` — questionario onboarding
- `docs/runbook/claude-md-customization.md` — guida alla prima compilazione
