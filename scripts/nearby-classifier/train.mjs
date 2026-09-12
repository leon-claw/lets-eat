import { accessSync, constants, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TRAIN_OPTIONS = {
  dim: 32,
  epoch: 50,
  lr: 0.5,
  wordNgrams: 2,
  minn: 2,
  maxn: 5,
  bucket: 20000,
  minCount: 1,
  loss: 'softmax',
};

export function buildTrainArgs({ inputPath, outputPrefix, options = {} }) {
  const config = { ...TRAIN_OPTIONS, ...options };
  return [
    'supervised',
    '-input', inputPath,
    '-output', outputPrefix,
    '-dim', String(config.dim),
    '-epoch', String(config.epoch),
    '-lr', String(config.lr),
    '-wordNgrams', String(config.wordNgrams),
    '-minn', String(config.minn),
    '-maxn', String(config.maxn),
    '-bucket', String(config.bucket),
    '-minCount', String(config.minCount),
    '-loss', config.loss,
  ];
}

export function buildQuantizeArgs({ inputPath, outputPrefix }) {
  return [
    'quantize',
    '-input', inputPath,
    '-output', outputPrefix,
    '-qnorm',
    '-retrain',
  ];
}

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function findFastText(binaryOverride = process.env.FASTTEXT_BIN) {
  if (binaryOverride) {
    if (isExecutable(binaryOverride)) return binaryOverride;
    throw new Error(`fastText executable is not executable: ${binaryOverride}. Set FASTTEXT_BIN to a valid binary.`);
  }

  try {
    const binary = execFileSync('which', ['fasttext'], { encoding: 'utf8' }).trim();
    if (binary && isExecutable(binary)) return binary;
  } catch {
    // Fall through to the actionable error below.
  }
  throw new Error('fastText executable was not found. Install fastText or set FASTTEXT_BIN to its executable.');
}

function runFastText(binary, args) {
  const result = spawnSync(binary, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`fastText command failed with exit code ${result.status}: ${args.join(' ')}`);
  }
}

export function runTraining({ fastTextPath, dataDir, modelDir, seed = 20260912, options = {} }) {
  mkdirSync(modelDir, { recursive: true });
  const inputPath = path.join(dataDir, 'train.txt');
  const outputPrefix = path.join(modelDir, 'nearby-restaurant-classifier');
  const trainArgs = buildTrainArgs({ inputPath, outputPrefix, options });
  const quantizeArgs = buildQuantizeArgs({ inputPath, outputPrefix });

  runFastText(fastTextPath, trainArgs);
  runFastText(fastTextPath, quantizeArgs);

  writeFileSync(
    path.join(modelDir, 'training-config.json'),
    `${JSON.stringify({
      seed,
      inputPath,
      outputPrefix,
      options: { ...TRAIN_OPTIONS, ...options },
      trainArgs,
      quantizeArgs,
    }, null, 2)}\n`,
  );
  return { inputPath, outputPrefix, trainArgs, quantizeArgs };
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = path.join(repoRoot, 'apps/web/src/features/nearby-food/training/data');
const modelDir = path.join(repoRoot, 'apps/web/src/features/nearby-food/training/models');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fastTextPath = findFastText();
  const result = runTraining({ fastTextPath, dataDir, modelDir });
  console.log(`Trained fastText model: ${result.outputPrefix}.bin`);
  console.log(`Quantized fastText model: ${result.outputPrefix}.ftz`);
}

