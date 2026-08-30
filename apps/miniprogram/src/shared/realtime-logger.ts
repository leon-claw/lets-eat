type RealtimeLogLevel = 'info' | 'warn' | 'error';
type RealtimeLogFields = Record<string, unknown>;

const LOG_FILE_NAME = 'lets-eat-realtime.log';
const REDACTED_KEYS = new Set(['token', 'authorization', 'accessToken', 'refreshToken', 'decisions', 'body']);

export function writeRealtimeLog(
  level: RealtimeLogLevel,
  event: string,
  fields: RealtimeLogFields = {},
): void {
  const safeFields = sanitizeFields(fields);
  const record = {
    timestamp: new Date().toISOString(),
    scope: 'miniprogram-realtime',
    level,
    event,
    ...safeFields,
  };
  const line = JSON.stringify(record);
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  consoleMethod(`[wx-realtime] ${event} ${JSON.stringify(safeFields)}`);

  try {
    const filePath = `${wx.env.USER_DATA_PATH}/${LOG_FILE_NAME}`;
    wx.getFileSystemManager().appendFileSync(filePath, `${line}\n`, 'utf8');
  } catch (cause) {
    console.warn('[wx-realtime] log.file.write.failed', {
      message: cause instanceof Error ? cause.message : 'unknown error',
    });
  }
}

function sanitizeFields(fields: RealtimeLogFields): RealtimeLogFields {
  const sanitized: RealtimeLogFields = {};
  Object.entries(fields).forEach(([key, value]) => {
    sanitized[key] = sanitizeValue(key, value);
  });
  return sanitized;
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (REDACTED_KEYS.has(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeValue('', item));
  if (value && typeof value === 'object') {
    const sanitized: RealtimeLogFields = {};
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      sanitized[nestedKey] = sanitizeValue(nestedKey, nestedValue);
    });
    return sanitized;
  }
  return value;
}
