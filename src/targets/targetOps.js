// Hedef oyunculari birlestirir, EA kimliklerini cozer ve kayitli listeleri yonetir.
// Bagimliliklar: core/state/events, futbin/playerLookup ve targets/targetStore.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { fetchFutbinPlayerId } from '../futbin/playerLookup.js';
import { saveSavedTargetLists, saveTargets } from './targetStore.js';
import { setTargetStatus } from './targetStatus.js';
import { CONFIG } from '../core/config.js';
import { MIN_BIN, roundDownToStep } from '../ea/priceSteps.js';

export function applyTargetAddDiscount(player, discountRate = CONFIG.targetAdd.discountRate) {
  const rate = typeof discountRate === 'number' && Number.isFinite(discountRate) && discountRate >= 0 && discountRate < 1
    ? discountRate
    : (typeof CONFIG.targetAdd.discountRate === 'number' && Number.isFinite(CONFIG.targetAdd.discountRate) && CONFIG.targetAdd.discountRate >= 0 && CONFIG.targetAdd.discountRate < 1
      ? CONFIG.targetAdd.discountRate
      : 0.1);
  const originalPrice = Number(player.price);
  const discountedPrice = Number.isFinite(originalPrice) ? originalPrice * (1 - rate) : MIN_BIN;
  const price = Math.max(MIN_BIN, roundDownToStep(discountedPrice));
  return { ...player, price, buyNow: price };
}

export function applyTargetAddEaTax(player, eaTaxRate = CONFIG.targetAdd.eaTaxRate) {
  const rate = typeof eaTaxRate === 'number' && Number.isFinite(eaTaxRate) && eaTaxRate >= 0 && eaTaxRate < 1
    ? eaTaxRate
    : 0.05;
  return applyTargetAddDiscount(player, rate);
}

export function findDuplicateTarget(targets, candidate, { matchFutbinId = true } = {}) {
  return targets.find((item) =>
    (matchFutbinId && candidate.futbinId && item.futbinId && String(item.futbinId) === String(candidate.futbinId)) ||
    (item.rating === candidate.rating && item.name.trim().toLocaleLowerCase() === candidate.name.trim().toLocaleLowerCase())
  );
}

export function targetEaIdKey(target) {
  return JSON.stringify([
    String(target.name),
    Number(target.rating),
    target.futbinId == null ? null : String(target.futbinId)
  ]);
}

function normalizedEaId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return 0;
  return id & 0xffffff;
}

export function hasCurrentTargetEaId(target) {
  const eaId = normalizedEaId(target.eaId);
  if (!eaId) return false;
  return !target.eaIdTargetKey || target.eaIdTargetKey === targetEaIdKey(target);
}

export async function resolveTargetEaId(target) {
  if (hasCurrentTargetEaId(target)) {
    const eaId = normalizedEaId(target.eaId);
    if (target.eaIdTargetKey !== targetEaIdKey(target)) {
      target.eaId = eaId;
      target.eaIdTargetKey = targetEaIdKey(target);
      saveTargets();
    }
    return target.eaId;
  }
  const fetchedEaId = Number(await fetchFutbinPlayerId(target));
  const eaId = normalizedEaId(fetchedEaId);
  if (!eaId) throw new Error('FutBIN yanıtında geçerli EA oyuncu kimliği bulunamadı.');
  target.eaId = eaId;
  target.eaIdTargetKey = targetEaIdKey(target);
  saveTargets();
  return eaId;
}

export function saveTargetSnapshot(listName) {
  if (!state.targets.length) {
    setTargetStatus({ type: 'error', message: 'Kaydedilecek oyuncu hedefi bulunmuyor.' });
    return false;
  }
  const snapshot = state.targets.map((player) => ({
    id: player.id, name: player.name, rating: player.rating, eaId: player.eaId || 0,
    eaIdTargetKey: player.eaIdTargetKey || null, price: player.price,
    searches: player.searches, buyNow: player.buyNow, futbinId: player.futbinId
  }));
  try {
    const name = String(listName || '').trim();
    if (!name) return false;
    const existing = state.savedTargetLists.find((list) => list.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    const savedList = { id: existing ? existing.id : 'list:' + Date.now() + ':' + Math.random().toString(36).slice(2, 7), name, savedAt: Date.now(), players: snapshot };
    const nextLists = existing
      ? state.savedTargetLists.map((list) => list.id === existing.id ? savedList : list)
      : [savedList].concat(state.savedTargetLists);
    saveSavedTargetLists(nextLists);
    state.savedTargetLists = nextLists;
    state.selectedSavedTargetListId = savedList.id;
    setTargetStatus({ type: 'success', message: '“' + name + '” adıyla ' + snapshot.length + ' oyuncu kaydedildi.' });
    emit('targets:changed');
    return true;
  } catch (error) {
    setTargetStatus({ type: 'error', message: 'Oyuncu listesi kaydedilemedi. Tarayıcı depolama alanını kontrol edin.' });
    return false;
  }
}

export function restoreSavedTargets() {
  const savedList = state.savedTargetLists.find((list) => list.id === state.selectedSavedTargetListId);
  if (!savedList || !savedList.players.length) return 0;
  let restored = 0;
  savedList.players.forEach((saved) => {
    const duplicate = findDuplicateTarget(state.targets, saved);
    if (duplicate) {
      duplicate.price = saved.price;
      if (normalizedEaId(saved.eaId)) {
        duplicate.eaId = normalizedEaId(saved.eaId);
        duplicate.eaIdTargetKey = saved.eaIdTargetKey || null;
      }
      duplicate.searches = saved.searches;
      duplicate.buyNow = saved.buyNow;
    } else {
      state.targets.push({ ...saved });
    }
    restored++;
  });
  saveTargets();
  emit('targets:changed');
  return restored;
}

export function mergeTargetPlayers(players) {
  let added = 0;
  players.forEach((player) => {
    const nameKey = player.name.trim().toLocaleLowerCase();
    const duplicate = findDuplicateTarget(state.targets, player);
    if (duplicate) {
      if (!duplicate.eaId && normalizedEaId(player.eaId)) {
        duplicate.eaId = normalizedEaId(player.eaId);
        duplicate.eaIdTargetKey = player.eaIdTargetKey || null;
      }
      return;
    }
    const futbinId = player.futbinId == null ? null : String(player.futbinId);
    state.targets.push({
      id: futbinId ? 'futbin:' + futbinId : nameKey + ':' + player.rating,
      name: player.name,
      rating: player.rating,
      eaId: Number(player.eaId) || 0,
      eaIdTargetKey: player.eaIdTargetKey || null,
      price: player.price,
      searches: 3,
      buyNow: player.price,
      futbinId
    });
    added++;
  });
  saveTargets();
  emit('targets:changed');
  return added;
}
