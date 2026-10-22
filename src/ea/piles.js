// EA FC Web App Transfer Listesi, İzleme Listesi ve Kulüp/Atanmamış kart doluluk kontrolü
// Ağ isteği ATMAZ: repositories.Item bellek verisi ve DOM'dan okur.
// Bağımlılıklar: utils/dom, ea/priceSteps, core/events, core/state, ui/marketLogBox

import { pageWindow } from '../utils/dom.js';
import { parsePriceInput } from './priceSteps.js';
import { emit } from '../core/events.js';
import { state } from '../core/state.js';
import { addMarketLog } from '../ui/marketLogBox.js';

export const PILE_IDS = {
  TRANSFER: 5,
  UNASSIGNED: 6,
  WATCHLIST: 8
};

let nullLogged = false;
let lastWarnedRemaining = null;
let lastUnassignedLogged = 0;

/**
 * Transfer Listesi kapasitesini okur.
 * 1. repositories.Item.getPileSize(5)
 * 2. repositories.Item.pileSizes._collection['5']
 * 3. state.snipeSettings.transferListCapacity
 * 4. varsayılan 100
 */
export function getTransferListCapacity() {
  try {
    const itemRepo = pageWindow.repositories?.Item;
    if (typeof itemRepo?.getPileSize === 'function') {
      const size = itemRepo.getPileSize(PILE_IDS.TRANSFER);
      if (typeof size === 'number' && Number.isFinite(size) && size > 0) return size;
    }
    const coll = itemRepo?.pileSizes?._collection;
    if (coll && typeof coll[PILE_IDS.TRANSFER] === 'number') {
      return coll[PILE_IDS.TRANSFER];
    }
  } catch {}

  const stateCap = Number(state.snipeSettings?.transferListCapacity);
  if (Number.isFinite(stateCap) && stateCap > 0) return stateCap;

  return 100;
}

/**
 * Transfer Listesindeki kart sayısını okur (AĞ İSTEĞİ YAPMAZ).
 * 1. repositories.Item.getTransferItems()?.length
 * 2. repositories.Item.transfer?.count veya _collection boyutu
 * 3. DOM fallback: .ut-tile-transfer-list .total-transfers-data
 * Okunamazsa null döner.
 */
export function getTransferListCount() {
  try {
    const itemRepo = pageWindow.repositories?.Item;
    if (typeof itemRepo?.getTransferItems === 'function') {
      const items = itemRepo.getTransferItems();
      if (Array.isArray(items)) return items.length;
    }
    if (typeof itemRepo?.transfer?.count === 'number' && itemRepo.transfer.count >= 0) {
      return itemRepo.transfer.count;
    }
    if (itemRepo?.transfer?._collection && typeof itemRepo.transfer._collection === 'object') {
      return Object.keys(itemRepo.transfer._collection).length;
    }
  } catch {}

  // DOM fallback
  if (typeof document !== 'undefined') {
    const tile = document.querySelector('.ut-tile-transfer-list .total-transfers-data, .ut-tile-transfer-list .tile-stat-value');
    if (tile) {
      const text = tile.textContent || '';
      const parsed = parsePriceInput(text);
      if (parsed > 0 || text.includes('0')) return parsed;
    }
  }

  return null;
}

/**
 * Transfer Listesinin tamamen dolu olup olmadığını döner.
 * Boolean döner; doluluk okunamıyorsa null döner.
 */
export function isTransferListFull() {
  try {
    const itemRepo = pageWindow.repositories?.Item;
    if (typeof itemRepo?.isPileFull === 'function') {
      const full = itemRepo.isPileFull(PILE_IDS.TRANSFER);
      if (typeof full === 'boolean') return full;
    }
  } catch {}

  const count = getTransferListCount();
  if (count === null) return null;
  const cap = getTransferListCapacity();
  return count >= cap;
}

/**
 * Atanmamış (unassigned) kart sayısını okur.
 * Okunamazsa 0 döner.
 */
export function getUnassignedCount() {
  try {
    const itemRepo = pageWindow.repositories?.Item;
    if (typeof itemRepo?.getUnassignedItems === 'function') {
      const items = itemRepo.getUnassignedItems();
      if (Array.isArray(items)) return items.length;
    }
    if (typeof itemRepo?.unassigned?.count === 'number' && itemRepo.unassigned.count >= 0) {
      return itemRepo.unassigned.count;
    }
    if (itemRepo?.unassigned?._collection && typeof itemRepo.unassigned._collection === 'object') {
      return Object.keys(itemRepo.unassigned._collection).length;
    }
  } catch {}

  // DOM fallback: badge on nav
  if (typeof document !== 'undefined') {
    const badge = document.querySelector('.ut-navigation-container-view--unassigned, [class*="unassigned"] .badge');
    if (badge) {
      const parsed = parsePriceInput(badge.textContent || '');
      if (parsed > 0) return parsed;
    }
  }

  return 0;
}

/**
 * İzleme Listesi (Watchlist / Transfer Targets) sayısını okur.
 */
export function getWatchlistCount() {
  try {
    const itemRepo = pageWindow.repositories?.Item;
    if (typeof itemRepo?.getWatchedItems === 'function') {
      const items = itemRepo.getWatchedItems();
      if (Array.isArray(items)) return items.length;
    }
    if (typeof itemRepo?.watched?.count === 'number' && itemRepo.watched.count >= 0) {
      return itemRepo.watched.count;
    }
    if (itemRepo?.watched?._collection && typeof itemRepo.watched._collection === 'object') {
      return Object.keys(itemRepo.watched._collection).length;
    }
  } catch {}

  if (typeof document !== 'undefined') {
    const tile = document.querySelector('.ut-tile-transfer-targets .total-transfers-data, .ut-tile-transfer-targets .tile-stat-value');
    if (tile) {
      const text = tile.textContent || '';
      const parsed = parsePriceInput(text);
      if (parsed > 0 || text.includes('0')) return parsed;
    }
  }

  return null;
}

/**
 * Bot arama ve alım öncesi Transfer Listesi koruma denetimini yapar.
 * - Doluluk okunamıyorsa: botu durdurmaz, Genel Loglar'a bir defa uyarı yazar, true döner.
 * - Transfer Listesi doluysa: Genel Loglar'a hata yazar, governor.halt('liste_dolu') çağırır, false döner.
 * - Kalan yer <= threshold ise: Genel Loglar'a sarı uyarı yazar, bot çalışmaya devam eder, true döner.
 * - Atanmamış kart varsa: Genel Loglar'a uyarı yazar.
 * @param {object} governor - SafetyGovernor örneği
 * @returns {boolean} Aramaya izin veriliyor mu
 */
export function checkPilesProtection(governor) {
  const count = getTransferListCount();
  const capacity = getTransferListCapacity();
  const isFull = isTransferListFull();

  // 1. Atanmamış kart kontrolü (bilgi amaçlı uyarı)
  const unassigned = getUnassignedCount();
  if (unassigned > 0 && unassigned !== lastUnassignedLogged) {
    lastUnassignedLogged = unassigned;
    addMarketLog({
      text: `⚠️ Kulüpte ${unassigned} atanmamış (unassigned) kart var.`,
      type: 'warn'
    });
    emit('piles:unassigned-changed', unassigned);
  } else if (unassigned === 0 && lastUnassignedLogged !== 0) {
    lastUnassignedLogged = 0;
    emit('piles:unassigned-changed', 0);
  }

  // 2. Doluluk okunamıyorsa botu durdurma, sadece uyar
  if (count === null || capacity === null) {
    if (!nullLogged) {
      nullLogged = true;
      addMarketLog({
        text: 'Transfer Listesi doluluğu okunamıyor. Bot çalışmaya devam ediyor.',
        type: 'warn'
      });
      emit('piles:unknown');
    }
    return true;
  }

  // Okunabiliyorsa nullLogged flag'ini temizle
  nullLogged = false;

  // 3. Dolu mu kontrolü
  if (isFull === true || count >= capacity) {
    const reasonText = `Transfer Listesi dolu (${count}/${capacity}). Güvenlik için tarama durduruldu.`;
    addMarketLog({
      text: `⛔ ${reasonText}`,
      type: 'error'
    });
    if (governor && typeof governor.halt === 'function') {
      governor.halt('liste_dolu');
    }
    emit('piles:full', { count, capacity });
    return false;
  }

  // 4. Kalan yer eşiği uyarısı (örn. <= 5)
  const warnThreshold = Math.max(1, Number(state.snipeSettings?.transferListWarnThreshold) || 5);
  const remaining = capacity - count;
  if (remaining <= warnThreshold) {
    if (lastWarnedRemaining !== remaining) {
      lastWarnedRemaining = remaining;
      addMarketLog({
        text: `⚠️ Transfer Listesinde az yer kaldı: ${remaining} boş slot (${count}/${capacity}).`,
        type: 'warn'
      });
      emit('piles:warn-threshold', { count, capacity, remaining });
    }
  } else {
    lastWarnedRemaining = null;
  }

  emit('piles:update', { count, capacity, remaining });
  return true;
}

export function resetPilesState() {
  nullLogged = false;
  lastWarnedRemaining = null;
  lastUnassignedLogged = 0;
}
