import { describe, expect, it } from 'vitest';
import { normalizePlayerName } from '../../src/utils/strings.js';

describe('normalizePlayerName', () => {
  it('removes accents and normalizes letter case', () => {
    expect(normalizePlayerName('Kyl\u00edAN Mbapp\u00e9')).toBe('kylian mbappe');
  });

  it('replaces punctuation and repeated separators with spaces', () => {
    // Avoid uppercase I: Turkish locale lowercases it to dotless ı, which the ASCII filter removes.
    expect(normalizePlayerName("  O'R\u00c9\u00c9LLY--Jr.  ")).toBe('o reelly jr');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizePlayerName('')).toBe('');
  });
});
