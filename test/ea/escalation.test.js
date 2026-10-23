import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeEffectiveBuyNow,
  recordEscalationSearch,
  resetEscalationOnPurchase,
  resetEscalationOnManualChange,
  runEscalationSelfTests
} from '../../src/ea/escalation.js';

describe('ea/escalation (Phase 3 - Auto Price Escalation)', () => {
  const now = Date.now();

  describe('computeEffectiveBuyNow', () => {
    it('returns baseBuyNow when escalation is not enabled or steps is 0', () => {
      const target = { buyNow: 1000, price: 2000, priceUpdatedAt: now, escalation: { enabled: false, steps: 3 } };
      const res = computeEffectiveBuyNow(target, { now });
      expect(res.effectiveBuyNow).toBe(1000);
      expect(res.stepsApplied).toBe(0);
    });

    it('applies steps and increments across EA tier step boundaries (950 -> 1000 -> 1100)', () => {
      const target = { buyNow: 950, price: 5000, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 3, steps: 2 } };
      const res = computeEffectiveBuyNow(target, { now });
      expect(res.effectiveBuyNow).toBe(1100);
      expect(res.stepsApplied).toBe(2);
    });

    it('caps effectiveBuyNow to Phase 2 maximum price cap threshold', () => {
      // FutBIN = 1000, threshold = 0.50 -> max allowed = 1500
      // buyNow = 1400, steps = 3. 1400 -> step 1: 1500, step 2: 1600 (exceeds 1500)
      const target = { buyNow: 1400, price: 1000, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 3, steps: 3 } };
      const res = computeEffectiveBuyNow(target, { now, maxPriceCapThreshold: 0.50 });
      expect(res.effectiveBuyNow).toBe(1500);
      expect(res.isAtCeiling).toBe(true);
    });

    it('identifies risk of loss when effective price exceeds FutBIN 95% net after tax', () => {
      // FutBIN = 1000, net = 950. effectiveBuyNow = 1000 -> risk of loss
      const target = { buyNow: 1000, price: 1000, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 1, steps: 0 } };
      const res = computeEffectiveBuyNow(target, { now });
      expect(res.isRiskOfLoss).toBe(true);
    });
  });

  describe('recordEscalationSearch', () => {
    it('increments steps when activeMs reaches afterMinutes', () => {
      const target = {
        name: 'Player Test',
        buyNow: 1000,
        price: 3000,
        priceUpdatedAt: now,
        escalation: { enabled: true, afterMinutes: 5, maxSteps: 3, steps: 0, activeMs: 5 * 60 * 1000 - 500 }
      };
      const res = recordEscalationSearch(target, { matchFound: false, elapsedMs: 1000, canProgress: true }, { now });
      expect(res.steppedUp).toBe(true);
      expect(target.escalation.steps).toBe(1);
      expect(target.escalation.activeMs).toBe(0);
      expect(res.logMessage).toContain('Player Test: 5 dk bulunamadı');
    });

    it('resets activeMs on matchFound but preserves steps', () => {
      const target = {
        name: 'Player Test',
        buyNow: 1000,
        price: 3000,
        priceUpdatedAt: now,
        escalation: { enabled: true, afterMinutes: 10, maxSteps: 3, steps: 2, activeMs: 25000 }
      };
      const res = recordEscalationSearch(target, { matchFound: true, elapsedMs: 1000, canProgress: true }, { now });
      expect(res.steppedUp).toBe(false);
      expect(target.escalation.steps).toBe(2);
      expect(target.escalation.activeMs).toBe(0);
    });

    it('does not progress activeMs when canProgress is false', () => {
      const target = {
        name: 'Player Test',
        buyNow: 1000,
        price: 3000,
        priceUpdatedAt: now,
        escalation: { enabled: true, afterMinutes: 10, maxSteps: 3, steps: 0, activeMs: 1000 }
      };
      recordEscalationSearch(target, { matchFound: false, elapsedMs: 5000, canProgress: false }, { now });
      expect(target.escalation.activeMs).toBe(1000);
    });
  });

  describe('reset functions', () => {
    it('resetEscalationOnPurchase clears steps and activeMs and returns whether it had progress', () => {
      const target = { escalation: { enabled: true, steps: 3, activeMs: 15000, ceilingLogged: true } };
      const hadProgress = resetEscalationOnPurchase(target);
      expect(hadProgress).toBe(true);
      expect(target.escalation.steps).toBe(0);
      expect(target.escalation.activeMs).toBe(0);
      expect(target.escalation.ceilingLogged).toBe(false);

      // Disabled target should return false
      const disabledTarget = { escalation: { enabled: false, steps: 0, activeMs: 0 } };
      expect(resetEscalationOnPurchase(disabledTarget)).toBe(false);

      // Enabled target with 0 steps and 0 activeMs should return false
      const zeroTarget = { escalation: { enabled: true, steps: 0, activeMs: 0 } };
      expect(resetEscalationOnPurchase(zeroTarget)).toBe(false);
    });

    it('resetEscalationOnManualChange clears steps and activeMs', () => {
      const target = { escalation: { enabled: true, steps: 2, activeMs: 5000 } };
      resetEscalationOnManualChange(target);
      expect(target.escalation.steps).toBe(0);
      expect(target.escalation.activeMs).toBe(0);
    });
  });

  describe('runEscalationSelfTests', () => {
    it('runs at least 14 cases and all pass', () => {
      const res = runEscalationSelfTests();
      expect(res.total).toBeGreaterThanOrEqual(14);
      expect(res.failed).toBe(0);
      expect(res.passed).toBe(res.total);
    });
  });
});
