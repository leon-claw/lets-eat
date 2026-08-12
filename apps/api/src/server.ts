import { resolve } from 'node:path';
import { createApp } from './app.js';
import { CatalogService } from './catalog/catalog-service.js';

const port = Number(process.env.API_PORT ?? 3001);
const catalogVersion = process.env.CATALOG_VERSION ?? 'v1';
const catalogRoot = resolve(process.env.CATALOG_ROOT ?? 'catalog');
const catalogService = await CatalogService.fromDirectory(catalogRoot, catalogVersion);
const app = createApp({ catalogService });

app.listen(port, '0.0.0.0', () => {
  process.stdout.write(`lets-eat API listening on ${port}\n`);
});
