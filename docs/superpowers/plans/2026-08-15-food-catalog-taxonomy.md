# Food Catalog Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将固定菜品库整理为“一类料理体系 + 二类餐饮品类”，并为二类增加可选的一类菜系标签；新菜品暂不提供图片素材。

**Architecture:** 保留现有版本化 catalog JSON、`large/small` 数据集协议和菜单 Hash。扩展共享 `CatalogItem` 的可选 `cuisineTags` 字段；空图片由前端统一渲染为留白占位，不引入新图片资源或第三层分类。

**Tech Stack:** JSON catalog、Zod contracts、React、Vitest、Tailwind CSS。

## Global Constraints

- 两个数据集继续独立使用，二类标签不改变筛选和多人同步协议。
- 菜单版本和 Hash 保持不可变语义；本次数据更新发布为新 catalog 版本。
- 不新增图片库、图片 API 或第三层用户分类。
- 保留现有 Toast/Confirm 和其他未提交工作区改动。

---

### Task 1: 扩展目录契约并验证标签与空图片

**Files:**
- Modify: `packages/contracts/src/catalog.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [x] **Step 1: Write failing tests** for accepting an empty `imageUrl` and optional `cuisineTags` on a small item.
- [x] **Step 2: Run the contract test** and confirm it fails with the current schema.
- [x] **Step 3: Add the minimal schema changes** for blank images and optional cuisine tag IDs.
- [x] **Step 4: Run the contract test** and confirm it passes.

### Task 2: Update the versioned fixed catalog

**Files:**
- Create: `apps/api/catalog/v2/catalog.json`
- Create: `apps/api/catalog/v2/images/.gitkeep`
- Modify: `apps/api/src/server.ts` if the current catalog version is hard-coded to `v1`

- [x] **Step 1: Define and validate the v2 catalog shape** with 18 large items, 35 small items, and cuisine-tag IDs that reference large items.
- [x] **Step 2: Add the v2 catalog** using the approved cuisine and food-category lists; leave new `imageUrl` values as empty strings.
- [x] **Step 3: Point the default environment at v2** while keeping v1 files intact for existing round recovery.
- [x] **Step 4: Run catalog service and route tests** and confirm manifest counts/hash behavior.

### Task 3: Carry cuisine tags and render blank images safely

**Files:**
- Modify: `apps/web/src/entities/food-choice/types.ts`
- Modify: `apps/web/src/entities/catalog/food-choice-repository.ts`
- Modify: `apps/web/src/shared/components/ImageWithFallback.tsx`
- Modify: `apps/web/src/features/choose-food/components/SwipeDeck.tsx`
- Modify: `apps/web/src/pages/ResultPage.tsx`
- Test: relevant existing component and repository tests

- [x] **Step 1: Add failing component coverage** for a blank image URL rendering a neutral placeholder instead of a broken image.
- [x] **Step 2: Run the focused web tests** and confirm the expected failure.
- [x] **Step 3: Map `cuisineTags` through the repository** and use the shared blank-image behavior in all catalog image paths.
- [x] **Step 4: Run focused web tests** and confirm they pass.

### Task 4: Full verification and graph refresh

**Files:**
- No additional source files.

- [x] **Step 1: Run contract tests, API tests, focused Web tests, all lint checks, and all builds; record the unrelated Web full-suite localStorage failures.**
- [x] **Step 2: Run `graphify update .` to refresh the project graph.**
- [x] **Step 3: Review the diff to ensure only catalog, contract, blank-image, and plan files changed beyond pre-existing work.**
