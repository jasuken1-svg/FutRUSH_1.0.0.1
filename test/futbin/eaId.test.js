import { describe, expect, it } from 'vitest';
import { BASE_ID_MAX, compareEaIds, idOf, isBaseId, toBaseId } from '../../src/futbin/eaId.js';

describe('eaId helpers', () => {
  describe('toBaseId', () => {
    it('returns the base ID for a standard base card', () => {
      expect(toBaseId(515)).toBe(515);
      expect(toBaseId(231432)).toBe(231432);
    });

    it('extracts the lower 24 bits for special card offsets', () => {
      // 16799987 = 0x10058F3 => % 0x1000000 = 0x58F3 = 22771
      expect(toBaseId(16799987)).toBe(22771);
      // Special offset 0x1000000 + base 515 = 16777731
      expect(toBaseId(16777731)).toBe(515);
      // Double offset 0x2000000 + base 515 = 33554947
      expect(toBaseId(33554947)).toBe(515);
    });

    it('returns 0 for non-positive or invalid IDs', () => {
      expect(toBaseId(0)).toBe(0);
      expect(toBaseId(-10)).toBe(0);
      expect(toBaseId(NaN)).toBe(0);
      expect(toBaseId(null)).toBe(0);
      expect(toBaseId('abc')).toBe(0);
    });
  });

  describe('isBaseId', () => {
    it('returns true for IDs within 1 to BASE_ID_MAX', () => {
      expect(isBaseId(1)).toBe(true);
      expect(isBaseId(515)).toBe(true);
      expect(isBaseId(BASE_ID_MAX)).toBe(true);
    });

    it('returns false for IDs exceeding BASE_ID_MAX or invalid', () => {
      expect(isBaseId(BASE_ID_MAX + 1)).toBe(false);
      expect(isBaseId(16799987)).toBe(false);
      expect(isBaseId(0)).toBe(false);
      expect(isBaseId(-5)).toBe(false);
      expect(isBaseId(null)).toBe(false);
      expect(isBaseId(NaN)).toBe(false);
    });
  });

  describe('idOf', () => {
    it('parses valid positive safe integer IDs without masking', () => {
      expect(idOf(515)).toBe(515);
      expect(idOf('515')).toBe(515);
      expect(idOf(16799987)).toBe(16799987);
      expect(idOf('16799987')).toBe(16799987);
      // Value above 2^31
      expect(idOf(3000000000)).toBe(3000000000);
    });

    it('returns 0 for non-integers, zero, negative or invalid values', () => {
      expect(idOf(0)).toBe(0);
      expect(idOf(-10)).toBe(0);
      expect(idOf(1.5)).toBe(0);
      expect(idOf('invalid')).toBe(0);
      expect(idOf(null)).toBe(0);
      expect(idOf(undefined)).toBe(0);
    });
  });

  describe('compareEaIds', () => {
    it('returns exact when requested and page IDs are identical', () => {
      expect(compareEaIds(515, 515)).toBe('exact');
      expect(compareEaIds(16799987, 16799987)).toBe('exact');
    });

    it('returns exact for 2^31+ IDs when both match', () => {
      expect(compareEaIds(3000000000, 3000000000)).toBe('exact');
    });

    it('returns same_player when requested is TOTW/promo and page is base', () => {
      // Requested special card (16777731 => base 515), page base card (515)
      expect(compareEaIds(16777731, 515)).toBe('same_player');
    });

    it('returns same_player when requested is base and page is TOTW/promo', () => {
      // Requested base card (515), page special card (16777731 => base 515)
      expect(compareEaIds(515, 16777731)).toBe('same_player');
    });

    it('returns mismatch when players have different base IDs', () => {
      expect(compareEaIds(515, 600)).toBe('mismatch');
      expect(compareEaIds(16777731, 600)).toBe('mismatch');
    });

    it('returns mismatch for NaN/null/0/empty requested ID', () => {
      expect(compareEaIds(0, 515)).toBe('mismatch');
      expect(compareEaIds(null, 515)).toBe('mismatch');
      expect(compareEaIds(NaN, 515)).toBe('mismatch');
      expect(compareEaIds('abc', 515)).toBe('mismatch');
    });

    it('returns unverified_base when requested is base card but page provides no ID', () => {
      expect(compareEaIds(515, 0)).toBe('unverified_base');
      expect(compareEaIds(515, null)).toBe('unverified_base');
    });

    it('returns unverified when requested is special card and page provides no ID', () => {
      expect(compareEaIds(16799987, 0)).toBe('unverified');
      expect(compareEaIds(16799987, null)).toBe('unverified');
    });
  });
});
