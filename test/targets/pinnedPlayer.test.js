import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const { findDuplicateTarget, mergeTargetPlayers, saveTargets, setTargetStatus, emit } = vi.hoisted(() => ({
  findDuplicateTarget: vi.fn(),
  mergeTargetPlayers: vi.fn(),
  saveTargets: vi.fn(),
  setTargetStatus: vi.fn(),
  emit: vi.fn()
}));

const { fetchFutbinPlayerId } = vi.hoisted(() => ({ fetchFutbinPlayerId: vi.fn() }));

vi.mock('../../src/utils/dom.js', () => ({ visibleElement: () => true }));
vi.mock('../../src/futbin/playerLookup.js', () => ({ fetchFutbinPlayerId }));
vi.mock('../../src/targets/targetOps.js', () => ({
  findDuplicateTarget,
  mergeTargetPlayers,
  targetEaIdKey: (target) => JSON.stringify([
    String(target.name),
    Number(target.rating),
    target.futbinId == null ? null : String(target.futbinId)
  ])
}));
vi.mock('../../src/targets/targetStore.js', () => ({ saveTargets }));
vi.mock('../../src/targets/targetStatus.js', () => ({ setTargetStatus }));
vi.mock('../../src/core/events.js', () => ({ emit }));

import { addPinnedPlayerToTargets, selectedPinnedPlayer } from '../../src/targets/pinnedPlayer.js';

let originalDocument;

function setPage(html) {
  globalThis.document = new JSDOM(html).window.document;
}

beforeEach(() => {
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  findDuplicateTarget.mockReset();
  mergeTargetPlayers.mockReset();
  fetchFutbinPlayerId.mockReset();
  saveTargets.mockReset();
  setTargetStatus.mockReset();
  emit.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else delete globalThis.document;
  vi.restoreAllMocks();
});

describe('selectedPinnedPlayer', () => {
  it.each([22770, 22771])('uses the selected card image ID %i instead of its common player ID', (cardId) => {
    setPage(
      '<ul class="ut-pinned-list">' +
        '<li class="listFUTItem selected" data-player-id="515">' +
          '<span class="name">Player One</span><span class="rating">88</span>' +
          '<img src="/players/' + cardId + '.png">' +
        '</li></ul>'
    );

    expect(selectedPinnedPlayer()).toMatchObject({ name: 'Player One', rating: 88, eaId: cardId });
  });

  it('prefers the selected card definition ID over a generic player ID', () => {
    setPage(
      '<ul class="ut-pinned-list">' +
        '<li class="listFUTItem selected" data-player-id="515">' +
          '<span class="name">Player One</span><span class="rating">88</span>' +
          '<span data-definition-id="22770"></span><img src="/players/515.png">' +
        '</li></ul>'
    );

    expect(selectedPinnedPlayer().eaId).toBe(22770);
  });

  it('returns the player with no selected card ID when card identity is unavailable', () => {
    setPage(
      '<ul class="ut-pinned-list">' +
        '<li class="listFUTItem selected" data-player-id="515">' +
          '<span class="name">Player One</span><span class="rating">88</span>' +
        '</li></ul>' +
        '<input class="ut-text-input-control" data-definition-id="515">'
    );

    expect(selectedPinnedPlayer()).toMatchObject({
      name: 'Player One',
      rating: 88,
      eaId: 0
    });
  });
});

describe('addPinnedPlayerToTargets', () => {
  it('resolves the selected card through the FutBIN lookup before adding a target', async () => {
    setPage(
      '<ul class="ut-pinned-list">' +
        '<li class="listFUTItem selected" data-player-id="515">' +
          '<span class="name">Player One</span><span class="rating">88</span>' +
          '<img src="/players/22770.png"><span data-price="1200"></span>' +
        '</li></ul>'
    );
    fetchFutbinPlayerId.mockResolvedValue(22770);
    mergeTargetPlayers.mockReturnValue(1);

    await addPinnedPlayerToTargets();

    expect(fetchFutbinPlayerId).toHaveBeenCalledWith({
      name: 'Player One',
      rating: 88,
      returnDetails: true,
      selectedCardId: 22770
    });
    expect(mergeTargetPlayers).toHaveBeenCalledWith([expect.objectContaining({
      name: 'Player One',
      rating: 88,
      futbinId: null,
      eaId: 22770,
      eaIdTargetKey: JSON.stringify(['Player One', 88, null]),
      price: 1200,
      versionLabel: 'Gold'
    })]);
  });

  it('uses a name and rating lookup when the selected card ID is unavailable', async () => {
    setPage(
      '<ul class="ut-pinned-list">' +
        '<li class="listFUTItem selected" data-player-id="515">' +
          '<span class="name">Player One</span>' +
          '<span data-price="1200"></span>' +
        '</li></ul>'
    );
    const lookupArguments = [];
    fetchFutbinPlayerId.mockImplementation(async (target) => {
      lookupArguments.push({ ...target });
      target.rating = 88;
      return 22770;
    });
    mergeTargetPlayers.mockReturnValue(1);

    await addPinnedPlayerToTargets();

    expect(lookupArguments).toEqual([{
      name: 'Player One',
      rating: 0,
      returnDetails: true,
      selectedCardId: 0
    }]);
    expect(mergeTargetPlayers).toHaveBeenCalledWith([expect.objectContaining({
      name: 'Player One',
      rating: 88,
      eaId: 22770
    })]);
    expect(setTargetStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'success',
      message: expect.stringContaining('(88)')
    }));
  });

  it('replaces an existing target ID when a different card version is selected', async () => {
    setPage(
      '<ul class="ut-pinned-list">' +
        '<li class="listFUTItem selected" data-player-id="515">' +
          '<span class="name">Player One</span><span class="rating">88</span>' +
          '<img src="/players/22771.png"><span data-price="1200"></span>' +
        '</li></ul>'
    );
    const existing = { name: 'Player One', rating: 88, futbinId: null, eaId: 515 };
    fetchFutbinPlayerId.mockResolvedValue(22771);
    mergeTargetPlayers.mockReturnValue(0);
    findDuplicateTarget.mockReturnValue(existing);

    await addPinnedPlayerToTargets();

    expect(existing.eaId).toBe(22771);
    expect(existing.eaIdTargetKey).toBe(JSON.stringify(['Player One', 88, null]));
    expect(saveTargets).toHaveBeenCalledOnce();
  });

  it('does not add a target when FutBIN cannot match the selected card ID', async () => {
    setPage(
      '<ul class="ut-pinned-list">' +
        '<li class="listFUTItem selected" data-player-id="515">' +
          '<span class="name">Player One</span><span class="rating">88</span>' +
          '<img src="/players/22771.png"><span data-price="1200"></span>' +
        '</li></ul>'
    );
    fetchFutbinPlayerId.mockRejectedValue(new Error('Seçili kart kimliği 22771 eşleşmedi.'));

    await addPinnedPlayerToTargets();

    expect(mergeTargetPlayers).not.toHaveBeenCalled();
    expect(setTargetStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'error',
      message: expect.stringContaining('Seçili kart FutBIN ile eşleştirilemedi')
    }));
  });
});
