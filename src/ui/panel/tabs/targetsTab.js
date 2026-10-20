// Hedef oyuncu kartlarini, fiyat kontrollerini ve liste eylemlerini cizer.
// Bagimliliklar: core/state/events, utils/format ve targets/targetStore.

import { state } from '../../../core/state.js';
import { emit } from '../../../core/events.js';
import { buyNowStep, floorPrice } from '../../../utils/format.js';
import { saveTargets } from '../../../targets/targetStore.js';
import { setTargetStatus } from '../../../targets/targetStatus.js';
import { normalizeTargetStatus } from '../panelLogic.js';
import { formatFutbinRowPrice, getPlatform } from '../../../futbin/platform.js';
import { commitCandidateTarget } from '../../../targets/pinnedPlayer.js';
import { searchPlayerAllVersions } from '../../../futbin/playerLookup.js';
import { loadFutbinImage, applyFutbinBgImage } from '../../../futbin/imageLoader.js';

let statusRemovalTimer = null;

function renderStatus(status, targetLoading) {
  const normalized = normalizeTargetStatus(status) || (targetLoading ? {
    type: 'loading',
    message: 'FutBIN oyuncuları yükleniyor...',
    source: 'futbin'
  } : null);
  return normalized;
}

function cancelStatusRemoval(statusElement) {
  if (statusRemovalTimer !== null) {
    clearTimeout(statusRemovalTimer);
    statusRemovalTimer = null;
  }
  statusElement.classList.remove('fr-target-status-exiting');
}

export function updateTargetStatus(statusElement, status, targetLoading) {
  const normalized = renderStatus(status, targetLoading);
  if (!normalized) {
    if (statusElement.classList.contains('fr-target-status-exiting')) return;
    statusElement.hidden = true;
    return;
  }
  cancelStatusRemoval(statusElement);
  const previousMessage = statusElement.dataset.message;
  const previousType = statusElement.dataset.type;
  statusElement.hidden = false;
  statusElement.dataset.type = normalized.type;

  let main = statusElement.querySelector('.fr-target-status-main');
  if (!main) {
    main = document.createElement('div');
    main.className = 'fr-target-status-main';
    const icon = document.createElement('span');
    icon.className = 'fr-target-status-icon';
    icon.setAttribute('aria-hidden', 'true');
    const message = document.createElement('span');
    message.className = 'fr-target-status-message';
    const meta = document.createElement('span');
    meta.className = 'fr-target-status-meta';
    const source = document.createElement('span');
    source.className = 'fr-target-source';
    const progress = document.createElement('span');
    progress.className = 'fr-target-progress-label';
    meta.append(source, progress);
    main.append(icon, message, meta);
    statusElement.appendChild(main);
  }

  const icon = main.querySelector('.fr-target-status-icon');
  icon.dataset.type = normalized.type;
  icon.textContent = normalized.type === 'loading' ? '' : normalized.type === 'success' ? '✓' : normalized.type === 'error' ? '!' : '·';
  const message = main.querySelector('.fr-target-status-message');
  if (previousMessage !== normalized.message || !message.textContent) {
    message.textContent = normalized.message;
    message.classList.remove('fr-status-message-enter');
    void message.offsetWidth;
    message.classList.add('fr-status-message-enter');
  }
  statusElement.dataset.message = normalized.message;

  const source = main.querySelector('.fr-target-source');
  const sourceLabels = { ea: 'EA', futbin: 'FutBIN', mixed: 'EA+FutBIN' };
  const sourceLabel = sourceLabels[normalized.source] || '';
  source.textContent = sourceLabel;
  source.hidden = !sourceLabel;
  source.dataset.source = normalized.source || '';

  const progressLabel = main.querySelector('.fr-target-progress-label');
  let progress = statusElement.querySelector('.fr-target-progress');
  if (normalized.progress) {
    if (!progress) {
      progress = document.createElement('div');
      progress.className = 'fr-target-progress';
      const fill = document.createElement('div');
      fill.className = 'fr-target-progress-fill';
      progress.appendChild(fill);
      statusElement.appendChild(progress);
    }
    const done = Math.max(0, Number(normalized.progress.done) || 0);
    const total = Math.max(0, Number(normalized.progress.total) || 0);
    const width = total ? Math.min(100, done / total * 100) : 0;
    progress.querySelector('.fr-target-progress-fill').style.width = width + '%';
    progressLabel.textContent = done + '/' + total;
    progressLabel.hidden = false;
  } else {
    progress?.remove();
    progressLabel.textContent = '';
    progressLabel.hidden = true;
  }

  if (normalized.type === 'success' && (previousType !== 'success' || previousMessage !== normalized.message)) {
    statusElement.classList.remove('fr-status-success-flash');
    void statusElement.offsetWidth;
    statusElement.classList.add('fr-status-success-flash');
  } else {
    statusElement.classList.remove('fr-status-success-flash');
  }
}

export function expireTargetStatus(content) {
  const statusElement = content.querySelector('.fr-target-status');
  if (!statusElement || statusElement.hidden) return;
  statusElement.classList.add('fr-target-status-exiting');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    statusElement.remove();
    return;
  }
  statusRemovalTimer = setTimeout(() => {
    statusElement.remove();
    statusRemovalTimer = null;
  }, 220);
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

    // FutBIN Oyuncu Arama Arayuzu
    const searchBox = document.createElement('div');
    searchBox.className = 'fr-target-search-box';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'fr-target-search-input';
    searchInput.placeholder = 'Oyuncu Ara (FutBIN)...';
    searchInput.setAttribute('aria-label', 'Oyuncu Ara (FutBIN)');
    const searchResults = document.createElement('div');
    searchResults.className = 'fr-target-search-results';
    searchResults.hidden = true;
    searchBox.append(searchInput, searchResults);

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
          const versions = await searchPlayerAllVersions(query);
          if (searchInput.value.trim() !== query) return;
          searchResults.replaceChildren();
          if (!versions.length) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'fr-search-item-empty';
            emptyItem.textContent = 'Sonuç bulunamadı.';
            searchResults.appendChild(emptyItem);
          } else {
            versions.forEach((candidate) => {
              const item = document.createElement('div');
              item.className = 'fr-search-result-item';
              item.setAttribute('role', 'button');
              item.setAttribute('tabindex', '0');

              const cardEl = document.createElement('div');
              cardEl.className = 'fr-search-item-card';
              if (candidate.promoImageUrl) {
                const bg = document.createElement('div');
                bg.className = 'fr-search-item-card-bg';
                applyFutbinBgImage(bg, candidate.promoImageUrl);
                cardEl.appendChild(bg);
              }
              if (candidate.playerImageUrl) {
                const img = document.createElement('img');
                img.className = 'fr-search-item-player-img';
                img.alt = candidate.name;
                loadFutbinImage(img, candidate.playerImageUrl);
                cardEl.appendChild(img);
              }
              if (candidate.rating) {
                const r = document.createElement('div');
                r.className = 'fr-search-item-rating';
                r.textContent = String(candidate.rating);
                cardEl.appendChild(r);
              }
              if (candidate.position) {
                const p = document.createElement('div');
                p.className = 'fr-search-item-pos';
                p.textContent = candidate.position;
                cardEl.appendChild(p);
              }

              const info = document.createElement('div');
              info.className = 'fr-search-item-info';
              const nameEl = document.createElement('div');
              nameEl.className = 'fr-search-item-name';
              nameEl.textContent = candidate.name;
              const badges = document.createElement('div');
              badges.className = 'fr-search-item-badges';
              const ver = document.createElement('span');
              ver.className = 'fr-search-item-version';
              ver.textContent = candidate.versionLabel || 'Kart';
              badges.appendChild(ver);

              if (candidate.price) {
                const priceEl = document.createElement('span');
                priceEl.className = 'fr-search-item-price';
                priceEl.textContent = candidate.price.toLocaleString('tr-TR') + ' coin';
                badges.appendChild(priceEl);
              }
              info.append(nameEl, badges);

              item.append(cardEl, info);
              item.addEventListener('click', () => {
                commitCandidateTarget(candidate, candidate.price);
                searchInput.value = '';
                searchResults.hidden = true;
                searchResults.replaceChildren();
              });
              searchResults.appendChild(item);
            });
          }
          searchResults.hidden = false;
        } catch (e) {
          console.warn('[FutRUSH] Oyuncu arama hatası:', e);
        }
      }, 300);
    });

    targetView.insertBefore(searchBox, list);

    if (state.pendingCandidates && Array.isArray(state.pendingCandidates.candidates) && state.pendingCandidates.candidates.length) {
      const selector = document.createElement('div');
      selector.className = 'fr-candidate-selector';
      selector.setAttribute('role', 'region');
      selector.setAttribute('aria-label', 'Aday kart seçimi');

      const header = document.createElement('div');
      header.className = 'fr-candidate-header';
      const headerTitle = document.createElement('span');
      headerTitle.textContent = state.pendingCandidates.name + ' — Kart Sürümü:';
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
        badge.className = 'fr-candidate-badge';
        badge.textContent = candidate.versionLabel || 'Özel';

        const meta = document.createElement('div');
        meta.className = 'fr-candidate-meta';
        meta.textContent = 'FutBIN ' + candidate.futbinId + ' · resource ' + candidate.eaId;

        const priceEl = document.createElement('div');
        priceEl.className = 'fr-candidate-price';
        priceEl.textContent = formatFutbinRowPrice(candidate.raw, getPlatform());

        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.className = 'fr-candidate-btn';
        selectBtn.textContent = 'Bu kartı ekle';
        selectBtn.addEventListener('click', () => {
          commitCandidateTarget(candidate, state.pendingCandidates.price);
        });

        card.append(title, badge, meta, priceEl, selectBtn);
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
      const card = document.createElement('div');
      card.className = 'fr-target-card';
      card.setAttribute('role', 'listitem');
      const head = document.createElement('div');
      head.className = 'fr-target-card-head';
      if (player.playerImageUrl) {
        const thumb = document.createElement('img');
        thumb.className = 'fr-target-thumb';
        thumb.alt = player.name;
        loadFutbinImage(thumb, player.playerImageUrl);
        head.appendChild(thumb);
      }
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
      if (player.versionLabel) {
        const badge = document.createElement('span');
        badge.className = 'fr-target-version-badge';
        badge.textContent = player.versionLabel;
        metaLine.appendChild(badge);
      }
      info.append(name, metaLine);
      const remove = document.createElement('button');
      remove.className = 'fr-target-remove';
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', player.name + ' hedefini sil');
      remove.addEventListener('click', () => {
        state.targets.splice(index, 1);
        saveTargets();
        renderTargetContent(content);
      });
      head.append(info, remove);
      card.appendChild(head);

      const controls = document.createElement('div');
      controls.className = 'fr-target-controls';
      [
        { key: 'searches', label: 'TUR SAYISI', step: 1, min: 1 },
        { key: 'buyNow', label: 'SATIN AL', step: buyNowStep(player.buyNow), min: 150 }
      ].forEach((control) => {
        const group = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'fr-target-control-title';
        title.textContent = control.label;
        const counter = document.createElement('div');
        counter.className = 'fr-target-counter fr-target-counter-editable';
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', control.label + ' azalt');
        const value = document.createElement('input');
        value.className = 'fr-target-counter-input';
        value.type = 'number';
        value.min = String(control.min);
        value.step = '1';
        value.inputMode = 'numeric';
        value.setAttribute('aria-label', control.label + ' değeri');
        value.value = String(player[control.key]);
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', control.label + ' artır');
        const change = (direction) => {
          const current = Number(player[control.key]);
          const step = control.key === 'buyNow'
            ? buyNowStep(Math.max(0, current + direction))
            : control.step;
          player[control.key] = Math.max(control.min, current + direction * step);
          saveTargets();
          value.value = String(player[control.key]);
        };
        value.addEventListener('change', () => {
          const enteredValue = value.value === '' ? NaN : Number(value.value);
          const completedValue = control.key === 'buyNow' ? floorPrice(enteredValue) : enteredValue;
          if (!Number.isSafeInteger(enteredValue) || enteredValue < control.min || completedValue < control.min) {
            value.value = String(player[control.key]);
            setTargetStatus({
              type: 'error',
              message: control.label + ' için ' + control.min + ' veya daha büyük bir tam sayı girin.'
            });
            return;
          }
          player[control.key] = completedValue;
          value.value = String(completedValue);
          saveTargets();
        });
        minus.addEventListener('click', () => change(-1));
        plus.addEventListener('click', () => change(1));
        counter.append(minus, value, plus);
        group.append(title, counter);
        controls.appendChild(group);
      });
      card.appendChild(controls);

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
