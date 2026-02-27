# Spike-11 — Modello di Isolamento Infrastrutturale

**Sprint:** 5
**Stato:** Completato
**Data:** 2026-02-27
**Autore:** Robin.dev Team
**Decisione derivata:** ADR-09

---

## Obiettivo

Definire il modello di isolamento per eseguire l'orchestratore Robin.dev in ambiente multi-cliente, valutando tre architetture candidate con criteri di sicurezza, costo operativo e semplicità.

---

## Architetture Candidate

### Opzione A — VPS dedicata per cliente

Ogni cliente ottiene una VPS Hetzner CX22 dedicata con l'orchestratore installato. Il processo Node.js gira come systemd service, ha accesso diretto al repository del cliente tramite SSH key dedicata.

```
Cliente A              Cliente B
┌──────────────┐       ┌──────────────┐
│  VPS CX22    │       │  VPS CX22    │
│  Node.js     │       │  Node.js     │
│  BullMQ      │       │  BullMQ      │
│  Redis       │       │  Redis       │
│  Claude CLI  │       │  Claude CLI  │
└──────┬───────┘       └──────┬───────┘
       │                      │
       ▼                      ▼
  GitHub Repo A          GitHub Repo B
  (SSH key A)            (SSH key B)
       │                      │
       └──────────┬───────────┘
                  ▼
         Supabase Shared
         (RLS enforcement)
```

**Variante v1.0:** Redis locale sul VPS (non condiviso).

### Opzione B — Worker isolato su VPS condivisa

Un singolo VPS multi-processo. Un processo manager (PM2 o systemd) avvia N worker Node.js, uno per cliente. I processi condividono l'host OS ma sono separati a livello di processo e filesystem.

```
┌──────────────────────────────────┐
│  VPS Condivisa (CX32/CX42)       │
│  ┌────────────┐  ┌─────────────┐ │
│  │ Worker A   │  │ Worker B    │ │
│  │ Port 3001  │  │ Port 3002   │ │
│  │ /app/a/    │  │ /app/b/     │ │
│  └────────────┘  └─────────────┘ │
│  ┌──────────────────────────────┐ │
│  │ Redis condiviso              │ │
│  └──────────────────────────────┘ │
└──────────────────────────────────┘
```

### Opzione C — Container Docker per cliente

Ogni cliente ha un container Docker con l'orchestratore. I container girano su un host condiviso (o k8s). Volume separati per ogni cliente, network isolati.

```
Docker Host (o k8s cluster)
┌─────────────────────────────────┐
│  ┌──────────────┐               │
│  │ container_a  │  network_a    │
│  │ Node.js      │               │
│  └──────────────┘               │
│  ┌──────────────┐               │
│  │ container_b  │  network_b    │
│  │ Node.js      │               │
│  └──────────────┘               │
│  ┌──────────────────────────────┐│
│  │ Redis (1 DB per cliente)     ││
│  └──────────────────────────────┘│
└─────────────────────────────────┘
```

---

## Analisi dei Costi (Hetzner Cloud, datacenter EU — 2026)

### Server reference

| Tipo  | vCPU | RAM  | SSD   | €/mese |
|-------|------|------|-------|--------|
| CX22  | 2    | 4 GB | 40 GB | €3.98  |
| CX32  | 4    | 8 GB | 80 GB | €8.25  |
| CX42  | 8    | 16 GB| 160 GB| €18.57 |

### Scenario 1 — Utilizzo Leggero (5–15 task/mese, ~2h lavoro/task)

| Voce                  | Opzione A (VPS ded.) | Opzione B (Worker) | Opzione C (Docker) |
|-----------------------|---------------------|--------------------|-------------------|
| Infrastruttura        | €3.98/cliente       | €8.25 ÷ N clienti  | €8.25 ÷ N clienti |
| Redis                 | incluso (locale)    | €0 (condiviso)     | €0 (condiviso)    |
| Claude API (est.)     | ~€8–15/mese         | ~€8–15/mese        | ~€8–15/mese       |
| Operativo (stima ore) | 30 min/onboarding   | 45 min/onboarding  | 90 min/onboarding |
| **Totale infra/cliente** | **€3.98**        | **€1–4 (dep. N)**  | **€1–4 (dep. N)** |

Con ≤5 clienti: Opzione A è competitiva o superiore (no overhead gestione).

### Scenario 2 — Utilizzo Standard (20–50 task/mese, ~2h lavoro/task)

| Voce                  | Opzione A (VPS ded.) | Opzione B (Worker) | Opzione C (Docker) |
|-----------------------|---------------------|--------------------|-------------------|
| Infrastruttura        | €3.98/cliente       | €18.57 ÷ N (CX42)  | €18.57 ÷ N        |
| Claude API (est.)     | ~€40–80/mese        | ~€40–80/mese       | ~€40–80/mese      |
| **Totale infra/cliente** | **€3.98**        | **€2–4 (dep. N)**  | **€2–4 (dep. N)** |

A standard load, un CX22 per cliente è sufficiente (orchestratore è I/O-bound, non CPU-bound).

### Scenario 3 — Utilizzo Intensivo (100+ task/mese)

| Voce                  | Opzione A (VPS ded.) | Opzione B (Worker) | Opzione C (Docker) |
|-----------------------|---------------------|--------------------|-------------------|
| Infrastruttura        | €3.98–8.25/cliente  | €18.57+ ÷ N        | €18.57+ ÷ N       |
| Upgrade necessario    | CX32 se saturazione | CX42/CX52          | Più host/nodi      |
| Claude API (est.)     | ~€150–300/mese      | ~€150–300/mese     | ~€150–300/mese    |
| **Totale infra/cliente** | **€4–8**         | **€2–5 (dep. N)**  | **€3–7 (dep. N)** |

---

## Complessità Operativa con 10 Clienti

### Opzione A — 10 × VPS dedicate

| Operazione            | Effort    | Automazione possibile |
|-----------------------|-----------|-----------------------|
| Provisioning cliente  | ~30 min   | Script Ansible/bash (EPIC-30) |
| Deploy aggiornamento  | ~5 min × 10 = 50 min | Rolling update script |
| Debug problema cliente| Bassa (SSH diretto) | — |
| Monitoring            | 10 dashboard separate | Centralizzabile con Prometheus |
| Incident isolation    | Perfetta (VPS separati) | — |
| SSH key rotation      | 10 operazioni indip. | Script automatizzabile |
| Costo totale (solo infra) | ~€39.80/mese | — |

**Problemi attesi:** deploy aggiornamenti richiede propagazione manuale a 10 VPS → mitigabile con script.

### Opzione B — Worker su VPS condivisa

| Operazione            | Effort    | Rischio |
|-----------------------|-----------|-|
| Provisioning cliente  | ~10 min   | Basso (script PM2) |
| Deploy aggiornamento  | ~5 min (unico) | Alto (aggiorna tutti i clienti simultaneamente) |
| Debug problema cliente| Media (log interleaving) | Medio |
| Incident isolation    | Scarsa (un cliente può saturare CPU/RAM) | Alto |
| "Noisy neighbor"      | Problema reale | Alto |

**Problema critico:** un job Claude che va in loop (consume CPU/RAM) impatta tutti gli altri clienti sullo stesso host.

### Opzione C — Docker su host condiviso

| Operazione            | Effort    | Rischio |
|-----------------------|-----------|-|
| Provisioning cliente  | ~45 min   | Medio (Dockerfile + compose) |
| Deploy aggiornamento  | ~10 min   | Medio (rolling restart container) |
| Resource limits       | Configurabile (CPU/RAM per container) | Basso |
| Complessità setup     | Alta (Docker, networking, volumes) | Medio |
| Overhead per Robin.dev| Significativo in v1.0 | Alto |

Docker risolve il problema "noisy neighbor" ma introduce complessità operativa non giustificata per ≤10 clienti.

---

## Analisi Sicurezza

### Superficie di attacco per opzione

| Vettore di attacco         | Opzione A | Opzione B | Opzione C |
|----------------------------|-----------|-----------|-----------|
| Cross-client process access| Impossibile | Possibile (stesso OS) | Difficile (namespace) |
| SSH key leakage             | Isolata   | Condivisa (rischio) | Isolata per container |
| Env vars cliente            | Isolate   | Condivise (rischio) | Isolate |
| Repository access          | Isolato   | Possibile path traversal | Isolato per volume |
| Redis cross-client         | Impossibile | Possibile senza ACL | Possibile senza ACL |
| ANTHROPIC_API_KEY leakage  | Isolata   | Condivisa (rischio) | Isolata |

**Nota critica su Opzione B:** il `ANTHROPIC_API_KEY` del cliente A potrebbe essere letto da un processo del cliente B tramite `/proc/[pid]/environ` se i processi girano come lo stesso user Unix. Richiederebbe user separati (aggiunge complessità).

---

## Raccomandazione: VPS Dedicata CX22 Hetzner (v1.0)

**Scelta:** Opzione A — una VPS CX22 Hetzner per cliente.

### Motivazioni

1. **Isolamento completo a costo minimo.** €3.98/mese è trascurabile rispetto al valore del servizio. Ogni cliente ha il proprio processo, filesystem, variabili d'ambiente, e Redis locale. Nessun rischio di cross-contamination.

2. **Semplicità operativa in v1.0.** Con ≤10 clienti, 10 VPS indipendenti sono perfettamente gestibili. Un script di provisioning (EPIC-30) automatizza l'intera procedura. Non serve orchestrazione container, k8s, PM2 multi-process.

3. **Debug deterministico.** Se il cliente A ha un problema, si fa SSH sulla VPS A, si leggono i log della VPS A. Nessun log interleaving, nessun shared state.

4. **Scalabilità verticale per cliente indipendente.** Se il cliente A richiede più potenza, si fa resize del suo VPS senza impattare gli altri.

5. **Security-by-default.** `ANTHROPIC_API_KEY`, SSH keys GitHub, variabili Supabase sono fisicamente separate.

### Limitazioni accettate in v1.0

- **Deploy aggiornamenti = N operazioni.** Con 10 clienti sono 10 SSH + pull + restart. Mitigato da script Ansible/bash (EPIC-30). Con 50+ clienti si rivaluterà Docker o k8s.
- **Costo non ottimale a scala.** Con 100 clienti, Opzione C diventa più economica. Threshold stimato: ~25-30 clienti.
- **Monitoring centralizzato da costruire.** Ogni VPS ha i propri log. Prometheus + Grafana centralizzato è un'aggiunta futura (EPIC-31 o Sprint 6).

### Rivalutazione prevista

Quando il numero di clienti supera i **25**, riesaminare Docker (Opzione C) con Ansible-based provisioning. La migrazione da VPS dedicate a Docker è fattibile senza cambiare l'architettura applicativa (solo cambia il layer di hosting).

---

## Specifiche tecniche VPS raccomandata

```
Provider:    Hetzner Cloud
Tipo:        CX22 (AMD)
vCPU:        2
RAM:         4 GB
Storage:     40 GB NVMe SSD
Rete:        20 TB inclusi
OS:          Ubuntu 24.04 LTS
Costo:       €3.98/mese (datacenter FSN1, Falkenstein)
Backup:      +20% del prezzo server = ~€0.80/mese (opzionale)
```

**Software stack per VPS:**
- Node.js 22 LTS
- Redis 7 (locale, porta 6379, bind 127.0.0.1)
- Claude Code CLI (ultima versione)
- Git 2.x
- systemd service per l'orchestratore

---

## Riferimenti

- [Hetzner Cloud Pricing](https://www.hetzner.com/cloud)
- ADR-09: `docs/adr/ADR-09-isolation-model.md`
- EPIC-30: Script di provisioning (FASE B)
