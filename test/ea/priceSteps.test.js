import { describe, it, expect } from 'vitest';
import {
  MIN_BIN,
  MAX_BIN,
  MIN_PRICE,
  MAX_PRICE,
  PRICE_TIERS,
  clampPrice,
  getPriceStep,
  priceAbove,
  priceBelow,
  roundDownToStep,
  roundUpToStep,
  roundToPriceStep,
  roundToNearestStep,
  parsePriceInput,
  nextPriceUp,
  nextPriceDown,
  runPriceStepSelfTests
} from '../../src/ea/priceSteps.js';

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
    expect(MIN_PRICE).toBe(200);
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

  it('clampPrice ve getPriceStep dogru calisir', () => {
    expect(clampPrice(50)).toBe(200);
    expect(clampPrice(15000000)).toBe(MAX_PRICE);
    expect(clampPrice(5000)).toBe(5000);
    expect(getPriceStep(500)).toBe(50);
    expect(getPriceStep(1000)).toBe(100);
    expect(getPriceStep(10000)).toBe(250);
    expect(getPriceStep(50000)).toBe(500);
    expect(getPriceStep(100000)).toBe(1000);
  });

  it('roundToPriceStep tum modlarda ve 49950 gecisinde dogru yuvarlar', () => {
    expect(roundToPriceStep(49950, 'nearest')).toBe(50000);
    expect(roundToPriceStep(49950, 'up')).toBe(50000);
    expect(roundToPriceStep(49950, 'down')).toBe(49750);
    expect(roundToPriceStep(980, 'nearest')).toBe(1000);
    expect(roundToPriceStep(980, 'down')).toBe(950);
    expect(roundToPriceStep(1040, 'nearest')).toBe(1000);
    expect(roundToPriceStep(1060, 'nearest')).toBe(1100);
  });

  it('parsePriceInput, roundToNearestStep ve MAX_BIN dogru calisir', () => {
    expect(MAX_BIN).toBe(14999000);
    expect(roundToNearestStep(1040)).toBe(1000);
    expect(roundToNearestStep(1060)).toBe(1100);
    expect(parsePriceInput('19,000')).toBe(19000);
    expect(parsePriceInput('19.000')).toBe(19000);
    expect(parsePriceInput(' 19 000 ')).toBe(19000);
    expect(parsePriceInput('abc')).toBe(0);
    expect(parsePriceInput(null)).toBe(0);
    expect(parsePriceInput(undefined)).toBe(0);
  });

  it('runPriceStepSelfTests tum test vakalarini basariyla tamamlar (25+ vaka)', () => {
    const results = runPriceStepSelfTests();
    expect(results.total).toBeGreaterThanOrEqual(25);
    expect(results.failed).toBe(0);
    expect(results.passed).toBe(results.total);
  });
});
