import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const homeMarkup = readFileSync(
  resolve(__dirname, '../src/pages/home/index.wxml'),
  'utf8',
);

describe('home page brand logo', () => {
  it('uses the shared generated logo asset instead of the food emoji placeholder', () => {
    expect(homeMarkup).toContain('src="/assets/brand-logo.png"');
    expect(homeMarkup).toContain('aria-label="今天吃什么 Logo"');
    expect(homeMarkup).not.toContain('>🍜</');
  });
});
