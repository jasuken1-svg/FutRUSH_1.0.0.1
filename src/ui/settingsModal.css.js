// Ayarlar modalinin koyu temali ve kapsamli stillerini sunar.
// Bagimlilik: yok.

export const settingsModalCss = `
#futrush-settings .fr-settings-content { display: flex; flex-direction: column; gap: 12px; color: #e7eef8; }
#futrush-settings .fr-settings-card { padding: 13px 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 9px; background: rgba(255,255,255,.035); }
#futrush-settings .fr-settings-card h2 { margin: 0 0 11px; color: #fff; font-size: 15px; }
#futrush-settings .fr-settings-field { display: grid; grid-template-columns: minmax(150px, 1fr) minmax(140px, 1fr); align-items: center; gap: 7px 14px; padding: 8px 0; border-top: 1px solid rgba(255,255,255,.07); }
#futrush-settings .fr-settings-field:first-of-type { border-top: 0; }
#futrush-settings .fr-settings-label { color: #e7eef8; font-size: 13px; }
#futrush-settings .fr-settings-hint, #futrush-settings .fr-settings-error { grid-column: 1 / -1; color: #9aabc1; font-size: 11px; line-height: 1.4; }
#futrush-settings .fr-settings-error { color: #ffb27e; }
#futrush-settings .fr-settings-control, #futrush-settings .fr-settings-control select, #futrush-settings select.fr-settings-control { width: 100%; min-width: 0; box-sizing: border-box; padding: 7px 8px; border: 1px solid rgba(255,255,255,.2); border-radius: 6px; color: #fff; background: #17253a; font: 13px Arial,sans-serif; }
#futrush-settings .fr-settings-control option { color: #fff; background: #17253a; }
#futrush-settings .fr-settings-range { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
#futrush-settings .fr-settings-range label { color: #aebdd0; font-size: 11px; }
#futrush-settings .fr-settings-range .fr-settings-control { margin-top: 4px; }
#futrush-settings .fr-settings-actions { display: flex; flex-direction: column; gap: 7px; }
#futrush-settings .fr-settings-action-row { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 8px; }
#futrush-settings .fr-settings-action { min-height: 34px; padding: 7px 10px; border: 1px solid rgba(255,255,255,.17); border-radius: 6px; color: #e7eef8; background: rgba(255,255,255,.06); font: 12px Arial,sans-serif; text-align: left; cursor: pointer; }
#futrush-settings .fr-settings-action:hover:not(:disabled) { background: rgba(0,229,255,.13); border-color: rgba(0,229,255,.45); }
#futrush-settings .fr-settings-action:disabled { opacity: .45; cursor: not-allowed; }
#futrush-settings .fr-settings-disabled-note { color: #9aabc1; font-size: 10px; white-space: nowrap; }
#futrush-settings .fr-settings-status { min-height: 15px; color: #80e6bd; font-size: 11px; }
#futrush-settings .fr-settings-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
#futrush-settings .fr-settings-toggle input { width: 18px; height: 18px; accent-color: #00c5e8; }
#futrush-settings .fr-settings-version { margin-top: 10px; color: #aebdd0; font-size: 11px; }
@media(max-width:520px) { #futrush-settings .fr-settings-field { grid-template-columns: 1fr; gap: 6px; } #futrush-settings .fr-settings-range { grid-column: 1; } }
`;
