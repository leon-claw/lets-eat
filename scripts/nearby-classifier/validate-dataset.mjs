import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJsonl, validateDataset } from './dataset.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const filePath = path.join(repoRoot, 'apps/web/src/features/nearby-food/training/data/nearby-restaurant-classification.jsonl');
const records = await readJsonl(filePath);
const result = validateDataset(records);

console.log(`Validated ${records.length} records.`);
console.log(JSON.stringify(result.counts, null, 2));
if (result.errors.length > 0) {
  console.error(`Validation failed with ${result.errors.length} error(s):`);
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Validation passed with zero errors.');
}
