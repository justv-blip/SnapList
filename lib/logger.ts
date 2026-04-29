// Structured logger for server-side API routes.
// Production: emits newline-delimited JSON to stdout (compatible with Vercel/Render log drains).
// Development: pretty-prints to the console with level labels.

type Level = "debug" | "info" | "warn" | "error";

export interface LogMeta {
  [key: string]: unknown;
}

const IS_PROD = process.env.NODE_ENV === "production";

const DEV_PREFIX: Record<Level, string> = {
  debug: "[DEBUG]",
  info:  "[INFO] ",
  warn:  "[WARN] ",
  error: "[ERROR]",
};

function emit(level: Level, message: string, meta?: LogMeta): void {
  if (IS_PROD) {
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg: message,
      ...meta,
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
    return;
  }

  const prefix = DEV_PREFIX[level];
  const args: unknown[] = [`${prefix} ${message}`];
  if (meta && Object.keys(meta).length > 0) args.push(meta);

  switch (level) {
    case "error": console.error(...args); break;
    case "warn":  console.warn(...args);  break;
    default:      console.log(...args);   break;
  }
}

export interface BoundLogger {
  debug: (msg: string, meta?: LogMeta) => void;
  info:  (msg: string, meta?: LogMeta) => void;
  warn:  (msg: string, meta?: LogMeta) => void;
  error: (msg: string, meta?: LogMeta) => void;
}

export const logger = {
  debug: (msg: string, meta?: LogMeta) => emit("debug", msg, meta),
  info:  (msg: string, meta?: LogMeta) => emit("info",  msg, meta),
  warn:  (msg: string, meta?: LogMeta) => emit("warn",  msg, meta),
  error: (msg: string, meta?: LogMeta) => emit("error", msg, meta),

  // Returns a logger pre-bound with context fields (e.g. requestId, userId).
  // All log calls from the bound logger automatically include those fields.
  withContext: (ctx: LogMeta): BoundLogger => ({
    debug: (msg, meta) => emit("debug", msg, { ...ctx, ...meta }),
    info:  (msg, meta) => emit("info",  msg, { ...ctx, ...meta }),
    warn:  (msg, meta) => emit("warn",  msg, { ...ctx, ...meta }),
    error: (msg, meta) => emit("error", msg, { ...ctx, ...meta }),
  }),
};
