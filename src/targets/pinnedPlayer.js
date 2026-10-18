// EA'de sabitlenmis oyuncuyu ve Buy Now fiyatini okuyup hedeflere ekler.
// Bagimliliklar: core/state/events, utils/dom/format, targets/targetOps ve targetStore.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { visibleElement } from '../utils/dom.js';
import { parseFutbinPrice } from '../utils/format.js';
import { fetchFutbinPlayerId } from '../futbin/playerLookup.js';
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

export async function addPinnedPlayerToTargets() {
  const player = selectedPinnedPlayer();
  if (player.error) {
    setTargetStatus({ type: 'error', message: player.error });
    emit('targets:changed');
    console.warn('[FutRUSH] Oyuncu hedefe eklenemedi:', player.error);
    return;
  }
  const price = selectedBuyNowPrice(player.selected);
  if (!price) {
    const message = 'Seçili oyuncu için Buy Now fiyatı bulunamadı. Arama filtresindeki en yüksek Buy Now fiyatını belirleyin.';
    setTargetStatus({ type: 'error', message });
    emit('targets:changed');
    console.warn('[FutRUSH] Oyuncu hedefe eklenemedi: Buy Now fiyatı okunamadı.');
    return;
  }
  setTargetStatus({ type: 'loading', message: player.name + ' kart kimliği FutBIN ile eşleştiriliyor...' });
  emit('targets:changed');
  const lookupTarget = {
    name: player.name,
    rating: player.rating,
    selectedCardId: player.eaId
  };
  let eaId;
  try {
    eaId = await fetchFutbinPlayerId(lookupTarget);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setTargetStatus({ type: 'error', message: 'Seçili kart FutBIN ile eşleştirilemedi: ' + message });
    emit('targets:changed');
    console.warn('[FutRUSH] Oyuncu hedefe eklenemedi: kart kimliği eşleştirilemedi.', error);
    return;
  }
  const rating = Number(player.rating) || Number(lookupTarget.rating) || 0;
  const targetIdentity = { name: player.name, rating, futbinId: null };
  const added = mergeTargetPlayers([{
    ...targetIdentity,
    eaId,
    eaIdTargetKey: targetEaIdKey(targetIdentity),
    price
  }]);
  if (added) {
    setTargetStatus({ type: 'success', message: player.name + (rating ? ' (' + rating + ')' : '') + ' · Buy Now ' + price.toLocaleString('tr-TR') + ' hedeflere eklendi.' });
  } else {
    const duplicate = findDuplicateTarget(state.targets, targetIdentity, { matchFutbinId: false });
    if (duplicate) {
      duplicate.eaId = eaId;
      duplicate.eaIdTargetKey = targetEaIdKey(duplicate);
      duplicate.buyNow = price;
      duplicate.price = price;
      saveTargets();
      setTargetStatus({ type: 'success', message: player.name + ' zaten listede; Buy Now fiyatı güncellendi.' });
    }
  }
  emit('targets:changed');
}
