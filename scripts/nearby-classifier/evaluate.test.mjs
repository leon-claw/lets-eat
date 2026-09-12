import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateMetrics,
  parsePredictionLine,
  renderEvaluationMarkdown,
} from './evaluate.mjs';

test('parses a fastText probability prediction', () => {
  assert.deepEqual(parsePredictionLine('__label__火锅 0.875'), {
    label: '火锅',
    probability: 0.875,
  });
});

test('calculates accuracy, macro metrics, per-label metrics, and confusion matrix', () => {
  const metrics = calculateMetrics(
    ['火锅', '火锅', '日料', '其他'],
    [
      { label: '火锅', probability: 0.95 },
      { label: '日料', probability: 0.55 },
      { label: '日料', probability: 0.88 },
      { label: '其他', probability: 0.99 },
    ],
    ['火锅', '日料', '其他'],
  );

  assert.equal(metrics.total, 4);
  assert.equal(metrics.correct, 3);
  assert.equal(metrics.accuracy, 0.75);
  assert.equal(metrics.lowConfidenceCount, 1);
  assert.equal(metrics.perLabel.火锅.precision, 1);
  assert.equal(metrics.perLabel.火锅.recall, 0.5);
  assert.equal(metrics.confusionMatrix.火锅.日料, 1);
});

test('renders a report with the synthetic data warning', () => {
  const markdown = renderEvaluationMarkdown(
    {
      total: 1,
      correct: 1,
      accuracy: 1,
      macroPrecision: 1,
      macroRecall: 1,
      macroF1: 1,
      lowConfidenceCount: 0,
      lowConfidenceRate: 0,
      perLabel: {},
      confusionMatrix: {},
    },
    { dataSource: 'synthetic', modelName: 'nearby-restaurant-classifier.ftz' },
  );

  assert.match(markdown, /synthetic/i);
  assert.match(markdown, /nearby-restaurant-classifier\.ftz/);
  assert.match(markdown, /macro.*F1/i);
});

test('renders the confusion matrix in the human-readable report', () => {
  const markdown = renderEvaluationMarkdown(
    {
      total: 1,
      correct: 1,
      accuracy: 1,
      macroPrecision: 1,
      macroRecall: 1,
      macroF1: 1,
      lowConfidenceCount: 0,
      lowConfidenceRate: 0,
      perLabel: {},
      confusionMatrix: { 火锅: { 火锅: 1, 日料: 0 }, 日料: { 火锅: 0, 日料: 0 } },
    },
    { dataSource: 'synthetic', modelName: 'model.ftz' },
  );

  assert.match(markdown, /Confusion matrix/);
  assert.match(markdown, /\| 火锅 \| 1 \| 0 \|/);
});
