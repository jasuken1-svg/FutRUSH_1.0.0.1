// Hedef oyunculari birlestirir, EA kimliklerini cozer ve kayitli listeleri yonetir.
// Bagimliliklar: core/state/events, futbin/playerLookup ve targets/targetStore.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { fetchFutbinPlayerId } from '../futbin/playerLookup.js';
import { saveSavedTargetLists, saveTargets } from './targetStore.js';
import { setTargetStatus } from './targetStatus.js';

export function findDuplicateTarget(targets, candidate, { matchFutbinId = true } = {}) {
  return targets.find((item) =>
    (matchFutbinId && candidate.futbinId && item.futbinId && String(item.futbinId) === String(candidate.futbinId)) ||
    (item.rating === candidate.rating && item.name.trim().toLocaleLowerCase() === candidate.name.trim().toLocaleLowerCase())
  );
}

export async function resolveTargetEaId(target) {
  if (Number(target.eaId) > 0) {
    target.eaId = Number(target.eaId) & 0xffffff;
    return target.eaId;
  }
  const eaId = await fetchFutbinPlayerId(target);
  target.eaId = eaId;
  saveTargets();
  return eaId;
}

export function saveTargetSnapshot(listName) {
  if (!state.targets.length) {
    setTargetStatus({ type: 'error', message: 'Kaydedilecek oyuncu hedefi bulunmuyor.' });
    return false;
  }
  const snapshot = state.targets.map((player) => ({
    id: player.id, name: player.name, rating: player.rating, eaId: player.eaId || 0, price: player.price,
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
      duplicate.eaId = saved.eaId || duplicate.eaId || 0;
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
      if (!duplicate.eaId && Number(player.eaId) > 0) duplicate.eaId = Number(player.eaId);
      return;
    }
    const futbinId = player.futbinId == null ? null : String(player.futbinId);
    state.targets.push({
      id: futbinId ? 'futbin:' + futbinId : nameKey + ':' + player.rating,
      name: player.name,
      rating: player.rating,
      eaId: Number(player.eaId) || 0,
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
