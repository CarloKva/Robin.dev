import { describe, it, expect } from "vitest";
import { parseRobinMd } from "../robin-md-parser";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBlock(fields: string, description: string): string {
  return `---TASK---\n${fields}\ndescription: |\n${description}\n---END---`;
}

const LONG_DESCRIPTION = "  Questa è una descrizione valida di almeno 20 caratteri per il test.";
const SHORT_DESCRIPTION = "  Corta.";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("parseRobinMd", () => {
  // ── Empty / trivial inputs ──────────────────────────────────────────────────

  it("returns empty result for empty string", () => {
    const result = parseRobinMd("");
    expect(result.tasks).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("ignores content outside task blocks", () => {
    const content = `# Sprint C — Some Header

Some intro text here.

---TASK---
title: Valid Task
type: feature
priority: high
description: |
  Una descrizione valida di almeno venti caratteri per il test.
---END---

Some trailing text.`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.title).toBe("Valid Task");
    expect(result.errors).toHaveLength(0);
  });

  // ── Valid single task ───────────────────────────────────────────────────────

  it("parses a single valid task block", () => {
    const content = `---TASK---
title: Spike sul contesto di esecuzione
type: spike
priority: high
agent: Usopp
description: |
  Prima di implementare il rework, capire come ricostruire il contesto
  di una task precedente per una nuova sessione di Claude Code.
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const task = result.tasks[0]!;
    expect(task.title).toBe("Spike sul contesto di esecuzione");
    expect(task.type).toBe("spike");
    expect(task.priority).toBe("high");
    expect(task.agent).toBe("Usopp");
    expect(task.description).toContain("Prima di implementare il rework");
  });

  // ── Multiple tasks ──────────────────────────────────────────────────────────

  it("parses multiple valid task blocks in order", () => {
    const content = `---TASK---
title: Task Alpha
type: feature
priority: high
description: |
  Questa è una descrizione valida per la prima task nel file.
---END---

---TASK---
title: Task Beta
type: bug
priority: low
description: |
  Questa è una descrizione valida per la seconda task nel file.
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]?.title).toBe("Task Alpha");
    expect(result.tasks[1]?.title).toBe("Task Beta");
  });

  // ── Multiline description ───────────────────────────────────────────────────

  it("captures full multiline description and strips 2-space indent", () => {
    const content = `---TASK---
title: Task con description lunga
type: chore
priority: medium
description: |
  Prima riga della descrizione per questo task.
  Seconda riga con più dettagli.

  **Acceptance Criteria:**
  - Criterio uno
  - Criterio due
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(1);
    const desc = result.tasks[0]!.description;
    expect(desc).toContain("Prima riga della descrizione per questo task.");
    expect(desc).toContain("Seconda riga con più dettagli.");
    expect(desc).toContain("**Acceptance Criteria:**");
    expect(desc).toContain("- Criterio uno");
    // Leading 2-space indent should be stripped
    expect(desc).not.toMatch(/^  /m);
  });

  // ── depends_on ──────────────────────────────────────────────────────────────

  it("preserves depends_on as the referenced task title", () => {
    const content = `---TASK---
title: Task A
type: feature
priority: medium
description: |
  Descrizione valida della prima task di questo file.
---END---

---TASK---
title: Task B dipende da A
type: feature
priority: medium
depends_on: Task A
description: |
  Questa task dipende dalla prima e ha una descrizione valida.
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[1]?.depends_on).toBe("Task A");
    expect(result.tasks[0]?.depends_on).toBeUndefined();
  });

  // ── Missing title → error ───────────────────────────────────────────────────

  it("skips block with missing title and adds to errors", () => {
    const content = `---TASK---
type: feature
priority: high
description: |
  Descrizione valida ma senza titolo per questo task.
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.reason).toContain("Titolo mancante");
    expect(result.errors[0]?.blockIndex).toBe(0);
  });

  // ── Short description → error ───────────────────────────────────────────────

  it("skips block with description shorter than 20 chars", () => {
    const content = `---TASK---
title: Task con descrizione corta
type: feature
priority: high
description: |
  Corta.
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.reason).toContain("min 20 caratteri");
  });

  it("skips block with missing description entirely", () => {
    const content = `---TASK---
title: Task senza descrizione
type: feature
priority: medium
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  // ── Partial failures don't block other tasks ────────────────────────────────

  it("continues parsing valid blocks even when some blocks are invalid", () => {
    const content = `---TASK---
title: Task valida uno
type: feature
priority: high
description: |
  Questa è la prima task valida con una descrizione abbastanza lunga.
---END---

---TASK---
type: feature
priority: high
description: |
  Task senza titolo — deve essere skippata con un errore.
---END---

---TASK---
title: Task valida due
type: chore
priority: low
description: |
  Questa è la seconda task valida con una descrizione abbastanza lunga.
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.tasks[0]?.title).toBe("Task valida uno");
    expect(result.tasks[1]?.title).toBe("Task valida due");
  });

  // ── Type normalization ──────────────────────────────────────────────────────

  it("defaults unknown type to 'feature'", () => {
    const content = `---TASK---
title: Task con tipo sconosciuto
type: unknown_type
priority: medium
description: |
  Questa è una descrizione valida per testare la normalizzazione del tipo.
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.type).toBe("feature");
  });

  it("accepts all valid types", () => {
    const types = ["feature", "bug", "spike", "chore"] as const;
    for (const type of types) {
      const content = `---TASK---
title: Task di tipo ${type}
type: ${type}
priority: medium
description: |
  Questa è una descrizione valida per testare il tipo ${type} nel parser.
---END---`;
      const result = parseRobinMd(content);
      expect(result.tasks[0]?.type).toBe(type);
    }
  });

  // ── Priority normalization ──────────────────────────────────────────────────

  it("defaults unknown priority to 'medium'", () => {
    const content = `---TASK---
title: Task con priorità sconosciuta
type: feature
priority: extreme
description: |
  Questa è una descrizione valida per testare la normalizzazione della priorità.
---END---`;
    const result = parseRobinMd(content);
    expect(result.tasks[0]?.priority).toBe("medium");
  });

  // ── Optional fields ─────────────────────────────────────────────────────────

  it("omits optional fields when not present in block", () => {
    const content = `---TASK---
title: Task minimale senza campi opzionali
type: feature
priority: medium
description: |
  Questa è una descrizione valida per una task minimale senza opzionali.
---END---`;
    const result = parseRobinMd(content);
    const task = result.tasks[0]!;
    expect(task.agent).toBeUndefined();
    expect(task.repository).toBeUndefined();
    expect(task.depends_on).toBeUndefined();
  });

  it("captures agent, repository, and depends_on when present", () => {
    const content = `---TASK---
title: Task completa con tutti i campi
type: feature
priority: high
agent: Robin
repository: CarloKva/Robin.dev
depends_on: Altra task
description: |
  Questa è una descrizione valida con tutti i campi opzionali valorizzati.
---END---`;
    const result = parseRobinMd(content);
    const task = result.tasks[0]!;
    expect(task.agent).toBe("Robin");
    expect(task.repository).toBe("CarloKva/Robin.dev");
    expect(task.depends_on).toBe("Altra task");
  });

  // ── Truncation at 50 tasks ──────────────────────────────────────────────────

  it("truncates to 50 tasks and sets truncated flag when file exceeds limit", () => {
    const blocks = Array.from(
      { length: 55 },
      (_, i) =>
        `---TASK---\ntitle: Task numero ${i + 1}\ntype: feature\npriority: medium\ndescription: |\n  Descrizione valida per la task numero ${i + 1} del file di test.\n---END---`
    );
    const content = blocks.join("\n\n");
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(50);
    expect(result.truncated).toBe(true);
    expect(result.originalCount).toBe(55);
  });

  it("does not set truncated flag when task count is exactly 50", () => {
    const blocks = Array.from(
      { length: 50 },
      (_, i) =>
        `---TASK---\ntitle: Task numero ${i + 1}\ntype: feature\npriority: medium\ndescription: |\n  Descrizione valida per la task numero ${i + 1} del file di test.\n---END---`
    );
    const content = blocks.join("\n\n");
    const result = parseRobinMd(content);
    expect(result.tasks).toHaveLength(50);
    expect(result.truncated).toBeUndefined();
  });
});
