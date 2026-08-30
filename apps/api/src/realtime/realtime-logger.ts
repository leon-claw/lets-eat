import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type RealtimeLogLevel = 'info' | 'warn' | 'error';
type RealtimeLogFields = Record<string, unknown>;

const REDACTED_KEYS = new Set(['token', 'authorization', 'accessToken', 'refreshToken', 'decisions', 'body']);

export interface RealtimeLogger {
  info(event: string, fields?: RealtimeLogFields): void;
  warn(event: string, fields?: RealtimeLogFields): void;
  error(event: string, fields?: RealtimeLogFields): void;
}

export function createRealtimeLogger(
  filePath = resolve(process.env.REALTIME_LOG_FILE ?? 'logs/realtime.log'),
): RealtimeLogger {
  const write = (level: RealtimeLogLevel, event: string, fields: RealtimeLogFields = {}): void => {
    const safeFields = sanitizeFields(fields);
    const record = {
      timestamp: new Date().toISOString(),
      scope: 'api-realtime',
      level,
      event,
      ...safeFields,
    };
    const line = JSON.stringify(record);
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    consoleMethod(`[api-realtime] ${event} ${JSON.stringify(safeFields)}`);

    try {
      mkdirSync(dirname(filePath), { recursive: true });
      appendFileSync(filePath, `${line}\n`, 'utf8');
    } catch (cause) {
      console.warn('[api-realtime] log.file.write.failed', {
        filePath,
        message: cause instanceof Error ? cause.message : 'unknown error',
      });
    }
  };

  return {
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}

export const realtimeLogger = createRealtimeLogger();

function sanitizeFields(fields: RealtimeLogFields): RealtimeLogFields {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, sanitizeValue(key, value)]));
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (REDACTED_KEYS.has(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeValue('', item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, sanitizeValue(nestedKey, nestedValue)]));
  }
  return value;
}
