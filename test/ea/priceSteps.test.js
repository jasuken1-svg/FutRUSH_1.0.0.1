import { describe, it, expect } from 'vitest';
import { MIN_BIN, priceAbove, priceBelow, roundDownToStep, roundUpToStep } from '../../src/ea/priceSteps.js';

describe('priceSteps', () => {
  it('sinir degerlerinde dogru basamak (yukari)', () => {
    expect(priceAbove(950)).toBe(1000);
    expect(priceAbove(1000)).toBe(1100);
    expect(priceAbove(9900)).toBe(10000);
    expect(priceAbove(10000)).toBe(10250);
    expect(priceAbove(49750)).toBe(50000);
    expect(priceAbove(50000)).toBe(50500);
    expect(priceAbove(99500)).toBe(100000);
    expect(priceAbove(100000)).toBe(101000);
  });

  it('sinir degerlerinde dogru basamak (asagi)', () => {
    expect(priceBelow(1000)).toBe(950);
    expect(priceBelow(1100)).toBe(1000);
    expect(priceBelow(10000)).toBe(9900);
    expect(priceBelow(10250)).toBe(10000);
    expect(priceBelow(50000)).toBe(49750);
    expect(priceBelow(100000)).toBe(99500);
    expect(priceBelow(101000)).toBe(100000);
  });

  it('en dusuk fiyatin altinda 0 doner', () => {
    expect(MIN_BIN).toBe(200);
    expect(priceBelow(250)).toBe(200);
    expect(priceBelow(200)).toBe(0);
  });

  it('basamaga yuvarlama', () => {
    expect(roundDownToStep(1049)).toBe(1000);
    expect(roundDownToStep(10120)).toBe(10000);
    expect(roundDownToStep(0)).toBe(0);
    expect(roundUpToStep(1001)).toBe(1100);
    expect(roundUpToStep(990)).toBe(1000);
    expect(roundUpToStep(10120)).toBe(10250);
  });
});
