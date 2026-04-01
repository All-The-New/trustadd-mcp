import { getRequestId } from "./request-context.js";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, source: string, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
  };

  const requestId = getRequestId();
  if (requestId) entry.requestId = requestId;

  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (k !== "timestamp" && k !== "level" && k !== "source" && k !== "message" && k !== "requestId") {
        entry[k] = v;
      }
    }
  }

  const line = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export function createLogger(source: string): Logger {
  return {
    debug: (message, meta) => emit("debug", source, message, meta),
    info: (message, meta) => emit("info", source, message, meta),
    warn: (message, meta) => emit("warn", source, message, meta),
    error: (message, meta) => emit("error", source, message, meta),
  };
}

/** Backward-compatible shim matching the old log(message, source) signature */
export function log(message: string, source = "express") {
  emit("info", source, message);
}
