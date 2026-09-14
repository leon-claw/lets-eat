# Implement multiplayer nearby-food dataset

> **For the implementation agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to execute this plan task-by-task.

**Goal:** 将已验证的“周围菜品”搜索、fastText 分类和内置大类聚合接入多人房间。房主使用自己的位置和高德配置生成快照，服务端保存并冻结快照，Web 与小程序的所有成员使用同一份有序卡片数据完成多人游戏。

**Architecture:** 高德请求、定位、分类和聚合继续在房主客户端执行；服务端只校验并保存规范化的房间级快照，不接触高德 Key、securityJsCode、坐标或原始 POI。开始 round 时复制快照，游戏/结果页从 round 快照还原内置大类卡片，因此复用现有多人同步、滑卡和结果计算。

**Tech stack:** TypeScript, Zod, Drizzle ORM/PostgreSQL, Fastify, React, WeChat Mini Program, Vitest, pnpm monorepo.

**Specification:** docs/superpowers/specs/2026-09-14-nearby-food-multiplayer-design.md

## Task 1: Extend shared contracts for nearby room snapshots

**Files:**
- Modify: packages/contracts/src/common.ts
- Modify: packages/contracts/src/rooms.ts
- Modify: packages/contracts/src/rounds.ts
- Modify: packages/contracts/src/index.ts
- Test: packages/contracts/src/contracts.test.ts

**Implementation:**

1. Extend RoomDatasetTypeSchema and every room/round dataset type that models room selection to include nearby.
2. Add a shared NearbyCatalogSnapshotSchema and inferred type:

   version: 1
   catalogVersion: string
   catalogHash: string
   classifierVersion: string
   selectionHash: string
   itemIds: string[]
   items: Array<{ itemId: string; merchantNames: string[] }>
   searchRadiusMeters: number
   candidateCount: number
   preparedAt: string

3. Add NearbyCatalogInputSchema/type for the client request. It contains the snapshot fields except selectionHash and preparedAt; the server creates those fields.
4. Add NearbyCatalogSummarySchema/type containing selectionHash, catalogVersion, categoryCount, merchantCount, and preparedAt.
5. Add a full nearby snapshot field to the room-entry response and a named SaveNearbyCatalogResponseSchema alias so Web and Mini Program clients do not duplicate response shapes.
6. Add nearby snapshot fields to round snapshot and result response schemas. Keep the regular room WebSocket payload summary-only.
7. Put protocol-level bounds in the schema: bounded strings, bounded merchant lists, bounded item IDs and bounded total list size. The service layer will perform menu-version and cross-field checks.
8. Add tests for valid nearby data, rejection of client-supplied selectionHash/preparedAt, duplicate IDs, malformed merchant lists, and compatibility with existing large/small/custom data.

**Verification:**

    pnpm --filter @lets-eat/contracts test
    pnpm --filter @lets-eat/contracts build

## Task 2: Persist and validate the host-generated nearby snapshot

**Files:**
- Modify: apps/api/src/db/schema.ts
- Add: apps/api/drizzle/0002_nearby_room_catalog.sql
- Modify: apps/api/src/rooms/room-service.ts
- Modify: apps/api/src/rooms/room-presenter.ts
- Modify: apps/api/src/rooms/room-routes.ts
- Add: apps/api/src/rooms/nearby-catalog-validation.ts
- Test: apps/api/src/rooms/room-service.test.ts
- Test: apps/api/src/rooms/room-routes.test.ts
- Test: apps/api/src/rooms/room-service.test.ts (include room-presenter assertions here because there is no presenter-specific test)

**Implementation:**

1. Extend the PostgreSQL dataset_type enum with nearby, and add nullable JSONB nearby_catalog columns to rooms and rounds in the Drizzle schema.
2. Generate a migration with the repository Drizzle tooling. The migration must add the enum value before using it and add the two JSONB columns.
3. Add a validator/service helper that:
   - loads the current built-in catalog and checks catalogVersion and catalogHash;
   - accepts only valid built-in large-category IDs, including hotpot;
   - rejects duplicate itemIds, missing/extra items, fewer than three usable categories, empty/overlong merchant names, excessive merchant count, and an oversized JSON snapshot;
   - normalizes merchant names deterministically (trim, remove empty duplicates, preserve host category order);
   - computes selectionHash from the canonical snapshot and sets server preparedAt;
   - never accepts or stores Key, securityJsCode, coordinate, raw Amap response, or Amap image URL.
4. Add RoomService.saveNearbyCatalog(actorUserId, roomId, input):
   - require host and waiting status;
   - enforce expectedRevision;
   - validate and canonicalize input;
   - transactionally save nearbyCatalog, set selectedDataset=nearby, increment revision once;
   - return the room entry with the full nearby snapshot;
   - publish room.updated with summary data only.
5. Add RoomService.getNearbyCatalog(actorUserId, roomId) for room members. It returns the validated full snapshot and does not change revision.
6. Update getRoomEntry and room-presenter so normal room state contains only NearbyCatalogSummary, while room-entry may contain the full snapshot needed after join/reload.
7. Add PUT /api/rooms/:roomId/nearby-catalog and GET /api/rooms/:roomId/nearby-catalog. Both use existing authentication, room membership, error mapping, and revision-conflict conventions.
8. Make replacing a snapshot atomic. Amap/classifier failure is handled on the client and does not call this API; if the API rejects input, the old valid snapshot and room selection remain unchanged.

**Verification:**

    pnpm --filter @lets-eat/api exec drizzle-kit check
    pnpm --filter @lets-eat/api test -- room-service room-routes room-presenter
    pnpm --filter @lets-eat/api build

## Task 3: Freeze nearby data when starting a round and restore it in results

**Files:**
- Modify: apps/api/src/rounds/round-service.ts
- Modify: apps/api/src/rounds/round-presenter.ts
- Modify: apps/api/src/rounds/round-routes.ts
- Test: apps/api/src/rounds/round-service.test.ts
- Test: apps/api/src/rounds/round-routes.test.ts

**Implementation:**

1. In startRound, keep the existing expectedRoomRevision request shape and branch on selectedDataset:
   - large/small load the existing catalog;
   - custom copies the current custom snapshot;
   - nearby copies the validated room nearby snapshot.
2. Reject nearby start when the snapshot is absent, has fewer than three categories, fails current catalog version/hash validation, or references a removed built-in item. Do not change room status or revision on this failure.
3. Store the copied nearby snapshot in the round JSONB field together with datasetType=nearby, preserving itemIds order and merchant names.
4. Make getRoundItems resolve nearby IDs through the current built-in catalog and overlay only merchantNames; do not call Amap, fastText, or the client-side aggregator.
5. Include the nearby snapshot in round and result responses; keep existing decision validation and result aggregation based on canonical built-in item IDs.
6. Ensure opening the next round copies the current room nearby snapshot only when room selection is nearby; an already started round remains immutable.
7. Add service and route tests for successful freeze, invalid/missing snapshot, catalog-version invalidation, result restoration, and preservation of old round data after the room snapshot is replaced.

**Verification:**

    pnpm --filter @lets-eat/api test -- round-service round-routes
    pnpm --filter @lets-eat/api build

## Task 4: Add shared client-side nearby snapshot conversion and hydration

**Files:**
- Add: packages/client-core/src/nearby/nearby-catalog.ts
- Modify: packages/client-core/src/index.ts
- Test: packages/client-core/src/nearby/nearby-catalog.test.ts

**Implementation:**

1. Add one platform-neutral module for the wire format and the two conversions needed by both clients:
   - normalizeNearbyChoiceId(id): convert legacy single-player IDs such as nearby-category:cantonese to canonical built-in IDs, while leaving canonical IDs unchanged;
   - createNearbyCatalogInput(choices, metadata): keep item order, normalize merchant names and produce the request body without server-owned selectionHash/preparedAt;
   - hydrateNearbyChoices(snapshot, templates): select built-in large-category templates by snapshot.itemIds, preserve snapshot order, and overlay snapshot.items[].merchantNames into the representative-foods field.
2. Do not copy Amap adapters or fastText code into client-core. The module only handles the canonical snapshot and built-in card restoration.
3. Ensure hydration fails loudly for a missing template or mismatched item list so callers can display “nearby data expired” and recover by reloading room state. It must not silently substitute a different category or shuffle order.
4. Add tests for legacy ID normalization, deterministic input creation, merchant de-duplication, order preservation, built-in cover/template preservation, and malformed snapshot rejection.

**Verification:**

    pnpm --filter @lets-eat/client-core test
    pnpm --filter @lets-eat/client-core build

## Task 5: Connect the Web room and nearby preparation flow

**Files:**
- Modify: apps/web/src/entities/room/room-client.ts
- Modify: apps/web/src/pages/RoomPage.tsx
- Modify: apps/web/src/pages/NearbyFoodPage.tsx
- Modify: apps/web/src/app/AppRouter.tsx
- Add: apps/web/src/pages/RoomNearbyFoodPage.tsx
- Modify: apps/web/src/features/nearby-food/nearby-food-adapter.ts
- Test: apps/web/src/entities/room/room-client.test.ts
- Test: apps/web/src/pages/RoomPage.test.tsx
- Test: apps/web/src/pages/NearbyFoodPage.test.tsx
- Test: apps/web/src/pages/RoomNearbyFoodPage.test.tsx

**Implementation:**

1. Add RoomClient methods for GET/PUT nearby catalog, using the contracts from Task 1 and the same auth/error/revision handling as existing custom catalog methods.
2. Keep the existing single-player NearbyFoodPage behavior intact: it may still create the local nearby round and navigate to the single-player game.
3. Add a multiplayer configuration route at /room/:roomId/nearby?mode=multiplayer. Reuse the existing host-only location/search/classification UI and preview; in multiplayer mode, save the normalized result with RoomClient.saveNearbyCatalog and navigate back to the room.
4. Use the existing host-owned Web Amap configuration and fastText classifier. Do not send Amap Key, securityJsCode, coordinates, raw POIs, or image URLs to the API.
5. Change the nearby adapter’s multiplayer output to canonical built-in item IDs. Keep the current rule that unmatched categories are omitted, and keep the current top-20 candidate behavior.
6. Update RoomPage:
   - host can choose nearby while waiting and open its configuration page;
   - a nearby selection without a valid snapshot disables start and explains that the host must prepare it;
   - a prepared snapshot shows category and merchant counts;
   - members see the summary as read-only and never see search/reconfigure controls;
   - waiting-state switching back to large/small/custom retains the old nearby snapshot for a later switch back;
   - after round start, nearby controls are locked by the existing room status.
7. Refresh room entry/full nearby data after room.updated when the summary selectionHash changes, without putting the full merchant list in the event payload.
8. Add tests for host/member control boundaries, route transitions, save success, save failure retaining the previous room state, revision conflict handling, summary rendering, and no Amap call from a member view.

**Verification:**

    pnpm --filter @lets-eat/web test -- room-client RoomPage NearbyFoodPage RoomNearbyFoodPage
    pnpm --filter @lets-eat/web build

## Task 6: Restore nearby snapshots in the Web multiplayer game and result pages

**Files:**
- Modify: apps/web/src/features/multiplayer/useMultiplayerRound.ts
- Modify: apps/web/src/pages/GamePage.tsx
- Modify: apps/web/src/pages/ResultPage.tsx
- Test: apps/web/src/features/multiplayer/useMultiplayerRound.test.tsx
- Test: apps/web/src/pages/GamePage.test.tsx
- Test: apps/web/src/pages/ResultPage.test.tsx

**Implementation:**

1. In useMultiplayerRound, add a nearby branch that loads the round snapshot and calls the shared hydrator from Task 4. Do not call prepareRoundChoices for nearby and do not randomize or resort itemIds.
2. Preserve the existing multiplayer card geometry, card height, swipe distance feedback, like/dislike labels, progress, decision queue, and revision synchronization. Pass representativeFoodsLabel=附近门店 and the existing emphasis prop when rendering nearby cards.
3. Ensure the restored card uses the built-in template’s coverImage and metadata, not a default nearby placeholder and not a remote Amap image.
4. Submit canonical built-in item IDs in existing decision requests. Rejecting or retrying a decision must not alter the frozen nearby order.
5. In ResultPage, hydrate from the round/result snapshot rather than the current room catalog or a new nearby search. Show the same built-in card cover and the aggregated nearby merchant names.
6. Add tests with a complete nearby round fixture (including status, revision, members, ownDecisions, datasetType, nearby snapshot, and ordered item IDs) that assert no shuffle, canonical IDs, built-in covers, nearby label, merchant truncation props, reload behavior, and expired-data error handling.

**Verification:**

    pnpm --filter @lets-eat/web test -- useMultiplayerRound GamePage ResultPage
    pnpm --filter @lets-eat/web build

## Task 7: Connect the Mini Program room and nearby preparation flow

**Files:**
- Modify: apps/miniprogram/src/adapters/wx-room.ts
- Add: apps/miniprogram/src/adapters/wx-nearby-room.ts
- Modify: apps/miniprogram/src/pages/room/room-model.ts
- Modify: apps/miniprogram/src/pages/room/index.ts
- Modify: apps/miniprogram/src/pages/room/index.wxml
- Modify: apps/miniprogram/src/pages/room/index.wxss
- Modify: apps/miniprogram/src/pages/nearby/index.ts
- Modify: apps/miniprogram/src/pages/nearby/index.wxml
- Modify: apps/miniprogram/src/pages/nearby/index.wxss
- Test: apps/miniprogram/tests/room-page.test.ts
- Test: apps/miniprogram/tests/nearby-page.test.ts
- Test: apps/miniprogram/tests/room-realtime.test.ts

**Implementation:**

1. Extend Mini Program room models and adapters to parse nearby dataset type, summary, full room-entry snapshot, GET nearby catalog, and PUT nearby catalog.
2. Keep request serialization restricted to the canonical nearby input. Never include the user’s Key/securityJsCode, exact location, raw Amap records, or remote images.
3. Add the same host-only nearby entry and waiting-state summary to the Mini Program room page. Members remain read-only and do not navigate to the nearby configuration page.
4. Make the nearby page accept mode=single or mode=multiplayer and roomId. Single mode stays unchanged; multiplayer mode:
   - uses the host’s existing local Amap configuration and location/manual selection;
   - performs the existing top-20 search/classification/aggregation;
   - sends the canonical snapshot input to the room API;
   - returns to the room after success and does not create a local nearby round.
5. Keep the currently verified Mini Program location permission/manual-selection behavior and error recovery. A member must be able to play with no location permission and no Amap configuration.
6. Update realtime/poll recovery so a changed nearby selectionHash causes a full nearby snapshot reload, while ordinary room updated events only refresh summary state.
7. Add tests for dataset parsing, host/member controls, multiplayer save route, no member Amap invocation, reload after room.updated, and retention of the prior snapshot after a failed search.

**Verification:**

    pnpm --filter @lets-eat/miniprogram test -- room-page nearby-page room-realtime
    pnpm --filter @lets-eat/miniprogram build

## Task 8: Restore nearby snapshots in the Mini Program game and result pages

**Files:**
- Modify: apps/miniprogram/src/adapters/wx-round.ts
- Modify: apps/miniprogram/src/pages/game/index.ts
- Modify: apps/miniprogram/src/pages/result/index.ts
- Test: apps/miniprogram/tests/game-page.test.ts
- Test: apps/miniprogram/tests/result-page.test.ts

**Implementation:**

1. Extend round/result parsing to include datasetType=nearby and the full frozen nearby snapshot.
2. In the multiplayer game page, hydrate built-in large-category cards from the round snapshot, preserve itemIds order, and bypass shuffleChoices for nearby.
3. Reuse the existing Mini Program swipe card layout and feedback behavior. Bind the nearby merchant list to the existing representative-food area, keeping the card height and cover size unchanged.
4. Send canonical built-in item IDs in existing decision requests and keep the current round/revision/reconnect flow.
5. In the result page, restore the same snapshot and built-in covers from round/result data. It must work after a cold reload and must not call Amap or depend on the room’s mutable nearby snapshot.
6. Add tests for no shuffle, canonical decisions, cover/merchant rendering, mixed Web/Mini round payload compatibility, result reload, and missing-template recovery.

**Verification:**

    pnpm --filter @lets-eat/miniprogram test -- game-page result-page
    pnpm --filter @lets-eat/miniprogram build

## Task 9: Verify mixed-client multiplayer behavior and update the graph

**Files:**
- Modify: apps/api/src/rooms/room-service.test.ts
- Modify: apps/api/src/rooms/room-routes.test.ts
- Modify: apps/api/src/rounds/round-service.test.ts
- Modify: apps/api/src/rounds/round-routes.test.ts
- Modify: apps/web/src/entities/room/room-client.test.ts
- Modify: apps/web/src/pages/RoomPage.test.tsx
- Modify: apps/web/src/features/multiplayer/useMultiplayerRound.test.tsx
- Modify: apps/web/src/pages/GamePage.test.tsx
- Modify: apps/web/src/pages/ResultPage.test.tsx
- Modify: apps/miniprogram/tests/room-page.test.ts
- Modify: apps/miniprogram/tests/nearby-page.test.ts
- Modify: apps/miniprogram/tests/room-realtime.test.ts
- Modify: apps/miniprogram/tests/game-page.test.ts
- Modify: apps/miniprogram/tests/result-page.test.ts

**Implementation:**

1. Start the repository test database using the existing project command, apply the generated migration, and run the full API test suite.
2. Run the full Web and Mini Program test suites and builds after the focused tests from Tasks 1–8 pass.
3. Exercise the end-to-end matrix:
   - Web host + Web member;
   - Web host + Mini Program member;
   - Mini Program host + Web member;
   - Mini Program host + Mini Program member.
4. For each combination verify: join, host nearby preparation, room.updated summary refresh, nearby snapshot loading, start, ordered cards, left/right decisions, completion, result merchant names, page reload, and disconnect/reconnect.
5. Verify negative paths: guest cannot save or re-search, non-nearby datasets remain unchanged, host search failure preserves the last valid snapshot, a stale revision cannot overwrite a newer snapshot, a missing/invalid catalog blocks start, and no client calls Amap after round start.
6. Run graphify update . after all source changes so graphify-out reflects the new room, round, adapter, and UI relationships.
7. Review the final diff for unrelated changes and run formatting/lint/type checks. Commit only the implementation and required tests/docs; do not commit generated runtime data or local Amap configuration.

**Verification:**

    pnpm test
    pnpm lint
    pnpm build
    graphify update .
    git diff --check
    git status --short

The implementation is complete only when the mixed-client matrix and the negative-path checks pass, and the final diff contains no secrets or raw location data.

## File and interface checklist

The implementation should leave these externally visible behaviors:

- Contracts expose nearby dataset, input, summary, snapshot, round and result types.
- API exposes GET and PUT /api/rooms/:roomId/nearby-catalog.
- Room snapshots expose summary only; room entry and explicit nearby GET expose the full snapshot.
- Round and result snapshots carry the immutable nearby data needed to restore cards.
- RoomClient and wx-room expose matching nearby read/save methods.
- Web and Mini Program nearby preparation pages distinguish single-player local storage from multiplayer room storage.
- Web and Mini Program multiplayer games use built-in large-category IDs and preserve the host snapshot order.
- Nearby cards use built-in covers and the “附近门店” merchant list.
- Guests never need Amap configuration or location permission.

## Self-review checklist

- [ ] The server, not the client, computes selectionHash and preparedAt.
- [ ] The API never receives or stores Amap Key, securityJsCode, exact coordinates, raw POIs, or remote images.
- [ ] nearby is represented in every relevant room/round/result contract, database enum, parser, and client model.
- [ ] Room replacement is host-only, waiting-only, revision-checked, atomic, and leaves the old snapshot intact on failure.
- [ ] Round snapshots are immutable and results do not depend on mutable room state.
- [ ] Nearby item IDs are canonical built-in large-category IDs; legacy single-player IDs are normalized only at the client boundary.
- [ ] Unmatched categories stay excluded; no implicit “其他” card is introduced.
- [ ] The existing card layout and swipe behavior remain shared.
- [ ] Both clients use the same snapshot order, covers, labels, and merchant names.
- [ ] Member and reconnect paths do not invoke Amap or fastText.
- [ ] Tests cover Web/Mini mixed clients and all acceptance criteria.
- [ ] graphify update ., full tests, lint, build, and git diff --check are run before completion.
