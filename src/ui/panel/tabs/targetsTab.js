// Hedef oyuncu kartlarini, fiyat kontrollerini ve liste eylemlerini cizer.
// Bagimliliklar: core/state/events, utils/format ve targets/targetStore.

import { state } from '../../../core/state.js';
import { emit } from '../../../core/events.js';
import { saveTargets } from '../../../targets/targetStore.js';
import { setTargetStatus } from '../../../targets/targetStatus.js';
import { formatFutbinRowPrice, getPlatform } from '../../../futbin/platform.js';
import { commitCandidateTarget, hydrateTargetsWithFutbin } from '../../../targets/pinnedPlayer.js';
import { searchPlayerAllVersions, searchUniquePlayers, fetchPlayerDetailsFromFutbinApi } from '../../../futbin/playerLookup.js';
import { createEaCardElement } from '../cardRenderer.js';
import { CONFIG } from '../../../core/config.js';
import { MIN_PRICE, clampPrice, nextPriceUp, nextPriceDown, roundDownToStep, roundToPriceStep } from '../../../ea/priceSteps.js';
import { addMarketLog } from '../../marketLogBox.js';

let isHydrating = false;
let isUpdatingPrices = false;

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Son güncelleme: —';
  const diffMs = Date.now() - Number(timestamp);
  if (diffMs < 0 || isNaN(diffMs)) return 'Son güncelleme: —';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'Son güncelleme: Az önce';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Son güncelleme: ${diffMin} dakika önce`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Son güncelleme: ${diffHours} saat önce`;
  const diffDays = Math.floor(diffHours / 24);
  return `Son güncelleme: ${diffDays} gün önce`;
}

function attachHoldRepeat(button, onTrigger) {
  let timer = null;
  let interval = null;
  let didTriggerOnDown = false;

  const stop = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    setTimeout(() => {
      didTriggerOnDown = false;
    }, 50);
  };

  const start = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) {
      if (e.button === 1) e.preventDefault();
      return;
    }
    didTriggerOnDown = true;
    if (timer) clearTimeout(timer);
    if (interval) clearInterval(interval);
    onTrigger(e);
    timer = setTimeout(() => {
      interval = setInterval(() => {
        onTrigger(e);
      }, 70);
    }, 1000);
  };

  button.addEventListener('mousedown', start);
  button.addEventListener('mouseup', stop);
  button.addEventListener('mouseleave', stop);
  button.addEventListener('touchstart', start, { passive: true });
  button.addEventListener('touchend', stop);
  button.addEventListener('touchcancel', stop);
  window.addEventListener('blur', stop);

  button.addEventListener('click', (e) => {
    e.preventDefault();
    if (!didTriggerOnDown) {
      onTrigger(e);
    }
  });
}

export function updateTargetStatus(statusElement) {
  if (statusElement) {
    statusElement.hidden = true;
    statusElement.style.display = 'none';
    statusElement.replaceChildren();
  }
}

export function expireTargetStatus(content) {
  const statusElement = content.querySelector('.fr-target-status');
  if (statusElement) statusElement.remove();
}

export function renderTargetContent(content) {
  const previousStatus = content.querySelector('.fr-target-status');
  content.innerHTML =
    '<div class="fr-target-view"><div class="fr-target-status" aria-live="polite"></div><div class="fr-target-list" role="list"></div>' +
    '<div class="fr-target-actions"><button class="fr-target-action fr-target-save" type="button" data-filter-mode="save">Kaydet</button><button class="fr-target-action fr-target-load" type="button" data-filter-mode="load">Yükle</button></div></div>';
  const status = content.querySelector('.fr-target-status');
  if (previousStatus) status.replaceWith(previousStatus);
  updateTargetStatus(previousStatus || status, state.targetStatus, state.targetLoading);
  const targetView = content.querySelector('.fr-target-view');
  const list = content.querySelector('.fr-target-list');

  // Arka planda eksik görsel/stat alanlarını FUTBIN'den tamamla (Bölüm 1.2)
  if (!isHydrating && state.targets.some((t) => !t.hydrationAttempted && (!t.playerImageUrl || !t.promoImageUrl || !t.stats || !t.clubImageUrl || !t.playstylesPlus || !t.playstylesPlus.length))) {
    isHydrating = true;
    hydrateTargetsWithFutbin().then(() => {
      isHydrating = false;
      renderTargetContent(content);
    }).catch(() => {
      isHydrating = false;
    });
  }

  // FutBIN Oyuncu Arama Arayuzu
  const searchBox = document.createElement('div');
  searchBox.className = 'fr-target-search-box';
  const searchRow = document.createElement('div');
  searchRow.className = 'fr-target-search-row';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'fr-target-search-input';
  searchInput.placeholder = 'Oyuncu Ara (FutBIN)...';
  searchInput.setAttribute('aria-label', 'Oyuncu Ara (FutBIN)');

  const updatePricesBtn = document.createElement('button');
  updatePricesBtn.type = 'button';
  updatePricesBtn.className = 'fr-target-update-prices-btn';
  updatePricesBtn.textContent = 'Güncelle 💰';
  updatePricesBtn.setAttribute('title', 'Tüm hedef oyuncuların FutBIN fiyatlarını güncelle');

  updatePricesBtn.addEventListener('click', async () => {
    if (isUpdatingPrices) return;
    if (!state.targets.length) {
      setTargetStatus({ type: 'info', message: 'Güncellenecek hedef oyuncu bulunmuyor.' });
      return;
    }
    isUpdatingPrices = true;
    updatePricesBtn.classList.add('is-updating');
    updatePricesBtn.textContent = '⏳ Güncelleniyor...';
    setTargetStatus({ type: 'loading', message: 'Fiyatlar FutBIN üzerinden güncelleniyor...' });
    let updatedCount = 0;
    try {
      const discountRate = (typeof CONFIG.targetAdd?.discountRate === 'number' && Number.isFinite(CONFIG.targetAdd.discountRate) && CONFIG.targetAdd.discountRate >= 0 && CONFIG.targetAdd.discountRate < 1)
        ? CONFIG.targetAdd.discountRate
        : 0.1;

      for (const target of state.targets) {
        const versions = await searchPlayerAllVersions(target.name);
        if (Array.isArray(versions) && versions.length) {
          // 1. FutBIN ID eşleşmesi (en kesin)
          let matched = target.futbinId ? versions.find((v) => String(v.futbinId) === String(target.futbinId)) : null;

          // 2. EA ID eşleşmesi
          if (!matched && target.eaId) {
            matched = versions.find((v) => Number(v.eaId) === Number(target.eaId));
          }

          // 3. Reyting + Versiyon etiketi / nadirlik / Holo eşleşmesi (TOTW/Holo kartı base ile karışamaz)
          if (!matched && target.rating) {
            matched = versions.find((v) =>
              Number(v.rating) === Number(target.rating) &&
              (
                (target.raretype != null && v.raretype === target.raretype) ||
                (target.versionLabel && v.versionLabel === target.versionLabel) ||
                (Boolean(v.isHolo) === Boolean(target.isHolo))
              )
            );
          }

          // 4. Versiyon etiketi veya Holo durumu eşleşmesi
          if (!matched && (target.versionLabel || target.isHolo)) {
            matched = versions.find((v) =>
              (target.versionLabel && v.versionLabel === target.versionLabel) ||
              (target.isHolo && v.isHolo)
            );
          }

          // 5. Yalnızca standart kartlar için aynı reyting eşleşmesi
          const isStandardTarget = !target.isHolo && (!target.versionLabel || ['Gold', 'Silver', 'Bronze', 'Base'].includes(target.versionLabel));
          if (!matched && isStandardTarget && target.rating) {
            matched = versions.find((v) => Number(v.rating) === Number(target.rating) && !v.isHolo);
          }

          // 6. Özel kart için hala bulunamadıysa özel kartlar arasından en yakın reytingli olanı seç
          if (!matched && !isStandardTarget) {
            matched = versions.find((v) => v.isHolo || (v.versionLabel && !['Gold', 'Silver', 'Bronze', 'Base'].includes(v.versionLabel)));
          }

          // 7. Son çare (yalnızca standart kartlar için)
          if (!matched && isStandardTarget) {
            matched = versions[0];
          }

          if (matched) {
            const oldPrice = Number(target.price) || 0;
            const futbinPrice = Number(matched.price) || 0;
            if (futbinPrice > 0) {
              target.price = futbinPrice;
              target.priceUpdatedAt = Date.now();
              target.buyNow = Math.max(150, roundDownToStep(Math.round(futbinPrice * 0.95 * (1 - discountRate))));
              target.priceTrend = oldPrice > 0 ? (futbinPrice > oldPrice ? 'up' : (futbinPrice < oldPrice ? 'down' : 'same')) : 'same';
              updatedCount++;
            }
            if (!target.playerImageUrl && matched.playerImageUrl) target.playerImageUrl = matched.playerImageUrl;
            if (!target.promoImageUrl && matched.promoImageUrl) target.promoImageUrl = matched.promoImageUrl;
            if (!target.playerImageFallbackUrl && matched.playerImageFallbackUrl) target.playerImageFallbackUrl = matched.playerImageFallbackUrl;
            if (!target.nationImageUrl && matched.nationImageUrl) target.nationImageUrl = matched.nationImageUrl;
            if (!target.clubImageUrl && matched.clubImageUrl) target.clubImageUrl = matched.clubImageUrl;
            if (!target.leagueImageUrl && matched.leagueImageUrl) target.leagueImageUrl = matched.leagueImageUrl;
            if (!target.leagueName && matched.leagueName) target.leagueName = matched.leagueName;
            if (!target.leagueImageFallbacks && matched.leagueImageFallbacks) target.leagueImageFallbacks = matched.leagueImageFallbacks;
            if ((!target.playstylesPlus || !target.playstylesPlus.length) && matched.playstylesPlus?.length) target.playstylesPlus = matched.playstylesPlus;
            if (!target.stats && matched.stats) target.stats = matched.stats;
            if (!target.position && matched.position) target.position = matched.position;
            if (!target.futbinId && matched.futbinId) target.futbinId = matched.futbinId;
            if (!target.versionLabel && matched.versionLabel) target.versionLabel = matched.versionLabel;
          }
        }
      }
      saveTargets();
      setTargetStatus({ type: 'success', message: `${updatedCount} oyuncunun fiyatı ve SATIN AL hedefleri kâr marjına göre güncellendi.` });
    } catch (err) {
      setTargetStatus({ type: 'error', message: 'Fiyat güncelleme sırasında hata oluştu.' });
    } finally {
      isUpdatingPrices = false;
      updatePricesBtn.classList.remove('is-updating');
      renderTargetContent(content);
    }
  });

  searchRow.append(searchInput, updatePricesBtn);
  const searchResults = document.createElement('div');
  searchResults.className = 'fr-target-search-results';
  searchResults.hidden = true;
  searchBox.append(searchRow, searchResults);

  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    const query = searchInput.value.trim();
    if (query.length < 3) {
      searchResults.hidden = true;
      searchResults.replaceChildren();
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const players = await searchUniquePlayers(query);
        if (searchInput.value.trim() !== query) return;
        searchResults.replaceChildren();
        if (!players.length) {
          const emptyItem = document.createElement('div');
          emptyItem.className = 'fr-search-item-empty';
          emptyItem.textContent = 'Sonuç bulunamadı.';
          searchResults.appendChild(emptyItem);
        } else {
          players.forEach((player) => {
            const item = document.createElement('div');
            item.className = 'fr-search-result-item fr-search-player-item';
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');

            const nameEl = document.createElement('div');
            nameEl.className = 'fr-search-item-name';
            nameEl.textContent = player.name;

            const ratingBadge = document.createElement('span');
            ratingBadge.className = 'fr-search-player-rating-badge';
            ratingBadge.textContent = String(player.baseRating || player.highestRating || '');

            item.append(nameEl, ratingBadge);
            item.addEventListener('click', () => {
              state.pendingCandidates = {
                name: player.name,
                candidates: player.versions,
                price: player.baseCard?.price || player.highestCard?.price || 0
              };
              renderTargetContent(content);
            });
            searchResults.appendChild(item);
          });
        }
        searchResults.hidden = false;
      } catch (err) {
        searchResults.hidden = true;
      }
    }, 300);
  });

  targetView.insertBefore(searchBox, list);

  // Üstte Özet Çubuğu (Bölüm 3.4)
  let summaryBar = null;
  const updateSummaryBar = () => {
    if (!summaryBar) return;
    let totalTargetCards = 0;
    let totalCoinsNeeded = 0;
    let totalEstProfit = 0;
    state.targets.forEach((t) => {
      const buy = Number(t.buyNow) || 0;
      const searches = Math.max(1, Math.round(Number(t.searches) || 1));
      const fbPrice = Number(t.price) || 0;
      totalTargetCards += searches;
      totalCoinsNeeded += buy * searches;
      if (fbPrice > 0) {
        totalEstProfit += (Math.round(fbPrice * 0.95) - buy) * searches;
      }
    });
    summaryBar.innerHTML = `
      <span class="fr-summary-item">Hedef: <strong class="fr-summary-val">${totalTargetCards}</strong></span>
      <span class="fr-summary-item">Gereken: <strong class="fr-summary-val">${totalCoinsNeeded.toLocaleString('tr-TR')}</strong></span>
      <span class="fr-summary-item">Tahmini Kâr: <strong class="fr-summary-val fr-summary-profit">${totalEstProfit > 0 ? '+' : ''}${totalEstProfit.toLocaleString('tr-TR')}</strong></span>
    `;
  };

  if (state.targets.length > 0) {
    summaryBar = document.createElement('div');
    summaryBar.className = 'fr-target-summary-bar';
    updateSummaryBar();
    targetView.insertBefore(summaryBar, list);
  }

  // Aday Kart Seçici (Pending Candidates)
  if (state.pendingCandidates && Array.isArray(state.pendingCandidates.candidates)) {
    const selector = document.createElement('div');
    selector.className = 'fr-candidate-selector';

    const header = document.createElement('div');
    header.className = 'fr-candidate-header';
    const headerTitle = document.createElement('span');
    headerTitle.textContent = state.pendingCandidates.name + ' Sürümünü Seçin:';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'fr-candidate-cancel';
    cancelBtn.textContent = '×';
    cancelBtn.setAttribute('aria-label', 'Seçimi iptal et');
    cancelBtn.addEventListener('click', () => {
      state.pendingCandidates = null;
      setTargetStatus({ type: 'info', message: 'Kart seçimi iptal edildi.' });
      emit('targets:changed');
    });
    header.append(headerTitle, cancelBtn);
    selector.appendChild(header);

    const candidateList = document.createElement('div');
    candidateList.className = 'fr-candidate-list';

    state.pendingCandidates.candidates.forEach((candidate) => {
      const card = document.createElement('div');
      card.className = 'fr-candidate-card';

      if (candidate.promoImageUrl || candidate.playerImageUrl) {
        const cardPreview = createEaCardElement(candidate, { size: 'thumb' });
        card.appendChild(cardPreview);
      }

      const body = document.createElement('div');
      body.className = 'fr-candidate-body';

      const title = document.createElement('div');
      title.className = 'fr-candidate-title';
      const name = document.createElement('span');
      name.className = 'fr-candidate-name';
      name.textContent = candidate.name;
      const rating = document.createElement('span');
      rating.className = 'fr-candidate-rating';
      rating.textContent = String(candidate.rating || '—');
      title.append(name, rating);

      const badge = document.createElement('div');
      badge.className = 'fr-candidate-badge' + (candidate.isHolo ? ' fr-candidate-badge-holo' : '');
      badge.textContent = candidate.versionLabel || 'Özel';

      const meta = document.createElement('div');
      meta.className = 'fr-candidate-meta';
      const leagueText = candidate.leagueName ? ' · ' + candidate.leagueName : '';
      meta.textContent = 'FutBIN ' + candidate.futbinId + ' · resource ' + candidate.eaId + leagueText;

      const priceEl = document.createElement('div');
      priceEl.className = 'fr-candidate-price';
      const candidatePriceVal = Number(candidate.price) || 0;
      priceEl.textContent = candidatePriceVal > 0
        ? `${getPlatform().toUpperCase()} fiyat: ${candidatePriceVal.toLocaleString('tr-TR')}`
        : (candidate.raw ? formatFutbinRowPrice(candidate.raw, getPlatform()) : 'Fiyat yok');

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'fr-candidate-btn';
      selectBtn.textContent = 'Bu kartı ekle';
      selectBtn.addEventListener('click', async () => {
        if (!candidate.playstylesPlus || !candidate.playstylesPlus.length) {
          try {
            const details = await fetchPlayerDetailsFromFutbinApi({
              name: candidate.name,
              rating: candidate.rating,
              eaId: candidate.eaId,
              futbinId: candidate.futbinId
            });
            if (details) {
              if (details.playstylesPlus?.length) candidate.playstylesPlus = details.playstylesPlus;
              if (!candidate.stats && details.stats) candidate.stats = details.stats;
              if (!candidate.leagueImageUrl && details.leagueImageUrl) candidate.leagueImageUrl = details.leagueImageUrl;
              if (!candidate.clubImageUrl && details.clubImageUrl) candidate.clubImageUrl = details.clubImageUrl;
              if (!candidate.nationImageUrl && details.nationImageUrl) candidate.nationImageUrl = details.nationImageUrl;
            }
          } catch (_) {}
        }
        commitCandidateTarget(candidate);
        renderTargetContent(content);
      });

      body.append(title, badge, meta, priceEl, selectBtn);
      card.appendChild(body);
      candidateList.appendChild(card);
    });

    selector.appendChild(candidateList);
    content.querySelector('.fr-target-view').insertBefore(selector, list);
  }

  if (!state.targets.length) {
    const empty = document.createElement('div');
    empty.className = 'fr-target-empty';
    empty.textContent = 'Henüz oyuncu hedefi yok.';
    list.appendChild(empty);
  }

  state.targets.forEach((player, index) => {
    if (!player.priceUpdatedAt) {
      player.priceUpdatedAt = Date.now();
    }
    const isSearchActive = !player.searchDisabled;
    const card = document.createElement('div');
    card.className = 'fr-target-card' + (isSearchActive ? '' : ' is-search-inactive');
    card.setAttribute('role', 'listitem');

    if (player.playerImageUrl || player.promoImageUrl) {
      const previewCard = createEaCardElement(player, { size: 'preview' });
      card.appendChild(previewCard);
    }

    const body = document.createElement('div');
    body.className = 'fr-target-card-body';

    // 1. Üst Satır: Arama Aç/Kapat (solda, ismin üstü) + Son Güncelleme & Silme (sağda)
    const topBar = document.createElement('div');
    topBar.className = 'fr-target-card-top';

    const searchToggle = document.createElement('button');
    searchToggle.type = 'button';
    searchToggle.className = 'fr-target-search-toggle ' + (isSearchActive ? 'is-active' : 'is-inactive');
    searchToggle.innerHTML = `Arama: <span class="fr-search-toggle-status">${isSearchActive ? 'Açık' : 'Kapalı'}</span>`;
    searchToggle.setAttribute('title', 'Aramayı Aç/Kapat');
    searchToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      player.searchDisabled = !player.searchDisabled;
      saveTargets();
      const active = !player.searchDisabled;
      searchToggle.className = 'fr-target-search-toggle ' + (active ? 'is-active' : 'is-inactive');
      searchToggle.innerHTML = `Arama: <span class="fr-search-toggle-status">${active ? 'Açık' : 'Kapalı'}</span>`;
      card.classList.toggle('is-search-inactive', !active);
    });

    const topRight = document.createElement('div');
    topRight.className = 'fr-target-top-right';

    const lastUpdate = document.createElement('span');
    lastUpdate.className = 'fr-target-last-update';
    lastUpdate.textContent = formatRelativeTime(player.priceUpdatedAt);
    if (player.priceUpdatedAt) {
      lastUpdate.setAttribute('title', new Date(player.priceUpdatedAt).toLocaleString('tr-TR'));
    }

    const remove = document.createElement('button');
    remove.className = 'fr-target-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', player.name + ' hedefini sil');
    remove.addEventListener('click', () => {
      const [deletedPlayer] = state.targets.splice(index, 1);
      saveTargets();
      emit('targets:changed');
      updateSummaryBar();

      addMarketLog({
        text: `${deletedPlayer.name} hedeflerden silindi.`,
        undoAction: () => {
          state.targets.splice(Math.min(index, state.targets.length), 0, deletedPlayer);
          saveTargets();
          emit('targets:changed');
          renderTargetContent(content);
        }
      });
    });

    topRight.append(lastUpdate, remove);
    topBar.append(searchToggle, topRight);
    body.appendChild(topBar);

    // 2. Başlık ve Bilgiler
    const head = document.createElement('div');
    head.className = 'fr-target-card-head';
    const info = document.createElement('div');
    info.className = 'fr-target-info';
    const name = document.createElement('div');
    name.className = 'fr-target-name';
    name.textContent = player.name;
    const metaLine = document.createElement('div');
    metaLine.className = 'fr-target-meta-line';
    const rating = document.createElement('span');
    rating.className = 'fr-target-rating';
    rating.textContent = player.rating ? String(player.rating) : '—';
    metaLine.appendChild(rating);

    const effectiveVersion = player.versionLabel || (player.rating >= 75 ? 'Gold' : player.rating >= 65 ? 'Silver' : player.rating > 0 ? 'Bronze' : 'Base');
    const badge = document.createElement('span');
    badge.className = 'fr-target-version-badge';
    badge.textContent = effectiveVersion;
    metaLine.appendChild(badge);

    if (player.leagueName) {
      const leagueBadge = document.createElement('span');
      leagueBadge.className = 'fr-target-league-badge';
      leagueBadge.textContent = player.leagueName;
      metaLine.appendChild(leagueBadge);
    }
    info.append(name, metaLine);
    head.appendChild(info);
    body.appendChild(head);

    // 3. Kontroller (Tur Sayısı ve Satın Al)
    const controls = document.createElement('div');
    controls.className = 'fr-target-controls';
    [
      { key: 'searches', label: 'TUR SAYISI', step: 1, min: 1 },
      { key: 'buyNow', label: 'SATIN AL', step: 100, min: MIN_PRICE }
    ].forEach((control) => {
      const group = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'fr-target-control-title';
      title.textContent = control.label;

      let updateProfit = () => {};
      if (control.key === 'buyNow') {
        const profitEl = document.createElement('div');
        profitEl.className = 'fr-target-profit';
        updateProfit = (val) => {
          const futbinPrice = Number(player.price) || 0;
          const currentBuyNow = Number(val ?? player.buyNow) || 0;
          if (futbinPrice > 0) {
            const netProfit = Math.round(futbinPrice * 0.95) - currentBuyNow;
            const sign = netProfit > 0 ? '+' : '';
            profitEl.textContent = `Kâr: ${sign}${netProfit.toLocaleString('tr-TR')}`;
            profitEl.className = 'fr-target-profit ' + (netProfit >= 0 ? 'is-profit' : 'is-loss');
          } else {
            profitEl.textContent = 'Kâr: —';
            profitEl.className = 'fr-target-profit';
          }
        };
        updateProfit(player.buyNow);
        group.append(profitEl, title);
      } else {
        group.appendChild(title);
      }

      const counter = document.createElement('div');
      counter.className = 'fr-target-counter fr-target-counter-editable';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', control.label + ' azalt');
      const formatVal = (k, v) => k === 'buyNow' ? Number(v).toLocaleString('tr-TR') : String(v);
      const parseVal = (k, s) => {
        if (k === 'buyNow') {
          const clean = String(s || '').replace(/[.\s]/g, '').replace(/,/g, '.');
          return clean === '' ? NaN : Number(clean);
        }
        return s === '' ? NaN : Number(s);
      };
      const value = document.createElement('input');
      value.className = 'fr-target-counter-input';
      value.type = 'text';
      value.inputMode = 'numeric';
      value.setAttribute('aria-label', control.label + ' değeri');
      value.value = formatVal(control.key, player[control.key]);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', control.label + ' artır');

      const change = (direction, multiplier = 1) => {
        const current = Number(player[control.key]);
        if (control.key === 'buyNow') {
          let nextVal = current;
          for (let i = 0; i < multiplier; i++) {
            if (direction > 0) {
              nextVal = nextPriceUp(nextVal);
            } else {
              nextVal = nextPriceDown(nextVal);
              if (nextVal <= MIN_PRICE) break;
            }
          }
          player.buyNow = clampPrice(nextVal);
        } else {
          const step = control.step * multiplier;
          player[control.key] = Math.max(control.min, current + direction * step);
        }
        saveTargets();
        value.value = formatVal(control.key, player[control.key]);
        if (control.key === 'buyNow') {
          updateProfit(player.buyNow);
        }
        updateSummaryBar();
      };

      value.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          change(1, e.shiftKey ? 10 : 1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          change(-1, e.shiftKey ? 10 : 1);
        }
      });

      value.addEventListener('input', () => {
        const entered = parseVal(control.key, value.value);
        if (Number.isSafeInteger(entered) && entered >= control.min) {
          player[control.key] = entered;
          saveTargets();
          if (control.key === 'buyNow') {
            updateProfit(entered);
          }
          updateSummaryBar();
        }
      });

      const commitValue = () => {
        const enteredValue = parseVal(control.key, value.value);
        const completedValue = control.key === 'buyNow'
          ? (Number.isFinite(enteredValue) ? clampPrice(roundToPriceStep(enteredValue, 'nearest')) : NaN)
          : enteredValue;
        if (!Number.isSafeInteger(enteredValue) || enteredValue < control.min || completedValue < control.min) {
          value.value = formatVal(control.key, player[control.key]);
          setTargetStatus({
            type: 'error',
            message: control.label + ' için ' + control.min + ' veya daha büyük bir tam sayı girin.'
          });
          return;
        }
        player[control.key] = completedValue;
        value.value = formatVal(control.key, completedValue);
        saveTargets();
        if (control.key === 'buyNow') {
          updateProfit(completedValue);
        }
        updateSummaryBar();
      };

      value.addEventListener('change', commitValue);
      value.addEventListener('blur', commitValue);

      attachHoldRepeat(minus, (e) => change(-1, e?.shiftKey ? 10 : 1));
      attachHoldRepeat(plus, (e) => change(1, e?.shiftKey ? 10 : 1));
      counter.append(minus, value, plus);
      group.append(counter);
      controls.appendChild(group);
    });
    body.appendChild(controls);

    // 4. Alt Bilgi: FutBIN Fiyatı (sağ en alt, 9px)
    const bottomBar = document.createElement('div');
    bottomBar.className = 'fr-target-card-bottom';
    const futbinPriceEl = document.createElement('span');
    futbinPriceEl.className = 'fr-target-futbin-price';
    const fbVal = Number(player.price) || 0;
    futbinPriceEl.textContent = fbVal > 0 ? `FutBIN: ${fbVal.toLocaleString('tr-TR')}` : 'FutBIN: —';
    bottomBar.appendChild(futbinPriceEl);
    body.appendChild(bottomBar);

    card.appendChild(body);
    list.appendChild(card);
  });

  content.querySelector('[data-filter-mode="save"]').addEventListener('click', () => {
    if (!state.targets.length) {
      setTargetStatus({ type: 'error', message: 'Kaydedilecek oyuncu hedefi bulunmuyor.' });
      renderTargetContent(content);
      return;
    }
    emit('ui:open-save-dialog');
  });
  content.querySelector('[data-filter-mode="load"]').addEventListener('click', () => emit('ui:open-filter-modal', { mode: 'load' }));
}
