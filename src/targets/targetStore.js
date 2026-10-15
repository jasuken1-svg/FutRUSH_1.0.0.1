// Canli hedefleri ve kayitli hedef listelerini localStorage ile state arasinda tasir.
// Bagimliliklar: core/state ve utils/dom.

import { state } from '../core/state.js';
import { pageStorage } from '../utils/dom.js';
import { warn, warnOnce } from '../core/logger.js';

export function saveTargets() {
  try {
    pageStorage().setItem('futrush-targets', JSON.stringify(state.targets));
  } catch (e) {
    warnOnce('storage-write:futrush-targets', '[FutRUSH:targetStore]', 'Aktif hedefler localStorage’a kaydedilemedi.', 'futrush-targets', String(e?.message || e));
  }
}

export function saveSavedTargetLists(lists) {
  pageStorage().setItem('futrush-saved-targets', JSON.stringify(lists));
}

export function normalizeTarget(item, mode) {
  if (mode === 'live') {
    // Live rows require finite rating/price values and clamp rounded prices to at least one.
    if (!item || typeof item.name !== 'string' || !Number.isFinite(Number(item.rating)) || !Number.isFinite(Number(item.price))) return null;
    const price = Math.max(1, Math.round(Number(item.price)));
    const rating = Math.round(Number(item.rating));
    const futbinId = item.futbinId == null ? null : String(item.futbinId);
    return {
      id: String(item.id || (futbinId ? 'futbin:' + futbinId : item.name + ':' + rating)),
      name: item.name,
      rating,
      eaId: Number(item.eaId) || 0,
      eaIdTargetKey: typeof item.eaIdTargetKey === 'string' ? item.eaIdTargetKey : null,
      price,
      searches: Math.max(1, Math.round(Number(item.searches) || 3)),
      buyNow: Math.max(1, Math.round(Number(item.buyNow) || price)),
      futbinId
    };
  }

  if (mode === 'savedList') {
    // Saved rows only require a positive price; their ID fallback and price rounding stay legacy-compatible.
    if (!item || typeof item.name !== 'string' || !(Number(item.price) > 0)) return null;
    return {
      id: String(item.id || item.futbinId || item.name + ':' + item.rating),
      name: item.name,
      rating: Math.round(Number(item.rating) || 0),
      eaId: Number(item.eaId) || 0,
      eaIdTargetKey: typeof item.eaIdTargetKey === 'string' ? item.eaIdTargetKey : null,
      price: Math.round(Number(item.price)),
      searches: Math.max(1, Math.round(Number(item.searches) || 3)),
      buyNow: Math.max(1, Math.round(Number(item.buyNow) || Number(item.price))),
      futbinId: item.futbinId == null ? null : String(item.futbinId)
    };
  }

  throw new TypeError('Target normalization mode must be "live" or "savedList".');
}

export function loadTargetStorage() {
  try {
    const savedTargets = JSON.parse(pageStorage().getItem('futrush-targets'));
    if (Array.isArray(savedTargets)) state.targets = savedTargets.map((item) => normalizeTarget(item, 'live')).filter(Boolean);
  } catch (e) {
    warn('[FutRUSH:targetStore]', 'Aktif hedefler localStorage’dan okunamadı.', 'futrush-targets', String(e?.message || e));
  }

  try {
    const savedCustomData = JSON.parse(pageStorage().getItem('futrush-saved-targets'));
    if (Array.isArray(savedCustomData) && savedCustomData.length && savedCustomData[0].players) {
      state.savedTargetLists = savedCustomData
        .filter((list) => list && typeof list.name === 'string' && Array.isArray(list.players))
        .map((list) => ({
          id: String(list.id || list.name),
          name: list.name,
          savedAt: Number(list.savedAt) || Date.now(),
          players: list.players.map((item) => normalizeTarget(item, 'savedList')).filter(Boolean)
        }));
    } else if (Array.isArray(savedCustomData) && savedCustomData.length) {
      const legacyPlayers = savedCustomData.map((item) => normalizeTarget(item, 'savedList')).filter(Boolean);
      if (legacyPlayers.length) {
        state.savedTargetLists = [{ id: 'legacy-saved-targets', name: 'Kayıtlı Liste', savedAt: Date.now(), players: legacyPlayers }];
      }
    }
    if (state.savedTargetLists.length) state.selectedSavedTargetListId = state.savedTargetLists[0].id;
  } catch (e) {
    warn('[FutRUSH:targetStore]', 'Kayıtlı hedef listeleri localStorage’dan okunamadı.', 'futrush-saved-targets', String(e?.message || e));
  }
}
