# Food Game Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the confirmed end-to-end Web MVP for single-player and real multi-device food selection, with refresh recovery, anonymous aggregate results, and portable Docker deployment.

**Architecture:** Migrate the existing Vite app into a pnpm workspace without rewriting its validated swipe interaction, then add a shared Zod contract package and one Express/ws API backed by PostgreSQL. Deliver the product in vertical slices: versioned catalog and single-player first, then anonymous identity, rooms, rounds, realtime recovery, multiplayer UI, and finally operations/deployment.

**Tech Stack:** Node.js 22.14+, pnpm 10.16.1, React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Motion, React Router, Express 5, ws, Zod, Drizzle ORM, PostgreSQL 17, JOSE, Pino, Vitest, Testing Library, Supertest, Playwright, Docker Compose, Nginx, Cloudflare Tunnel.

## Global Constraints

- The product is Web-only for this MVP; do not add WeChat Mini Program code.
- Preserve the current `SwipeDeck` card stack, horizontal drag, exit animation, undo behavior, and compact mobile visual language.
- A game has only `liked` and `disliked` decisions: right/“喜欢” selects, left/“不喜欢” does not select; remove upward swipe, “强推”, random wheel, and “2人想吃”.
- Home and game pages have no standard back button; every other full page has a back action, and every modal has close/cancel.
- Single-player always goes through dataset confirmation; multiplayer dataset defaults to `large` and is editable only by the host while the room is waiting.
- The fixed catalog is read-only, versioned, immutable after publication, and shared by every user; no settings, catalog CRUD, upload, nearby-food, map, restaurant, payment, Redis, queue service, microservice, or Kubernetes features.
- `large` and `small` are independent datasets with no parent-child relationship; catalog item IDs remain stable across versions.
- Rooms use unique 8-digit numeric codes, contain at most 8 members including the host, have no host transfer, and expire after 24 hours without a business write.
- Anonymous JWTs are HMAC-signed, valid for 180 days, and are not stored as sessions or token hashes in PostgreSQL.
- PostgreSQL is the only persistent server-side source of truth; the API keeps no business state except live WebSocket connections.
- Multiplayer decisions are private to their owner; public progress exposes only `choosing | completed | removed`, and completed results expose anonymous counts only.
- Result rows include items with at least one like, sorted by like count descending and catalog `order` ascending; empty results have no random fallback.
- HTTP is the only command/state channel; WebSocket events are best-effort invalidation notifications followed by HTTP refetch.
- All global room/round commands use revisions; create/start/complete use `Idempotency-Key`; personal decision writes use a unique key and a serial client queue instead of the global revision.
- Daily development runs Web and API on the host and only PostgreSQL in Docker; the repository maintains one `compose.yaml` for full deployment and optional Cloudflare Tunnel.
- Images, menu versions, environment variables, container images, and protocol code must remain portable across ARM64 personal computers and AMD64 cloud hosts.
- Follow TDD for behavior changes and keep the complete product runnable after every task.
- After each code task, run `graphify update .` and keep generated `graphify-out/` changes outside feature commits unless the user explicitly asks to version them.

---

## Target File Structure

```text
.
├── package.json                         # Root workspace scripts and shared tool versions
├── .nvmrc                               # Node.js 22 toolchain floor
├── pnpm-workspace.yaml                  # apps/* and packages/* membership
├── pnpm-lock.yaml                       # Sole JavaScript lockfile
├── tsconfig.base.json                   # Shared strict TypeScript options
├── compose.yaml                         # Dev PostgreSQL, full stack, backup, test DB, tunnel profile
├── .env.example                         # Local-safe sample configuration
├── apps/
│   ├── web/
│   │   ├── package.json                 # React/Vite application commands
│   │   ├── src/app/                     # Router, providers, route recovery
│   │   ├── src/entities/catalog/        # Catalog item model, API repository, browser cache
│   │   ├── src/entities/room/           # Room/round HTTP client and view types
│   │   ├── src/features/identity/       # Username and anonymous token persistence
│   │   ├── src/features/single-round/   # Local round persistence and controller
│   │   ├── src/features/multiplayer/    # Durable queue, room realtime, round controller
│   │   ├── src/features/choose-food/    # Preserved swipe reducer and presentation
│   │   ├── src/pages/                   # Nine confirmed pages/states
│   │   └── src/shared/                  # Fetch, storage, layout, errors, styles
│   └── api/
│       ├── package.json                 # Express/ws/Drizzle commands
│       ├── Dockerfile                   # Multi-stage portable API image
│       ├── catalog/v1/                  # Immutable JSON and checked-in image assets
│       ├── drizzle/                     # Generated SQL migrations
│       └── src/
│           ├── app.ts                   # Express composition, middleware, routes
│           ├── server.ts                # HTTP server, WebSocket attachment, boot/shutdown
│           ├── config/                  # Validated environment
│           ├── db/                      # Drizzle schema, pool, migrations
│           ├── auth/                    # Stateless JWT issue/verify middleware
│           ├── catalog/                 # Manifest/hash/resource service and routes
│           ├── rooms/                   # Waiting-room transactions and routes
│           ├── rounds/                  # Decisions, completion, result transactions/routes
│           ├── realtime/                # Authenticated ws hub and event publication
│           ├── operations/              # Health, expiry cleanup, request/log policies
│           └── test/                    # Real test-Postgres harness and factories
├── packages/contracts/
│   ├── package.json                     # Zod runtime contracts and inferred TS exports
│   └── src/                             # Common, catalog, identity, room, round, realtime schemas
├── infra/
│   ├── nginx/default.conf               # SPA serving plus /api and /ws proxy
│   └── backup/backup.sh                 # Atomic pg_dump and seven-backup retention
├── e2e/                                 # Playwright single-player and two-context multiplayer tests
└── docs/runbooks/                       # Local development, tunnel, backup/restore instructions
```

The root 高德 map prototype (`index.html`, `app.js`, `app-core.js`, `city-data.js`, `styles.css`) stays untouched because it is archived scope outside the food-game workspace.

## Protocol Map

| Method | Path | Request | Success response |
|---|---|---|---|
| `POST` | `/api/auth/anonymous` | empty | `AnonymousAuthResponse` (201) |
| `GET` | `/api/catalog/manifest` | empty | `CatalogManifest` |
| `GET` | `/api/catalog/:version` | empty | `CatalogDocument` |
| `GET` | `/api/me/room` | empty | `{ room: RoomSnapshot \| null }` |
| `POST` | `/api/rooms` | `CreateRoomRequest` + `Idempotency-Key` | `RoomSnapshot` (201) |
| `POST` | `/api/rooms/join` | `JoinRoomRequest` | `RoomSnapshot` |
| `GET` | `/api/rooms/:roomId` | empty | `RoomSnapshot` |
| `PATCH` | `/api/rooms/:roomId/dataset` | `ChangeDatasetRequest` | `RoomSnapshot` |
| `POST` | `/api/rooms/:roomId/leave` | empty | empty (204) |
| `DELETE` | `/api/rooms/:roomId` | empty | empty (204) |
| `POST` | `/api/rooms/:roomId/rounds` | `StartRoundRequest` + `Idempotency-Key` | `RoundSnapshot` (201) |
| `GET` | `/api/rounds/:roundId` | empty | `RoundSnapshot` |
| `PUT` | `/api/rounds/:roundId/decisions/:catalogItemId` | `PutDecisionRequest` | empty (204) |
| `DELETE` | `/api/rounds/:roundId/decisions/:catalogItemId` | empty | empty (204) |
| `POST` | `/api/rounds/:roundId/complete` | `CompleteRoundRequest` + `Idempotency-Key` | `RoundSnapshot` |
| `POST` | `/api/rounds/:roundId/members/:memberId/remove` | `RemoveRoundMemberRequest` | `RoundSnapshot` |
| `GET` | `/api/rounds/:roundId/result` | empty | `RoundResult` |
| `POST` | `/api/rooms/:roomId/open-next-round` | `OpenNextRoundRequest` | `RoomSnapshot` |

All routes except catalog, anonymous auth, and health require `Authorization: Bearer <token>`. Business errors use `ApiError` and only statuses 400, 401, 403, 404, 409, 422, and 429; `/health/ready` separately uses 503 for an unhealthy dependency. `/ws` accepts `ClientAuthMessage` as its first frame, replies with `ServerAuthOkMessage`, then sends `ServerEvent` invalidation envelopes.

---

### Task 1: Convert `source` into a pnpm workspace without changing behavior

**Files:**
- Create: `package.json`
- Create: `.nvmrc`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `pnpm-lock.yaml`
- Move: `source/` → `apps/web/`
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`
- Delete: `apps/web/package-lock.json`

**Interfaces:**
- Produces the `@lets-eat/web` package and workspace membership that Tasks 2–3 fill with `@lets-eat/contracts` and `@lets-eat/api`.
- Preserves the current `App`, `useChooseFood`, reducer, `SwipeDeck`, and all existing Web tests byte-for-byte during the move.

- [ ] **Step 1: Record the green baseline before moving files**

Run: `cd source && npm test`

Expected: all current Vitest tests pass.

Run: `cd source && npm run lint`

Expected: TypeScript exits 0.

- [ ] **Step 2: Add the root workspace files**

Use this root `package.json`:

```json
{
  "name": "lets-eat",
  "private": true,
  "packageManager": "pnpm@10.16.1",
  "engines": { "node": ">=22.14" },
  "scripts": {
    "dev": "pnpm --filter @lets-eat/web dev",
    "dev:web": "pnpm --filter @lets-eat/web dev",
    "build": "pnpm --filter @lets-eat/web build",
    "lint": "pnpm --filter @lets-eat/web lint",
    "test": "pnpm --filter @lets-eat/web test"
  },
  "devDependencies": {
    "typescript": "~5.8.2"
  }
}
```

Use this `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Set `.nvmrc` to `22`. Use shared options in `tsconfig.base.json`: `target: ES2022`, `strict: true`, `skipLibCheck: true`, and `forceConsistentCasingInFileNames: true`. Keep `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` disabled for the migrated Web package so Task 1 remains behavior-preserving; enable both in the new contracts and API package configs where every file is written against them from the start.

- [ ] **Step 3: Move the Web package and align its metadata**

Run:

```bash
mkdir -p apps
git mv source apps/web
git rm apps/web/package-lock.json
```

Change `apps/web/package.json` name to `@lets-eat/web`, retain its current dependency versions, and make its `tsconfig.json` extend `../../tsconfig.base.json`. Keep the `@` alias rooted at `apps/web/src` in both Vite and Vitest.

- [ ] **Step 4: Install with pnpm and verify the moved app**

Run: `pnpm install`

Expected: `pnpm-lock.yaml` is created and no package lock exists below `apps/web`.

Run: `pnpm --filter @lets-eat/web test`

Expected: the same tests from Step 1 pass.

Run: `pnpm --filter @lets-eat/web build`

Expected: Vite creates `apps/web/dist` successfully.

- [ ] **Step 5: Commit the independently runnable workspace migration**

```bash
git add .nvmrc package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json apps/web
git commit -m "chore: migrate web app to pnpm workspace"
```

---

### Task 2: Define shared runtime contracts

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/common.ts`
- Create: `packages/contracts/src/catalog.ts`
- Create: `packages/contracts/src/identity.ts`
- Create: `packages/contracts/src/rooms.ts`
- Create: `packages/contracts/src/rounds.ts`
- Create: `packages/contracts/src/realtime.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/contracts.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces Zod schemas and inferred types for every HTTP request/response and WebSocket message.
- `DatasetType` is exactly `'large' | 'small'`; `Decision` is exactly `'liked' | 'disliked'`.
- Later packages import only from `@lets-eat/contracts`, never from each other’s implementation folders.

- [ ] **Step 1: Write failing positive and negative contract tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  CatalogDocumentSchema,
  JoinRoomRequestSchema,
  PutDecisionRequestSchema,
  RoomSnapshotSchema,
  ServerEventSchema,
} from './index.js';

describe('shared contracts', () => {
  it('rejects a non-numeric room code and unsupported decision', () => {
    expect(JoinRoomRequestSchema.safeParse({ code: '12AB5678' }).success).toBe(false);
    expect(PutDecisionRequestSchema.safeParse({ decision: 'superlike' }).success).toBe(false);
  });

  it('rejects a room snapshot that exposes member decisions', () => {
    const hostUserId = crypto.randomUUID();
    const parsed = RoomSnapshotSchema.safeParse({
      id: crypto.randomUUID(), code: '1234', status: 'waiting',
      selectedDataset: 'large', revision: 1, currentRoundId: null,
      hostUserId,
      members: [{
        id: crypto.randomUUID(), userId: hostUserId, displayName: '测试房主',
        role: 'host', joinedAt: new Date(0).toISOString(), decisions: [],
      }],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts catalog and revision-only realtime envelopes', () => {
    expect(CatalogDocumentSchema.safeParse({
      catalogVersion: 'v1',
      items: [{
        id: 'cantonese', name: '粤菜', description: '清鲜细腻',
        imageUrl: '/api/catalog-assets/v1/images/cantonese.jpg',
        datasetType: 'large', order: 1, tags: ['清鲜'], representativeFoods: ['白切鸡'],
      }],
    }).success).toBe(true);
    expect(ServerEventSchema.safeParse({
      eventId: crypto.randomUUID(), type: 'room.updated', roomId: crypto.randomUUID(),
      roomRevision: 2, occurredAt: new Date(0).toISOString(),
    }).success).toBe(true);
  });
});
```

Run: `pnpm --filter @lets-eat/contracts test`

Expected: FAIL because the package and exports do not exist.

- [ ] **Step 2: Create the contract package and common schemas**

`packages/contracts/package.json` must build ESM declarations to `dist` and export `dist/index.js`. Add `zod` as a runtime dependency and Vitest/TypeScript as development dependencies.

Now that two packages exist, change root `build`, `lint`, and `test` to `pnpm -r --workspace-concurrency=1 <script>` so each package participates in the root release gate.

Define these exact common exports:

```ts
export const UuidSchema = z.string().uuid();
export const RevisionSchema = z.number().int().nonnegative();
export const DatasetTypeSchema = z.enum(['large', 'small']);
export const DecisionSchema = z.enum(['liked', 'disliked']);
export const RoomStatusSchema = z.enum(['waiting', 'playing', 'results']);
export const RoundStatusSchema = z.enum(['playing', 'completed']);
export const RoundMemberStatusSchema = z.enum(['choosing', 'completed', 'removed']);
export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  requestId: z.string().min(1),
  latest: z.unknown().optional(),
}).strict();
```

Infer and export matching TypeScript types with `z.infer`.

- [ ] **Step 3: Implement catalog and identity contracts**

```ts
export const CatalogItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(40),
  description: z.string().min(1).max(240),
  imageUrl: z.string().min(1),
  datasetType: DatasetTypeSchema,
  order: z.number().int().positive(),
  tags: z.array(z.string().min(1)).max(5),
  representativeFoods: z.array(z.string().min(1)).max(5),
}).strict();

export const CatalogDocumentSchema = z.object({
  catalogVersion: z.string().regex(/^v[1-9]\d*$/),
  items: z.array(CatalogItemSchema).min(1),
}).strict();

export const CatalogManifestSchema = z.object({
  catalogVersion: z.string(),
  catalogHash: z.string().regex(/^[a-f0-9]{64}$/),
  catalogUrl: z.string().min(1),
  counts: z.object({ large: z.number().int().nonnegative(), small: z.number().int().nonnegative() }).strict(),
}).strict();

export const GetCatalogManifestResponseSchema = CatalogManifestSchema;
export const GetCatalogResponseSchema = CatalogDocumentSchema;

export const AnonymousAuthResponseSchema = z.object({
  userId: UuidSchema,
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
}).strict();
```

- [ ] **Step 4: Implement room and round contracts**

Define and export these exact schemas and inferred types:

```ts
export const RoomMemberSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  displayName: z.string().trim().min(1).max(24),
  role: z.enum(['host', 'guest']),
  joinedAt: z.string().datetime(),
}).strict();

export const RoomSnapshotSchema = z.object({
  id: UuidSchema,
  code: z.string().regex(/^\d{8}$/),
  hostUserId: UuidSchema,
  selectedDataset: DatasetTypeSchema,
  status: RoomStatusSchema,
  currentRoundId: UuidSchema.nullable(),
  revision: RevisionSchema,
  members: z.array(RoomMemberSchema).min(1).max(8),
}).strict();

export const CurrentRoomResponseSchema = z.object({ room: RoomSnapshotSchema.nullable() }).strict();

export const CreateRoomRequestSchema = z.object({ displayName: z.string().trim().min(1).max(24) }).strict();
export const JoinRoomRequestSchema = z.object({
  code: z.string().regex(/^\d{8}$/),
  displayName: z.string().trim().min(1).max(24),
}).strict();
export const ChangeDatasetRequestSchema = z.object({ datasetType: DatasetTypeSchema, expectedRevision: RevisionSchema }).strict();
export const StartRoundRequestSchema = z.object({ expectedRoomRevision: RevisionSchema }).strict();
export const CompleteRoundRequestSchema = z.object({ expectedRoundRevision: RevisionSchema }).strict();
export const RemoveRoundMemberRequestSchema = z.object({ expectedRoundRevision: RevisionSchema }).strict();
export const OpenNextRoundRequestSchema = z.object({ expectedRoomRevision: RevisionSchema }).strict();
export const PutDecisionRequestSchema = z.object({ decision: DecisionSchema }).strict();

export const OwnDecisionSchema = z.object({ catalogItemId: z.string(), decision: DecisionSchema, updatedAt: z.string().datetime() }).strict();
export const RoundMemberSchema = z.object({ memberId: UuidSchema, displayName: z.string(), status: RoundMemberStatusSchema, isSelf: z.boolean(), role: z.enum(['host', 'guest']) }).strict();
export const RoundSnapshotSchema = z.object({
  id: UuidSchema, roomId: UuidSchema, sequence: z.number().int().positive(),
  catalogVersion: z.string(), catalogHash: z.string(), datasetType: DatasetTypeSchema,
  status: RoundStatusSchema, revision: RevisionSchema,
  members: z.array(RoundMemberSchema).min(1).max(8), ownDecisions: z.array(OwnDecisionSchema),
}).strict();
export const ResultItemSchema = z.object({ catalogItemId: z.string(), likeCount: z.number().int().positive(), order: z.number().int().positive() }).strict();
export const RoundResultSchema = z.object({ roundId: UuidSchema, catalogVersion: z.string(), catalogHash: z.string().regex(/^[a-f0-9]{64}$/), datasetType: DatasetTypeSchema, items: z.array(ResultItemSchema) }).strict();

export const CreateRoomResponseSchema = RoomSnapshotSchema;
export const JoinRoomResponseSchema = RoomSnapshotSchema;
export const GetRoomResponseSchema = RoomSnapshotSchema;
export const ChangeDatasetResponseSchema = RoomSnapshotSchema;
export const StartRoundResponseSchema = RoundSnapshotSchema;
export const GetRoundResponseSchema = RoundSnapshotSchema;
export const CompleteRoundResponseSchema = RoundSnapshotSchema;
export const RemoveRoundMemberResponseSchema = RoundSnapshotSchema;
export const GetRoundResultResponseSchema = RoundResultSchema;
export const OpenNextRoundResponseSchema = RoomSnapshotSchema;
```

These aliases make every protocol-map response schema directly importable even when two routes intentionally share the same payload shape.

- [ ] **Step 5: Implement WebSocket authentication and event contracts**

```ts
export const ClientAuthMessageSchema = z.object({
  type: z.literal('auth'), token: z.string().min(1), roomId: UuidSchema,
}).strict();

export const ServerAuthOkMessageSchema = z.object({
  type: z.literal('auth.ok'), roomId: UuidSchema,
}).strict();

const EventBaseSchema = z.object({
  eventId: UuidSchema,
  roomId: UuidSchema,
  roomRevision: RevisionSchema,
  roundId: UuidSchema.optional(),
  roundRevision: RevisionSchema.optional(),
  occurredAt: z.string().datetime(),
});

export const ServerEventSchema = z.discriminatedUnion('type', [
  EventBaseSchema.extend({ type: z.literal('room.updated') }).strict(),
  EventBaseSchema.extend({ type: z.literal('round.started'), roundId: UuidSchema, roundRevision: RevisionSchema }).strict(),
  EventBaseSchema.extend({ type: z.literal('member.progressed'), roundId: UuidSchema, roundRevision: RevisionSchema }).strict(),
  EventBaseSchema.extend({ type: z.literal('round.completed'), roundId: UuidSchema, roundRevision: RevisionSchema }).strict(),
  EventBaseSchema.extend({ type: z.literal('room.closed') }).strict(),
]);

export const ServerMessageSchema = z.union([ServerAuthOkMessageSchema, ServerEventSchema]);
```

Export every schema and inferred type from `src/index.ts`.

- [ ] **Step 6: Run contract verification and commit**

Run: `pnpm --filter @lets-eat/contracts test`

Expected: all positive and negative schema cases pass.

Run: `pnpm --filter @lets-eat/contracts build`

Expected: ESM JavaScript and declaration files exist under `packages/contracts/dist`.

```bash
git add packages/contracts package.json pnpm-lock.yaml
git commit -m "feat: add shared game contracts"
```

---

### Task 3: Serve an immutable versioned catalog from an Express API

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/http/api-error.ts`
- Create: `apps/api/src/http/request-id.ts`
- Create: `apps/api/src/catalog/catalog-service.ts`
- Create: `apps/api/src/catalog/catalog-routes.ts`
- Create: `apps/api/src/catalog/catalog-service.test.ts`
- Create: `apps/api/src/catalog/catalog-routes.test.ts`
- Create: `apps/api/catalog/v1/catalog.json`
- Create: `apps/api/catalog/v1/images/cantonese.webp`
- Create: `apps/api/catalog/v1/images/sichuan.webp`
- Create: `apps/api/catalog/v1/images/hunan.webp`
- Create: `apps/api/catalog/v1/images/hotpot.webp`
- Create: `apps/api/catalog/v1/images/barbecue.webp`
- Create: `apps/api/catalog/v1/images/luosifen.webp`
- Create: `apps/api/catalog/v1/images/japanese.webp`
- Create: `apps/api/catalog/v1/images/korean.webp`
- Create: `apps/api/catalog/v1/images/western.webp`
- Create: `apps/api/catalog/v1/images/southeast-asian.webp`
- Create: `apps/api/catalog/v1/images/northeast.webp`
- Create: `apps/api/catalog/v1/images/yunnan.webp`
- Create: `apps/api/catalog/v1/images/noodles.webp`
- Create: `apps/api/catalog/v1/images/light-food.webp`
- Create: `apps/api/catalog/v1/images/dessert-drinks.webp`
- Create: `apps/api/catalog/v1/images/seafood.webp`
- Modify: `package.json`

**Interfaces:**
- Produces `createApp(deps: { catalogService: CatalogService }): Express`.
- Produces `CatalogService.getManifest(): CatalogManifest` and `CatalogService.getCatalog(version: string): CatalogDocument | null`.
- Exposes unauthenticated `GET /api/catalog/manifest`, `GET /api/catalog/:version`, and versioned static image URLs.

- [ ] **Step 1: Write failing hash, count, cache, and route tests**

```ts
it('computes a stable SHA-256 and independent dataset counts', () => {
  const service = CatalogService.fromDirectory(fixtureDir, 'v1');
  expect(service.getManifest()).toMatchObject({
    catalogVersion: 'v1', counts: { large: 10, small: 6 },
  });
  expect(service.getManifest().catalogHash).toMatch(/^[a-f0-9]{64}$/);
});

it('returns short-cache manifest and immutable versioned catalog', async () => {
  const response = await request(app).get('/api/catalog/manifest').expect(200);
  expect(response.headers['cache-control']).toBe('public, max-age=60');
  await request(app)
    .get(`/api/catalog/${response.body.catalogVersion}`)
    .expect('cache-control', /immutable/)
    .expect(200);
});
```

Run: `pnpm --filter @lets-eat/api test -- catalog`

Expected: FAIL because the API package and service do not exist.

- [ ] **Step 2: Build the minimal Express app and error envelope**

Install `express@^5`, `supertest`, TypeScript, `tsx`, and Vitest. `createApp` must use `express.json({ limit: '32kb' })`, assign a UUID request ID, mount catalog routes, and convert `ApiError` to `{ code, message, requestId, latest? }`. Unknown routes return `404` with code `NOT_FOUND`.

Add root command `dev:api: "pnpm --filter @lets-eat/contracts build && pnpm --filter @lets-eat/api dev"`; keep `dev` pointing to the Web app so `pnpm dev` remains the shortest browser startup command.

```ts
export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429,
    readonly code: string,
    message: string,
    readonly latest?: unknown,
  ) { super(message); }
}
```

- [ ] **Step 3: Publish `v1` from the existing 16 fixed records**

Convert `apps/web/src/entities/food-choice/mock-data.ts` one-for-one into `catalog.json`, renaming `coverImage` to `imageUrl`. Assign these exact independent datasets and one-based order within each dataset:

```text
large: cantonese, sichuan, hunan, japanese, korean, western,
       southeast-asian, northeast, yunnan, seafood
small: hotpot, barbecue, luosifen, noodles, light-food, dessert-drinks
```

Set every `imageUrl` to `/api/catalog-assets/v1/images/<id>.webp`. Download each current checked-in Unsplash source URL to the corresponding path, convert it to WebP once, and commit the binaries so runtime catalog loading does not depend on Unsplash. Validate the completed JSON with `CatalogDocumentSchema` during API startup.

- [ ] **Step 4: Implement deterministic hash and HTTP caching**

```ts
const canonicalJson = JSON.stringify(CatalogDocumentSchema.parse(rawCatalog));
const catalogHash = createHash('sha256').update(canonicalJson).digest('hex');
```

Manifest responses use `ETag: "<catalogHash>"`, return `304` for matching `If-None-Match`, and use `Cache-Control: public, max-age=60`. Catalog JSON and assets use `Cache-Control: public, max-age=31536000, immutable`; unknown versions return `CATALOG_VERSION_NOT_FOUND` with 404.

- [ ] **Step 5: Verify the API slice and commit**

Run: `pnpm --filter @lets-eat/api test -- catalog`

Run: `pnpm --filter @lets-eat/api lint`

Run: `pnpm --filter @lets-eat/api build`

Expected: all commands exit 0 and the API can serve the manifest/catalog without PostgreSQL.

```bash
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat: serve versioned fixed catalog"
```

---

### Task 4: Replace mock food data with a hash-aware browser catalog cache

**Files:**
- Create: `apps/web/src/entities/catalog/types.ts`
- Create: `apps/web/src/entities/catalog/catalog-cache.ts`
- Create: `apps/web/src/entities/catalog/browser-catalog-cache.ts`
- Create: `apps/web/src/entities/catalog/catalog-repository.ts`
- Create: `apps/web/src/entities/catalog/catalog-repository.test.ts`
- Modify: `apps/web/src/entities/food-choice/types.ts`
- Modify: `apps/web/src/entities/food-choice/repository.ts`
- Modify: `apps/web/src/entities/food-choice/mock-repository.ts`
- Modify: `apps/web/src/features/choose-food/useChooseFood.ts`
- Modify: `apps/web/src/app/App.test.tsx`

**Interfaces:**
- Produces `CatalogRepository.load(datasetType: DatasetType, version?: { catalogVersion: string; catalogHash: string }): Promise<CatalogSelection>`.
- `CatalogSelection` is `{ catalogVersion, catalogHash, datasetType, items }`, with items sorted by `order`.
- Produces `BrowserCatalogCache` that retains at most five versions and deletes metadata unused for more than seven days.

- [ ] **Step 1: Write failing cache/repository tests**

```ts
it('reuses the cached catalog when the manifest hash is unchanged', async () => {
  const selection1 = await repository.load('large');
  const selection2 = await repository.load('large');
  expect(selection2).toEqual(selection1);
  expect(fetchCatalog).toHaveBeenCalledOnce();
});

it('keeps five recent versions and removes entries unused for seven days', async () => {
  await seedSixVersions(cache, now);
  await cache.prune(now + 8 * DAY_MS);
  expect(await cache.keys()).toEqual(['v2', 'v3', 'v4', 'v5', 'v6']);
});

it('returns large and small datasets independently in fixed order', async () => {
  expect((await repository.load('large')).items.map(i => i.id)).toEqual(largeIds);
  expect((await repository.load('small')).items.map(i => i.id)).toEqual(smallIds);
});
```

Run: `pnpm --filter @lets-eat/web test -- catalog-repository`

Expected: FAIL because the catalog repository does not exist.

- [ ] **Step 2: Define the cache boundary and browser implementation**

```ts
export interface CatalogCache {
  getManifest(): Promise<CatalogManifest | null>;
  putManifest(manifest: CatalogManifest): Promise<void>;
  get(version: string, hash: string): Promise<CatalogDocument | null>;
  put(version: string, hash: string, document: CatalogDocument, usedAt: number): Promise<void>;
  touch(version: string, usedAt: number): Promise<void>;
  prune(now: number): Promise<void>;
}
```

Use Cache Storage namespace `lets-eat-catalog-v1` for JSON responses and localStorage key `lets-eat.catalog-meta.v1` for `{ manifest, versions: { version, hash, usedAt }[] }`. Inject `fetch`, cache, clock, and metadata storage so Vitest uses deterministic fakes.

- [ ] **Step 3: Implement manifest-first loading**

`CatalogRepository.load(datasetType, version?)` performs these exact operations:

1. Fetch `/api/catalog/manifest` with `If-None-Match` when a manifest is known.
2. Return cached JSON when version and hash match.
3. Fetch and validate `manifest.catalogUrl` only when no matching cached JSON exists.
4. Persist and prune after successful validation.
5. Filter by `datasetType` and sort by `order`; throw `EMPTY_DATASET` when no items remain.

When `version` is supplied for an existing single or multiplayer round, skip the current-manifest choice and load exactly that immutable version/hash from cache or `/api/catalog/:version`. Reject a hash mismatch with `CATALOG_HASH_MISMATCH`; never silently move an in-progress round to the newest catalog.

Map the old `FoodChoice` presentation type to `CatalogItem` by using `imageUrl` directly; do not retain a second independently maintained DTO.

- [ ] **Step 4: Keep the current single page running on the API catalog**

Change `FoodChoiceRepository.list()` to `list(datasetType: DatasetType)`, use `large` in the transitional current `App`, and adapt `useChooseFood` to preserve server `order` instead of calling `createChoiceRound`. Keep `mockFoodChoiceRepository` only as an injected test fixture until Task 5 removes it from production composition.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @lets-eat/web test`

Run: `pnpm --filter @lets-eat/web build`

Expected: the original swipe screen still renders and both cache tests pass.

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat: load fixed catalog with browser cache"
```

---

### Task 5: Deliver the complete refresh-safe single-player flow

**Files:**
- Create: `apps/web/src/app/AppRouter.tsx`
- Create: `apps/web/src/app/AppRouter.test.tsx`
- Create: `apps/web/src/app/routes.ts`
- Create: `apps/web/src/shared/components/BackButton.tsx`
- Create: `apps/web/src/shared/components/PageShell.tsx`
- Create: `apps/web/src/features/identity/display-name-store.ts`
- Create: `apps/web/src/features/identity/display-name-store.test.ts`
- Create: `apps/web/src/features/single-round/single-round-store.ts`
- Create: `apps/web/src/features/single-round/single-round-store.test.ts`
- Create: `apps/web/src/features/single-round/useSingleRound.ts`
- Create: `apps/web/src/pages/HomePage.tsx`
- Create: `apps/web/src/pages/ModePage.tsx`
- Create: `apps/web/src/pages/DatasetPage.tsx`
- Create: `apps/web/src/pages/GamePage.tsx`
- Create: `apps/web/src/pages/ResultPage.tsx`
- Modify: `apps/web/src/features/choose-food/choose-food-state.ts`
- Modify: `apps/web/src/features/choose-food/choose-food-state.test.ts`
- Modify: `apps/web/src/features/choose-food/components/SwipeDeck.tsx`
- Modify: `apps/web/src/features/choose-food/components/SwipeDeck.test.tsx`
- Modify: `apps/web/src/features/choose-food/components/CompletedRound.tsx`
- Modify: `apps/web/src/features/choose-food/components/CompletedRound.test.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/main.tsx`
- Delete: `apps/web/src/features/choose-food/components/DecisionWheelDialog.tsx`

**Interfaces:**
- Routes: `/`, `/mode`, `/single/dataset`, `/game/single`, `/result/single`.
- Produces `SingleRoundStore.load/save/clear` under localStorage key `lets-eat.single-round.v1`.
- `SwipeDeck` exposes only `onDislike`, `onLike`, `onUndo`, and `onInteractionLockChange` actions.

- [ ] **Step 1: Write failing navigation and product-rule tests**

```tsx
it('runs home → mode → dataset → game → result', async () => {
  renderTestApp('/');
  expect(screen.queryByRole('button', { name: /返回/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '开始游戏' }));
  await user.click(screen.getByRole('button', { name: '单人游戏' }));
  expect(screen.getByRole('button', { name: /大类菜品.*10 条/ })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /大类菜品/ }));
  expect(await screen.findByText('滑动选菜器')).toBeInTheDocument();
});

it('contains no superlike, upward swipe, people-like count, or wheel action', async () => {
  renderGame();
  expect(screen.queryByText(/强推|必吃超赞|2人想吃|摇号/)).not.toBeInTheDocument();
  expect(screen.queryByTitle(/强推|摇号/)).not.toBeInTheDocument();
});
```

Run: `pnpm --filter @lets-eat/web test -- AppRouter SwipeDeck`

Expected: FAIL on missing routes and obsolete controls still present.

- [ ] **Step 2: Make the swipe reducer strictly binary**

Replace history actions with:

```ts
type ChoiceDecision = 'liked' | 'disliked';
type ChoiceHistory = { choice: CatalogItem; decision: ChoiceDecision };
```

Remove `selected`, `select`, `superlike`, and random restart branches. `undo` removes the final history record, restores its card index, and removes the item from `likedChoices` only when that record was `liked`. Keep animation locking unchanged.

- [ ] **Step 3: Remove upward motion and extra controls without changing horizontal feel**

Keep `x`, ±22° rotation, horizontal thresholds `80px`/`250px/s`, 220ms exit timing, stacked next card, and spring reset. Remove the `y` motion value, upward threshold, star overlay/button, dice button, `onSuperlike`, and `onOpenDecision`. Rename visible copy to exactly `不喜欢` and `喜欢` while retaining accessible titles `不喜欢` and `喜欢`.

- [ ] **Step 4: Implement identity and single-round persistence**

```ts
export interface SingleRoundSession {
  catalogVersion: string;
  catalogHash: string;
  datasetType: DatasetType;
  itemIds: string[];
  decisions: Record<string, Decision>;
  history: string[];
  completedAt: string | null;
}
```

Generate default display names as `形容词 + 食物 + 四位数字`, store edits at `lets-eat.display-name.v1`, trim on submit, and reject empty names with `请输入用户名`. Persist the single session after every decision/undo; on refresh, verify catalog version/hash and resume at the first item without a decision. A completed session routes to `/result/single`.

- [ ] **Step 5: Compose the five single-player routes**

Use React Router. `HomePage` has logo, editable username, and `开始游戏`; `ModePage` has back plus single/group buttons; `DatasetPage` reads live catalog counts and offers large/small plus disabled `周围菜品` feedback; `GamePage` has no standard back button and composes the preserved deck; `ResultPage` has a back action, selected-item summary/list dialog, empty-result copy, and returns to `/mode` after clearing the completed session.

Clicking `组队游戏` at this stage shows `组队功能正在连接中` and remains on `/mode`; Task 11 replaces that staged gate with room creation. The already complete single-player product remains runnable throughout.

- [ ] **Step 6: Verify refresh recovery, binary interaction, and commit**

Run: `pnpm --filter @lets-eat/web test`

Run: `pnpm --filter @lets-eat/web lint`

Run: `pnpm --filter @lets-eat/web build`

Expected: all commands pass; no production import references `DecisionWheelDialog`, `superlike`, or `createChoiceRound`.

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat: add refresh-safe single player flow"
```

---

### Task 6: Add PostgreSQL schema, stateless anonymous auth, and health checks

**Files:**
- Create: `compose.yaml`
- Create: `.env.example`
- Modify: `.gitignore`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/config/env.test.ts`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/src/db/migrate.ts`
- Create: `apps/api/drizzle/0000_initial.sql`
- Create: `apps/api/drizzle/meta/_journal.json`
- Create: `apps/api/src/auth/token-service.ts`
- Create: `apps/api/src/auth/auth-middleware.ts`
- Create: `apps/api/src/auth/auth-routes.ts`
- Create: `apps/api/src/auth/auth-routes.test.ts`
- Create: `apps/api/src/operations/health-routes.ts`
- Create: `apps/api/src/operations/health-routes.test.ts`
- Create: `apps/api/src/test/database.ts`
- Create: `apps/api/src/test/app-factory.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `package.json`

**Interfaces:**
- Produces Drizzle tables `rooms`, `roomMembers`, `rounds`, `roundMembers`, `decisions`, `idempotencyRecords` matching the technical design.
- Produces `TokenService.issue(userId): Promise<{ token, expiresAt }>` and `TokenService.verify(token): Promise<{ userId }>`.
- Exposes `POST /api/auth/anonymous`, `/health/live`, and `/health/ready`.

- [ ] **Step 1: Start the isolated test PostgreSQL and write failing integration tests**

Add `postgres` and `postgres-test` services to the one `compose.yaml`; place `postgres-test` behind profile `test`, bind it to port `55432`, and give it a separate named volume.

Add root commands `db:up: "docker compose up -d postgres"` and `db:test:up: "docker compose --profile test up -d postgres-test"`.

Run: `docker compose --profile test up -d postgres-test`

Write tests asserting:

```ts
it('issues a 180-day stateless token without inserting login state', async () => {
  const before = await countAllBusinessRows(db);
  const response = await request(app).post('/api/auth/anonymous').expect(201);
  expect(await tokenService.verify(response.body.token)).toEqual({ userId: response.body.userId });
  expect(await countAllBusinessRows(db)).toEqual(before);
});

it('reports not-ready when the database cannot be queried', async () => {
  await brokenApp.get('/health/ready').expect(503, { status: 'not-ready' });
});
```

Run: `TEST_DATABASE_URL=postgresql://lets_eat_test:lets_eat_test@localhost:55432/lets_eat_test pnpm --filter @lets-eat/api test -- auth health`

Expected: FAIL because schema/auth/health are absent.

- [ ] **Step 2: Define and migrate the complete schema once**

Use UUID primary keys, timestamptz columns, foreign keys with cascade behavior, unique `rooms.code`, global unique `room_members.user_id`, unique `(room_id,user_id)`, unique `(round_id,room_member_id,catalog_item_id)`, and unique `(actor_user_id,scope,key)`. The global user constraint enforces “one user in at most one unclosed room” because closed rooms are physically deleted. `idempotency_records` also stores `request_hash` so one key cannot be reused with different input. Store statuses as PostgreSQL enums and `rounds.result_snapshot` as nullable JSONB. Default `rooms.selected_dataset` to `large`, statuses to `waiting`/`playing`, revisions to 0, and update timestamps in transaction code rather than database triggers.

The test harness creates a pool against `TEST_DATABASE_URL`, runs the real migration, and truncates all six tables with identity reset between tests.

- [ ] **Step 3: Validate environment and reject unsafe production defaults**

```ts
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  WEB_ORIGINS: z.string().min(1),
  TRUST_PROXY: z.string().default('loopback'),
  CATALOG_VERSION: z.string().regex(/^v[1-9]\d*$/).default('v1'),
});
```

When `NODE_ENV=production`, reject the sample JWT secret and sample PostgreSQL password in `.env.example`. The server reads configuration only through this parsed object.

- [ ] **Step 4: Implement HMAC JWT identity**

Use JOSE `SignJWT`/`jwtVerify` with `HS256`, issuer `lets-eat-api`, audience `lets-eat-client`, subject UUID, and `180d` expiration. `POST /api/auth/anonymous` creates a UUID and token only; it performs no database write. `requireAuth` reads `Authorization: Bearer`, verifies the token, and attaches only `userId` to the request context.

- [ ] **Step 5: Implement liveness and migration-aware readiness**

`/health/live` always returns `{ status: 'ok' }` while Express is serving. `/health/ready` executes `select 1` and confirms Drizzle’s migration journal contains the expected latest migration; failure returns 503 without stack traces.

- [ ] **Step 6: Verify real migrations/auth/health and commit**

Run: `TEST_DATABASE_URL=postgresql://lets_eat_test:lets_eat_test@localhost:55432/lets_eat_test pnpm --filter @lets-eat/api test -- auth health`

Run: `pnpm --filter @lets-eat/api build`

```bash
git add compose.yaml .env.example .gitignore apps/api package.json pnpm-lock.yaml
git commit -m "feat: add database and anonymous identity foundation"
```

---

### Task 7: Implement the waiting-room lifecycle and optimistic revision control

**Files:**
- Create: `apps/api/src/rooms/room-service.ts`
- Create: `apps/api/src/rooms/room-routes.ts`
- Create: `apps/api/src/rooms/room-presenter.ts`
- Create: `apps/api/src/rooms/room-service.test.ts`
- Create: `apps/api/src/rooms/room-routes.test.ts`
- Create: `apps/api/src/idempotency/idempotency-service.ts`
- Create: `apps/api/src/idempotency/idempotency-service.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces authenticated routes for `GET /api/me/room`, room create/join/read/dataset/leave/delete.
- `RoomService` methods return `RoomSnapshot` and update `lastActivityAt` only for successful business writes.
- Create-room responses are replayed by `(actorUserId, 'room:create', Idempotency-Key)`.

- [ ] **Step 1: Write failing room lifecycle integration tests**

Cover these named tests with real PostgreSQL:

```ts
it('creates a waiting room with an 8-digit code, host member, large dataset, and revision 0');
it('joins up to eight members and rejects the ninth with ROOM_FULL');
it('rejects joining while target room is playing or results');
it('returns ROOM_REVISION_CONFLICT and the latest snapshot for stale dataset changes');
it('lets a guest leave but only the host delete the room');
it('replays room creation for the same Idempotency-Key');
it('atomically replaces a host room only after the target code is valid');
it('does not change lastActivityAt on GET /api/me/room or GET /api/rooms/:roomId');
```

Run: `pnpm --filter @lets-eat/api test -- room`

Expected: FAIL because routes/services do not exist.

- [ ] **Step 2: Implement room creation and eight-digit collision retry**

Generate a cryptographically random integer from `1000` through `9999`, try insertion up to 10 times on unique conflict, then return `ROOM_CODE_EXHAUSTED` with 409. In one transaction create the room and host member; before creation, automatically switch users already present in another room.

- [ ] **Step 3: Implement join, replace-current, and membership limits transactionally**

Lock the target room and current members. Validate `waiting` and count `< 8`. Validate the target first, then lock both current and target room IDs in lexical order, automatically remove the caller from a guest-owned current room or delete a host-owned current room, and join the target in the same transaction. Invalid target code/status leaves the current room unchanged.

- [ ] **Step 4: Implement reads, dataset revision, guest leave, and host close**

`PATCH /dataset` requires host role, room `waiting`, and exact `expectedRevision`; success increments room revision once. Guest leave deletes its member row. Host `DELETE` cascades the room. Reject host removal through guest leave with `HOST_MUST_CLOSE_ROOM`. Present members ordered host first then `joinedAt`, and never include decisions.

- [ ] **Step 5: Add create-room idempotency storage**

Within the command transaction, insert an `idempotency_records` row with 24-hour expiry. A duplicate actor/scope/key returns the stored HTTP status/body; the same key with a different normalized request hash returns `IDEMPOTENCY_KEY_REUSED` with 409.

- [ ] **Step 6: Verify room recovery and commit**

Run: `pnpm --filter @lets-eat/api test -- room idempotency`

Run: `pnpm --filter @lets-eat/api lint`

```bash
git add apps/api
git commit -m "feat: add revision-safe waiting rooms"
```

---

### Task 8: Start locked multiplayer rounds and persist private decisions

**Files:**
- Create: `apps/api/src/rounds/round-service.ts`
- Create: `apps/api/src/rounds/round-routes.ts`
- Create: `apps/api/src/rounds/round-presenter.ts`
- Create: `apps/api/src/rounds/round-service.test.ts`
- Create: `apps/api/src/rounds/round-routes.test.ts`
- Modify: `apps/api/src/catalog/catalog-service.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Adds start/read/put-decision/delete-decision routes.
- `GET /api/rounds/:roundId` returns public member progress plus only the caller’s `ownDecisions`.
- Start-round is idempotent and locks catalog version, hash, dataset, item order, and current membership.

- [ ] **Step 1: Write failing round/decision privacy tests**

```ts
it('starts once with the room dataset, current catalog hash, and member snapshot');
it('returns the first start response for a repeated Idempotency-Key');
it('rejects stale room revision and simultaneous second starts');
it('upserts liked/disliked by round-member-item without changing round revision');
it('deletes only the caller own decision for undo');
it('never returns another member decisions to host or guest');
it('rejects catalog item IDs outside the round dataset');
```

Run: `pnpm --filter @lets-eat/api test -- round-service round-routes`

Expected: FAIL because no round routes exist.

- [ ] **Step 2: Start a round in one locked transaction**

Lock the room row `FOR UPDATE`, verify host/status/revision, lock ordered members, and require 1–8 members. Read `CatalogService.getCurrentSelection(selectedDataset)`, create the round with sequence `max + 1`, insert one `round_members` row per member, update room to `playing` with `currentRoundId`, and increment room revision. Store/replay the response under idempotency scope `round:start:<roomId>`.

- [ ] **Step 3: Present a caller-scoped round snapshot**

Verify the caller belongs to the room or locked round snapshot. Return all round-member display names/statuses but query decisions with `room_member_id = callerMemberId` only. The SQL used by the presenter must not load other decision rows and filter them afterward.

- [ ] **Step 4: Implement idempotent decision upsert/delete**

`PUT` validates the caller is `choosing`, item belongs to the locked catalog dataset, and upserts `(roundId, memberId, catalogItemId)`. `DELETE` removes that exact composite row. Both update room `lastActivityAt`, do not increment global room/round revision, and return 204. A retry produces the same final row state.

- [ ] **Step 5: Verify start races and decision privacy, then commit**

Run: `pnpm --filter @lets-eat/api test -- round`

Expected: concurrent start test creates exactly one round and all privacy assertions pass.

```bash
git add apps/api
git commit -m "feat: persist private multiplayer decisions"
```

---

### Task 9: Complete rounds, remove stalled members, and freeze anonymous results

**Files:**
- Create: `apps/api/src/rounds/result-aggregator.ts`
- Create: `apps/api/src/rounds/result-aggregator.test.ts`
- Create: `apps/api/src/rounds/round-completion.test.ts`
- Modify: `apps/api/src/rounds/round-service.ts`
- Modify: `apps/api/src/rounds/round-routes.ts`
- Modify: `apps/api/src/rooms/room-service.ts`

**Interfaces:**
- Adds complete, remove-member, result, and open-next-round routes.
- Produces immutable `RoundResult` JSON stored in `rounds.resultSnapshot`.
- Guest exit during play is remove-from-round plus member deletion in one transaction.

- [ ] **Step 1: Write failing completion/result lifecycle tests**

```ts
it('returns 422 until the caller has exactly one decision per dataset item');
it('moves a completed member to waiting while another member is choosing');
it('freezes sorted anonymous counts when the last active member completes');
it('returns an empty item array when nobody liked an item');
it('allows only the host to remove an unfinished guest and deletes guest round decisions');
it('forbids the host from removing self');
it('auto-completes when removal or guest exit leaves all active members completed');
it('keeps the frozen result unchanged after a member leaves');
it('rejects joins in results and permits them after host opens the next round');
```

Run: `pnpm --filter @lets-eat/api test -- round-completion result-aggregator`

Expected: FAIL on absent completion behavior.

- [ ] **Step 2: Implement deterministic anonymous aggregation**

```ts
export function aggregateResult(
  items: readonly CatalogItem[],
  likedItemIds: readonly string[],
): ResultItem[] {
  const counts = new Map<string, number>();
  for (const id of likedItemIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return items
    .flatMap(item => counts.has(item.id)
      ? [{ catalogItemId: item.id, likeCount: counts.get(item.id)!, order: item.order }]
      : [])
    .sort((a, b) => b.likeCount - a.likeCount || a.order - b.order);
}
```

Never include user IDs or display names in the snapshot.

- [ ] **Step 3: Complete members and the final round transactionally**

Lock round and caller membership, compare `expectedRoundRevision`, and verify decision count equals locked dataset count. Mark caller completed and increment round revision. If no `choosing` members remain, compute/store snapshot, set round `completed`, set room `results`, and increment both revisions. Store/replay under `round:complete:<roundId>`.

- [ ] **Step 4: Implement host removal and in-round guest exit**

Host removal is allowed only for another `choosing` member. Delete that member’s round decisions, mark `removed`, set completion timestamp, increment round revision, and run the same finalization check. Guest room leave while playing performs that removal and deletes `room_members` in one transaction. Preserve completed snapshot after all later exits.

- [ ] **Step 5: Implement result reads and next-round opening**

Result reads require round membership or current room membership and return only the stored snapshot. `open-next-round` requires host, room `results`, exact room revision, and completed current round; it sets room to `waiting`, clears `currentRoundId`, and increments room revision without deleting the prior round.

- [ ] **Step 6: Verify the full HTTP multiplayer domain and commit**

Run: `pnpm --filter @lets-eat/api test`

Expected: lifecycle, concurrency, privacy, stable snapshot, and empty result tests all pass against real PostgreSQL.

```bash
git add apps/api
git commit -m "feat: complete rounds with anonymous results"
```

---

### Task 10: Add authenticated WebSocket invalidation and revision recovery

**Files:**
- Create: `apps/api/src/realtime/realtime-hub.ts`
- Create: `apps/api/src/realtime/websocket-server.ts`
- Create: `apps/api/src/realtime/websocket-server.test.ts`
- Create: `apps/api/src/realtime/realtime-events.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/rooms/room-service.ts`
- Modify: `apps/api/src/rounds/round-service.ts`
- Create: `apps/web/src/features/multiplayer/realtime-client.ts`
- Create: `apps/web/src/features/multiplayer/realtime-client.test.ts`

**Interfaces:**
- Produces `RealtimeHub.publish(event: ServerEvent): void` after committed commands.
- Produces browser `RealtimeClient.connect({ token, roomId, revisions, onStale }): () => void` with capped exponential reconnect.
- Events never contain individual decisions.

- [ ] **Step 1: Write failing server/client realtime tests**

```ts
it('closes a socket that does not authenticate within five seconds');
it('rejects a token whose user is not a room member');
it('notifies room members after commit and never includes decisions');
it('ignores events whose room and round revisions are not newer');
it('refetches unconditionally after reconnect and caps delay at ten seconds');
```

Run: `pnpm --filter @lets-eat/api test -- websocket-server`

Run: `pnpm --filter @lets-eat/web test -- realtime-client`

Expected: FAIL because realtime modules are absent.

- [ ] **Step 2: Attach `ws` to the existing HTTP server**

Accept upgrades only for `/ws`. Require the first message to pass `ClientAuthMessageSchema` within 5 seconds, verify JWT and room membership, then register the socket by room ID. Send ping every 25 seconds, require pong within the next interval, and close dead connections. Remove sockets on close/error.

- [ ] **Step 3: Publish only post-commit invalidation events**

Services return a committed event description to their route handlers; handlers call `RealtimeHub.publish` only after the transaction promise resolves. Map commands to `room.updated`, `round.started`, `member.progressed`, `round.completed`, and `room.closed`. Generate UUID `eventId`, ISO `occurredAt`, and current revisions. Do not add an outbox.

- [ ] **Step 4: Implement revision-aware browser reconnection**

Authenticate after open, parse with `ServerEventSchema`, ignore old envelopes, and call `onStale({ room: boolean, round: boolean, reconnected: boolean })`. Reconnect delays are 500ms, 1s, 2s, 4s, 8s, then 10s; reset after a successful authenticated connection. On every reconnect, set all three flags true so the caller refetches room and round regardless of event history.

- [ ] **Step 5: Verify realtime behavior and commit**

Run: `pnpm --filter @lets-eat/api test -- websocket-server room round`

Run: `pnpm --filter @lets-eat/web test -- realtime-client`

```bash
git add apps/api apps/web package.json pnpm-lock.yaml
git commit -m "feat: add realtime room invalidation"
```

---

### Task 11: Build host/guest room pages and refresh recovery

**Files:**
- Create: `apps/web/src/shared/http/api-client.ts`
- Create: `apps/web/src/shared/http/api-client.test.ts`
- Create: `apps/web/src/features/identity/anonymous-identity.ts`
- Create: `apps/web/src/features/identity/anonymous-identity.test.ts`
- Create: `apps/web/src/entities/room/room-client.ts`
- Create: `apps/web/src/entities/room/room-client.test.ts`
- Create: `apps/web/src/features/multiplayer/useRoom.ts`
- Create: `apps/web/src/pages/RoomPage.tsx`
- Create: `apps/web/src/pages/RoomPage.test.tsx`
- Create: `apps/web/src/pages/JoinRoomDialog.tsx`
- Create: `apps/web/src/pages/JoinRoomDialog.test.tsx`
- Modify: `apps/web/src/pages/ModePage.tsx`
- Modify: `apps/web/src/app/AppRouter.tsx`

**Interfaces:**
- Adds `/room/:roomId` and restores current room using `GET /api/me/room`.
- Persists token under `lets-eat.anonymous-token.v1`; a 401 clears it and obtains one replacement identity.
- `useRoom` owns HTTP snapshot + realtime invalidation; presentational pages receive validated contract objects.

- [ ] **Step 1: Write failing host/guest/recovery UI tests**

```tsx
it('creates a host room from group mode with large selected by default');
it('shows dataset controls and start only to the host');
it('shows dataset read-only and 待房主开始 to a guest');
it('validates exactly eight digits before joining');
it('cancels join without changing the current host room');
it('confirms before host close or guest exit');
it('restores /room/:id after refresh from GET /api/me/room');
it('refetches when a newer websocket revision arrives');
```

Run: `pnpm --filter @lets-eat/web test -- RoomPage JoinRoomDialog`

Expected: FAIL because room UI is absent.

- [ ] **Step 2: Implement the authenticated API client and anonymous identity**

`ApiClient.request(schema, path, options)` adds bearer token, `X-Request-Id`, optional `Idempotency-Key`, parses success with the supplied Zod schema, and throws typed `ApiClientError` from `ApiErrorSchema`. Anonymous identity is created once, stored with `expiresAt`, and refreshed only when absent/expired or after a 401.

- [ ] **Step 3: Implement host and guest room composition**

The shared `RoomPage` branches on `room.hostUserId === identity.userId`. Host sees room code, large/small controls, disabled nearby feedback, join button, start button, and members. Guest sees room code, readonly dataset, exit, `待房主开始`, and members marked `房主`/`我`. Every room write sends the current revision and replaces local state with the validated response.

- [ ] **Step 4: Implement safe join replacement and return confirmation**

The dialog accepts only `/^\d{8}$/`. Joining another room automatically switches away from the current room after target validation; server atomicity prevents losing the current room on invalid target. Confirmed host back/delete closes the room and navigates `/mode`; confirmed guest back/exit leaves and navigates `/mode`. Cancel keeps route and room unchanged.

- [ ] **Step 5: Add start/realtime route transitions and refresh recovery**

Host start generates an idempotency key, sends current room revision, and routes to `/game/round/:roundId`. A `round.started` refetch routes guests to the same path. App startup calls `/api/me/room`: waiting routes to room, playing routes to game, results routes to result. A 404 at a stale room URL returns to `/mode` with `房间已关闭或过期`.

- [ ] **Step 6: Verify the waiting-room slice and commit**

Run: `pnpm --filter @lets-eat/web test`

Run: `pnpm --filter @lets-eat/web build`

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat: add recoverable multiplayer rooms"
```

---

### Task 12: Add a durable serial decision queue and multiplayer game controller

**Files:**
- Create: `apps/web/src/features/multiplayer/decision-queue.ts`
- Create: `apps/web/src/features/multiplayer/indexeddb-decision-store.ts`
- Create: `apps/web/src/features/multiplayer/decision-queue.test.ts`
- Create: `apps/web/src/features/multiplayer/useMultiplayerRound.ts`
- Create: `apps/web/src/features/multiplayer/useMultiplayerRound.test.tsx`
- Modify: `apps/web/src/pages/GamePage.tsx`
- Modify: `apps/web/src/features/choose-food/components/SwipeDeck.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces `DecisionQueue.enqueuePut`, `enqueueDelete`, `flush`, `isIdle`, and `subscribe` backed by IndexedDB.
- `useMultiplayerRound(roundId)` merges server-confirmed decisions with pending operations and resumes at the first undecided item.
- Completion is disabled until all catalog items have effective decisions and the queue is empty.

- [ ] **Step 1: Write failing queue ordering/recovery tests**

```ts
it('sends one operation at a time in persisted sequence order');
it('keeps an unacknowledged put after network failure and retries it');
it('places undo delete after its put so a late put cannot win');
it('merges server decisions with pending local operations after refresh');
it('does not call complete until the queue is empty and every item is decided');
```

Run: `pnpm --filter @lets-eat/web test -- decision-queue useMultiplayerRound`

Expected: FAIL because the queue/controller do not exist.

- [ ] **Step 2: Implement the IndexedDB operation store**

Use the maintained `idb` package. Database `lets-eat-multiplayer-v1` contains object store `operations` with auto-increment `sequence` and index `roundId`. Persist this shape:

```ts
export interface QueuedDecisionOperation {
  sequence?: number;
  roundId: string;
  catalogItemId: string;
  operation: 'put' | 'delete';
  decision?: Decision;
  createdAt: number;
}
```

`put` requires `decision`; `delete` forbids it. Remove an operation only after a 2xx response. Stop flushing on network/5xx; surface 401/403/404/409 as terminal round errors.

- [ ] **Step 3: Implement serial queue processing and effective-state replay**

Sort by sequence, await each HTTP operation, and notify subscribers after enqueue/ack/error. Rebuild effective decisions by starting with `RoundSnapshot.ownDecisions` then replaying local operations in order. Keep explicit `liked` and `disliked`; first undecided is the lowest catalog `order` absent from the map.

- [ ] **Step 4: Compose multiplayer game behavior with the preserved deck**

`GamePage` chooses single or multiplayer controller from the route. Multiplayer like/dislike updates local effective state immediately and enqueues a PUT. Undo enqueues DELETE for the previous card. After the final card, show `正在同步选择…` until queue idle; then call complete once with idempotency key and current round revision. No back button, random wheel, superlike, or member-like copy appears.

- [ ] **Step 5: Recover after refresh and reconnect**

Load round snapshot and locked catalog version/hash, verify the cached catalog hash, replay pending IndexedDB operations, resume flushing, and refetch after realtime reconnect. If the caller is already completed, route to wait or result based on round status.

- [ ] **Step 6: Verify offline recovery and commit**

Run: `pnpm --filter @lets-eat/web test -- decision-queue useMultiplayerRound GamePage`

Run: `pnpm --filter @lets-eat/web lint`

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat: add durable multiplayer selection queue"
```

---

### Task 13: Build waiting and result pages for single and multiplayer rounds

**Files:**
- Create: `apps/web/src/pages/WaitingPage.tsx`
- Create: `apps/web/src/pages/WaitingPage.test.tsx`
- Modify: `apps/web/src/pages/ResultPage.tsx`
- Create: `apps/web/src/pages/ResultPage.test.tsx`
- Modify: `apps/web/src/features/choose-food/components/CandidateListDialog.tsx`
- Modify: `apps/web/src/app/AppRouter.tsx`
- Modify: `apps/web/src/pages/RoomPage.tsx`

**Interfaces:**
- Adds `/round/:roundId/wait` and `/round/:roundId/result`.
- Waiting progress derives only from public member statuses.
- Multiplayer result joins anonymous `ResultItem` rows with the locked catalog locally; it never receives voter identities.

- [ ] **Step 1: Write failing waiting/result tests**

```tsx
it('shows 等待其他小伙伴, completed count, all member statuses, and self marker');
it('shows 移出本轮 only to the host and never for the host row');
it('keeps completed decisions when returning from wait to the room');
it('auto-routes to result on round.completed');
it('sorts multiplayer result by server snapshot and shows like counts only');
it('shows an empty result without any random action');
it('returns single result to mode and multiplayer result to room');
```

Run: `pnpm --filter @lets-eat/web test -- WaitingPage ResultPage`

Expected: FAIL because multiplayer states are not rendered.

- [ ] **Step 2: Implement the waiting page and host removal**

Render a standard back button and `返回房间`, both routing to the current room without clearing submitted decisions. Show `完成数 / 有效总数 人已完成`; list `已完成`, `选择中`, and `已移出本轮`. Host remove sends current round revision, asks for confirmation, refetches on success/conflict, and cannot target self.

- [ ] **Step 3: Implement single and multiplayer result branches**

Single result reads local liked IDs and displays the candidate dialog. Multiplayer fetches only `RoundResult`, loads its locked catalog, joins by item ID, and shows `N 人喜欢`; no member names are rendered. Empty list shows `这一轮大家都没有选中菜品`. Neither branch contains wheel/shake/random actions.

- [ ] **Step 4: Complete room next-round behavior**

From multiplayer result, guest `返回房间` shows readonly results-state room. Host sees `开放下一轮`; calling it with room revision returns waiting state, permits dataset edits/new joins, and routes to `/room/:roomId`. Do not silently open a round on navigation alone.

- [ ] **Step 5: Verify all confirmed pages and commit**

Run: `pnpm --filter @lets-eat/web test`

Run: `pnpm --filter @lets-eat/web build`

Expected: all nine pages/states are reachable and obsolete feature copy is absent.

```bash
git add apps/web
git commit -m "feat: add multiplayer waiting and result flow"
```

---

### Task 14: Add expiry cleanup, security controls, structured logs, Docker, and backups

**Files:**
- Create: `apps/api/src/operations/cleanup.ts`
- Create: `apps/api/src/operations/cleanup.test.ts`
- Create: `apps/api/src/operations/security.ts`
- Create: `apps/api/src/operations/logger.ts`
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `infra/nginx/default.conf`
- Create: `infra/backup/backup.sh`
- Create: `infra/backup/backup.test.sh`
- Modify: `compose.yaml`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- Produces `runCleanup(db, now): Promise<{ roomsDeleted, idempotencyDeleted }>`.
- Full Compose exposes Web only, proxies `/api` and `/ws`, persists PostgreSQL, retains seven successful dumps, and optionally starts `cloudflared` with profile `tunnel`.
- API logs structured request/room/round/event metadata while redacting authorization and decision bodies.

- [ ] **Step 1: Write failing cleanup, rate-limit, logging-redaction, and backup tests**

```ts
it('deletes rooms older than 24 hours by business activity and leaves recently written rooms');
it('deletes expired idempotency rows in the same cleanup run');
it('does not extend room lifetime through reads or websocket heartbeat');
it('rate-limits anonymous issuance and room-code join attempts with 429');
it('never logs Authorization or decision request bodies');
```

`infra/backup/backup.test.sh` must create eight fake successful dump filenames, run the retention function, assert seven remain, simulate a failed dump, and assert the prior seven still remain.

Run: `pnpm --filter @lets-eat/api test -- cleanup security logger`

Run: `sh infra/backup/backup.test.sh`

Expected: FAIL before operations/deployment files exist.

- [ ] **Step 2: Implement cleanup scheduling without changing read activity**

Delete rooms where `lastActivityAt < now - 24h` and expired idempotency records in transactions. Run once after readiness and every 15 minutes while the API is alive; stop the interval during graceful shutdown. Keep business-write timestamp updates only in room/round services.

- [ ] **Step 3: Harden Express and logs**

Add Helmet, CORS allowlist from `WEB_ORIGINS`, trusted proxy from validated env, 32KB JSON limit, Zod request parsing, and `express-rate-limit`: anonymous auth 20 attempts per 15 minutes per client IP; room join 30 attempts per 15 minutes per client IP. Accept an incoming `X-Request-Id` only when it matches `/^[A-Za-z0-9._:-]{1,128}$/`; otherwise generate a UUID, and echo the chosen value in the response header. Use Pino JSON logs with request ID, user/room/round IDs, route, status, duration, and event type; redact `req.headers.authorization`, token fields, and request bodies for decision routes.

- [ ] **Step 4: Build portable API and Web images**

Use multi-stage `node:22-alpine` builds with Corepack preparing pnpm 10.16.1 so patch-level security updates stay available; build contracts before API/Web. API runtime uses `node dist/server.js`, includes `drizzle/` and `catalog/`, runs as a non-root user, and exposes 3001. Web runtime uses `nginx:alpine`, serves the SPA, falls back to `index.html`, proxies `/api` HTTP and `/ws` Upgrade to API, and exposes 80. Do not include `.env` or development dependencies in runtime layers.

- [ ] **Step 5: Complete the single Compose topology**

Define `web`, `api`, `postgres`, `backup`, `postgres-test`, and `cloudflared`. Use named production/test database volumes, health-based dependencies, restart policies, and no host exposure for production API/PostgreSQL. `cloudflared` uses only `CLOUDFLARE_TUNNEL_TOKEN` and profile `tunnel`. Daily host development remains `docker compose up -d postgres`, `pnpm dev:api`, and `pnpm dev:web`.

- [ ] **Step 6: Implement atomic daily backups with seven-file retention**

`backup.sh` writes `*.partial`, runs `pg_dump --format=custom`, renames only after exit 0, then sorts successful `*.dump` files newest-first and deletes files after the seventh. On failure, remove only the partial file, emit an error, and leave all successful dumps. The backup service repeats every 24 hours and writes to bind-mounted `./backups`, which is gitignored.

- [ ] **Step 7: Verify production-like containers and commit**

Run: `pnpm test`

Run: `docker compose config`

Run: `docker compose build web api`

Run: `sh infra/backup/backup.test.sh`

Expected: config validates, images build on the current architecture, and backup failure does not delete the last good dump.

```bash
git add apps/api apps/web infra compose.yaml .env.example .gitignore package.json pnpm-lock.yaml
git commit -m "feat: package secure deployable multiplayer stack"
```

---

### Task 15: Prove the end-to-end flows, tunnel setup, and restore procedure

**Files:**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/helpers.ts`
- Create: `e2e/single-player.spec.ts`
- Create: `e2e/multiplayer.spec.ts`
- Create: `docs/runbooks/local-development.md`
- Create: `docs/runbooks/cloudflare-tunnel.md`
- Create: `docs/runbooks/backup-restore.md`
- Modify: `README.md`
- Modify: `apps/web/README.md`
- Modify: `package.json`

**Interfaces:**
- Produces repeatable Playwright proof using two isolated browser contexts.
- Documents host-run hot reload, full Compose, optional Tunnel, and tested backup restoration without changing application protocol.

Add root development dependency `@playwright/test` and command `e2e: "playwright test -c e2e/playwright.config.ts"` in the same commit that first uses them.

- [ ] **Step 1: Write the end-to-end tests before final fixes**

`single-player.spec.ts` must assert username validation, dataset counts, fixed card order, like/dislike/undo, refresh continuation, empty result, liked result, and no superlike/wheel/people-count copy.

`multiplayer.spec.ts` must use separate host/guest contexts and assert:

```text
create room → join by 8-digit code → host switches dataset → guest sees update
→ host starts → both see same version/order → each submits private decisions
→ first finisher waits → second finishes → both see identical anonymous result
→ member leaves → frozen result remains → host opens next round → joining works again
```

Add separate cases for full room, join rejected during play/results, stale revision 409 recovery, refresh recovery, WebSocket disconnect/reconnect, offline queued decision retry, host removing a stalled guest, and all-disliked empty result.

- [ ] **Step 2: Run Playwright and fix only observed integration gaps**

Run: `docker compose --profile test up -d postgres-test`

Run: `pnpm --filter @lets-eat/api db:migrate:test`

Run: `pnpm e2e`

Expected: all single- and two-context tests pass against real API/PostgreSQL/WebSocket services.

- [ ] **Step 3: Document exact local and full-stack commands**

`local-development.md` includes Node.js 22.14+, pnpm 10.16.1, Docker prerequisites and these three daily terminals:

```bash
docker compose up -d postgres
pnpm dev:api
pnpm dev:web
```

Also document `.env.example` copying, migration, test DB, full `docker compose up -d`, logs, and shutdown. `cloudflare-tunnel.md` documents setting the token, `docker compose --profile tunnel up -d`, HTTPS/WSS verification from phone, and allowed Web origin. No Cloudflare-specific value appears in business configuration.

- [ ] **Step 4: Test and document restore**

Create a room/round fixture, run a successful dump, restore into an empty PostgreSQL database, run migrations/readiness, and assert room/round/result snapshot rows match. `backup-restore.md` records stop-writes → final dump → restore → migration/readiness check → DNS/tunnel switch, with exact `pg_restore --clean --if-exists --no-owner` command.

- [ ] **Step 5: Run the complete release gate**

Run: `pnpm test`

Run: `pnpm lint`

Run: `pnpm build`

Run: `pnpm e2e`

Run: `docker compose config`

Run: `git diff --check`

Run: `rg -n "强推|superlike|必吃超赞|摇号|2人想吃|菜品设置|新增菜品|编辑菜品" apps packages e2e`

Expected: all automated commands pass; the final ripgrep has no production UI/protocol matches (test assertions that verify absence may remain).

- [ ] **Step 6: Perform real-device acceptance through Cloudflare Tunnel**

On one phone and one computer, verify create/join, dataset update, start, independent swipes, one-device refresh, a short network interruption, waiting progress, stable anonymous result, return to room, and next round. Confirm API logs show request IDs/revisions but no tokens or individual choices.

- [ ] **Step 7: Commit the verified release slice**

```bash
git add e2e docs/runbooks README.md apps/web/README.md
git commit -m "test: verify end-to-end food game MVP"
```

---

## Final Acceptance Checklist

- [ ] The current swipe animation and card-stack appearance remain recognizable; only obsolete controls/copy are removed.
- [ ] The nine confirmed pages/states and both single/multiplayer loops work from clean browser storage.
- [ ] Refresh resumes home identity, waiting room, in-progress single round, in-progress multiplayer round, waiting, and result state correctly.
- [ ] Host and guest devices receive invalidation in realtime and recover from missed events through HTTP refetch.
- [ ] A caller cannot retrieve another member’s decisions through any HTTP or WebSocket response.
- [ ] Repeated/reordered client operations cannot create duplicate rooms/rounds, regress a decision after undo, or alter a frozen result.
- [ ] Room expiry uses business writes only; host close cascades business rows but never deletes the public catalog.
- [ ] `docker compose up` serves the complete system, `docker compose up -d postgres` supports host development, and the Tunnel profile is optional.
- [ ] A successful dump can restore room, round, decision, and result data; seven successful backups remain after rotation.
- [ ] No settings/catalog editing/upload/nearby restaurant/random decision behavior is reachable or represented as an API.
