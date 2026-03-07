# Task: [F2-1] Aggiungere colonna "mcp_config" JSONB alla tabella workspaces

**Type:** chore
**Priority:** high
**Task ID:** 204c7b69-2e50-4343-92c7-2f736126a5df

## Description

## Obiettivo
Aggiungere alla tabella `workspaces` una colonna `mcp_config` JSONB per salvare la configurazione degli MCP server del workspace.

## Comportamento atteso
- Creare una migration SQL:
  ```sql
  ALTER TABLE workspaces
  ADD COLUMN mcp_config JSONB DEFAULT NULL;
  ```
- Il formato della colonna segue lo schema di `.mcp.json` di Claude Code:
  ```json
  {
    "mcpServers": {
      "supabase": {
        "type": "http",
        "url": "https://...",
        "headers": {
          "Authorization": "Bearer ..."
        }
      },
      "playwright": {
        "type": "stdio",
        "command": "npx",
        "args": ["@playwright/mcp"]
      }
    }
  }
  ```
- Il campo è opzionale (`DEFAULT NULL`): se non configurato, nessun MCP viene passato all'agente.
- Aggiungere un check constraint che validi la struttura minima (presenza della chiave `mcpServers`):
  ```sql
  ALTER TABLE workspaces
  ADD CONSTRAINT valid_mcp_config CHECK (
    mcp_config IS NULL OR mcp_config ? 'mcpServers'
  );
  ```
- Aggiornare il tipo TypeScript `Workspace` in `packages/shared-types/src/index.ts` aggiungendo:
  ```ts
  mcp_config?: {
    mcpServers: Record<string, MCPServerConfig>;
  } | null;
  ```
  dove:
  ```ts
  export type MCPServerConfig =
    | { type: 'http'; url: string; headers?: Record<string, string> }
    | { type: 'stdio'; command: string; args?: string[] };
  ```

## Criteri di accettazione
- [ ] La colonna `mcp_config` esiste sulla tabella `workspaces` con default `NULL`.
- [ ] Il constraint `valid_mcp_config` impedisce di salvare JSON senza la chiave `mcpServers`.
- [ ] I tipi `Workspace`, `MCPServerConfig` in `shared-types` riflettono la nuova struttura.
- [ ] La migration è versionata nella cartella `supabase/migrations/`.
- [ ] Nessun errore TypeScript nel monorepo dopo la modifica.

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `main` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/204c7b69-2e50-4343-92c7-2f736126a5df origin/main
   ```
2. Implement the task: create or edit files as needed
3. Run lint and type-check — **both must pass before committing** (see `CLAUDE.md` for exact commands):
   ```bash
   # example — use the commands defined in CLAUDE.md for this project
   npm run lint
   npx tsc --noEmit
   ```
   Fix all errors and warnings before continuing. Do not commit with failing checks.
4. Run `git add -A && git commit -m "<descriptive message>"`
5. Run `git push origin feat/204c7b69-2e50-4343-92c7-2f736126a5df`
6. Open a Pull Request from `feat/204c7b69-2e50-4343-92c7-2f736126a5df` to `main`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/204c7b69-2e50-4343-92c7-2f736126a5df"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
