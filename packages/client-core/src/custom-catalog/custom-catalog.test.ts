import { describe, expect, it } from 'vitest';
import { validateCustomCatalog } from './custom-catalog.js';

describe('custom catalog rules', () => {
  it('requires at least three unique item ids', () => {
    expect(validateCustomCatalog(['a', 'b']).ok).toBe(false);
    expect(validateCustomCatalog(['a', 'a', 'b']).ok).toBe(false);
    expect(validateCustomCatalog(['a', 'b', 'c']).ok).toBe(true);
  });
});
