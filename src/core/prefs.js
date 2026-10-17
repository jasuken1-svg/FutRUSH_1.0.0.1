// Kalici kullanici tercihlerini dogrular ve calisma zamani konfigurasyonuna uygular.
// Bagimliliklar: core/config, core/logger ve utils/dom.

import { CONFIG } from './config.js';
import { error as logError, setLogLevel, warnOnce } from './logger.js';
import { pageStorage } from '../utils/dom.js';

const PREFS_KEY = 'futrush-prefs';
const DEFAULT_PREFS = {
  targetAdd: {
    priceSource: 'ea',
    discountRate: 0.1,
    maxSearches: 5,
    searchGapMs: [1200, 1800],
    actionGapMs: [1500, 2500],
    outlierRatio: 0.9
  },
  debug: false
};

function validRange(value, minimum) {
  return Array.isArray(value)
    && value.length === 2
    && value.every((item) => Number.isSafeInteger(item))
    && value[0] >= minimum
    && value[1] >= value[0];
}

export function validatePrefs(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const targetAdd = source.targetAdd && typeof source.targetAdd === 'object' && !Array.isArray(source.targetAdd)
    ? source.targetAdd
    : {};
  const defaults = DEFAULT_PREFS.targetAdd;
  const priceSource = targetAdd.priceSource === 'futbin' ? 'futbin' : targetAdd.priceSource === 'ea' ? 'ea' : defaults.priceSource;
  const discountRate = (typeof targetAdd.discountRate === 'number'
    && Number.isFinite(targetAdd.discountRate)
    && targetAdd.discountRate >= 0
    && targetAdd.discountRate <= 0.5)
    ? Math.round(targetAdd.discountRate * 100) / 100
    : defaults.discountRate;
  const maxSearches = Number.isInteger(targetAdd.maxSearches) && targetAdd.maxSearches >= 1 && targetAdd.maxSearches <= 8
    ? targetAdd.maxSearches
    : defaults.maxSearches;
  const searchGapMs = validRange(targetAdd.searchGapMs, 500)
    ? targetAdd.searchGapMs.slice()
    : defaults.searchGapMs.slice();
  const actionGapMs = validRange(targetAdd.actionGapMs, 200)
    ? targetAdd.actionGapMs.slice()
    : defaults.actionGapMs.slice();
  const outlierRatio = targetAdd.outlierRatio === 0
    || (typeof targetAdd.outlierRatio === 'number'
      && Number.isFinite(targetAdd.outlierRatio)
      && targetAdd.outlierRatio >= 0.5
      && targetAdd.outlierRatio <= 0.95)
    ? targetAdd.outlierRatio
    : defaults.outlierRatio;

  return {
    targetAdd: { priceSource, discountRate, maxSearches, searchGapMs, actionGapMs, outlierRatio },
    debug: typeof source.debug === 'boolean' ? source.debug : DEFAULT_PREFS.debug
  };
}

export function loadPrefs() {
  let serialized;
  try {
    serialized = pageStorage().getItem(PREFS_KEY);
  } catch (error) {
    warnOnce(
      'storage-read:' + PREFS_KEY,
      '[FutRUSH:storage]',
      'Tercihler localStorage’dan okunamadı; varsayılanlar kullanılıyor.',
      PREFS_KEY,
      String(error?.message || error)
    );
    return validatePrefs(null);
  }
  if (serialized == null) return validatePrefs(null);

  try {
    return validatePrefs(JSON.parse(serialized));
  } catch (error) {
    warnOnce(
      'storage-json:' + PREFS_KEY,
      '[FutRUSH:storage]',
      'Tercihler JSON olarak okunamadı; varsayılanlar kullanılıyor.',
      PREFS_KEY,
      String(error?.message || error)
    );
    return validatePrefs(null);
  }
}

export function savePrefs(raw) {
  const prefs = validatePrefs(raw);
  try {
    pageStorage().setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    logError('Tercihler localStorage’a kaydedilemedi.', error);
  }
  return prefs;
}

export function applyPrefs(raw) {
  const prefs = validatePrefs(raw);
  Object.assign(CONFIG.targetAdd, prefs.targetAdd);
  setLogLevel(prefs.debug ? 'debug' : 'info');
  return prefs;
}

export function resetPrefs() {
  const prefs = validatePrefs(null);
  savePrefs(prefs);
  return applyPrefs(prefs);
}
