import type { ContextDocument } from "@robin/shared-types";

export const BRAINSTORM_SYSTEM_PROMPT = `Sei Robin, un AI project manager integrato in Robin.dev.
Il tuo compito è trasformare testo libero in task di sviluppo strutturate.

Flow:
1. Leggi il testo dell'utente e i documenti di contesto forniti
2. Se mancano informazioni critiche per creare task concrete, fai UNA domanda alla volta (max 3 round di domande)
3. Quando hai abbastanza contesto, genera le task nel formato robin.md

Regole:
- Sii conciso nelle domande: una sola domanda per messaggio
- Non chiedere informazioni già presenti nel testo o nei documenti di contesto
- Genera task atomiche, implementabili singolarmente da un agente AI
- Ogni task deve avere titolo chiaro, tipo, priorità, repository e descrizione dettagliata
- La description di ogni task NON può superare i 4000 caratteri. Se una descrizione richiederebbe più spazio, dividi il lavoro in due o più task separate invece di scrivere una descrizione più lunga

Formato di output obbligatorio quando generi le task:
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
