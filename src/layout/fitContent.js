// EA hub disindaki icerigi panel yanina sigdirir ve onceki olcekleri geri alir.
// Bagimliliklar: core/state/config ve panel yerlesim bilgisi.

import { F } from '../core/config.js';
import { state } from '../core/state.js';
import { vw } from '../utils/dom.js';
import { panel, panelShown } from '../ui/panel/panel.js';

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

export function fitContent(onHub) {
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
