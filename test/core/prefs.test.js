import { afterEach, describe, expect, it, vi } from 'vitest';

const { storage, warnOnceMock, errorMock, setLogLevelMock } = vi.hoisted(() => ({
  storage: new Map(),
  warnOnceMock: vi.fn(),
  errorMock: vi.fn(),
  setLogLevelMock: vi.fn()
}));

vi.mock('../../src/utils/dom.js', () => ({
  pageStorage: () => ({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  })
}));

vi.mock('../../src/core/logger.js', () => ({
  error: errorMock,
  setLogLevel: setLogLevelMock,
  warnOnce: warnOnceMock
}));

import { CONFIG } from '../../src/core/config.js';
import { applyPrefs, loadPrefs, resetPrefs, savePrefs, validatePrefs } from '../../src/core/prefs.js';

const defaults = {
  targetAdd: {
    priceSource: 'ea',
    discountRate: 0.1,
    maxSearches: 5,
    searchGapMs: [1200, 1800],
    actionGapMs: [1500, 2500],
    outlierRatio: 0.9
  },
  debug: false
};

afterEach(() => {
  storage.clear();
  warnOnceMock.mockClear();
  errorMock.mockClear();
  setLogLevelMock.mockClear();
  Object.assign(CONFIG.targetAdd, {
    priceSource: 'ea',
    discountRate: 0.1,
    maxSearches: 5,
    searchGapMs: [1200, 1800],
    actionGapMs: [1500, 2500],
    outlierRatio: 0.9,
    maxConsecutiveErrors: 2
  });
});

describe('validatePrefs', () => {
  it.each([
    ['priceSource EA', { targetAdd: { priceSource: 'ea' } }, 'priceSource', 'ea'],
    ['priceSource FutBIN', { targetAdd: { priceSource: 'futbin' } }, 'priceSource', 'futbin'],
    ['discountRate zero / disabled', { targetAdd: { discountRate: 0 } }, 'discountRate', 0],
    ['discountRate lower interior', { targetAdd: { discountRate: 0.05 } }, 'discountRate', 0.05],
    ['discountRate upper boundary', { targetAdd: { discountRate: 0.5 } }, 'discountRate', 0.5],
    ['maxSearches lower boundary', { targetAdd: { maxSearches: 1 } }, 'maxSearches', 1],
    ['maxSearches upper boundary', { targetAdd: { maxSearches: 8 } }, 'maxSearches', 8],
    ['maxSearches interior', { targetAdd: { maxSearches: 4 } }, 'maxSearches', 4],
    ['search gap lower boundary', { targetAdd: { searchGapMs: [500, 500] } }, 'searchGapMs', [500, 500]],
    ['search gap interior', { targetAdd: { searchGapMs: [700, 900] } }, 'searchGapMs', [700, 900]],
    ['action gap lower boundary', { targetAdd: { actionGapMs: [200, 200] } }, 'actionGapMs', [200, 200]],
    ['action gap interior', { targetAdd: { actionGapMs: [300, 500] } }, 'actionGapMs', [300, 500]],
    ['outlier disabled', { targetAdd: { outlierRatio: 0 } }, 'outlierRatio', 0],
    ['outlier lower boundary', { targetAdd: { outlierRatio: 0.5 } }, 'outlierRatio', 0.5],
    ['outlier upper boundary', { targetAdd: { outlierRatio: 0.95 } }, 'outlierRatio', 0.95],
    ['debug true', { debug: true }, 'debug', true],
    ['debug false', { debug: false }, 'debug', false]
  ])('accepts %s', (_name, raw, key, expected) => {
    const prefs = validatePrefs(raw);
    const value = key === 'debug' ? prefs.debug : prefs.targetAdd[key];
    expect(value).toEqual(expected);
  });

  it.each([
    ['priceSource', { priceSource: 'EA' }],
    ['discountRate negative', { discountRate: -0.01 }],
    ['discountRate above max', { discountRate: 0.51 }],
    ['discountRate wrong type', { discountRate: '0.1' }],
    ['maxSearches low', { maxSearches: 0 }],
    ['maxSearches high', { maxSearches: 9 }],
    ['maxSearches fractional', { maxSearches: 2.5 }],
    ['maxSearches wrong type', { maxSearches: '3' }],
    ['search gap below minimum', { searchGapMs: [499, 600] }],
    ['search gap reversed', { searchGapMs: [700, 600] }],
    ['search gap wrong type', { searchGapMs: '500,600' }],
    ['action gap below minimum', { actionGapMs: [199, 300] }],
    ['action gap reversed', { actionGapMs: [400, 300] }],
    ['action gap wrong type', { actionGapMs: [200, '300'] }],
    ['outlier below range', { outlierRatio: 0.49 }],
    ['outlier above range', { outlierRatio: 0.96 }],
    ['outlier wrong type', { outlierRatio: '0.8' }]
  ])('defaults invalid %s', (_name, targetAdd) => {
    const prefs = validatePrefs({ targetAdd });
    for (const [key, value] of Object.entries(targetAdd)) {
      expect(prefs.targetAdd[key]).toEqual(defaults.targetAdd[key]);
    }
  });

  it('defaults a debug value with the wrong type', () => {
    expect(validatePrefs({ debug: 'true' }).debug).toBe(false);
  });

  it('fills every omitted preference and ignores unknown fields', () => {
    expect(validatePrefs({ targetAdd: { extra: 42 }, extra: true })).toEqual(defaults);
  });
});

describe('prefs storage and application', () => {
  it('uses defaults when no record exists', () => {
    expect(loadPrefs()).toEqual(defaults);
  });

  it('uses defaults and warns once for malformed JSON', () => {
    storage.set('futrush-prefs', '{');

    expect(loadPrefs()).toEqual(defaults);
    expect(warnOnceMock).toHaveBeenCalledWith(
      'storage-json:futrush-prefs',
      '[FutRUSH:storage]',
      expect.stringContaining('varsayılanlar'),
      'futrush-prefs',
      expect.stringContaining('JSON')
    );
  });

  it('loads a valid stored record', () => {
    const saved = { targetAdd: { ...defaults.targetAdd, priceSource: 'futbin', maxSearches: 8 }, debug: true };
    storage.set('futrush-prefs', JSON.stringify(saved));

    expect(loadPrefs()).toEqual(saved);
  });

  it('round-trips preferences through storage', () => {
    const prefs = {
      targetAdd: { priceSource: 'futbin', discountRate: 0.15, maxSearches: 3, searchGapMs: [800, 1400], actionGapMs: [400, 700], outlierRatio: 0.75 },
      debug: true
    };

    savePrefs(prefs);

    expect(loadPrefs()).toEqual(prefs);
  });

  it('applies target settings without changing maxConsecutiveErrors', () => {
    const before = CONFIG.targetAdd.maxConsecutiveErrors;
    const prefs = validatePrefs({
      targetAdd: { priceSource: 'futbin', discountRate: 0.2, maxSearches: 8, searchGapMs: [500, 600], actionGapMs: [200, 300], outlierRatio: 0 },
      debug: true
    });

    applyPrefs(prefs);

    expect(CONFIG.targetAdd).toMatchObject(prefs.targetAdd);
    expect(CONFIG.targetAdd.maxConsecutiveErrors).toBe(before);
    expect(setLogLevelMock).toHaveBeenCalledWith('debug');
  });

  it('resets stored and applied preferences to defaults', () => {
    storage.set('futrush-prefs', JSON.stringify({ debug: true, targetAdd: { priceSource: 'futbin' } }));

    expect(resetPrefs()).toEqual(defaults);
    expect(loadPrefs()).toEqual(defaults);
    expect(CONFIG.targetAdd.priceSource).toBe('ea');
    expect(setLogLevelMock).toHaveBeenLastCalledWith('info');
  });
});
