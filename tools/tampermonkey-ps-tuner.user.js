// ==UserScript==
// @name         FutRUSH - PS+ Visual Tuner
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Oyuncu kartlarindaki PS+ gorselinin konumunu, boyutunu ve stilini canli ayarlama araci
// @match        https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*
// @match        https://www.ea.com/*/ea-sports-fc/ultimate-team/web-app/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULTS = {
    top: 38,
    left: 13,
    gap: 2,
    size: 11,
    imgSize: 80,
    plusTop: -25,
    plusRight: -25,
    plusSize: 55,
    plusFontSize: 4.95,
    plusBg: '#00e5ff',
    plusColor: '#001018'
  };

  const state = { ...DEFAULTS };

  const styleEl = document.createElement('style');
  styleEl.id = 'fr-ps-tuner-live-style';
  document.head.appendChild(styleEl);

  function generateCSS() {
    return `/* FutRUSH - PS+ Canlı Ayar Çıktısı */
.fr-ea-card .fr-ea-card-playstyles {
  position: absolute !important;
  top: ${state.top}% !important;
  left: ${state.left}% !important;
  display: flex !important;
  flex-direction: column !important;
  gap: ${state.gap}cqw !important;
  z-index: 4 !important;
  pointer-events: none !important;
}
.fr-ea-card .fr-ea-ps {
  position: relative !important;
  box-sizing: border-box !important;
  width: ${state.size}cqw !important;
  height: ${state.size}cqw !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: radial-gradient(circle at 30% 30%, #fff2b0, #d9a900 70%) !important;
  border: 1px solid #fff6c2 !important;
  box-shadow: 0 1px 2px rgba(0,0,0,.7) !important;
  pointer-events: auto !important;
}
.fr-ea-card .fr-ea-ps img {
  width: ${state.imgSize}% !important;
  height: ${state.imgSize}% !important;
  object-fit: contain !important;
}
.fr-ea-card .fr-ea-ps::after {
  content: '+' !important;
  position: absolute !important;
  top: ${state.plusTop}% !important;
  right: ${state.plusRight}% !important;
  width: ${state.plusSize}% !important;
  height: ${state.plusSize}% !important;
  border-radius: 50% !important;
  background: ${state.plusBg} !important;
  color: ${state.plusColor} !important;
  font-size: ${state.plusFontSize}cqw !important;
  font-weight: 900 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  line-height: 1 !important;
}`;
  }

  function updateStyle() {
    styleEl.textContent = generateCSS();
  }

  function createUI() {
    if (document.getElementById('fr-ps-tuner-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'fr-ps-tuner-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 330px;
      background: rgba(10, 16, 26, 0.96);
      border: 1px solid #00e5ff;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.85);
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      color: #e2e8f0;
      user-select: none;
    `;

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(0,229,255,0.3);">
        <strong style="color:#00e5ff;font-size:13px;">⚙️ PS+ Visual Tuner</strong>
        <div>
          <button id="fr-ps-collapse" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:4px;cursor:pointer;padding:2px 6px;">_</button>
        </div>
      </div>
      <div id="fr-ps-body" style="display:flex;flex-direction:column;gap:6px;max-height:480px;overflow-y:auto;">
        <div><strong>Konum & Boyut</strong></div>
        <label style="display:flex;justify-content:space-between;">Top (%): <span id="val-top">${state.top}%</span></label>
        <input type="range" id="sl-top" min="0" max="100" step="0.5" value="${state.top}">

        <label style="display:flex;justify-content:space-between;">Left (%): <span id="val-left">${state.left}%</span></label>
        <input type="range" id="sl-left" min="0" max="100" step="0.5" value="${state.left}">

        <label style="display:flex;justify-content:space-between;">Rozet Boyutu (cqw): <span id="val-size">${state.size}cqw</span></label>
        <input type="range" id="sl-size" min="5" max="25" step="0.2" value="${state.size}">

        <label style="display:flex;justify-content:space-between;">Aralık / Gap (cqw): <span id="val-gap">${state.gap}cqw</span></label>
        <input type="range" id="sl-gap" min="0" max="10" step="0.2" value="${state.gap}">

        <label style="display:flex;justify-content:space-between;">İkon İçi Resim Boyutu (%): <span id="val-imgSize">${state.imgSize}%</span></label>
        <input type="range" id="sl-imgSize" min="40" max="100" step="1" value="${state.imgSize}">

        <div style="margin-top:6px;border-top:1px dashed rgba(255,255,255,0.15);padding-top:6px;"><strong>Artı '+' İşareti</strong></div>

        <label style="display:flex;justify-content:space-between;">Plus Top (%): <span id="val-plusTop">${state.plusTop}%</span></label>
        <input type="range" id="sl-plusTop" min="-50" max="50" step="1" value="${state.plusTop}">

        <label style="display:flex;justify-content:space-between;">Plus Right (%): <span id="val-plusRight">${state.plusRight}%</span></label>
        <input type="range" id="sl-plusRight" min="-50" max="50" step="1" value="${state.plusRight}">

        <label style="display:flex;justify-content:space-between;">Plus Boyutu (%): <span id="val-plusSize">${state.plusSize}%</span></label>
        <input type="range" id="sl-plusSize" min="20" max="90" step="1" value="${state.plusSize}">

        <label style="display:flex;justify-content:space-between;">Plus Font (cqw): <span id="val-plusFontSize">${state.plusFontSize}cqw</span></label>
        <input type="range" id="sl-plusFontSize" min="2" max="10" step="0.05" value="${state.plusFontSize}">

        <div style="display:flex;gap:6px;margin-top:10px;">
          <button id="fr-ps-copy" style="flex:1;background:#00e5ff;color:#040c16;font-weight:700;border:none;border-radius:4px;padding:6px;cursor:pointer;">📋 CSS Kopyala</button>
          <button id="fr-ps-reset" style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:6px;cursor:pointer;">↺ Sıfırla</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const bindSlider = (id, key, unit) => {
      const input = panel.querySelector('#sl-' + id);
      const val = panel.querySelector('#val-' + id);
      input.addEventListener('input', () => {
        state[key] = Number(input.value);
        val.textContent = input.value + unit;
        updateStyle();
      });
    };

    bindSlider('top', 'top', '%');
    bindSlider('left', 'left', '%');
    bindSlider('size', 'size', 'cqw');
    bindSlider('gap', 'gap', 'cqw');
    bindSlider('imgSize', 'imgSize', '%');
    bindSlider('plusTop', 'plusTop', '%');
    bindSlider('plusRight', 'plusRight', '%');
    bindSlider('plusSize', 'plusSize', '%');
    bindSlider('plusFontSize', 'plusFontSize', 'cqw');

    panel.querySelector('#fr-ps-copy').addEventListener('click', () => {
      const css = generateCSS();
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(css, 'text');
      } else {
        navigator.clipboard?.writeText(css);
      }
      const btn = panel.querySelector('#fr-ps-copy');
      const orig = btn.textContent;
      btn.textContent = '✅ Kopyalandı!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });

    panel.querySelector('#fr-ps-reset').addEventListener('click', () => {
      Object.assign(state, DEFAULTS);
      createUI();
      updateStyle();
    });

    let collapsed = false;
    panel.querySelector('#fr-ps-collapse').addEventListener('click', () => {
      collapsed = !collapsed;
      panel.querySelector('#fr-ps-body').style.display = collapsed ? 'none' : 'flex';
      panel.querySelector('#fr-ps-collapse').textContent = collapsed ? '+' : '_';
    });

    updateStyle();
  }

  // Web App açıldığında paneli ekle
  const timer = setInterval(() => {
    if (document.body) {
      clearInterval(timer);
      createUI();
    }
  }, 500);
})();
