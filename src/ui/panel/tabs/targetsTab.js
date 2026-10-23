// Hedef oyuncu kartlarini, fiyat kontrollerini ve liste eylemlerini cizer.
// Bagimliliklar: core/state/events, utils/format ve targets/targetStore.

import { state } from '../../../core/state.js';
import { emit } from '../../../core/events.js';
import { saveTargets } from '../../../targets/targetStore.js';
import { setTargetStatus } from '../../../targets/targetStatus.js';
import { normalizeTargetStatus } from '../panelLogic.js';
import { formatFutbinRowPrice, getPlatform } from '../../../futbin/platform.js';
import { commitCandidateTarget, hydrateTargetsWithFutbin } from '../../../targets/pinnedPlayer.js';
import { searchPlayerAllVersions, searchUniquePlayers, fetchPlayerDetailsFromFutbinApi } from '../../../futbin/playerLookup.js';
import { createEaCardElement } from '../cardRenderer.js';
import { CONFIG } from '../../../core/config.js';
import { MIN_PRICE, clampPrice, nextPriceUp, nextPriceDown, roundDownToStep, roundToPriceStep } from '../../../ea/priceSteps.js';
import { validatePriceCap, isExceedingFutbin } from '../../../ea/priceCapGuard.js';
import { addMarketLog } from '../../marketLogBox.js';
import { wait } from '../../../utils/async.js';
import { FUTBIN_ICON_DATA } from '../../icons.js';
import { getBalance } from '../../../ea/balance.js';
import { computeEffectiveBuyNow, resetEscalationOnManualChange } from '../../../ea/escalation.js';

let isHydrating = false;
let isUpdatingPrices = false;
let statusRemovalTimer = null;
let lastUpdateInterval = null;

function renderStatus(status, targetLoading) {
  const normalized = normalizeTargetStatus(status) || (targetLoading ? {
    type: 'loading',
    message: 'FutBIN oyuncuları yükleniyor...',
    source: 'futbin'
  } : null);
  return normalized;
}

function cancelStatusRemoval(statusElement) {
  if (statusRemovalTimer !== null) {
    clearTimeout(statusRemovalTimer);
    statusRemovalTimer = null;
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Son güncelleme: —';
  const diffMs = Date.now() - Number(timestamp);
  if (diffMs < 0 || isNaN(diffMs)) return 'Son güncelleme: —';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'Son güncelleme: Az önce';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Son güncelleme: ${diffMin} dakika önce`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Son güncelleme: ${diffHours} saat önce`;
  const diffDays = Math.floor(diffHours / 24);
  return `Son güncelleme: ${diffDays} gün önce`;
}

export function formatPriceHistoryTooltip(player) {
  const history = Array.isArray(player?.priceHistory) && player.priceHistory.length ? player.priceHistory : [];
  if (!history.length) {
    if (player?.price) {
      const d = player.priceUpdatedAt ? new Date(player.priceUpdatedAt) : new Date();
      const dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      return `Mevcut Fiyat: ${Number(player.price).toLocaleString('tr-TR')} coin (${dateStr} ${timeStr})`;
    }
    return 'Fiyat geçmişi bulunmuyor';
  }
  const lines = ['Son Fiyat Güncellemeleri:'];
  history.slice(0, 5).forEach((item, idx) => {
    const d = new Date(item.at || Date.now());
    const dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    lines.push(`${idx + 1}. ${Number(item.price).toLocaleString('tr-TR')} coin · ${dateStr} ${timeStr}`);
  });
  return lines.join('\n');
}

export function attachHoldRepeat(button, onTrigger) {
  let timer = null;
  let interval = null;
  let didTriggerOnDown = false;

  const stop = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    setTimeout(() => {
      didTriggerOnDown = false;
    }, 50);
  };

  const start = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) {
      if (e.button === 1) e.preventDefault();
      return;
    }
    didTriggerOnDown = true;
    if (timer) clearTimeout(timer);
    if (interval) clearInterval(interval);
    onTrigger(e);
    timer = setTimeout(() => {
      interval = setInterval(() => {
        onTrigger(e);
      }, 70);
    }, 1000);
  };

  button.addEventListener('mousedown', start);
  button.addEventListener('mouseup', stop);
  button.addEventListener('mouseleave', stop);
  button.addEventListener('touchstart', start, { passive: true });
  button.addEventListener('touchend', stop);
  button.addEventListener('touchcancel', stop);
  window.addEventListener('blur', stop);

  button.addEventListener('click', (e) => {
    e.preventDefault();
    if (!didTriggerOnDown) {
      onTrigger(e);
    }
  });
}

export function updateTargetStatus(statusElement, status, targetLoading) {
  if (!statusElement) return;
  const normalized = renderStatus(status, targetLoading);
  if (!normalized) {
    statusElement.hidden = true;
    statusElement.removeAttribute('data-type');
    statusElement.replaceChildren();
    return;
  }

  cancelStatusRemoval(statusElement);
  statusElement.classList.remove('fr-target-status-exiting');
  statusElement.hidden = false;

  const previousType = statusElement.getAttribute('data-type');
  const previousMessage = statusElement.querySelector('.fr-target-status-message')?.textContent;
  statusElement.setAttribute('data-type', normalized.type);

  let row = statusElement.querySelector('.fr-target-status-row');
  if (!row) {
    row = document.createElement('div');
    row.className = 'fr-target-status-row';
    const icon = document.createElement('span');
    icon.className = 'fr-target-status-icon';
    icon.setAttribute('aria-hidden', 'true');
    const main = document.createElement('div');
    main.className = 'fr-target-status-main';
    const message = document.createElement('span');
    message.className = 'fr-target-status-message';
    const progressLabel = document.createElement('span');
    progressLabel.className = 'fr-target-progress-label';
    progressLabel.hidden = true;
    main.append(message, progressLabel);
    row.append(icon, main);
    statusElement.appendChild(row);
  }

  const icon = row.querySelector('.fr-target-status-icon');
  icon.dataset.type = normalized.type;
  icon.textContent = normalized.type === 'loading' ? '' : normalized.type === 'success' ? '✓' : normalized.type === 'error' ? '!' : '·';

  const message = row.querySelector('.fr-target-status-message');
  if (previousMessage !== normalized.message || !message.textContent) {
    message.textContent = normalized.message;
  }

  // Otomatik sürekli kayan slide (hover gerektirmez, mouse hareketinden etkilenmez)
  const scheduleMeasure = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
  scheduleMeasure(() => {
    if (message && message.scrollWidth > message.clientWidth + 1) {
      message.classList.add('is-overflowing');
      const overflow = message.scrollWidth - message.clientWidth;
      message.style.setProperty('--marquee-overflow', `${overflow + 8}px`);
      const duration = Math.max(4, Math.min(10, overflow / 25));
      message.style.setProperty('--marquee-duration', `${duration}s`);
    } else if (message) {
      message.classList.remove('is-overflowing');
    }
  });

  const progressLabel = row.querySelector('.fr-target-progress-label');
  let progress = statusElement.querySelector('.fr-target-progress');
  if (normalized.progress) {
    if (!progress) {
      progress = document.createElement('div');
      progress.className = 'fr-target-progress';
      const fill = document.createElement('div');
      fill.className = 'fr-target-progress-fill';
      progress.appendChild(fill);
      statusElement.appendChild(progress);
    }
    const done = Math.max(0, Number(normalized.progress.done) || 0);
    const total = Math.max(0, Number(normalized.progress.total) || 0);
    const width = total ? Math.min(100, (done / total) * 100) : 0;
    progress.querySelector('.fr-target-progress-fill').style.width = width + '%';
    progressLabel.textContent = done + '/' + total;
    progressLabel.hidden = false;
  } else {
    progress?.remove();
    progressLabel.textContent = '';
    progressLabel.hidden = true;
  }

  if (normalized.type === 'success' && (previousType !== 'success' || previousMessage !== normalized.message)) {
    statusElement.classList.remove('fr-status-success-flash');
    void statusElement.offsetWidth;
    statusElement.classList.add('fr-status-success-flash');
  } else {
    statusElement.classList.remove('fr-status-success-flash');
  }
}

export function expireTargetStatus(content) {
  const statusElement = content.querySelector('.fr-target-status');
  if (!statusElement || statusElement.hidden) return;
  statusElement.classList.add('fr-target-status-exiting');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    statusElement.hidden = true;
    statusElement.removeAttribute('data-type');
    statusElement.replaceChildren();
    return;
  }
  statusRemovalTimer = setTimeout(() => {
    statusElement.hidden = true;
    statusElement.removeAttribute('data-type');
    statusElement.replaceChildren();
    statusRemovalTimer = null;
  }, 220);
}


export function createEscalationControl(player, onUpdate) {
  if (!player.escalation) {
    player.escalation = {
      enabled: false,
      afterMinutes: 10,
      maxSteps: 3,
      steps: 0,
      activeMs: 0
    };
  }

  const container = document.createElement('div');
  container.className = 'fr-target-escalation-wrap';

  const render = () => {
    container.replaceChildren();

    const effCalc = computeEffectiveBuyNow(player, {
      maxPriceCapThreshold: state.snipeSettings?.maxPriceCapThreshold
    });

    const isEnabled = Boolean(player.escalation?.enabled);
    const steps = Math.max(0, Math.floor(Number(player.escalation?.steps) || 0));

    // 1. Üst Satır: Aç/Kapa Düğmesi + Efektif Fiyat Önizlemesi + Rozetler
    const headerRow = document.createElement('div');
    headerRow.className = 'fr-escalation-header-row';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'fr-escalation-toggle-btn ' + (isEnabled ? 'is-active' : 'is-inactive');
    toggleBtn.innerHTML = `Oto Artır: <span class="fr-escalation-toggle-status">${isEnabled ? 'Açık' : 'Kapalı'}</span>`;
    toggleBtn.title = 'Bulunamazsa fiyatı otomatik artır (Aç/Kapat)';

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasEnabled = Boolean(player.escalation?.enabled);
      player.escalation.enabled = !wasEnabled;
      if (!player.escalation.enabled) {
        if (player.escalation.steps > 0 || player.escalation.activeMs > 0) {
          resetEscalationOnManualChange(player);
          addMarketLog({
            text: `⏹️ [Fiyat Artırma] ${player.name}: Otomatik artırma kapatıldı, basamaklar taban fiyata sıfırlandı.`,
            type: 'info'
          });
        }
      } else {
        addMarketLog({
          text: `▶️ [Fiyat Artırma] ${player.name}: Otomatik artırma açıldı (${player.escalation.afterMinutes} dk, maks ${player.escalation.maxSteps} basamak).`,
          type: 'info'
        });
      }
      saveTargets();
      render();
      if (typeof onUpdate === 'function') onUpdate();
    });

    headerRow.appendChild(toggleBtn);

    if (isEnabled) {
      const preview = document.createElement('div');
      preview.className = 'fr-escalation-preview';
      const baseFmt = Number(player.buyNow).toLocaleString('tr-TR');
      const effFmt = Number(effCalc.effectiveBuyNow).toLocaleString('tr-TR');
      preview.textContent = steps > 0 ? `${baseFmt} → ${effFmt} (+${steps})` : `${baseFmt} (+0)`;
      headerRow.appendChild(preview);

      const badgesWrap = document.createElement('div');
      badgesWrap.className = 'fr-escalation-badges-wrap';

      if (steps > 0) {
        const stepBadge = document.createElement('span');
        stepBadge.className = 'fr-escalation-badge fr-escalation-badge-step';
        stepBadge.textContent = `+${steps} basamak`;
        badgesWrap.appendChild(stepBadge);
      }

      if (effCalc.isAtCeiling) {
        const ceilingBadge = document.createElement('span');
        ceilingBadge.className = 'fr-escalation-badge fr-escalation-badge-ceiling';
        ceilingBadge.textContent = 'TAVAN';
        ceilingBadge.title = effCalc.ceilingReason || 'Fiyat artırma tavanına ulaşıldı';
        badgesWrap.appendChild(ceilingBadge);
      }

      if (effCalc.isRiskOfLoss) {
        const lossWarning = document.createElement('span');
        lossWarning.className = 'fr-escalation-badge fr-escalation-badge-loss';
        lossWarning.textContent = '⚠️ Zarar riski';
        lossWarning.title = 'Efektif fiyat FutBIN piyasa fiyatının %95’ini aşıyor (%5 EA vergi sonrası zarar riski)';
        badgesWrap.appendChild(lossWarning);
      }

      if (badgesWrap.children.length > 0) {
        headerRow.appendChild(badgesWrap);
      }
    }

    container.appendChild(headerRow);

    // 2. Alt Satır: Ayarlar (Dakika & Maks Basamak) ve Canlı Doğrulama
    if (isEnabled) {
      const inputsRow = document.createElement('div');
      inputsRow.className = 'fr-escalation-inputs-row';

      const minWrap = document.createElement('div');
      minWrap.className = 'fr-escalation-field';
      const minLabel = document.createElement('label');
      minLabel.className = 'fr-escalation-field-label';
      minLabel.textContent = 'Kaç dk bulunamazsa:';
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.className = 'fr-escalation-field-input';
      minInput.min = '5';
      minInput.step = '1';
      minInput.value = String(player.escalation.afterMinutes || 10);
      minInput.setAttribute('aria-label', `${player.name} için bulunamazsa artırma süresi`);
      minWrap.append(minLabel, minInput);

      const maxWrap = document.createElement('div');
      maxWrap.className = 'fr-escalation-field';
      const maxLabel = document.createElement('label');
      maxLabel.className = 'fr-escalation-field-label';
      maxLabel.textContent = 'En fazla basamak:';
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.className = 'fr-escalation-field-input';
      maxInput.min = '1';
      maxInput.max = '10';
      maxInput.step = '1';
      maxInput.value = String(player.escalation.maxSteps || 3);
      maxInput.setAttribute('aria-label', `${player.name} için maksimum artırma basamağı`);
      maxWrap.append(maxLabel, maxInput);

      inputsRow.append(minWrap, maxWrap);

      const errorEl = document.createElement('div');
      errorEl.className = 'fr-escalation-inline-error';
      errorEl.hidden = true;

      const validateAndCommitMinutes = (forceRevert = false) => {
        const val = Number(minInput.value);
        if (!Number.isFinite(val) || !Number.isInteger(val) || val < 5) {
          errorEl.textContent = 'Süre en düşük 5 dakika olmalıdır.';
          errorEl.hidden = false;
          minInput.classList.add('is-invalid');
          if (forceRevert) {
            const safe = Math.max(5, Math.floor(val) || 5);
            player.escalation.afterMinutes = safe;
            minInput.value = String(safe);
            minInput.classList.remove('is-invalid');
            errorEl.hidden = true;
            saveTargets();
          }
          return false;
        }
        errorEl.hidden = true;
        minInput.classList.remove('is-invalid');
        player.escalation.afterMinutes = val;
        saveTargets();
        return true;
      };

      const validateAndCommitMaxSteps = (forceRevert = false) => {
        const val = Number(maxInput.value);
        if (!Number.isFinite(val) || !Number.isInteger(val) || val < 1 || val > 10) {
          errorEl.textContent = 'En fazla basamak 1 ile 10 arasında olmalıdır.';
          errorEl.hidden = false;
          maxInput.classList.add('is-invalid');
          if (forceRevert) {
            const safe = Math.max(1, Math.min(10, Math.floor(val) || 3));
            player.escalation.maxSteps = safe;
            maxInput.value = String(safe);
            maxInput.classList.remove('is-invalid');
            errorEl.hidden = true;
            saveTargets();
            render();
          }
          return false;
        }
        errorEl.hidden = true;
        maxInput.classList.remove('is-invalid');
        player.escalation.maxSteps = val;
        saveTargets();
        render();
        return true;
      };

      minInput.addEventListener('input', () => validateAndCommitMinutes(false));
      minInput.addEventListener('change', () => validateAndCommitMinutes(true));
      minInput.addEventListener('blur', () => validateAndCommitMinutes(true));

      maxInput.addEventListener('input', () => validateAndCommitMaxSteps(false));
      maxInput.addEventListener('change', () => validateAndCommitMaxSteps(true));
      maxInput.addEventListener('blur', () => validateAndCommitMaxSteps(true));

      container.append(inputsRow, errorEl);
    }
  };

  render();
  return { container, refresh: render };
}

export function renderTargetContent(content) {
  if (lastUpdateInterval) {
    clearInterval(lastUpdateInterval);
    lastUpdateInterval = null;
  }
  const previousStatus = content.querySelector('.fr-target-status');
  content.innerHTML =
    '<div class="fr-target-view"><div class="fr-target-status" aria-live="polite"></div><div class="fr-target-list" role="list"></div>' +
    '<div class="fr-target-actions"><button class="fr-target-action fr-target-save" type="button" data-filter-mode="save">Kaydet</button><button class="fr-target-action fr-target-load" type="button" data-filter-mode="load">Yükle</button></div></div>';
  const status = content.querySelector('.fr-target-status');
  if (previousStatus) status.replaceWith(previousStatus);
  updateTargetStatus(previousStatus || status, state.targetStatus, state.targetLoading);
  const targetView = content.querySelector('.fr-target-view');
  const list = content.querySelector('.fr-target-list');

  // Arka planda eksik görsel/stat alanlarını FUTBIN'den tamamla (Bölüm 1.2)
  if (!isHydrating && state.targets.some((t) => !t.hydrationAttempted && (!t.playerImageUrl || !t.promoImageUrl || !t.stats || !t.clubImageUrl || !t.playstylesPlus || !t.playstylesPlus.length))) {
    isHydrating = true;
    hydrateTargetsWithFutbin().then(() => {
      isHydrating = false;
      renderTargetContent(content);
    }).catch(() => {
      isHydrating = false;
    });
  }

  // FutBIN Oyuncu Arama Arayuzu
  const searchBox = document.createElement('div');
  searchBox.className = 'fr-target-search-box';
  const searchRow = document.createElement('div');
  searchRow.className = 'fr-target-search-row';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'fr-target-search-input';
  searchInput.placeholder = 'Oyuncu Ara (FutBIN)...';
  searchInput.setAttribute('aria-label', 'Oyuncu Ara (FutBIN)');

  const updatePricesBtn = document.createElement('button');
  updatePricesBtn.type = 'button';
  updatePricesBtn.className = 'fr-target-update-prices-btn';
  updatePricesBtn.textContent = 'Güncelle 💰';
  updatePricesBtn.setAttribute('title', 'Tüm hedef oyuncuların FutBIN fiyatlarını güncelle');

  updatePricesBtn.addEventListener('click', async () => {
    if (isUpdatingPrices) return;
    if (!state.targets.length) {
      setTargetStatus({ type: 'info', message: 'Güncellenecek hedef oyuncu bulunmuyor.' });
      return;
    }
    isUpdatingPrices = true;
    updatePricesBtn.classList.add('is-updating');
    updatePricesBtn.textContent = '⏳ Güncelleniyor...';
    setTargetStatus({ type: 'loading', message: 'Fiyatlar FutBIN üzerinden güncelleniyor...' });
    let updatedCount = 0;
    try {
      const discountRate = (typeof CONFIG.targetAdd?.discountRate === 'number' && Number.isFinite(CONFIG.targetAdd.discountRate) && CONFIG.targetAdd.discountRate >= 0 && CONFIG.targetAdd.discountRate < 1)
        ? CONFIG.targetAdd.discountRate
        : 0.1;

      for (let i = 0; i < state.targets.length; i++) {
        const target = state.targets[i];
        setTargetStatus({
          type: 'loading',
          message: `Fiyatlar FutBIN'den alınıyor (${i + 1}/${state.targets.length}): ${target.name}...`
        });
        const versions = await searchPlayerAllVersions(target.name, { bypassCache: true });
        if (Array.isArray(versions) && versions.length) {
          // 1. FutBIN ID eşleşmesi (en kesin)
          let matched = target.futbinId ? versions.find((v) => String(v.futbinId) === String(target.futbinId)) : null;

          // 2. EA ID eşleşmesi
          if (!matched && target.eaId) {
            matched = versions.find((v) => Number(v.eaId) === Number(target.eaId));
          }

          // 3. Reyting + Versiyon etiketi / nadirlik / Holo eşleşmesi (TOTW/Holo kartı base ile karışamaz)
          if (!matched && target.rating) {
            matched = versions.find((v) =>
              Number(v.rating) === Number(target.rating) &&
              (
                (target.raretype != null && v.raretype === target.raretype) ||
                (target.versionLabel && v.versionLabel === target.versionLabel) ||
                (Boolean(v.isHolo) === Boolean(target.isHolo))
              )
            );
          }

          // 4. Versiyon etiketi veya Holo durumu eşleşmesi
          if (!matched && (target.versionLabel || target.isHolo)) {
            matched = versions.find((v) =>
              (target.versionLabel && v.versionLabel === target.versionLabel) ||
              (target.isHolo && v.isHolo)
            );
          }

          // 5. Yalnızca standart kartlar için aynı reyting eşleşmesi
          const isStandardTarget = !target.isHolo && (!target.versionLabel || ['Gold', 'Silver', 'Bronze', 'Base'].includes(target.versionLabel));
          if (!matched && isStandardTarget && target.rating) {
            matched = versions.find((v) => Number(v.rating) === Number(target.rating) && !v.isHolo);
          }

          // 6. Özel kart için hala bulunamadıysa özel kartlar arasından en yakın reytingli olanı seç
          if (!matched && !isStandardTarget) {
            matched = versions.find((v) => v.isHolo || (v.versionLabel && !['Gold', 'Silver', 'Bronze', 'Base'].includes(v.versionLabel)));
          }

          // 7. Son çare (yalnızca standart kartlar için)
          if (!matched && isStandardTarget) {
            matched = versions[0];
          }

          if (matched) {
            const oldPrice = Number(target.price) || 0;
            const futbinPrice = Number(matched.price) || 0;
            if (futbinPrice > 0) {
              target.price = futbinPrice;
              target.priceUpdatedAt = Date.now();
              target.buyNow = Math.max(150, roundDownToStep(Math.round(futbinPrice * 0.95 * (1 - discountRate))));
              target.priceTrend = oldPrice > 0 ? (futbinPrice > oldPrice ? 'up' : (futbinPrice < oldPrice ? 'down' : 'same')) : 'same';
              target.priceHistory = Array.isArray(target.priceHistory) ? target.priceHistory : [];
              if (oldPrice > 0 && target.priceHistory.length === 0) {
                target.priceHistory.push({ price: oldPrice, at: target.priceUpdatedAt - 1000 });
              }
              target.priceHistory.unshift({ price: futbinPrice, at: Date.now() });
              target.priceHistory.length = Math.min(target.priceHistory.length, 5);
              updatedCount++;
            }
            if (!target.playerImageUrl && matched.playerImageUrl) target.playerImageUrl = matched.playerImageUrl;
            if (!target.promoImageUrl && matched.promoImageUrl) target.promoImageUrl = matched.promoImageUrl;
            if (!target.playerImageFallbackUrl && matched.playerImageFallbackUrl) target.playerImageFallbackUrl = matched.playerImageFallbackUrl;
            if (!target.nationImageUrl && matched.nationImageUrl) target.nationImageUrl = matched.nationImageUrl;
            if (!target.clubImageUrl && matched.clubImageUrl) target.clubImageUrl = matched.clubImageUrl;
            if (!target.leagueImageUrl && matched.leagueImageUrl) target.leagueImageUrl = matched.leagueImageUrl;
            if (!target.leagueName && matched.leagueName) target.leagueName = matched.leagueName;
            if (!target.leagueImageFallbacks && matched.leagueImageFallbacks) target.leagueImageFallbacks = matched.leagueImageFallbacks;
            if ((!target.playstylesPlus || !target.playstylesPlus.length) && matched.playstylesPlus?.length) target.playstylesPlus = matched.playstylesPlus;
            if (!target.stats && matched.stats) target.stats = matched.stats;
            if (!target.position && matched.position) target.position = matched.position;
            if (!target.futbinId && matched.futbinId) target.futbinId = matched.futbinId;
            if (!target.versionLabel && matched.versionLabel) target.versionLabel = matched.versionLabel;
          }
        }
        if (i < state.targets.length - 1) {
          await wait(250);
        }
      }
      saveTargets();
      setTargetStatus({ type: 'success', message: `${updatedCount} oyuncunun fiyatı ve SATIN AL hedefleri kâr marjına göre güncellendi.` });
    } catch (err) {
      setTargetStatus({ type: 'error', message: 'Fiyat güncelleme sırasında hata oluştu.' });
    } finally {
      isUpdatingPrices = false;
      updatePricesBtn.classList.remove('is-updating');
      renderTargetContent(content);
    }
  });

  searchRow.append(searchInput, updatePricesBtn);
  const searchResults = document.createElement('div');
  searchResults.className = 'fr-target-search-results';
  searchResults.hidden = true;
  searchBox.append(searchRow, searchResults);

  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    const query = searchInput.value.trim();
    if (query.length < 3) {
      searchResults.hidden = true;
      searchResults.replaceChildren();
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const players = await searchUniquePlayers(query);
        if (searchInput.value.trim() !== query) return;
        searchResults.replaceChildren();
        if (!players.length) {
          const emptyItem = document.createElement('div');
          emptyItem.className = 'fr-search-item-empty';
          emptyItem.textContent = 'Sonuç bulunamadı.';
          searchResults.appendChild(emptyItem);
        } else {
          players.forEach((player) => {
            const item = document.createElement('div');
            item.className = 'fr-search-result-item fr-search-player-item';
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');

            const nameEl = document.createElement('div');
            nameEl.className = 'fr-search-item-name';
            nameEl.textContent = player.name;

            const ratingBadge = document.createElement('span');
            ratingBadge.className = 'fr-search-player-rating-badge';
            ratingBadge.textContent = String(player.baseRating || player.highestRating || '');

            item.append(nameEl, ratingBadge);
            item.addEventListener('click', () => {
              state.pendingCandidates = {
                name: player.name,
                candidates: player.versions,
                price: player.baseCard?.price || player.highestCard?.price || 0
              };
              renderTargetContent(content);
            });
            searchResults.appendChild(item);
          });
        }
        searchResults.hidden = false;
      } catch (err) {
        searchResults.hidden = true;
      }
    }, 300);
  });

  targetView.insertBefore(searchBox, list);

  // Üstte Özet Çubuğu (Bölüm 3.4)
  let summaryBar = null;
  const updateSummaryBar = () => {
    if (!summaryBar) return;
    let totalTargetCards = 0;
    let totalCoinsNeeded = 0;
    let totalEstProfit = 0;
    state.targets.forEach((t) => {
      const buy = Number(t.buyNow) || 0;
      const searches = Math.max(1, Math.round(Number(t.searches) || 1));
      const fbPrice = Number(t.price) || 0;
      totalTargetCards += searches;
      totalCoinsNeeded += buy * searches;
      if (fbPrice > 0) {
        totalEstProfit += (Math.round(fbPrice * 0.95) - buy) * searches;
      }
    });
    const bal = state.currentBalance !== undefined ? state.currentBalance : getBalance();
    const balText = bal === null ? '<span style="color: #f59e0b;">Okunamıyor</span>' : `${Number(bal).toLocaleString('tr-TR')}`;
    summaryBar.innerHTML = `
      <span class="fr-summary-item">Hedef: <strong class="fr-summary-val">${totalTargetCards}</strong></span>
      <span class="fr-summary-item">Gereken: <strong class="fr-summary-val">${totalCoinsNeeded.toLocaleString('tr-TR')}</strong></span>
      <span class="fr-summary-item">Tahmini Kâr: <strong class="fr-summary-val fr-summary-profit">${totalEstProfit > 0 ? '+' : ''}${totalEstProfit.toLocaleString('tr-TR')}</strong></span>
      <span class="fr-summary-item fr-summary-balance">Bakiye: <strong class="fr-summary-balance-val">${balText}</strong></span>
    `;
  };

  if (state.targets.length > 0) {
    summaryBar = document.createElement('div');
    summaryBar.className = 'fr-target-summary-bar';
    updateSummaryBar();
    targetView.insertBefore(summaryBar, list);
  }

  // Aday Kart Seçici (Pending Candidates)
  if (state.pendingCandidates && Array.isArray(state.pendingCandidates.candidates)) {
    const selector = document.createElement('div');
    selector.className = 'fr-candidate-selector';

    const header = document.createElement('div');
    header.className = 'fr-candidate-header';
    const headerTitle = document.createElement('span');
    headerTitle.textContent = state.pendingCandidates.name + ' Sürümünü Seçin:';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'fr-candidate-cancel';
    cancelBtn.textContent = '×';
    cancelBtn.setAttribute('aria-label', 'Seçimi iptal et');
    cancelBtn.addEventListener('click', () => {
      state.pendingCandidates = null;
      setTargetStatus({ type: 'info', message: 'Kart seçimi iptal edildi.' });
      emit('targets:changed');
    });
    header.append(headerTitle, cancelBtn);
    selector.appendChild(header);

    const candidateList = document.createElement('div');
    candidateList.className = 'fr-candidate-list';

    state.pendingCandidates.candidates.forEach((candidate) => {
      const card = document.createElement('div');
      card.className = 'fr-candidate-card';

      if (candidate.promoImageUrl || candidate.playerImageUrl) {
        const cardPreview = createEaCardElement(candidate, { size: 'thumb' });
        card.appendChild(cardPreview);
      }

      const body = document.createElement('div');
      body.className = 'fr-candidate-body';

      const title = document.createElement('div');
      title.className = 'fr-candidate-title';
      const name = document.createElement('span');
      name.className = 'fr-candidate-name';
      name.textContent = candidate.name;
      const rating = document.createElement('span');
      rating.className = 'fr-candidate-rating';
      rating.textContent = String(candidate.rating || '—');
      title.append(name, rating);

      const badge = document.createElement('div');
      badge.className = 'fr-candidate-badge' + (candidate.isHolo ? ' fr-candidate-badge-holo' : '');
      badge.textContent = candidate.versionLabel || 'Özel';

      const meta = document.createElement('div');
      meta.className = 'fr-candidate-meta';
      const leagueText = candidate.leagueName ? ' · ' + candidate.leagueName : '';
      meta.textContent = 'FutBIN ' + candidate.futbinId + ' · resource ' + candidate.eaId + leagueText;

      const priceEl = document.createElement('div');
      priceEl.className = 'fr-candidate-price';
      const candidatePriceVal = Number(candidate.price) || 0;
      priceEl.textContent = candidatePriceVal > 0
        ? `${getPlatform().toUpperCase()} fiyat: ${candidatePriceVal.toLocaleString('tr-TR')}`
        : (candidate.raw ? formatFutbinRowPrice(candidate.raw, getPlatform()) : 'Fiyat yok');

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'fr-candidate-btn';
      selectBtn.textContent = 'Bu kartı ekle';
      selectBtn.addEventListener('click', async () => {
        if (!candidate.playstylesPlus || !candidate.playstylesPlus.length) {
          try {
            const details = await fetchPlayerDetailsFromFutbinApi({
              name: candidate.name,
              rating: candidate.rating,
              eaId: candidate.eaId,
              futbinId: candidate.futbinId
            });
            if (details) {
              if (details.playstylesPlus?.length) candidate.playstylesPlus = details.playstylesPlus;
              if (!candidate.stats && details.stats) candidate.stats = details.stats;
              if (!candidate.leagueImageUrl && details.leagueImageUrl) candidate.leagueImageUrl = details.leagueImageUrl;
              if (!candidate.clubImageUrl && details.clubImageUrl) candidate.clubImageUrl = details.clubImageUrl;
              if (!candidate.nationImageUrl && details.nationImageUrl) candidate.nationImageUrl = details.nationImageUrl;
            }
          } catch (_) {}
        }
        commitCandidateTarget(candidate);
        renderTargetContent(content);
      });

      body.append(title, badge, meta, priceEl, selectBtn);
      card.appendChild(body);
      candidateList.appendChild(card);
    });

    selector.appendChild(candidateList);
    content.querySelector('.fr-target-view').insertBefore(selector, list);
  }

  if (!state.targets.length) {
    const empty = document.createElement('div');
    empty.className = 'fr-target-empty';
    empty.textContent = 'Henüz oyuncu hedefi yok.';
    list.appendChild(empty);
  }

  state.targets.forEach((player, index) => {
    if (!player.priceUpdatedAt) {
      player.priceUpdatedAt = Date.now();
    }
    const isPriceExceeded = isExceedingFutbin(player.buyNow, player.price);
    const isSearchActive = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !isPriceExceeded);
    const card = document.createElement('div');
    card.className = 'fr-target-card' +
      (isSearchActive ? '' : ' is-search-inactive') +
      (player.insufficientBalance ? ' is-insufficient-balance' : '') +
      (isPriceExceeded ? ' is-price-exceeded' : '');
    card.setAttribute('role', 'listitem');

    if (player.playerImageUrl || player.promoImageUrl) {
      const previewCard = createEaCardElement(player, { size: 'preview' });
      card.appendChild(previewCard);
    }

    const body = document.createElement('div');
    body.className = 'fr-target-card-body';

    // 1. Üst Satır: Arama Aç/Kapat (solda, ismin üstü) + Son Güncelleme & Silme (sağda)
    const topBar = document.createElement('div');
    topBar.className = 'fr-target-card-top';

    const searchToggle = document.createElement('button');
    searchToggle.type = 'button';
    const toggleActive = !player.searchDisabled;
    searchToggle.className = 'fr-target-search-toggle ' + (toggleActive ? 'is-active' : 'is-inactive');
    searchToggle.innerHTML = `Arama: <span class="fr-search-toggle-status">${toggleActive ? 'Açık' : 'Kapalı'}</span>`;
    searchToggle.setAttribute('title', 'Aramayı Aç/Kapat');
    searchToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      player.searchDisabled = !player.searchDisabled;
      saveTargets();
      const active = !player.searchDisabled;
      searchToggle.className = 'fr-target-search-toggle ' + (active ? 'is-active' : 'is-inactive');
      searchToggle.innerHTML = `Arama: <span class="fr-search-toggle-status">${active ? 'Açık' : 'Kapalı'}</span>`;
      const priceExceeded = isExceedingFutbin(player.buyNow, player.price);
      card.classList.toggle('is-price-exceeded', priceExceeded);
      const isStillActive = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !priceExceeded);
      card.classList.toggle('is-search-inactive', !isStillActive);
    });

    const topRight = document.createElement('div');
    topRight.className = 'fr-target-top-right';

    if (player.insufficientBalance) {
      const insufficientBadge = document.createElement('span');
      insufficientBadge.className = 'fr-target-badge-insufficient';
      insufficientBadge.textContent = 'Bakiye Yetersiz';
      insufficientBadge.title = 'Maksimum alış fiyatı bakiyeden yüksek olduğu için arama atlanıyor';
      topRight.appendChild(insufficientBadge);
    }

    const lastUpdate = document.createElement('span');
    lastUpdate.className = 'fr-target-last-update';
    lastUpdate.dataset.updatedAt = String(player.priceUpdatedAt || 0);
    lastUpdate.textContent = formatRelativeTime(player.priceUpdatedAt);
    if (player.priceUpdatedAt) {
      lastUpdate.setAttribute('title', new Date(player.priceUpdatedAt).toLocaleString('tr-TR'));
    }

    const remove = document.createElement('button');
    remove.className = 'fr-target-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', player.name + ' hedefini sil');
    remove.addEventListener('click', () => {
      const [deletedPlayer] = state.targets.splice(index, 1);
      saveTargets();
      emit('targets:changed');
      updateSummaryBar();

      addMarketLog({
        text: `${deletedPlayer.name} hedeflerden silindi.`,
        undoAction: () => {
          state.targets.splice(Math.min(index, state.targets.length), 0, deletedPlayer);
          saveTargets();
          emit('targets:changed');
          renderTargetContent(content);
        }
      });
    });

    topRight.append(lastUpdate, remove);
    topBar.append(searchToggle, topRight);
    body.appendChild(topBar);

    // 2. Başlık ve Bilgiler
    const head = document.createElement('div');
    head.className = 'fr-target-card-head';
    const info = document.createElement('div');
    info.className = 'fr-target-info';
    const name = document.createElement('div');
    name.className = 'fr-target-name';
    name.textContent = player.name;
    const metaLine = document.createElement('div');
    metaLine.className = 'fr-target-meta-line';
    const rating = document.createElement('span');
    rating.className = 'fr-target-rating';
    rating.textContent = player.rating ? String(player.rating) : '—';
    metaLine.appendChild(rating);

    const effectiveVersion = player.versionLabel || (player.rating >= 75 ? 'Gold' : player.rating >= 65 ? 'Silver' : player.rating > 0 ? 'Bronze' : 'Base');
    const badge = document.createElement('span');
    badge.className = 'fr-target-version-badge';
    badge.textContent = effectiveVersion;
    metaLine.appendChild(badge);

    info.append(name, metaLine);
    head.appendChild(info);
    body.appendChild(head);

    // 3. Kontroller (Tur Sayısı ve Satın Al)
    let escalationControl = null;
    const controls = document.createElement('div');
    controls.className = 'fr-target-controls';
    [
      { key: 'searches', label: 'TUR SAYISI', step: 1, min: 1 },
      { key: 'buyNow', label: 'SATIN AL', step: 100, min: MIN_PRICE }
    ].forEach((control) => {
      const group = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'fr-target-control-title';
      title.textContent = control.label;

      let updateProfit = () => {};
      if (control.key === 'buyNow') {
        const profitEl = document.createElement('div');
        profitEl.className = 'fr-target-profit';
        updateProfit = (val) => {
          const futbinPrice = Number(player.price) || 0;
          const currentBuyNow = Number(val ?? player.buyNow) || 0;
          if (futbinPrice > 0) {
            const netProfit = Math.round(futbinPrice * 0.95) - currentBuyNow;
            const sign = netProfit > 0 ? '+' : '';
            profitEl.textContent = `Kâr: ${sign}${netProfit.toLocaleString('tr-TR')}`;
            profitEl.className = 'fr-target-profit ' + (netProfit >= 0 ? 'is-profit' : 'is-loss');
          } else {
            profitEl.textContent = 'Kâr: —';
            profitEl.className = 'fr-target-profit';
          }
        };
        updateProfit(player.buyNow);
        group.append(profitEl, title);
      } else {
        group.appendChild(title);
      }

      const counter = document.createElement('div');
      counter.className = 'fr-target-counter fr-target-counter-editable';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', control.label + ' azalt');
      const formatVal = (k, v) => k === 'buyNow' ? Number(v).toLocaleString('tr-TR') : String(v);
      const parseVal = (k, s) => {
        if (k === 'buyNow') {
          const clean = String(s || '').replace(/[.\s]/g, '').replace(/,/g, '.');
          return clean === '' ? NaN : Number(clean);
        }
        return s === '' ? NaN : Number(s);
      };
      const value = document.createElement('input');
      value.className = 'fr-target-counter-input';
      value.type = 'text';
      value.inputMode = 'numeric';
      value.setAttribute('aria-label', control.label + ' değeri');
      value.value = formatVal(control.key, player[control.key]);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', control.label + ' artır');

      const change = (direction, multiplier = 1) => {
        const current = Number(player[control.key]);
        if (control.key === 'buyNow') {
          let nextVal = current;
          for (let i = 0; i < multiplier; i++) {
            if (direction > 0) {
              nextVal = nextPriceUp(nextVal);
            } else {
              nextVal = nextPriceDown(nextVal);
              if (nextVal <= MIN_PRICE) break;
            }
          }
          player.buyNow = clampPrice(nextVal);
          if (player.escalation && (player.escalation.steps > 0 || player.escalation.activeMs > 0)) {
            resetEscalationOnManualChange(player);
            addMarketLog({
              text: `🔄 [Fiyat Artırma] ${player.name}: SATIN AL elle değiştirildi, artırma basamakları sıfırlandı.`,
              type: 'info'
            });
          }
        } else {
          const step = control.step * multiplier;
          player[control.key] = Math.max(control.min, current + direction * step);
        }
        saveTargets();
        value.value = formatVal(control.key, player[control.key]);
        if (control.key === 'buyNow') {
          updateProfit(player.buyNow);
          escalationControl?.refresh();
          const priceExceeded = isExceedingFutbin(player.buyNow, player.price);
          card.classList.toggle('is-price-exceeded', priceExceeded);
          const active = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !priceExceeded);
          card.classList.toggle('is-search-inactive', !active);
        }
        updateSummaryBar();
      };

      value.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          change(1, e.shiftKey ? 10 : 1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          change(-1, e.shiftKey ? 10 : 1);
        }
      });

      value.addEventListener('input', () => {
        const entered = parseVal(control.key, value.value);
        if (Number.isSafeInteger(entered) && entered >= control.min) {
          player[control.key] = entered;
          saveTargets();
          if (control.key === 'buyNow') {
            if (player.escalation && (player.escalation.steps > 0 || player.escalation.activeMs > 0)) {
              resetEscalationOnManualChange(player);
              addMarketLog({
                text: `🔄 [Fiyat Artırma] ${player.name}: SATIN AL elle değiştirildi, artırma basamakları sıfırlandı.`,
                type: 'info'
              });
            }
            updateProfit(entered);
            escalationControl?.refresh();
            const priceExceeded = isExceedingFutbin(entered, player.price);
            card.classList.toggle('is-price-exceeded', priceExceeded);
            const active = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !priceExceeded);
            card.classList.toggle('is-search-inactive', !active);
          }
          updateSummaryBar();
        }
      });

      const commitValue = () => {
        const enteredValue = parseVal(control.key, value.value);
        const completedValue = control.key === 'buyNow'
          ? (Number.isFinite(enteredValue) ? clampPrice(roundToPriceStep(enteredValue, 'nearest')) : NaN)
          : enteredValue;
        if (!Number.isSafeInteger(enteredValue) || enteredValue < control.min || completedValue < control.min) {
          value.value = formatVal(control.key, player[control.key]);
          setTargetStatus({
            type: 'error',
            message: control.label + ' için ' + control.min + ' veya daha büyük bir tam sayı girin.'
          });
          return;
        }
        if (control.key === 'buyNow') {
          const futbinPrice = Number(player.price) || 0;
          if (futbinPrice > 0 && completedValue > futbinPrice) {
            setTargetStatus({
              type: 'error',
              message: `Maksimum Fiyat Koruması: ${player.name} SATIN AL (${completedValue.toLocaleString('tr-TR')}) FutBIN piyasa fiyatını (${futbinPrice.toLocaleString('tr-TR')}) aşıyor! Tarama durdurulacaktır.`,
              holdMs: 25000
            });
            addMarketLog({
              text: `🛡️ [Fiyat Koruması] ${player.name}: SATIN AL (${completedValue.toLocaleString('tr-TR')}) FutBIN piyasa değerini (${futbinPrice.toLocaleString('tr-TR')}) aşıyor.`,
              type: 'warn'
            });
          } else {
            const capCheck = validatePriceCap(completedValue, player.price);
            if (!capCheck.allowed) {
              setTargetStatus({
                type: 'error',
                message: `Maksimum Fiyat Koruması: ${capCheck.reason}`,
                holdMs: 25000
              });
              addMarketLog({
                text: `🛡️ [Fiyat Koruması] ${player.name}: ${capCheck.reason}`,
                type: 'warn'
              });
            }
          }
        }
        player[control.key] = completedValue;
        value.value = formatVal(control.key, completedValue);
        saveTargets();
        if (control.key === 'buyNow') {
          if (player.escalation && (player.escalation.steps > 0 || player.escalation.activeMs > 0)) {
            resetEscalationOnManualChange(player);
            addMarketLog({
              text: `🔄 [Fiyat Artırma] ${player.name}: SATIN AL elle değiştirildi, artırma basamakları sıfırlandı.`,
              type: 'info'
            });
          }
          updateProfit(completedValue);
          escalationControl?.refresh();
          const priceExceeded = isExceedingFutbin(completedValue, player.price);
          card.classList.toggle('is-price-exceeded', priceExceeded);
          const active = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !priceExceeded);
          card.classList.toggle('is-search-inactive', !active);
        }
        updateSummaryBar();
      };

      value.addEventListener('change', commitValue);
      value.addEventListener('blur', commitValue);

      attachHoldRepeat(minus, (e) => change(-1, e?.shiftKey ? 10 : 1));
      attachHoldRepeat(plus, (e) => change(1, e?.shiftKey ? 10 : 1));
      counter.append(minus, value, plus);
      group.append(counter);
      controls.appendChild(group);
    });
    body.appendChild(controls);

    // Otomatik Fiyat Artırma Kontrolü
    escalationControl = createEscalationControl(player, () => updateSummaryBar());
    body.appendChild(escalationControl.container);

    // 4. Alt Bilgi: FutBIN Logosu, Fiyat ve Trend Oku (sağ en alt)
    const bottomBar = document.createElement('div');
    bottomBar.className = 'fr-target-card-bottom';
    const futbinPriceEl = document.createElement('span');
    futbinPriceEl.className = 'fr-target-futbin-price';
    const fbVal = Number(player.price) || 0;
    let trendHtml = '';
    const tooltipText = formatPriceHistoryTooltip(player);
    if (player.priceTrend === 'up') {
      trendHtml = ` <span class="fr-target-trend-up" title="${tooltipText}" role="button" aria-label="Fiyat arttı">▲</span>`;
    } else if (player.priceTrend === 'down') {
      trendHtml = ` <span class="fr-target-trend-down" title="${tooltipText}" role="button" aria-label="Fiyat düştü">▼</span>`;
    } else if (player.priceTrend === 'same') {
      trendHtml = ` <span class="fr-target-trend-same" title="${tooltipText}" role="button" aria-label="Fiyat değişmedi">■</span>`;
    }
    const iconHtml = `<img src="${FUTBIN_ICON_DATA}" class="fr-target-futbin-icon" width="12" height="12" alt="FutBIN" />`;
    futbinPriceEl.innerHTML = fbVal > 0 ? `${iconHtml} <span>${fbVal.toLocaleString('tr-TR')}</span>${trendHtml}` : `${iconHtml} <span>—</span>`;
    bottomBar.appendChild(futbinPriceEl);
    body.appendChild(bottomBar);

    card.appendChild(body);
    list.appendChild(card);
  });

  if (state.targets.length > 0) {
    lastUpdateInterval = setInterval(() => {
      if (!content.isConnected) {
        clearInterval(lastUpdateInterval);
        lastUpdateInterval = null;
        return;
      }
      content.querySelectorAll('.fr-target-last-update').forEach((el) => {
        const ts = Number(el.dataset.updatedAt);
        if (ts) el.textContent = formatRelativeTime(ts);
      });
    }, 10000);
  }

  content.querySelector('[data-filter-mode="save"]').addEventListener('click', () => {
    if (!state.targets.length) {
      setTargetStatus({ type: 'error', message: 'Kaydedilecek oyuncu hedefi bulunmuyor.' });
      renderTargetContent(content);
      return;
    }
    emit('ui:open-save-dialog');
  });
  content.querySelector('[data-filter-mode="load"]').addEventListener('click', () => emit('ui:open-filter-modal', { mode: 'load' }));
}
