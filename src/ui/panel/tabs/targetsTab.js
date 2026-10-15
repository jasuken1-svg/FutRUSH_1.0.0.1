// Hedef oyuncu kartlarini, fiyat kontrollerini ve liste eylemlerini cizer.
// Bagimliliklar: core/state/events, utils/format ve targets/targetStore.

import { state } from '../../../core/state.js';
import { emit } from '../../../core/events.js';
import { buyNowStep } from '../../../utils/format.js';
import { saveTargets } from '../../../targets/targetStore.js';
import { setTargetStatus } from '../../../targets/targetStatus.js';
import { normalizeTargetStatus } from '../panelLogic.js';

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
    const list = content.querySelector('.fr-target-list');
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
      const name = document.createElement('div');
      name.className = 'fr-target-name';
      name.textContent = player.name;
      const rating = document.createElement('span');
      rating.className = 'fr-target-rating';
      rating.textContent = player.rating ? String(player.rating) : '—';
      name.appendChild(rating);
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
      head.append(name, remove);
      card.appendChild(head);

      const controls = document.createElement('div');
      controls.className = 'fr-target-controls';
      [
        { key: 'searches', label: 'TUR SAYISI', step: 1, min: 1 },
        { key: 'buyNow', label: 'SATIN AL', step: buyNowStep(player.buyNow), min: 1 }
      ].forEach((control) => {
        const group = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'fr-target-control-title';
        title.textContent = control.label;
        const counter = document.createElement('div');
        counter.className = 'fr-target-counter';
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', control.label + ' azalt');
        const value = document.createElement('span');
        value.className = 'fr-target-counter-value';
        value.textContent = control.key === 'buyNow' ? Number(player.buyNow).toLocaleString('tr-TR') : String(player.searches);
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', control.label + ' artır');
        const change = (direction) => {
          const step = control.key === 'buyNow' ? buyNowStep(player.buyNow) : control.step;
          player[control.key] = Math.max(control.min, Number(player[control.key]) + direction * step);
          saveTargets();
          value.textContent = control.key === 'buyNow'
            ? Number(player.buyNow).toLocaleString('tr-TR')
            : String(player.searches);
        };
        minus.addEventListener('click', () => change(-1));
        plus.addEventListener('click', () => change(1));
        counter.append(minus, value, plus);
        group.append(title, counter);
        controls.appendChild(group);
      });
      card.appendChild(controls);

      const icons = document.createElement('div');
      icons.className = 'fr-target-icons';
      ['FUT', '▧', '⌖', '⚽', '◎', '≋', '♣', '✦'].forEach((label, iconIndex) => {
        const icon = document.createElement('span');
        icon.className = 'fr-target-icon';
        icon.textContent = label;
        icon.title = ['FUT', 'Kart tipi', 'Pozisyon', 'Ayakkabı', 'Ülke', 'Lig', 'Kulüp', 'Nadirlik'][iconIndex];
        icons.appendChild(icon);
      });
      card.appendChild(icons);
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
