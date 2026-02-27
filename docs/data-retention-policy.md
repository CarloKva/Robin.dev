# Data Retention Policy — Robin.dev

**Versione:** 1.0
**Data:** 2026-02-27
**Applicabilità:** Tutti i clienti Robin.dev

---

## 1. Dati raccolti

Robin.dev raccoglie e processa i seguenti dati nell'erogazione del servizio:

### Dati di account
- **Identificativo utente Clerk** (`user_xxx`): ID univoco dell'utente autenticato
- **Email**: gestita da Clerk, non memorizzata direttamente in Robin.dev

### Dati del workspace
- **Task**: titolo, descrizione, stato, priorità, tipo, data di creazione
- **Task events**: log di ogni azione dell'agente (ADWP phases, commit, PR)
- **Task artifacts**: URL di PR, commit, deploy preview
- **Agents**: nome, slug, info VPS (IP, regione), versioni software
- **Workspace members**: associazione user_id ↔ workspace

### Dati sul repository del cliente
- L'agente legge e scrive codice nel repository GitHub del cliente
- Robin.dev **non memorizza** copie del codice sorgente del cliente
- L'accesso al repository avviene tramite deploy key dedicata (revocabile)

### Dati di log
- Log di sistema dell'orchestratore (journalctl) — conservati 30 giorni sul VPS
- Log di provisioning/offboarding (`logs/`) — conservati nel repository Robin.dev

---

## 2. Retention durante l'attività

| Tipo di dato | Retention | Note |
|---|---|---|
| Task e eventi | Illimitata durante il contratto | Necessaria per audit trail e metriche |
| Artifacts (URL PR/deploy) | Illimitata durante il contratto | URL esterne, possono diventare non-raggiungibili |
| Log orchestratore | 30 giorni (journalctl rotation) | Su VPS del cliente |
| Agent heartbeat data | 90 giorni | Aggregato, non personale |

---

## 3. Retention post-cancellazione

Al termine del contratto o su richiesta esplicita di cancellazione:

| Tipo di dato | Azione | Tempi |
|---|---|---|
| Tutti i dati Supabase del workspace | Cancellazione immediata via `offboard-workspace.ts` | Entro 24h dalla richiesta |
| VPS del cliente | Eliminazione dal Hetzner Cloud | Entro 24h dalla cancellazione Supabase |
| Deploy key GitHub | Revoca dall'account GitHub del cliente | Entro 24h |
| Log di provisioning/offboarding in `docs/clients/` | Anonimizzazione o rimozione | Entro 30 giorni |
| Log sistemistici su VPS eliminato | Eliminati con la VPS | Automatico |

**Periodo di grazia:** 30 giorni dalla richiesta di cancellazione, durante i quali
i dati sono accessibili per l'export (Art. 20 GDPR — diritto alla portabilità).
Dopo 30 giorni, la cancellazione diventa definitiva e irreversibile.

---

## 4. Accesso ai dati

### Chi ha accesso ai dati del cliente:

| Ruolo | Accesso | Motivo |
|---|---|---|
| Operator Robin.dev (Carlo Ferrero) | Accesso completo via service role key | Operatività del servizio |
| Agente Robin (Claude Code sul VPS) | Accesso in scrittura via service role key | Esecuzione task |
| Cliente (user autenticato) | Accesso ai propri dati via RLS | Gestionale |
| Altri clienti | Nessun accesso | RLS enforced |

### Dati NON accessibili ad altri clienti:

Row Level Security (RLS) di Supabase garantisce che ogni workspace possa accedere
esclusivamente ai propri dati. Verificato con test suite in `docs/security/rls-tests.md`.

---

## 5. Diritti dell'utente (GDPR base)

### Diritto all'accesso e portabilità (Art. 15, 20 GDPR)

Il cliente può esportare tutti i propri dati in formato JSON via:
```
GET /api/workspace/export
```

L'export include: task, eventi, agenti, artefatti.

### Diritto alla cancellazione (Art. 17 GDPR — Right to Erasure)

Il cliente può richiedere la cancellazione completa inviando email all'operator.
L'operator esegue `offboard-workspace.ts` entro 24 ore dalla richiesta.

### Diritto di rettifica (Art. 16 GDPR)

Task e descrizioni possono essere modificate via gestionale (PATCH `/api/tasks/[taskId]`).

### Diritto alla limitazione (Art. 18 GDPR)

In caso di contestazione sui dati, l'operator può sospendere il processing
fermando il servizio sistemd sul VPS del cliente.

---

## 6. Data minimization

Robin.dev raccoglie solo i dati necessari all'erogazione del servizio:
- Non raccoglie dati di navigazione o analytics degli utenti
- Non memorizza credenziali GitHub o Anthropic API key in Supabase
  (solo sul VPS del cliente, con permessi 600)
- Non accede al codice sorgente del cliente al di fuori dell'esecuzione dei task

---

## 7. Sub-processor

| Sub-processor | Paese | Finalità | Privacy Policy |
|---|---|---|---|
| Supabase | USA (AWS EU-West) | Database e autenticazione | https://supabase.com/privacy |
| Anthropic | USA | Esecuzione agente AI | https://www.anthropic.com/privacy |
| Hetzner Cloud | Germania (UE) | Hosting VPS | https://www.hetzner.com/legal/privacy-policy |
| Clerk | USA | Autenticazione utenti | https://clerk.com/privacy |
| Vercel | USA | Hosting frontend | https://vercel.com/legal/privacy-policy |

---

## 8. Aggiornamenti alla policy

Questa policy viene aggiornata in caso di cambiamenti significativi al servizio.
I clienti vengono notificati via email con almeno 30 giorni di anticipo.

---

## Contatti

Per questioni relative alla privacy e ai dati:
- Email: [da compilare — email operator]
- GitHub: [link a GitHub Robin.dev per issue]

---

*Robin.dev · Data Retention Policy v1.0 · 2026-02-27*
