import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Vite local Amap config', () => {
  it('reads the two non-empty values from a local config.js', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'lets-eat-amap-config-'));
    temporaryDirectories.push(directory);
    const configPath = path.join(directory, 'config.js');
    writeFileSync(configPath, "window.LETS_EAT_CONFIG = { key: 'fixture-key', securityJsCode: 'fixture-security' };\n");

    const viteConfigModule = await import('./vite.config');
    const reader = (viteConfigModule as unknown as {
      readLocalAmapConfig?: (filePath: string) => { key: string; securityJsCode: string } | null;
    }).readLocalAmapConfig;

    expect(reader).toBeTypeOf('function');
    expect(reader?.(configPath)).toEqual({ key: 'fixture-key', securityJsCode: 'fixture-security' });
  });
});
