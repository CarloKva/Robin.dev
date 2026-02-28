# ADR-11 — VPS Provisioning: Hetzner Cloud API + cloud-init

**Data:** 2026-02-28
**Stato:** Accepted
**Contesto:** Sprint A — VPS provisioning automatico (EPIC-A6)
**Spike:** `docs/spikes/spike-A2-hetzner-api.md`

---

## Contesto

La creazione di un agente deve triggerare automaticamente il provisioning di una VPS Hetzner (già deciso in ADR-09). La domanda è: **come viene eseguito il setup dell'orchestratore sul VPS?**

Due approcci candidati:
- **SSH post-boot**: il provisioning worker fa SSH sul VPS dopo l'avvio e esegue uno script di setup.
- **cloud-init**: lo script di setup viene passato a Hetzner al momento della creazione del VPS e viene eseguito automaticamente al primo boot.

---

## Decisione

**cloud-init via `user_data`, senza SSH post-boot.**

Il provisioning worker invia lo script di setup nel campo `user_data` della chiamata `POST /v1/servers`. Hetzner esegue lo script automaticamente durante il primo avvio. Il worker monitora la prontezza del VPS interrogando il health endpoint dell'orchestratore (`GET http://{vps_ip}:3001/health`), non tramite SSH.

---

## Alternative Analizzate

### Alternativa 1 — SSH post-boot

**Descrizione:** il worker aspetta che il VPS sia `running`, poi apre una connessione SSH ed esegue i comandi di setup in sequenza.

**Pro:**
- Feedback in tempo reale su ogni step (stdout SSH)
- Possibilità di diagnosticare problemi di setup più facilmente
- Nessuna dipendenza da cloud-init (funziona su qualsiasi provider)

**Contro:**
- Richiede un SSH client nel provisioning worker (dipendenza aggiuntiva)
- Complessità: gestione della connessione SSH, timeout, retry su rete intermittente
- Possibili problemi di concorrenza: il VPS può essere `running` ma non ancora pronto per SSH (race condition di 5–10 secondi)
- Setup sequenziale: ogni comando aspetta la risposta prima di procedere — più lento rispetto a cloud-init che esegue tutto in parallelo a livello OS

**Motivo del rifiuto:** complessità non necessaria. cloud-init è la soluzione nativa per questo problema e richiede zero client SSH nel worker.

---

## Conseguenze

### Conseguenze positive

1. **Semplicità del worker.** Il provisioning worker fa una sola chiamata API (`POST /v1/servers`), poi polling. Nessun SSH client, nessuna gestione di connessioni remote.

2. **Atomicità.** Il setup viene eseguito dal VPS su se stesso al boot. Non c'è una connessione di rete intermedia che può cadere nel mezzo del setup.

3. **Riproducibilità.** Lo stesso script `user_data` produce sempre lo stesso VPS, indipendentemente da chi ha avviato il provisioning. È documentazione eseguibile.

4. **Portabilità provider.** cloud-init è supportato da tutti i provider cloud principali (DigitalOcean, AWS EC2, GCP, Vultr, OVH). Se si cambia provider, lo script `user_data` funziona senza modifiche.

5. **SSH disponibile per debug.** Le chiavi SSH vengono comunque registrate su Hetzner e passate alla creazione del VPS. Un operatore può sempre fare SSH per debug — semplicemente non è necessario nel processo automatico.

### Conseguenze negative

1. **Nessun feedback in tempo reale sullo step di setup.** Il worker sa solo "VPS running" e "orchestratore risponde al health check". Non sa se lo script cloud-init è al 30% o al 90%. Mitigato da: il health endpoint risponde solo quando il setup è completato — è il gate finale reale.

2. **Debugging setup problemi richiede SSH.** Se il cloud-init script fallisce, Carlo deve fare SSH e leggere `/var/log/cloud-init-output.log`. Non è automatizzato — ma è un'operazione di debug eccezionale, non parte del flusso normale.

3. **`user_data` non è cifrato su Hetzner.** Le variabili d'ambiente del workspace (incluse chiavi sensibili) vengono passate nel campo `user_data` in chiaro. Questo è accettabile per il pilota dato che l'account Hetzner è controllato da Carlo. In futuro (Sprint D): migrazione a pattern "VPS chiama Robin.dev al boot per scaricare le credenziali" con bootstrap token temporaneo.

---

## Parametri server

Confermati da ADR-09 e Spike A2:

| Parametro | Valore |
|---|---|
| Provider | Hetzner Cloud |
| Server type | `cx22` |
| OS image | `ubuntu-24.04` |
| Datacenter | `fsn1` (Falkenstein) |
| SSH key | Chiave Robin.dev provisioner (registrata una volta) |

---

## Polling strategy per il worker

```
1. POST /v1/servers → salva vps_id + vps_ip → emetti evento provisioning.vps_created

2. GET /v1/servers/{vps_id} ogni 5s (max 5 min)
   → quando status == "running" → emetti evento provisioning.setup_running

3. GET http://{vps_ip}:3001/health ogni 10s (max 5 min)
   → quando risponde 200 → emetti evento provisioning.completed
   → aggiorna agents.provisioning_status = 'online'

Se timeout in step 2: emetti provisioning.failed con motivo "VPS non avviata in 5 minuti"
Se timeout in step 3: emetti provisioning.failed con motivo "Orchestratore non risponde in 5 minuti"
```

**Timeout globale del job:** 15 minuti. Oltre questo limite il job viene terminato da BullMQ e l'agente passa a `provisioning_status = 'error'`.

---

## Idempotenza

Prima di creare un VPS, il worker verifica che il campo `vps_id` sul record agente sia null. Se `vps_id` è già valorizzato (job ri-eseguito dopo crash parziale), il worker salta la creazione e va direttamente al polling.

```
if (agent.vps_id != null) {
  // VPS già creata — vai direttamente al polling health check
  skipToHealthCheck(agent.vps_ip)
} else {
  createVPS() → saveVpsId() → pollStatus() → pollHealth()
}
```

---

## Deprovisioning

```
DELETE /v1/servers/{vps_id}
```

- Se il server esiste: Hetzner lo elimina in pochi secondi.
- Se il server non esiste (`404`): non fallire. Logga "VPS già eliminata" e aggiorna il record.
- Prima della DELETE: segnala all'orchestratore via API interna di fare graceful shutdown (ferma i task in corso con eleganza).

---

## Alternativa provider (fallback)

Se Hetzner API presenta problemi non previsti durante l'implementazione, il fallback immediato è **DigitalOcean Droplets** — stessa architettura cloud-init, API equivalente, costo ~2× ma gestibile per il pilota. La logica del worker cambia solo nella chiamata API specifica (un singolo modulo sostituibile).

---

## Riferimenti

- `docs/spikes/spike-A2-hetzner-api.md` — analisi completa
- `docs/ops/ssh-keys.md` — gestione chiavi SSH
- `docs/flows/agent-provisioning.md` — flusso end-to-end
- ADR-09: Modello di isolamento infrastrutturale (VPS dedicata per cliente)
- [Hetzner Cloud API Reference](https://docs.hetzner.cloud/)
