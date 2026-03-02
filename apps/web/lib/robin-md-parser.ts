import type { ParsedTask, ParseError, ParseResult } from "@/types/robin-md";

const MAX_TASKS = 50;

const VALID_TYPES = ["feature", "bug", "spike", "chore"] as const;
const VALID_PRIORITIES = ["high", "medium", "low"] as const;

/**
 * Parses a .robin.md file content into an array of ParsedTask objects.
 *
 * Task blocks are delimited by ---TASK--- and ---END--- markers.
 * Everything outside these markers is ignored.
 * Malformed blocks are collected in the errors array, not thrown.
 *
 * @param content Raw string content of a .robin.md file
 * @returns ParseResult with tasks, errors, and optional truncation info
 */
export function parseRobinMd(content: string): ParseResult {
  const tasks: ParsedTask[] = [];
  const errors: ParseError[] = [];

  // Split on ---TASK--- to get candidate blocks; index 0 is file header (ignored)
  const segments = content.split("---TASK---");
  const blocks = segments.slice(1);

  const truncated = blocks.length > MAX_TASKS;
  const originalCount = blocks.length;
  const blocksToProcess = truncated ? blocks.slice(0, MAX_TASKS) : blocks;

  for (let blockIndex = 0; blockIndex < blocksToProcess.length; blockIndex++) {
    const segment = blocksToProcess[blockIndex] ?? "";

    // Extract content up to ---END---; if marker is absent, use full segment
    const endIndex = segment.indexOf("---END---");
    const blockContent = endIndex !== -1 ? segment.slice(0, endIndex) : segment;
    const rawContent = blockContent.trim().slice(0, 300);

    // --- Field parsing ---
    const fields: Record<string, string> = {};
    const descriptionLines: string[] = [];
    let inDescription = false;

    for (const line of blockContent.split("\n")) {
      if (inDescription) {
        descriptionLines.push(line);
        continue;
      }

      // description: | begins a multiline block
      if (/^description:\s*\|/.test(line)) {
        inDescription = true;
        continue;
      }

      // key: value (single line)
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        // match[1] and match[2] are always defined when the regex matches
        fields[match[1]!] = match[2]!.trim();
      }
    }

    // Strip common 2-space indentation from description lines (YAML block scalar convention)
    const description = descriptionLines
      .map((l) => {
        if (l.startsWith("  ")) return l.slice(2);
        if (l.startsWith("\t")) return l.slice(1);
        return l;
      })
      .join("\n")
      .trim();

    // --- Validation ---
    const title = fields["title"];
    if (!title) {
      errors.push({ blockIndex, reason: "Titolo mancante", rawContent });
      continue;
    }

    if (!description || description.length < 20) {
      errors.push({
        blockIndex,
        reason: "Descrizione mancante o troppo corta (min 20 caratteri)",
        rawContent,
      });
      continue;
    }

    // Normalize type — unknown values default to "feature"
    const rawType = fields["type"] ?? "";
    const type: ParsedTask["type"] = (VALID_TYPES as readonly string[]).includes(rawType)
      ? (rawType as ParsedTask["type"])
      : "feature";

    // Normalize priority — unknown values default to "medium"
    const rawPriority = fields["priority"] ?? "";
    const priority: ParsedTask["priority"] = (VALID_PRIORITIES as readonly string[]).includes(
      rawPriority
    )
      ? (rawPriority as ParsedTask["priority"])
      : "medium";

    const task: ParsedTask = {
      title,
      type,
      priority,
      description,
    };

    const agent = fields["agent"];
    if (agent !== undefined && agent !== "") task.agent = agent;

    const repository = fields["repository"];
    if (repository !== undefined && repository !== "") task.repository = repository;

    const depends_on = fields["depends_on"];
    if (depends_on !== undefined && depends_on !== "") task.depends_on = depends_on;

    tasks.push(task);
  }

  if (truncated) {
    return { tasks, errors, truncated: true, originalCount };
  }

  return { tasks, errors };
}
