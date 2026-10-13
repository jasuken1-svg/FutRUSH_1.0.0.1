import { CONFIG, P, F } from './core/config.js';
import { state } from './core/state.js';
import { on as onEvent } from './core/events.js';
import { registerModalEvents as registerSaveDialogEvents } from './ui/modals/saveDialog.js';
import { registerModalEvents as registerFilterModalEvents } from './ui/modals/filterModal.js';
import { initSettings, placeNav } from './ui/navButton.js';
import { initLogoButton, placeLogoButton } from './ui/logoButton.js';
import { initSearchButton, placeSearchButton } from './ui/searchButton.js';
import { pageWindow, pageStorage, vw, vh } from './utils/dom.js';
import { panel, initPanel, panelShown, applyGeom } from './ui/panel/panel.js';
import { registerPanelEvents } from './ui/panel/panelEvents.js';

/*
 * ============================================================================
 *  FutRUSH — DOSYA HARİTASI (yeni özellik eklerken buraya bak)
 * ----------------------------------------------------------------------------
 *  1. CONFIG        Tüm ayarlar, renkler, sabitler (ince ayar için sadece burası)
 *  2. STATE         Bölümler arası ortak durum (geom, visible, liveScroll)
 *  3. UTILS         Küçük yardımcılar
 *  4. PANEL         SNIPE paneli: oluşturma, konumlandırma          -> initPanel()
 *  5. FIT CONTENT   Alt sayfalarda içeriği panelin soluna sığdırma
 *  6. HUB SYNC      Hub kartlarını ölçüp panel ölçüsünü hesaplama
 *  7. UI COMPONENTS  Butonlar ve modallar (src/ui/)
 *  8. SYNC           Layout ana döngüsü + zamanlayıcı
 *  9. EVENTS         Tıklama / gözlemci / resize / scroll dinleyicileri
 * 10. START          Başlangıç noktası (init çağrıları burada)
 *
 *  Yeni özellik eklemek için: yeni bir bölüm yaz, içine initXxx() koy,
 *  en alttaki START bölümüne bir satır ekle. Bir özellik bozulursa CONFIG.features
 *  içinden kapatabilirsin.
 *
 *  DEĞİŞİKLİK NOTLARI
 *  1.5.0  Consumables yanına 40x40 FutRUSH logosu eklendi. SNIPE paneli artık SADECE bu logoyla
 *         açılır ve yalnızca Transfers içinde görünür. Hub'da panel/kart kaydırması kaldırıldı.
 *  1.4.0  Reset / Search yanına FutRUSH butonu eklendi (3 eşit buton, logo renkleri).
 *  1.3.0  Script bölümlere ayrıldı (davranış aynı). Ayarlar CONFIG'e taşındı.
 *  1.2.0  Alt sayfalarda içerik yükseklik GENİŞLETME ile panele hizalanır,
 *         panel rengi #151D29 %70 opaklık.
 * ============================================================================
 */

(function () {
  'use strict';

  // ==========================================================================
  // 5. FIT CONTENT  (alt sayfalarda içeriği panelin soluna sığdır, üst üste binmesin)
  // ==========================================================================
  const fitted = [];

  function resetFitted() {
    fitted.forEach((el) => {
      el.style.transform = '';
      el.style.transformOrigin = '';
      el.style.removeProperty('height');
      el.style.removeProperty('min-height');
      el.style.removeProperty('max-height');
      el.style.removeProperty('box-sizing');
    });
    fitted.length = 0;
  }

  function fitContent(onHub) {
    resetFitted();
    if (onHub || !state.geom || !panelShown()) return;

    const area = document.querySelector('.ut-navigation-container-view--content');
    const areaLeft = area ? area.getBoundingClientRect().left : 0;
    const panelLeft = state.geom.l * vw();

    // doğal konumlarını ölç (transform'lar az önce sıfırlandı)
    const all = Array.from(document.querySelectorAll('.ut-content')).filter((el) => {
      const q = el.getBoundingClientRect();
      return q.width > 600 && q.height > 100;
    });
    const tops = all.filter((el) => !all.some((o) => o !== el && o.contains(el)));

    const pq = panel.getBoundingClientRect();   // panelin son konumu (applyGeom sonrası)

    tops.forEach((el) => {
      const q = el.getBoundingClientRect();
      const freeLeft = areaLeft + F.leftMargin;
      const freeW = panelLeft - F.gap - freeLeft;
      if (freeW <= 0) return;
      const fits = q.right <= panelLeft - F.gap;   // yatayda zaten sığıyor mu

      // yatay: panelin soluna sığdır
      const sx = fits ? 1 : Math.max(F.minScale, Math.min(1, freeW / q.width));
      const dx = fits ? 0 : Math.round(freeLeft + (freeW - q.width * sx) / 2 - q.left);

      // dikey: ölçekleme (stretch) yok -> yazılar bozulmasın. Orantılı (sx, sx) ölçekle,
      // sonra elemanın gerçek yüksekliğini genişlet ki görsel olarak panelin üst/alt kenarına otursun.
      const sy = sx;
      let dy = 0, newH = null;
      if (F.expandY && pq.height > 100 && q.height > 50) {
        const targetH = pq.height / sy;                          // ölçek sonrası panel yüksekliğini verecek layout yüksekliği
        if (targetH > q.height) {
          newH = Math.min(targetH, q.height * F.maxExpandY);
        }
        dy = Math.round(pq.top - q.top);
      }

      if (dx === 0 && dy === 0 && newH === null && Math.abs(sx - 1) < 0.005) return;

      const applyT = () => {
        el.style.transformOrigin = '0 0';
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx.toFixed(4)})`;
      };
      const applyH = () => {
        el.style.setProperty('box-sizing', 'border-box', 'important');
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('height', Math.round(newH) + 'px', 'important');
        el.style.setProperty('min-height', Math.round(newH) + 'px', 'important');
      };
      // üst kenarı ölç ve panelin üstüne otur (yükseklik değişince ebeveyn içeriği kaydırabilir)
      const fixTop = () => {
        const r = el.getBoundingClientRect();
        const d = Math.round(pq.top - r.top);
        if (d !== 0) { dy += d; applyT(); }
        return d;
      };

      applyT();
      if (newH !== null) {
        applyH();
        for (let i = 0; i < 3; i++) {
          fixTop();                                   // önce üst kenarı sabitle
          const r = el.getBoundingClientRect();
          if (r.height <= 0 || Math.abs(pq.height - r.height) <= 2) break;
          newH = Math.max(q.height, Math.min(q.height * F.maxExpandY, newH * (pq.height / r.height)));
          applyH();                                   // yükseklik değişti -> döngü başında üst kenar tekrar düzeltilir
        }
        fixTop();                                     // son durumda üst kenar kesin panelle hizalı olsun
      }
      if (F.debug) {
        const r = el.getBoundingClientRect();
        console.log('[futrush fit]', el.className, { natural: { top: q.top, h: q.height }, panel: { top: pq.top, bottom: pq.bottom }, final: { top: r.top, bottom: r.bottom }, sx, dx, dy, newH });
      }
      fitted.push(el);
    });
  }

  // ==========================================================================
  // 6. HUB SYNC  (hub görünüyorsa kartlardan ölç)
  // ==========================================================================
  let ro = null;
  let observedContainer = null;

  function syncFromHub(marketTile) {
    const tilesContainer = marketTile.parentElement;
    if (!tilesContainer) return false;

    if (observedContainer !== tilesContainer) {
      if (ro) ro.disconnect();
      ro = new ResizeObserver(schedule);
      ro.observe(tilesContainer);
      observedContainer = tilesContainer;
    }

    tilesContainer.style.transform = '';   // eski sürümlerden kalan kaymayı geri al, doğal konumu ölç
    const tiles = tilesContainer.querySelectorAll('[class*="ut-tile-transfer"]');
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    tiles.forEach((el) => {
      const q = el.getBoundingClientRect();
      if (q.width === 0 || q.height === 0) return;
      l = Math.min(l, q.left); t = Math.min(t, q.top);
      r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    });
    if (!isFinite(l)) return false;

    const blockW = r - l;
    const gap = blockW * P.gapRatio;
    let panelW = blockW * P.widthRatio;

    // Panel hub'da gösterilmediği için kartlar KAYDIRILMAZ. Yine de panelin alt sayfalarda
    // kullanacağı ölçü, "kartlar + panel tek grup" yerleşimine göre hesaplanıp kaydedilir.
    let shift = (panelW + gap) / 2;
    shift = Math.max(0, Math.min(shift, l - P.sideMargin));

    const newRight = r - shift;
    const room = vw() - P.sideMargin - (newRight + gap);
    panelW = Math.max(0, Math.min(panelW, room));

    // kaydırma payını bul (hub kaydırılmışsa kayıtlı ölçü bozulmasın)
    let off = 0;
    for (let n = tilesContainer; n; n = n.parentElement) off += n.scrollTop || 0;
    state.liveScroll = off;

    state.geom = {
      l: (newRight + gap) / vw(),
      t: (t + off) / vh(),
      w: panelW / vw(),
      h: (b - t) / vh()
    };
    try { pageStorage().setItem(P.storeKey, JSON.stringify(state.geom)); } catch (e) {}
    return true;
  }

  // ==========================================================================
  // 10. SYNC  (ana döngü: ölç -> panel -> sığdır -> menü butonu)
  // ==========================================================================
  function sync() {
    const marketTile = document.querySelector('.ut-tile-transfer-market');
    const onHub = !!(marketTile && marketTile.getBoundingClientRect().width > 0);
    if (onHub) {
      state.visible = true;
      syncFromHub(marketTile);
    } else {
      state.liveScroll = 0;
    }
    if (CONFIG.features.logoButton) placeLogoButton();   // panelin açılıp açılmayacağını belirler (applyGeom'dan önce)
    applyGeom();      // hub yoksa son kaydedilen ölçü aynen uygulanır
    if (CONFIG.features.searchButton) placeSearchButton();   // fitContent'ten önce: içerik doğal ölçüsüyle ölçülsün
    if (CONFIG.features.fitContent) fitContent(onHub);
    if (CONFIG.features.settingsButton) placeNav();
  }

  let queued = false;
  let tail = null;
  function schedule() {
    clearTimeout(tail);
    tail = setTimeout(sync, CONFIG.timing.tailDelay);   // geçiş animasyonları bittikten sonra bir kez daha
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }

  // ==========================================================================
  // 11. EVENTS
  // ==========================================================================
  function initEvents() {
    // Ana menüde Transfers dışına tıklanırsa paneli gizle
    document.addEventListener('click', (e) => {
      const item = e.target.closest && e.target.closest('[class*="tab-bar-item"]');
      if (!item) return;
      state.visible = /transfer/i.test(item.className + ' ' + item.textContent);
      schedule();
    }, true);

    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    pageWindow.addEventListener('resize', schedule);
    pageWindow.addEventListener('scroll', schedule, true);
  }
  // ==========================================================================
  // 12. START  (yeni özellik eklerken init satırını buraya ekle)
  // ==========================================================================
  registerPanelEvents();
  registerSaveDialogEvents();
  registerFilterModalEvents();
  onEvent('layout:request-sync', sync);
  initPanel();
  if (CONFIG.features.settingsButton) initSettings();
  if (CONFIG.features.logoButton) initLogoButton();
  if (CONFIG.features.searchButton) initSearchButton();
  initEvents();
  sync();
})();
