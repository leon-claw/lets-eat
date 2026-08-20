import type {
  CatalogDocument,
  CatalogManifest,
  CatalogItem,
  Decision,
  CurrentRoomResponse,
  CustomCatalogSnapshot,
  CreateRoomRequest,
  JoinRoomRequest,
  RoomDatasetType,
  RoomEntryResponse,
  RoomSnapshot,
  RoundResult,
  RoundSnapshot,
} from '@lets-eat/contracts';

export interface GameApi {
  getManifest(): Promise<CatalogManifest>;
  getCatalog(): Promise<CatalogDocument>;
  getCurrentRoom(): Promise<CurrentRoomResponse>;
  getRoom(roomId: string): Promise<RoomSnapshot>;
  createRoom(input: CreateRoomRequest, idempotencyKey: string): Promise<RoomEntryResponse>;
  joinRoom(input: JoinRoomRequest): Promise<RoomEntryResponse>;
  getCustomCatalog(roomId: string): Promise<CustomCatalogSnapshot>;
  changeDataset(room: RoomSnapshot, datasetType: RoomDatasetType): Promise<RoomSnapshot>;
  leaveRoom(roomId: string): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  openNextRound(room: RoomSnapshot): Promise<RoomSnapshot>;
  startRound(room: RoomSnapshot, idempotencyKey: string): Promise<RoundSnapshot>;
  getRound(roundId: string): Promise<RoundSnapshot>;
  putDecision(roundId: string, itemId: string, decision: Decision): Promise<void>;
  deleteDecision(roundId: string, itemId: string): Promise<void>;
  completeRound(round: RoundSnapshot, idempotencyKey: string): Promise<RoundSnapshot>;
  getRoundResult(roundId: string): Promise<RoundResult>;
}

export interface CatalogSelection {
  catalogVersion: string;
  catalogHash: string;
  datasetType: RoomDatasetType;
  items: CatalogItem[];
}
