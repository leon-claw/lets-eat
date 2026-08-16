import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CatalogDocumentSchema,
  DatasetTypeSchema,
  type CatalogDocument,
  type CatalogItem,
  type CatalogManifest,
  type DatasetType,
} from '@lets-eat/contracts';

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`);
  return `{${entries.join(',')}}`;
}

export class CatalogService {
  private constructor(
    readonly rootDirectory: string,
    private readonly catalogs: ReadonlyMap<string, CatalogDocument>,
    private readonly manifest: CatalogManifest,
  ) {}

  static async fromDirectory(rootDirectory: string, version: string): Promise<CatalogService> {
    const entries = await readdir(rootDirectory, { withFileTypes: true });
    const catalogs = new Map<string, CatalogDocument>();

    for (const entry of entries) {
      if (!entry.isDirectory() || !/^v[1-9]\d*$/.test(entry.name)) continue;
      const raw = await readFile(join(rootDirectory, entry.name, 'catalog.json'), 'utf8');
      const catalog = CatalogDocumentSchema.parse(JSON.parse(raw));
      if (catalog.catalogVersion !== entry.name) {
        throw new Error(
          `Catalog version mismatch: expected ${entry.name}, received ${catalog.catalogVersion}`,
        );
      }
      catalogs.set(entry.name, catalog);
    }

    const catalog = catalogs.get(version);
    if (!catalog) throw new Error(`Current catalog version not found: ${version}`);

    const catalogHash = createHash('sha256')
      .update(canonicalize(catalog))
      .digest('hex');
    const counts = catalog.items.reduce(
      (result, item) => ({ ...result, [item.datasetType]: result[item.datasetType] + 1 }),
      { large: 0, small: 0 },
    );

    return new CatalogService(rootDirectory, catalogs, {
      catalogVersion: version,
      catalogHash,
      catalogUrl: `/api/catalog/${version}`,
      counts,
    });
  }

  getManifest(): CatalogManifest {
    return this.manifest;
  }

  getCatalog(version: string): CatalogDocument | null {
    return this.catalogs.get(version) ?? null;
  }

  getCatalogWithHash(version: string): { catalog: CatalogDocument; catalogHash: string } | null {
    const catalog = this.catalogs.get(version);
    if (!catalog) return null;
    return {
      catalog,
      catalogHash: createHash('sha256').update(canonicalize(catalog)).digest('hex'),
    };
  }

  getCurrentSelection(datasetType: DatasetType): {
    catalogVersion: string;
    catalogHash: string;
    datasetType: DatasetType;
    items: CatalogItem[];
  } {
    DatasetTypeSchema.parse(datasetType);
    const catalog = this.catalogs.get(this.manifest.catalogVersion);
    if (!catalog) throw new Error(`Current catalog version not found: ${this.manifest.catalogVersion}`);
    return {
      catalogVersion: this.manifest.catalogVersion,
      catalogHash: this.manifest.catalogHash,
      datasetType,
      items: catalog.items.filter((item) => item.datasetType === datasetType).sort((left, right) => left.order - right.order),
    };
  }
}
