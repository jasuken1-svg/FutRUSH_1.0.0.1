// EA Kart Detay Paneli (DetailPanel / .ut-button-group) entegrasyonu.
// Squads (Kadrolar), Club (Kulüp), Transfer List (Unlisted) ve Unassigned Items
// sekmelerinde bir karta tiklaninca sagda acilan detay panelinin aksiyon buton
// grubuna (.ut-button-group) "🔎 En Düşük Fiyatlar" butonunu enjekte eder.
//
// Akis:
//  1. Butona tiklaninca secili kart (itemEntity) icin findLowestMarketPrice calisir
//     (buton disabled/"Aranıyor..." durumuna gecer).
//  2. Sonuctaki topPrices (en dusuk 1./2./3. fiyat, adet max x21) ayni grup icinde
//     tiklanabilir 3 secenek olarak gosterilir: [ 1) 1.200 (x3) ] [ 2) ... ] [ 3) ... ]
//  3. Secilen fiyat, panelin "Transfer Pazarında Listele" (Quick List /
//     ut-quick-list-panel-view) bolumundeki Baslangic Fiyati (Start Price = bir alt
//     kademe) ve Hemen Al Fiyati (Buy Now = secilen fiyat) inputlarina yazilir.
//     UTNumberInputSpinnerControl ile uyum icin hem kontrolun kendi API'si hem
//     native value setter kullanilir ve input/change/blur eventleri tetiklenir.

import { pageWindow, visibleElement } from '../../utils/dom.js';
import { findLowestMarketPrice, getItemDefId } from '../../ea/lowestMarketPrice.js';
import { getNextLowerPrice } from '../../ea/priceSteps.js';
import { addMarketLog } from '../marketLogBox.js';

const BTN_CLASS = 'fr-detail-lowest-btn';
const RESULTS_CLASS = 'fr-detail-lowest-results';
const ITEM_CLASS = 'fr-detail-price-option';
const GROUP_SELECTOR = '.ut-button-group';
const QUICK_LIST_SCOPE_SELECTOR = '.ut-quick-list-panel-view';
const INJECT_DEBOUNCE_MS = 250;
const DEFAULT_BTN_TEXT = '🔎 En Düşük Fiyatlar';

let observer = null;
let injectTimer = null;

const formatPrice = (value) => Number(value || 0).toLocaleString('tr-TR');

// ---- Secili kart varligini (itemEntity) EA nesnelerinden cozumler ----

function isItemLike(entity) {
  if (!entity || typeof entity !== 'object') return false;
  if (typeof entity.getSearchType === 'function' && typeof entity.getAuctionData === 'function') return true;
  return Boolean(entity._auction && entity.definitionId);
}

function findItemEntityInObject(obj, seen, depth) {
  if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 6) return null;
  seen.add(obj);
  if (isItemLike(obj)) return obj;
  const keys = ['item', 'itemEntity', '_item', 'selectedItem', 'currentItem', 'displayedItem',
    'auctionItem', '_auctionItem', 'data', '_data', 'model', '_viewmodel', 'viewModel',
    'controller', '_controller', 'presentedViewController', 'detailPanel'];
  for (const key of keys) {
    try {
      const found = findItemEntityInObject(obj[key], seen, depth + 1);
      if (found) return found;
    } catch (e) {}
  }
  return null;
}

function resolveSelectedCard() {
  const win = pageWindow;
  // 1) Global secim degiskenleri (EA surumlerine gore farkli adlandirilir).
  const globals = [win.__FUTRUSH_SELECTED_ITEM__, win.selectedItem, win.currentItem];
  for (const candidate of globals) {
    if (isItemLike(candidate)) return candidate;
  }
  // 2) Ana uygulama controller agaci (detay paneli sunulan viewcontroller'dadir).
  try {
    const app = win.getAppMain ? win.getAppMain() : null;
    const root = app && app.getRootViewController ? app.getRootViewController() : null;
    const presented = root && root.getPresentedViewController ? root.getPresentedViewController() : null;
    const current = root && root.getCurrentViewController ? root.getCurrentViewController() : null;
    for (const scope of [presented, current, root, app]) {
      const found = findItemEntityInObject(scope, new WeakSet(), 0);
      if (found) return found;
    }
  } catch (e) {}
  // 3) services.Item uzerindeki son arama/secim verisi.
  try {
    const service = win.services && win.services.Item;
    const found = findItemEntityInObject(service, new WeakSet(), 0);
    if (found) return found;
  } catch (e) {}
  return null;
}

// ---- UTNumberInputSpinnerControl ile uyumlu deger yazma ----

function fireEvent(el, type) {
  try {
    const Ctor = pageWindow.Event || window.Event;
    el.dispatchEvent(new Ctor(type, { bubbles: true }));
  } catch (e) {}
}

function setSpinnerValue(spin, rawValue) {
  const value = String(Math.max(0, Math.round(Number(rawValue) || 0)));
  let handledByApi = false;
  const control = spin._utControl || spin.control ||
    (spin.closest && spin.closest('.ut-number-input-spinner'));
  if (control) {
    // Kontrolun kendi API'si varsa once onu kullan (EA internal state'i de gunceller).
    try {
      if (typeof control.setValue === 'function') { control.setValue(Number(value)); handledByApi = true; }
      else if (typeof control.updateValue === 'function') { control.updateValue(Number(value)); handledByApi = true; }
    } catch (e) {}
    try {
      const vm = control._viewmodel || control.viewmodel || control.viewModel;
      if (vm && typeof vm.set === 'function') vm.set('value', Number(value));
    } catch (e) {}
  }
  // Native input degerini framework setter korumasiyla yaz.
  try {
    const proto = Object.getPrototypeOf(spin);
    const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(spin, value);
    else spin.value = value;
  } catch (e) {
    try { spin.value = value; } catch (e2) {}
  }
  fireEvent(spin, 'input');
  fireEvent(spin, 'change');
  // UT kontrolleri genelde blur/focusout ile commit eder.
  fireEvent(spin, 'blur');
  if (!handledByApi && control && typeof control.refresh === 'function') {
    try { control.refresh(); } catch (e) {}
  }
}

// Quick List panelindeki Start Price / Buy Now spinner'larini bulur.
// Oncelik: id/name/data-attribute/label eslesmesi; yoklukta DOM sirasi (Start -> BIN).
function findQuickListInputs(group) {
  const scope = group && group.closest ? group.closest(QUICK_LIST_SCOPE_SELECTOR) : null;
  const root = scope || document;
  const spins = Array.from(root.querySelectorAll('.ut-number-input-spinner')).filter(visibleElement);
  if (!spins.length) return { start: null, buyNow: null };

  const classify = (el) => {
    const haystack = [
      el.id, el.name,
      el.getAttribute && el.getAttribute('aria-label'),
      el.getAttribute && el.getAttribute('data-qa-id'),
      el.getAttribute && el.getAttribute('data-qa-automation-name'),
      el.className
    ].filter(Boolean).join(' ').toLowerCase();
    if (/buynow|buy-now|sofort|bin/.test(haystack)) return 'buynow';
    if (/start|minbid|min-bid|opening|bid/.test(haystack)) return 'start';
    const labelEl = (el.labels && el.labels[0]) ||
      (el.closest && el.closest('label')) ||
      (el.parentElement && el.parentElement.previousElementSibling);
    const labelText = labelEl ? String(labelEl.textContent || '').toLowerCase() : '';
    if (/hemen al|buy now|sofortkauf/.test(labelText)) return 'buynow';
    if (/başlangıç|start price|startpreis|opening|min\.? gebot|asgari/.test(labelText)) return 'start';
    return null;
  };

  let start = null;
  let buyNow = null;
  for (const spin of spins) {
    const kind = classify(spin);
    if (kind === 'start' && !start) start = spin;
    else if (kind === 'buynow' && !buyNow) buyNow = spin;
  }
  // Eslesme yoksa: Quick List panelinde tipik sira once Start sonra Buy Now'dir.
  if (!start && !buyNow && spins.length >= 2) {
    start = spins[0];
    buyNow = spins[1];
  } else if (!buyNow && start && spins.length >= 2) {
    buyNow = spins.find((el) => el !== start) || null;
  } else if (!start && buyNow && spins.length >= 2) {
    start = spins.find((el) => el !== buyNow) || null;
  }
  return { start, buyNow };
}

function applyToQuickList(group, selectedPrice) {
  const { start, buyNow } = findQuickListInputs(group);
  if (!start && !buyNow) {
    addMarketLog({ text: `⚠️ [En Düşük Fiyatlar] Quick List girişleri bulunamadı; fiyat uygulanamadı (seçilen: ${formatPrice(selectedPrice)}).`, type: 'warn' });
    return false;
  }
  const binValue = Math.max(0, Math.round(Number(selectedPrice) || 0));
  const startValue = getNextLowerPrice(binValue) || binValue;
  if (buyNow) setSpinnerValue(buyNow, binValue);
  if (start) setSpinnerValue(start, startValue);
  addMarketLog({
    text: `💰 [En Düşük Fiyatlar] Seçilen: ${formatPrice(binValue)} → Hemen Al: ${formatPrice(binValue)}, Başlangıç: ${formatPrice(startValue)} inputlarına yazıldı.`,
    type: 'info'
  });
  return true;
}

// ---- Buton grubu enjeksiyonu ----

function renderResults(container, result, group) {
  container.innerHTML = '';
  const topPrices = (result && Array.isArray(result.topPrices)) ? result.topPrices : [];
  for (const tier of topPrices.slice(0, 3)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ut-btn ${ITEM_CLASS}`;
    const count = Math.min(21, Math.max(1, Number(tier.count) || 1));
    btn.textContent = `${tier.rank}) ${formatPrice(tier.price)} (x${count})`;
    btn.title = `Başlangıç: ${formatPrice(getNextLowerPrice(tier.price) || tier.price)} • Hemen Al: ${formatPrice(tier.price)} — tıklayınca Quick List inputlarına yazılır`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll(`.${ITEM_CLASS}`).forEach((el) => el.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      applyToQuickList(group, tier.price);
    });
    container.appendChild(btn);
  }
}

function ensureControls(group) {
  if (!group || group.nodeType !== 1) return;
  if (group.querySelector(`.${BTN_CLASS}`)) return; // zaten enjekte edildi

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `ut-btn ${BTN_CLASS}`;
  btn.textContent = DEFAULT_BTN_TEXT;
  btn.title = 'Bu kart için pazardaki en düşük 1., 2. ve 3. Hemen Al fiyatlarını ara';

  const results = document.createElement('span');
  results.className = RESULTS_CLASS;

  let searching = false;
  const restoreText = (delayMs) => {
    setTimeout(() => {
      if (!searching && btn.isConnected) btn.textContent = DEFAULT_BTN_TEXT;
    }, delayMs);
  };
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (searching) return;
    const itemEntity = resolveSelectedCard();
    if (!itemEntity || !getItemDefId(itemEntity)) {
      btn.textContent = 'Kart seçili değil';
      restoreText(2500);
      return;
    }
    searching = true;
    btn.disabled = true;
    btn.textContent = 'Aranıyor...';
    results.innerHTML = '';
    try {
      const result = await findLowestMarketPrice(itemEntity, { gapMs: [150, 400] });
      if (!result || !result.ok || !(result.price > 0)) {
        if (result && result.extinct) {
          btn.textContent = 'Markette yok';
          addMarketLog({ text: '🔎 [En Düşük Fiyatlar] Markette kart bulunamadı (Extinct).', type: 'warn' });
        } else {
          btn.textContent = 'Arama başarısız';
          addMarketLog({ text: `⚠️ [En Düşük Fiyatlar] ${String((result && result.error && result.error.message) || 'EA araması başarısız')}`, type: 'warn' });
        }
        restoreText(4000);
        return;
      }
      renderResults(results, result, group);
      btn.textContent = DEFAULT_BTN_TEXT;
    } catch (err) {
      btn.textContent = 'Hata';
      restoreText(4000);
      addMarketLog({ text: `❌ [En Düşük Fiyatlar] ${String(err?.message || err)}`, type: 'error' });
    } finally {
      searching = false;
      btn.disabled = false;
    }
  });

  group.appendChild(btn);
  group.appendChild(results);
}

function injectIntoVisibleGroups(root) {
  const scope = root && root.querySelectorAll ? root : document;
  const groups = Array.from(scope.querySelectorAll(GROUP_SELECTOR));
  for (const group of groups) {
    if (!visibleElement(group)) continue;
    ensureControls(group);
  }
}

function scheduleInject() {
  if (injectTimer !== null) clearTimeout(injectTimer);
  injectTimer = setTimeout(() => {
    injectTimer = null;
    try { injectIntoVisibleGroups(document); } catch (e) {}
  }, INJECT_DEBOUNCE_MS);
}

export function initDetailLowestPrices() {
  if (observer || typeof MutationObserver === 'undefined' || !document.body) return;
  observer = new MutationObserver(scheduleInject);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleInject();
}

export function destroyDetailLowestPrices() {
  if (observer) {
    try { observer.disconnect(); } catch (e) {}
    observer = null;
  }
  if (injectTimer !== null) {
    clearTimeout(injectTimer);
    injectTimer = null;
  }
  document.querySelectorAll(`.${BTN_CLASS}, .${RESULTS_CLASS}`).forEach((el) => el.remove());
}

// Test / elle tetikleme icin disa actigimiz saf yardimcilar.
export const __internals__ = {
  isItemLike,
  resolveSelectedCard,
  findQuickListInputs,
  setSpinnerValue,
  applyToQuickList,
  ensureControls,
  renderResults
};
