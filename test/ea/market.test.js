import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { pageWindow, observeEaRequest } = vi.hoisted(() => ({
  pageWindow: { services: {} },
  observeEaRequest: vi.fn()
}));

vi.mock('../../src/utils/dom.js', () => ({ pageWindow }));
vi.mock('../../src/ea/observe.js', () => ({ observeEaRequest }));
vi.mock('../../src/core/logger.js', () => ({ debug: vi.fn(), warnOnce: vi.fn() }));

import { state } from '../../src/core/state.js';
import { makeAutoBuyCriteria, searchAutoBuyOffers } from '../../src/ea/market.js';

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
});
