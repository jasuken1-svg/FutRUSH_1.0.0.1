// Sol navigasyona FutRUSH ayar dugmesini ve ayarlar modalini yerlestirir.
// Bagimliliklar: core/config, EA sayfa secicileri ve ui/icons.

import { N } from '../core/config.js';
import { ICON_SVG } from './icons.js';
import { renderSettingsBody } from './settingsModal.js';
import { settingsModalCss } from './settingsModal.css.js';

let navBtn = null;
let modal = null;

export function initSettings() {
    const navStyle = document.createElement('style');
    navStyle.textContent = `
    #${N.id} {
      position: fixed; z-index: 5; display: none;
      flex-direction: column; align-items: center; justify-content: flex-start;
      box-sizing: border-box; margin: 0; padding: 0;
      background: transparent; border: 0; outline: 0; cursor: pointer;
      color: var(--fr-color, rgba(255,255,255,.7));
      transition: color .15s, background-color .15s;
    }
    #${N.id}:hover { color: #fff; background: rgba(255,255,255,.06); }
    #${N.id}.fr-open { color: #fff; }
    #${N.id} .fr-icon { display: block; flex: 0 0 auto; }
    #${N.id} .fr-icon svg { display: block; width: 100%; height: 100%; }
    #${N.id}.fr-open .fr-icon { filter: drop-shadow(0 0 6px rgba(0,229,255,.6)); }
    #${N.id} .fr-l1, #${N.id} .fr-l2 {
      display: block; width: 100%; text-align: center; white-space: nowrap; color: inherit;
    }

    #${N.modalId} { position: fixed; inset: 0; z-index: 100; display: none; font-family: Arial, sans-serif; }
    #${N.modalId} .fr-backdrop { position: absolute; inset: 0; background: rgba(5,10,20,.65); }
    #${N.modalId} .fr-dialog {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: min(640px, 90vw); height: min(480px, 80vh);
      display: flex; flex-direction: column;
      background: #0f1a2c; border: 1px solid rgba(255,255,255,.18); border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,.55); overflow: hidden;
    }
    #${N.modalId} .fr-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(90deg, rgba(0,229,255,.12), rgba(124,77,255,.12), rgba(255,45,149,.12));
    }
    #${N.modalId} .fr-title { font-size: 18px; font-weight: 700; color: #fff; }
    #${N.modalId} .fr-title b {
      background: linear-gradient(90deg, #FFB300, #FF2D95); -webkit-background-clip: text;
      background-clip: text; color: transparent;
    }
    #${N.modalId} .fr-close {
      width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
      color: #fff; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.2); font-size: 16px;
    }
    #${N.modalId} .fr-close:hover { background: rgba(255,255,255,.18); }
    #${N.modalId} .fr-body { flex: 1; padding: 18px; overflow: auto; }
  ` + settingsModalCss;
    document.head.appendChild(navStyle);

    navBtn = document.createElement('button');
    navBtn.id = N.id;
    navBtn.type = 'button';
    navBtn.title = 'FutRUSH (Ayarlar)';
    navBtn.setAttribute('aria-label', 'FutRUSH (Ayarlar)');
    navBtn.innerHTML =
      '<span class="fr-icon">' + ICON_SVG + '</span>' +
      '<span class="fr-l1">FutRUSH</span>' +
      '<span class="fr-l2">Ayarlar</span>';
    document.body.appendChild(navBtn);

    modal = document.createElement('div');
    modal.id = N.modalId;
    modal.innerHTML =
      '<div class="fr-backdrop"></div>' +
      '<div class="fr-dialog" role="dialog" aria-label="FutRUSH Ayarlar">' +
        '<div class="fr-head"><span class="fr-title"><b>FutRUSH</b> · Ayarlar</span>' +
        '<button class="fr-close" type="button" aria-label="Kapat">\u2715</button></div>' +
        '<div class="fr-body" id="futrush-settings-body"></div>' +
      '</div>';
    document.body.appendChild(modal);

    navBtn.addEventListener('click', () => (modal.style.display === 'block' ? closeSettings() : openSettings()));
    modal.querySelector('.fr-backdrop').addEventListener('click', closeSettings);
    modal.querySelector('.fr-close').addEventListener('click', closeSettings);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });
  }

function openSettings() {
    renderSettingsBody(modal.querySelector('#futrush-settings-body'));
    modal.style.display = 'block';
    navBtn.classList.add('fr-open');
}

function closeSettings() { modal.style.display = 'none'; navBtn.classList.remove('fr-open'); }

export function placeNav() {
    if (!navBtn) return;   // Ayarlar özelliği kapalıysa
    const nav = document.querySelector('nav.ut-tab-bar') || document.querySelector('.ut-tab-bar');
    const q = nav && nav.getBoundingClientRect();
    if (!q || q.width < 40 || q.height < 200) { navBtn.style.display = 'none'; return; }

    const items = Array.from(nav.querySelectorAll('.ut-tab-bar-item'));
    const settings = items.find((i) => /icon-settings/.test(i.className));
    const others = items.filter((i) => i !== settings);
    const ref = others.find((i) => !/\bselected\b/.test(i.className)) || others[0];
    if (!ref) { navBtn.style.display = 'none'; return; }

    const rq = ref.getBoundingClientRect();
    const lab = ref.querySelector('span');
    const lq = lab ? lab.getBoundingClientRect() : null;
    const cs = lab ? getComputedStyle(lab) : null;
    const lh = lq && lq.height > 8 ? Math.round(lq.height) : 17;          // bir yazı satırının yüksekliği
    const labelTop = lq ? lq.top - rq.top : 37;                           // yazının öğe içindeki konumu

    // ikon boyutu: diğer ikonlardan oku, okunamazsa varsayılan
    let iconSize = N.defaultIcon;
    try {
      const ps = getComputedStyle(ref, '::before');
      const pw = parseFloat(ps.width), ph = parseFloat(ps.height);
      const v = Math.max(isFinite(pw) ? pw : 0, isFinite(ph) ? ph : 0);
      if (v >= 14 && v <= 48) iconSize = Math.round(v);
    } catch (e) {
      // Pseudo-element stili okunamazsa varsayılan ikon boyutunu kullan.
    }
    const pad = Math.max(2, Math.round((labelTop - iconSize) / 2));

    const lastBottom = others.reduce((m, i) => Math.max(m, i.getBoundingClientRect().bottom), q.top);
    const limitBottom = settings ? settings.getBoundingClientRect().top : q.bottom;
    const H = Math.round(rq.height + lh);                                  // normal öğe + "Ayarlar" satırı
    if (lastBottom + H > limitBottom) { navBtn.style.display = 'none'; return; }

    // yazı stilini diğer menü yazılarından kopyala
    if (cs) {
      navBtn.style.setProperty('--fr-color', cs.color);
      navBtn.style.fontFamily = cs.fontFamily;
      navBtn.style.fontSize = cs.fontSize;
      navBtn.style.fontWeight = cs.fontWeight;
      navBtn.style.letterSpacing = cs.letterSpacing;
    }
    navBtn.style.left = Math.round(rq.left) + 'px';
    navBtn.style.top = Math.round(lastBottom) + 'px';
    navBtn.style.width = Math.round(rq.width) + 'px';
    navBtn.style.height = H + 'px';
    navBtn.style.paddingTop = pad + 'px';

    const icon = navBtn.querySelector('.fr-icon');
    icon.style.width = iconSize + 'px';
    icon.style.height = iconSize + 'px';
    icon.style.marginBottom = (labelTop - pad - iconSize) + 'px';
    navBtn.querySelectorAll('.fr-l1, .fr-l2').forEach((el) => {
      el.style.height = lh + 'px';
      el.style.lineHeight = lh + 'px';
    });
    navBtn.style.display = 'flex';
  }