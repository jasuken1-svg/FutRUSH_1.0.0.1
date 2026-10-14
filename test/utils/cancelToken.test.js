import { describe, it, expect } from 'vitest';
import { actionGap, createCancelToken, randomBetween, sleep } from '../../src/utils/cancelToken.js';

describe('createCancelToken', () => {
  it('cancel dinleyicileri bir kez cagirir', () => {
    const token = createCancelToken();
    let calls = 0;
    token.on(() => { calls += 1; });
    token.cancel();
    token.cancel();
    expect(token.cancelled).toBe(true);
    expect(calls).toBe(1);
  });

  it('off ile cikarilan dinleyici cagrilmaz', () => {
    const token = createCancelToken();
    let calls = 0;
    const fn = () => { calls += 1; };
    token.on(fn);
    token.off(fn);
    token.cancel();
    expect(calls).toBe(0);
  });

  it('iptal edilmis token\'a on() hemen cagirir', () => {
    const token = createCancelToken();
    token.cancel();
    let calls = 0;
    token.on(() => { calls += 1; });
    expect(calls).toBe(1);
  });
});

describe('sleep', () => {
  it('sure dolunca true doner', async () => {
    expect(await sleep(5)).toBe(true);
  });

  it('beklerken iptal edilirse hemen false doner', async () => {
    const token = createCancelToken();
    const started = Date.now();
    const pending = sleep(5000, token);
    token.cancel();
    expect(await pending).toBe(false);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('zaten iptal edilmis token ile beklemeden false doner', async () => {
    const token = createCancelToken();
    token.cancel();
    expect(await sleep(5000, token)).toBe(false);
  });
});

describe('randomBetween ve actionGap', () => {
  it('aralik sinirlarini korur', () => {
    expect(randomBetween(200, 350, () => 0)).toBe(200);
    expect(randomBetween(200, 350, () => 1)).toBe(350);
    expect(randomBetween(200, 350, () => 0.5)).toBe(275);
  });

  it('max <= 0 ise beklemez', async () => {
    const started = Date.now();
    expect(await actionGap(null, [0, 0])).toBe(true);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it('aralik icinde bekler', async () => {
    const started = Date.now();
    expect(await actionGap(null, [20, 40], () => 0)).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });
});
