# Robin.dev — Documento di Visione Prodotto
**Versione 3.0 · Carlo Ferrero · Febbraio 2026**

---

## 1. Il problema che stiamo risolvendo

Ogni team tecnico con 2–5 sviluppatori ha lo stesso problema: il backlog cresce più veloce di quanto il team riesca a smaltirlo. Non perché manchino le competenze — ma perché le priorità urgenti consumano tutto il tempo dei dev senior.

Il risultato è un backlog di serie B che non viene mai toccato: fix di frontend e accessibilità, refactoring e pulizia del codice, funzionalità database e sicurezza, task ben definite ma non abbastanza prioritarie per scalare la coda.

Questi task hanno una caratteristica comune: sono ben delimitati, hanno contesto chiaro nella codebase, e l'output è verificabile tramite PR. Sono esattamente il tipo di lavoro che un developer junior eseguirebbe — se il team ne avesse uno disponibile.

> **Il vero pain point**
> Il problema non è la mancanza di un developer. È la mancanza di un sistema che permetta ai dev senior di delegare in modo strutturato, senza l'overhead di gestire una persona. Oggi delegare a un junior richiede: spiegare il contesto, fare onboarding, revieware, gestire il feedback loop. Con Robin questo overhead scompare.

---

## 2. Target e positioning

### 2.1 Il cliente target

Robin.dev è costruito per un profilo specifico: il founder tecnico o CTO di una startup early-stage con un team di 2–5 developer.

| Attributo | Descrizione |
|---|---|
| Ruolo | Founder tecnico, CTO, Head of Engineering |
| Team size | 2–5 developer, nessun junior dedicato |
| Backlog tool | Linear o Jira, gestione formale del backlog |
| Relazione con AI | Già usa Cursor, Claude Code o Copilot — soddisfatto dei risultati, vuole scalarne l'utilizzo |
| Pain point principale | Task di serie B che rimangono in backlog settimane senza essere toccate |
| Obiettivo | Moltiplicare la capacità del team senza assumere |

### 2.2 Positioning

> **Come posizionare Robin.dev**
> Robin.dev non è uno strumento per developer. È un sistema di delegazione asincrona per team tecnici. Il founder non interagisce con l'agente in tempo reale — lo dirige a livello di prodotto. Scrive le task in backlog, avvia lo sprint, e riceve PR pronte per la review.

La distinzione rispetto a Claude Code o Cursor è fondamentale:

| Prodotto | Modello |
|---|---|
| Claude Code / Cursor | Strumento per il developer che sta lavorando ora, in sessione interattiva |
| Robin.dev | Sistema che lavora in autonomia mentre il team fa altro, dirigibile a livello di backlog e sprint |

### 2.3 Proposta di valore

Robin.dev offre al founder tecnico un team agile di agenti che lavorano in modo asincrono sul backlog di prodotto:

- Crea task nel backlog anche a distanza di giorni, affinandole nel tempo
- Organizza le task in sprint e avvia l'esecuzione con un click
- Gli agenti prendono in carico le task in sequenza e tornano con PR
- Il founder può revieware, lasciare commenti e triggerare rework senza perdere contesto
- Tutto è tracciabile: ogni azione dell'agente è visibile nella dashboard

---

## 3. Visione prodotto

### 3.1 Il flusso ideale dell'utente

Questo è il flusso che Robin.dev deve rendere possibile, end-to-end, senza frizione:

| Step | Nome | Descrizione |
|---|---|---|
| 1 | Setup iniziale | Il founder crea un workspace, connette il proprio account GitHub (OAuth), e seleziona le repository su cui gli agenti potranno lavorare — esattamente come su Vercel. |
| 2 | Creazione agente | Dalla dashboard, il founder crea un agente e lo associa a una o più repository. Il provisioning della VPS avviene in automatico. |
| 3 | Backlog management | Il founder crea task nel backlog con descrizione, tipo e repository target. Può creare 50 task oggi e affinare quelle meno urgenti nei giorni successivi. |
| 4 | Sprint planning | Quando le task sono pronte, il founder le sposta in sprint. Al click su "Avvia Sprint", gli agenti assegnati iniziano a prendere in carico le task in sequenza. |
| 5 | Esecuzione asincrona | Gli agenti lavorano in background. La dashboard mostra lo stato in real-time. Il founder riceve una notifica quando una PR è pronta. |
| 6 | Review e rework | Il founder recensisce la PR su GitHub. Se lascia commenti, Robin triggerà automaticamente un rework con il contesto originale preservato. In alternativa può iterare direttamente dalla dashboard. |
| 7 | Merge e chiusura | Una volta soddisfatto, fa merge. La task si chiude automaticamente. Il ciclo ricomincia. |

### 3.2 Gestione multi-repository

Un founder può avere più repository e più agenti. Il modello è:

- Un agente può essere associato a più repository
- Più agenti possono lavorare sulla stessa repository
- Quando più agenti sono assegnati alla stessa repo, le task vengono eseguite in sequenza (queue per repo) — questo garantisce consistenza del codice ed elimina i merge conflict
- Dalla task creation form, il founder specifica su quale repository l'agente deve lavorare

### 3.3 Rework e iterazione

Il rework è un flusso di prima classe, non un workaround. Ci sono due modalità:

> **Modalità 1 — GitHub-triggered**
> Il founder lascia commenti sulla PR. Robin intercetta i commenti via webhook GitHub, apre una sessione di rework con il contesto originale della task preservato, e produce una nuova versione della PR.

> **Modalità 2 — Dashboard-driven**
> Il founder entra nella task dalla dashboard, vede l'intera storia della task (eventi, PR, contesto), e avvia manualmente una sessione di rework con istruzioni aggiuntive. Il contesto dell'implementazione originale è sempre disponibile.

### 3.4 Task quality layer

La qualità dell'output dell'agente dipende dalla qualità della task description. Robin deve aiutare il founder a scrivere task buone:

- Template strutturati per tipo di task (bug fix, refactoring, nuova feature, accessibilità, sicurezza)
- Validazione guidata: la form suggerisce cosa aggiungere se la descrizione è troppo vaga
- Opzionale in futuro: AI pre-processing che affina la descrizione prima di inviarla all'agente

---

## 4. Gap architetturali rispetto alla visione

La roadmap v2.0 ha costruito solide fondamenta tecniche. Tuttavia la visione prodotto aggiornata richiede componenti non ancora presenti o pianificati:

| Gap | Priorità | Descrizione |
|---|---|---|
| GitHub OAuth integration | Alta | Il founder deve poter connettere il proprio GitHub account e selezionare le repo dalla dashboard. Oggi il setup è manuale. |
| Provisioning automatico VPS | Alta | La creazione di un agente deve triggerare automaticamente il provisioning della VPS. Oggi è un processo manuale. |
| Backlog management | Alta | Il founder deve poter creare, affinare e organizzare centinaia di task in backlog. Questa vista non esiste. |
| Sprint management | Alta | Il founder deve poter creare sprint, assegnare task, e avviare l'esecuzione con un click. Non esiste. |
| Multi-repo per agente | Alta | Un agente deve poter essere associato a più repo. Oggi è hardcoded a una sola repo clonata manualmente. |
| Queue per repo | Media | Quando più agenti lavorano sulla stessa repo, le task devono essere eseguite in sequenza. Non implementato. |
| Rework flow | Media | Il rework deve essere un flusso di prima classe con contesto preservato, sia da GitHub che dalla dashboard. Oggi richiede di ricreare la task. |
| Task context preservation | Media | Il contesto di una task (storia completa, file toccati, decisioni prese) deve essere accessibile per rework futuri. |
| Task quality templates | Bassa | Template strutturati per tipo di task e validazione guidata. Differenziante ma non bloccante. |
| Dashboard multi-agente | Bassa | La dashboard deve mostrare quali agenti sono attivi e su quale repo stanno lavorando. Oggi non è chiaro. |

---

## 5. Principi prodotto aggiornati

Questi principi guidano ogni decisione sul prodotto. Integrano e in alcuni casi sostituiscono quelli della roadmap v2.0.

**Asincrono by design.** Il founder non interagisce con l'agente in tempo reale. Dirige a livello di backlog e sprint, riceve PR. Il prodotto deve essere ottimizzato per questo pattern, non per la sessione interattiva.

**Context is king.** Il contesto di ogni task è un asset. Va preservato, accessibile, e riutilizzabile per il rework. Non è un log — è la memoria dell'agente.

**Setup senza attrito.** Onboardare un nuovo cliente deve essere completabile in autonomia in meno di 15 minuti. Se richiede intervento manuale di Carlo, non è production-ready.

**Consistenza sopra il parallelismo.** Quando più agenti lavorano sulla stessa repo, la sequenzialità è una scelta di design, non una limitazione. Garantisce un codice pulito e PR senza conflitti.

**Tracciabilità come valore.** Il founder deve poter rispondere alla domanda "cosa ha fatto l'agente ieri?" in 10 secondi. L'osservabilità non è un tool interno — è una feature del prodotto.

---

## 6. Metriche di successo (pilot)

Al termine del periodo pilota con i primi 3 clienti, il successo si misura su:

| Metrica | Target pilot |
|---|---|
| Onboarding time | < 15 minuti dalla registrazione al primo task avviato, in autonomia |
| Task completion rate | > 70% dei task completati senza escalation al founder |
| PR approval rate | > 60% delle PR approvate e mergate senza rework |
| Rework cycle time | < 30 minuti dal commento GitHub alla nuova versione della PR |
| Backlog throughput | Il founder smaltisce almeno 5 task/settimana che prima non toccava |
| NPS pilot | > 8/10 alla fine del primo mese |

---

## 7. Implicazioni sulla roadmap

Gli sprint 4 e 5 della roadmap v2.0 vanno rivisti alla luce di questa visione. I nuovi sprint devono coprire i gap identificati nella sezione 4, con questa prioritizzazione:

| Sprint | Focus | Obiettivo |
|---|---|---|
| Sprint A | GitHub OAuth + Agent Setup da dashboard | Il founder può creare agenti, connetterli a repo reali, senza intervento manuale. È il prerequisito per tutto il resto. |
| Sprint B | Backlog + Sprint Management | Il founder può gestire centinaia di task, organizzarle in sprint, e avviare l'esecuzione. È il cuore del value proposition. |
| Sprint C | Rework flow + Context preservation | Il rework è un flusso di prima classe. GitHub webhook + dashboard-driven iteration con contesto preservato. |
| Sprint D | Multi-tenancy production + Provisioning automatico | Ogni cliente ha il proprio workspace e VPS provisionate in automatico. Onboarding in < 15 minuti. |

> **Nota**
> Questo documento è la bussola. Il dettaglio di ogni sprint (Epic → Story → Task → Spike, criteri di accettazione, stime) verrà scritto separatamente, partendo da Sprint A. Non si detaglia uno sprint successivo prima di aver iniziato l'implementazione del precedente.

---

*Robin.dev · Visione Prodotto v3.0 · Carlo Ferrero · Febbraio 2026*
