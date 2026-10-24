// FutRUSH userscript panelinin tum CSS bilesenlerini ve animasyonlarini tanimlar.
// Bagimlilik: core/config.

import { CONFIG } from '../../core/config.js';

const P = CONFIG.panel;

export const panelCss = `
    @font-face {
      font-family: 'DIN Pro Condensed Medium';
      src: local("DIN Pro Condensed Medium"),
           local("DINPro-CondensedMedium"),
           local("DINPro-CondMedium"),
           local("DIN Pro Cond Medium"),
           local("DINPro Condensed Medium"),
           local("DIN Condensed Medium"),
           local("DIN Pro Condensed"),
           local("Barlow Condensed Medium");
      font-weight: 100 900;
      font-style: normal;
    }

    /* Ana Kart ve Panel Stilleri */
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
      --fr-bg: #07131e;
      --fr-card-bg: rgba(6, 18, 28, 0.94);
      --fr-border: rgba(0, 229, 255, 0.28);
      --fr-text: #e6f6f7;
      --fr-muted: #8aa4af;
      --fr-cyan: #00e5ff;
      --fr-green: #51d88a;
      --fr-red: #ff5261;

      /* Kart Özel Değişkenleri (ÖLÇÜLER) */
      --card-w: 105px;
      --card-h: 152.7px;
      --card-rating-top: 22.5%;
      --card-rating-left: 11.5%;
      --card-rating-size: 16cqw;
      --card-pos-size: 8cqw;
      --card-photo-top: 21%;
      --card-photo-right: 19%;
      --card-photo-w: 58.5%;
      --card-photo-h: 58%;
      --card-photo-shift: -7.5%;
      --card-photo-scale: 1;
      --card-name-top: 59%;
      --card-name-size: 8.5cqw;
      --card-name-weight: 100;
      --card-stats-top: 69%;
      --card-stats-inset: 17%;
      --card-stat-lbl-size: 6cqw;
      --card-stat-lbl-weight: 100;
      --card-stat-val-size: 6cqw;
      --card-stat-val-weight: 100;
      --card-crest-top: 81%;
      --card-crest-inset: 17.5%;
      --card-crest-gap: 8.5cqw;
      --card-nation-w: 14cqw;
      --card-nation-h: 10.5cqw;
      --card-league-w: 14cqw;
      --card-league-h: 10.5cqw;
      --card-club-w: 14cqw;
      --card-club-h: 10.5cqw;
      --card-ps-top: 38%;
      --card-ps-left: 13%;
      --card-ps-size: 11cqw;
      --card-ps-gap: 2cqw;
      --card-ps-display: flex;
      --card-font: 'DIN Pro Condensed Medium', 'UltimateTeamCondensed', 'DINPro-CondensedMedium', 'DINPro-CondMedium', 'DIN Pro Cond Medium', 'DINPro Condensed Medium', 'DIN Condensed Medium', 'DIN Pro Condensed', 'Barlow Condensed Medium', 'Arial Narrow', sans-serif;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    #${P.id} * { box-sizing: border-box; }

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

    #${P.id} .fc-snipe-tab-content[data-active-tab="settings"] { overflow-y: auto; scrollbar-width: none; }
    #${P.id} .fc-snipe-tab-content[data-active-tab="settings"]::-webkit-scrollbar { display: none; }

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
      background: #00cfe8; box-shadow: 0 0 8px rgba(0,229,255,.55); cursor: pointer;
    }

    #${P.id} .fr-range::-moz-range-thumb {
      width: 10px; height: 10px; border: 2px solid #eaffff; border-radius: 50%;
      background: #00cfe8; box-shadow: 0 0 8px rgba(0,229,255,.55); cursor: pointer;
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
    #${P.id} .fr-toggle.fr-toggle--dryrun[aria-checked="true"] { background: #eab308; border-color: #facc15; }

    #${P.id} .fr-dry-run-top-badge {
      display: inline-flex;
      align-items: center;
      margin-left: auto;
      align-self: center;
      padding: 3px 8px;
      border: 1px solid rgba(250, 204, 21, 0.6);
      border-radius: 999px;
      background: rgba(234, 179, 8, 0.2);
      color: #facc15;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: .03em;
      white-space: nowrap;
      user-select: none;
      animation: fr-dryrun-glow 2s ease-in-out infinite alternate;
    }
    @keyframes fr-dryrun-glow {
      from { box-shadow: 0 0 4px rgba(250, 204, 21, 0.3); }
      to { box-shadow: 0 0 10px rgba(250, 204, 21, 0.65); }
    }

    #${P.id} .fr-counter { display: flex; align-items: center; gap: 12px; }
    #${P.id} .fr-counter button {
      width: 27px; height: 27px; padding: 0; border: 1px solid rgba(255,255,255,.22);
      border-radius: 6px; color: #e8f4f6; background: rgba(255,255,255,.08); font-size: 18px; cursor: pointer;
      transition: background .16s ease, transform .16s ease; user-select: none;
    }
    #${P.id} .fr-counter button:active { transform: scale(.92); background: rgba(0,229,255,.2); }
    #${P.id} .fr-counter-value { min-width: 22px; text-align: center; color: #00e5ff; font-size: 15px; font-weight: 700; }
    #${P.id} .fr-counter-compact { gap: 4px; width: 100%; }
    #${P.id} .fr-counter-compact button { flex: 0 0 24px; width: 24px; height: 28px; font-size: 15px; }
    #${P.id} .fr-counter-compact .fr-counter-input { flex: 1 1 auto; min-width: 0; text-align: center; }
    #${P.id} .fr-counter-editable { gap: 6px; width: 100%; }
    #${P.id} .fr-counter-editable button { flex: 0 0 28px; width: 28px; height: 30px; font-size: 16px; }
    #${P.id} .fr-counter-editable .fr-counter-input { flex: 1 1 auto; min-width: 0; text-align: center; }

    #${P.id} .speed-tier-top-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-left: 6px;
      align-self: center;
      padding: 3px 8px;
      border: 1px solid rgba(255,255,255,.15);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      user-select: none;
      transition: all .2s ease;
    }
    #${P.id} .speed-tier-badge-dot { font-size: 9px; line-height: 1; }
    #${P.id} .speed-tier-badge-name { font-weight: 700; }
    #${P.id} .speed-tier-badge-sec { color: #e8f4f6; font-variant-numeric: tabular-nums; opacity: .9; }

    #${P.id} .fr-balance-top-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 6px;
      align-self: center;
      padding: 3px 8px;
      border: 1px solid rgba(0, 229, 255, 0.3);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      color: #00e5ff;
      white-space: nowrap;
      user-select: none;
      background: rgba(0, 229, 255, 0.08);
      font-variant-numeric: tabular-nums;
      transition: all .2s ease;
    }
    #${P.id} .fr-balance-top-badge.is-unknown {
      border-color: rgba(245, 158, 11, 0.4);
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
    }

    /* Arama Hızı 4 Kademeli Kart Grubu */
    #${P.id} .speed-tier-setting-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #${P.id} .speed-tier-active-summary {
      font-size: 11px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    #${P.id} .speed-tier-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
    }
    @container (max-width: 380px) {
      #${P.id} .speed-tier-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 480px) {
      #${P.id} .speed-tier-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    #${P.id} .speed-tier-card {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 5px;
      padding: 7px 6px 6px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 6px;
      background: rgba(4,12,22,.55);
      cursor: pointer;
      user-select: none;
      opacity: 0.55;
      transition: opacity .2s ease, border-color .2s ease, box-shadow .2s ease, transform .12s ease;
      box-sizing: border-box;
      outline: none;
    }
    #${P.id} .speed-tier-card:hover {
      opacity: 0.8;
      border-color: rgba(255,255,255,.25);
    }
    #${P.id} .speed-tier-card.is-active {
      opacity: 1;
      border-color: var(--tier-color);
      box-shadow: 0 0 10px var(--tier-color), inset 0 0 8px rgba(0,0,0,.4);
      background: rgba(4,12,22,.85);
    }
    #${P.id} .speed-tier-top-stripe {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      border-top-left-radius: 5px;
      border-top-right-radius: 5px;
      background: var(--tier-color);
    }
    #${P.id} .speed-tier-card-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 2px;
    }
    #${P.id} .speed-tier-name-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2px;
    }
    #${P.id} .speed-tier-name {
      color: var(--tier-color);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${P.id} .speed-tier-warn-icon {
      font-size: 11px;
      color: #ef4444;
      font-weight: 900;
    }
    #${P.id} .speed-tier-reset-btn {
      width: 16px;
      height: 16px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #8da2ae;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      border-radius: 3px;
      transition: color .15s ease, background .15s ease;
    }
    #${P.id} .speed-tier-reset-btn:hover {
      color: #fff;
      background: rgba(255,255,255,.12);
    }
    #${P.id} .speed-tier-default-hint {
      color: #8da2ae;
      font-size: 9.5px;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    #${P.id} .speed-tier-risk-note {
      color: #ef4444;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.1;
      margin-top: 1px;
    }
    #${P.id} .speed-tier-counter {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2px;
      margin-top: 4px;
      width: 100%;
      box-sizing: border-box;
    }
    #${P.id} .speed-tier-step-btn {
      flex: 0 0 20px;
      width: 20px;
      height: 22px;
      padding: 0;
      border: 1px solid var(--tier-color);
      border-radius: 4px;
      background: rgba(0,0,0,.35);
      color: var(--tier-color);
      font-size: 14px;
      font-weight: 800;
      line-height: 1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background .15s ease, opacity .15s ease, transform .1s ease;
    }
    #${P.id} .speed-tier-step-btn:hover:not(:disabled) {
      background: var(--tier-color);
      color: #040c16;
    }
    #${P.id} .speed-tier-step-btn:active:not(:disabled) {
      transform: scale(.92);
    }
    #${P.id} .speed-tier-step-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      border-color: rgba(255,255,255,.15);
      color: rgba(255,255,255,.3);
    }
    #${P.id} .speed-tier-value {
      flex: 1 1 auto;
      text-align: center;
      color: var(--tier-color);
      font-size: 12px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      min-width: 0;
    }

    #${P.id} .fr-setting-input {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 9px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 6px;
      background: rgba(0,0,0,.25);
      color: #00e5ff;
      font-family: inherit;
      font-size: 13px;
      outline: none;
      transition: border-color .18s ease, box-shadow .18s ease;
      font-variant-numeric: tabular-nums;
      appearance: textfield;
      -moz-appearance: textfield;
    }
    #${P.id} .fr-setting-input::-webkit-inner-spin-button,
    #${P.id} .fr-setting-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    #${P.id} .fr-setting-input:focus {
      border-color: #00e5ff;
      box-shadow: 0 0 6px rgba(0,229,255,.3);
    }
    #${P.id} .fr-setting-input::placeholder {
      color: rgba(255,255,255,.3);
    }

    #${P.id} .fr-range-dual {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 5px;
    }

    #${P.id} .fr-dual-field {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 11px;
      color: #9cb3be;
    }
    #${P.id} .fr-dual-field span {
      font-weight: 500;
    }

    #${P.id} .fr-start {
      position: relative; isolation: isolate; overflow: hidden;
      display: flex; align-items: center; justify-content: center; gap: 9px;
      width: 100%; min-height: 38px; margin-top: auto; padding: 8px 12px;
      border: 1px solid rgba(62,168,255,.72); border-radius: 8px; color: #eafcff;
      background: linear-gradient(100deg, #1b6ef3, #0aa5ff);
      font: inherit; font-size: 13px; font-weight: 700; letter-spacing: .03em; cursor: pointer;
      transition: border-color .25s ease, box-shadow .2s ease, transform .12s ease;
    }

    #${P.id} .fr-start::before {
      position: absolute; z-index: -1; inset: 0; content: '';
      background: linear-gradient(100deg, #ff5261, #c9283a); opacity: 0;
      transition: opacity .25s ease;
    }
    #${P.id} .fr-start:hover[data-state="idle"] { box-shadow: 0 0 14px rgba(62,168,255,.38); }
    #${P.id} .fr-start[data-state="running"] { border-color: rgba(255,82,97,.8); animation: fr-start-pulse 2.4s ease-in-out infinite; }
    #${P.id} .fr-start[data-state="running"]::before { opacity: 1; }
    #${P.id} .fr-start:active { transform: scale(.98); }
    #${P.id} .fr-start-icon { width: 18px; height: 22px; flex: 0 0 auto; }
    #${P.id} .fr-start-icon-running { display: none; width: 18px; height: 18px; }
    #${P.id} .fr-start[data-state="running"] .fr-start-icon-idle { display: none; }
    #${P.id} .fr-start[data-state="running"] .fr-start-icon-running { display: block; }
    #${P.id} .fr-start-label { display: grid; }
    #${P.id} .fr-start-label > span { grid-area: 1 / 1; transition: opacity .12s ease; }
    #${P.id} .fr-start-label-running { opacity: 0; }
    #${P.id} .fr-start[data-state="running"] .fr-start-label-idle { opacity: 0; }
    #${P.id} .fr-start[data-state="running"] .fr-start-label-running { opacity: 1; }
    @keyframes fr-start-pulse {
      0%, 100% { box-shadow: 0 0 5px rgba(255,82,97,.28), 0 0 12px rgba(201,40,58,.15); }
      50% { box-shadow: 0 0 13px rgba(255,82,97,.58), 0 0 24px rgba(201,40,58,.32); }
    }

    /* Özet Çubuğu (Bölüm 3.4) */
    #${P.id} .fr-target-summary-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 10px; border-radius: 6px;
      background: rgba(0, 229, 255, 0.06); border: 1px solid rgba(0, 229, 255, 0.2);
      font-size: 11px; font-weight: 600; color: #c8d7df;
    }
    #${P.id} .fr-summary-item { display: inline-flex; align-items: center; gap: 4px; }
    #${P.id} .fr-summary-val { font-weight: 700; color: #00e5ff; font-variant-numeric: tabular-nums; }
    #${P.id} .fr-summary-profit { color: #51d88a; }

    /* Arama Çubuğu */
    #${P.id} .fr-target-search-box {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 4px;
      z-index: 60;
    }
    #${P.id} .fr-target-search-row { display: flex; gap: 6px; align-items: center; }
    #${P.id} .fr-target-search-input {
      flex: 1; height: 32px; padding: 0 10px;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
      background: rgba(0,0,0,0.3); color: #fff; font-size: 12px;
      outline: none; transition: border-color 0.15s ease;
    }
    #${P.id} .fr-target-search-input:focus { border-color: #00e5ff; }
    #${P.id} .fr-target-update-prices-btn {
      height: 32px; padding: 0 10px; border: 1px solid rgba(0,229,255,0.4);
      border-radius: 6px; background: rgba(0,229,255,0.12); color: #00e5ff;
      font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap;
      transition: all 0.15s ease;
    }
    #${P.id} .fr-target-update-prices-btn:hover { background: rgba(0,229,255,0.22); }
    #${P.id} .fr-target-update-prices-btn.is-updating { opacity: 0.6; pointer-events: none; }

    /* Arama Sonuçları */
    #${P.id} .fr-target-search-results {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 100;
      max-height: 220px;
      overflow-y: auto;
      background: rgba(6, 18, 30, 0.98);
      border: 1px solid rgba(0, 229, 255, 0.4);
      border-radius: 6px;
      padding: 4px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 229, 255, .3) transparent;
      scrollbar-gutter: stable;
    }
    #${P.id} .fr-search-result-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 8px; border-radius: 4px; cursor: pointer; color: #fff; font-size: 12px;
    }
    #${P.id} .fr-search-result-item:hover { background: rgba(0,229,255,0.15); }
    #${P.id} .fr-search-player-rating-badge {
      font-size: 11px; font-weight: 800; color: #ffd447;
      background: rgba(255,212,71,0.15); padding: 1px 6px; border-radius: 4px;
    }

    /* Aday Listesi (Bölüm 2.3) */
    #${P.id} .fr-candidate-selector {
      position: absolute; top: 38px; left: 4px; right: 4px; bottom: 44px; z-index: 50;
      padding: 10px; border: 1px solid #00e5ff; border-radius: 8px;
      background: rgba(6, 18, 30, 0.98); backdrop-filter: blur(8px);
      box-shadow: 0 8px 32px rgba(0,0,0,.85); display: flex; flex-direction: column;
    }
    #${P.id} .fr-candidate-header {
      display: flex; align-items: center; justify-content: space-between;
      color: #00e5ff; font-size: 12px; font-weight: 700; margin-bottom: 6px; flex: 0 0 auto;
    }
    #${P.id} .fr-candidate-cancel {
      border: 0; background: transparent; color: #ff5261;
      font-size: 18px; font-weight: 700; cursor: pointer; padding: 0 4px;
    }
    #${P.id} .fr-candidate-list {
      display: flex; flex-direction: column; gap: 6px; flex: 1 1 auto;
      min-height: 0; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: rgba(0,229,255,.3) transparent;
      scrollbar-gutter: stable;
    }
    #${P.id} .fr-candidate-card {
      padding: 6px 8px; border: 1px solid rgba(255,255,255,.12);
      border-radius: 6px; background: rgba(4,12,22,.6);
      display: flex; align-items: center; gap: 10px;
    }
    #${P.id} .fr-candidate-body { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 4px; }
    #${P.id} .fr-candidate-title { display: flex; align-items: center; justify-content: space-between; }
    #${P.id} .fr-candidate-name { color: #ffd447; font-size: 12px; font-weight: 700; }
    #${P.id} .fr-candidate-rating { color: #fff; font-size: 11px; font-weight: 700; background: rgba(255,255,255,.1); padding: 1px 4px; border-radius: 4px; }
    #${P.id} .fr-candidate-badge {
      display: inline-flex; align-self: flex-start; width: fit-content;
      padding: 1px 6px; border-radius: 4px; color: #00e5ff; font-size: 11px; font-weight: 600;
      background: rgba(0,229,255,.15);
    }
    #${P.id} .fr-candidate-badge-holo {
      background: linear-gradient(90deg, rgba(0,229,255,.25), rgba(255,100,200,.25));
      border: 1px solid rgba(0,229,255,.5);
      color: #00e5ff;
      text-shadow: 0 0 4px rgba(0,229,255,.6);
    }
    #${P.id} .fr-candidate-meta { color: #8da2ae; font-size: 11px; font-variant-numeric: tabular-nums; }
    #${P.id} .fr-candidate-price { color: #8de8b5; font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
    #${P.id} .fr-candidate-btn {
      margin-top: 4px; padding: 4px 8px; border: 1px solid rgba(0,229,255,.5);
      border-radius: 5px; color: #040c16; background: #00e5ff;
      font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; transition: filter .15s ease;
    }
    #${P.id} .fr-candidate-btn:hover { filter: brightness(1.15); }
    #${P.id} .fr-candidate-btn:active { transform: scale(.98); }

    /* ==============================================================
       OTANTİK EA KART BİLEŞENİ (.fr-ea-card) - BÖLÜM 1.3
       ============================================================== */
    #${P.id} .fr-ea-card {
      position: relative; user-select: none; display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start; border-radius: 6px; overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,.5); flex-shrink: 0; background: rgba(0,0,0,.25);
      container-type: inline-size; width: 105px !important; height: 152.7px !important; flex: 0 0 105px !important;
      font-family: var(--card-font);
    }
    #${P.id} .fr-ea-card-preview {
      --card-w: 105px;
      --card-h: 152.7px;
    }
    #${P.id} .fr-ea-card-thumb {
      --card-w: 70px;
      --card-h: 101.8px;
    }

    #${P.id} .fr-ea-card.is-skeleton {
      animation: fr-card-skeleton 1.5s ease-in-out infinite alternate;
    }
    @keyframes fr-card-skeleton {
      from { filter: brightness(0.7); opacity: 0.6; }
      to { filter: brightness(1.2); opacity: 0.9; }
    }

    #${P.id} .fr-ea-card-bg {
      position: absolute; inset: 0; background-size: 100% 100%; background-position: center; background-repeat: no-repeat; z-index: 1; opacity: 1;
    }

    /* 1. Sol Üst: Reyting & Mevki */
    #${P.id} .fr-ea-card .fr-ea-card-top-left {
      position: absolute; top: 23% !important; left: 12% !important;
      display: flex; flex-direction: column; align-items: center; z-index: 4; line-height: 0.95; pointer-events: none;
    }
    #${P.id} .fr-ea-card .fr-ea-card-rating {
      position: static !important; top: auto !important; left: auto !important;
      font-size: 15cqw !important; line-height: 0.95; font-weight: 900; color: #000 !important; text-shadow: none; letter-spacing: -0.3px;
    }
    #${P.id} .fr-ea-card .fr-ea-card-pos {
      position: static !important; top: auto !important; left: auto !important;
      font-size: 7.5cqw !important; font-weight: 800; color: #000 !important; text-shadow: none; margin-top: 1px;
    }

    /* 2. Oyuncu Portresi */
    #${P.id} .fr-ea-card .fr-ea-card-player-img {
      position: absolute; top: 26% !important; right: 19% !important;
      width: 58.5% !important; height: 58% !important; object-fit: contain; object-position: center top !important;
      transform: translateY(-10%) scale(1.07) !important;
      transform-origin: center top !important;
      z-index: 2; pointer-events: none; filter: drop-shadow(0 2px 4px rgba(0,0,0,.6));
      border-radius: 0; background: transparent; margin: 0; flex: none;
    }

    /* 3. İsim Şeridi */
    #${P.id} .fr-ea-card .fr-ea-card-name-plate {
      position: absolute; top: 62.5% !important; left: 10%; right: 10%; height: 9.5%; z-index: 3;
      display: flex; align-items: center; justify-content: center; pointer-events: none;
      background: none;
      border-radius: 2px;
    }
    #${P.id} .fr-ea-card .fr-ea-card-name {
      font-size: 8.5cqw !important; font-weight: 100 !important; text-transform: uppercase; color: #000;
      font-family: var(--card-name-font, var(--card-font));
      text-shadow: none; letter-spacing: -0.2px; padding: 0 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
    }

    /* 4. 6 İstatistik Strip (Tek Satır 6 Sütun) */
    #${P.id} .fr-ea-card .fr-ea-card-stats-grid {
      position: absolute; top: 69% !important; left: 14.5% !important; right: 14.5% !important; height: 13.5%;
      display: grid; grid-template-columns: repeat(6, 1fr); align-items: center;
      justify-items: center; column-gap: 1px; z-index: 3; pointer-events: none;
      background: none;
      border-radius: 2px;
    }
    #${P.id} .fr-ea-stat-item {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      line-height: 1; min-width: 0;
    }
    #${P.id} .fr-ea-card .fr-ea-stat-lbl {
      display: var(--card-stat-lbl-display, flex);
      font-size: 6.5cqw !important; font-weight: 100 !important; letter-spacing: -0.3px; color: #000; line-height: 1;
      font-family: var(--card-stat-font, var(--card-font));
      text-shadow: none;
    }
    #${P.id} .fr-ea-card .fr-ea-stat-val {
      font-size: 6.5cqw !important; font-weight: 100 !important; color: #000; line-height: 1.05;
      font-family: var(--card-stat-font, var(--card-font));
      text-shadow: none; font-variant-numeric: tabular-nums;
    }
    #${P.id} .fr-ea-card.is-dark-card .fr-ea-card-rating,
    #${P.id} .fr-ea-card.is-dark-card .fr-ea-card-pos,
    #${P.id} .fr-ea-card.is-dark-card .fr-ea-card-name,
    #${P.id} .fr-ea-card.is-dark-card .fr-ea-stat-lbl,
    #${P.id} .fr-ea-card.is-dark-card .fr-ea-stat-val {
      color: #d9a900 !important;
    }
    #${P.id} .fr-ea-card.fr-ea-card-holo .fr-ea-card-rating,
    #${P.id} .fr-ea-card.fr-ea-card-holo .fr-ea-card-pos {
      color: #fff !important;
    }
    @container (max-width: 75px) {
      #${P.id} .fr-ea-stat-lbl { display: none; }
      #${P.id} .fr-ea-stat-val { font-size: 8.5cqw; }
    }

    /* 5. Alt Armalar (Ülke, Lig, Kulüp) */
    #${P.id} .fr-ea-card .fr-ea-card-bottom-crests {
      position: absolute; top: 81% !important; bottom: auto; height: 9.5%; left: 17.5% !important; right: 17.5% !important;
      display: flex; align-items: center; justify-content: center; gap: 8.5cqw !important;
      z-index: 3; pointer-events: none;
    }
    #${P.id} .fr-ea-crest {
      max-width: none; max-height: none; object-fit: contain;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,.7));
    }
    #${P.id} .fr-ea-card .fr-ea-crest-nation { width: 11cqw !important; height: -11cqw !important; }
    #${P.id} .fr-ea-card .fr-ea-crest-league { width: 11cqw !important; height: 11cqw !important; }
    #${P.id} .fr-ea-card .fr-ea-crest-club { width: 13cqw !important; height: 11.5cqw !important; }

    /* 6. PlayStyle+ Simgeleri (B4) */
    #${P.id} .fr-ea-card .fr-ea-card-playstyles,
    .fr-ea-card .fr-ea-card-playstyles {
      position: absolute !important;
      top: 45.5% !important;
      left: 12.5% !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 2cqw !important;
      z-index: 4 !important;
      pointer-events: none !important;
    }
    #${P.id} .fr-ea-card .fr-ea-ps,
    .fr-ea-card .fr-ea-ps {
      position: relative !important;
      box-sizing: border-box !important;
      width: 11cqw !important;
      height: 11cqw !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: radial-gradient(circle at 30% 30%, #fff2b0, #d9a900 70%) !important;
      border: 1px solid #fff6c2 !important;
      box-shadow: 0 1px 2px rgba(0,0,0,.7) !important;
      pointer-events: auto !important;
    }
    #${P.id} .fr-ea-card .fr-ea-ps img,
    .fr-ea-card .fr-ea-ps img {
      width: 150% !important;
      height: 150% !important;
      object-fit: contain !important;
    }
    #${P.id} .fr-ea-card .fr-ea-ps::after,
    .fr-ea-card .fr-ea-ps::after {
      content: '+' !important;
      position: absolute !important;
      top: -88% !important;
      right: -25% !important;
      width: 0% !important;
      height: 0% !important;
      border-radius: 50% !important;
      background: #00e5ff !important;
      color: #001018 !important;
      font-size: 0cqw !important;
      font-weight: 900 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 1 !important;
    }

    #${P.id} .fr-ea-card.fr-ea-card-holo {
      box-shadow: 0 0 12px rgba(160, 32, 240, 0.45), 0 0 22px rgba(0, 229, 255, 0.35), inset 0 0 10px rgba(255, 255, 255, 0.25);
      border: 1px solid rgba(200, 160, 255, 0.65);
    }

    #${P.id} .fr-card-holo-shimmer {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
      border-radius: inherit;
      background: linear-gradient(
        125deg,
        transparent 15%,
        rgba(255, 255, 255, 0.55) 35%,
        rgba(255, 0, 180, 0.35) 45%,
        rgba(0, 229, 255, 0.55) 55%,
        rgba(255, 255, 255, 0.3) 65%,
        transparent 85%
      );
      background-size: 300% 300%;
      mix-blend-mode: overlay;
      animation: fr-holo-shine 11.5s ease-in-out infinite;
      opacity: 0.85;
    }
    #${P.id} .fr-card-holo-webp {
      position: absolute;
      inset: 0;
      z-index: 2;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
      mix-blend-mode: screen;
      opacity: 0.88;
      filter: saturate(1.25) contrast(1.1);
    }
    @keyframes fr-holo-shine {
      0% {
        background-position: -150% -150%;
      }
      50% {
        background-position: 150% 150%;
      }
      100% {
        background-position: 300% 300%;
      }
    }

    /* ==============================================================
       HEDEF LİSTESİ & KARTLARI
       ============================================================== */
    #${P.id} .fr-target-view {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 100%;
      position: relative;
    }
    #${P.id} .fc-snipe-tab-content[data-active-tab="targets"] {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    #${P.id} .fr-target-status {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 7px 10px;
      margin-bottom: 6px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      background: rgba(10, 25, 40, 0.95);
      border: 1px solid rgba(0, 229, 255, 0.4);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(6px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      animation: fr-status-enter 0.2s ease;
      pointer-events: auto;
    }
    #${P.id} .fr-target-status[hidden] {
      display: none !important;
    }
    #${P.id} .fr-target-status-exiting {
      opacity: 0;
      transform: translateY(-8px);
      pointer-events: none;
    }
    #${P.id} .fr-target-status[data-type="success"] {
      border-color: #51d88a;
      background: rgba(12, 38, 25, 0.95);
      color: #b7f5cf;
    }
    #${P.id} .fr-target-status[data-type="error"] {
      border-color: #ff5261;
      background: rgba(45, 14, 18, 0.95);
      color: #ffb3ba;
    }
    #${P.id} .fr-target-status[data-type="info"] {
      border-color: #00e5ff;
      background: rgba(10, 30, 48, 0.95);
      color: #d0f7ff;
    }
    #${P.id} .fr-target-status[data-type="loading"] {
      border-color: #ffd447;
      background: rgba(40, 32, 10, 0.95);
      color: #fff0b3;
    }
    #${P.id} .fr-target-status-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    }
    #${P.id} .fr-target-status-icon {
      flex: 0 0 14px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
    }
    #${P.id} .fr-target-status-icon[data-type="loading"] {
      border: 2px solid rgba(255,212,71,0.25);
      border-top-color: #ffd447;
      animation: fr-status-spin 0.8s linear infinite;
    }
    #${P.id} .fr-target-status-main {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    #${P.id} .fr-target-status-message {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 auto;
      min-width: 0;
      position: relative;
    }
    #${P.id} .fr-target-status-message.is-overflowing {
      text-overflow: clip;
      overflow: visible;
      animation: fr-status-marquee var(--marquee-duration, 6s) linear infinite alternate;
    }
    @keyframes fr-status-marquee {
      0%, 20% { transform: translateX(0); }
      80%, 100% { transform: translateX(calc(-1 * var(--marquee-overflow, 50px))); }
    }
    #${P.id} .fr-target-progress-label {
      font-size: 10px;
      color: #aebfc8;
      font-variant-numeric: tabular-nums;
      flex: 0 0 auto;
    }
    #${P.id} .fr-target-progress {
      width: 100%;
      height: 3px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 99px;
      overflow: hidden;
    }
    #${P.id} .fr-target-progress-fill {
      height: 100%;
      background: #00e5ff;
      border-radius: inherit;
      transition: width 0.25s ease;
    }
    #${P.id} .fr-target-list {
      display: flex; flex: 1 1 auto; flex-direction: column; gap: 7px;
      min-height: 0; overflow-y: auto; overscroll-behavior: contain;
      padding: 1px 3px 2px 1px; scrollbar-width: none;
    }
    #${P.id} .fr-target-list::-webkit-scrollbar { display: none; }
    #${P.id} .fr-target-empty { margin: auto; color: #90a2ad; font-size: 12px; text-align: center; }

    #${P.id} .fr-target-card {
      display: flex; align-items: stretch; gap: 10px; flex: 0 0 auto;
      padding: 8px 10px; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; background: rgba(4,12,22,.48);
      position: relative; transition: filter 0.2s ease, opacity 0.2s ease;
    }
    #${P.id} .fr-target-card.is-search-inactive {
      opacity: 0.65;
    }
    #${P.id} .fr-target-card.is-search-inactive > :not(.fr-target-card-body),
    #${P.id} .fr-target-card.is-search-inactive .fr-target-card-body > :not(.fr-target-card-top),
    #${P.id} .fr-target-card.is-search-inactive .fr-target-top-right {
      filter: grayscale(0.9) brightness(0.8);
      opacity: 0.7;
    }
    #${P.id} .fr-target-card.is-search-inactive.is-price-exceeded {
      opacity: 0.85;
    }
    #${P.id} .fr-target-card.is-search-inactive.is-price-exceeded > :not(.fr-target-card-body),
    #${P.id} .fr-target-card.is-search-inactive.is-price-exceeded .fr-target-card-body > :not(.fr-target-card-top),
    #${P.id} .fr-target-card.is-search-inactive.is-price-exceeded .fr-target-top-right {
      filter: none;
      opacity: 1;
    }
    #${P.id} .fr-target-card.is-insufficient-balance {
      border-color: rgba(245, 158, 11, 0.45);
      background: rgba(245, 158, 11, 0.05);
    }
    #${P.id} .fr-target-card.is-price-exceeded {
      border-color: rgba(239, 68, 68, 0.8) !important;
      background: rgba(239, 68, 68, 0.1) !important;
      animation: fr-price-exceeded-glow 1.5s ease-in-out infinite alternate !important;
    }
    #${P.id} .fr-target-card.is-price-exceeded .fr-target-counter-input[aria-label="SATIN AL değeri"] {
      border-color: #ef4444 !important;
      color: #ef4444 !important;
      background: rgba(239, 68, 68, 0.15) !important;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.6) !important;
      animation: fr-input-error-pulse 1.5s ease-in-out infinite alternate !important;
    }
    @keyframes fr-price-exceeded-glow {
      from { box-shadow: 0 0 4px rgba(239, 68, 68, 0.35); }
      to { box-shadow: 0 0 16px rgba(239, 68, 68, 0.85); }
    }
    @keyframes fr-input-error-pulse {
      from { box-shadow: 0 0 2px rgba(239, 68, 68, 0.4); }
      to { box-shadow: 0 0 10px rgba(239, 68, 68, 0.9); }
    }
    #${P.id} .fr-target-badge-insufficient {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 5px;
      border: 1px solid rgba(245, 158, 11, 0.7);
      border-radius: 4px;
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .02em;
      white-space: nowrap;
      user-select: none;
      animation: fr-insufficient-glow 1.8s ease-in-out infinite alternate;
    }
    @keyframes fr-insufficient-glow {
      from { box-shadow: 0 0 2px rgba(245, 158, 11, 0.25); }
      to { box-shadow: 0 0 8px rgba(245, 158, 11, 0.6); }
    }
    #${P.id} .fr-target-card-body {
      display: flex; flex-direction: column; justify-content: space-between; flex: 1; min-width: 0; gap: 6px;
    }
    #${P.id} .fr-target-card-top {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
    }
    #${P.id} .fr-target-top-left {
      display: inline-flex; align-items: center; gap: 5px; min-width: 0; flex-wrap: nowrap;
    }
    #${P.id} .fr-escalation-top-group {
      display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
    }
    #${P.id} .fr-target-top-right {
      display: flex; align-items: center; gap: 8px;
    }
    #${P.id} .fr-target-last-update {
      font-size: 9px; color: #8da2ae; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    #${P.id} .fr-target-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
    #${P.id} .fr-target-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    #${P.id} .fr-target-name { overflow: hidden; color: #ffd447; font-size: 13px; font-weight: 700; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
    #${P.id} .fr-target-meta-line { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
    #${P.id} .fr-target-rating { color: #c8d7df; font-size: 11px; font-weight: 700; }
    #${P.id} .fr-target-version-badge { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; background: rgba(0,229,255,.15); color: #00e5ff; }
    #${P.id} .fr-target-trend-up { color: #52c41a; font-weight: 800; font-size: 10px; line-height: 1; cursor: help; }
    #${P.id} .fr-target-trend-down { color: #ff4d4f; font-weight: 800; font-size: 10px; line-height: 1; cursor: help; }
    #${P.id} .fr-target-trend-same { color: #fadb14; font-size: 9px; line-height: 1; cursor: help; vertical-align: middle; }
    #${P.id} .fr-target-remove {
      flex: 0 0 18px; width: 18px; height: 18px; margin: 0; padding: 0; border: 0;
      color: #ff5261; background: transparent; font: 700 16px/18px Arial,sans-serif; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    #${P.id} .fr-target-remove:hover { color: #ff7582; }

    #${P.id} .fr-target-controls {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: flex-end;
    }
    #${P.id} .fr-target-controls > div {
      display: flex; flex-direction: column; justify-content: flex-end;
    }

    #${P.id} .fr-target-search-toggle {
      display: inline-flex; align-items: center; justify-content: center; gap: 3px;
      margin: 0; padding: 1px 6px; border-radius: 4px;
      font-family: inherit; font-size: 11px; font-weight: 700; cursor: pointer;
      line-height: 1.2; transition: all .15s ease; width: fit-content; user-select: none;
    }
    #${P.id} .fr-target-search-toggle.is-active {
      color: #b0bec5; background: rgba(0,255,136,.1);
      border: 1px solid rgba(0,255,136,.35);
    }
    #${P.id} .fr-target-search-toggle.is-active .fr-search-toggle-status {
      color: #00ff88; font-weight: 800;
    }
    #${P.id} .fr-target-search-toggle.is-active:hover {
      background: rgba(0,255,136,.18);
    }
    #${P.id} .fr-target-search-toggle.is-inactive {
      color: #ffb4bc;
      background: rgba(239, 68, 68, 0.22);
      border: 1px solid rgba(239, 68, 68, 0.75);
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
      filter: grayscale(0) !important;
    }
    #${P.id} .fr-target-search-toggle.is-inactive .fr-search-toggle-status {
      color: #ff3b4e;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(255, 59, 78, 0.6);
      filter: grayscale(0) !important;
    }
    #${P.id} .fr-target-search-toggle.is-inactive:hover {
      background: rgba(239, 68, 68, 0.32);
      border-color: #ff3b4e;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
    }

    #${P.id} .fr-target-profit {
      font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
      margin-bottom: 2px; line-height: 1.2; text-align: center; white-space: nowrap;
    }
    #${P.id} .fr-target-profit.is-profit { color: #51d88a; }
    #${P.id} .fr-target-profit.is-loss { color: #ff5261; }

    #${P.id} .fr-target-control-title {
      margin-bottom: 3px; color: #aebfc8; font-size: 11px; font-weight: 700;
      letter-spacing: .04em; text-align: center; text-transform: uppercase;
    }
    #${P.id} .fr-target-counter { display: flex; align-items: center; justify-content: center; gap: 5px; }
    #${P.id} .fr-target-counter-editable { gap: 5px; }
    #${P.id} .fr-target-counter button {
      flex: 0 0 22px; width: 22px; height: 22px; padding: 0; border: 1px solid rgba(255,255,255,.2);
      border-radius: 5px; color: #e8f4f6; background: rgba(255,255,255,.08);
      font-size: 14px; line-height: 1; cursor: pointer; user-select: none;
    }
    #${P.id} .fr-target-counter button:active { background: rgba(0,229,255,.2); }
    #${P.id} .fr-target-counter-input {
      box-sizing: border-box; flex: 1 1 auto; width: 100%; max-width: 9ch; min-width: 44px; height: 22px;
      padding: 2px 3px; border: 1px solid rgba(255,255,255,.16); border-radius: 4px;
      color: #00e5ff; background: rgba(255,255,255,.05); font: inherit; font-size: 12px;
      font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; appearance: textfield;
    }
    #${P.id} .fr-target-counter-input::-webkit-inner-spin-button,
    #${P.id} .fr-target-counter-input::-webkit-outer-spin-button { margin: 0; appearance: none; }
    #${P.id} .fr-target-counter-input:focus { outline: 1px solid rgba(0,229,255,.7); }

    #${P.id} .fr-target-card-bottom {
      display: flex; justify-content: flex-end; width: 100%; margin-top: 2px;
    }
    #${P.id} .fr-target-futbin-price {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; font-weight: 600; color: #8da2ae; font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    #${P.id} .fr-target-futbin-icon {
      width: 12px; height: 12px; display: inline-block; vertical-align: middle; border-radius: 2px; flex-shrink: 0;
    }

    /* Otomatik Fiyat Arttırma (Escalation) Bileşeni */
    #${P.id} .fr-target-effective-lbl {
      font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums;
      margin-bottom: 2px; line-height: 1.2; text-align: center; white-space: nowrap;
      height: 14px; color: #00e5ff; overflow: hidden; text-overflow: ellipsis;
    }
    #${P.id} .fr-target-bottom-left {
      display: inline-flex; align-items: center; gap: 4px; min-width: 0; flex: 1; overflow: hidden;
    }
    #${P.id} .fr-escalation-toggle-btn {
      display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 1px; padding: 1px 6px; border-radius: 4px;
      font-family: inherit; font-size: 11px; font-weight: 700;
      cursor: pointer; line-height: 1.15; user-select: none;
      white-space: nowrap; flex-shrink: 0; transition: all 0.15s ease;
    }
    #${P.id} .fr-escalation-btn-label {
      display: inline-flex; align-items: center; gap: 2px; font-size: 11px;
    }
    #${P.id} .fr-escalation-active-sec {
      font-size: 9px; font-weight: 700; opacity: 0.85; line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    #${P.id} .fr-escalation-toggle-btn.is-active {
      color: #b0bec5; background: rgba(0, 229, 255, 0.12); border: 1px solid rgba(0, 229, 255, 0.45);
    }
    #${P.id} .fr-escalation-toggle-btn.is-active .fr-escalation-toggle-status {
      color: #00e5ff; font-weight: 800;
    }
    #${P.id} .fr-escalation-toggle-btn.is-inactive {
      color: #8da2ae; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.18);
    }
    #${P.id} .fr-escalation-toggle-btn.is-inactive .fr-escalation-toggle-status {
      color: #8da2ae; font-weight: 700;
    }
    #${P.id} .fr-escalation-gear-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 19px; height: 19px; padding: 0; border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 4px; background: rgba(255, 255, 255, 0.06); color: #c8d7df;
      font-size: 11px; cursor: pointer; flex-shrink: 0; transition: all 0.15s ease;
    }
    #${P.id} .fr-escalation-gear-btn:hover {
      background: rgba(0, 229, 255, 0.2); border-color: #00e5ff; color: #fff;
    }
    #${P.id} .fr-escalation-badges-wrap {
      display: inline-flex; align-items: center; gap: 3px; overflow: hidden;
    }
    #${P.id} .fr-escalation-badge {
      display: inline-flex; align-items: center; padding: 1px 4px; border-radius: 3px;
      font-size: 9px; font-weight: 800; letter-spacing: 0.02em; white-space: nowrap; user-select: none;
    }
    #${P.id} .fr-escalation-badge-step {
      color: #00e5ff; background: rgba(0, 229, 255, 0.15); border: 1px solid rgba(0, 229, 255, 0.45);
    }
    #${P.id} .fr-escalation-badge-ceiling {
      color: #ff5261; background: rgba(255, 82, 97, 0.22); border: 1px solid rgba(255, 82, 97, 0.65);
      animation: fr-ceiling-pulse 1.8s ease-in-out infinite alternate;
    }
    @keyframes fr-ceiling-pulse {
      from { box-shadow: 0 0 2px rgba(255, 82, 97, 0.3); }
      to { box-shadow: 0 0 8px rgba(255, 82, 97, 0.7); }
    }
    #${P.id} .fr-escalation-badge-loss {
      color: #fbbf24; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.65);
    }
    #${P.id} .fr-escalation-popover {
      position: absolute; bottom: 25px; left: 6px; right: 6px; z-index: 100;
      display: flex; flex-direction: column; gap: 6px; padding: 8px 10px;
      background: rgba(6, 18, 30, 0.98); border: 1px solid rgba(0, 229, 255, 0.55);
      border-radius: 6px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(8px); animation: fr-popover-in 0.15s ease;
    }
    #${P.id} .fr-escalation-popover[hidden] {
      display: none !important;
    }
    @keyframes fr-popover-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #${P.id} .fr-escalation-popover-head {
      display: flex; align-items: center; justify-content: space-between;
      color: #00e5ff; font-size: 11px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 4px;
    }
    #${P.id} .fr-escalation-popover-close {
      border: 0; background: transparent; color: #ff5261; font-size: 15px; font-weight: 700;
      cursor: pointer; padding: 0 2px; line-height: 1;
    }
    #${P.id} .fr-escalation-popover-close:hover { color: #ff7582; }
    #${P.id} .fr-escalation-preview {
      font-size: 10.5px; font-weight: 700; color: #00e5ff; font-variant-numeric: tabular-nums;
    }
    #${P.id} .fr-escalation-inputs-row {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    #${P.id} .fr-escalation-field {
      display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: #aebfc8;
    }
    #${P.id} .fr-escalation-field-label { font-weight: 600; white-space: nowrap; }

    #${P.id} .fr-escalation-stepper {
      display: inline-flex; align-items: center; gap: 2px;
    }
    #${P.id} .fr-escalation-step-btn {
      width: 17px; height: 20px; padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px; background: rgba(255, 255, 255, 0.08);
      color: #e8f4f6; font-size: 13px; font-weight: 700; line-height: 1;
      cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s ease;
    }
    #${P.id} .fr-escalation-step-btn:hover {
      background: rgba(0, 229, 255, 0.25); border-color: #00e5ff; color: #fff;
    }
    #${P.id} .fr-escalation-step-btn:active {
      transform: scale(0.95);
    }
    #${P.id} .fr-escalation-field-input {
      width: 36px; height: 20px; padding: 1px 2px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 3px; background: rgba(255, 255, 255, 0.06);
      color: #fff; font: inherit; font-size: 11px; font-weight: 700;
      text-align: center; font-variant-numeric: tabular-nums; outline: none;
      -webkit-appearance: none; -moz-appearance: textfield; appearance: textfield;
      transition: border-color 0.15s ease;
    }
    #${P.id} .fr-escalation-field-input::-webkit-inner-spin-button,
    #${P.id} .fr-escalation-field-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    #${P.id} .fr-escalation-field-input:focus { border-color: #00e5ff; }
    #${P.id} .fr-escalation-field-input.is-invalid {
      border-color: #ff5261 !important; background: rgba(255, 82, 97, 0.12) !important;
    }
    #${P.id} .fr-escalation-inline-error {
      color: #ff5261; font-size: 9.5px; font-weight: 600; line-height: 1.2;
    }

    /* Alt Eylemler */
    #${P.id} .fr-target-actions { display: flex; flex: 0 0 auto; gap: 8px; margin-top: auto; padding-top: 6px; }
    #${P.id} .fr-target-action {
      flex: 1; min-height: 34px; border: 1px solid transparent; border-radius: 7px;
      color: #fff; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
      transition: filter .18s ease, transform .18s ease;
    }
    #${P.id} .fr-target-action:hover { filter: brightness(1.15); }
    #${P.id} .fr-target-action:active { transform: scale(.97); }
    #${P.id} .fr-target-save { background: linear-gradient(135deg, #0879dc, #13b5f4); border-color: rgba(115,214,255,.6); }
    #${P.id} .fr-target-load { background: linear-gradient(135deg, #bd2537, #f04452); border-color: rgba(255,150,155,.6); }

    /* Undo Toast Bildirimi (Bölüm 3.7) */
    .fr-undo-toast {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: #14264a; color: #fff; padding: 8px 14px; border-radius: 6px;
      border: 1px solid #00e5ff; box-shadow: 0 4px 14px rgba(0,0,0,0.6);
      display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 600;
      z-index: 9999999; animation: fr-toast-in 0.2s ease;
    }
    .fr-undo-btn {
      background: #00e5ff; color: #040c16; border: 0; border-radius: 4px;
      padding: 3px 8px; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    @keyframes fr-toast-in {
      from { opacity: 0; transform: translate(-50%, 10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }

    /* Log Sekmesi ve Log Paneli */
    #${P.id} .fr-logs-view, .fr-bot-logs-panel .fr-logs-view { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; font-size: 11px; }
    .fr-bot-logs-panel .fr-logs-header {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.12); flex: 0 0 auto;
    }
    .fr-bot-logs-panel .fr-logs-header-title {
      font-size: 12px; font-weight: 700; color: #00e5ff; letter-spacing: 0.5px;
    }
    #${P.id} .fr-log-summary, .fr-bot-logs-panel .fr-log-summary { flex: 0 0 auto; color: #aebfc8; font-size: 11px; font-variant-numeric: tabular-nums; }
    #${P.id} .fr-log-toolbar, .fr-bot-logs-panel .fr-log-toolbar { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 6px; }
    #${P.id} .fr-log-filters, .fr-bot-logs-panel .fr-log-filters { display: flex; gap: 4px; }
    #${P.id} .fr-log-filter-btn, .fr-bot-logs-panel .fr-log-filter-btn {
      padding: 3px 6px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
      color: #9bb1bc; background: transparent; font-size: 10px; font-weight: 600; cursor: pointer;
    }
    #${P.id} .fr-log-filter-btn.active, .fr-bot-logs-panel .fr-log-filter-btn.active { color: #00e5ff; border-color: #00e5ff; background: rgba(0,229,255,0.1); }
    #${P.id} .fr-log-actions, .fr-bot-logs-panel .fr-log-actions { display: flex; gap: 4px; }
    #${P.id} .fr-log-btn, .fr-bot-logs-panel .fr-log-btn {
      padding: 3px 6px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
      color: #c8d7df; background: rgba(255,255,255,0.05); font-size: 10px; font-weight: 600; cursor: pointer;
    }
    #${P.id} .fr-log-btn:hover, .fr-bot-logs-panel .fr-log-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    #${P.id} .fr-log-clear, .fr-bot-logs-panel .fr-log-clear {
      padding: 4px 7px; border: 1px solid rgba(255,82,97,.3); border-radius: 99px;
      color: #ff9ca4; background: rgba(255,255,255,.04); font: inherit; font-size: 11px; cursor: pointer;
      transition: background .16s ease, border-color .16s ease, color .16s ease;
    }
    #${P.id} .fr-log-clear:hover, .fr-bot-logs-panel .fr-log-clear:hover { background: rgba(255,82,97,.12); color: #ffb3ba; }
    #${P.id} .fr-log-list, .fr-bot-logs-panel .fr-log-list {
      display: flex; flex: 1 1 auto; flex-direction: column; gap: 5px;
      min-height: 0; overflow-y: auto; overscroll-behavior: contain;
      padding: 1px 3px 2px 1px;
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 229, 255, 0.35) transparent;
      color: #c8d7df; font-size: 11px;
    }
    #${P.id} .fr-log-list::-webkit-scrollbar, .fr-bot-logs-panel .fr-log-list::-webkit-scrollbar {
      width: 1px !important;
      height: 1px !important;
      background: transparent !important;
    }
    #${P.id} .fr-log-list::-webkit-scrollbar-track, .fr-bot-logs-panel .fr-log-list::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.25) !important;
      border-radius: 1px;
    }
    #${P.id} .fr-log-list::-webkit-scrollbar-thumb, .fr-bot-logs-panel .fr-log-list::-webkit-scrollbar-thumb {
      background: rgba(0, 229, 255, 0.35) !important;
      border-radius: 1px;
      transition: background 0.2s ease;
    }
    #${P.id} .fr-log-list::-webkit-scrollbar-thumb:hover, .fr-bot-logs-panel .fr-log-list::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 229, 255, 0.75) !important;
      box-shadow: 0 0 4px rgba(0, 229, 255, 0.8) !important;
    }
    #${P.id} .fr-log-row, .fr-bot-logs-panel .fr-log-row {
      display: grid; grid-template-columns: 52px minmax(0,1fr); align-items: start; gap: 6px;
      padding: 6px 7px; border-left: 2px solid #3ea8ff; border-radius: 0 4px 4px 0;
      color: #bfe4ff; background: rgba(62,168,255,.12); flex: 0 0 auto;
      position: relative;
    }
    #${P.id} .fr-log-time, .fr-bot-logs-panel .fr-log-time { color: inherit; opacity: .86; font-size: 10px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    #${P.id} .fr-log-message, .fr-bot-logs-panel .fr-log-message { min-width: 0; overflow-wrap: anywhere; }
    #${P.id} .fr-log-row[data-tone="success"], .fr-bot-logs-panel .fr-log-row[data-tone="success"] { border-left-color: #51d88a; color: #b7f5cf; background: rgba(81,216,138,.12); }
    #${P.id} .fr-log-row[data-tone="info"], .fr-bot-logs-panel .fr-log-row[data-tone="info"] { border-left-color: #3ea8ff; color: #bfe4ff; background: rgba(62,168,255,.12); }
    #${P.id} .fr-log-row[data-tone="error"], .fr-bot-logs-panel .fr-log-row[data-tone="error"] { border-left-color: #ff5261; color: #ffb3ba; background: rgba(255,82,97,.14); }
    #${P.id} .fr-log-enter, .fr-bot-logs-panel .fr-log-enter { animation: fr-log-enter .2s ease both; }

    /* Parlama (Glow) Animasyonu — Alındı ve BAŞKASI ALDI */
    #${P.id} .log-fx-success, .fr-bot-logs-panel .log-fx-success { --fx: 34,197,94; color: #bbf7d0 !important; }
    #${P.id} .log-fx-lost, .fr-bot-logs-panel .log-fx-lost { --fx: 239,68,68; color: #fecaca !important; }
    #${P.id} .log-fx-success, .fr-bot-logs-panel .log-fx-success,
    #${P.id} .log-fx-lost, .fr-bot-logs-panel .log-fx-lost {
      position: relative; overflow: hidden;
      font-weight: 700;
      letter-spacing: .2px;
      text-shadow: 0 0 8px rgba(var(--fx),.8);
      border-left-color: transparent !important;
      background: linear-gradient(90deg, rgba(var(--fx),.28), rgba(var(--fx),.12)), rgba(62,168,255,.12);
      box-shadow: inset 5px 0 0 rgb(var(--fx)), 0 0 0 1px rgba(var(--fx),.6), 0 0 20px rgba(var(--fx),.45);
    }
    #${P.id} .log-fx-success.log-fx-new, .fr-bot-logs-panel .log-fx-success.log-fx-new {
      animation: logFxBurst 1.8s ease-out, logFxPulse 1.8s ease-in-out 1.8s 4;
    }
    #${P.id} .log-fx-lost.log-fx-new, .fr-bot-logs-panel .log-fx-lost.log-fx-new {
      animation: logFxBurst 1.8s ease-out, logFxShake .5s ease-in-out, logFxPulse 1.8s ease-in-out 1.8s 4;
    }
    #${P.id} .log-fx-new::after, .fr-bot-logs-panel .log-fx-new::after {
      content: ""; position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.45) 50%, transparent 70%);
      transform: translateX(-120%);
      animation: logFxShine 1.1s ease-out .2s 2;
    }
    @keyframes logFxBurst {
      0%   { background-color: rgba(var(--fx),.65); box-shadow: inset 5px 0 0 rgb(var(--fx)), 0 0 0 0 rgba(var(--fx),1), 0 0 0 rgba(var(--fx),0); }
      35%  { box-shadow: inset 5px 0 0 rgb(var(--fx)), 0 0 0 4px rgba(var(--fx),.85), 0 0 42px rgba(var(--fx),.95); }
      100% { box-shadow: inset 5px 0 0 rgb(var(--fx)), 0 0 0 1px rgba(var(--fx),.6), 0 0 20px rgba(var(--fx),.45); }
    }
    @keyframes logFxPulse {
      0%,100% { box-shadow: inset 5px 0 0 rgb(var(--fx)), 0 0 0 1px rgba(var(--fx),.6), 0 0 20px rgba(var(--fx),.45); text-shadow: 0 0 6px rgba(var(--fx),.6); }
      50%     { box-shadow: inset 5px 0 0 rgb(var(--fx)), 0 0 0 2px rgba(var(--fx),.9), 0 0 34px rgba(var(--fx),.8); text-shadow: 0 0 12px rgba(var(--fx),1); }
    }
    @keyframes logFxShake {
      0%,100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-3px); }
      80% { transform: translateX(3px); }
    }
    @keyframes logFxShine { to { transform: translateX(120%); } }

    /* Satır Üzeri Kayan Bekleme Animasyonu */
    #${P.id} .fr-log-row.log-wait-active, .fr-bot-logs-panel .fr-log-row.log-wait-active,
    #${P.id} .log-row.log-wait-active, .fr-bot-logs-panel .log-row.log-wait-active {
      position: relative; overflow: hidden;
    }
    #${P.id} .fr-log-row.log-wait-active > *, .fr-bot-logs-panel .fr-log-row.log-wait-active > *,
    #${P.id} .log-row.log-wait-active > *, .fr-bot-logs-panel .log-row.log-wait-active > * {
      position: relative; z-index: 1; text-shadow: 0 1px 3px rgba(0,0,0,.7);
    }
    #${P.id} .fr-log-row.log-wait-active::before, .fr-bot-logs-panel .fr-log-row.log-wait-active::before,
    #${P.id} .log-row.log-wait-active::before, .fr-bot-logs-panel .log-row.log-wait-active::before {
      content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
      background: linear-gradient(90deg, rgba(var(--tier-rgb,56,189,248),.20) 0%, rgba(var(--tier-rgb,56,189,248),.45) 75%, rgba(var(--tier-rgb,56,189,248),.70) 100%);
      border-right: 3px solid rgba(var(--tier-rgb,56,189,248),1);
      box-shadow: 6px 0 20px rgba(var(--tier-rgb,56,189,248),.85), 0 0 10px rgba(var(--tier-rgb,56,189,248),.5);
      transform: translateX(-100%);
      animation: logWaitSlide var(--wait-ms, 2500ms) linear forwards;
    }
    #${P.id} .fr-log-row.log-wait-fading::before, .fr-bot-logs-panel .fr-log-row.log-wait-fading::before,
    #${P.id} .log-row.log-wait-fading::before, .fr-bot-logs-panel .log-row.log-wait-fading::before {
      opacity: 0;
      transition: opacity 300ms ease;
    }
    @keyframes logWaitSlide {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }
    #${P.id} .log-wait-tag, .fr-bot-logs-panel .log-wait-tag {
      position: absolute; right: 6px; bottom: 1px; z-index: 2;
      font-size: 10px; transform: scale(.5); transform-origin: right bottom;
      line-height: 1; opacity: .75; color: #94a3b8; pointer-events: none; white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      #${P.id} .log-fx-new, .fr-bot-logs-panel .log-fx-new,
      #${P.id} .log-fx-new::after, .fr-bot-logs-panel .log-fx-new::after,
      #${P.id} .log-fx-lost.log-fx-new, .fr-bot-logs-panel .log-fx-lost.log-fx-new {
        animation: none !important;
      }
      #${P.id} .fr-log-row.log-wait-active::before, .fr-bot-logs-panel .fr-log-row.log-wait-active::before,
      #${P.id} .log-row.log-wait-active::before, .fr-bot-logs-panel .log-row.log-wait-active::before {
        animation: none !important;
        transform: translateX(0);
        opacity: .5;
      }
    }

    #${P.id} .fr-waitbar, .fr-bot-logs-panel .fr-waitbar { flex: 0 0 auto; padding: 5px 7px; border: 1px solid rgba(0,229,255,.17); border-radius: 6px; background: rgba(0,229,255,.035); }
    #${P.id} .fr-waitbar[hidden], .fr-bot-logs-panel .fr-waitbar[hidden] { display: none; }
    #${P.id} .fr-waitbar-label, .fr-bot-logs-panel .fr-waitbar-label { margin-bottom: 4px; color: #b7d7dd; font-size: 11px; font-variant-numeric: tabular-nums; }
    #${P.id} .fr-waitbar-track, .fr-bot-logs-panel .fr-waitbar-track { height: 3px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.12); }
    #${P.id} .fr-waitbar-fill, .fr-bot-logs-panel .fr-waitbar-fill {
      width: 100%; height: 100%; border-radius: inherit; background: rgba(0,229,255,.8);
      transform: scaleX(1); transform-origin: left center;
      animation: fr-wait-drain var(--fr-wait-duration) linear forwards;
      animation-delay: var(--fr-wait-delay, 0ms);
    }

    #${P.id} .fr-governor-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 7px 10px; margin: 0 0 8px 0; border-radius: 6px;
      background: rgba(255, 68, 68, 0.18); border: 1px solid rgba(255, 68, 68, 0.6);
      color: #ff6b6b; font-size: 11px; font-weight: 600; line-height: 1.3;
      flex: 0 0 auto; width: 100%; box-sizing: border-box;
    }
    #${P.id} .fr-governor-banner.fr-governor-banner--captcha {
      background: rgba(220, 38, 38, 0.95);
      border: 2px solid #ff2222;
      color: #ffffff;
      padding: 9px 12px;
      box-shadow: 0 0 16px rgba(239, 68, 68, 0.6);
    }
    #${P.id} .fr-governor-banner-msg { flex: 1 1 auto; min-width: 0; word-break: break-word; }
    #${P.id} .fr-governor-resume-btn {
      flex: 0 0 auto; background: #00e5ff; color: #001018; border: none; border-radius: 4px;
      padding: 4px 8px; font-weight: 700; font-size: 11px; cursor: pointer; white-space: nowrap;
    }
    #${P.id} .fr-governor-resume-btn:hover { background: #33ebff; }
    #${P.id} .fr-governor-resume-btn.fr-governor-resume-btn--captcha {
      background: #ffffff;
      color: #b91c1c;
      font-weight: 800;
      font-size: 11px;
      border: 1px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    #${P.id} .fr-governor-resume-btn.fr-governor-resume-btn--captcha:hover {
      background: #fee2e2;
    }

    @keyframes fr-status-spin { to { transform: rotate(360deg); } }
    @keyframes fr-status-enter { from { opacity: 0; transform: translateX(7px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fr-status-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
    @keyframes fr-status-flash { 0% { box-shadow: 0 0 0 rgba(81,216,138,0); } 35% { box-shadow: 0 0 14px rgba(81,216,138,.34); } 100% { box-shadow: 0 0 0 rgba(81,216,138,0); } }
    @keyframes fr-log-enter { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fr-wait-drain { to { transform: scaleX(0); } }

    @media (prefers-reduced-motion: reduce) {
      #${P.id} .fr-card-holo-shimmer,
      #${P.id} .fr-target-status-icon[data-type="loading"],
      #${P.id} .fr-status-success-flash,
      #${P.id} .fr-target-status[data-type="loading"]::after,
      #${P.id} .fr-start[data-state="running"],
      #${P.id} .fr-log-enter,
      #${P.id} .fr-waitbar-fill { animation: none !important; }
      #${P.id} .fr-target-progress-fill,
      #${P.id} .fr-target-status,
      #${P.id} .fr-start,
      #${P.id} .fr-start::before,
      #${P.id} .fr-start-label,
      #${P.id} .fr-start-label > span,
      #${P.id} .fr-log-clear { transition: none !important; }
    }
  `;

export function initPanelCss() {
  const existing = document.getElementById(P.styleId);
  if (existing) return;
  const style = document.createElement('style');
  style.id = P.styleId;
  style.textContent = panelCss;
  document.head.appendChild(style);
}
