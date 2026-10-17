import { afterEach, describe, expect, it, vi } from 'vitest';

const storage = new Map();
const { warnMock, errorMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
  errorMock: vi.fn()
}));

vi.mock('../../src/utils/dom.js', () => ({
  pageStorage: () => ({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  })
}));

vi.mock('../../src/core/logger.js', () => ({
  warn: warnMock,
  error: errorMock
}));

import { loadSnipeSettings, saveSnipeSettings } from '../../src/core/storage.js';
import { state } from '../../src/core/state.js';

const defaults = {
  repeat: 0,
  waitSeconds: [15, 35],
  autoSell: false,
  maxPlayers: 1,
  speed: 0,
  maxSpendCoins: 0
};

function loadRecord(record) {
  storage.set('futrush-snipe-settings', JSON.stringify(record));
  loadSnipeSettings();
}

afterEach(() => {
  storage.clear();
  Object.assign(state.snipeSettings, defaults);
  warnMock.mockClear();
  errorMock.mockClear();
});

describe('snipe settings storage', () => {
  it('uses defaults when no record exists', () => {
    loadSnipeSettings();

    expect(state.snipeSettings).toEqual(defaults);
  });

  it('uses all defaults when the saved JSON is malformed', () => {
    storage.set('futrush-snipe-settings', '{');
    loadSnipeSettings();

    expect(state.snipeSettings).toEqual(defaults);
    expect(warnMock).toHaveBeenCalledWith(
      '[FutRUSH:storage]',
      'SNIPE ayarları JSON olarak okunamadı.',
      'futrush-snipe-settings',
      expect.stringContaining('JSON')
    );
  });

  it('uses all defaults when the saved value is null', () => {
    storage.set('futrush-snipe-settings', 'null');
    loadSnipeSettings();

    expect(state.snipeSettings).toEqual(defaults);
  });

  it('loads a valid record into the existing settings object', () => {
    const settings = state.snipeSettings;
    loadRecord({ repeat: 4, waitSeconds: [10, 25], autoSell: true, maxPlayers: 8, speed: 2 });

    expect(state.snipeSettings).toBe(settings);
    expect(state.snipeSettings).toEqual({
      repeat: 4,
      waitSeconds: [10, 25],
      autoSell: true,
      maxPlayers: 8,
      speed: 2,
      maxSpendCoins: 0
    });
  });

  it('normalizes single number waitSeconds into range', () => {
    loadRecord({ waitSeconds: 20 });
    expect(state.snipeSettings.waitSeconds).toEqual([20, 20]);
  });

  it('defaults out-of-range waitSeconds values', () => {
    loadRecord({ waitSeconds: [-5, 200] });
    expect(state.snipeSettings.waitSeconds).toEqual([15, 35]);
  });

  it('defaults an out-of-range speed above the maximum', () => {
    loadRecord({ speed: 9 });

    expect(state.snipeSettings.speed).toBe(defaults.speed);
  });

  it('defaults a negative speed', () => {
    loadRecord({ speed: -1 });

    expect(state.snipeSettings.speed).toBe(defaults.speed);
  });

  it('defaults maxPlayers below its minimum', () => {
    loadRecord({ maxPlayers: 0 });

    expect(state.snipeSettings.maxPlayers).toBe(defaults.maxPlayers);
  });

  it('defaults a negative repeat value', () => {
    loadRecord({ repeat: -1 });

    expect(state.snipeSettings.repeat).toBe(defaults.repeat);
  });

  it('defaults autoSell when the saved value is not a boolean', () => {
    loadRecord({ autoSell: 'true' });

    expect(state.snipeSettings.autoSell).toBe(defaults.autoSell);
  });

  it('ignores unknown settings', () => {
    loadRecord({ repeat: 3, unexpected: 'ignored' });

    expect(state.snipeSettings).toEqual({ ...defaults, repeat: 3 });
    expect(state.snipeSettings).not.toHaveProperty('unexpected');
  });

  it('defaults maxSpendCoins when the saved value is negative or not an integer', () => {
    loadRecord({ maxSpendCoins: -100 });
    expect(state.snipeSettings.maxSpendCoins).toBe(0);

    loadRecord({ maxSpendCoins: '50000' });
    expect(state.snipeSettings.maxSpendCoins).toBe(0);
  });

  it('round-trips settings through localStorage', () => {
    Object.assign(state.snipeSettings, {
      repeat: 12,
      waitSeconds: [15, 45],
      autoSell: true,
      maxPlayers: 6,
      speed: 3,
      maxSpendCoins: 250000
    });
    saveSnipeSettings();
    Object.assign(state.snipeSettings, defaults);

    loadSnipeSettings();

    expect(state.snipeSettings).toEqual({
      repeat: 12,
      waitSeconds: [15, 45],
      autoSell: true,
      maxPlayers: 6,
      speed: 3,
      maxSpendCoins: 250000
    });
  });
});
