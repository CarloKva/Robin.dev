import type { ContextDocument } from "@robin/shared-types";

export const BRAINSTORM_SYSTEM_PROMPT = `Sei Robin, un AI project manager integrato in Robin.dev.
Il tuo compito è trasformare testo libero in task di sviluppo strutturate.

Flow:
1. Leggi il testo dell'utente e i documenti di contesto forniti
2. Se mancano informazioni critiche per creare task concrete, fai UNA domanda alla volta (max 3 round di domande)
3. Quando hai abbastanza contesto, genera le task nel formato robin.md

MODALITÀ STANDARD (brief con < 15 task potenziali):
Genera direttamente le task nel formato [TASKS_GENERATED] ... [/TASKS_GENERATED].

MODALITÀ BATCH (brief con ≥ 15 task potenziali):
Quando il brief contiene molte task (stima ≥ 15), NON generare subito le task.
Prima rispondi con un Batch Manifest nel seguente formato ESATTO:

[BATCH_MANIFEST]
{
  "total_tasks": <intero>,
  "batches": [
    { "batch_id": 1, "title": "Nome gruppo", "task_count": 5, "description": "Cosa contiene questo batch" },
    { "batch_id": 2, "title": "Altro gruppo", "task_count": 4, "description": "Cosa contiene questo batch" }
  ]
}
[/BATCH_MANIFEST]

Raggruppa le task in batch da 4-6 task correlate tra loro.
Dopo il manifest, attendi istruzioni senza generare task.

Quando ricevi esattamente il messaggio "Genera batch N: [titolo]",
genera SOLO le task di quel batch nel formato [TASKS_GENERATED]...[/TASKS_GENERATED].

Regole:
- Sii conciso nelle domande: una sola domanda per messaggio
- Non chiedere informazioni già presenti nel testo o nei documenti di contesto
- Genera task atomiche, implementabili singolarmente da un agente AI
- Ogni task deve avere titolo chiaro, tipo, priorità, repository e descrizione dettagliata
- La description di ogni task NON può superare i 4000 caratteri. Se una descrizione richiederebbe più spazio, dividi il lavoro in due o più task separate invece di scrivere una descrizione più lunga

Formato task obbligatorio:
[TASKS_GENERATED]
---TASK---
title: Titolo della task
type: feature
priority: high
repository: org/repo
description: |
  Descrizione dettagliata della task in markdown.
  Includi: obiettivo, comportamento atteso, criteri di accettazione.
---END---
---TASK---
title: Altra task
type: bug
priority: medium
repository: org/repo
description: |
  Descrizione della task.
---END---
[/TASKS_GENERATED]

Tipi validi: feature, bug, chore, spike
Priorità valide: high, medium, low
Repository: usa il full_name GitHub (es. acme/frontend)`;

export function buildContextBlock(docs: ContextDocument[]): string {
  if (docs.length === 0) return "";

  const sections = docs
    .map((doc) => {
      const source = doc.source_path
        ? ` (${doc.source_repo_full_name}/${doc.source_path})`
        : " (manuale)";
      return `### ${doc.title}${source}\n\n${doc.content}`;
    })
    .join("\n\n---\n\n");

  return `Di seguito i documenti di contesto del progetto:\n\n${sections}`;
}

export const TASKS_GENERATED_OPEN = "[TASKS_GENERATED]";
export const TASKS_GENERATED_CLOSE = "[/TASKS_GENERATED]";

/**
 * Extracts the robin.md content from an AI response if present.
 * Returns null if the marker is not found.
 */
export function extractGeneratedTasks(text: string): string | null {
  const start = text.indexOf(TASKS_GENERATED_OPEN);
  const end = text.indexOf(TASKS_GENERATED_CLOSE);
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start + TASKS_GENERATED_OPEN.length, end).trim();
}

// ─── Batch manifest ───────────────────────────────────────────────────────────

export const BATCH_MANIFEST_OPEN = "[BATCH_MANIFEST]";
export const BATCH_MANIFEST_CLOSE = "[/BATCH_MANIFEST]";

export type BatchItem = {
  batch_id: number;
  title: string;
  task_count: number;
  description: string;
};

export type BatchManifest = {
  total_tasks: number;
  batches: BatchItem[];
};

/**
 * Extracts and parses a BatchManifest from an AI response if present.
 * Returns null if the marker is not found or JSON is invalid/malformed.
 */
export function extractBatchManifest(text: string): BatchManifest | null {
  const start = text.indexOf(BATCH_MANIFEST_OPEN);
  const end = text.indexOf(BATCH_MANIFEST_CLOSE);
  if (start === -1 || end === -1 || end < start) return null;

  const raw = text.slice(start + BATCH_MANIFEST_OPEN.length, end).trim();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("total_tasks" in parsed) ||
      !("batches" in parsed) ||
      !Array.isArray((parsed as { batches: unknown }).batches) ||
      (parsed as BatchManifest).batches.length === 0
    ) {
      return null;
    }
    return parsed as BatchManifest;
  } catch {
    return null;
  }
}
