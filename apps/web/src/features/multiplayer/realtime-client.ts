import { ServerMessageSchema, type ServerEvent } from '@lets-eat/contracts';

export interface RealtimeRevisions {
  roomRevision: number;
  roundRevision?: number;
}

export interface RealtimeStaleState {
  room: boolean;
  round: boolean;
  reconnected: boolean;
}

export interface RealtimeConnectOptions {
  token: string;
  roomId: string;
  revisions: RealtimeRevisions;
  onStale: (state: RealtimeStaleState) => void;
  url?: string;
}

interface SocketLike {
  readyState: number;
  onopen: ((event: any) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  send(data: string): void;
  close(): void;
}

interface RealtimeClientOptions {
  WebSocketImpl?: new (url: string) => SocketLike;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
  url?: string;
}

const OPEN = 1;
const RECONNECT_DELAYS = [500, 1_000, 2_000, 4_000, 8_000, 10_000];

export class RealtimeClient {
  private socket: SocketLike | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private reconnectAttempt = 0;
  private authenticated = false;
  private hasConnected = false;
  private options: RealtimeConnectOptions | null = null;

  constructor(private readonly dependencies: RealtimeClientOptions = {}) {}

  connect(options: RealtimeConnectOptions): () => void {
    this.stop();
    this.options = options;
    this.stopped = false;
    this.open();
    return () => this.stop();
  }

  private open(): void {
    if (this.stopped || !this.options) return;
    const WebSocketImpl = (this.dependencies.WebSocketImpl ?? globalThis.WebSocket) as new (url: string) => SocketLike;
    if (!WebSocketImpl) throw new Error('WebSocket is not available');
    const socket = new WebSocketImpl(this.dependencies.url ?? this.options.url ?? defaultWebSocketUrl());
    this.socket = socket;
    this.authenticated = false;
    socket.onopen = () => {
      if (this.stopped || !this.options) return;
      socket.send(JSON.stringify({ type: 'auth', token: this.options.token, roomId: this.options.roomId }));
    };
    socket.onmessage = (message: { data: unknown }) => this.handleMessage(message.data);
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.stopped) return;
      this.scheduleReconnect();
    };
  }

  private handleMessage(raw: unknown): void {
    const parsed = ServerMessageSchema.safeParse(parseMessage(raw));
    if (!parsed.success || !this.options) return;
    if (parsed.data.type === 'auth.ok') {
      this.authenticated = true;
      const reconnected = this.hasConnected;
      this.hasConnected = true;
      this.reconnectAttempt = 0;
      if (reconnected) this.options.onStale({ room: true, round: true, reconnected: true });
      return;
    }
    if (!this.authenticated) return;
    this.handleEvent(parsed.data);
  }

  private handleEvent(event: ServerEvent): void {
    if (!this.options) return;
    const room = event.roomRevision > this.options.revisions.roomRevision;
    const round = event.roundRevision !== undefined
      && (this.options.revisions.roundRevision === undefined || event.roundRevision > this.options.revisions.roundRevision);
    if (room || round) this.options.onStale({ room, round, reconnected: false });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.stopped) return;
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)] ?? 10_000;
    this.reconnectAttempt += 1;
    const schedule = this.dependencies.schedule ?? ((callback, timeout) => setTimeout(callback, timeout));
    this.reconnectTimer = schedule(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      (this.dependencies.cancel ?? clearTimeout)(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.authenticated = false;
  }
}

function parseMessage(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function defaultWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}
