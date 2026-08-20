import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('result page recovery boundaries', () => {
  it('keeps the custom catalog snapshot until the user leaves the result page', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/pages/result/index.ts'), 'utf8');

    expect(source).toContain('selection.catalogVersion !== result.catalogVersion');
    expect(source).toContain('selection.catalogHash !== result.catalogHash');
    expect(source).toContain('clearStoredMultiplayerRound(roundId);');
    expect(source).toContain('clearWxDecisionQueue(roundId);');
    expect(source).not.toContain('clearRoomCustomCatalog(round.roomId)');
  });

  it('keeps single-player result cleanup local to the single-player round', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/pages/single-result/index.ts'), 'utf8');

    expect(source).toContain('clearStoredSingleRound();');
    expect(source).not.toContain('getRoundResult');
    expect(source).not.toContain('clearRoomCustomCatalog');
  });
});
