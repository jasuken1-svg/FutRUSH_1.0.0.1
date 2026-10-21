import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { pageWindow, observeEaRequest } = vi.hoisted(() => ({
  pageWindow: { services: {} },
  observeEaRequest: vi.fn()
}));

vi.mock('../../src/utils/dom.js', () => ({ pageWindow }));
vi.mock('../../src/ea/observe.js', () => ({ observeEaRequest }));
vi.mock('../../src/core/logger.js', () => ({ debug: vi.fn(), warnOnce: vi.fn() }));

import { state } from '../../src/core/state.js';
import {
  HIGH_BID_STEPS,
  SPECIAL_OR_HIGH_MIN_BIDS,
  STANDARD_LOW_MIN_BIDS,
  makeAutoBuyCriteria,
  resetCacheBustCounter,
  searchAutoBuyOffers
} from '../../src/ea/market.js';
import { MIN_BIN, stepForPrice } from '../../src/ea/priceSteps.js';

describe('card-specific EA market search', () => {
  beforeEach(() => {
    pageWindow.UTSearchCriteriaDTO = class {};
    pageWindow.services.Item = {
      clearTransferMarketCache: vi.fn(),
      searchTransferMarket: vi.fn(() => Promise.resolve())
    };
    observeEaRequest.mockReset();
    state.botToken = 3;
    state.botRunning = true;
    resetCacheBustCounter();
  });

  afterEach(() => {
    state.botRunning = false;
    delete pageWindow.UTSearchCriteriaDTO;
  });

  it.each([22770, 22771])('searches only the selected card ID %i, not another version', async (cardId) => {
    const criteria = makeAutoBuyCriteria(cardId, 1000);
    expect(criteria.maskedDefId).toBe(cardId);

    observeEaRequest.mockResolvedValue({
      success: true,
      data: {
        items: [515, 22770, 22771].map((definitionId) => ({
          definitionId,
          rating: 88,
          getAuctionData: () => ({ tradeId: definitionId, buyNowPrice: 900 })
        }))
      }
    });

    const result = await searchAutoBuyOffers({ buyNow: 1000, rating: 88 }, cardId, 3);

    expect(result.offers.map((offer) => offer.item.definitionId)).toEqual([cardId]);
  });

  describe('makeAutoBuyCriteria maxBuy step snapping', () => {
    it('snaps maxBuy to EA price step and clamps to MIN_BIN', () => {
      expect(makeAutoBuyCriteria(12345, 975).maxBuy).toBe(950);
      expect(makeAutoBuyCriteria(12345, 150).maxBuy).toBe(MIN_BIN);
      expect(makeAutoBuyCriteria(12345, 50).maxBuy).toBe(MIN_BIN);
      expect(makeAutoBuyCriteria(12345, 10250).maxBuy).toBe(10250);
      expect(makeAutoBuyCriteria(12345, 10300).maxBuy).toBe(10250);
    });

    it('reads maxBuy from target object and rounds down', () => {
      const criteria = makeAutoBuyCriteria({ eaId: 12345, buyNow: 4750 });
      expect(criteria.maxBuy).toBe(4700);
    });
  });

  describe('cache busting rotation and query variation', () => {
    it('rotates minBid and maxBid for targets with buyNow >= 1500 across steps', () => {
      const target = { eaId: 100, buyNow: 5000 };

      // Step 0: minBid is 0 (omitted), maxBid is first in high bid pool
      const c0 = makeAutoBuyCriteria(target, 5000, { cacheBustStep: 0 });
      expect(c0.minBid).toBeUndefined();
      expect(c0.maxBid).toBe(HIGH_BID_STEPS[0]);

      // Step 1: minBid is 150, maxBid is HIGH_BID_STEPS[0]
      const c1 = makeAutoBuyCriteria(target, 5000, { cacheBustStep: 1 });
      expect(c1.minBid).toBe(150);
      expect(c1.maxBid).toBe(HIGH_BID_STEPS[0]);

      // Step 2: minBid is 200
      const c2 = makeAutoBuyCriteria(target, 5000, { cacheBustStep: 2 });
      expect(c2.minBid).toBe(200);

      // Step 10: minBid is 600, maxBid is HIGH_BID_STEPS[0]
      const c10 = makeAutoBuyCriteria(target, 5000, { cacheBustStep: 10 });
      expect(c10.minBid).toBe(600);
      expect(c10.maxBid).toBe(HIGH_BID_STEPS[0]);

      // Step 11: wraps minBid back to 0 (omitted) and advances maxBid
      const c11 = makeAutoBuyCriteria(target, 5000, { cacheBustStep: 11 });
      expect(c11.minBid).toBeUndefined();
      expect(c11.maxBid).toBe(HIGH_BID_STEPS[1]);
    });

    it('limits minBid pool to [0, 150] for cheap standard cards (< 1500)', () => {
      const target = { eaId: 200, buyNow: 800, raretype: 0 };

      const c0 = makeAutoBuyCriteria(target, 800, { cacheBustStep: 0 });
      expect(c0.minBid).toBeUndefined();
      expect(c0.maxBid).toBe(HIGH_BID_STEPS[0]);

      const c1 = makeAutoBuyCriteria(target, 800, { cacheBustStep: 1 });
      expect(c1.minBid).toBe(150);
      expect(c1.maxBid).toBe(HIGH_BID_STEPS[0]);

      // Step 2 wraps minBid back to 0 and advances maxBid
      const c2 = makeAutoBuyCriteria(target, 800, { cacheBustStep: 2 });
      expect(c2.minBid).toBeUndefined();
      expect(c2.maxBid).toBe(HIGH_BID_STEPS[1]);

      const c3 = makeAutoBuyCriteria(target, 800, { cacheBustStep: 3 });
      expect(c3.minBid).toBe(150);
      expect(c3.maxBid).toBe(HIGH_BID_STEPS[1]);
    });

    it('uses extended minBid pool for special cards even when buyNow < 1500', () => {
      const specialTarget = { eaId: 300, buyNow: 1200, raretype: 3 };
      const c2 = makeAutoBuyCriteria(specialTarget, 1200, { cacheBustStep: 2 });
      expect(c2.minBid).toBe(200);
    });

    it('ensures minBid never reaches or exceeds buyNow', () => {
      const cheapTarget = { eaId: 400, buyNow: 200 };
      for (let step = 0; step < 20; step++) {
        const c = makeAutoBuyCriteria(cheapTarget, 200, { cacheBustStep: step });
        if (c.minBid !== undefined) {
          expect(c.minBid).toBeLessThan(200);
        }
      }
    });

    it('disables cache busting when disableCacheBust is true', () => {
      const criteria = makeAutoBuyCriteria({ eaId: 500, buyNow: 5000 }, 5000, { disableCacheBust: true });
      expect(criteria.minBid).toBeUndefined();
      expect(criteria.maxBid).toBeUndefined();
    });

    it('all maxBid steps are valid EA price steps of 1000', () => {
      HIGH_BID_STEPS.forEach((price) => {
        expect(stepForPrice(price)).toBe(1000);
        expect(price % 1000).toBe(0);
        expect(price).toBeGreaterThanOrEqual(14990000);
        expect(price).toBeLessThanOrEqual(15000000);
      });
    });

    it('consecutive searchAutoBuyOffers calls produce rotating query criteria', async () => {
      observeEaRequest.mockResolvedValue({
        success: true,
        data: { items: [] }
      });

      const capturedCriteria = [];
      pageWindow.services.Item.searchTransferMarket = vi.fn((crit) => {
        capturedCriteria.push({ minBid: crit.minBid, maxBid: crit.maxBid });
        return Promise.resolve();
      });

      const target = { eaId: 999, buyNow: 5000 };
      await searchAutoBuyOffers(target, 999, 3);
      await searchAutoBuyOffers(target, 999, 3);
      await searchAutoBuyOffers(target, 999, 3);

      expect(capturedCriteria).toHaveLength(3);
      // Verify query hash signatures are unique between consecutive calls
      expect(capturedCriteria[0]).not.toEqual(capturedCriteria[1]);
      expect(capturedCriteria[1]).not.toEqual(capturedCriteria[2]);
    });
  });
});
