import { CONFIG, P, F, N } from './core/config.js';
import { state } from './core/state.js';
import { on as onEvent } from './core/events.js';
import { loadCoreStorage } from './core/storage.js';
import { pageWindow, pageStorage, vw, vh } from './utils/dom.js';
import { buyNowStep } from './utils/format.js';
import { inTransfers, topLimit } from './ea/page.js';
import { startAutoBuyer, stopAutoBuyer } from './bot/autoBuyer.js';
import { importCheapestTargets } from './targets/futbinImport.js';
import { loadTargetStorage, saveTargets } from './targets/targetStore.js';
import { restoreSavedTargets, saveTargetSnapshot } from './targets/targetOps.js';
import { addPinnedPlayerToTargets } from './targets/pinnedPlayer.js';

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
 *  7. SETTINGS      Sol menü FutRUSH butonu + Ayarlar penceresi     -> initSettings()
 *  8. SNIPE LOGO    Consumables yanındaki 40x40 logo = SNIPE panelini açan tek yol -> initLogoButton()
 *  9. SEARCH BUTTON Reset/Search yanındaki FutRUSH butonu (3 eşit buton)  -> initSearchButton()
 * 10. SYNC          Hepsini sırayla çalıştıran ana döngü + zamanlayıcı
 * 11. EVENTS        Tıklama / gözlemci / resize / scroll dinleyicileri -> initEvents()
 * 12. START         Başlangıç noktası (init çağrıları burada)
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
  // 4. PANEL  (body'de durur, sayfa geçişlerinde silinmez)
  // ==========================================================================
  let panel = null;

  function initPanel() {
    const style = document.createElement('style');
    style.textContent = `
    #${P.id} {
      position: fixed;
      z-index: 5;
      display: none;
      align-items: center;
      justify-content: center;
      border-radius: ${P.radius};
      background: ${P.bg};
      border: ${P.border};
      box-sizing: border-box;
      overflow: hidden;
    }
    #${P.id} .fc-snipe-btn {
      padding: 12px 30px;
      font-size: 20px;
      font-weight: 600;
      color: #e8f4f6;
      background: transparent;
      border: 2px solid rgba(255,255,255,.55);
      border-radius: 12px;
      cursor: pointer;
    }
    #${P.id}.fc-snipe-expanded {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      padding: 12px;
    }
    #${P.id} .fc-snipe-tabs {
      display: flex;
      flex: 0 0 auto;
      gap: 8px;
      width: 100%;
      border-bottom: 1px solid rgba(255,255,255,.2);
    }
    #${P.id} .fc-snipe-tab {
      flex: 1 1 0;
      min-width: 0;
      padding: 10px 8px;
      color: #c8d7df;
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    #${P.id} .fc-snipe-tab[aria-selected="true"] {
      color: #fff;
      border-bottom-color: #00e5ff;
    }
    #${P.id} .fc-snipe-tab-content {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      padding: 10px 4px 4px;
      color: #e8f4f6;
    }
    #${P.id} .fr-settings-view {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 100%;
      font-family: inherit;
      font-size: 12px;
    }
    #${P.id} .fr-setting-row {
      padding: 9px 11px;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      background: rgba(4,12,22,.3);
    }
    #${P.id} .fr-setting-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 7px;
      color: #e8f4f6;
      font-size: 12px;
      font-weight: 600;
    }
    #${P.id} .fr-setting-value { color: #00e5ff; font-variant-numeric: tabular-nums; }
    #${P.id} .fr-range {
      display: block;
      width: 100%;
      height: 4px;
      margin: 5px 0;
      appearance: none;
      border-radius: 99px;
      background: linear-gradient(to right, #00e5ff var(--fr-progress, 0%), rgba(255,255,255,.22) var(--fr-progress, 0%));
      outline: none;
      cursor: pointer;
      transition: background .16s ease;
    }
    #${P.id} .fr-range::-webkit-slider-thumb {
      width: 13px; height: 13px; appearance: none; border: 2px solid #eaffff; border-radius: 50%;
      background: #00cfe8; box-shadow: 0 0 8px rgba(0,229,255,.55); cursor: grab;
    }
    #${P.id} .fr-range::-moz-range-thumb {
      width: 10px; height: 10px; border: 2px solid #eaffff; border-radius: 50%;
      background: #00cfe8; box-shadow: 0 0 8px rgba(0,229,255,.55); cursor: grab;
    }
    #${P.id} .fr-toggle {
      position: relative;
      width: 36px;
      height: 20px;
      padding: 0;
      border: 1px solid rgba(255,255,255,.25);
      border-radius: 999px;
      background: rgba(255,255,255,.16);
      cursor: pointer;
      transition: background .2s ease, border-color .2s ease;
    }
    #${P.id} .fr-toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #d8e4e8;
      transition: transform .2s ease;
    }
    #${P.id} .fr-toggle[aria-checked="true"] { background: #00aabb; border-color: #00e5ff; }
    #${P.id} .fr-toggle[aria-checked="true"]::after { transform: translateX(16px); background: #fff; }
    #${P.id} .fr-counter { display: flex; align-items: center; gap: 12px; }
    #${P.id} .fr-counter button {
      width: 27px; height: 27px; padding: 0; border: 1px solid rgba(255,255,255,.22);
      border-radius: 6px; color: #e8f4f6; background: rgba(255,255,255,.08); font-size: 18px; cursor: pointer;
      transition: background .16s ease, transform .16s ease;
    }
    #${P.id} .fr-counter button:active { transform: scale(.92); background: rgba(0,229,255,.2); }
    #${P.id} .fr-counter-value { min-width: 22px; text-align: center; color: #00e5ff; font-size: 15px; font-weight: 700; }
    #${P.id} .fr-speed-options { display: flex; gap: 6px; }
    #${P.id} .fr-speed-option {
      flex: 1; padding: 6px 4px; border: 1px solid rgba(255,255,255,.16); border-radius: 6px;
      color: #aebfc8; background: rgba(255,255,255,.05); font: inherit; cursor: pointer; transition: .18s ease;
    }
    #${P.id} .fr-speed-option[aria-pressed="true"] { color: #07131b; border-color: #00e5ff; background: #00e5ff; font-weight: 700; }
    #${P.id} .fr-start {
      display: flex; align-items: center; justify-content: center; gap: 9px;
      width: 100%; min-height: 38px; margin-top: auto; padding: 8px 12px;
      border: 1px solid rgba(0,229,255,.65); border-radius: 8px; color: #eafcff;
      background: linear-gradient(100deg, rgba(0,153,190,.34), rgba(116,52,192,.3));
      font: inherit; font-size: 13px; font-weight: 700; letter-spacing: .03em; cursor: pointer;
      transition: filter .2s ease, box-shadow .2s ease;
    }
    #${P.id} .fr-start:hover { filter: brightness(1.2); box-shadow: 0 0 14px rgba(0,229,255,.2); }
    #${P.id} .fr-start svg { width: 18px; height: 22px; flex: 0 0 auto; }
    #${P.id} .fr-target-view { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 7px; }
    #${P.id} .fr-target-summary { flex: 0 0 auto; color: #c8d7df; font-size: 12px; line-height: 1.5; }
    #${P.id} .fr-target-status { flex: 0 0 auto; min-height: 0; color: #d9e8ee; font-size: 11px; }
    #${P.id} .fr-target-status[data-type="error"] { color: #ff8790; }
    #${P.id} .fr-target-status[data-type="success"] { color: #8de8b5; }
    #${P.id} .fr-target-list { display: flex; flex: 1 1 auto; flex-direction: column; gap: 7px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 1px 3px 2px 1px; }
    #${P.id} .fr-target-empty { margin: auto; color: #90a2ad; font-size: 12px; text-align: center; }
    #${P.id} .fr-target-card { flex: 0 0 auto; padding: 8px; border: 1px solid rgba(255,255,255,.12); border-radius: 7px; background: rgba(4,12,22,.48); }
    #${P.id} .fr-target-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    #${P.id} .fr-target-name { overflow: hidden; color: #ffd447; font-size: 13px; font-weight: 700; line-height: 1.25; text-overflow: ellipsis; }
    #${P.id} .fr-target-rating { flex: 0 0 auto; margin-left: 5px; color: #c8d7df; font-size: 10px; font-weight: 600; }
    #${P.id} .fr-target-remove { flex: 0 0 20px; width: 20px; height: 20px; margin: -3px -3px 0 0; padding: 0; border: 0; color: #ff5261; background: transparent; font: 700 18px/20px Arial,sans-serif; cursor: pointer; }
    #${P.id} .fr-target-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
    #${P.id} .fr-target-control-title { margin-bottom: 3px; color: #aebfc8; font-size: 9px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    #${P.id} .fr-target-counter { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
    #${P.id} .fr-target-counter button { width: 22px; height: 22px; padding: 0; border: 1px solid rgba(255,255,255,.2); border-radius: 5px; color: #e8f4f6; background: rgba(255,255,255,.08); font-size: 15px; line-height: 1; cursor: pointer; }
    #${P.id} .fr-target-counter button:active { background: rgba(0,229,255,.2); }
    #${P.id} .fr-target-counter-value { min-width: 24px; color: #00e5ff; font-size: 12px; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; }
    #${P.id} .fr-target-icons { display: flex; gap: 5px; margin-top: 6px; color: #7f929d; }
    #${P.id} .fr-target-icon { display: grid; width: 16px; height: 16px; place-items: center; border: 1px solid rgba(255,255,255,.13); border-radius: 3px; font-size: 9px; line-height: 1; opacity: .65; }
    #${P.id} .fr-target-actions { display: flex; flex: 0 0 auto; gap: 8px; padding-top: 2px; }
    #${P.id} .fr-target-action {
      flex: 1; min-height: 34px; border: 1px solid transparent; border-radius: 7px;
      color: #fff; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
      transition: filter .18s ease, transform .18s ease;
    }
    #${P.id} .fr-target-action:hover { filter: brightness(1.15); }
    #${P.id} .fr-target-action:active { transform: scale(.97); }
    #${P.id} .fr-target-save { background: linear-gradient(135deg, #0879dc, #13b5f4); border-color: rgba(115,214,255,.6); }
    #${P.id} .fr-target-load { background: linear-gradient(135deg, #bd2537, #f04452); border-color: rgba(255,150,155,.6); }
    #${P.id} .fr-bot-status { min-height: 14px; color: #aebfc8; font-size: 10px; text-align: center; }
    #${P.id} .fr-log-list { display: flex; flex-direction: column; gap: 5px; max-height: 100%; overflow: auto; color: #c8d7df; font-size: 11px; }
    #${P.id} .fr-log-row { padding: 6px 8px; border-left: 2px solid rgba(0,229,255,.5); background: rgba(4,12,22,.3); }
    #${P.id} .fr-log-row[data-type="error"] { border-left-color: #ff5261; color: #ff9ca4; }
    #${P.id} .fr-log-row[data-type="success"] { border-left-color: #51d88a; color: #a6efc1; }
  `;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = P.id;
    panel.innerHTML = '<button class="fc-snipe-btn" type="button">' + P.buttonText + '</button>';
    panel.querySelector('.fc-snipe-btn').addEventListener('click', () => {
      state.panelExpanded = true;
      renderPanelTabs();
    });
    document.body.appendChild(panel);

    // Son ölçüyü hatırla (pencere oranı olarak)
    loadCoreStorage();
    loadTargetStorage();
  }

  function renderPanelTabs() {
    const tabs = [
      { id: 'targets', label: 'Oyuncu Hedefleri' },
      { id: 'settings', label: 'Ayarlar' },
      { id: 'logs', label: 'Loglar' }
    ];
    panel.classList.add('fc-snipe-expanded');
    panel.innerHTML = '<div class="fc-snipe-tabs" role="tablist" aria-label="SNIPE sekmeleri">' +
      tabs.map((tab) => '<button class="fc-snipe-tab" type="button" role="tab" data-tab="' + tab.id + '" aria-selected="' + (state.activePanelTab === tab.id) + '">' + tab.label + '</button>').join('') +
      '</div><div class="fc-snipe-tab-content" role="tabpanel" aria-live="polite"></div>';
    const content = panel.querySelector('.fc-snipe-tab-content');
    renderPanelTabContent(content);
    panel.querySelectorAll('.fc-snipe-tab').forEach((button) => {
      button.addEventListener('click', () => {
        state.activePanelTab = button.dataset.tab;
        panel.querySelectorAll('.fc-snipe-tab').forEach((tab) => tab.setAttribute('aria-selected', String(tab === button)));
        renderPanelTabContent(content);
      });
    });
  }

  function renderPanelTabContent(content) {
    if (state.activePanelTab === 'targets') {
      renderTargetContent(content);
      return;
    }
    if (state.activePanelTab !== 'settings') {
      renderBotLogs(content);
      return;
    }
    const s = state.snipeSettings;
    const speedLabels = { 0: 'Yavaş', 1: 'Orta', 2: 'Hızlı', 3: 'Çok hızlı' };
    content.innerHTML =
      '<div class="fr-settings-view">' +
        '<div class="fr-setting-row"><div class="fr-setting-head"><span>Oyuncu listesi tekrarı</span><span class="fr-setting-value" data-value="repeat">' + s.repeat + '</span></div><input class="fr-range" data-setting="repeat" type="range" min="0" max="50" step="1" value="' + s.repeat + '" aria-label="Oyuncu listesi kaç kez tekrarlanacak"></div>' +
        '<div class="fr-setting-row"><div class="fr-setting-head"><span>Bekleme süresi (arama bitince)</span><span class="fr-setting-value" data-value="waitSeconds">' + s.waitSeconds + ' sn</span></div><input class="fr-range" data-setting="waitSeconds" type="range" min="0" max="120" step="1" value="' + s.waitSeconds + '" aria-label="Arama bitince beklenecek süre"></div>' +
        '<div class="fr-setting-row"><div class="fr-setting-head"><span>Otomatik satış (aldıktan sonra)</span><button class="fr-toggle" type="button" role="switch" aria-checked="' + s.autoSell + '" aria-label="Otomatik satış"></button></div></div>' +
        '<div class="fr-setting-row"><div class="fr-setting-head"><span>En fazla alınacak oyuncu</span></div><div class="fr-counter"><button type="button" data-count="-1" aria-label="Oyuncu sayısını azalt">−</button><span class="fr-counter-value" data-value="maxPlayers">' + s.maxPlayers + '</span><button type="button" data-count="1" aria-label="Oyuncu sayısını artır">+</button></div></div>' +
        '<div class="fr-setting-row"><div class="fr-setting-head"><span>Arama hızı</span><span class="fr-setting-value" data-value="speed">' + (speedLabels[s.speed] || '') + '</span></div><input class="fr-range" data-setting="speed" type="range" min="0" max="3" step="1" value="' + s.speed + '" aria-label="Arama hızı 0 ile 3 arasında"></div>' +
        '<button class="fr-start" type="button"><svg viewBox="0 0 24 32" aria-hidden="true"><path d="M14 1 3 18h7l-1 13 12-19h-8z" fill="currentColor" stroke="rgba(255,255,255,.8)" stroke-width="1" stroke-linejoin="round"/></svg><span>' + (state.botRunning ? 'Durdur FutRUSH' : 'Başlat FutRUSH') + '</span></button><div class="fr-bot-status" aria-live="polite"></div>' +
      '</div>';

    content.querySelectorAll('.fr-range').forEach((input) => {
      const updateRange = () => {
        const min = Number(input.min);
        const max = Number(input.max);
        const progress = ((Number(input.value) - min) / (max - min)) * 100;
        input.style.setProperty('--fr-progress', progress + '%');
      };
      updateRange();
      input.addEventListener('input', () => {
      const key = input.dataset.setting;
      s[key] = Number(input.value);
      const displayValue = key === 'waitSeconds' ? s[key] + ' sn' : key === 'speed' ? (speedLabels[s.speed] || '') : String(s[key]);
      content.querySelector('[data-value="' + key + '"]').textContent = displayValue;
      updateRange();
      });
    });
    content.querySelector('.fr-toggle').addEventListener('click', (event) => {
      s.autoSell = !s.autoSell;
      event.currentTarget.setAttribute('aria-checked', String(s.autoSell));
    });
    content.querySelectorAll('[data-count]').forEach((button) => button.addEventListener('click', () => {
      s.maxPlayers = Math.max(1, s.maxPlayers + Number(button.dataset.count));
      content.querySelector('[data-value="maxPlayers"]').textContent = String(s.maxPlayers);
    }));
    content.querySelector('.fr-bot-status').textContent = state.botStatus;
    content.querySelector('.fr-start').addEventListener('click', () => {
      if (state.botRunning) stopAutoBuyer('Kullanıcı tarafından durduruldu.');
      else startAutoBuyer();
    });
  }

  function renderBotLogs(content) {
    content.innerHTML = '<div class="fr-log-list" role="log" aria-live="polite"></div>';
    const list = content.querySelector('.fr-log-list');
    if (!state.botLogs.length) {
      const empty = document.createElement('div');
      empty.className = 'fr-target-empty';
      empty.textContent = 'Henüz FutRUSH işlem kaydı yok.';
      list.appendChild(empty);
      return;
    }
    state.botLogs.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'fr-log-row';
      row.dataset.type = entry.type;
      row.textContent = new Date(entry.at).toLocaleTimeString('tr-TR') + ' · ' + entry.message;
      list.appendChild(row);
    });
  }

  function openTargetSaveDialog() {
    document.querySelector('.fr-target-save-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'fr-target-save-overlay';
    const shadow = overlay.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>' +
      ':host{all:initial;position:fixed!important;inset:0!important;z-index:2147483001!important;display:grid!important;place-items:center!important;font-family:Arial,Helvetica,sans-serif!important;color:#fff!important;}' +
      '*,*::before,*::after{box-sizing:border-box;}' +
      '.backdrop{position:absolute;inset:0;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.72);}' +
      '.dialog{width:min(360px,92vw);padding:16px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:linear-gradient(120deg,#101412,#1a201d);box-shadow:0 12px 40px rgba(0,0,0,.45);}' +
      '.title{margin-bottom:10px;font-size:16px;font-weight:700;}' +
      'input{width:100%;height:36px;padding:0 10px;border:1px solid rgba(255,255,255,.2);border-radius:5px;outline:none;color:#fff;background:rgba(0,0,0,.3);font:13px Arial,sans-serif;}' +
      'input:focus{border-color:#00d5ef;}' +
      '.error{min-height:16px;margin-top:5px;color:#ff8790;font-size:11px;}' +
      '.actions{display:flex;justify-content:flex-end;gap:7px;margin-top:8px;}' +
      'button{min-width:74px;height:30px;padding:0 10px;border:1px solid rgba(255,255,255,.16);border-radius:5px;color:#fff;background:rgba(255,255,255,.08);font:700 11px Arial,sans-serif;cursor:pointer;}' +
      '.save{border-color:rgba(0,213,239,.55);background:linear-gradient(135deg,#0879dc,#13a9d5);}' +
      '</style><div class="backdrop"><div class="dialog" role="dialog" aria-modal="true" aria-label="Oyuncu listesini kaydet">' +
      '<div class="title">Oyuncu listesini kaydet</div><input maxlength="40" placeholder="Liste adı" aria-label="Liste adı"><div class="error" aria-live="polite"></div>' +
      '<div class="actions"><button type="button" class="cancel">İptal</button><button type="button" class="save">Kaydet</button></div></div></div>';
    document.body.appendChild(overlay);
    const input = shadow.querySelector('input');
    const error = shadow.querySelector('.error');
    const close = () => overlay.remove();
    const submit = () => {
      const name = input.value.trim();
      if (!name) { error.textContent = 'Lütfen kayıt için bir isim yazın.'; input.focus(); return; }
      saveTargetSnapshot(name);
      close();
      const content = panel.querySelector('.fc-snipe-tab-content');
      if (content && state.activePanelTab === 'targets') renderTargetContent(content);
    };
    shadow.querySelector('.cancel').addEventListener('click', close);
    shadow.querySelector('.save').addEventListener('click', submit);
    shadow.querySelector('.backdrop').addEventListener('click', (event) => { if (event.target === event.currentTarget) close(); });
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); if (event.key === 'Escape') close(); });
    input.focus();
  }

  function renderTargetContent(content) {
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
      openTargetSaveDialog();
    });
    content.querySelector('[data-filter-mode="load"]').addEventListener('click', () => openFilterModal('load'));
  }

  function openFilterModal(mode) {
    document.querySelector('.fr-filter-overlay')?.remove();
    state.filterDraft = { kind: state.targetFilter.kind, ratings: state.targetFilter.ratings.slice(0, 1), count: state.targetFilter.count };
    const overlay = document.createElement('div');
    overlay.className = 'fr-filter-overlay';
    const shadow = overlay.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<style>' +
        ':host{all:initial;position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2147483000!important;display:block!important;font-family:Arial,Helvetica,sans-serif!important;color:#fff!important;}' +
        '*,*::before,*::after{box-sizing:border-box;}' +
        '.fr-filter-backdrop{position:absolute;inset:0;display:grid;place-items:center;padding:12px;background:rgba(0,0,0,.68);}' +
        '.fr-filter-modal{position:relative;display:flex;flex-direction:column;width:min(50vw,1300px);height:min(50vh,600px);min-width:0;min-height:0;overflow:hidden;color:#fff;background:linear-gradient(110deg,#101412 0%,#151a18 50%,#101412 100%);font-family:Arial,Helvetica,sans-serif;}' +
        '.fr-filter-title{display:grid;place-items:center;flex:0 0 9%;min-height:0;padding:0 8px;text-align:center;background:rgba(0,0,0,.32);font-size:clamp(24px,1.9vw,34px);line-height:1.1;}' +
        '.fr-filter-kind{display:grid;flex:0 0 9.3%;min-height:0;grid-template-columns:minmax(0,1fr) minmax(0,1fr);width:100%;overflow:hidden;}' +
        '.fr-filter-kind button{display:grid;place-items:center;width:100%;min-width:0;height:100%;margin:0;padding:3px 6px;border:0;border-radius:0;color:#fff;background:rgba(0,0,0,.2);font:700 clamp(18px,1vw,22px)/1.2 Arial,Helvetica,sans-serif;white-space:nowrap;cursor:pointer;}' +
        '.fr-filter-kind button[aria-selected="true"]{color:#111;background:#fff;}' +
        '.fr-filter-rating-title,.fr-filter-count-title{display:grid;place-items:center;flex:0 0 5.3%;min-height:0;padding:0 6px;text-align:center;background:rgba(0,0,0,.45);font-size:clamp(16px,.9vw,18px);line-height:1.1;}' +
        '.fr-filter-rating-grid{display:grid;flex:0 0 34%;min-width:0;min-height:0;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));column-gap:1.1%;row-gap:1.2vh;padding:8px .7%;}' +
        '.fr-filter-rating{display:grid;place-items:center;width:100%;height:100%;min-width:0;min-height:0;margin:0;padding:0;border:0;border-radius:0;color:#fff;background:#0b0d0c;font:400 clamp(16px,.9vw,20px)/1 Arial,Helvetica,sans-serif;cursor:pointer;touch-action:manipulation;}' +
        '.fr-filter-rating:hover{background:#171b19;}' +
        '.fr-filter-rating[aria-pressed="true"]{outline:2px solid #00b9ee;outline-offset:-2px;background:#111e21;}' +
        '.fr-filter-custom-list{display:none;flex:1 1 auto;min-height:0;flex-direction:column;gap:5px;overflow:auto;padding:8px 10px;}' +
        '.fr-filter-custom-summary{flex:0 0 auto;color:#aebfc8;font-size:12px;text-align:center;}' +
        '.fr-filter-custom-row{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:34px;padding:5px 9px;border:1px solid rgba(255,255,255,.1);color:#fff;background:rgba(0,0,0,.24);font:12px Arial,Helvetica,sans-serif;text-align:left;cursor:pointer;}' +
        '.fr-filter-custom-row[aria-pressed="true"]{border-color:#00b9ee;background:rgba(0,185,238,.12);}' +
        '.fr-filter-custom-name{min-width:0;overflow:hidden;color:#ffd447;font-weight:700;text-overflow:ellipsis;white-space:nowrap;}' +
        '.fr-filter-custom-data{flex:0 0 auto;color:#d8e4e8;font-size:11px;white-space:nowrap;}' +
        '.fr-filter-custom-player{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px;padding:3px 9px;border-bottom:1px solid rgba(255,255,255,.08);font-size:11px;}' +
        '.fr-filter-custom-player-name{min-width:0;overflow:hidden;color:#dbe7e9;text-overflow:ellipsis;white-space:nowrap;}' +
        '.fr-filter-custom-player-data{flex:0 0 auto;color:#aebfc8;white-space:nowrap;}' +
        '.fr-filter-custom-empty{margin:auto;color:#aebfc8;font-size:13px;text-align:center;}' +
        '.fr-filter-modal.is-custom .fr-filter-rating-title,.fr-filter-modal.is-custom .fr-filter-rating-grid,.fr-filter-modal.is-custom .fr-filter-count-title,.fr-filter-modal.is-custom .fr-filter-count{display:none;}' +
        '.fr-filter-modal.is-custom .fr-filter-custom-list{display:flex;}' +
        '.fr-filter-count{display:flex;flex:0 0 10.5%;align-items:flex-end;justify-content:center;min-height:0;padding:0 12px;}' +
        '.fr-filter-count button{display:grid;place-items:center;flex:0 0 clamp(30px,1.6vw,60px);width:clamp(30px,1.6vw,60px);height:80%;min-height:0;margin:0;padding:0;border:0;border-radius:0;color:#101010;background:#fff;font:700 clamp(16px,.85vw,22px)/1 Arial,Helvetica,sans-serif;cursor:pointer;}' +
        '.fr-filter-count button:first-child{border-radius:24px 0 0 24px;}.fr-filter-count button:last-child{border-radius:0 24px 24px 0;}' +
        '.fr-filter-count-value{display:grid;place-items:center;width:min(18.2vw,680px);height:80%;min-height:0;background:rgba(0,0,0,.25);font-size:clamp(16px,.8vw,22px);}' +
        '.fr-filter-footer{display:flex;flex:0 0 26.6%;min-height:0;flex-direction:column;}' +
        '.fr-filter-submit,.fr-filter-cancel{display:flex;align-items:center;flex:1 1 50%;width:100%;min-height:0;margin:0;padding:0 1.2%;border:0;border-radius:0;text-align:left;color:#fff;background:transparent;font:400 clamp(18px,1.05vw,24px)/1.2 Arial,Helvetica,sans-serif;cursor:pointer;}' +
        '.fr-filter-submit{padding:7px 1.2% 0;border-bottom:1px solid rgba(255,255,255,.2);}.fr-filter-cancel{padding:0 1.2% 7px;color:#ff573b;}' +
        '@media(max-width:700px){.fr-filter-modal{width:min(92vw,1300px);height:min(70vh,600px)}.fr-filter-title{font-size:clamp(22px,4.5vw,30px)}.fr-filter-rating-title,.fr-filter-count-title{font-size:clamp(15px,2.8vw,18px)}.fr-filter-rating{font-size:clamp(15px,3vw,18px)}.fr-filter-count-value{width:min(35vw,680px)}}' +
      '</style><div class="fr-filter-backdrop"><div class="fr-filter-modal" role="dialog" aria-modal="true" aria-label="Kayıtlı Filtreler">' +
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

  // Üstteki tüm tam genişlikli çubukların (ut-navigation-bar-view, ea-filter-bar-view: Players/Managers/
  // Club Items/Consumables sekmeleri vb.) en alt kenarı: panel bunların altına girmesin
  // Panel yalnızca: logoyla açıldıysa + logo sayfadaysa + Transfers içindeysek görünür
  function panelShown() {
    return CONFIG.features.logoButton && state.panelOpen && state.logoPresent && inTransfers();
  }

  function applyGeom() {
    const geom = state.geom;
    if (!geom) { panel.style.display = 'none'; return; }
    const left = geom.l * vw();
    const top0 = geom.t * vh() - state.liveScroll;
    const w0 = geom.w * vw();
    const h0 = geom.h * vh();

    // başlık çubuğunun altında kal, pencere dışına taşma
    const top = Math.max(top0, topLimit());
    const h = Math.max(0, Math.min(h0, vh() - P.edge - top));
    const w = Math.max(0, Math.min(w0, vw() - P.edge - left));

    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
    panel.style.width = Math.round(w) + 'px';
    panel.style.height = Math.round(h) + 'px';
    panel.style.display = panelShown() ? 'flex' : 'none';
    if (!state.panelExpanded) panel.classList.remove('fc-snipe-expanded');
  }

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
  // 7. SETTINGS  (sol menü FutRUSH butonu + Ayarlar penceresi)
  // ==========================================================================
  const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 2 64 84" preserveAspectRatio="xMidYMid meet"> <defs> <linearGradient id="fr-ring" x1="0" y1="0" x2="1" y2="1"> <stop offset="0" stop-color="#00E5FF"/> <stop offset=".55" stop-color="#7C4DFF"/> <stop offset="1" stop-color="#FF2D95"/> </linearGradient> <linearGradient id="fr-bg" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#14264A"/> <stop offset="1" stop-color="#0A1226"/> </linearGradient> <linearGradient id="fr-bolt" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#FFF176"/> <stop offset=".5" stop-color="#FFB300"/> <stop offset="1" stop-color="#FF4D2E"/> </linearGradient> </defs> <path d="M40 4 L70 14 V46 C70 64 56 76 40 83 C24 76 10 64 10 46 V14 Z" fill="url(#fr-bg)" stroke="url(#fr-ring)" stroke-width="3" stroke-linejoin="round"/> <path d="M15 30h11M13 41h13M17 52h9" stroke="#00E5FF" stroke-width="3" stroke-linecap="round" opacity=".9"/> <polygon points="48,12 29,45 40,45 35,72 56,36 44,36 53,12" fill="url(#fr-bolt)" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="1" stroke-linejoin="round"/> </svg>';

  let navBtn = null;
  let modal = null;

  function initSettings() {
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
    #${N.modalId} .fr-body { flex: 1; padding: 18px; overflow: auto; }   /* şimdilik boş */
  `;
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

  function openSettings() { modal.style.display = 'block'; navBtn.classList.add('fr-open'); }
  function closeSettings() { modal.style.display = 'none'; navBtn.classList.remove('fr-open'); }

  // Butonu menüdeki son öğenin hemen altına, diğer öğelerle aynı ölçü/yazı stiliyle yerleştir
  function placeNav() {
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
    } catch (e) {}
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

  // ==========================================================================
  // 8. SNIPE LOGO  (Consumables sekmesinin sağında 40x40 FutRUSH logosu = SNIPE panelinin tek açma yolu)
  // ==========================================================================
  const LG = CONFIG.logoButton;

  // Logo SVG'si menü butonundakiyle aynı; gradient id'leri çakışmasın diye yeniden adlandırılır
  const LOGO_SVG = ICON_SVG.replace(/fr-(ring|bg|bolt)/g, 'fr-lg-$1');

  function initLogoButton() {
    const st = document.createElement('style');
    st.textContent = `
    button.${LG.className} {
      position: absolute; z-index: 5; box-sizing: border-box;
      width: ${LG.size}px; height: ${LG.size}px; margin: 0; padding: 0;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: 0; outline: 0; cursor: pointer;
      transition: filter .15s, transform .15s;
    }
    button.${LG.className} svg { display: block; width: 100%; height: 100%; }
    button.${LG.className}:hover { filter: brightness(1.15) drop-shadow(0 0 6px rgba(0, 229, 255, .55)); transform: scale(1.06); }
    button.${LG.className}.fr-open { filter: drop-shadow(0 0 8px rgba(0, 229, 255, .85)); }
  `;
    document.head.appendChild(st);
  }

  // Consumables sekmesi (yalnızca Transfers içinde)
  function findLogoAnchor() {
    if (!inTransfers()) return null;
    return Array.from(document.querySelectorAll('button.ea-filter-bar-item-view')).find((b) =>
      LG.anchorPattern.test(b.textContent) && b.getBoundingClientRect().width > 20) || null;
  }

  function placeLogoButton() {
    let logo = document.querySelector('button.' + LG.className);
    const anchor = findLogoAnchor();

    // sekme çubuğu yoksa (başka sayfa / Transfers dışı): logoyu kaldır, panel kapansın
    if (!anchor) {
      if (logo) logo.remove();
      state.logoPresent = false;
      state.panelOpen = false;
      return;
    }

    const bar = anchor.parentElement;
    if (!logo) {
      logo = document.createElement('button');
      logo.type = 'button';
      logo.className = LG.className;
      logo.title = LG.title;
      logo.setAttribute('aria-label', LG.title);
      logo.innerHTML = LOGO_SVG;
      logo.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        state.panelOpen = !state.panelOpen;
        sync();
      });
    }
    if (logo.parentElement !== bar) bar.appendChild(logo);
    state.logoPresent = true;

    // Mutlak konum: sekmelerin yerleşimine dokunmaz (çubuğun içeriği kaymaz)
    if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
    const br = bar.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const sx = br.width / (bar.offsetWidth || br.width || 1);     // sayfa ölçeklenmişse (fitContent) düzelt
    const sy = br.height / (bar.offsetHeight || br.height || 1);
    const left = (ar.right - br.left) / sx - bar.clientLeft + LG.gap;
    const top = (ar.top - br.top) / sy - bar.clientTop + (ar.height / sy - LG.size) / 2;
    logo.style.left = Math.round(left) + 'px';
    logo.style.top = Math.round(top) + 'px';
    logo.classList.toggle('fr-open', state.panelOpen);
  }

  // ==========================================================================
  // 9. SEARCH BUTTON  (Reset + Search yanına FutRUSH butonu: 3 eşit buton)
  // ==========================================================================
  const SB = CONFIG.searchButton;

  // Logo: kehribar/altın şimşek, lacivert zemin, camgöbeği -> mor -> pembe halka
  const SB_BOLT_SVG =
    '<svg class="fr-sb-bolt" xmlns="http://www.w3.org/2000/svg" viewBox="26 10 32 64" aria-hidden="true">' +
    '<defs><linearGradient id="fr-sb-bolt-g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#FFF176"/><stop offset=".5" stop-color="#FFB300"/><stop offset="1" stop-color="#FF4D2E"/>' +
    '</linearGradient></defs>' +
    '<polygon points="48,12 29,45 40,45 35,72 56,36 44,36 53,12" fill="url(#fr-sb-bolt-g)" ' +
    'stroke="#FFFFFF" stroke-opacity=".7" stroke-width="1" stroke-linejoin="round"/></svg>';

  function initSearchButton() {
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

  // Üç butonu aynı genişliğe getir: Reset ve Search küçülür, satırın toplam ölçüsü değişmez
  function layoutSearchRow(parent, resetEl, searchEl, mine) {
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

  function onSearchButtonClick() {
    showTargetsAfterQuickAdd();
    addPinnedPlayerToTargets();
  }

  function showTargetsAfterQuickAdd() {
    if (!panel) return null;
    if (!state.panelExpanded || state.activePanelTab !== 'targets') {
      state.panelExpanded = true;
      state.activePanelTab = 'targets';
      renderPanelTabs();
    }
    return panel.querySelector('.fc-snipe-tab-content');
  }

  function placeSearchButton() {
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

  function initTemporaryEventListeners() {
    onEvent('targets:changed', () => {
      const content = panel?.querySelector('.fc-snipe-tab-content');
      if (content && state.activePanelTab === 'targets') renderTargetContent(content);
    });
    onEvent('log:added', () => {
      const content = panel?.querySelector('.fc-snipe-tab-content');
      if (content && state.activePanelTab === 'logs') renderBotLogs(content);
    });
    onEvent('bot:status', () => {
      const content = panel?.querySelector('.fc-snipe-tab-content');
      if (content && state.activePanelTab === 'settings') {
        const status = content.querySelector('.fr-bot-status');
        const button = content.querySelector('.fr-start span');
        if (status) status.textContent = state.botStatus;
        if (button) button.textContent = state.botRunning ? 'Durdur FutRUSH' : 'Başlat FutRUSH';
      }
    });
  }

  // ==========================================================================
  // 12. START  (yeni özellik eklerken init satırını buraya ekle)
  // ==========================================================================
  initTemporaryEventListeners();
  initPanel();
  if (CONFIG.features.settingsButton) initSettings();
  if (CONFIG.features.logoButton) initLogoButton();
  if (CONFIG.features.searchButton) initSearchButton();
  initEvents();
  sync();
})();
