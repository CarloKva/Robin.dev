# Gestione Chiavi SSH — Robin.dev Provisioner

**Sprint:** A
**Data:** 2026-02-28
**Autore:** Carlo Ferrero
**Riferimento:** STORY-A.14 (EPIC-A6), ADR-11

---

## Scopo

Documentare come vengono gestite le chiavi SSH usate dal sistema di provisioning automatico delle VPS agente. Definire dove vivono le chiavi, come vengono distribuite, e le procedure operative per rotazione e debug.

---

## Contesto

Robin.dev usa cloud-init per il setup automatico delle VPS (ADR-11). Nonostante cloud-init elimini la necessità di SSH nel flusso automatico, le chiavi SSH restano necessarie per:

1. **Debug manuale** di problemi di provisioning (es. cloud-init fallisce → Carlo fa SSH)
2. **Aggiornamenti dell'orchestratore** senza ricreare il VPS
3. **Accesso di emergenza** se l'orchestratore non risponde

---

## Architettura delle chiavi

Robin.dev usa **una sola coppia di chiavi SSH** per il provisioner. Non esistono chiavi per-cliente: ogni VPS agente viene creata con la stessa chiave pubblica di Robin.dev.

```
Robin.dev Provisioner
┌────────────────────────────────┐
│ Chiave privata                 │
│ (env var: ROBIN_SSH_PRIVATE_KEY_B64) │
│                                │
│ Chiave pubblica                │
│ (registrata su Hetzner)        │
│ (HETZNER_SSH_KEY_ID = 9876543) │
└────────────────────────────────┘
        │
        ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ VPS A    │  │ VPS B    │  │ VPS C    │
│ ~/.ssh/  │  │ ~/.ssh/  │  │ ~/.ssh/  │
│ authorized│  │ authorized│  │ authorized│
│ _keys    │  │ _keys    │  │ _keys    │
└──────────┘  └──────────┘  └──────────┘
```

Le VPS non hanno chiavi SSH per-cliente: la chiave del provisioner Robin.dev è l'unica chiave autorizzata su ogni VPS.

---

## Generazione della chiave (fatto una sola volta da Carlo)

```bash
# Genera coppia Ed25519 (algoritmo moderno, sicuro, chiavi compatte)
ssh-keygen -t ed25519 -C "robin-dev-provisioner@2026" -f ~/.ssh/robin_provisioner -N ""

# Output:
# ~/.ssh/robin_provisioner       ← chiave privata (TENERLA SEGRETA)
# ~/.ssh/robin_provisioner.pub   ← chiave pubblica (può essere pubblica)
```

**Non aggiungere passphrase** (`-N ""`): il worker di provisioning non può interagire con un prompt di passphrase.

---

## Registrazione su Hetzner (fatto una sola volta da Carlo)

```bash
# Legge la chiave pubblica e la registra su Hetzner
curl -X POST https://api.hetzner.cloud/v1/ssh_keys \
  -H "Authorization: Bearer $HETZNER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"robin-dev-provisioner\",
    \"public_key\": \"$(cat ~/.ssh/robin_provisioner.pub)\"
  }"

# Risposta contiene:
# { "ssh_key": { "id": 9876543, "name": "robin-dev-provisioner", ... } }

# Salva l'ID restituito come env var HETZNER_SSH_KEY_ID=9876543
```

Questo ID viene passato nel campo `ssh_keys` di ogni chiamata di creazione VPS.

---

## Storage della chiave privata

### Regola fondamentale

**La chiave privata non entra mai in git.** Mai. Nemmeno per sbaglio.

```
# .gitignore — verificare che sia presente
*.pem
id_rsa
id_ed25519
robin_provisioner
*.key
```

### Dove vive la chiave privata

| Ambiente | Storage | Formato |
|---|---|---|
| Produzione (Vercel/backend) | Variabile d'ambiente `ROBIN_SSH_PRIVATE_KEY_B64` | Chiave privata PEM codificata in base64 |
| Orchestratore (apps/orchestrator) | Variabile d'ambiente `ROBIN_SSH_PRIVATE_KEY_B64` | Stesso formato |
| `.env.example` | Placeholder `ROBIN_SSH_PRIVATE_KEY_B64=<base64-encoded-private-key>` | Solo placeholder |
| Backup personale Carlo | Password manager (1Password, Bitwarden) | File `.pem` allegato |

### Conversione in base64 per le env vars

```bash
# Codifica la chiave privata in base64 (una riga singola)
base64 -i ~/.ssh/robin_provisioner | tr -d '\n'
# → output da incollare come valore di ROBIN_SSH_PRIVATE_KEY_B64
```

### Uso nel worker di provisioning

```typescript
// Il worker decodifica la chiave dall'env var prima di usarla
const privateKeyB64 = process.env.ROBIN_SSH_PRIVATE_KEY_B64
if (!privateKeyB64) throw new Error('ROBIN_SSH_PRIVATE_KEY_B64 non configurata')

const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf-8')
// → usata per connessioni SSH di debug (non nel flusso automatico cloud-init)
```

---

## Variabili d'ambiente richieste

Queste variabili devono essere configurate prima di iniziare l'implementazione:

| Variabile | Descrizione | Chi la usa |
|---|---|---|
| `HETZNER_API_TOKEN` | API token Hetzner (Read/Write) | Backend (Route Handlers), BullMQ Worker |
| `HETZNER_SSH_KEY_ID` | ID numerico della chiave SSH registrata su Hetzner | BullMQ Worker (provisioning job) |
| `ROBIN_SSH_PRIVATE_KEY_B64` | Chiave privata SSH in base64 | BullMQ Worker (per debug SSH — non nel flusso cloud-init) |

Aggiungere queste variabili a `.env.example` con placeholder.

---

## Connessione SSH di debug (uso operativo)

Quando un VPS agente non risponde e si deve diagnosticare manualmente:

```bash
# Decodifica la chiave privata dall'env var (o dal backup)
echo "$ROBIN_SSH_PRIVATE_KEY_B64" | base64 -d > /tmp/robin_key
chmod 600 /tmp/robin_key

# Connessione SSH al VPS
ssh -i /tmp/robin_key root@{vps_ip}

# Controlla il log cloud-init
cat /var/log/cloud-init-output.log

# Controlla lo stato del service orchestratore
systemctl status robin-orchestrator
journalctl -u robin-orchestrator -n 100

# Pulisce la chiave temporanea
rm /tmp/robin_key
```

---

## Rotazione della chiave (procedura)

La rotazione della chiave SSH è un'operazione manuale eccezionale (es. dopo una breach, o periodicità annuale). Non è automatizzata in v1.0.

**Procedura:**

1. Genera una nuova coppia Ed25519 (`ssh-keygen -t ed25519 -f robin_provisioner_new`)
2. Registra la nuova chiave pubblica su Hetzner → ottieni nuovo `HETZNER_SSH_KEY_ID`
3. Per ogni VPS agente attiva: aggiungi la nuova chiave pubblica in `/root/.ssh/authorized_keys` via SSH (usando la vecchia chiave)
4. Aggiorna le env vars in Vercel/backend: `ROBIN_SSH_PRIVATE_KEY_B64` e `HETZNER_SSH_KEY_ID`
5. Verifica accesso SSH con la nuova chiave su almeno una VPS
6. Rimuovi la vecchia chiave pubblica da Hetzner (`DELETE /v1/ssh_keys/{old_id}`)
7. Rimuovi la vecchia chiave da `/root/.ssh/authorized_keys` su ogni VPS

---

## Sicurezza: superficie di rischio

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Chiave privata committata in git | Bassa | `.gitignore` + GitHub secret scanning attivo |
| Env var esposta in log | Bassa | Non loggare mai le env vars. BullMQ job log non include env. |
| VPS compromessa → accesso ad altre VPS | Bassa | La chiave privata vive solo nel backend — un attaccante sulla VPS non ha la chiave privata. Non c'è SSH tra VPS. |
| Hetzner account compromesso | Molto bassa | 2FA obbligatorio sull'account Hetzner di Carlo. Chiave SSH registrata è solo la pubblica. |

---

## Checklist pre-implementazione

Prima di iniziare l'implementazione di EPIC-A6:

- [ ] Coppia Ed25519 generata (`~/.ssh/robin_provisioner`)
- [ ] Chiave pubblica registrata su Hetzner → `HETZNER_SSH_KEY_ID` ottenuto
- [ ] Chiave privata codificata in base64 → `ROBIN_SSH_PRIVATE_KEY_B64` salvata in:
  - [ ] Password manager (backup)
  - [ ] Vercel env vars (produzione backend)
  - [ ] `.env.local` orchestratore (locale per sviluppo)
- [ ] `.env.example` aggiornato con placeholder per `HETZNER_SSH_KEY_ID` e `ROBIN_SSH_PRIVATE_KEY_B64`
- [ ] Test manuale: SSH su una VPS Hetzner esistente con la nuova chiave

---

## Riferimenti

- ADR-11: `docs/adr/ADR-11-hetzner-provisioning.md`
- `docs/flows/agent-provisioning.md`
- STORY-A.14 (Sprint A Backlog): definizione strategia SSH
