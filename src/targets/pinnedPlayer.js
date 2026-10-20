// EA'de sabitlenmis oyuncuyu ve Buy Now fiyatini okuyup hedeflere ekler.
// Bagimliliklar: core/state/events, utils/dom/format, targets/targetOps ve targetStore.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { visibleElement } from '../utils/dom.js';
import { parseFutbinPrice } from '../utils/format.js';
import { fetchFutbinPlayerId, searchPlayerAllVersions } from '../futbin/playerLookup.js';
import { mapCandidate, validateQualityFilter } from '../futbin/candidateMatcher.js';
import { toBaseId } from '../futbin/eaId.js';
import { extractSearchIntent } from './searchIntent.js';
import { findDuplicateTarget, mergeTargetPlayers, targetEaIdKey } from './targetOps.js';
import { saveTargets } from './targetStore.js';
import { setTargetStatus } from './targetStatus.js';
import { CONFIG } from '../core/config.js';
import { roundDownToStep } from '../ea/priceSteps.js';

export function selectedPinnedPlayer() {
  const pinned = Array.from(document.querySelectorAll('.ut-pinned-list')).find(visibleElement);
  const rows = pinned ? Array.from(pinned.querySelectorAll('li.listFUTItem, .listFUTItem')).filter(visibleElement) : [];
  const selected = rows.find((row) => row.classList.contains('selected') || row.getAttribute('aria-selected') === 'true') || null;
  const nameNode = selected?.querySelector('.entityContainer .name, .name, [class*="player-name"], [data-player-name], [aria-label*="player" i]');
  const playerInput = Array.from(document.querySelectorAll('.ut-player-search.control input, .ut-player-search input, .ut-text-input-control, input[placeholder*="player" i], input[aria-label*="player" i]')).find(visibleElement);
  const playerSearchDiv = Array.from(document.querySelectorAll('.ut-player-search.control, .ut-player-search-control, .ut-player-search')).find(visibleElement);
  const searchDivText = playerSearchDiv?.querySelector('.btn-text, .text, span')?.textContent?.trim();
  const name = String(nameNode?.getAttribute('data-player-name') || nameNode?.getAttribute('aria-label') || nameNode?.textContent || playerInput?.value || searchDivText || playerInput?.textContent || '').trim().replace(/\s+/g, ' ');
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

function selectedBuyNowPrice(selected) {
  const scoped = selected?.closest('.ut-content') || document.querySelector('.ut-content') || document;
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
  const futbinPrice = Number(candidate.price) > 0 ? Math.round(Number(candidate.price)) : 0;
  const userPrice = Number(price) > 0 ? Math.round(Number(price)) : 0;
  const discountRate = (typeof CONFIG.targetAdd?.discountRate === 'number' && Number.isFinite(CONFIG.targetAdd.discountRate))
    ? CONFIG.targetAdd.discountRate
    : 0.1;
  const defaultBuyNow = futbinPrice > 0
    ? Math.max(150, roundDownToStep(futbinPrice * (1 - discountRate)))
    : (Number(candidate.raw?.ps_LCPrice) || Number(candidate.raw?.pc_LCPrice) || 10000);
  const finalBuyNow = userPrice > 0 ? userPrice : defaultBuyNow;
  const finalMarketPrice = futbinPrice > 0 ? futbinPrice : finalBuyNow;
  const versionLabel = candidate.versionLabel && candidate.versionLabel !== 'Base'
    ? candidate.versionLabel
    : (rating >= 75 ? 'Gold' : rating >= 65 ? 'Silver' : rating > 0 ? 'Bronze' : (candidate.versionLabel || 'Base'));

  const targetIdentity = {
    name: candidate.name,
    commonName: candidate.commonName || candidate.name,
    displayName: candidate.displayName || candidate.commonName || candidate.name,
    rating,
    position: candidate.position || '',
    futbinId: candidate.futbinId || null,
    eaId: candidate.eaId,
    baseId: toBaseId(candidate.baseId || candidate.playerId || candidate.eaId),
    playerId: candidate.playerId || candidate.baseId,
    raretype: candidate.raretype,
    versionLabel,
    isHolo: candidate.isHolo,
    playerImageUrl: candidate.playerImageUrl || '',
    playerImageFallbackUrl: candidate.playerImageFallbackUrl || '',
    promoImageUrl: candidate.promoImageUrl || '',
    holographicAnimationUrl: candidate.holographicAnimationUrl || '',
    stats: candidate.stats || null,
    nationId: candidate.nationId || 0,
    clubId: candidate.clubId || 0,
    leagueId: candidate.leagueId || 0,
    nationImageUrl: candidate.nationImageUrl || '',
    clubImageUrl: candidate.clubImageUrl || '',
    leagueImageUrl: candidate.leagueImageUrl || '',
    versionKnown: true
  };

  // Eski versiyonu bilinmeyen ayni oyuncu kaydini temizle
  const candidateBaseId = toBaseId(candidate.eaId || candidate.playerId || candidate.baseId);
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
    price: finalMarketPrice,
    buyNow: finalBuyNow
  }]);
  state.pendingCandidates = null;
  if (added) {
    setTargetStatus({
      type: 'success',
      message: candidate.name + (rating ? ' (' + rating + ')' : '') + (candidate.versionLabel ? ' [' + candidate.versionLabel + ']' : '') + ' · Buy Now ' + finalBuyNow.toLocaleString('tr-TR') + ' hedeflere eklendi.'
    });
  } else {
    const duplicate = findDuplicateTarget(state.targets, targetIdentity, { matchFutbinId: false });
    if (duplicate) {
      duplicate.eaId = candidate.eaId;
      duplicate.playerId = candidate.playerId || candidate.baseId;
      duplicate.versionKnown = true;
      duplicate.rating = rating;
      duplicate.raretype = candidate.raretype;
      duplicate.versionLabel = candidate.versionLabel;
      duplicate.position = candidate.position || duplicate.position || '';
      duplicate.commonName = candidate.commonName || duplicate.commonName || '';
      duplicate.displayName = targetIdentity.displayName;
      duplicate.stats = candidate.stats || duplicate.stats || null;
      duplicate.nationId = candidate.nationId || duplicate.nationId || 0;
      duplicate.clubId = candidate.clubId || duplicate.clubId || 0;
      duplicate.leagueId = candidate.leagueId || duplicate.leagueId || 0;
      duplicate.nationImageUrl = candidate.nationImageUrl || duplicate.nationImageUrl || '';
      duplicate.clubImageUrl = candidate.clubImageUrl || duplicate.clubImageUrl || '';
      duplicate.leagueImageUrl = candidate.leagueImageUrl || duplicate.leagueImageUrl || '';
      duplicate.isHolo = candidate.isHolo;
      duplicate.holographicAnimationUrl = candidate.holographicAnimationUrl || duplicate.holographicAnimationUrl || '';
      duplicate.playerImageUrl = candidate.playerImageUrl || duplicate.playerImageUrl || '';
      duplicate.playerImageFallbackUrl = candidate.playerImageFallbackUrl || duplicate.playerImageFallbackUrl || '';
      duplicate.promoImageUrl = candidate.promoImageUrl || duplicate.promoImageUrl || '';
      duplicate.eaIdTargetKey = targetEaIdKey(duplicate);
      duplicate.buyNow = finalBuyNow;
      duplicate.price = finalMarketPrice;
      saveTargets();
      setTargetStatus({
        type: 'success',
        message: candidate.name + ' zaten listede; sürüm ve Buy Now fiyatı güncellendi.'
      });
    }
  }
  emit('targets:changed');
}

export async function hydrateTargetsWithFutbin(onItemComplete) {
  const needsHydration = state.targets.filter((t) => !t.hydrationAttempted && (!t.playerImageUrl || !t.promoImageUrl || !t.stats || !t.clubImageUrl));
  if (!needsHydration.length) return;

  needsHydration.forEach((t) => {
    t.hydrationAttempted = true;
    t.isSkeleton = true;
  });

  for (const target of needsHydration) {
    try {
      const versions = await searchPlayerAllVersions(target.name);
      if (Array.isArray(versions) && versions.length) {
        const matched = versions.find((v) =>
          (target.eaId && v.eaId === target.eaId) ||
          (target.futbinId && String(v.futbinId) === String(target.futbinId)) ||
          (target.rating && v.rating === target.rating)
        ) || versions[0];
        if (matched) {
          if (!target.playerImageUrl) target.playerImageUrl = matched.playerImageUrl;
          if (!target.promoImageUrl) target.promoImageUrl = matched.promoImageUrl;
          if (!target.playerImageFallbackUrl) target.playerImageFallbackUrl = matched.playerImageFallbackUrl;
          if (!target.nationImageUrl) target.nationImageUrl = matched.nationImageUrl;
          if (!target.clubImageUrl) target.clubImageUrl = matched.clubImageUrl;
          if (!target.leagueImageUrl) target.leagueImageUrl = matched.leagueImageUrl;
          if (!target.stats) target.stats = matched.stats;
          if (!target.position) target.position = matched.position;
          if (!target.futbinId) target.futbinId = matched.futbinId;
          if (!target.versionLabel) target.versionLabel = matched.versionLabel;
          if (!target.price && matched.price) target.price = matched.price;
        }
      }
    } catch (e) {}
    delete target.isSkeleton;
  }
  saveTargets();
  if (typeof onItemComplete === 'function') onItemComplete();
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

  if (intent.quality && player.rating) {
    const conflict = validateQualityFilter(player.rating, intent.quality);
    if (conflict) {
      setTargetStatus({ type: 'error', message: conflict });
      emit('targets:changed');
      console.warn('[FutRUSH] Oyuncu hedefe eklenemedi:', conflict);
      return;
    }
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

  let candidate = (res && typeof res === 'object' && res.candidate) ? res.candidate : null;
  const eaId = typeof res === 'number' ? res : (res?.eaId || 0);

  // Eger candidate donmediyse (mock veya fallback), mapCandidate ile sentetik olustur
  if (!candidate && eaId) {
    candidate = mapCandidate({
      resource_id: eaId,
      playername: name,
      rating: Number(player.rating) || Number(lookupTarget.rating) || 0
    });
  }

  if (candidate) {
    if (intent.quality) {
      const conflict = validateQualityFilter(candidate.rating, intent.quality);
      if (conflict) {
        setTargetStatus({ type: 'error', message: conflict });
        emit('targets:changed');
        console.warn('[FutRUSH] Oyuncu hedefe eklenemedi:', conflict);
        return;
      }
    }
    commitCandidateTarget(candidate, price);
    return;
  }

  // Son fallback
  const rating = Number(player.rating) || Number(lookupTarget.rating) || 0;
  const versionLabel = rating >= 75 ? 'Gold' : rating >= 65 ? 'Silver' : rating > 0 ? 'Bronze' : 'Base';
  const playerImageUrl = eaId ? `https://cdn.futbin.com/content/fifa27/img/players/${eaId}.png` : '';
  const promoImageUrl = rating >= 75 ? 'https://cdn.futbin.com/content/fifa27/img/cards/hd/0_gold.png' : 'https://cdn.futbin.com/content/fifa27/img/cards/hd/0_silver.png';
  const targetIdentity = {
    name,
    rating,
    futbinId: null,
    eaId,
    versionLabel,
    playerImageUrl,
    promoImageUrl
  };
  const added = mergeTargetPlayers([{
    ...targetIdentity,
    eaIdTargetKey: targetEaIdKey(targetIdentity),
    price: price || 1000,
    buyNow: price || 1000
  }]);
  if (added) {
    setTargetStatus({ type: 'success', message: name + (rating ? ' (' + rating + ')' : '') + ' · Buy Now ' + (price || 1000).toLocaleString('tr-TR') + ' hedeflere eklendi.' });
  }
  emit('targets:changed');
}
