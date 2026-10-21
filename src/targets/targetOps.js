// Hedef oyunculari birlestirir, EA kimliklerini cozer ve kayitli listeleri yonetir.
// Bagimliliklar: core/state/events, futbin/playerLookup ve targets/targetStore.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { fetchFutbinPlayerId } from '../futbin/playerLookup.js';
import { saveSavedTargetLists, saveTargets } from './targetStore.js';
import { setTargetStatus } from './targetStatus.js';
import { CONFIG } from '../core/config.js';
import { MIN_BIN, roundDownToStep } from '../ea/priceSteps.js';
import { toBaseId } from '../futbin/eaId.js';

export function applyTargetAddDiscount(player, discountRate = CONFIG.targetAdd.discountRate) {
  const rate = typeof discountRate === 'number' && Number.isFinite(discountRate) && discountRate >= 0 && discountRate < 1
    ? discountRate
    : (typeof CONFIG.targetAdd.discountRate === 'number' && Number.isFinite(CONFIG.targetAdd.discountRate) && CONFIG.targetAdd.discountRate >= 0 && CONFIG.targetAdd.discountRate < 1
      ? CONFIG.targetAdd.discountRate
      : 0.1);
  const originalPrice = Number(player.price);
  const discountedPrice = Number.isFinite(originalPrice)
    ? Math.round(originalPrice * 0.95 * (1 - rate))
    : MIN_BIN;
  const buyNow = Math.max(MIN_BIN, roundDownToStep(discountedPrice));
  return { ...player, price: originalPrice, buyNow };
}

export function applyTargetAddEaTax(player, eaTaxRate = CONFIG.targetAdd.eaTaxRate) {
  const rate = typeof eaTaxRate === 'number' && Number.isFinite(eaTaxRate) && eaTaxRate >= 0 && eaTaxRate < 1
    ? eaTaxRate
    : 0.05;
  const originalPrice = Number(player.price);
  const discountedPrice = Number.isFinite(originalPrice) ? originalPrice * (1 - rate) : MIN_BIN;
  const price = Math.max(MIN_BIN, roundDownToStep(discountedPrice));
  return { ...player, price, buyNow: price };
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
    id: player.id, name: player.name, commonName: player.commonName || player.name,
    rating: player.rating, position: player.position || '', eaId: player.eaId || 0,
    eaIdTargetKey: player.eaIdTargetKey || null, price: player.price,
    searches: player.searches, buyNow: player.buyNow, futbinId: player.futbinId,
    versionLabel: player.versionLabel || '',
    playerImageUrl: player.playerImageUrl || '',
    promoImageUrl: player.promoImageUrl || '',
    holographicAnimationUrl: player.holographicAnimationUrl || '',
    stats: player.stats || null,
    nationImageUrl: player.nationImageUrl || '',
    leagueImageUrl: player.leagueImageUrl || '',
    clubImageUrl: player.clubImageUrl || '',
    raretype: player.raretype != null ? player.raretype : null,
    isHolo: Boolean(player.isHolo)
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
      if (player.playerImageUrl && !duplicate.playerImageUrl) duplicate.playerImageUrl = player.playerImageUrl;
      if (player.promoImageUrl && !duplicate.promoImageUrl) duplicate.promoImageUrl = player.promoImageUrl;
      if (player.versionLabel && !duplicate.versionLabel) duplicate.versionLabel = player.versionLabel;
      if (player.commonName && !duplicate.commonName) duplicate.commonName = player.commonName;
      if (player.position && !duplicate.position) duplicate.position = player.position;
      if (player.stats && !duplicate.stats) duplicate.stats = player.stats;
      if (player.nationImageUrl && !duplicate.nationImageUrl) duplicate.nationImageUrl = player.nationImageUrl;
      if (player.leagueImageUrl && !duplicate.leagueImageUrl) duplicate.leagueImageUrl = player.leagueImageUrl;
      if (player.clubImageUrl && !duplicate.clubImageUrl) duplicate.clubImageUrl = player.clubImageUrl;
      if (player.leagueName && !duplicate.leagueName) duplicate.leagueName = player.leagueName;
      if (player.leagueImageFallbacks && !duplicate.leagueImageFallbacks) duplicate.leagueImageFallbacks = player.leagueImageFallbacks;
      if (player.playstylesPlus && !duplicate.playstylesPlus) duplicate.playstylesPlus = player.playstylesPlus;
      if (player.priceUpdatedAt && !duplicate.priceUpdatedAt) duplicate.priceUpdatedAt = player.priceUpdatedAt;
      if (player.holographicAnimationUrl && !duplicate.holographicAnimationUrl) duplicate.holographicAnimationUrl = player.holographicAnimationUrl;
      if (player.isHolo) duplicate.isHolo = true;
      return;
    }
    const futbinId = player.futbinId == null ? null : String(player.futbinId);
    state.targets.push({
      id: futbinId ? 'futbin:' + futbinId : nameKey + ':' + player.rating,
      name: player.name,
      commonName: player.commonName || player.name,
      rating: player.rating,
      position: player.position || '',
      eaId: Number(player.eaId) || 0,
      eaIdTargetKey: player.eaIdTargetKey || null,
      price: player.price,
      searches: 3,
      buyNow: player.buyNow != null ? player.buyNow : player.price,
      futbinId,
      playerId: player.playerId || toBaseId(player.eaId),
      versionKnown: Boolean(player.versionKnown),
      versionLabel: player.versionLabel || '',
      playerImageUrl: player.playerImageUrl || '',
      promoImageUrl: player.promoImageUrl || '',
      holographicAnimationUrl: player.holographicAnimationUrl || '',
      stats: player.stats || null,
      nationImageUrl: player.nationImageUrl || '',
      leagueImageUrl: player.leagueImageUrl || '',
      clubImageUrl: player.clubImageUrl || '',
      leagueImageFallbacks: Array.isArray(player.leagueImageFallbacks) ? player.leagueImageFallbacks : [],
      leagueName: player.leagueName || '',
      playstylesPlus: Array.isArray(player.playstylesPlus) ? player.playstylesPlus : [],
      priceUpdatedAt: Number(player.priceUpdatedAt) || Date.now(),
      nationId: Number(player.nationId) || 0,
      clubId: Number(player.clubId) || 0,
      leagueId: Number(player.leagueId) || 0,
      raretype: player.raretype != null ? player.raretype : null,
      isHolo: Boolean(player.isHolo)
    });
    added++;
  });
  saveTargets();
  emit('targets:changed');
  return added;
}
