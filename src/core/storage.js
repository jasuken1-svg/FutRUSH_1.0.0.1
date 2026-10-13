// Panel geometrisini ve kayitli hedef filtresini localStorage'dan state'e yukler.
// Bagimliliklar: core/config, core/state ve utils/dom.

import { P } from './config.js';
import { state } from './state.js';
import { pageStorage } from '../utils/dom.js';
import { error as logError } from './logger.js';
import { warn as logWarn } from './logger.js';

const SNIPE_SETTINGS_KEY = 'futrush-snipe-settings';
const SNIPE_SETTINGS_DEFAULTS = {
  repeat: 0,
  waitSeconds: 0,
  autoSell: false,
  maxPlayers: 1,
  speed: 0
};

function isNumberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function saveSnipeSettings() {
  try {
    pageStorage().setItem(SNIPE_SETTINGS_KEY, JSON.stringify({
      repeat: state.snipeSettings.repeat,
      waitSeconds: state.snipeSettings.waitSeconds,
      autoSell: state.snipeSettings.autoSell,
      maxPlayers: state.snipeSettings.maxPlayers,
      speed: state.snipeSettings.speed
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
    if (isNumberInRange(savedSettings.waitSeconds, 0, 120)) {
      loadedSettings.waitSeconds = savedSettings.waitSeconds;
    }
    if (typeof savedSettings.autoSell === 'boolean') {
      loadedSettings.autoSell = savedSettings.autoSell;
    }
    if (Number.isSafeInteger(savedSettings.maxPlayers)
      && savedSettings.maxPlayers >= 1
      && savedSettings.maxPlayers <= Number.MAX_SAFE_INTEGER) {
      loadedSettings.maxPlayers = savedSettings.maxPlayers;
    }
    if (Number.isInteger(savedSettings.speed) && savedSettings.speed >= 0 && savedSettings.speed <= 3) {
      loadedSettings.speed = savedSettings.speed;
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
}
