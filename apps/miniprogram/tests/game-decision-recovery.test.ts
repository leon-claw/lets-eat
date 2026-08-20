import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('game decision recovery', () => {
  it('uses the durable decision queue instead of an in-memory chain', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/pages/game/index.ts'), 'utf8');
    expect(source).toContain('DecisionQueue');
    expect(source).toContain('createWxDecisionOperationStore');
    expect(source).not.toContain('multiplayerDecisionChain');
  });

  it('flushes before completing an exhausted multiplayer round', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/pages/game/index.ts'), 'utf8');
    expect(source).toContain('multiplayerDecisionQueue.flush');
    expect(source).toContain('completeRound');
  });
});
