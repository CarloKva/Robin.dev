# Robin.dev — Manual End-to-End Testing Checklist

**Versione:** 1.0
**Data:** 2026-02-27
**Ambiente target:** Deployed (Production / Staging su Vercel + VPS)

---

## Come usare questa checklist

Ogni sezione rappresenta un'area funzionale del sistema. Per ogni test:
- **[ ]** = da eseguire
- **[P]** = PASS
- **[F]** = FAIL (documentare il problema)
- **[S]** = SKIP (con motivazione)

Eseguire i test in ordine: le sezioni successive dipendono da quelle precedenti.

---

## 1. Autenticazione e Accesso

### 1.1 — Signup nuovo utente

- [ ] Aprire il sito in una finestra privata del browser
- [ ] Verificare che le route protette (`/dashboard`, `/tasks`, `/metrics`) redirigano a `/sign-in`
- [ ] Cliccare "Sign Up"
- [ ] Completare la registrazione con Google OAuth
- [ ] Verificare che dopo il signup venga rediretto a `/onboarding/workspace`
- [ ] Verificare che la pagina di onboarding non sembri rotta (layout corretto, form visibile)

### 1.2 — Login utente esistente

- [ ] Visitare `/sign-in`
- [ ] Login con Google OAuth
- [ ] Verificare redirect a `/dashboard` (se workspace esiste)
- [ ] Verificare che il nome utente / avatar appaia nell'header

### 1.3 — Logout

- [ ] Cliccare su `UserButton` (avatar) nell'header
- [ ] Cliccare "Sign Out"
- [ ] Verificare redirect a `/sign-in`
- [ ] Verificare che navigare direttamente a `/dashboard` rediriga a `/sign-in`

### 1.4 — Sessione scaduta / token invalido

- [ ] Login normalmente
- [ ] Cancellare manualmente i cookie di sessione Clerk dal browser
- [ ] Ricaricare la pagina
- [ ] Verificare redirect a `/sign-in` senza crash o pagina bianca
- [ ] Verificare che non vengano mostrati dati parziali o errori non gestiti

---

## 2. Onboarding e Workspace

### 2.1 — Creazione workspace (primo accesso)

- [ ] Dopo il signup, verificare che la pagina `/onboarding/workspace` mostri il form
- [ ] Verificare i campi: nome workspace, slug (auto-generato dal nome, modificabile)
- [ ] Inserire un nome e verificare che lo slug venga generato correttamente (lowercase, no spazi)
- [ ] Modificare lo slug manualmente e verificare che venga accettato
- [ ] Cliccare "Crea workspace"
- [ ] Verificare redirect a `/dashboard`
- [ ] Verificare che il nome workspace appaia nell'header/sidebar

### 2.2 — Slug duplicato

- [ ] Tentare di creare un workspace con uno slug già esistente
- [ ] Verificare che appaia un errore chiaro (es. "Slug già in uso")
- [ ] Verificare che il form non si resetti e l'utente possa correggere

### 2.3 — Utente senza workspace

- [ ] Se l'utente non ha un workspace, verificare che qualsiasi route protetta rediriga a `/onboarding/workspace`
- [ ] Verificare che non ci siano crash o pagine bianche

---

## 3. Dashboard

### 3.1 — Dashboard con dati

- [ ] Effettuare login in un workspace con task esistenti
- [ ] Verificare che la dashboard carichi senza errori
- [ ] Verificare la presenza dei tre metric tile: "Task completate", "In coda", "Richiedono attenzione"
- [ ] Verificare che i valori dei tile siano coerenti con i dati reali del workspace
- [ ] Verificare che il tile "Richiedono attenzione" abbia sfondo rosso/arancione se il conteggio è > 0
- [ ] Verificare la sezione "Task in corso" (se c'è una task in_progress): titolo, fase ADWP corrente, tempo trascorso
- [ ] Verificare il feed eventi recenti: almeno gli ultimi eventi visibili con timestamp relativo
- [ ] Cliccare su un evento nel feed → verificare redirect alla task detail corretta
- [ ] Verificare che la loading state mostri skeleton loader (non pagina bianca)

### 3.2 — Dashboard vuota (empty state)

- [ ] Effettuare login in un workspace senza task
- [ ] Verificare che appaia l'empty state "Come iniziare" con i 3 passi
- [ ] Verificare che la CTA "Crea la tua prima task" funzioni e porti a `/tasks/new`
- [ ] Verificare che la dashboard non sembri "rotta" (layout integro, testi leggibili)

### 3.3 — Stato agente

- [ ] Verificare che il badge `AgentStatusBadge` sia visibile nella dashboard
- [ ] Se agente idle: verificare testo "Agente pronto" con dot neutro
- [ ] Se agente busy: verificare testo "Lavora su: [titolo task]" con dot verde pulsante
- [ ] Se agente offline: verificare testo "Realtime offline" con dot grigio

### 3.4 — Real-time sulla dashboard

- [ ] Tenere la dashboard aperta
- [ ] Creare una task da un'altra finestra/tab
- [ ] Verificare che il feed eventi si aggiorni senza refresh manuale
- [ ] Verificare che i metric tile si aggiornino (potrebbe avere un delay di ~60s)
- [ ] Verificare che lo stato agente cambi in real-time quando una task viene presa in carico

---

## 4. Task Creation

### 4.1 — Accesso al form di creazione

- [ ] Dalla dashboard, cliccare "+ Nuova task" → verificare redirect a `/tasks/new`
- [ ] Dalla lista task, cliccare "+ Nuova task" → verificare redirect a `/tasks/new`
- [ ] Da qualsiasi pagina (fuori da un input), premere `N` → verificare redirect a `/tasks/new`

### 4.2 — Form di creazione task

- [ ] Verificare che il form mostri i campi: titolo, descrizione, tipo, priorità, agente
- [ ] Verificare che il campo priorità abbia default `medium`
- [ ] Verificare che il campo agente sia pre-selezionato se c'è un solo agente
- [ ] Verificare il placeholder del campo descrizione (esempio concreto)
- [ ] Verificare che il pannello preview TASK.md si aggiorni in real-time mentre si compila il form

### 4.3 — Validazione client-side

- [ ] Tentare di inviare con titolo vuoto → verificare errore inline sul campo
- [ ] Tentare di inviare con titolo < 5 caratteri → verificare errore "Titolo troppo corto"
- [ ] Tentare di inviare con descrizione vuota → verificare errore inline
- [ ] Tentare di inviare con descrizione < 20 caratteri → verificare errore "Descrizione troppo corta"
- [ ] Tentare di inviare senza selezionare tipo → verificare errore
- [ ] Verificare che la validazione sia inline (feedback sui campi), non solo al submit
- [ ] Verificare che il form non navighi via se ci sono errori di validazione

### 4.4 — Indicatore qualità descrizione

- [ ] Scrivere una descrizione corta (< 50 char) → verificare indicatore "poor" (rosso)
- [ ] Scrivere una descrizione media (50-150 char) → verificare indicatore "fair" (giallo)
- [ ] Scrivere una descrizione lunga (> 150 char) con keyword pertinenti → verificare "good" (verde)
- [ ] Selezionare tipo "bug" → verificare suggerimento "includi comportamento attuale e atteso"
- [ ] Selezionare tipo "feature" → verificare suggerimento su criteri di accettazione
- [ ] Verificare che l'indicatore non blocchi il submit (è solo orientativo)

### 4.5 — Submit e redirect

- [ ] Compilare tutti i campi correttamente e inviare
- [ ] Verificare submit ottimistico: la task appare subito nella lista
- [ ] Verificare redirect alla Task Detail con banner "Task creata — l'agente la prenderà in carico a breve"
- [ ] Verificare che la task sia effettivamente presente su Supabase (controllare nella lista task)

### 4.6 — Errore server al submit

- [ ] Simulare un errore server (es. disconnettere rete momentaneamente)
- [ ] Verificare che appaia un toast di errore
- [ ] Verificare che la task ottimistica venga rimossa dalla lista (rollback)

### 4.7 — Nessun agente disponibile

- [ ] Se nel workspace non ci sono agenti configurati, verificare che il form mostri "Nessun agente configurato"
- [ ] Verificare che il bottone submit sia disabilitato

---

## 5. Task List

### 5.1 — Visualizzazione lista

- [ ] Navigare a `/tasks`
- [ ] Verificare che le task del workspace siano visibili
- [ ] Verificare l'ordinamento default: task in_progress prima, poi per created_at DESC
- [ ] Verificare che ogni task card mostri: titolo, stato (badge colorato), tipo, priorità, agente, data
- [ ] Verificare che task `blocked`/`failed` abbiano bordo sinistro rosso/arancione
- [ ] Verificare che task `in_progress` abbiano bordo sinistro blu/indigo + indicatore fase

### 5.2 — Filtri

- [ ] Usare il filtro Stato → selezionare "blocked" → verificare che solo le task bloccate appaiano
- [ ] Usare il filtro Tipo → selezionare "bug" → verificare filtro corretto
- [ ] Usare il filtro Priorità → selezionare "high" → verificare filtro corretto
- [ ] Usare il filtro Periodo → selezionare "questa settimana" → verificare
- [ ] Combinare più filtri (AND logic) → verificare che funzionino insieme
- [ ] Verificare che i filtri attivi si riflettano nell'URL (es. `/tasks?status=blocked&type=bug`)
- [ ] Ricaricare la pagina → verificare che i filtri persistano dall'URL
- [ ] Cliccare "Rimuovi tutti" → verificare che tutti i filtri vengano rimossi
- [ ] Verificare che il cambio filtro non causi full page reload (aggiornamento client-side)

### 5.3 — Ricerca

- [ ] Digitare nel campo di ricerca → verificare debounce (~300ms)
- [ ] Cercare per titolo di una task esistente → verificare che appaia
- [ ] Cercare per parola nella descrizione → verificare risultati
- [ ] Cercare un termine inesistente → verificare messaggio "Nessun risultato per '[termine]'"

### 5.4 — Paginazione

- [ ] Con > 20 task, verificare che la paginazione appaia
- [ ] Cliccare "Successiva" → verificare che carichi la pagina 2
- [ ] Cliccare "Precedente" → verificare ritorno a pagina 1
- [ ] Verificare che l'URL includa il parametro pagina

### 5.5 — Empty states

- [ ] Con 0 task nel workspace → verificare messaggio "Nessuna task" + CTA "Crea la tua prima task"
- [ ] Con filtri attivi e 0 risultati → verificare "Nessuna task corrisponde ai filtri" + link "Rimuovi filtri"

### 5.6 — Navigazione dalla lista

- [ ] Cliccare su una task card → verificare redirect alla task detail (`/tasks/[id]`)

---

## 6. Task Detail

### 6.1 — Visualizzazione completa

- [ ] Aprire una task con dati completi (eventi, PR, commit)
- [ ] Verificare breadcrumb: "Tasks / [titolo troncato a 40 char]"
- [ ] **Colonna sinistra (metadata):** titolo, stato (badge), tipo, priorità, agente, data creazione, durata
- [ ] **Metriche esecuzione:** fasi completate, commit totali, file modificati
- [ ] **PR card:** numero PR, titolo, stato (open/merged/closed), branch, link GitHub, additions/deletions
- [ ] **Deploy preview card:** URL cliccabile, stato deploy (building/ready/error)
- [ ] **Lista commit:** SHA abbreviato (link GitHub), messaggio, timestamp, changes
- [ ] **Colonna destra (timeline):** eventi in ordine cronologico con icone, testo narrativo, timestamp relativo

### 6.2 — Timeline eventi

- [ ] Verificare che gli eventi siano differenziati visivamente per categoria (colori diversi per agent/human/stato)
- [ ] Verificare che gli eventi chiave (PR aperta, blocco, completamento) abbiano enfasi visiva maggiore
- [ ] Verificare i timestamp relativi ("3 minutes ago", "1 hour ago")
- [ ] Verificare che i timestamp si aggiornino senza refresh (da "just now" a "2 minutes ago")

### 6.3 — Real-time sulla task detail

- [ ] Tenere aperta la task detail di una task in_progress
- [ ] Verificare che nuovi eventi appaiano nella timeline senza refresh
- [ ] Verificare che appaia il badge "N new events" se si è scrollato in alto
- [ ] Verificare che lo scroll non venga interrotto quando arrivano nuovi eventi
- [ ] Verificare che lo stato (badge) nella colonna sinistra si aggiorni in real-time

### 6.4 — Editing inline

- [ ] Cliccare sul titolo → verificare che diventi editabile (input)
- [ ] Modificare il titolo → premere Enter o fare blur → verificare salvataggio
- [ ] Cliccare sulla descrizione → verificare che diventi editabile (textarea)
- [ ] Modificare la descrizione → premere Ctrl+Enter o fare blur → verificare salvataggio
- [ ] Verificare aggiornamento ottimistico (il valore cambia subito, prima della risposta server)
- [ ] Verificare che l'editing sia **disabilitato** se la task è in stato `in_progress`
- [ ] Verificare il tooltip "L'agente sta lavorando su questa task" quando il campo è disabilitato

### 6.5 — Azioni contestuali

- [ ] Task in stato `blocked`: verificare che il bottone "Sblocca" sia visibile
- [ ] Cliccare "Sblocca" → verificare alert con motivo del blocco e campo di risposta
- [ ] Inviare risposta di sblocco → verificare che la task torni a `in_progress`
- [ ] Task in stato `backlog`: verificare bottone "Cancella" visibile
- [ ] Cliccare "Cancella" → verificare AlertDialog di conferma
- [ ] Confermare cancellazione → verificare che la task passi a `cancelled`
- [ ] Task in stato `backlog`: verificare bottone "Riassegna" visibile
- [ ] Task in stato `in_progress`: verificare che "Cancella" e "Riassegna" NON siano visibili

### 6.6 — PR e artifact

- [ ] Su una task con PR aperta, cliccare "Apri su GitHub" → verificare che apra in nuova tab la PR corretta
- [ ] Verificare badge "Review richiesta" se la PR è open e non reviewata
- [ ] Su una task con deploy preview, cliccare "Apri preview" → verificare che apra in nuova tab l'URL Vercel
- [ ] Verificare che se non c'è PR, la PR card non appaia
- [ ] Verificare che se non c'è deploy preview, la deploy card non appaia

### 6.7 — Task non trovata

- [ ] Navigare a `/tasks/[uuid-inesistente]`
- [ ] Verificare redirect a `/tasks` (non crash o pagina bianca)

---

## 7. Metrics

### 7.1 — Visualizzazione metriche

- [ ] Navigare a `/metrics`
- [ ] Verificare il selettore periodo: 7gg, 30gg, 90gg
- [ ] Verificare le 5 metriche presenti:
  - [ ] **Cycle time medio** (in ore) con trend vs periodo precedente
  - [ ] **PR approval rate** (%) con trend
  - [ ] **Escalation rate** (%) con trend
  - [ ] **Task completate** (numero) con breakdown per tipo
  - [ ] **Accuracy rate** (%) con trend
- [ ] Verificare che ogni metrica abbia tooltip esplicativo (hover su icona [?])
- [ ] Cambiare periodo → verificare che i valori si aggiornino

### 7.2 — Metriche con dati insufficienti

- [ ] Con 0 task completate nel periodo selezionato → verificare "0" o "N/A" con messaggio esplicativo
- [ ] Con periodo troppo breve per calcolare trend → verificare assenza della freccia trend

### 7.3 — Export report

- [ ] Cliccare "Esporta report"
- [ ] Verificare che si scarichi un file `robindev-report-YYYY-MM.md`
- [ ] Aprire il file → verificare che contenga: periodo, tutte le metriche, lista task completate, lista task bloccate
- [ ] Simulare errore di export → verificare toast "Impossibile generare il report"

---

## 8. Navigazione e Layout

### 8.1 — Sidebar

- [ ] Verificare link sidebar: Dashboard, Tasks, Agents, Metrics, Settings
- [ ] Verificare che il link attivo abbia bordo sinistro colorato (brand)
- [ ] Cliccare ogni link → verificare navigazione corretta
- [ ] Verificare che il logo Robin.dev sia presente in cima alla sidebar

### 8.2 — Header

- [ ] Verificare che il nome del workspace appaia nell'header
- [ ] Verificare che l'avatar utente (Clerk `UserButton`) sia visibile
- [ ] Verificare che il badge stato agente sia visibile nell'header

### 8.3 — Keyboard shortcuts

- [ ] Da qualsiasi pagina (fuori da un input), premere `N` → verificare navigazione a `/tasks/new`
- [ ] All'interno di un input o textarea, premere `N` → verificare che NON navighi (digitazione normale)

---

## 9. Responsive (Mobile)

Eseguire su viewport 375px (iPhone SE) o device reale.

### 9.1 — Dashboard mobile

- [ ] Layout a colonna singola (no sidebar fissa)
- [ ] Hero section con stato agente visibile above the fold
- [ ] Feed eventi leggibile senza zoom
- [ ] Nessun overflow orizzontale

### 9.2 — Task detail mobile

- [ ] Timeline occupa tutta la larghezza
- [ ] Metadata collassabile in accordion (di default collassato)
- [ ] Bottoni di azione ≥ 44px di altezza (tappabili)
- [ ] Nessun overflow orizzontale

### 9.3 — Task creation mobile

- [ ] Form a colonna singola (preview collassata o sotto il form)
- [ ] Tutti i campi accessibili senza zoom
- [ ] Bottone submit visibile e tappabile

### 9.4 — Task list mobile

- [ ] Task card leggibili senza overflow
- [ ] Filtri accessibili (forse in dropdown o accordion)
- [ ] Paginazione funzionante

### 9.5 — Sidebar mobile

- [ ] Sidebar collassata di default
- [ ] Hamburger menu per aprire la sidebar
- [ ] Overlay quando sidebar è aperta
- [ ] Cliccare un link chiude la sidebar

---

## 10. Flusso End-to-End Completo (Agent Pipeline)

Questo è il test più importante. Riproduce il flusso reale di utilizzo del sistema.

### 10.1 — Creazione task → Agente esegue → PR aperta

- [ ] Login al gestionale
- [ ] Creare una nuova task:
  - Titolo: "Test E2E — aggiungi file di test"
  - Tipo: chore
  - Priorità: low
  - Descrizione: "Aggiungi un file `E2E_TEST.md` alla root del repository con la data e ora corrente."
- [ ] Verificare redirect alla task detail con banner di conferma
- [ ] Osservare la dashboard: lo stato agente cambia da `idle` a `busy`
- [ ] Tornare alla task detail: osservare la timeline in real-time
  - [ ] Evento `task.created` presente
  - [ ] Evento `task.state.changed` (pending → in_progress) presente
  - [ ] Evento `agent.phase.started` (analysis) presente
  - [ ] Eventi successivi delle fasi ADWP (write, proof, etc.)
  - [ ] Evento `agent.commit.pushed` con SHA e messaggio
  - [ ] Evento `agent.pr.opened` con URL PR
- [ ] Verificare che la PR card appaia nella colonna sinistra con link GitHub
- [ ] Verificare che il deploy preview card appaia (se configurato)
- [ ] Cliccare "Apri su GitHub" → verificare che la PR esista con i commit dell'agente
- [ ] Verificare che lo stato task finale sia `in_review` o `completed`
- [ ] Tornare alla dashboard: verificare che lo stato agente torni `idle`

### 10.2 — Task bloccata → Sblocco umano → Ripresa

- [ ] Creare una task con descrizione volutamente ambigua:
  - Titolo: "Test blocco — task ambigua"
  - Descrizione: "Fai quella cosa che abbiamo discusso ieri."
- [ ] Osservare la timeline: l'agente dovrebbe bloccarsi con una domanda
- [ ] Verificare evento `agent.blocked` nella timeline
- [ ] Verificare stato task → `blocked`
- [ ] Nella dashboard: verificare tile "Richiedono attenzione" con conteggio > 0
- [ ] Aprire la task detail → verificare alert rosso/ambra con motivo del blocco
- [ ] Compilare il campo di risposta e inviare
- [ ] Verificare che la task riprenda (stato → `in_progress`)
- [ ] Verificare evento `human.approved` nella timeline

### 10.3 — Task fallita

- [ ] Se possibile, provocare il fallimento di una task (es. repository non accessibile)
- [ ] Verificare stato task → `failed`
- [ ] Verificare evento `task.failed` nella timeline con error_code e messaggio
- [ ] Nella task detail: verificare che le informazioni sull'errore siano leggibili

---

## 11. Sicurezza e Isolamento (Multi-Tenant)

### 11.1 — RLS: isolamento dati tra workspace

- [ ] Con due utenti di workspace diversi (A e B), verificare:
  - [ ] Utente A NON vede task di workspace B nella lista task
  - [ ] Utente A NON vede eventi di workspace B nella timeline
  - [ ] Utente A NON può accedere a `/tasks/[id-task-di-B]` (redirect o 404)
  - [ ] I contatori della dashboard di A riflettono solo i dati di workspace A

### 11.2 — API: protezione endpoint

- [ ] Chiamare `GET /api/tasks` senza autenticazione → verificare redirect o 401
- [ ] Chiamare `POST /api/tasks` senza autenticazione → verificare 401
- [ ] Chiamare `PATCH /api/tasks/[id]` con task di un altro workspace → verificare 404 o 403

### 11.3 — Service role key non esposta

- [ ] Ispezionare il codice sorgente della pagina (View Source) → verificare che non ci sia la service role key
- [ ] Ispezionare le variabili `NEXT_PUBLIC_*` nel bundle JS → verificare che non ci sia la service role key
- [ ] Verificare che le richieste di rete dal browser non contengano la service role key

---

## 12. Agents Page

### 12.1 — Lista agenti

- [ ] Navigare a `/agents`
- [ ] Verificare card per ogni agente: nome, stato (idle/busy/offline/error), VPS info, versioni software
- [ ] Verificare aggiornamento real-time dello stato agente
- [ ] Verificare che un agente assente per > 2 minuti venga marcato `offline`

---

## 13. Settings

### 13.1 — Informazioni workspace

- [ ] Navigare a `/settings`
- [ ] Verificare: nome workspace, slug, data di creazione
- [ ] Verificare che i dati siano letti da Supabase (non hardcoded)

---

## 14. Performance

### 14.1 — Tempi di caricamento (su connessione 4G simulata)

- [ ] Dashboard: first meaningful paint < 1.5s
- [ ] Lista task (20 task): first meaningful paint < 1s
- [ ] Task detail (task + eventi): first meaningful paint < 1.5s

### 14.2 — Loading states

- [ ] Ogni pagina mostra loading state esplicito durante il fetch (skeleton loader o spinner)
- [ ] Nessuna pagina bianca durante il caricamento
- [ ] Le `loading.tsx` di Next.js App Router funzionano correttamente per ogni route

### 14.3 — Real-time latency

- [ ] Inserire un evento su Supabase → verificare che appaia nel gestionale in < 1 secondo

---

## 15. Error Handling

### 15.1 — Errore di rete

- [ ] Disconnettere la rete → verificare indicatore "Realtime offline" nell'header
- [ ] Riconnettere → verificare che il Realtime si riconnetta e gli eventi arrivino
- [ ] Verificare che il feed mostri gli ultimi dati cached durante la disconnessione

### 15.2 — Errori fetch

- [ ] Con errore nel fetch della lista task → verificare messaggio di errore con bottone "Riprova"
- [ ] Con errore nel fetch dei metric tile → verificare tile mostra "—" con "Errore nel caricamento"

### 15.3 — Errore creazione task

- [ ] Tentare di creare una task con errore server → verificare toast di errore
- [ ] Verificare che il form non si resetti (dati preservati)

---

## 16. Data Export (GDPR)

### 16.1 — Export dati workspace

- [ ] Chiamare `GET /api/workspace/export`
- [ ] Verificare che si scarichi un archivio con task, eventi e metriche in JSON
- [ ] Verificare che i dati esportati corrispondano ai dati del workspace

---

## 17. Orchestratore e VPS (Verifiche Infrastrutturali)

Queste verifiche richiedono accesso SSH al VPS.

### 17.1 — Stato servizi

- [ ] `systemctl status robindev-orchestrator` → `active (running)`
- [ ] `redis-cli ping` → `PONG`
- [ ] `journalctl -u robindev-orchestrator -n 20` → nessun errore critico
- [ ] `df -h` → disco non pieno (< 80%)

### 17.2 — Health endpoint

- [ ] `curl localhost:3001/health` → risposta con `status: "ok"`, `redisConnected: true`, `queueCounts`

### 17.3 — Resilienza

- [ ] Killare il processo orchestratore: `kill -9 $(pgrep -f "node dist/index.js")`
- [ ] Attendere ~10 secondi
- [ ] `systemctl status robindev-orchestrator` → deve essere `running` (restart automatico)
- [ ] Verificare che nessun job sia stato perso (controllare BullMQ queue)

### 17.4 — Notifiche

- [ ] Verificare che una task `in_review` generi notifica Slack
- [ ] Verificare che una task `blocked` generi notifica Slack + email
- [ ] Verificare che una task `failed` generi notifica Slack + email
- [ ] Verificare che le notifiche contengano: nome task, workspace, link alla task

---

## Riepilogo esecuzione

```
Data esecuzione:     _______________
Esecutore:           _______________
Ambiente:            [ ] Production  [ ] Staging
Browser:             _______________
Dispositivo mobile:  _______________
VPS testato:         _______________

Totale test: ~150
PASS:  ___
FAIL:  ___
SKIP:  ___

Bug critici trovati:
1. _______________
2. _______________
3. _______________

Bug non-critici trovati:
1. _______________
2. _______________
3. _______________

Note:
_______________
```

---

*Robin.dev · Manual E2E Testing Checklist v1.0 · 2026-02-27*
