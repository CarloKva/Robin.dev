# Spike-A1 — GitHub Authentication per Robin.dev

**Sprint:** A
**Stato:** Completato
**Data:** 2026-02-28
**Autore:** Carlo Ferrero
**Decisione derivata:** ADR-10
**Time-box rispettato:** ~3h

---

## Obiettivo

Definire come Robin.dev accede alle repository GitHub del cliente in modo autonomo. Analizzare le due opzioni principali (GitHub App vs OAuth App), determinare gli scope/permessi minimi necessari, documentare la strategia di storage del token e i failure mode critici.

---

## Domanda centrale

Robin.dev deve clonare repository, creare branch, fare push di commit e aprire PR — autonomamente, su VPS remote, per conto del cliente. Il token deve sopravvivere alla sessione del founder e funzionare anche quando il founder non è online.

Quale meccanismo di autenticazione garantisce il minor rischio operativo con il minor attrito di setup per i primi 3–5 clienti pilota?

---

## Opzione A — GitHub App

### Come funziona

Il maintainer di Robin.dev (Carlo) crea una **GitHub App** nell'account GitHub di Robin.dev. Ogni cliente installa questa app sul proprio account o organizzazione GitHub, selezionando le repository a cui Robin.dev può accedere.

L'autenticazione avviene in due step:

1. **App authentication:** Robin.dev firma una JWT con la chiave privata dell'App (RSA/Ed25519) per autenticarsi come App su GitHub API.
2. **Installation token:** tramite la JWT, Robin.dev ottiene un installation access token (`ghs_...`) specifico per l'installazione di quel cliente. Questo token scade dopo 1 ora, ma può essere rigenerato in qualsiasi momento senza intervento del cliente.

```
Cliente installa "Robin.dev App" → seleziona repo → GitHub assegna installation_id
Robin.dev usa installation_id + private key → ottiene token orario → opera su repo
```

### Permessi disponibili

I permessi GitHub App sono granulari a livello di repository:

| Permesso | Livello | Necessario per Robin |
|---|---|---|
| `contents` | Read & write | Clonare repo, creare branch, fare push |
| `pull_requests` | Read & write | Aprire PR, leggere PR comments |
| `metadata` | Read | Obbligatorio, incluso automaticamente |
| `statuses` | Read & write | (Opzionale) Aggiornare CI status |

**Scope minimi:** `contents: write`, `pull_requests: write`, `metadata: read`

### Pro

- **Permessi granulari per repo.** Il cliente seleziona esattamente quali repository esporre a Robin.dev — non tutte o nessuna.
- **Token a breve durata (1h).** Un token compromesso scade da solo. Non serve revoca manuale.
- **Non dipende dall'utente che ha autorizzato.** Se il founder lascia l'azienda, l'installazione della GitHub App rimane valida — non è legata a un account personale.
- **Esperienza professionale.** Robin.dev appare nella lista "Installed GitHub Apps" dell'organizzazione del cliente, esattamente come Vercel, Linear, Dependabot.
- **Nessun token da conservare a lungo termine.** L'`installation_id` (un intero) è il solo dato sensibile da conservare. Il token viene generato on-demand.
- **Granularità organizzazione.** L'app può essere installata a livello di org, consentendo accesso a tutte le repo dell'org senza ri-autorizzazione per ogni nuova repo.

### Contro

- **Setup iniziale più complesso.** Carlo deve registrare la GitHub App nell'account Robin.dev, configurare i permessi, generare la chiave privata, e distribuire la chiave al backend.
- **Token scade ogni ora.** Il worker deve rigenerare il token prima di ogni operazione. Richiede logica di refresh, ma è completamente trasparente al founder.
- **Il cliente deve "installare" l'app.** Aggiunge un passaggio rispetto a OAuth App. Ma è un'azione standard e familiare (Vercel, Linear, Netlify usano lo stesso pattern).

---

## Opzione B — OAuth App

### Come funziona

Carlo registra una **OAuth App** nell'account GitHub di Robin.dev. Ogni cliente autorizza l'app tramite il flusso OAuth standard (redirect → autorizza → callback con code → scambia con token).

Il token (`gho_...`) è a **lunga durata** (non scade per default) ed è legato all'account del founder che ha autorizzato.

### Scope disponibili

Gli scope OAuth sono meno granulari:

| Scope | Cosa concede |
|---|---|
| `repo` | Accesso completo a tutte le repo private e pubbliche |
| `public_repo` | Solo repo pubbliche |
| `read:org` | Leggere info organizzazione |

**Problema:** non è possibile limitare l'accesso a sole alcune repo con OAuth App. `repo` scope concede accesso a **tutte** le repo del cliente — incluse quelle che non riguardano Robin.dev.

### Pro

- Setup semplice: flusso OAuth standard, nessuna "installazione" dell'app.
- Token di lunga durata: non serve logica di refresh.
- Ben documentato, pattern ampiamente compreso.

### Contro

- **Permessi troppo ampi.** Il scope `repo` concede accesso a tutte le repo private. Non è possibile limitare a un subset. Per un servizio professionale, questo è inaccettabile.
- **Token legato all'utente.** Se il founder che ha autorizzato lascia l'azienda o disabilita il proprio account, l'intero workspace di Robin.dev smette di funzionare.
- **Token a lunga durata = rischio.** Se il token viene compromesso (log, breach), ha validità indefinita finché non viene revocato manualmente.
- **Revoca manuale complessa.** Il fondatore deve andare su GitHub Settings → Applications → Revoke. Non c'è meccanismo di revoca automatica.

---

## Confronto finale

| Criterio | GitHub App | OAuth App |
|---|---|---|
| Granularità permessi | Per repository | Tutte o nessuna |
| Durata token | 1h (auto-refresh) | Lunga durata (nessun expire) |
| Dipendenza da utente specifico | No (installazione a livello org) | Sì (legata al founder) |
| Complessità setup iniziale (Carlo) | Media | Bassa |
| Complessità setup per il cliente | "Installa app" (1 click) | Flusso OAuth standard |
| Esperienza professionale | Alta (come Vercel, Linear) | Media |
| Sicurezza in caso di breach | Alta (token scade in 1h) | Bassa |
| Overhead tecnico (token refresh) | Basso (generazione on-demand) | Zero |

---

## Scope OAuth minimi necessari (GitHub App)

Per il workflow completo di Robin.dev:

| Operazione | Permesso richiesto |
|---|---|
| Clonare la repository sul VPS | `contents: read` (incluso in write) |
| Creare branch, fare commit, push | `contents: write` |
| Aprire una Pull Request | `pull_requests: write` |
| Leggere commenti su PR (per rework) | `pull_requests: read` (incluso in write) |
| Leggere lista repo disponibili | `metadata: read` |

**Permessi da richiedere all'installazione:** `contents: write`, `pull_requests: write`, `metadata: read`

Non richiedere `statuses: write` in v1.0 — aggiungere solo se si implementa CI status update.

---

## Strategia di storage del token

### Cosa conservare

Con GitHub App, l'unico dato sensibile a lungo termine è la **chiave privata dell'App** (usata per firmare JWT). I token di installazione sono effimeri (1h) e non vengono conservati.

| Dato | Sensibilità | Dove conservare |
|---|---|---|
| GitHub App private key | **Critica** | Variabile d'ambiente del backend (`GITHUB_APP_PRIVATE_KEY` base64) |
| GitHub App ID | Bassa | Variabile d'ambiente (`GITHUB_APP_ID`) |
| Installation ID per workspace | Bassa | `github_connections.installation_id` (plain text nel DB) |
| Installation access token | Effimero | Mai conservato — generato on-demand, usato, scartato |

### Perché non nel database

La chiave privata dell'App **non deve mai essere nel database** — non cifrata, non come hash, non in nessuna forma. Il database è potenzialmente esposto tramite backup, log di query, tool di monitoring. La chiave vive solo nelle variabili d'ambiente del backend (Vercel env vars + secrets dell'orchestratore).

### Confronto con OAuth App (ipotetico)

Se avessimo usato OAuth App, il token (`gho_...`) avrebbe dovuto essere conservato cifrato nel DB (`github_connections.access_token`). Le opzioni erano:

- **pgcrypto `pgp_sym_encrypt`**: cifratura simmetrica con chiave env. Pratico ma richiede passare la chiave di decifrazione ad ogni query.
- **Supabase Vault**: disponibile solo su Pro plan, aggiunge complessità.
- **Colonna cifrata lato applicazione**: cifrazione AES-256-GCM nel backend prima dell'INSERT. Solido ma richiede logica custom.

Con GitHub App questo problema non si pone — **il token è sempre generato on-demand e mai persistito**.

---

## Scenari di errore e come gestirli

### Scenario 1 — Chiave privata non disponibile/corrotta

**Causa:** la variabile d'ambiente `GITHUB_APP_PRIVATE_KEY` è mancante o malformata.

**Cosa succede:** la generazione del JWT fallisce immediatamente. Nessun token viene generato.

**Dashboard:** banner persistente "Integrazione GitHub non disponibile — contatta il supporto". Il task non viene avviato.

**Recupero:** Carlo aggiorna la variabile d'ambiente e fa restart del backend.

---

### Scenario 2 — Installation revocata (cliente rimuove l'app)

**Causa:** il cliente va su GitHub → Settings → Applications → Uninstall "Robin.dev".

**Cosa succede:** la generazione del token di installazione fallisce con `401 Unauthorized`. L'`installation_id` nel DB punta a un'installazione non più valida.

**Cosa mostra la dashboard:** banner persistente con "Connessione GitHub revocata. Per riprendere le attività, reinstalla Robin.dev App." + pulsante che porta direttamente al flow di reinstallazione.

**Task in corso:** il task in esecuzione riceve l'errore al prossimo tentativo di operazione GitHub (push, apertura PR). Il task passa a `status=blocked` con motivo `github_installation_revoked`. Nessun lavoro viene perso — il branch esiste ancora sul VPS locale.

**Recupero:** il fondatore reinstalla l'app (5 secondi su GitHub), l'`installation_id` viene aggiornato nel DB, il task può riprendere.

---

### Scenario 3 — Repo eliminata o rinominata tra la creazione del task e l'esecuzione

**Causa:** il fondatore crea un task su `acme/frontend`, poi rinomina la repo in `acme/web` prima che l'agente la cloni.

**Cosa succede:** la chiamata `git clone` fallisce con "Repository not found". L'agente non può procedere.

**Dashboard:** il task passa a `status=failed` con evento `agent.blocked` e messaggio "La repository acme/frontend non è raggiungibile. Potrebbe essere stata rinominata o eliminata."

**Recupero:** il fondatore verifica su GitHub, aggiorna il campo repository nella task se necessario, e riavvia il task.

**Prevenzione (TASK-A.07.4):** il job di sincronizzazione quotidiana verifica che le repository abilitate siano ancora raggiungibili e aggiorna il record se la repo è stata rinominata (GitHub restituisce il nuovo nome nella risposta 301).

---

### Scenario 4 — Repository privata con permessi insufficienti

**Causa:** il cliente ha installato Robin.dev App solo su alcune repository, ma il fondatore crea un task su una repo non inclusa nell'installazione.

**Cosa succede:** la call GitHub API per clonare la repo restituisce `404 Not Found` (GitHub restituisce 404, non 403, per le repo private non autorizzate — security by obscurity).

**Dashboard:** messaggio "Impossibile accedere alla repository. Verifica che Robin.dev App sia installata su questa repository." + link alle impostazioni GitHub dell'app.

---

## Raccomandazione

**GitHub App** è la scelta giusta per Robin.dev, anche per il pilota con 3–5 clienti.

Le ragioni principali:

1. **Sicurezza migliore senza complessità di storage.** Nessun token a lunga durata da conservare cifrato nel DB. La chiave privata vive solo negli env vars.
2. **Esperienza professionale.** Il cliente installa Robin.dev App esattamente come farebbe con Vercel o Linear. È un'azione familiare per qualsiasi team tecnico.
3. **Permessi granulari.** Il cliente controlla esattamente quali repository espone. Questo è un prerequisito per la fiducia del cliente early-adopter.
4. **Indipendenza dall'utente.** L'installazione dell'app non dipende dall'account di un singolo founder — è un'installazione a livello di account/org.

Il costo è leggermente maggiore overhead in fase di setup (Carlo deve registrare la GitHub App), ma questo avviene una sola volta e non scala con il numero di clienti.

---

## Riferimenti

- [GitHub Apps documentation](https://docs.github.com/en/apps)
- [Creating installation access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
- [GitHub App permissions reference](https://docs.github.com/en/rest/overview/permissions-required-for-github-apps)
- ADR-10: `docs/adr/ADR-10-github-oauth.md`
