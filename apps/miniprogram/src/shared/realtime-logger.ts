type RealtimeLogLevel = 'info' | 'warn' | 'error';
type RealtimeLogFields = Record<string, unknown>;

const LOG_FILE_NAME = 'lets-eat-realtime.log';
const REDACTED_KEYS = new Set(['token', 'authorization', 'accessToken', 'refreshToken', 'decisions', 'body']);
const EVENT_LABELS: Record<string, string> = {
  'transport.connect': '开始创建实时连接',
  'socket.connecting': '正在连接 WebSocket',
  'socket.open': 'WebSocket 连接已打开',
  'socket.auth.sending': '正在发送 WebSocket 认证',
  'socket.authenticated': 'WebSocket 认证成功',
  'socket.message.raw': '收到 WebSocket 原始消息',
  'message.invalid': '收到无法解析的 WebSocket 消息',
  'message.ignored': '忽略未认证的 WebSocket 消息',
  'event.received': '收到实时事件',
  'event.ignored': '忽略旧的实时事件',
  'socket.reconnect.scheduled': '已安排 WebSocket 重连',
  'socket.closed': 'WebSocket 连接已关闭',
  'socket.error': 'WebSocket 发生错误',
};

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
    label: EVENT_LABELS[event] ?? event,
    ...safeFields,
  };
  const line = JSON.stringify(record);
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  consoleMethod(`[wx-realtime] ${event}（${EVENT_LABELS[event] ?? event}） ${JSON.stringify(safeFields)}`);

  try {
    const filePath = `${wx.env.USER_DATA_PATH}/${LOG_FILE_NAME}`;
    wx.getFileSystemManager().appendFileSync(filePath, `${line}\n`, 'utf8');
  } catch (cause) {
    console.warn('[wx-realtime] log.file.write.failed（日志文件写入失败）', {
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
