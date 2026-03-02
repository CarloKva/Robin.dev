export type ParsedTask = {
  title: string;
  type: "feature" | "bug" | "spike" | "chore";
  priority: "high" | "medium" | "low";
  agent?: string;
  repository?: string;
  depends_on?: string;
  description: string;
};

export type ParseError = {
  blockIndex: number;
  reason: string;
  rawContent: string;
};

export type ParseResult = {
  tasks: ParsedTask[];
  errors: ParseError[];
  /** True if the file exceeded the 50-task limit and was truncated. */
  truncated?: true;
  /** Original task count before truncation. */
  originalCount?: number;
};
