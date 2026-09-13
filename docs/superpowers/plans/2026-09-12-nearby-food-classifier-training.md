# 周围商家分类训练实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成 1000 条可审查的中文商家分类数据，训练 fastText 字符 n-gram 分类器，并输出可复现的测试报告和量化模型。

**Architecture:** 使用 Node.js 脚本生成确定性的 JSONL 数据和 fastText 输入文件；训练与评估通过本机 fastText CLI 完成，脚本负责参数、文件布局和指标汇总。训练产物只作为离线实验，不接入当前 Web 分类器。

**Tech Stack:** Node.js 22、Node test runner、fastText supervised/quantize CLI、JSONL、Markdown。

**Spec:** `docs/superpowers/specs/2026-09-12-nearby-food-classifier-training-design.md`

## Global Constraints

- 使用商家名称和高德原始分类作为输入。
- 数据集固定为 1000 条：16 个业务大类各 55 条，「其他」120 条。
- 使用固定随机种子，保证生成结果一致。
- 每条样本只有一个主标签，标签与当前 Web 分类器一致。
- JSONL 是审查和后续追加真实标注的主格式；fastText 文本由脚本生成。
- 按类别分层划分 80%/10%/10% 训练、验证、测试集。
- 报告必须注明数据来源为 synthetic，不能宣称已经证明线上准确率。
- 不替换线上手工规则，不引入 Transformer、ONNX Runtime 或新的 Web 运行时依赖。
- 不覆盖当前工作区已有的分类器改动，只新增训练实验文件。

---

### Task 1: 建立数据生成与校验的可测试接口

**Files:**
- Create: `scripts/nearby-classifier/dataset.mjs`
- Create: `scripts/nearby-classifier/dataset.test.mjs`
- Create: `scripts/nearby-classifier/generate-dataset.mjs`
- Create: `scripts/nearby-classifier/validate-dataset.mjs`
- Modify: `package.json`

**Interfaces:**
- `generateDataset({ seed: number }): DatasetRecord[]`
- `splitDataset(records, { seed: number }): { train: DatasetRecord[]; validation: DatasetRecord[]; test: DatasetRecord[] }`
- `toFastTextLine(record: DatasetRecord): string`
- `validateDataset(records): { counts: Record<string, number>; errors: string[] }`
- `DatasetRecord` contains `id`, `label`, `name`, `amap_type`, `source`, and `pattern`.

- [ ] **Step 1: Write failing tests**

  Add tests that assert the generator returns exactly 1000 records, 55 records for each business category, 120 for `其他`, unique IDs, non-empty fields, valid labels, deterministic output for the same seed, and fastText lines containing both `name_` and `amap_` features.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --test scripts/nearby-classifier/dataset.test.mjs`

  Expected: FAIL because the dataset module and generator do not exist yet.

- [ ] **Step 3: Implement the minimum generator**

  Put category-specific lexicons and patterns in `dataset.mjs`. Generate 55 varied records per business category and 120 deliberately ambiguous or non-food records for `其他`; use a seeded Fisher-Yates shuffle and reject duplicate normalized names. Keep `generate-dataset.mjs` as the file-writing entry point and `validate-dataset.mjs` as the standalone validator.

  Add root scripts:

  ```json
  {
    "nearby:classifier:generate": "node scripts/nearby-classifier/generate-dataset.mjs",
    "nearby:classifier:validate": "node scripts/nearby-classifier/validate-dataset.mjs"
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run: `node --test scripts/nearby-classifier/dataset.test.mjs`

  Expected: PASS with all count, determinism, uniqueness, and formatting assertions.

- [ ] **Step 5: Generate and validate the committed data files**

  Run: `pnpm nearby:classifier:generate && pnpm nearby:classifier:validate`

  Expected: JSONL plus train/validation/test files are written under `apps/web/src/features/nearby-food/training/data/`; validation reports zero errors and the exact category counts.

- [ ] **Step 6: Commit the dataset pipeline**

  ```bash
  git add package.json scripts/nearby-classifier apps/web/src/features/nearby-food/training/data
  git commit -m "feat: add nearby classifier training dataset"
  ```

### Task 2: 添加 fastText 训练和量化命令封装

**Files:**
- Create: `scripts/nearby-classifier/train.mjs`
- Create: `scripts/nearby-classifier/train.test.mjs`
- Modify: `package.json`
- Create: `apps/web/src/features/nearby-food/training/models/.gitkeep`

**Interfaces:**
- `buildTrainArgs({ inputPath, outputPrefix, options }): string[]`
- `findFastText(binaryOverride?: string): string`
- `runTraining({ fastTextPath, dataDir, modelDir }): void`

- [ ] **Step 1: Write failing tests**

  Test that training arguments include supervised mode, the generated training file, an output prefix, character n-gram bounds, a small dimension and bucket, and that a missing fastText executable produces an actionable error mentioning installation or `FASTTEXT_BIN`.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --test scripts/nearby-classifier/train.test.mjs`

  Expected: FAIL because the training module does not exist.

- [ ] **Step 3: Implement the CLI wrapper**

  Prefer `FASTTEXT_BIN`, then `fasttext` from `PATH`. Run:

  ```text
  fasttext supervised -input data/train.txt -output models/nearby-restaurant-classifier -dim 32 -epoch 50 -lr 0.5 -wordNgrams 2 -minn 2 -maxn 5 -bucket 20000 -minCount 1 -loss softmax
  fasttext quantize -input data/train.txt -output models/nearby-restaurant-classifier -qnorm -retrain
  ```

  Keep the raw `.bin` and quantized `.ftz`; never claim training succeeded if either command fails. Write `models/training-config.json` containing the exact parameters and data seed.

- [ ] **Step 4: Run tests to verify they pass**

  Run: `node --test scripts/nearby-classifier/train.test.mjs`

  Expected: PASS, including the missing-binary error test without invoking a real training process.

- [ ] **Step 5: Add the training command**

  ```json
  {
    "nearby:classifier:train": "node scripts/nearby-classifier/train.mjs"
  }
  ```

- [ ] **Step 6: Commit the training wrapper**

  ```bash
  git add package.json scripts/nearby-classifier/train.mjs scripts/nearby-classifier/train.test.mjs apps/web/src/features/nearby-food/training/models/.gitkeep
  git commit -m "feat: add fasttext nearby classifier training"
  ```

### Task 3: 添加模型评估和报告生成

**Files:**
- Create: `scripts/nearby-classifier/evaluate.mjs`
- Create: `scripts/nearby-classifier/evaluate.test.mjs`
- Modify: `package.json`

**Interfaces:**
- `parsePredictionLine(line): { label: string; probability: number }`
- `calculateMetrics(expectedLabels, predictions, labels): EvaluationMetrics`
- `renderEvaluationMarkdown(metrics, metadata): string`
- `evaluateModel({ fastTextPath, modelPath, testPath, outputDir }): void`

- [ ] **Step 1: Write failing tests**

  Use a small in-memory prediction fixture to test accuracy, macro precision/recall/F1, per-label counts, and confusion-matrix cells. Test that Markdown includes the synthetic-data warning.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --test scripts/nearby-classifier/evaluate.test.mjs`

  Expected: FAIL because metrics and rendering functions are not implemented.

- [ ] **Step 3: Implement evaluation**

  Call `fasttext predict-prob <model> <test> 1 0.0`, align output rows with test labels, calculate the required metrics, and write:

  - `apps/web/src/features/nearby-food/training/reports/evaluation.json`
  - `apps/web/src/features/nearby-food/training/reports/evaluation.md`

  Include model file sizes, training seed, sample counts, parameters, and the number of predictions below the confidence threshold `0.60`.

- [ ] **Step 4: Run tests to verify they pass**

  Run: `node --test scripts/nearby-classifier/evaluate.test.mjs`

  Expected: PASS with exact metric assertions.

- [ ] **Step 5: Add the evaluation command and run it**

  ```json
  {
    "nearby:classifier:evaluate": "node scripts/nearby-classifier/evaluate.mjs"
  }
  ```

  Run: `pnpm nearby:classifier:evaluate`

  Expected: report files are generated and identify the dataset as synthetic.

- [ ] **Step 6: Commit the evaluation tooling**

  ```bash
  git add package.json scripts/nearby-classifier/evaluate.mjs scripts/nearby-classifier/evaluate.test.mjs apps/web/src/features/nearby-food/training/reports
  git commit -m "feat: evaluate nearby classifier model"
  ```

### Task 4: 完成一次端到端训练并核验产物

**Files:**
- Modify: `apps/web/src/features/nearby-food/training/reports/evaluation.json`
- Modify: `apps/web/src/features/nearby-food/training/reports/evaluation.md`
- Create: `apps/web/src/features/nearby-food/training/models/nearby-restaurant-classifier.bin`
- Create: `apps/web/src/features/nearby-food/training/models/nearby-restaurant-classifier.ftz`
- Create: `apps/web/src/features/nearby-food/training/models/training-config.json`

- [ ] **Step 1: Verify fastText availability**

  Run `pnpm nearby:classifier:train` when `fasttext` is on `PATH`. If it is not, create an isolated environment, install the Python fastText package that provides the CLI, and pass its executable explicitly:

  ```bash
  python3 -m venv /private/tmp/lets-eat-fasttext-venv
  /private/tmp/lets-eat-fasttext-venv/bin/python -m pip install fasttext
  FASTTEXT_BIN=/private/tmp/lets-eat-fasttext-venv/bin/fasttext pnpm nearby:classifier:train
  ```

  If installation or compilation fails, preserve the generated dataset but do not create fake model files; report the exact dependency error.

- [ ] **Step 2: Run end-to-end training**

  Run: `pnpm nearby:classifier:train && pnpm nearby:classifier:evaluate`

  Expected: both `.bin` and `.ftz` exist, the report contains all 17 labels, and the quantized model is smaller than the raw model.

- [ ] **Step 3: Inspect data and model metadata**

  Run: `pnpm nearby:classifier:validate && node -e "const r=require('./apps/web/src/features/nearby-food/training/reports/evaluation.json'); console.log(r)"`

  Confirm exact counts, no validation errors, all labels present, and no accidental empty predictions.

- [ ] **Step 4: Run repository verification**

  Run: `node --test scripts/nearby-classifier/*.test.mjs && pnpm --filter @lets-eat/web lint && git diff --check`

  Expected: all training-tool tests pass, Web TypeScript checks pass, and there are no whitespace errors.

- [ ] **Step 5: Refresh the knowledge graph**

  Run: `graphify update .`

- [ ] **Step 6: Commit the trained experiment artifacts**

  ```bash
  git add scripts/nearby-classifier apps/web/src/features/nearby-food/training package.json
  git commit -m "feat: train nearby restaurant classifier experiment"
  ```
