/**
 * Simple structured logger that writes to stderr.
 * All log output goes to stderr so stdout stays clean for MCP JSON-RPC.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("debug")) {
      console.error(formatMessage("debug", message, meta));
    }
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("info")) {
      console.error(formatMessage("info", message, meta));
    }
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("warn")) {
      console.error(formatMessage("warn", message, meta));
    }
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog("error")) {
      console.error(formatMessage("error", message, meta));
    }
  },
};
