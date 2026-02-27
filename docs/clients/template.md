# Scheda Cliente — {{CLIENT_NAME}}

> Template: copiare questo file in `docs/clients/<slug>.md` e compilare.
> Nessun dato sensibile in chiaro (no password, no API key, no token).

---

## Identificativi

| Campo | Valore |
|-------|--------|
| Slug | `{{CLIENT_SLUG}}` |
| Nome | {{CLIENT_NAME}} |
| Email referente tecnico | {{CLIENT_EMAIL}} |
| Data provisioning | {{PROVISIONING_DATE}} |

---

## Infrastruttura

| Campo | Valore |
|-------|--------|
| Workspace ID | `{{WORKSPACE_UUID}}` |
| Agent ID | `{{AGENT_UUID}}` |
| Clerk User ID | `{{CLERK_USER_ID}}` |
| VPS IP | `{{VPS_IP}}` |
| VPS Nome | `robin-{{CLIENT_SLUG}}` |
| VPS Regione | Hetzner FSN1 |
| SSH Key fingerprint | `{{SSH_KEY_FINGERPRINT}}` |

---

## Repository

| Campo | Valore |
|-------|--------|
| GitHub Org | `{{GITHUB_ORG}}` |
| GitHub Repo | `{{GITHUB_REPO}}` |
| Branch principale | `main` |
| Deploy Key | `robin-agent-{{CLIENT_SLUG}}@robin.dev` (in GitHub Settings → Deploy keys) |

---

## Stack

```
# Compilare dopo questionario onboarding
Framework:       Next.js 15 / Express / altro
Package manager: npm / pnpm / bun
Test runner:     jest / vitest / playwright
Node version:    22
```

---

## Link operativi

- **Hetzner Console:** https://console.hetzner.cloud → robin-{{CLIENT_SLUG}}
- **Supabase Dashboard:** https://supabase.com/dashboard/project/ccgodxlviculeqsnlgse/editor → filtro workspace_id = {{WORKSPACE_UUID}}
- **Betterstack:** (configurare dopo provisioning)
- **GitHub Deploy Key:** https://github.com/{{GITHUB_ORG}}/{{GITHUB_REPO}}/settings/keys

---

## Storico operativo

```
YYYY-MM-DD — Provisioning completato. Smoke test PASS.
YYYY-MM-DD — Prima task eseguita: [titolo task]
YYYY-MM-DD — [altre operazioni: aggiornamenti, incidenti, etc.]
```

---

## Note tecniche

> Annotare qui qualsiasi particolarità del progetto del cliente che non è
> nel CLAUDE.md:
> - Processi di deployment specifici
> - Integrazioni esterne particolari
> - Limitazioni note dello stack
> - Aree del codebase particolarmente sensibili

---

## Checklist onboarding

- [ ] VPS provisionate con `provision-vps.sh`
- [ ] Workspace creato con `create-workspace.ts`
- [ ] Deploy key aggiunta a GitHub con write access
- [ ] `.env` compilato e `systemctl` service avviato
- [ ] Smoke test PASS
- [ ] Prima task reale eseguita con successo
- [ ] CLAUDE.md committato nel repository del cliente
- [ ] Cliente ha accesso al gestionale Robin.dev
- [ ] Scheda cliente compilata e committata in `docs/clients/`

---

## Offboarding (da compilare se il cliente va via)

```
Data richiesta:
Data esecuzione:
Script: offboard-workspace.ts --workspace-id {{WORKSPACE_UUID}} --slug {{CLIENT_SLUG}}
Log: logs/offboarding-{{CLIENT_SLUG}}-<timestamp>.log
VPS eliminata: [ ] sì / [ ] no
Deploy key revocata: [ ] sì / [ ] no
```
