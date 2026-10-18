import { describe, expect, it } from 'vitest';
import { getFutbinRowPrice, formatFutbinRowPrice, getPlatform } from '../../src/futbin/platform.js';
import { validatePrefs, setPlatform } from '../../src/core/prefs.js';

describe('platform preference & price reading', () => {
  it('defaults platform to "ps" when preferences have no platform field (legacy records)', () => {
    const legacyPrefs = {
      targetAdd: {
        priceSource: 'ea',
        discountRate: 0.1
      },
      debug: false
    };
    const validated = validatePrefs(legacyPrefs);
    expect(validated.platform).toBe('ps');
  });

  it('validates and preserves platform = "pc"', () => {
    const prefs = {
      platform: 'pc',
      targetAdd: {
        priceSource: 'futbin'
      }
    };
    const validated = validatePrefs(prefs);
    expect(validated.platform).toBe('pc');
  });

  it('falls back to "ps" for invalid platform values', () => {
    expect(validatePrefs({ platform: 'xbox' }).platform).toBe('ps');
    expect(validatePrefs({ platform: null }).platform).toBe('ps');
    expect(validatePrefs({ platform: 123 }).platform).toBe('ps');
    expect(validatePrefs({}).platform).toBe('ps');
    expect(validatePrefs(null).platform).toBe('ps');
  });

  it('reads correct platform price from FutBIN row', () => {
    const row = {
      playerid: '267530',
      ps_LCPrice: '83000',
      pc_LCPrice: '95500'
    };

    expect(getFutbinRowPrice(row, 'ps')).toBe(83000);
    expect(getFutbinRowPrice(row, 'pc')).toBe(95500);
  });

  it('returns null when price is 0, empty or missing, and never falls back to other platform', () => {
    const psOnlyRow = {
      playerid: '267530',
      ps_LCPrice: '83000',
      pc_LCPrice: '0'
    };
    expect(getFutbinRowPrice(psOnlyRow, 'pc')).toBeNull();

    const pcOnlyRow = {
      playerid: '267530',
      ps_LCPrice: '',
      pc_LCPrice: '95500'
    };
    expect(getFutbinRowPrice(pcOnlyRow, 'ps')).toBeNull();

    const noPriceRow = {
      playerid: '267530'
    };
    expect(getFutbinRowPrice(noPriceRow, 'ps')).toBeNull();
    expect(getFutbinRowPrice(noPriceRow, 'pc')).toBeNull();
    expect(getFutbinRowPrice(null, 'ps')).toBeNull();
  });

  it('formats row price with platform prefix and localized number', () => {
    const row = {
      playerid: '267530',
      ps_LCPrice: '83000',
      pc_LCPrice: '0'
    };

    expect(formatFutbinRowPrice(row, 'ps')).toMatch(/PS fiyat: 83[.,]000/);
    expect(formatFutbinRowPrice(row, 'pc')).toBe('PC fiyat: fiyat yok');
  });

  it('uses active platform from getPlatform() as default argument', () => {
    const row = {
      playerid: '267530',
      ps_LCPrice: '83000',
      pc_LCPrice: '95500'
    };

    setPlatform('ps');
    expect(getPlatform()).toBe('ps');
    expect(getFutbinRowPrice(row)).toBe(83000);

    setPlatform('pc');
    expect(getPlatform()).toBe('pc');
    expect(getFutbinRowPrice(row)).toBe(95500);

    // Reset back to ps
    setPlatform('ps');
  });
});
