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

test('keeps curated real cases and brand-only names out of the model dataset', () => {
  const records = generateDataset({ seed: 20260912 });
  const expected = new Map([
    ['東園·廣州味·點心與燒鵝(农林·东山未来里店)', '粤菜'],
    ['新渝城·重庆豆花馆(东山宾馆店)', '川菜'],
    ['广东道至正家宴(东山宾馆店)', '粤菜'],
    ['鼎盛蜀坊重庆江湖菜(东山口店)', '川菜'],
    ['长禧家.珑厨(东山口店)', '其他'],
    ['味然香(执信店)', '其他'],
    ['简·东山小厨家常菜', '其他'],
  ]);

  for (const [name, label] of expected) {
    const record = records.find((candidate) => candidate.name === name);
    assert.equal(record?.label, label, `${name} should be labeled ${label}`);
    assert.equal(record?.pattern, 'curated_real_case');
  }
  assert.equal(records.some((record) => record.name.includes('星巴克')), false);
  assert.equal(records.some((record) => record.name.includes('麦当劳')), false);
});

test('strips branch details from names but keeps useful Amap parenthetical labels', () => {
  const line = toFastTextLine({
    label: '粤菜',
    name: '广东道至正家宴(东山宾馆店)',
    amap_type: '餐饮服务|中餐厅|广东菜(粤菜)',
  });

  assert.equal(line, '__label__粤菜 name_广东道至正家宴 amap_餐饮服务 amap_中餐厅 amap_广东菜_粤菜_');
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
