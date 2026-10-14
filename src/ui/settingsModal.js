// Ayarlar modalini guncel tercihlerden cizer ve kullanici islemlerini baglar.
// Bagimliliklar: core, targets ve bot katmanlari.

import { emit, on } from '../core/events.js';
import { error as logError } from '../core/logger.js';
import { state } from '../core/state.js';
import { applyPrefs, loadPrefs, savePrefs, validatePrefs } from '../core/prefs.js';
import { saveSnipeSettings } from '../core/storage.js';
import { saveSavedTargetLists, saveTargets } from '../targets/targetStore.js';

const SNIPE_DEFAULTS = { repeat: 0, waitSeconds: 0, autoSell: false, maxPlayers: 1, speed: 0 };
const CONFIRM_DELAY_MS = 4000;
let currentPrefs = null;
let activeBody = null;
let botStatusUnsubscribe = null;
const confirmationTimers = new Map();

function setBotDisabledState() {
  if (!activeBody) return;
  ['clear-targets', 'reset-snipe'].forEach((action) => {
    const button = activeBody.querySelector('[data-action="' + action + '"]');
    const note = activeBody.querySelector('[data-disabled-note="' + action + '"]');
    if (button) button.disabled = state.botRunning;
    if (note) note.hidden = !state.botRunning;
  });
}

function settingMarkup(label, key, control, hint) {
  return '<div class="fr-settings-field"><label class="fr-settings-label" for="fr-setting-' + key + '">' + label + '</label>' +
    control.replace('id="__ID__"', 'id="fr-setting-' + key + '"') +
    '<span class="fr-settings-hint">' + hint + '</span><span class="fr-settings-error" data-error="' + key + '" aria-live="polite"></span></div>';
}

function makePrefsFromControls(body) {
  const targetAdd = {};
  body.querySelectorAll('[data-pref]').forEach((input) => {
    const [key, index] = input.dataset.pref.split('.');
    if (index !== undefined) {
      if (!Array.isArray(targetAdd[key])) targetAdd[key] = [...currentPrefs.targetAdd[key]];
      targetAdd[key][Number(index)] = Number(input.value);
    } else if (key === 'debug') {
      return;
    } else if (key === 'priceSource') {
      targetAdd[key] = input.value;
    } else if (key === 'outlierRatio') {
      targetAdd[key] = Number(input.value);
    } else {
      targetAdd[key] = Number(input.value);
    }
  });
  return {
    targetAdd: { ...currentPrefs.targetAdd, ...targetAdd },
    debug: body.querySelector('[data-pref="debug"]').checked
  };
}

function setError(body, key, message) {
  const error = body.querySelector('[data-error="' + key + '"]');
  if (error) error.textContent = message;
}

function restoreControls(body, key) {
  if (key === 'searchGapMs' || key === 'actionGapMs') {
    body.querySelectorAll('[data-pref^="' + key + '."]').forEach((input) => {
      input.value = String(currentPrefs.targetAdd[key][Number(input.dataset.pref.split('.')[1])]);
    });
    return;
  }
  const input = body.querySelector('[data-pref="' + key + '"]');
  if (!input) return;
  input.value = String(key === 'debug' ? currentPrefs.debug : currentPrefs.targetAdd[key]);
  if (key === 'debug') input.checked = currentPrefs.debug;
}

function validationMessage(key) {
  if (key === 'searchGapMs') return 'En az 500 ms olmalı; üst sınır alt sınırdan küçük olamaz.';
  if (key === 'actionGapMs') return 'En az 200 ms olmalı; üst sınır alt sınırdan küçük olamaz.';
  if (key === 'maxSearches') return '1 ile 8 arasında tam sayı girin.';
  if (key === 'outlierRatio') return 'Eşik kapalı veya %50-%95 arasında olmalı.';
  return 'Geçerli bir değer seçin.';
}

function handlePrefChange(event) {
  const input = event.currentTarget;
  const [key] = input.dataset.pref.split('.');
  const raw = makePrefsFromControls(activeBody);
  if (input.dataset.pref === 'debug') raw.debug = input.checked;
  const next = validatePrefs(raw);
  const changedValue = key === 'debug' ? raw.debug !== next.debug
    : JSON.stringify(raw.targetAdd[key]) !== JSON.stringify(next.targetAdd[key]);
  if (changedValue) {
    restoreControls(activeBody, key);
    setError(activeBody, key, validationMessage(key));
    return;
  }

  currentPrefs = savePrefs(next);
  applyPrefs(currentPrefs);
  setError(activeBody, key, '');
}

function runConfirmed(button, action) {
  if (state.botRunning && (action === 'clear-targets' || action === 'reset-snipe')) return;
  const timer = confirmationTimers.get(button);
  if (timer) {
    clearTimeout(timer);
    confirmationTimers.delete(button);
    button.textContent = button.dataset.originalLabel;
    button.removeAttribute('data-confirming');
    action();
    return;
  }

  button.dataset.originalLabel = button.textContent;
  button.textContent = 'Emin misin?';
  button.dataset.confirming = 'true';
  confirmationTimers.set(button, setTimeout(() => {
    confirmationTimers.delete(button);
    button.textContent = button.dataset.originalLabel;
    button.removeAttribute('data-confirming');
  }, CONFIRM_DELAY_MS));
}

function showActionMessage(message, isError = false) {
  const status = activeBody?.querySelector('.fr-settings-status');
  if (status) {
    status.textContent = message;
    status.style.color = isError ? '#ffb27e' : '#80e6bd';
  }
}

function clearTargets() {
  if (state.botRunning) return;
  state.targets = [];
  saveTargets();
  emit('targets:changed');
  emit('panel:request-render');
  showActionMessage('Hedefler temizlendi.');
}

function clearSavedTargetLists() {
  try {
    saveSavedTargetLists([]);
  } catch (error) {
    logError('Kayıtlı hedef listeleri silinemedi.', error);
    showActionMessage('Kayıtlı listeler silinemedi.', true);
    return;
  }
  state.savedTargetLists = [];
  state.selectedSavedTargetListId = null;
  emit('targets:changed');
  emit('panel:request-render');
  showActionMessage('Kayıtlı listeler silindi.');
}

function resetSnipeSettings() {
  if (state.botRunning) return;
  Object.assign(state.snipeSettings, SNIPE_DEFAULTS);
  saveSnipeSettings();
  emit('panel:request-render');
  showActionMessage('SNIPE ayarları varsayılana alındı.');
}

function clearLogs() {
  state.botLogs = [];
  emit('log:added');
  emit('panel:request-render');
  showActionMessage('Loglar temizlendi.');
}

function actionRow(action, label, disabled = false) {
  return '<div class="fr-settings-action-row"><button class="fr-settings-action" type="button" data-action="' + action + '"' +
    (disabled ? ' disabled' : '') + '>' + label + '</button>' +
    '<span class="fr-settings-disabled-note" data-disabled-note="' + action + '" hidden>Bot çalışırken kullanılamaz</span></div>';
}

export function renderSettingsBody(body) {
  activeBody = body;
  currentPrefs = loadPrefs();
  applyPrefs(currentPrefs);
  if (!botStatusUnsubscribe) botStatusUnsubscribe = on('bot:status', setBotDisabledState);
  const targetAdd = currentPrefs.targetAdd;
  const searchOptions = Array.from({ length: 8 }, (_, index) => {
    const value = index + 1;
    return '<option value="' + value + '"' + (targetAdd.maxSearches === value ? ' selected' : '') + '>' + value + '</option>';
  }).join('');
  const outlierOptions = '<option value="0"' + (targetAdd.outlierRatio === 0 ? ' selected' : '') + '>Kapalı</option>' +
    Array.from({ length: 46 }, (_, index) => {
      const percentage = index + 50;
      const value = percentage / 100;
      return '<option value="' + value + '"' + (targetAdd.outlierRatio === value ? ' selected' : '') + '>' + percentage + '%</option>';
    }).join('');
  body.innerHTML =
    '<div class="fr-settings-content">' +
      '<section class="fr-settings-card"><h2>Hedef ekleme</h2>' +
        settingMarkup('Fiyat kaynağı', 'priceSource', '<select class="fr-settings-control" id="__ID__" data-pref="priceSource"><option value="ea"' + (targetAdd.priceSource === 'ea' ? ' selected' : '') + '>EA</option><option value="futbin"' + (targetAdd.priceSource === 'futbin' ? ' selected' : '') + '>FutBIN</option></select>', 'EA piyasa fiyatını veya FutBIN fiyatını kullanır.') +
        settingMarkup('Maksimum arama sayısı', 'maxSearches', '<select class="fr-settings-control" id="__ID__" data-pref="maxSearches">' + searchOptions + '</select>', 'EA aramasında kullanılacak en fazla deneme sayısı.') +
        settingMarkup('Arama aralığı (ms)', 'searchGapMs', '<div class="fr-settings-range"><label>Min<input class="fr-settings-control" id="__ID__" data-pref="searchGapMs.0" type="number" step="1" value="' + targetAdd.searchGapMs[0] + '"></label><label>Max<input class="fr-settings-control" data-pref="searchGapMs.1" type="number" step="1" value="' + targetAdd.searchGapMs[1] + '"></label></div>', 'Düşük aralık EA’nın hata vermesine yol açabilir.') +
        settingMarkup('Oyuncu arası aralık (ms)', 'actionGapMs', '<div class="fr-settings-range"><label>Min<input class="fr-settings-control" id="__ID__" data-pref="actionGapMs.0" type="number" step="1" value="' + targetAdd.actionGapMs[0] + '"></label><label>Max<input class="fr-settings-control" data-pref="actionGapMs.1" type="number" step="1" value="' + targetAdd.actionGapMs[1] + '"></label></div>', 'Düşük aralık EA isteklerinin reddedilmesine neden olabilir.') +
        settingMarkup('Aykırı ilan eşiği', 'outlierRatio', '<select class="fr-settings-control" id="__ID__" data-pref="outlierRatio">' + outlierOptions + '</select>', 'Bu oranın altındaki ilan fiyatları aykırı kabul edilir.') +
      '</section>' +
      '<section class="fr-settings-card"><h2>Veri</h2><div class="fr-settings-actions">' +
        actionRow('clear-targets', 'Hedefleri temizle', state.botRunning) +
        actionRow('clear-saved-lists', 'Kayıtlı listeleri sil') +
        actionRow('reset-snipe', 'SNIPE ayarlarını varsayılana al', state.botRunning) +
        actionRow('clear-logs', 'Logları temizle') +
        '<div class="fr-settings-status" aria-live="polite"></div>' +
      '</div></section>' +
      '<section class="fr-settings-card"><h2>Hata ayıklama</h2>' +
        '<label class="fr-settings-toggle"><span>Ayrıntılı konsol logu</span><input type="checkbox" data-pref="debug"' + (currentPrefs.debug ? ' checked' : '') + '></label>' +
        '<div class="fr-settings-version">Sürüm: ' + (typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev') + '</div>' +
      '</section>' +
    '</div>';

  body.querySelectorAll('[data-pref]').forEach((input) => input.addEventListener('change', handlePrefChange));
  body.querySelectorAll('[data-action]').forEach((button) => {
    const actions = {
      'clear-targets': clearTargets,
      'clear-saved-lists': clearSavedTargetLists,
      'reset-snipe': resetSnipeSettings,
      'clear-logs': clearLogs
    };
    button.addEventListener('click', () => runConfirmed(button, actions[button.dataset.action]));
  });
  setBotDisabledState();
}
