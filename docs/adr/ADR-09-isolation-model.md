# ADR-09 — Modello di Isolamento Infrastrutturale (v1.0)

**Data:** 2026-02-27
**Stato:** Accepted
**Contesto:** Sprint 5 — Trasformazione multi-cliente
**Spike:** `docs/spikes/spike-11-isolation-model.md`

---

## Contesto

Robin.dev scala da progetto personale a servizio multi-cliente. Ogni cliente ha un repository GitHub privato su cui opera l'agente Claude Code. Il sistema deve garantire che il codice, le credenziali e i dati di un cliente non siano accessibili agli altri.

La decisione riguarda l'architettura di hosting dell'orchestratore (processo Node.js + BullMQ + Redis + Claude CLI) per ogni cliente.

---

## Decisione

**Per v1.0: una VPS Hetzner CX22 dedicata per cliente.**

Ogni cliente ottiene un'istanza VPS separata con:
- Node.js orchestratore come systemd service
- Redis locale (bind `127.0.0.1`, non esposto)
- Claude Code CLI installato
- SSH key GitHub dedicata (non condivisa)
- `ANTHROPIC_API_KEY` del cliente in variabili d'ambiente isolate

Il database Supabase rimane condiviso (unico progetto), con isolamento garantito da RLS (`get_my_workspace_ids()`).

---

## Alternative Analizzate

### Alternativa 1 — Worker isolato su VPS condivisa

**Descrizione:** Un singolo VPS multi-processo (PM2), un process per cliente.

**Pro:**
- Costo infrastruttura ridotto (~€8.25/mese per N clienti)
- Singolo punto di deploy per aggiornamenti

**Contro:**
- Rischio "noisy neighbor": un job Claude runaway consuma CPU/RAM per tutti
- `ANTHROPIC_API_KEY` di diversi clienti nello stesso environment host — rischio leakage tramite `/proc/[pid]/environ`
- Log interleaving — debug più complesso
- Richiede user Unix separati per isolamento file system (aggiunge complessità)

**Motivo del rifiuto:** Il rischio di cross-contamination di credenziali su host condiviso è inaccettabile in un servizio professionale multi-cliente.

---

### Alternativa 2 — Container Docker su host condiviso

**Descrizione:** Container per cliente su Docker host (o k8s).

**Pro:**
- Isolamento namespace (filesystem, process, network) senza VM overhead
- Costo intermedio tra Opzione A e B
- Scalabilità più granulare

**Contro:**
- Complessità operativa significativa per un team piccolo in v1.0:
  - Gestione Docker registry
  - Networking (bridge, overlay)
  - Volume management per repository clonati
  - Potenziale k8s per orchestrazione container
- "Noisy neighbor" possibile senza resource limits espliciti per container
- Debugging richiede familiarità con Docker tooling

**Motivo del rifiuto:** Overhead operativo non giustificato con ≤10 clienti in v1.0. La complessità di Docker offre vantaggi (densità, deploy atomico) che diventano rilevanti oltre i 25 clienti.

---

## Conseguenze

### Conseguenze positive

1. **Isolamento totale delle credenziali.** Ogni VPS ha il proprio `ANTHROPIC_API_KEY`, SSH key GitHub, e variabili d'ambiente. Non c'è percorso fisico tra i clienti.

2. **Debug deterministico.** Problema del cliente A → SSH su VPS A → log VPS A. Zero ambiguità.

3. **Scalabilità verticale indipendente.** Se il cliente A fa 100 task/mese, si fa upgrade della sua VPS a CX32 senza impattare gli altri.

4. **Provisioning automatizzabile.** EPIC-30 (FASE B) produce uno script che in < 30 minuti porta una VPS a zero a fully operational. Riproducibile su tutte le VPS.

5. **Rollback per cliente.** Se un aggiornamento del runner causa problemi per il cliente A, si fa rollback sulla VPS A senza impattare B.

### Conseguenze negative

1. **Deploy aggiornamenti = N operazioni.** Con 10 clienti, propagare un bugfix richiede 10 SSH + pull + restart. Mitigato da script Ansible/bash (EPIC-30), ma rimane overhead rispetto a un deploy singolo.

2. **Monitoring distribuito.** Con 10 VPS, il monitoring richiede un sistema centralizzato (Prometheus + Grafana o simile). Per v1.0 si accetta monitoring semplificato (log via SSH, alerting via Supabase).

3. **Costo non ottimale a scala.** Con 100 clienti, 100 × €3.98 = €398/mese di sola infrastruttura. Threshold di rivalutazione: **25 clienti** → passaggio a Docker (Opzione C).

### Parametri di successo

- Provisioning completo (VPS → fully operational) in < 2 ore
- Nessun incident di cross-client data access
- Uptime orchestratore > 99% per cliente

---

## Costo Mensile per Cliente (v1.0)

| Voce                   | Costo mensile | Note |
|------------------------|---------------|------|
| VPS CX22 Hetzner       | €3.98         | AMD, FSN1 datacenter |
| Backup VPS (opzionale) | ~€0.80        | +20% del costo VPS |
| Claude API             | ~€10–100      | Dipende dall'utilizzo |
| GitHub (repository)    | Incluso piano | Piano cliente |
| Supabase               | Condiviso     | Un progetto Robin.dev |
| **Totale infra fissa**     | **€3.98–4.78** | Escludendo Claude API |

---

## Piano di Rivalutazione

Quando **≥25 clienti attivi**: valutare migrazione a Docker (Alternativa 2) con:
- Ansible per provisioning container
- Registry privato per immagini orchestratore
- Resource limits per container (CPU/RAM)
- Centralizzazione monitoring

La migrazione non richiede cambiamenti all'architettura applicativa (solo cambio layer hosting).

---

## Riferimenti

- `docs/spikes/spike-11-isolation-model.md` — analisi completa
- `docs/runbook/provisioning.md` — checklist operativa
- ADR-02: Monorepo senza Turborepo
- ADR-03: CI/CD GitHub Actions + Vercel
