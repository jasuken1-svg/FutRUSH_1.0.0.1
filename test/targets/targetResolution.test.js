import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { storage, fetchFutbinPlayerId } = vi.hoisted(() => ({
  storage: new Map(),
  fetchFutbinPlayerId: vi.fn()
}));

vi.mock('../../src/utils/dom.js', () => ({
  pageStorage: () => ({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  })
}));
vi.mock('../../src/futbin/playerLookup.js', () => ({ fetchFutbinPlayerId }));

import { state } from '../../src/core/state.js';
import {
  resolveTargetEaId,
  restoreSavedTargets,
  saveTargetSnapshot
} from '../../src/targets/targetOps.js';
import { loadTargetStorage, saveTargets } from '../../src/targets/targetStore.js';

function target(overrides = {}) {
  return {
    id: 'futbin:123',
    name: 'Player One',
    rating: 90,
    eaId: 0,
    price: 1000,
    searches: 3,
    buyNow: 1000,
    futbinId: '123',
    ...overrides
  };
}

function targetKey(player) {
  return JSON.stringify([
    String(player.name),
    Number(player.rating),
    player.futbinId == null ? null : String(player.futbinId)
  ]);
}

beforeEach(() => {
  storage.clear();
  fetchFutbinPlayerId.mockReset();
  state.targets = [];
  state.savedTargetLists = [];
  state.selectedSavedTargetListId = null;
  state.targetStatus = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveTargetEaId', () => {
  it('fetches once and persists a newly resolved identity', async () => {
    const player = target();
    state.targets = [player];
    fetchFutbinPlayerId.mockResolvedValue(456);

    await expect(resolveTargetEaId(player)).resolves.toBe(456);

    expect(fetchFutbinPlayerId).toHaveBeenCalledOnce();
    expect(player.eaIdTargetKey).toBe(targetKey(player));
    expect(JSON.parse(storage.get('futrush-targets'))[0]).toMatchObject({
      eaId: 456,
      eaIdTargetKey: targetKey(player)
    });
  });

  it('does not fetch when a valid EA ID is already associated with the target', async () => {
    const player = target({ eaId: 456, eaIdTargetKey: targetKey(target()) });
    state.targets = [player];

    await expect(resolveTargetEaId(player)).resolves.toBe(456);

    expect(fetchFutbinPlayerId).not.toHaveBeenCalled();
  });

  it('preserves the identity through active and saved target storage', () => {
    const player = target({ eaId: 456, eaIdTargetKey: targetKey(target()) });
    state.targets = [player];
    saveTargets();
    expect(saveTargetSnapshot('Favorites')).toBe(true);

    state.targets = [];
    state.savedTargetLists = [];
    loadTargetStorage();

    expect(state.targets[0]).toMatchObject({
      eaId: 456,
      eaIdTargetKey: player.eaIdTargetKey
    });
    expect(state.savedTargetLists[0].players[0]).toMatchObject({
      eaId: 456,
      eaIdTargetKey: player.eaIdTargetKey
    });

    state.targets = [];
    expect(restoreSavedTargets()).toBe(1);
    expect(state.targets[0]).toMatchObject({
      eaId: 456,
      eaIdTargetKey: player.eaIdTargetKey
    });
  });

  it('re-resolves a malformed EA ID', async () => {
    const player = target({ eaId: '1.5' });
    state.targets = [player];
    fetchFutbinPlayerId.mockResolvedValue(789);

    await expect(resolveTargetEaId(player)).resolves.toBe(789);

    expect(fetchFutbinPlayerId).toHaveBeenCalledOnce();
    expect(player.eaId).toBe(789);
  });

  it.each([
    ['name', (player) => { player.name = 'Updated Player'; }],
    ['rating', (player) => { player.rating = 91; }],
    ['FutBIN ID', (player) => { player.futbinId = '456'; }]
  ])('re-resolves when the player %s changes', async (_field, updatePlayer) => {
    const player = target({ eaId: 456, eaIdTargetKey: targetKey(target()) });
    updatePlayer(player);
    state.targets = [player];
    fetchFutbinPlayerId.mockResolvedValue(789);

    await expect(resolveTargetEaId(player)).resolves.toBe(789);

    expect(fetchFutbinPlayerId).toHaveBeenCalledOnce();
    expect(player.eaIdTargetKey).toBe(targetKey(player));
  });
});
