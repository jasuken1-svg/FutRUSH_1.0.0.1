import { afterEach, describe, expect, it, vi } from 'vitest';

const storage = new Map();

vi.mock('../../src/utils/dom.js', () => ({
  pageStorage: () => ({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  })
}));

import { loadSnipeSettings, saveSnipeSettings } from '../../src/core/storage.js';
import { state } from '../../src/core/state.js';

const defaults = {
  repeat: 0,
  waitSeconds: 0,
  autoSell: false,
  maxPlayers: 1,
  speed: 0
};

function loadRecord(record) {
  storage.set('futrush-snipe-settings', JSON.stringify(record));
  loadSnipeSettings();
}

afterEach(() => {
  storage.clear();
  Object.assign(state.snipeSettings, defaults);
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
  });

  it('uses all defaults when the saved value is null', () => {
    storage.set('futrush-snipe-settings', 'null');
    loadSnipeSettings();

    expect(state.snipeSettings).toEqual(defaults);
  });

  it('loads a valid record into the existing settings object', () => {
    const settings = state.snipeSettings;
    loadRecord({ repeat: 4, waitSeconds: 25, autoSell: true, maxPlayers: 8, speed: 2 });

    expect(state.snipeSettings).toBe(settings);
    expect(state.snipeSettings).toEqual({
      repeat: 4,
      waitSeconds: 25,
      autoSell: true,
      maxPlayers: 8,
      speed: 2
    });
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

  it('round-trips settings through localStorage', () => {
    Object.assign(state.snipeSettings, {
      repeat: 12,
      waitSeconds: 45,
      autoSell: true,
      maxPlayers: 6,
      speed: 3
    });
    saveSnipeSettings();
    Object.assign(state.snipeSettings, defaults);

    loadSnipeSettings();

    expect(state.snipeSettings).toEqual({
      repeat: 12,
      waitSeconds: 45,
      autoSell: true,
      maxPlayers: 6,
      speed: 3
    });
  });
});
