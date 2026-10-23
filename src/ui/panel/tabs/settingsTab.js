// Bot ayarlarini ve calisma durumunu panelin ayarlar sekmesinde cizer.
// Bagimliliklar: core/state, core/storage ve bot/autoBuyer.

import { state } from '../../../core/state.js';
import { emit } from '../../../core/events.js';
import { saveSnipeSettings } from '../../../core/storage.js';
import { startAutoBuyer, stopAutoBuyer } from '../../../bot/autoBuyer.js';
import { clampPrice, roundToPriceStep } from '../../../ea/priceSteps.js';
import { attachHoldRepeat } from './targetsTab.js';
import { SPEED_TIERS, SPEED_LIMITS, clampTierSeconds, formatTierSeconds } from '../../../bot/speedTiers.js';

export function renderPanelSettings(content) {
  const s = state.snipeSettings;
  if (!s.speedDelays || typeof s.speedDelays !== 'object') {
    s.speedDelays = { 0: 5.0, 1: 4.0, 2: 2.5, 3: 1.5 };
  }
  const activeSpeedId = Number.isInteger(s.speed) && s.speed >= 0 && s.speed <= 3 ? s.speed : 1;
  const waitRange = Array.isArray(s.waitSeconds) && s.waitSeconds.length === 2
    ? s.waitSeconds
    : [15, 35];
  const waitDisplay = waitRange[0] === waitRange[1]
    ? waitRange[0] + ' sn'
    : waitRange[0] + ' - ' + waitRange[1] + ' sn';
  const hourlyVal = (s.hourlySearchLimit !== undefined && s.hourlySearchLimit !== '' && s.hourlySearchLimit !== 1200) ? s.hourlySearchLimit : '';
  const dailyVal = (s.dailySearchLimit !== undefined && s.dailySearchLimit !== '' && s.dailySearchLimit !== 6000) ? s.dailySearchLimit : '';
  const hourlyDisplay = s.hourlySearchLimit === 0 ? 'Limitsiz' : (s.hourlySearchLimit || 1200);
  const dailyDisplay = s.dailySearchLimit === 0 ? 'Limitsiz' : (s.dailySearchLimit || 6000);

  const speedCardsHtml = '<div class="speed-tier-grid">' +
    SPEED_TIERS.map((tier) => {
      const isActive = tier.id === activeSpeedId;
      const currentSec = typeof s.speedDelays[tier.id] === 'number'
        ? clampTierSeconds(s.speedDelays[tier.id])
        : tier.defaultSec;
      const warnHtml = tier.isWarning ? '<span class="speed-tier-warn-icon" aria-hidden="true">⚠ </span>' : '';
      const riskNoteHtml = tier.riskNote ? '<div class="speed-tier-risk-note">' + tier.riskNote + '</div>' : '';
      const isMin = currentSec <= SPEED_LIMITS.MIN_SEC + 0.001;
      const isMax = currentSec >= SPEED_LIMITS.MAX_SEC - 0.001;

      return '<div class="speed-tier-card' + (isActive ? ' is-active' : '') + '" data-tier-id="' + tier.id + '" style="--tier-color: ' + tier.color + ';" role="button" tabindex="0" aria-pressed="' + isActive + '" aria-label="' + tier.name + ' arama hızı kademesi">' +
        '<div class="speed-tier-top-stripe"></div>' +
        '<div class="speed-tier-card-header">' +
          '<div class="speed-tier-name-row">' +
            '<span class="speed-tier-name">' + warnHtml + tier.name + '</span>' +
            '<button type="button" class="speed-tier-reset-btn" data-tier-reset="' + tier.id + '" title="Varsayılana döndür (' + formatTierSeconds(tier.defaultSec) + ' sn)" aria-label="' + tier.name + ' varsayılana döndür">↺</button>' +
          '</div>' +
          '<div class="speed-tier-default-hint">Varsayılan: ' + formatTierSeconds(tier.defaultSec) + ' sn</div>' +
          riskNoteHtml +
        '</div>' +
        '<div class="speed-tier-counter" data-tier-counter="' + tier.id + '">' +
          '<button type="button" class="speed-tier-step-btn speed-tier-minus" data-step="-0.2" aria-label="' + tier.name + ' süresini 0.2 sn azalt"' + (isMin ? ' disabled' : '') + '>−' + '</button>' +
          '<span class="speed-tier-value" data-tier-val="' + tier.id + '">' + formatTierSeconds(currentSec) + ' sn</span>' +
          '<button type="button" class="speed-tier-step-btn speed-tier-plus" data-step="0.2" aria-label="' + tier.name + ' süresini 0.2 sn artır"' + (isMax ? ' disabled' : '') + '>+' + '</button>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';

  content.innerHTML =
    '<div class="fr-settings-view">' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Oyuncu listesi tekrarı</span><span class="fr-setting-value" data-value="repeat">' + s.repeat + '</span></div><input class="fr-range" data-setting="repeat" type="range" min="0" max="50" step="1" value="' + s.repeat + '" aria-label="Oyuncu listesi kaç kez tekrarlanacak"></div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Bekleme süresi (arama bitince)</span><span class="fr-setting-value" data-value="waitSeconds">' + waitDisplay + '</span></div>' +
        '<div class="fr-range-dual">' +
          '<div class="fr-dual-field"><span>Min (sn)</span>' +
            '<div class="fr-counter fr-counter-compact">' +
              '<button type="button" data-wait-step="-1" data-wait-idx="0" aria-label="Min bekleme azalt">−</button>' +
              '<input class="fr-setting-input fr-counter-input" data-setting="waitSeconds.0" type="number" min="1" max="120" step="1" value="' + waitRange[0] + '" aria-label="Minimum bekleme saniyesi">' +
              '<button type="button" data-wait-step="1" data-wait-idx="0" aria-label="Min bekleme artır">+</button>' +
            '</div>' +
          '</div>' +
          '<div class="fr-dual-field"><span>Max (sn)</span>' +
            '<div class="fr-counter fr-counter-compact">' +
              '<button type="button" data-wait-step="-1" data-wait-idx="1" aria-label="Max bekleme azalt">−</button>' +
              '<input class="fr-setting-input fr-counter-input" data-setting="waitSeconds.1" type="number" min="1" max="120" step="1" value="' + waitRange[1] + '" aria-label="Maksimum bekleme saniyesi">' +
              '<button type="button" data-wait-step="1" data-wait-idx="1" aria-label="Max bekleme artır">+</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Otomatik satış (aldıktan sonra)</span><button class="fr-toggle" data-toggle="autoSell" type="button" role="switch" aria-checked="' + s.autoSell + '" aria-label="Otomatik satış"></button></div></div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Kuru çalıştırma (satın alma yapma)</span><button class="fr-toggle fr-toggle--dryrun" data-toggle="dryRun" type="button" role="switch" aria-checked="' + Boolean(s.dryRun) + '" aria-label="Kuru çalıştırma"></button></div></div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Piyasa üstü alımı kesin engelle</span><button class="fr-toggle" data-toggle="strictMarketCap" type="button" role="switch" aria-checked="' + Boolean(s.strictMarketCap) + '" aria-label="Piyasa üstü alımı kesin engelle"></button></div></div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>En fazla alınacak oyuncu</span></div><div class="fr-counter"><button type="button" data-count="-1" aria-label="Oyuncu sayısını azalt">−</button><span class="fr-counter-value" data-value="maxPlayers">' + s.maxPlayers + '</span><button type="button" data-count="1" aria-label="Oyuncu sayısını artır">+</button></div></div>' +
      '<div class="fr-setting-row speed-tier-setting-row">' +
        '<div class="fr-setting-head"><span>Arama hızı</span><span class="speed-tier-active-summary" data-value="speed-summary"></span></div>' +
        speedCardsHtml +
      '</div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Harcama limiti (coin)</span><span class="fr-setting-value" data-value="maxSpendCoins">' + (s.maxSpendCoins ? Number(s.maxSpendCoins).toLocaleString('tr-TR') : 'Limitsiz') + '</span></div>' +
        '<div class="fr-counter fr-counter-editable">' +
          '<button type="button" data-spend-step="-1000" aria-label="Harcama limitini 1000 azalt">−</button>' +
          '<input class="fr-setting-input fr-counter-input" data-setting="maxSpendCoins" type="number" min="0" step="1000" placeholder="0 = limitsiz" value="' + (s.maxSpendCoins || '') + '" aria-label="Harcama limiti coin olarak">' +
          '<button type="button" data-spend-step="1000" aria-label="Harcama limitini 1000 artır">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Saatlik arama limiti</span><span class="fr-setting-value" data-value="hourlySearchLimit">' + hourlyDisplay + '</span></div><input class="fr-setting-input" data-setting="hourlySearchLimit" type="number" min="0" step="50" placeholder="Varsayılan= 1200" value="' + hourlyVal + '" aria-label="Saatlik arama limiti"></div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Günlük arama limiti</span><span class="fr-setting-value" data-value="dailySearchLimit">' + dailyDisplay + '</span></div><input class="fr-setting-input" data-setting="dailySearchLimit" type="number" min="0" step="100" placeholder="Varsayılan=6000" value="' + dailyVal + '" aria-label="Günlük arama limiti"></div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Ardışık hata limiti</span><span class="fr-setting-value" data-value="consecutiveErrorLimit">' + (s.consecutiveErrorLimit || 3) + '</span></div><input class="fr-setting-input" data-setting="consecutiveErrorLimit" type="number" min="1" max="20" step="1" value="' + (s.consecutiveErrorLimit || 3) + '" aria-label="Ardışık 429/500 hata limiti"></div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Transfer Listesi doluluk uyarısı</span><span class="fr-setting-value" data-value="transferListWarnThreshold">' + (s.transferListWarnThreshold ?? 5) + ' slot</span></div><input class="fr-setting-input" data-setting="transferListWarnThreshold" type="number" min="1" max="50" step="1" value="' + (s.transferListWarnThreshold ?? 5) + '" aria-label="Transfer listesi boş slot uyarı eşiği"></div>' +
      '<div class="fr-setting-row"><div class="fr-setting-head"><span>Aşırı fiyat tavan koruması (%)</span><span class="fr-setting-value" data-value="maxPriceCapThreshold">%' + Math.round((s.maxPriceCapThreshold ?? 0.50) * 100) + '</span></div><input class="fr-setting-input" data-setting="maxPriceCapThreshold" type="number" min="10" max="500" step="5" value="' + Math.round((s.maxPriceCapThreshold ?? 0.50) * 100) + '" aria-label="Maksimum tavan fiyat yüzdesi"></div>' +
      '<button class="fr-start" type="button" data-state="' + (state.botRunning ? 'running' : 'idle') + '" aria-pressed="' + state.botRunning + '" aria-label="' + (state.botRunning ? 'Durdur FutRUSH' : 'Başlat FutRUSH') + '">' +
        '<svg class="fr-start-icon fr-start-icon-idle" viewBox="0 0 24 32" aria-hidden="true"><path d="M14 1 3 18h7l-1 13 12-19h-8z" fill="currentColor" stroke="rgba(255,255,255,.8)" stroke-width="1" stroke-linejoin="round"/></svg>' +
        '<svg class="fr-start-icon fr-start-icon-running" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/></svg>' +
        '<span class="fr-start-label" aria-hidden="true"><span class="fr-start-label-idle">Başlat FutRUSH</span><span class="fr-start-label-running">Durdur FutRUSH</span></span></button>' +
    '</div>';

  const updateSpeedSummary = () => {
    const summaryEl = content.querySelector('[data-value="speed-summary"]');
    if (!summaryEl) return;
    const tier = SPEED_TIERS[s.speed] || SPEED_TIERS[1];
    const sec = s.speedDelays?.[tier.id] ?? tier.defaultSec;
    summaryEl.innerHTML = `<span style="color: ${tier.color}">● ${tier.name} (${formatTierSeconds(sec)} sn)</span>`;
  };
  updateSpeedSummary();

  const syncTierCards = () => {
    content.querySelectorAll('.speed-tier-card').forEach((card) => {
      const tierId = Number(card.dataset.tierId);
      const isActive = tierId === s.speed;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-pressed', String(isActive));
      const valEl = card.querySelector('[data-tier-val]');
      const currentSec = s.speedDelays?.[tierId] ?? SPEED_TIERS[tierId].defaultSec;
      if (valEl) valEl.textContent = formatTierSeconds(currentSec) + ' sn';
      const minusBtn = card.querySelector('.speed-tier-minus');
      const plusBtn = card.querySelector('.speed-tier-plus');
      if (minusBtn) minusBtn.disabled = currentSec <= SPEED_LIMITS.MIN_SEC + 0.001;
      if (plusBtn) plusBtn.disabled = currentSec >= SPEED_LIMITS.MAX_SEC - 0.001;
    });
    updateSpeedSummary();
    emit('bot:speed-changed');
  };

  content.querySelectorAll('.speed-tier-card').forEach((card) => {
    const tierId = Number(card.dataset.tierId);
    card.addEventListener('click', () => {
      s.speed = tierId;
      saveSnipeSettings();
      syncTierCards();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        s.speed = tierId;
        saveSnipeSettings();
        syncTierCards();
      }
    });

    const resetBtn = card.querySelector('[data-tier-reset]');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tier = SPEED_TIERS[tierId];
        s.speedDelays[tierId] = tier.defaultSec;
        saveSnipeSettings();
        syncTierCards();
      });
    }

    card.querySelectorAll('.speed-tier-step-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const step = Number(btn.dataset.step) || 0;
        const current = s.speedDelays?.[tierId] ?? SPEED_TIERS[tierId].defaultSec;
        const next = clampTierSeconds(current + step);
        s.speedDelays[tierId] = next;
        saveSnipeSettings();
        syncTierCards();
      });
    });
  });

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
      content.querySelector('[data-value="' + key + '"]').textContent = String(s[key]);
      updateRange();
    };
    input.addEventListener('input', updateSetting);
    input.addEventListener('change', () => {
      updateSetting();
      saveSnipeSettings();
    });
  });

  content.querySelectorAll('.fr-setting-input[data-setting^="waitSeconds."]').forEach((input) => {
    const updateWait = () => {
      const minInput = content.querySelector('.fr-setting-input[data-setting="waitSeconds.0"]');
      const maxInput = content.querySelector('.fr-setting-input[data-setting="waitSeconds.1"]');
      const minVal = Math.min(120, Math.max(1, Math.floor(Number(minInput?.value) || 1)));
      const maxVal = Math.min(120, Math.max(1, Math.floor(Number(maxInput?.value) || 1)));
      s.waitSeconds = [Math.min(minVal, maxVal), Math.max(minVal, maxVal)];
      const text = s.waitSeconds[0] === s.waitSeconds[1]
        ? s.waitSeconds[0] + ' sn'
        : s.waitSeconds[0] + ' - ' + s.waitSeconds[1] + ' sn';
      content.querySelector('[data-value="waitSeconds"]').textContent = text;
    };
    input.addEventListener('input', updateWait);
    input.addEventListener('change', () => {
      updateWait();
      saveSnipeSettings();
    });
  });

  content.querySelectorAll('[data-wait-step]').forEach((btn) => {
    const step = Number(btn.dataset.waitStep) || 0;
    const idx = Number(btn.dataset.waitIdx) || 0;
    attachHoldRepeat(btn, () => {
      const input = content.querySelector(`.fr-setting-input[data-setting="waitSeconds.${idx}"]`);
      if (!input) return;
      const current = Math.min(120, Math.max(1, Math.floor(Number(input.value) || 1)));
      const next = Math.min(120, Math.max(1, current + step));
      input.value = String(next);
      const minInput = content.querySelector('.fr-setting-input[data-setting="waitSeconds.0"]');
      const maxInput = content.querySelector('.fr-setting-input[data-setting="waitSeconds.1"]');
      const minVal = Math.min(120, Math.max(1, Math.floor(Number(minInput?.value) || 1)));
      const maxVal = Math.min(120, Math.max(1, Math.floor(Number(maxInput?.value) || 1)));
      s.waitSeconds = [Math.min(minVal, maxVal), Math.max(minVal, maxVal)];
      const text = s.waitSeconds[0] === s.waitSeconds[1]
        ? s.waitSeconds[0] + ' sn'
        : s.waitSeconds[0] + ' - ' + s.waitSeconds[1] + ' sn';
      content.querySelector('[data-value="waitSeconds"]').textContent = text;
      saveSnipeSettings();
    });
  });

  const spendInput = content.querySelector('.fr-setting-input[data-setting="maxSpendCoins"]');
  if (spendInput) {
    const updateSpend = () => {
      const val = Math.max(0, Math.floor(Number(spendInput.value) || 0));
      s.maxSpendCoins = val;
      content.querySelector('[data-value="maxSpendCoins"]').textContent = val ? val.toLocaleString('tr-TR') : 'Limitsiz';
    };
    spendInput.addEventListener('input', updateSpend);
    const commitSpend = () => {
      const raw = Math.max(0, Math.floor(Number(spendInput.value) || 0));
      const val = raw > 0 ? clampPrice(roundToPriceStep(raw, 'nearest')) : 0;
      s.maxSpendCoins = val;
      spendInput.value = val > 0 ? String(val) : '';
      content.querySelector('[data-value="maxSpendCoins"]').textContent = val ? val.toLocaleString('tr-TR') : 'Limitsiz';
      saveSnipeSettings();
    };
    spendInput.addEventListener('change', commitSpend);
    spendInput.addEventListener('blur', commitSpend);

    content.querySelectorAll('[data-spend-step]').forEach((btn) => {
      const step = Number(btn.dataset.spendStep) || 0;
      attachHoldRepeat(btn, () => {
        const raw = Math.max(0, Math.floor(Number(spendInput.value) || 0));
        let next = raw + step;
        if (next < 0) next = 0;
        const val = next > 0 ? clampPrice(roundToPriceStep(next, 'nearest')) : 0;
        s.maxSpendCoins = val;
        spendInput.value = val > 0 ? String(val) : '';
        content.querySelector('[data-value="maxSpendCoins"]').textContent = val ? val.toLocaleString('tr-TR') : 'Limitsiz';
        saveSnipeSettings();
      });
    });
  }

  content.querySelectorAll('.fr-toggle').forEach((toggle) => {
    toggle.addEventListener('click', (event) => {
      const key = toggle.dataset.toggle;
      if (key === 'dryRun') {
        s.dryRun = !s.dryRun;
        event.currentTarget.setAttribute('aria-checked', String(s.dryRun));
        saveSnipeSettings();
        emit('bot:dryrun-changed');
      } else if (key === 'strictMarketCap') {
        s.strictMarketCap = !s.strictMarketCap;
        event.currentTarget.setAttribute('aria-checked', String(s.strictMarketCap));
        saveSnipeSettings();
        emit('bot:strict-market-cap-changed');
      } else {
        s.autoSell = !s.autoSell;
        event.currentTarget.setAttribute('aria-checked', String(s.autoSell));
        saveSnipeSettings();
      }
    });
  });

  content.querySelectorAll('[data-count]').forEach((button) => {
    const step = Number(button.dataset.count) || 0;
    attachHoldRepeat(button, () => {
      s.maxPlayers = Math.max(1, s.maxPlayers + step);
      content.querySelector('[data-value="maxPlayers"]').textContent = String(s.maxPlayers);
      saveSnipeSettings();
    });
  });

  content.querySelector('.fr-start').addEventListener('click', () => {
    if (state.botRunning) stopAutoBuyer('Kullanıcı tarafından durduruldu.');
    else startAutoBuyer();
  });

  ['hourlySearchLimit', 'dailySearchLimit', 'consecutiveErrorLimit', 'transferListWarnThreshold', 'maxPriceCapThreshold'].forEach((key) => {
    const inp = content.querySelector('.fr-setting-input[data-setting="' + key + '"]');
    if (!inp) return;
    const updateVal = () => {
      const raw = inp.value.trim();
      if (raw === '') {
        const def = (key === 'hourlySearchLimit' ? 1200 : (key === 'dailySearchLimit' ? 6000 : (key === 'consecutiveErrorLimit' ? 3 : (key === 'transferListWarnThreshold' ? 5 : 0.50))));
        s[key] = def;
        content.querySelector('[data-value="' + key + '"]').textContent = key === 'transferListWarnThreshold' ? (def + ' slot') : (key === 'maxPriceCapThreshold' ? ('%' + Math.round(def * 100)) : String(def));
      } else {
        const parsed = Number(raw) || 0;
        if (key === 'maxPriceCapThreshold') {
          const clamped = Math.max(10, Math.min(500, Math.floor(parsed)));
          s[key] = clamped / 100;
          content.querySelector('[data-value="' + key + '"]').textContent = '%' + clamped;
        } else {
          const val = Math.max(0, Math.floor(parsed));
          s[key] = val;
          content.querySelector('[data-value="' + key + '"]').textContent = key === 'transferListWarnThreshold' ? (val + ' slot') : (val ? String(val) : (key === 'consecutiveErrorLimit' ? '3' : 'Limitsiz'));
        }
      }
    };
    inp.addEventListener('input', updateVal);
    inp.addEventListener('change', () => {
      updateVal();
      saveSnipeSettings();
    });
  });
}
