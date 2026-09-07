import { beforeEach, describe, expect, it } from 'vitest';
import { installFakeWx } from './fake-wx';
import { readStoredSingleRound, saveStoredSingleRound } from '../src/pages/game/single-round-storage';

describe('single-player round storage', () => {
  beforeEach(() => {
    installFakeWx();
  });

  it('restores a custom dataset round snapshot', () => {
    saveStoredSingleRound({
      datasetType: 'custom',
      catalogVersion: 'v1',
      catalogHash: 'hash',
      itemIds: ['large-1', 'small-1', 'small-2'],
      history: [],
    });

    expect(readStoredSingleRound()).toMatchObject({
      datasetType: 'custom',
      itemIds: ['large-1', 'small-1', 'small-2'],
    });
  });
});
