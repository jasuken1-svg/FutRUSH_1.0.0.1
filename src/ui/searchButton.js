import { CONFIG } from '../core/config.js';
import { state } from '../core/state.js';
import { addPinnedPlayerToTargets } from '../targets/pinnedPlayer.js';
import { panel } from './panel/panel.js';
import { renderPanelTabs } from './panel/panelTabs.js';
import { SB_BOLT_SVG } from './icons.js';

const SB = CONFIG.searchButton;

export function initSearchButton() {
    const st = document.createElement('style');
    st.textContent = `
    button.btn-standard.${SB.className} {
      display: inline-flex !important; align-items: center; justify-content: center; gap: 8px;
      color: #fff !important; font-weight: 700 !important; cursor: pointer;
      border: 2px solid transparent !important;
      background:
        linear-gradient(180deg, #14264A, #0A1226) padding-box,
        linear-gradient(135deg, #00E5FF, #7C4DFF 55%, #FF2D95) border-box !important;
      box-shadow: 0 0 12px rgba(124, 77, 255, .35);
      transition: filter .15s, box-shadow .15s;
    }
    button.btn-standard.${SB.className}:hover {
      filter: brightness(1.18); box-shadow: 0 0 18px rgba(0, 229, 255, .45);
    }
    button.btn-standard.${SB.className}:active { filter: brightness(.95); }
    button.btn-standard.${SB.className} .fr-sb-bolt { width: 15px; height: 30px; flex: 0 0 auto; }
    button.btn-standard.${SB.className} .fr-sb-label { white-space: nowrap; }
  `;
    document.head.appendChild(st);
  }

export function layoutSearchRow(parent, resetEl, searchEl, mine) {
    const imp = (el, o) => Object.keys(o).forEach((k) => el.style.setProperty(k, o[k], 'important'));
    imp(parent, { 'display': 'flex', 'flex-wrap': 'nowrap', 'align-items': 'stretch', 'column-gap': mine.dataset.gap + 'px' });
    // kenarlık kalınlıkları farklı olsa da üçü birebir eşit olsun: (satır - 2 boşluk) / 3
    const w = 'calc((100% - ' + (2 * Number(mine.dataset.gap)) + 'px) / 3)';
    [resetEl, searchEl, mine].forEach((el) => imp(el, {
      'flex': '0 0 ' + w, 'width': w, 'min-width': '0', 'max-width': 'none',
      'margin': '0', 'box-sizing': 'border-box'
    }));
    imp(mine, { 'height': mine.dataset.h + 'px' });
  }

export function onSearchButtonClick() {
    showTargetsAfterQuickAdd();
    addPinnedPlayerToTargets();
  }

export function showTargetsAfterQuickAdd() {
    if (!panel) return null;
    if (!state.panelExpanded || state.activePanelTab !== 'targets') {
      state.panelExpanded = true;
      state.activePanelTab = 'targets';
      renderPanelTabs(panel);
    }
    return panel.querySelector('.fc-snipe-tab-content');
  }

export function placeSearchButton() {
    document.querySelectorAll('button.btn-standard.primary').forEach((searchEl) => {
      const parent = searchEl.parentElement;
      if (!parent || parent.dataset.frSbSkip) return;

      const resetEl = Array.from(parent.children).find((c) =>
        c !== searchEl && c.matches('button.btn-standard') && !c.classList.contains('primary') &&
        !c.classList.contains(SB.className) && SB.resetPattern.test(c.textContent));
      if (!resetEl) return;

      const sq = searchEl.getBoundingClientRect();
      if (sq.width < 50 || sq.height < 10) return;   // görünür değil

      // buton zaten varsa (sayfa yeniden çizdiyse) yalnızca yerleşimi tazele
      const existing = parent.querySelector('.' + SB.className);
      if (existing) {
        if (!resetEl.style.getPropertyValue('flex')) layoutSearchRow(parent, resetEl, searchEl, existing);
        return;
      }

      // ölçüler: Reset ile Search arası boşluk, buton yüksekliği, korunacak kutular
      const rq = resetEl.getBoundingClientRect();
      let gap = Math.round(sq.left - rq.right);
      if (gap < 0 || gap > 80) gap = 20;
      const scope = parent.closest('.ut-content') || document;
      const plist = scope.querySelector('.ut-pinned-list') || document.querySelector('.ut-pinned-list');
      const plistBefore = plist && plist.getBoundingClientRect();
      const parentBefore = parent.getBoundingClientRect();
      const snapshot = [parent, resetEl, searchEl].map((el) => [el, el.style.cssText]);

      const mine = document.createElement('button');
      mine.type = 'button';
      mine.className = 'btn-standard ' + SB.className;
      mine.dataset.gap = String(gap);
      mine.dataset.h = String(Math.round(sq.height));
      mine.innerHTML = SB_BOLT_SVG + '<span class="fr-sb-label">' + SB.label + '</span>';
      mine.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onSearchButtonClick(); });
      parent.insertBefore(mine, searchEl.nextSibling);
      layoutSearchRow(parent, resetEl, searchEl, mine);

      // güvenlik: pinned-list ya da buton satırı boyut değiştirdiyse her şeyi geri al
      const plistAfter = plist && plist.getBoundingClientRect();
      const parentAfter = parent.getBoundingClientRect();
      const moved = (a, b) => a && b && (Math.abs(a.width - b.width) > 1 || Math.abs(a.height - b.height) > 1);
      if (moved(plistBefore, plistAfter) || moved(parentBefore, parentAfter)) {
        mine.remove();
        snapshot.forEach(([el, css]) => { el.style.cssText = css; });
        parent.dataset.frSbSkip = '1';   // aynı satırda tekrar deneme
        console.warn('[futrush] Arama butonu boyutları bozduğu için eklenmedi.', { plistBefore, plistAfter, parentBefore, parentAfter });
        return;
      }
      if (SB.debug) console.log('[futrush searchBtn]', { gap, h: sq.height, parent: parent.className });
    });
  }
