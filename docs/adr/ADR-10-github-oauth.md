# ADR-10 — GitHub Authentication: GitHub App

**Data:** 2026-02-28
**Stato:** Accepted
**Contesto:** Sprint A — GitHub OAuth integration
**Spike:** `docs/spikes/spike-A1-github-auth.md`

---

## Contesto

Robin.dev deve accedere alle repository GitHub del cliente in modo autonomo per clonare codice, creare branch, fare push di commit e aprire PR. Il cliente deve poter connettere il proprio account GitHub senza intervento manuale di Carlo.

La decisione riguarda il meccanismo di autenticazione: **GitHub App** o **OAuth App**.

---

## Decisione

**GitHub App.**

Robin.dev implementa una GitHub App registrata sull'account GitHub di Robin.dev. Ogni cliente installa l'app sul proprio account o organizzazione GitHub, selezionando le repository a cui Robin.dev può accedere. L'autenticazione avviene tramite installation access token generati on-demand con la chiave privata dell'App.

---

## Alternative Analizzate

### Alternativa 1 — OAuth App

**Descrizione:** flusso OAuth standard. Il founder autorizza Robin.dev con un redirect GitHub. Il token viene conservato nel database.

**Scope richiesto:** `repo` (l'unico scope che permette l'accesso a repo private e le operazioni di push/PR).

**Pro:**
- Setup più semplice per Carlo (registrazione OAuth App, nessuna chiave privata)
- Token a lunga durata, nessuna logica di refresh

**Contro:**
- Il scope `repo` concede accesso a **tutte** le repo private del cliente — non solo quelle selezionate. Inaccettabile per un servizio professionale.
- Il token è legato all'account del founder che ha autorizzato: se lascia l'azienda, il workspace smette di funzionare.
- Token a lunga durata: se compromesso, rimane valido finché non viene revocato manualmente.
- Deve essere conservato cifrato nel database (complessità storage).

**Motivo del rifiuto:** permessi troppo ampi (accesso a tutte le repo) e token legato a un singolo utente. Inaccettabile per il modello di fiducia di un servizio professional-grade.

---

## Conseguenze

### Conseguenze positive

1. **Permessi granulari.** Il cliente seleziona esattamente quali repository espone a Robin.dev al momento dell'installazione. Le altre repository del cliente rimangono inaccessibili.

2. **Sicurezza migliore senza complessità di storage.** Il token di installazione (1h) non viene mai conservato nel database. L'unico dato conservato è l'`installation_id` (un intero non sensibile). La chiave privata dell'App vive solo nelle variabili d'ambiente del backend.

3. **Indipendenza dall'utente.** L'installazione dell'app è a livello di account/organizzazione GitHub, non legata al singolo founder. Se il fondatore che ha connesso GitHub lascia il team, l'integrazione continua a funzionare.

4. **Esperienza professionale.** "Robin.dev" appare nella lista "Installed GitHub Apps" dell'organizzazione del cliente, esattamente come Vercel, Linear, Dependabot. È un'azione familiare per qualsiasi team tecnico.

5. **Auto-refresh trasparente.** Il token scade ogni ora ma viene rigenerato automaticamente prima di ogni operazione GitHub, senza intervento del founder.

### Conseguenze negative

1. **Setup una-tantum da parte di Carlo.** La GitHub App deve essere registrata nell'account GitHub di Robin.dev, con configurazione dei permessi e generazione della chiave privata. Fatto una sola volta, non scala con il numero di clienti.

2. **Il cliente deve "installare" l'app.** Aggiunge un passaggio rispetto al flusso OAuth puro. Mitigato da: il passaggio è standard e familiare, con una UX guidata dalla dashboard di Robin.dev.

3. **Generazione token on-demand.** Il worker deve richiamare l'API GitHub per ottenere un installation token prima di ogni operazione. Overhead minimo (< 200ms per richiesta), completamente trasparente.

---

## Permessi richiesti alla GitHub App

| Permesso | Livello | Utilizzo |
|---|---|---|
| `contents` | Read & write | Clonare repo, creare branch, push commit |
| `pull_requests` | Read & write | Aprire PR, leggere commenti PR (rework) |
| `metadata` | Read | Obbligatorio (incluso automaticamente) |

Non richiedere permessi aggiuntivi in v1.0. Principio del minimo privilegio.

---

## Dati da conservare

| Dato | Storage | Formato |
|---|---|---|
| GitHub App ID | Env var backend (`GITHUB_APP_ID`) | Intero |
| GitHub App private key | Env var backend (`GITHUB_APP_PRIVATE_KEY`) | Base64-encoded PEM |
| Installation ID per workspace | `github_connections.installation_id` | Intero (plain text) |
| Installation access token | **Mai conservato** | Generato on-demand |

---

## Flusso di autenticazione

```
Founder in dashboard → click "Connetti GitHub"
  → redirect a GitHub App installation page
  → founder seleziona account/org e repository
  → GitHub redirect a /api/auth/github/callback?installation_id=XXX
  → backend verifica installation_id tramite GitHub API
  → salva installation_id in github_connections (workspace)
  → redirect a dashboard con stato "Connesso"

Worker BullMQ (pre-task):
  → legge installation_id dal workspace
  → POST /app/installations/{id}/access_tokens con JWT firmato
  → usa il token risultante per le operazioni GitHub (clone, push, PR)
  → token scartato dopo l'uso (non conservato)
```

---

## Gestione scenari di errore

| Scenario | Comportamento |
|---|---|
| Cliente rimuove l'app da GitHub | Task passa a `status=blocked` con motivo `github_installation_revoked`. Banner in dashboard con CTA "Reinstalla Robin.dev App". |
| Chiave privata App mancante/corrotta | Errore a livello di sistema (non del workspace cliente). Banner "Integrazione GitHub non disponibile". Carlo deve aggiornare l'env var. |
| Repository non più accessibile | Task passa a `failed` con messaggio leggibile. Sync job giornaliero aggiorna lo stato delle repository nel DB. |
| Repository rinominata | GitHub restituisce 301 con nuovo URL. Il sync job aggiorna `repositories.full_name`. |

---

## Tabelle dati associate (vedere Migration 0007)

- `github_connections`: connessione GitHub per workspace
- `repositories`: repository abilitate per workspace
- `agent_repositories`: associazione many-to-many agente ↔ repository

---

## Riferimenti

- `docs/spikes/spike-A1-github-auth.md` — analisi completa
- [GitHub Apps documentation](https://docs.github.com/en/apps)
- ADR-09: Modello di isolamento infrastrutturale
- Migration: `supabase/migrations/0007_github_integration.sql`
