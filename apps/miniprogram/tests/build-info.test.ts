import { describe, expect, it } from 'vitest';
import {
  createBuildInfoModule,
  formatBuildLabel,
} from '../scripts/write-build-info.mjs';

describe('mini program build information', () => {
  it('formats a fixed build label in Asia/Shanghai time', () => {
    expect(formatBuildLabel('0.2.0', new Date('2026-09-05T06:30:00.000Z'))).toBe(
      'v0.2.0 · 构建于 2026-09-05 14:30',
    );
  });

  it('generates the CommonJS module consumed by the mini program bundle', () => {
    expect(createBuildInfoModule('v0.2.0 · 构建于 2026-09-05 14:30')).toContain(
      'exports.BUILD_LABEL = "v0.2.0 · 构建于 2026-09-05 14:30";',
    );
  });
});
