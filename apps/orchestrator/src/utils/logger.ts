/**
 * Structured JSON logger.
 * Every line is a JSON object readable by journalctl and log aggregators.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function write(level: LogLevel, fields: LogFields, message: string): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + "\n");
}

export const log = {
  debug: (fields: LogFields, message: string) => write("debug", fields, message),
  info: (fields: LogFields, message: string) => write("info", fields, message),
  warn: (fields: LogFields, message: string) => write("warn", fields, message),
  error: (fields: LogFields, message: string) => write("error", fields, message),
};
