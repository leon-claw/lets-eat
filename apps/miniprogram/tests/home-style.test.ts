import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const homeStyles = readFileSync(
  resolve(__dirname, '../src/pages/home/index.wxss'),
  'utf8',
);

describe('home page button sizing', () => {
  it('overrides the native mini program button defaults for the settings button', () => {
    const settingsRule = homeStyles.match(/\.settings-button\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(settingsRule).toMatch(/width:\s*40px\s*!important/);
    expect(settingsRule).toMatch(/min-width:\s*40px\s*!important/);
    expect(settingsRule).toMatch(/height:\s*40px\s*!important/);
    expect(settingsRule).toMatch(/margin:\s*0\s*!important/);
    expect(settingsRule).toMatch(/padding:\s*0\s*!important/);
  });

  it('does not reserve home-page styles for build information', () => {
    expect(homeStyles).not.toContain('.build-info');
  });
});
