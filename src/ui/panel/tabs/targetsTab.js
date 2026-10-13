import { state } from '../../../core/state.js';
import { emit } from '../../../core/events.js';
import { buyNowStep } from '../../../utils/format.js';
import { saveTargets } from '../../../targets/targetStore.js';

export function renderTargetContent(content) {
    const target = state.targetFilter;
    const ratings = target.ratings.length ? target.ratings.join(', ') : 'Seçilmedi';
    const kindLabel = target.kind === 'custom' ? 'Özel' : 'En ucuz';
    content.innerHTML =
      '<div class="fr-target-view"><div class="fr-target-summary"></div><div class="fr-target-status" aria-live="polite"></div><div class="fr-target-list" role="list"></div>' +
      '<div class="fr-target-actions"><button class="fr-target-action fr-target-save" type="button" data-filter-mode="save">Kaydet</button><button class="fr-target-action fr-target-load" type="button" data-filter-mode="load">Yükle</button></div></div>';
    const summary = content.querySelector('.fr-target-summary');
    summary.textContent = 'Filtre: ' + kindLabel + '  ·  Reyting: ' + ratings + '  ·  En ucuz sayısı: ' + target.count;
    const status = content.querySelector('.fr-target-status');
    if (state.targetLoading) {
      status.textContent = 'FutBIN oyuncuları yükleniyor...';
      status.dataset.type = 'loading';
    } else if (state.targetStatus) {
      status.textContent = state.targetStatus.message;
      status.dataset.type = state.targetStatus.type;
    } else {
      status.hidden = true;
    }

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
        { key: 'searches', label: 'Searches', step: 1, min: 1 },
        { key: 'buyNow', label: 'Buy Now', step: buyNowStep(player.buyNow), min: 1 }
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
          renderTargetContent(content);
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
        state.targetStatus = { type: 'error', message: 'Kaydedilecek oyuncu hedefi bulunmuyor.' };
        renderTargetContent(content);
        return;
      }
      emit('ui:open-save-dialog');
    });
    content.querySelector('[data-filter-mode="load"]').addEventListener('click', () => emit('ui:open-filter-modal', { mode: 'load' }));
  }
