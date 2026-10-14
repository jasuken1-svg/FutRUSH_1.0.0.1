// Bot ayarlarini ve calisma durumunu panelin ayarlar sekmesinde cizer.
// Bagimliliklar: core/state, core/storage ve bot/autoBuyer.

import { state } from '../../../core/state.js';
import { saveSnipeSettings } from '../../../core/storage.js';
import { startAutoBuyer, stopAutoBuyer } from '../../../bot/autoBuyer.js';

export function renderPanelSettings(content) {
const s = state.snipeSettings;
const speedLabels = { 0: 'Yavaş', 1: 'Orta', 2: 'Hızlı', 3: 'Çok hızlı' };
content.innerHTML =
  '<div class="fr-settings-view">' +
    '<div class="fr-setting-row"><div class="fr-setting-head"><span>Oyuncu listesi tekrarı</span><span class="fr-setting-value" data-value="repeat">' + s.repeat + '</span></div><input class="fr-range" data-setting="repeat" type="range" min="0" max="50" step="1" value="' + s.repeat + '" aria-label="Oyuncu listesi kaç kez tekrarlanacak"></div>' +
    '<div class="fr-setting-row"><div class="fr-setting-head"><span>Bekleme süresi (arama bitince)</span><span class="fr-setting-value" data-value="waitSeconds">' + s.waitSeconds + ' sn</span></div><input class="fr-range" data-setting="waitSeconds" type="range" min="0" max="120" step="1" value="' + s.waitSeconds + '" aria-label="Arama bitince beklenecek süre"></div>' +
    '<div class="fr-setting-row"><div class="fr-setting-head"><span>Otomatik satış (aldıktan sonra)</span><button class="fr-toggle" type="button" role="switch" aria-checked="' + s.autoSell + '" aria-label="Otomatik satış"></button></div></div>' +
    '<div class="fr-setting-row"><div class="fr-setting-head"><span>En fazla alınacak oyuncu</span></div><div class="fr-counter"><button type="button" data-count="-1" aria-label="Oyuncu sayısını azalt">−</button><span class="fr-counter-value" data-value="maxPlayers">' + s.maxPlayers + '</span><button type="button" data-count="1" aria-label="Oyuncu sayısını artır">+</button></div></div>' +
    '<div class="fr-setting-row"><div class="fr-setting-head"><span>Arama hızı</span><span class="fr-setting-value" data-value="speed">' + (speedLabels[s.speed] || '') + '</span></div><input class="fr-range" data-setting="speed" type="range" min="0" max="3" step="1" value="' + s.speed + '" aria-label="Arama hızı 0 ile 3 arasında"></div>' +
    '<button class="fr-start" type="button" data-state="' + (state.botRunning ? 'running' : 'idle') + '" aria-pressed="' + state.botRunning + '" aria-label="' + (state.botRunning ? 'Durdur FutRUSH' : 'Başlat FutRUSH') + '">' +
      '<svg class="fr-start-icon fr-start-icon-idle" viewBox="0 0 24 32" aria-hidden="true"><path d="M14 1 3 18h7l-1 13 12-19h-8z" fill="currentColor" stroke="rgba(255,255,255,.8)" stroke-width="1" stroke-linejoin="round"/></svg>' +
      '<svg class="fr-start-icon fr-start-icon-running" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/></svg>' +
      '<span class="fr-start-label" aria-hidden="true"><span class="fr-start-label-idle">Başlat FutRUSH</span><span class="fr-start-label-running">Durdur FutRUSH</span></span></button>' +
  '</div>';

content.querySelectorAll('.fr-range').forEach((input) => {
  const updateRange = () => {
    const min = Number(input.min);
    const max = Number(input.max);
    const progress = ((Number(input.value) - min) / (max - min)) * 100;
    input.style.setProperty('--fr-progress', progress + '%');
  };
  updateRange();
  const updateSetting = () => {
    const key = input.dataset.setting;
    s[key] = Number(input.value);
    const displayValue = key === 'waitSeconds' ? s[key] + ' sn' : key === 'speed' ? (speedLabels[s.speed] || '') : String(s[key]);
    content.querySelector('[data-value="' + key + '"]').textContent = displayValue;
    updateRange();
  };
  input.addEventListener('input', updateSetting);
  input.addEventListener('change', () => {
    updateSetting();
    saveSnipeSettings();
  });
});
content.querySelector('.fr-toggle').addEventListener('click', (event) => {
  s.autoSell = !s.autoSell;
  event.currentTarget.setAttribute('aria-checked', String(s.autoSell));
  saveSnipeSettings();
});
content.querySelectorAll('[data-count]').forEach((button) => button.addEventListener('click', () => {
  s.maxPlayers = Math.max(1, s.maxPlayers + Number(button.dataset.count));
  content.querySelector('[data-value="maxPlayers"]').textContent = String(s.maxPlayers);
  saveSnipeSettings();
}));
content.querySelector('.fr-start').addEventListener('click', () => {
  if (state.botRunning) stopAutoBuyer('Kullanıcı tarafından durduruldu.');
  else startAutoBuyer();
});
  
}
