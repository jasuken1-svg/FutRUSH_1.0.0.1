import { on } from '../../core/events.js';
import { state } from '../../core/state.js';
import { importCheapestTargets } from '../../targets/futbinImport.js';
import { restoreSavedTargets } from '../../targets/targetOps.js';
import { panel } from '../panel/panel.js';
import { renderTargetContent } from '../panel/tabs/targetsTab.js';
import { filterModalCss } from './filterModal.css.js';

export function openFilterModal(mode) {
    document.querySelector('.fr-filter-overlay')?.remove();
    state.filterDraft = { kind: state.targetFilter.kind, ratings: state.targetFilter.ratings.slice(0, 1), count: state.targetFilter.count };
    const overlay = document.createElement('div');
    overlay.className = 'fr-filter-overlay';
    const shadow = overlay.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>' + filterModalCss + '</style>' + "<div class=\"fr-filter-backdrop\"><div class=\"fr-filter-modal\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Kayıtlı Filtreler\">" +
        '<div class="fr-filter-title">Kayıtlı Filtreler</div>' +
        '<div class="fr-filter-kind" role="tablist"><button type="button" data-kind="cheap" role="tab" aria-selected="' + (state.filterDraft.kind === 'cheap') + '">En ucuz</button><button type="button" data-kind="custom" role="tab" aria-selected="' + (state.filterDraft.kind === 'custom') + '">Özel</button></div>' +
        '<div class="fr-filter-rating-title">Reyting Seçici</div><div class="fr-filter-rating-grid"></div><div class="fr-filter-custom-list"></div>' +
        '<div class="fr-filter-count-title">En ucuz sayısı</div><div class="fr-filter-count"><button type="button" data-count="-1" aria-label="En ucuz sayısını azalt">-</button><span class="fr-filter-count-value">5</span><button type="button" data-count="1" aria-label="En ucuz sayısını artır">+</button></div>' +
        '<div class="fr-filter-footer"><button type="button" class="fr-filter-submit">' + (mode === 'save' ? 'Kaydet' : 'Yükle') + '</button><button type="button" class="fr-filter-cancel">İptal</button></div>' +
      '</div></div>';
    document.body.appendChild(overlay);
    const modal = shadow.querySelector('.fr-filter-modal');
    const ratingGrid = modal.querySelector('.fr-filter-rating-grid');
    const countValue = modal.querySelector('.fr-filter-count-value');
    const ratingTitle = modal.querySelector('.fr-filter-rating-title');
    const customList = modal.querySelector('.fr-filter-custom-list');
    const renderCustomTargets = () => {
      customList.replaceChildren();
      const summary = document.createElement('div');
      summary.className = 'fr-filter-custom-summary';
      summary.textContent = state.savedTargetLists.length ? 'Kayıtlı listeler · ' + state.savedTargetLists.length : 'Henüz özel liste kaydedilmedi.';
      customList.appendChild(summary);
      if (!state.savedTargetLists.length) {
        const empty = document.createElement('div');
        empty.className = 'fr-filter-custom-empty';
        empty.textContent = 'Oyuncu Hedefleri bölümünden Kaydet’e basın.';
        customList.appendChild(empty);
        return;
      }
      state.savedTargetLists.forEach((savedList) => {
        const row = document.createElement('button');
        row.className = 'fr-filter-custom-row';
        row.type = 'button';
        row.dataset.listId = savedList.id;
        row.setAttribute('aria-pressed', String(savedList.id === state.selectedSavedTargetListId));
        const name = document.createElement('span');
        name.className = 'fr-filter-custom-name';
        name.textContent = savedList.name;
        const details = document.createElement('span');
        details.className = 'fr-filter-custom-data';
        details.textContent = savedList.players.length + ' oyuncu';
        row.append(name, details);
        row.addEventListener('click', () => {
          state.selectedSavedTargetListId = savedList.id;
          renderCustomTargets();
        });
        customList.appendChild(row);
      });
      const selectedList = state.savedTargetLists.find((list) => list.id === state.selectedSavedTargetListId);
      if (selectedList) selectedList.players.forEach((player) => {
        const row = document.createElement('div');
        row.className = 'fr-filter-custom-player';
        const name = document.createElement('span');
        name.className = 'fr-filter-custom-player-name';
        name.textContent = player.name + (player.rating ? ' · ' + player.rating : '');
        const details = document.createElement('span');
        details.className = 'fr-filter-custom-player-data';
        details.textContent = 'Searches ' + player.searches + ' · Buy Now ' + Number(player.buyNow).toLocaleString('tr-TR');
        row.append(name, details);
        customList.appendChild(row);
      });
    };
    const renderRatings = () => {
      ratingGrid.innerHTML = Array.from({ length: 12 }, (_, index) => 81 + index).map((rating) =>
        '<button class="fr-filter-rating" type="button" data-rating="' + rating + '" aria-pressed="' + state.filterDraft.ratings.includes(rating) + '">' + rating + '</button>'
      ).join('');
      ratingGrid.querySelectorAll('[data-rating]').forEach((button) => button.addEventListener('click', () => {
        const rating = Number(button.dataset.rating);
        const ratings = state.filterDraft.ratings;
        state.filterDraft.ratings = ratings.includes(rating) ? [] : [rating];
        ratingTitle.textContent = 'Reyting Seçici';
        ratingGrid.querySelectorAll('[data-rating]').forEach((item) => item.setAttribute('aria-pressed', String(Number(item.dataset.rating) === state.filterDraft.ratings[0])));
      }));
    };
    renderRatings();
    renderCustomTargets();
    countValue.textContent = String(state.filterDraft.count);
    const setKind = (kind) => {
      state.filterDraft.kind = kind;
      modal.classList.toggle('is-custom', kind === 'custom');
      modal.querySelectorAll('[data-kind]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.kind === kind)));
    };
    modal.querySelectorAll('[data-kind]').forEach((button) => button.addEventListener('click', () => {
      setKind(button.dataset.kind);
    }));
    setKind(state.filterDraft.kind);
    modal.querySelectorAll('[data-count]').forEach((button) => button.addEventListener('click', () => {
      state.filterDraft.count = Math.max(1, state.filterDraft.count + Number(button.dataset.count));
      countValue.textContent = String(state.filterDraft.count);
    }));
    modal.querySelector('.fr-filter-cancel').addEventListener('click', () => overlay.remove());
    shadow.querySelector('.fr-filter-backdrop').addEventListener('click', (event) => { if (event.target === event.currentTarget) overlay.remove(); });
    modal.querySelector('.fr-filter-submit').addEventListener('click', () => {
      if (mode === 'load' && state.filterDraft.kind === 'cheap' && !state.filterDraft.ratings.length) {
        ratingTitle.textContent = 'Lütfen reyting seçin';
        return;
      }
      const nextFilter = { kind: state.filterDraft.kind, ratings: state.filterDraft.ratings.slice(), count: state.filterDraft.count };
      state.targetFilter = nextFilter;
      if (mode === 'load' && nextFilter.kind === 'custom' && !state.savedTargetLists.length) {
        customList.querySelector('.fr-filter-custom-summary').textContent = 'Önce Oyuncu Hedefleri bölümünden bir liste kaydedin.';
        return;
      }
      overlay.remove();
      const targetContent = panel.querySelector('.fc-snipe-tab-content');
      if (targetContent && state.activePanelTab === 'targets') renderTargetContent(targetContent);
      if (mode === 'load' && nextFilter.kind === 'cheap') importCheapestTargets(nextFilter.ratings[0], nextFilter.count);
      if (mode === 'load' && nextFilter.kind === 'custom') {
        const restored = restoreSavedTargets();
        const loadedList = state.savedTargetLists.find((list) => list.id === state.selectedSavedTargetListId);
        state.targetStatus = { type: 'success', message: '“' + (loadedList ? loadedList.name : 'Özel liste') + '” listesinden ' + restored + ' oyuncu adet ve fiyat bilgileriyle aktarıldı.' };
        if (targetContent && state.activePanelTab === 'targets') renderTargetContent(targetContent);
      }
    });
  }

export function registerModalEvents() {
  on('ui:open-filter-modal', ({ mode }) => openFilterModal(mode));
}
