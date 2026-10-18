// EA'de sabitlenmis oyuncuyu ve Buy Now fiyatini okuyup hedeflere ekler.
// Bagimliliklar: core/state/events, utils/dom/format, targets/targetOps ve targetStore.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { visibleElement } from '../utils/dom.js';
import { parseFutbinPrice } from '../utils/format.js';
import { fetchFutbinPlayerId, queryFutbinPlayersByName } from '../futbin/playerLookup.js';
import { filterCandidates } from '../futbin/candidateMatcher.js';
import { toBaseId } from '../futbin/eaId.js';
import { extractSearchIntent } from './searchIntent.js';
import { findDuplicateTarget, mergeTargetPlayers, targetEaIdKey } from './targetOps.js';
import { saveTargets } from './targetStore.js';
import { setTargetStatus } from './targetStatus.js';

export function selectedPinnedPlayer() {
  const pinned = Array.from(document.querySelectorAll('.ut-pinned-list')).find(visibleElement);
  const rows = pinned ? Array.from(pinned.querySelectorAll('li.listFUTItem, .listFUTItem')).filter(visibleElement) : [];
  const selected = rows.find((row) => row.classList.contains('selected') || row.getAttribute('aria-selected') === 'true') || null;
  const nameNode = selected?.querySelector('.entityContainer .name, .name, [class*="player-name"], [data-player-name], [aria-label*="player" i]');
  const playerInput = Array.from(document.querySelectorAll('.ut-text-input-control, input[placeholder*="player" i], input[aria-label*="player" i]')).find(visibleElement);
  const name = String(nameNode?.getAttribute('data-player-name') || nameNode?.getAttribute('aria-label') || nameNode?.textContent || playerInput?.value || playerInput?.textContent || '').trim().replace(/\s+/g, ' ');
  const ratingNode = selected?.querySelector('.rating, [class*="rating"], [data-rating]');
  const ratingText = ratingNode?.getAttribute('data-rating') || ratingNode?.textContent || selected?.getAttribute('data-rating') || '';
  const ratingMatch = String(ratingText).match(/\b(\d{2})\b/) || String(selected?.textContent || '').match(/\b(\d{2})\b/);
  const rating = ratingMatch ? Number(ratingMatch[1]) : 0;
  if (!name) return { error: 'Oyuncu adı bulunamadı. Önce oyuncuyu arama alanından seçin.' };
  const selectedCardAttribute = (attribute) => {
    const selector = '[' + attribute + ']';
    return selected?.matches(selector) ? selected : selected?.querySelector(selector);
  };
  const definitionId = selectedCardAttribute('data-definition-id')?.getAttribute('data-definition-id');
  const resourceId = selectedCardAttribute('data-resource-id')?.getAttribute('data-resource-id');
  const playerImage = selected?.querySelector('img[src*="/players/"]');
  const imageId = playerImage?.getAttribute('src')?.match(/\/players\/(\d+)/i)?.[1];
  const rawEaId = [definitionId, resourceId, imageId]
    .map(Number)
    .find((id) => Number.isSafeInteger(id) && id > 0) || 0;
  const eaId = rawEaId > 0 ? rawEaId & 0xffffff : 0;
  return { selected, name, rating, eaId };
}

export function selectedBuyNowPrice(selected) {
  const scoped = selected?.closest('.ut-content') || document.querySelector('.ut-content') || document;
  // EA arama formunda fiyat kontrollerinin sırası: min/max teklif, min/max Buy Now.
  const spinners = Array.from(scoped.querySelectorAll('.ut-market-search-filters-view .search-prices .ut-numeric-input-spinner-control')).filter(visibleElement);
  const maxBuyNowInput = spinners[3]?.querySelector('input');
  const directInputs = Array.from(scoped.querySelectorAll('input')).filter(visibleElement);
  const labeledBuyNow = directInputs.filter((input) => {
    const parentText = input.closest('.ut-numeric-input-spinner-control, .ut-control, .form-group, label')?.textContent || '';
    const meta = [input.getAttribute('aria-label'), input.placeholder, input.name, input.id, parentText].filter(Boolean).join(' ');
    return /buy\s*now|hemen\s*al|satın\s*al/i.test(meta) && /max|maximum|azami|en\s*yüksek/i.test(meta);
  }).pop();
  const input = maxBuyNowInput || labeledBuyNow;
  let price = input ? parseFutbinPrice(input.value) : 0;
  if (!price) {
    const priceNode = selected?.querySelector('[data-price], .currency-coins, .buyNowPrice, [class*="buy-now"], [class*="price"]');
    price = Number(priceNode?.getAttribute('data-price')) || parseFutbinPrice(priceNode?.textContent || '');
  }
  return price > 0 ? Math.round(price) : 0;
}

export function commitCandidateTarget(candidate, price) {
  const rating = Number(candidate.rating) || 0;
  const targetIdentity = {
    name: candidate.name,
    rating,
    futbinId: candidate.futbinId || null,
    eaId: candidate.eaId,
    playerId: candidate.playerId,
    raretype: candidate.raretype,
    versionLabel: candidate.versionLabel,
    isHolo: candidate.isHolo,
    versionKnown: true
  };

  // Eski versiyonu bilinmeyen (placeholder / base) ayni oyuncu kaydini temizle
  const candidateBaseId = toBaseId(candidate.eaId || candidate.playerId);
  if (candidateBaseId > 0) {
    const staleIndex = state.targets.findIndex((t) =>
      !t.versionKnown && toBaseId(t.eaId || t.playerId) === candidateBaseId
    );
    if (staleIndex !== -1) {
      state.targets.splice(staleIndex, 1);
    }
  }

  const added = mergeTargetPlayers([{
    ...targetIdentity,
    eaIdTargetKey: targetEaIdKey(targetIdentity),
    price,
    buyNow: price
  }]);
  state.pendingCandidates = null;
  if (added) {
    setTargetStatus({
      type: 'success',
      message: candidate.name + (rating ? ' (' + rating + ')' : '') + (candidate.versionLabel ? ' [' + candidate.versionLabel + ']' : '') + ' · Buy Now ' + price.toLocaleString('tr-TR') + ' hedeflere eklendi.'
    });
  } else {
    const duplicate = findDuplicateTarget(state.targets, targetIdentity, { matchFutbinId: false });
    if (duplicate) {
      duplicate.eaId = candidate.eaId;
      duplicate.playerId = candidate.playerId;
      duplicate.versionKnown = true;
      duplicate.rating = rating;
      duplicate.raretype = candidate.raretype;
      duplicate.versionLabel = candidate.versionLabel;
      duplicate.isHolo = candidate.isHolo;
      duplicate.eaIdTargetKey = targetEaIdKey(duplicate);
      duplicate.buyNow = price;
      duplicate.price = price;
      saveTargets();
      setTargetStatus({
        type: 'success',
        message: candidate.name + ' zaten listede; sürüm ve Buy Now fiyatı güncellendi.'
      });
    }
  }
  emit('targets:changed');
}

export async function addPinnedPlayerToTargets() {
  const intent = extractSearchIntent();
  const player = selectedPinnedPlayer();
  const name = intent.name || player.name;
  if (!name) {
    const error = player.error || 'Oyuncu adı bulunamadı. Önce oyuncuyu arama alanından seçin.';
    setTargetStatus({ type: 'error', message: error });
    emit('targets:changed');
    console.warn('[FutRUSH] Oyuncu hedefe eklenemedi:', error);
    return;
  }

  const price = intent.buyNow || selectedBuyNowPrice(player.selected);
  if (!price) {
    const message = 'Seçili oyuncu için Buy Now fiyatı bulunamadı. Arama filtresindeki en yüksek Buy Now fiyatını belirleyin.';
    setTargetStatus({ type: 'error', message });
    emit('targets:changed');
    console.warn('[FutRUSH] Oyuncu hedefe eklenemedi: Buy Now fiyatı okunamadı.');
    return;
  }

  const wantsSpecial = intent.quality === 'SP' || (Array.isArray(intent.rarityIds) && intent.rarityIds.length > 0);
  const lookupTarget = {
    name,
    rating: player.rating,
    selectedCardId: player.eaId
  };
  if (intent.playerId) {
    lookupTarget.playerId = intent.playerId;
  }
  if (intent.quality) {
    lookupTarget.quality = intent.quality;
  }
  if (wantsSpecial) {
    lookupTarget.wantsSpecial = true;
    lookupTarget.rarityIds = intent.rarityIds;
    lookupTarget.returnDetails = true;
  }

  console.log('[FutRUSH] Hedef ekleme intent: ' + JSON.stringify({ name, price, playerId: lookupTarget.playerId, rarityIds: lookupTarget.rarityIds, quality: intent.quality }));
  setTargetStatus({ type: 'loading', message: name + ' kart kimliği FutBIN ile eşleştiriliyor...' });
  emit('targets:changed');

  let res;
  try {
    res = await fetchFutbinPlayerId(lookupTarget);
    console.log('[FutRUSH] fetchFutbinPlayerId response: ' + JSON.stringify(res));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setTargetStatus({ type: 'error', message: 'Seçili kart FutBIN ile eşleştirilemedi: ' + message });
    emit('targets:changed');
    console.warn('[FutRUSH] Oyuncu hedefe eklenemedi: kart kimliği eşleştirilemedi.', error);
    return;
  }

  if (res && typeof res === 'object' && res.status === 'ambiguous') {
    state.pendingCandidates = {
      name,
      price,
      candidates: res.candidates
    };
    setTargetStatus({ type: 'info', message: name + ' için ' + res.candidates.length + ' farklı kart bulundu. Lütfen sürümü seçin.' });
    emit('targets:changed');
    return;
  }

  const candidate = (res && typeof res === 'object' && res.candidate) ? res.candidate : null;
  if (candidate) {
    commitCandidateTarget(candidate, price);
    return;
  }

  const eaId = typeof res === 'number' ? res : (res?.eaId || 0);
  const rating = Number(player.rating) || Number(lookupTarget.rating) || 0;
  const targetIdentity = { name, rating, futbinId: null, eaId };
  const added = mergeTargetPlayers([{
    ...targetIdentity,
    eaIdTargetKey: targetEaIdKey(targetIdentity),
    price
  }]);
  if (added) {
    setTargetStatus({ type: 'success', message: name + (rating ? ' (' + rating + ')' : '') + ' · Buy Now ' + price.toLocaleString('tr-TR') + ' hedeflere eklendi.' });
  } else {
    const duplicate = findDuplicateTarget(state.targets, targetIdentity, { matchFutbinId: false });
    if (duplicate) {
      duplicate.eaId = eaId;
      duplicate.eaIdTargetKey = targetEaIdKey(duplicate);
      duplicate.buyNow = price;
      duplicate.price = price;
      saveTargets();
      setTargetStatus({ type: 'success', message: name + ' zaten listede; Buy Now fiyatı güncellendi.' });
    }
  }
  emit('targets:changed');
}
