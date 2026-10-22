import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { state } from '../../src/core/state.js';
import { pageWindow } from '../../src/utils/dom.js';
import {
  getBalance,
  applyBalanceProtection,
  syncBalance,
  onBalanceChange,
  resetBalanceStateForTesting
} from '../../src/ea/balance.js';

describe('balance management and sync (Phase 2 - Stage 1)', () => {
  let dom;

  beforeAll(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div class="view-navbar-currency-coins">150.000</div></body></html>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.MutationObserver = dom.window.MutationObserver;
  });

  beforeEach(() => {
    resetBalanceStateForTesting();
    pageWindow.services = {};
    state.targets = [];
    state.currentBalance = null;
  });

  it('reads balance from primary source services.User.getUser().coins.amount', () => {
    pageWindow.services = {
      User: {
        getUser: () => ({
          coins: { amount: 250000 }
        })
      }
    };
    expect(getBalance()).toBe(250000);
  });

  it('falls back to upper bar DOM element using parsePriceInput when service is unavailable', () => {
    pageWindow.services = {};
    const coinEl = document.querySelector('.view-navbar-currency-coins');
    coinEl.textContent = '19.500';
    expect(getBalance()).toBe(19500);
  });

  it('returns null when balance cannot be read from either source (never guesses or defaults to 0)', () => {
    pageWindow.services = {};
    const coinEl = document.querySelector('.view-navbar-currency-coins');
    coinEl.className = 'some-other-class';
    expect(getBalance()).toBe(null);
    coinEl.className = 'view-navbar-currency-coins';
  });

  it('marks targets as insufficientBalance when buyNow exceeds balance and logs to Genel Loglar', () => {
    state.targets = [
      { name: 'Kimmich', buyNow: 50000, insufficientBalance: false },
      { name: 'Davies', buyNow: 15000, insufficientBalance: false }
    ];

    applyBalanceProtection(30000);

    expect(state.targets[0].insufficientBalance).toBe(true);
    expect(state.targets[1].insufficientBalance).toBe(false);

    // Repeated call with same balance should not duplicate log or state
    applyBalanceProtection(30000);
    expect(state.targets[0].insufficientBalance).toBe(true);
  });

  it('automatically reactivates targets when balance recovers and logs reactivation', () => {
    state.targets = [
      { name: 'Kimmich', buyNow: 50000, insufficientBalance: true }
    ];

    applyBalanceProtection(60000);

    expect(state.targets[0].insufficientBalance).toBe(false);
  });

  it('does NOT mark targets as insufficient when balance is null, logs warning once', () => {
    state.targets = [
      { name: 'Kimmich', buyNow: 50000, insufficientBalance: false }
    ];

    applyBalanceProtection(null);

    expect(state.targets[0].insufficientBalance).toBe(false);
  });

  it('notifies onBalanceChange callback when balance changes', () => {
    pageWindow.services = {
      User: {
        getUser: () => ({ coins: { amount: 100000 } })
      }
    };

    const listener = vi.fn();
    const unsub = onBalanceChange(listener);

    syncBalance();
    expect(listener).toHaveBeenCalledWith(100000, null);

    unsub();
  });
});
