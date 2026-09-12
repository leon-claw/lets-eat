import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUSINESS_LABELS,
  DATASET_SIZE,
  OTHER_LABEL,
  generateDataset,
  splitDataset,
  toFastTextLine,
  validateDataset,
} from './dataset.mjs';

test('generates the agreed 1000-record label distribution', () => {
  const records = generateDataset({ seed: 20260912 });
  const result = validateDataset(records);

  assert.equal(records.length, DATASET_SIZE);
  assert.deepEqual(result.errors, []);
  for (const label of BUSINESS_LABELS) {
    assert.equal(result.counts[label], 55, `${label} should have 55 records`);
  }
  assert.equal(result.counts[OTHER_LABEL], 120);
});

test('generates deterministic unique records with both input fields', () => {
  const first = generateDataset({ seed: 20260912 });
  const second = generateDataset({ seed: 20260912 });

  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((record) => record.id)).size, first.length);
  assert.equal(new Set(first.map((record) => record.name)).size, first.length);
  assert.ok(first.every((record) => record.name.trim().length > 0));
  assert.ok(first.every((record) => record.amap_type.trim().length > 0));
  assert.ok(first.every((record) => toFastTextLine(record).includes('name_')));
  assert.ok(first.every((record) => toFastTextLine(record).includes('amap_')));
});

test('splits every label into deterministic 80/10/10 partitions', () => {
  const records = generateDataset({ seed: 20260912 });
  const first = splitDataset(records, { seed: 99 });
  const second = splitDataset(records, { seed: 99 });

  assert.deepEqual(first, second);
  assert.deepEqual(
    [first.train.length, first.validation.length, first.test.length],
    [800, 100, 100],
  );
  for (const label of [...BUSINESS_LABELS, OTHER_LABEL]) {
    const trainCount = first.train.filter((record) => record.label === label).length;
    const validationCount = first.validation.filter((record) => record.label === label).length;
    const testCount = first.test.filter((record) => record.label === label).length;
    assert.equal(trainCount, label === OTHER_LABEL ? 96 : 44);
    assert.equal(trainCount + validationCount + testCount, label === OTHER_LABEL ? 120 : 55);
    assert.ok(validationCount >= (label === OTHER_LABEL ? 12 : 5));
    assert.ok(testCount >= (label === OTHER_LABEL ? 12 : 5));
  }
});

test('rejects malformed records and unknown labels', () => {
  const result = validateDataset([
    {
      id: 'bad',
      label: '不存在',
      name: '',
      amap_type: '',
      source: 'synthetic',
      pattern: 'bad',
    },
  ]);

  assert.ok(result.errors.some((error) => error.includes('unknown label')));
  assert.ok(result.errors.some((error) => error.includes('name')));
  assert.ok(result.errors.some((error) => error.includes('amap_type')));
});
