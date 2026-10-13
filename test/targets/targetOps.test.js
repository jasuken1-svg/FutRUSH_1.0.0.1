import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let normalizeTarget;
let findDuplicateTarget;
let originalWindow;
let originalUnsafeWindow;

beforeAll(async () => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  originalUnsafeWindow = Object.getOwnPropertyDescriptor(globalThis, 'unsafeWindow');
  const pageWindowStub = { localStorage: { getItem: () => null, setItem: () => {} } };
  globalThis.window = pageWindowStub;
  globalThis.unsafeWindow = pageWindowStub;

  ({ normalizeTarget } = await import('../../src/targets/targetStore.js'));
  ({ findDuplicateTarget } = await import('../../src/targets/targetOps.js'));
});

afterAll(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete globalThis.window;
  if (originalUnsafeWindow) Object.defineProperty(globalThis, 'unsafeWindow', originalUnsafeWindow);
  else delete globalThis.unsafeWindow;
});

describe('normalizeTarget live mode', () => {
  it('rejects NaN ratings', () => {
    expect(normalizeTarget({ name: 'Player', rating: 'invalid', price: 100 }, 'live')).toBeNull();
  });

  it('rounds price 0.4 and clamps it to one', () => {
    // Existing live-mode behavior clamps a positive fractional price that rounds to zero up to one.
    expect(normalizeTarget({ name: 'Player', rating: 90, price: 0.4 }, 'live')).toMatchObject({
      rating: 90,
      price: 1,
      buyNow: 1
    });
  });

  it('uses futbinId in the fallback ID when id is absent', () => {
    expect(normalizeTarget({
      name: 'Player', rating: 90, price: 100, futbinId: 123
    }, 'live').id).toBe('futbin:123');
  });

  it('falls back to name and rating when both id and futbinId are absent', () => {
    expect(normalizeTarget({ name: 'Player', rating: 90, price: 100 }, 'live').id).toBe('Player:90');
  });

  it('rejects records without a string name or finite price', () => {
    expect(normalizeTarget({ name: 12, rating: 90, price: 100 }, 'live')).toBeNull();
    expect(normalizeTarget({ name: 'Player', rating: 90, price: 'invalid' }, 'live')).toBeNull();
  });
});

describe('normalizeTarget savedList mode', () => {
  it('converts a NaN rating to zero instead of rejecting the record', () => {
    // Existing saved-list mode preserves records with non-numeric ratings and normalizes that rating to zero.
    expect(normalizeTarget({ name: 'Player', rating: 'invalid', price: 100 }, 'savedList'))
      .toMatchObject({ rating: 0, price: 100 });
  });

  it('rounds price 0.4 to zero while buyNow is clamped to one', () => {
    // Existing saved-list mode permits a positive fractional price, then rounds it to zero without clamping it.
    expect(normalizeTarget({ name: 'Player', rating: 90, price: 0.4 }, 'savedList'))
      .toMatchObject({ price: 0, buyNow: 1 });
  });

  it('uses futbinId in the fallback ID when id is absent', () => {
    expect(normalizeTarget({
      name: 'Player', rating: 90, price: 100, futbinId: 123
    }, 'savedList').id).toBe('123');
  });

  it('falls back to name and rating when both id and futbinId are absent', () => {
    expect(normalizeTarget({ name: 'Player', rating: 90, price: 100 }, 'savedList').id)
      .toBe('Player:90');
  });

  it('rejects records whose price is not positive', () => {
    expect(normalizeTarget({ name: 'Player', rating: 90, price: 0 }, 'savedList')).toBeNull();
    expect(normalizeTarget({ name: 'Player', rating: 90, price: 'invalid' }, 'savedList')).toBeNull();
  });
});

describe('findDuplicateTarget', () => {
  const existing = { name: 'Player One', rating: 90, futbinId: '123' };

  it('matches by Futbin ID', () => {
    expect(findDuplicateTarget([existing], { name: 'Different Name', rating: 80, futbinId: 123 }))
      .toBe(existing);
  });

  it('matches by case-insensitive trimmed name and rating', () => {
    expect(findDuplicateTarget([existing], { name: ' player one ', rating: 90, futbinId: '999' }))
      .toBe(existing);
  });

  it('uses only name and rating when Futbin ID matching is disabled', () => {
    expect(findDuplicateTarget(
      [existing],
      { name: 'Player One', rating: 90, futbinId: '999' },
      { matchFutbinId: false }
    )).toBe(existing);
    expect(findDuplicateTarget(
      [existing],
      { name: 'Different Name', rating: 80, futbinId: '123' },
      { matchFutbinId: false }
    )).toBeUndefined();
  });
});
