import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packagePath = resolve(process.cwd(), 'package.json');
const configPath = resolve(process.cwd(), 'tsconfig.client-core.json');

describe('mini program client-core build', () => {
  it('compiles the shared runtime as CommonJS for the WeChat loader', () => {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      scripts?: { build?: string };
    };
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
      compilerOptions?: { module?: string };
    };

    expect(packageJson.scripts?.build).toContain('tsconfig.client-core.json');
    expect(config.compilerOptions?.module).toBe('CommonJS');
  });
});
