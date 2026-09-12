import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeDatasetFiles } from './dataset.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(repoRoot, 'apps/web/src/features/nearby-food/training/data');
const seed = 20260912;

const result = await writeDatasetFiles({ outputDir, seed });
console.log(`Generated ${result.records.length} synthetic records with seed ${seed}.`);
console.log(`Training: ${result.partitions.train.length}, validation: ${result.partitions.validation.length}, test: ${result.partitions.test.length}`);
console.log(`Output: ${outputDir}`);
