import { P } from '../core/config.js';
import { state } from '../core/state.js';
import { pageStorage, vw, vh } from '../utils/dom.js';

let ro = null;
let observedContainer = null;

export function syncFromHub(marketTile, onResize) {
  const tilesContainer = marketTile.parentElement;
  if (!tilesContainer) return false;

  if (observedContainer !== tilesContainer) {
    if (ro) ro.disconnect();
    ro = new ResizeObserver(onResize);
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

export function createHubSyncModule(onResize) {
  return {
    name: 'hubSync',
    sync({ onHub, marketTile }) {
      if (onHub) {
        state.visible = true;
        syncFromHub(marketTile, onResize);
      } else {
        state.liveScroll = 0;
      }
    }
  };
}
