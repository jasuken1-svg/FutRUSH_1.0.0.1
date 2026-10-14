// SNIPE panelinin tema ve bilesen stillerini CSS metni olarak tanimlar.
// Bagimlilik: yok.

import { P } from '../../core/config.js';

export const panelCss = `
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
    #${P.id} .fr-target-view { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 7px; }
    #${P.id} .fr-target-status {
      position: relative; flex: 0 0 auto; max-height: 120px; overflow: hidden; padding: 7px 8px 8px;
      border: 1px solid rgba(255,255,255,.1); border-radius: 7px; color: #d9e8ee;
      background: rgba(4,12,22,.42); font-size: 11px; opacity: 1; transform: translateY(0);
      transition: opacity .22s ease, transform .22s ease, max-height .22s ease, padding .22s ease, border-width .22s ease, margin-bottom .22s ease;
    }
    #${P.id} .fr-target-status[hidden] { display: none; }
    #${P.id} .fr-target-status.fr-target-status-exiting {
      max-height: 0; margin-bottom: -7px; padding-top: 0; padding-bottom: 0; border-width: 0;
      opacity: 0; transform: translateY(-4px);
    }
    #${P.id} .fr-target-status-main { display: flex; align-items: center; gap: 7px; min-height: 18px; }
    #${P.id} .fr-target-status-icon {
      display: grid; flex: 0 0 16px; width: 16px; height: 16px; place-items: center;
      border: 1px solid rgba(255,255,255,.3); border-radius: 50%; color: #d9e8ee; font-size: 11px; font-weight: 800;
    }
    #${P.id} .fr-target-status-icon[data-type="loading"] {
      border: 2px solid rgba(255,255,255,.18); border-top-color: rgba(0,229,255,.9);
      animation: fr-status-spin .7s linear infinite;
    }
    #${P.id} .fr-target-status-icon[data-type="success"] { border-color: #51d88a; color: #51d88a; }
    #${P.id} .fr-target-status-icon[data-type="error"] { border-color: #ff5261; color: #ff5261; }
    #${P.id} .fr-target-status-message { flex: 1 1 auto; min-width: 0; color: #d9e8ee; }
    #${P.id} .fr-status-message-enter { animation: fr-status-enter .2s ease both; }
    #${P.id} .fr-target-status[data-type="error"] .fr-target-status-message { color: #ff8790; }
    #${P.id} .fr-target-status[data-type="success"] .fr-target-status-message { color: #8de8b5; }
    #${P.id} .fr-target-status-meta { display: flex; flex: 0 0 auto; align-items: center; gap: 5px; }
    #${P.id} .fr-target-source {
      padding: 2px 5px; border: 1px solid rgba(0,229,255,.35); border-radius: 99px;
      color: #70edff; background: rgba(0,229,255,.08); font-size: 9px; font-weight: 700; white-space: nowrap;
    }
    #${P.id} .fr-target-source[data-source="futbin"] { border-color: rgba(255,179,0,.45); color: #FFB300; background: rgba(255,179,0,.08); }
    #${P.id} .fr-target-source[data-source="mixed"] { border-color: rgba(255,179,0,.4); color: #ffd36b; background: linear-gradient(90deg, rgba(0,229,255,.09), rgba(255,179,0,.1)); }
    #${P.id} .fr-target-progress-label { color: #aebfc8; font-size: 9px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    #${P.id} .fr-target-progress { height: 3px; margin-top: 5px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.12); }
    #${P.id} .fr-target-progress-fill { width: 0; height: 100%; border-radius: inherit; background: #51d88a; transition: width .2s ease; }
    #${P.id} .fr-target-status[data-type="loading"] .fr-target-progress-fill { background: #00e5ff; }
    #${P.id} .fr-target-status[data-type="loading"]::after {
      position: absolute; right: 0; bottom: 0; left: 0; height: 2px; content: '';
      background: linear-gradient(90deg, transparent, rgba(0,229,255,.75), transparent);
      animation: fr-status-shimmer 1.2s linear infinite;
    }
    #${P.id} .fr-status-success-flash { animation: fr-status-flash .55s ease-out; }
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
    #${P.id} .fr-logs-view { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; font-size: 11px; }
    #${P.id} .fr-log-summary { flex: 0 0 auto; color: #aebfc8; font-size: 10px; font-variant-numeric: tabular-nums; }
    #${P.id} .fr-log-toolbar { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 6px; }
    #${P.id} .fr-log-clear {
      padding: 4px 7px; border: 1px solid rgba(255,255,255,.14); border-radius: 99px;
      color: #aebfc8; background: rgba(255,255,255,.04); font: inherit; font-size: 9px; cursor: pointer;
      transition: background .16s ease, border-color .16s ease, color .16s ease;
    }
    #${P.id} .fr-log-clear { border-color: rgba(255,82,97,.3); color: #ff9ca4; }
    #${P.id} .fr-log-list { display: flex; flex: 1 1 auto; flex-direction: column; gap: 5px; min-height: 0; overflow: auto; color: #c8d7df; font-size: 11px; }
    #${P.id} .fr-log-row {
      display: grid; grid-template-columns: 52px minmax(0,1fr); align-items: start; gap: 6px;
      padding: 6px 7px; border-left: 2px solid #3ea8ff; border-radius: 0 4px 4px 0;
      color: #bfe4ff; background: rgba(62,168,255,.12);
    }
    #${P.id} .fr-log-time { color: inherit; opacity: .86; font-size: 9px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    #${P.id} .fr-log-message { min-width: 0; overflow-wrap: anywhere; }
    #${P.id} .fr-log-row[data-tone="success"] { border-left-color: #51d88a; color: #b7f5cf; background: rgba(81,216,138,.12); }
    #${P.id} .fr-log-row[data-tone="info"] { border-left-color: #3ea8ff; color: #bfe4ff; background: rgba(62,168,255,.12); }
    #${P.id} .fr-log-row[data-tone="error"] { border-left-color: #ff5261; color: #ffb3ba; background: rgba(255,82,97,.14); }
    #${P.id} .fr-log-enter { animation: fr-log-enter .2s ease both; }
    #${P.id} .fr-log-missed-pulse { animation: fr-log-enter .2s ease both, fr-log-missed-pulse .55s ease-out; }
    #${P.id} .fr-waitbar { flex: 0 0 auto; padding: 5px 7px; border: 1px solid rgba(0,229,255,.17); border-radius: 6px; background: rgba(0,229,255,.035); }
    #${P.id} .fr-waitbar[hidden] { display: none; }
    #${P.id} .fr-waitbar-label { margin-bottom: 4px; color: #b7d7dd; font-size: 9px; font-variant-numeric: tabular-nums; }
    #${P.id} .fr-waitbar-track { height: 3px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.12); }
    #${P.id} .fr-waitbar-fill {
      width: 100%; height: 100%; border-radius: inherit; background: rgba(0,229,255,.8);
      transform: scaleX(1); transform-origin: left center;
      animation: fr-wait-drain var(--fr-wait-duration) linear forwards;
      animation-delay: var(--fr-wait-delay, 0ms);
    }
    @keyframes fr-status-spin { to { transform: rotate(360deg); } }
    @keyframes fr-status-enter { from { opacity: 0; transform: translateX(7px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fr-status-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
    @keyframes fr-status-flash { 0% { box-shadow: 0 0 0 rgba(81,216,138,0); } 35% { box-shadow: 0 0 14px rgba(81,216,138,.34); } 100% { box-shadow: 0 0 0 rgba(81,216,138,0); } }
    @keyframes fr-start-pulse {
      0%, 100% { box-shadow: 0 0 5px rgba(255,82,97,.28), 0 0 12px rgba(201,40,58,.15); }
      50% { box-shadow: 0 0 13px rgba(255,82,97,.58), 0 0 24px rgba(201,40,58,.32); }
    }
    @keyframes fr-log-enter { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fr-log-missed-pulse { 0%, 100% { background: rgba(255,82,97,.14); } 45% { background: rgba(255,82,97,.26); } }
    @keyframes fr-wait-drain { to { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) {
      #${P.id} .fr-target-status-icon[data-type="loading"],
      #${P.id} .fr-status-message-enter,
      #${P.id} .fr-status-success-flash,
      #${P.id} .fr-target-status[data-type="loading"]::after,
      #${P.id} .fr-start[data-state="running"],
      #${P.id} .fr-log-enter,
      #${P.id} .fr-log-missed-pulse,
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
