// Panel geometrisini ve kayitli hedef filtresini localStorage'dan state'e yukler.
// Bagimliliklar: core/config, core/state ve utils/dom.

import { P } from './config.js';
import { state } from './state.js';
import { pageStorage } from '../utils/dom.js';
export { pageStorage };
import { error as logError } from './logger.js';
import { warn as logWarn } from './logger.js';
import { applyPrefs, loadPrefs } from './prefs.js';

const SNIPE_SETTINGS_KEY = 'futrush-snipe-settings';
const SNIPE_SETTINGS_DEFAULTS = {
  repeat: 0,
  waitSeconds: [15, 35],
  autoSell: false,
  dryRun: false,
  maxPlayers: 1,
  speed: 0,
  speedDelays: { 0: 5.0, 1: 4.0, 2: 2.5, 3: 1.5 },
  maxSpendCoins: 0,
  hourlySearchLimit: 1200,
  dailySearchLimit: 6000,
  consecutiveErrorLimit: 3
};

function isNumberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function saveSnipeSettings() {
  try {
    pageStorage().setItem(SNIPE_SETTINGS_KEY, JSON.stringify({
      repeat: state.snipeSettings.repeat,
      waitSeconds: Array.isArray(state.snipeSettings.waitSeconds)
        ? state.snipeSettings.waitSeconds.slice(0, 2)
        : [15, 35],
      autoSell: state.snipeSettings.autoSell,
      dryRun: Boolean(state.snipeSettings.dryRun),
      maxPlayers: state.snipeSettings.maxPlayers,
      speed: state.snipeSettings.speed,
      speedDelays: state.snipeSettings.speedDelays || { 0: 5.0, 1: 4.0, 2: 2.5, 3: 1.5 },
      maxSpendCoins: state.snipeSettings.maxSpendCoins || 0,
      hourlySearchLimit: state.snipeSettings.hourlySearchLimit ?? SNIPE_SETTINGS_DEFAULTS.hourlySearchLimit,
      dailySearchLimit: state.snipeSettings.dailySearchLimit ?? SNIPE_SETTINGS_DEFAULTS.dailySearchLimit,
      consecutiveErrorLimit: state.snipeSettings.consecutiveErrorLimit ?? SNIPE_SETTINGS_DEFAULTS.consecutiveErrorLimit
    }));
  } catch (e) {
    logError('SNIPE ayarları localStorage’a kaydedilemedi.', e);
  }
}

export function loadSnipeSettings() {
  let serializedSettings;
  try {
    serializedSettings = pageStorage().getItem(SNIPE_SETTINGS_KEY);
  } catch (e) {
    logError('SNIPE ayarları localStorage’dan okunamadı.', e);
    Object.assign(state.snipeSettings, SNIPE_SETTINGS_DEFAULTS);
    return;
  }

  let savedSettings;
  try {
    savedSettings = JSON.parse(serializedSettings);
  } catch (e) {
    logWarn('[FutRUSH:storage]', 'SNIPE ayarları JSON olarak okunamadı.', SNIPE_SETTINGS_KEY, String(e?.message || e));
    savedSettings = null;
  }

  const loadedSettings = { ...SNIPE_SETTINGS_DEFAULTS };
  if (savedSettings && typeof savedSettings === 'object' && !Array.isArray(savedSettings)) {
    if (isNumberInRange(savedSettings.repeat, 0, 50)) {
      loadedSettings.repeat = savedSettings.repeat;
    }
    if (Array.isArray(savedSettings.waitSeconds)
      && savedSettings.waitSeconds.length === 2
      && isNumberInRange(savedSettings.waitSeconds[0], 0, 120)
      && isNumberInRange(savedSettings.waitSeconds[1], 0, 120)) {
      loadedSettings.waitSeconds = [
        Math.min(savedSettings.waitSeconds[0], savedSettings.waitSeconds[1]),
        Math.max(savedSettings.waitSeconds[0], savedSettings.waitSeconds[1])
      ];
    } else if (isNumberInRange(savedSettings.waitSeconds, 0, 120)) {
      loadedSettings.waitSeconds = [savedSettings.waitSeconds, savedSettings.waitSeconds];
    }
    if (typeof savedSettings.autoSell === 'boolean') {
      loadedSettings.autoSell = savedSettings.autoSell;
    }
    if (typeof savedSettings.dryRun === 'boolean') {
      loadedSettings.dryRun = savedSettings.dryRun;
    }
    if (Number.isSafeInteger(savedSettings.maxPlayers)
      && savedSettings.maxPlayers >= 1
      && savedSettings.maxPlayers <= Number.MAX_SAFE_INTEGER) {
      loadedSettings.maxPlayers = savedSettings.maxPlayers;
    }
    if (Number.isInteger(savedSettings.speed) && savedSettings.speed >= 0 && savedSettings.speed <= 3) {
      loadedSettings.speed = savedSettings.speed;
    }
    if (savedSettings.speedDelays && typeof savedSettings.speedDelays === 'object') {
      const delays = { 0: 5.0, 1: 4.0, 2: 2.5, 3: 1.5 };
      [0, 1, 2, 3].forEach((k) => {
        const val = Number(savedSettings.speedDelays[k]);
        if (!isNaN(val) && val >= 1.0 && val <= 10.0) {
          delays[k] = Math.round(val * 10) / 10;
        }
      });
      loadedSettings.speedDelays = delays;
    }
    if (Number.isSafeInteger(savedSettings.maxSpendCoins) && savedSettings.maxSpendCoins >= 0) {
      loadedSettings.maxSpendCoins = savedSettings.maxSpendCoins;
    }
    if (Number.isSafeInteger(savedSettings.hourlySearchLimit) && savedSettings.hourlySearchLimit >= 0) {
      loadedSettings.hourlySearchLimit = savedSettings.hourlySearchLimit;
    }
    if (Number.isSafeInteger(savedSettings.dailySearchLimit) && savedSettings.dailySearchLimit >= 0) {
      loadedSettings.dailySearchLimit = savedSettings.dailySearchLimit;
    }
    if (Number.isSafeInteger(savedSettings.consecutiveErrorLimit) && savedSettings.consecutiveErrorLimit >= 1) {
      loadedSettings.consecutiveErrorLimit = savedSettings.consecutiveErrorLimit;
    }
  }

  Object.assign(state.snipeSettings, loadedSettings);
}

export function loadCoreStorage() {
  try { state.geom = JSON.parse(pageStorage().getItem(P.storeKey)); } catch (e) {
    logWarn('[FutRUSH:storage]', 'Panel geometrisi localStorage’dan okunamadı.', P.storeKey, String(e?.message || e));
  }
  try {
    const savedTargetFilter = JSON.parse(pageStorage().getItem('futrush-saved-target-filter'));
    if (savedTargetFilter && Array.isArray(savedTargetFilter.ratings)) {
      state.targetFilter = {
        kind: savedTargetFilter.kind === 'custom' ? 'custom' : 'cheap',
        ratings: savedTargetFilter.ratings.slice(0, 1).map(Number).filter(Number.isFinite),
        count: Math.max(1, Number(savedTargetFilter.count) || 5)
      };
    }
  } catch (e) {
    logWarn('[FutRUSH:storage]', 'Kayıtlı hedef filtresi localStorage’dan okunamadı.', 'futrush-saved-target-filter', String(e?.message || e));
  }
  loadSnipeSettings();
  applyPrefs(loadPrefs());
}
