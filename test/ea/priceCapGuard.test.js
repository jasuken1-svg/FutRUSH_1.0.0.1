import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateMaxAllowedPrice,
  validatePriceCap,
  checkPriceCapGuard,
  DEFAULT_MAX_PRICE_THRESHOLD
} from '../../src/ea/priceCapGuard.js';
import { state } from '../../src/core/state.js';

describe('ea/priceCapGuard (Phase 2 - Stage 3)', () => {
  beforeEach(() => {
    state.snipeSettings = {
      maxPriceCapThreshold: 0.50
    };
  });

  describe('calculateMaxAllowedPrice', () => {
    it('returns null if futbin price is not valid', () => {
      expect(calculateMaxAllowedPrice(null)).toBeNull();
      expect(calculateMaxAllowedPrice(0)).toBeNull();
      expect(calculateMaxAllowedPrice(-500)).toBeNull();
      expect(calculateMaxAllowedPrice('abc')).toBeNull();
    });

    it('calculates max allowed price using 50% threshold and rounds to EA steps', () => {
      // 10,000 * 1.5 = 15,000 (step: 250) -> 15,000
      expect(calculateMaxAllowedPrice(10000)).toBe(15000);

      // 1,000 * 1.5 = 1,500 (step: 100) -> 1,500
      expect(calculateMaxAllowedPrice(1000)).toBe(1500);

      // 2,300 * 1.5 = 3,450 -> stepped down: 3,400 (tier 1000-10000 step is 100)
      expect(calculateMaxAllowedPrice(2300)).toBe(3400);
    });

    it('respects custom threshold rate', () => {
      // 10,000 * (1 + 0.20) = 12,000
      expect(calculateMaxAllowedPrice(10000, 0.20)).toBe(12000);
    });
  });

  describe('validatePriceCap', () => {
    it('allows any price if futbin price is null / 0', () => {
      const res = validatePriceCap(50000, null);
      expect(res.allowed).toBe(true);
      expect(res.maxAllowed).toBeNull();
    });

    it('allows price when buyNow is within threshold', () => {
      // FutBIN = 10,000, max allowed = 15,000, buyNow = 12,000
      const res = validatePriceCap(12000, 10000);
      expect(res.allowed).toBe(true);
      expect(res.maxAllowed).toBe(15000);
    });

    it('rejects price when buyNow exceeds threshold (e.g. accidental extra zero)', () => {
      // FutBIN = 10,000, user typed 100,000 (accident extra zero)
      const res = validatePriceCap(100000, 10000);
      expect(res.allowed).toBe(false);
      expect(res.maxAllowed).toBe(15000);
      expect(res.reason).toContain('Fazla sıfır koruması devrede');
    });
  });

  describe('checkPriceCapGuard', () => {
    it('returns true when offer price is within reference cap', () => {
      const target = { name: 'Player A', price: 10000, buyNow: 9000 };
      expect(checkPriceCapGuard(target, 9000)).toBe(true);
    });

    it('returns false and prevents purchase when offer price exceeds reference cap', () => {
      const target = { name: 'Player A', price: 10000, buyNow: 9000 };
      expect(checkPriceCapGuard(target, 25000)).toBe(false);
    });

    it('allows purchase if target has no FutBIN reference price', () => {
      const target = { name: 'Player Unknown', price: null, buyNow: 50000 };
      expect(checkPriceCapGuard(target, 50000)).toBe(true);
    });
  });
});
