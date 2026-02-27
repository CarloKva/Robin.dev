/**
 * JobError hierarchy.
 * `retryable` controls whether BullMQ retries the job after this error.
 * Non-retryable errors go straight to the failed set (DLQ) on first occurrence.
 */
export abstract class JobError extends Error {
  abstract readonly retryable: boolean;
  abstract readonly code: string;
  readonly phase?: string;

  constructor(message: string, phase?: string) {
    super(message);
    this.name = this.constructor.name;
    if (phase !== undefined) (this as { phase?: string }).phase = phase;
  }
}

// -------------------------
// Retryable — transient failures
// -------------------------

export class AgentTimeoutError extends JobError {
  readonly retryable = true;
  readonly code = "AGENT_TIMEOUT";
}

export class APIRateLimitError extends JobError {
  readonly retryable = true;
  readonly code = "API_RATE_LIMIT";
}

export class NetworkError extends JobError {
  readonly retryable = true;
  readonly code = "NETWORK_ERROR";
}

// -------------------------
// Non-retryable — permanent failures
// -------------------------

export class AgentBlockedError extends JobError {
  readonly retryable = false;
  readonly code = "AGENT_BLOCKED";
  readonly question: string;

  constructor(question: string, phase?: string) {
    super(`Agent blocked: ${question}`, phase);
    this.question = question;
  }
}

export class InsufficientSpecError extends JobError {
  readonly retryable = false;
  readonly code = "INSUFFICIENT_SPEC";
}

export class RepositoryAccessError extends JobError {
  readonly retryable = false;
  readonly code = "REPO_ACCESS_ERROR";
}

export class ClaudeNotFoundError extends JobError {
  readonly retryable = false;
  readonly code = "CLAUDE_NOT_FOUND";
}

/** Claude Code process exited with a non-zero code (API error, auth failure, etc.). Retryable. */
export class ClaudeExitError extends JobError {
  readonly retryable = true;
  readonly code = "CLAUDE_EXIT_ERROR";
  readonly exitCode: number;
  readonly stderrTail: string;

  constructor(exitCode: number, stderrTail: string, phase?: string) {
    super(
      `Claude Code exited with code ${exitCode}. Stderr: ${stderrTail.slice(-500) || "(empty)"}`,
      phase
    );
    this.exitCode = exitCode;
    this.stderrTail = stderrTail;
  }
}
