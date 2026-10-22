import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  getTransferListCapacity,
  getTransferListCount,
  isTransferListFull,
  getUnassignedCount,
  getWatchlistCount,
  checkPilesProtection,
  resetPilesState,
  PILE_IDS
} from '../../src/ea/piles.js';
import { pageWindow } from '../../src/utils/dom.js';
import { state } from '../../src/core/state.js';

describe('ea/piles', () => {
  let mockGovernor;
  let dom;

  beforeAll(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
  });

  beforeEach(() => {
    resetPilesState();
    delete pageWindow.repositories;
    document.body.innerHTML = '';
    state.snipeSettings = {
      transferListCapacity: 100,
      transferListWarnThreshold: 5
    };
    mockGovernor = {
      halt: vi.fn(),
      isHalted: vi.fn(() => false)
    };
  });

  describe('getTransferListCapacity', () => {
    it('reads capacity from repositories.Item.getPileSize(5)', () => {
      pageWindow.repositories = {
        Item: {
          getPileSize: vi.fn((id) => (id === 5 ? 100 : null))
        }
      };
      expect(getTransferListCapacity()).toBe(100);
      expect(pageWindow.repositories.Item.getPileSize).toHaveBeenCalledWith(PILE_IDS.TRANSFER);
    });

    it('falls back to pileSizes._collection[5]', () => {
      pageWindow.repositories = {
        Item: {
          pileSizes: {
            _collection: { '5': 100 }
          }
        }
      };
      expect(getTransferListCapacity()).toBe(100);
    });

    it('falls back to state.snipeSettings.transferListCapacity or 100', () => {
      state.snipeSettings.transferListCapacity = 80;
      expect(getTransferListCapacity()).toBe(80);
      delete state.snipeSettings.transferListCapacity;
      expect(getTransferListCapacity()).toBe(100);
    });
  });

  describe('getTransferListCount', () => {
    it('reads item count from getTransferItems().length without network requests', () => {
      pageWindow.repositories = {
        Item: {
          getTransferItems: vi.fn(() => [{ id: 1 }, { id: 2 }, { id: 3 }])
        }
      };
      expect(getTransferListCount()).toBe(3);
    });

    it('falls back to transfer.count', () => {
      pageWindow.repositories = {
        Item: {
          transfer: { count: 42 }
        }
      };
      expect(getTransferListCount()).toBe(42);
    });

    it('falls back to DOM .ut-tile-transfer-list .total-transfers-data', () => {
      document.body.innerHTML = `
        <div class="ut-tile-transfer-list">
          <div class="total-transfers-data">61Items</div>
        </div>
      `;
      expect(getTransferListCount()).toBe(61);
    });

    it('returns null if neither memory nor DOM is available', () => {
      expect(getTransferListCount()).toBeNull();
    });
  });

  describe('isTransferListFull', () => {
    it('uses repositories.Item.isPileFull(5) if available', () => {
      pageWindow.repositories = {
        Item: {
          isPileFull: vi.fn((id) => id === 5)
        }
      };
      expect(isTransferListFull()).toBe(true);
    });

    it('calculates full when count >= capacity', () => {
      pageWindow.repositories = {
        Item: {
          getPileSize: () => 100,
          getTransferItems: () => new Array(100).fill({})
        }
      };
      expect(isTransferListFull()).toBe(true);
    });

    it('returns null if count cannot be read', () => {
      expect(isTransferListFull()).toBeNull();
    });
  });

  describe('getUnassignedCount and getWatchlistCount', () => {
    it('reads unassigned count from memory', () => {
      pageWindow.repositories = {
        Item: {
          getUnassignedItems: () => [{}, {}]
        }
      };
      expect(getUnassignedCount()).toBe(2);
    });

    it('reads watchlist count from DOM tile fallback', () => {
      document.body.innerHTML = `
        <div class="ut-tile-transfer-targets">
          <div class="total-transfers-data">14Items</div>
        </div>
      `;
      expect(getWatchlistCount()).toBe(14);
    });
  });

  describe('checkPilesProtection', () => {
    it('does NOT halt bot when count is null, but logs warning once and allows search', () => {
      const allowed = checkPilesProtection(mockGovernor);
      expect(allowed).toBe(true);
      expect(mockGovernor.halt).not.toHaveBeenCalled();

      // Second run shouldn't crash or double log unknown
      const secondAllowed = checkPilesProtection(mockGovernor);
      expect(secondAllowed).toBe(true);
    });

    it('halts bot via governor.halt("liste_dolu") when transfer list is full', () => {
      pageWindow.repositories = {
        Item: {
          getPileSize: () => 100,
          getTransferItems: () => new Array(100).fill({})
        }
      };

      const allowed = checkPilesProtection(mockGovernor);
      expect(allowed).toBe(false);
      expect(mockGovernor.halt).toHaveBeenCalledWith('liste_dolu');
    });

    it('warns when remaining space <= warnThreshold but allows search', () => {
      pageWindow.repositories = {
        Item: {
          getPileSize: () => 100,
          getTransferItems: () => new Array(97).fill({}) // 3 remaining <= 5
        }
      };

      const allowed = checkPilesProtection(mockGovernor);
      expect(allowed).toBe(true);
      expect(mockGovernor.halt).not.toHaveBeenCalled();
    });

    it('warns about unassigned cards if present but allows search', () => {
      pageWindow.repositories = {
        Item: {
          getPileSize: () => 100,
          getTransferItems: () => new Array(50).fill({}),
          getUnassignedItems: () => [{}, {}, {}] // 3 unassigned
        }
      };

      const allowed = checkPilesProtection(mockGovernor);
      expect(allowed).toBe(true);
      expect(mockGovernor.halt).not.toHaveBeenCalled();
    });
  });
});
