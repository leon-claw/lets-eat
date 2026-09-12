import test from 'node:test';
import assert from 'node:assert/strict';

import { buildQuantizeArgs, buildTrainArgs, findFastText } from './train.mjs';

test('builds a compact supervised character n-gram command', () => {
  const args = buildTrainArgs({
    inputPath: '/tmp/train.txt',
    outputPrefix: '/tmp/nearby-classifier',
  });

  assert.deepEqual(args.slice(0, 1), ['supervised']);
  assert.ok(args.includes('-input'));
  assert.ok(args.includes('/tmp/train.txt'));
  assert.ok(args.includes('-output'));
  assert.ok(args.includes('/tmp/nearby-classifier'));
  assert.deepEqual(args.slice(args.indexOf('-minn'), args.indexOf('-bucket') + 2), [
    '-minn', '2', '-maxn', '5', '-bucket', '20000',
  ]);
  assert.ok(args.includes('-dim'));
  assert.ok(args.includes('32'));
});

test('builds the quantization command from the trained model prefix', () => {
  assert.deepEqual(buildQuantizeArgs({
    inputPath: '/tmp/train.txt',
    outputPrefix: '/tmp/nearby-classifier',
  }), [
    'quantize',
    '-input', '/tmp/train.txt',
    '-output', '/tmp/nearby-classifier',
    '-qnorm',
    '-retrain',
  ]);
});

test('reports an actionable error when fastText is unavailable', () => {
  assert.throws(
    () => findFastText('/definitely/missing/fasttext'),
    /fastText executable.*FASTTEXT_BIN/i,
  );
});
