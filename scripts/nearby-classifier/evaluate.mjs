import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ALL_LABELS } from './dataset.mjs';
import { findFastText } from './train.mjs';

export function parsePredictionLine(line) {
  const [rawLabel, rawProbability] = String(line).trim().split(/\s+/);
  if (!rawLabel?.startsWith('__label__') || rawProbability === undefined) {
    throw new Error(`Invalid fastText prediction line: ${line}`);
  }
  const probability = Number(rawProbability);
  if (!Number.isFinite(probability)) {
    throw new Error(`Invalid fastText probability: ${rawProbability}`);
  }
  return { label: rawLabel.slice('__label__'.length), probability };
}

function metricValue(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function roundMetric(value) {
  return Number(value.toFixed(4));
}

export function calculateMetrics(expectedLabels, predictions, labels = ALL_LABELS, { confidenceThreshold = 0.6 } = {}) {
  if (expectedLabels.length !== predictions.length) {
    throw new Error(`Expected ${expectedLabels.length} predictions, received ${predictions.length}`);
  }

  const perLabel = Object.fromEntries(labels.map((label) => [label, {
    support: 0,
    predicted: 0,
    correct: 0,
    precision: 0,
    recall: 0,
    f1: 0,
  }]));
  const confusionMatrix = Object.fromEntries(
    labels.map((expected) => [expected, Object.fromEntries(labels.map((predicted) => [predicted, 0]))]),
  );
  let correct = 0;
  let lowConfidenceCount = 0;

  expectedLabels.forEach((expected, index) => {
    const prediction = predictions[index];
    if (!perLabel[expected]) perLabel[expected] = { support: 0, predicted: 0, correct: 0, precision: 0, recall: 0, f1: 0 };
    if (!perLabel[prediction.label]) perLabel[prediction.label] = { support: 0, predicted: 0, correct: 0, precision: 0, recall: 0, f1: 0 };
    perLabel[expected].support += 1;
    perLabel[prediction.label].predicted += 1;
    if (expected === prediction.label) {
      correct += 1;
      perLabel[expected].correct += 1;
    }
    if (confusionMatrix[expected]?.[prediction.label] !== undefined) {
      confusionMatrix[expected][prediction.label] += 1;
    }
    if (prediction.probability < confidenceThreshold) lowConfidenceCount += 1;
  });

  for (const label of labels) {
    const stats = perLabel[label];
    stats.precision = roundMetric(metricValue(stats.correct, stats.predicted));
    stats.recall = roundMetric(metricValue(stats.correct, stats.support));
    stats.f1 = roundMetric(metricValue(2 * stats.precision * stats.recall, stats.precision + stats.recall));
  }

  const macro = (key) => roundMetric(labels.reduce((sum, label) => sum + perLabel[label][key], 0) / labels.length);
  return {
    total: expectedLabels.length,
    correct,
    accuracy: roundMetric(metricValue(correct, expectedLabels.length)),
    macroPrecision: macro('precision'),
    macroRecall: macro('recall'),
    macroF1: macro('f1'),
    lowConfidenceCount,
    lowConfidenceRate: roundMetric(metricValue(lowConfidenceCount, expectedLabels.length)),
    perLabel,
    confusionMatrix,
  };
}

export function renderEvaluationMarkdown(metrics, metadata) {
  const lines = [
    '# Nearby Restaurant Classifier Evaluation',
    '',
    `- Data source: **${metadata.dataSource ?? 'unknown'}**`,
    `- Model: \`${metadata.modelName ?? 'unknown'}\``,
    `- Test samples: ${metrics.total}`,
    '',
    '> This report uses synthetic data and does not establish production accuracy on real Amap results.',
    '',
    '## Overall metrics',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Accuracy | ${metrics.accuracy} |`,
    `| Macro precision | ${metrics.macroPrecision} |`,
    `| Macro recall | ${metrics.macroRecall} |`,
    `| Macro F1 | ${metrics.macroF1} |`,
    `| Low-confidence predictions (< 0.60) | ${metrics.lowConfidenceCount} (${metrics.lowConfidenceRate}) |`,
    '',
    '## Per-label metrics',
    '',
    '| Label | Support | Precision | Recall | F1 |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const [label, stats] of Object.entries(metrics.perLabel)) {
    lines.push(`| ${label} | ${stats.support} | ${stats.precision} | ${stats.recall} | ${stats.f1} |`);
  }
  const matrixLabels = Object.keys(metrics.confusionMatrix);
  if (matrixLabels.length > 0) {
    lines.push('', '## Confusion matrix', '', `| Expected \\ Predicted | ${matrixLabels.join(' | ')} |`, `| --- | ${matrixLabels.map(() => '---:').join(' | ')} |`);
    for (const expected of matrixLabels) {
      const row = matrixLabels.map((predicted) => metrics.confusionMatrix[expected][predicted] ?? 0);
      lines.push(`| ${expected} | ${row.join(' | ')} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function readExpectedLabels(testPath) {
  return readFileSync(testPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [rawLabel] = line.trim().split(/\s+/);
      if (!rawLabel?.startsWith('__label__')) throw new Error(`Invalid fastText test line: ${line}`);
      return rawLabel.slice('__label__'.length);
    });
}

export function evaluateModel({ fastTextPath, modelPath, testPath, outputDir, metadata = {} }) {
  const output = execFileSync(fastTextPath, ['predict-prob', modelPath, testPath, '1', '0.0'], { encoding: 'utf8' });
  const predictions = output.split('\n').filter(Boolean).map(parsePredictionLine);
  const expectedLabels = readExpectedLabels(testPath);
  const metrics = calculateMetrics(expectedLabels, predictions, ALL_LABELS);
  const report = {
    metadata: {
      dataSource: 'synthetic',
      ...metadata,
      modelName: metadata.modelName ?? path.basename(modelPath),
      modelBytes: statSync(modelPath).size,
    },
    metrics,
  };
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'evaluation.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(outputDir, 'evaluation.md'), renderEvaluationMarkdown(metrics, report.metadata));
  return report;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modelDir = path.join(repoRoot, 'apps/web/src/features/nearby-food/training/models');
const dataDir = path.join(repoRoot, 'apps/web/src/features/nearby-food/training/data');
const outputDir = path.join(repoRoot, 'apps/web/src/features/nearby-food/training/reports');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fastTextPath = findFastText();
  const modelPath = path.join(modelDir, 'nearby-restaurant-classifier.ftz');
  const report = evaluateModel({
    fastTextPath,
    modelPath,
    testPath: path.join(dataDir, 'test.txt'),
    outputDir,
    metadata: { modelName: path.basename(modelPath) },
  });
  console.log(`Evaluated ${report.metrics.total} samples. Accuracy: ${report.metrics.accuracy}, Macro F1: ${report.metrics.macroF1}`);
}
