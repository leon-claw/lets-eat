import { describe, expect, it } from 'vitest';
import { parseCatalogCounts } from '../src/adapters/wx-catalog';

describe('catalog counts response', () => {
  it('reads independent large and small dataset counts', () => {
    expect(parseCatalogCounts({ counts: { large: 10, small: 6 } })).toEqual({
      large: 10,
      small: 6,
    });
  });

  it('rejects malformed manifest counts instead of displaying invalid data', () => {
    expect(() => parseCatalogCounts({ counts: { large: -1, small: '6' } })).toThrow('菜单统计响应无效');
  });
});
