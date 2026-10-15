import { describe, expect, it } from 'vitest';
import { buyNowStep, floorPrice, parsePrice, parseFutbinPrice } from '../../src/utils/format.js';

describe('parsePrice', () => {
  it.each([
    ['1234', 1234],
    ['1.234', 1234],
    ['1,234', 1234],
    ['1.5K', 1500],
    ['1,5k', 1500],
    ['2M', 2000000],
    ['', 0],
    ['no price', 0],
    ['---', 0]
  ])('parses %j as %i', (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it('exports parseFutbinPrice as the same function', () => {
    expect(parseFutbinPrice).toBe(parsePrice);
  });
});

describe('buyNowStep', () => {
  it.each([
    [1000, 50],
    [1001, 100],
    [10000, 100],
    [10001, 250],
    [50000, 250],
    [50001, 500],
    [100000, 500],
    [100001, 1000]
  ])('returns the step for price %i', (price, expected) => {
    expect(buyNowStep(price)).toBe(expected);
  });

  describe('floorPrice', () => {
    it.each([
      [2111, 2100],
      [111111, 111000],
      [10000, 10000],
      [149, 0]
    ])('completes %i down to an EA tier', (price, expected) => {
      expect(floorPrice(price)).toBe(expected);
    });
  });
});
