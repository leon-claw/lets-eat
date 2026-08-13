# Multiplayer Result Intersection and Stable Sync Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan task-by-task.

Goal: Keep active game pages stable during another player's completion, and show a frozen multiplayer result containing the intersection of all valid players' liked dishes plus each valid player's liked-dish list.

Architecture: Preserve the current HTTP/WebSocket architecture and private in-progress decisions. Extend the completed-round result DTO with commonItems and players. Keep background refreshes from entering the initial loading state. Render the frozen server snapshot on the result page.

Tech Stack: React 19, TypeScript, React Router, Vitest, Testing Library, Express, Drizzle ORM, PostgreSQL, Zod, WebSocket.

## Global Constraints

- Use the fixed read-only catalog.
- Keep individual in-progress decisions private.
- Exclude removed members from commonItems and players.
- Sort common and player items by fixed catalog order; sort players by room join order.
- Do not show a transient loading screen during background round refreshes.
- Preserve unrelated working-tree changes.
- Run graphify update . after code changes.

## Task 1: Result contract and aggregator

Files: packages/contracts/src/rounds.ts, packages/contracts/src/contracts.test.ts, apps/api/src/rounds/result-aggregator.ts, apps/api/src/rounds/result-aggregator.test.ts.

Write failing tests for two players: A likes cantonese and western, B likes cantonese and japanese. Expect commonItems to contain only cantonese and each player to retain their own liked list. Add strict schemas for ResultPlayer and the new RoundResult shape. Implement the minimal ordered intersection and player-detail aggregator. Run the focused contract and aggregator tests before and after the change.

## Task 2: Frozen server result snapshot

Files: apps/api/src/rounds/round-service.ts, apps/api/src/rounds/round-completion.test.ts, apps/api/src/rounds/round-routes.test.ts.

Update completion tests to assert commonItems, player display names/member IDs, player liked items, and exclusion of removed members. In finalizeIfReady, read completed round members and liked decisions inside the existing transaction, call the new aggregator, and persist the parsed RoundResult. Preserve authorization, idempotency, room transition, and snapshot immutability.

## Task 3: Stable background refresh

Files: apps/web/src/features/multiplayer/useMultiplayerRound.ts and its test.

Add a failing hook test that holds a background getRound promise and asserts status stays choosing instead of becoming loading. Add a background parameter to load; only initial load and explicit retry set loading. Use load(true) for WebSocket stale refresh and revision-conflict recovery.

## Task 4: Result page

Files: apps/web/src/pages/ResultPage.tsx, apps/web/src/pages/ResultPage.test.tsx, apps/web/src/app/AppRouter.test.tsx.

Update tests to use commonItems and players, assert the common section and each player section, and assert old like-count output is absent. Render common items or an explicit empty-intersection message, then all valid player sections, resolving names and images from the frozen catalog. Keep the return-room action.

## Task 5: Verification and graph

Run contract, API, and Web tests; lint; build; real two-browser flow; graphify update .; and git diff --check. In the browser flow verify player B stays on the game page when A completes, then verify both result pages show the overlap and each player detail.
