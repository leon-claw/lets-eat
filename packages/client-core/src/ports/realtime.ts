export interface RealtimeStaleState {
  room: boolean;
  round: boolean;
  reconnected: boolean;
}

export interface RealtimeTransport {
  connect(options: {
    token: string;
    roomId: string;
    revisions: {
      roomRevision: number;
      roundRevision?: number;
    };
    onStale: (state: RealtimeStaleState) => void;
  }): () => void;
}
