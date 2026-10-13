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
