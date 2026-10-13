import { afterEach, describe, expect, it, vi } from 'vitest';
import { state } from '../../src/core/state.js';

vi.mock('../../src/targets/targetOps.js', () => ({
  mergeTargetPlayers: vi.fn(() => 2)
}));

vi.mock('../../src/futbin/loader.js', () => ({
  fetchCheapestPlayers: vi.fn()
}));

const { mergeTargetPlayers } = await import('../../src/targets/targetOps.js');
const { fetchCheapestPlayers } = await import('../../src/futbin/loader.js');
const { importCheapestTargets } = await import('../../src/targets/futbinImport.js');

afterEach(() => {
  state.targetLoading = false;
  state.targetStatus = null;
  vi.clearAllMocks();
});

describe('importCheapestTargets fallback status', () => {
  it('omits the fallback note when fallback is false', async () => {
    fetchCheapestPlayers.mockResolvedValue({ players: [], source: 'api', fallback: false });

    await importCheapestTargets(90, 5);

    expect(state.targetStatus).toEqual({
      type: 'success',
      message: '2 oyuncu hedef listesine eklendi.'
    });
    expect(mergeTargetPlayers).toHaveBeenCalledOnce();
  });

  it('adds the fallback note when fallback is true', async () => {
    fetchCheapestPlayers.mockResolvedValue({ players: [], source: 'html', fallback: true });

    await importCheapestTargets(90, 5);

    expect(state.targetStatus).toEqual({
      type: 'success',
      message: '2 oyuncu hedef listesine eklendi (FutBIN yedek kaynağı).'
    });
  });
});
