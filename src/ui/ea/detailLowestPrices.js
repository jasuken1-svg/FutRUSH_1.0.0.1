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
import { findLowestMarketPrice, getItemDefId, makeLowestMarketCriteria } from '../../ea/lowestMarketPrice.js';
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
  return ['definitionId', '_definitionId', 'defId', 'assetId', 'itemId', 'cardId']
    .some((key) => Number(entity[key]) > 0) || Boolean(entity._auction && getDefIdLoose(entity));
}

// Kart tanimi icin genis alan listesi (EA surumlerine gore degisken adlar).
const DEF_ID_FIELDS = [
  'definitionId', '_definitionId', 'defId', 'id', '_id', 'itemId', 'assetId', 'baseId', 'cardId'
];

function getDefIdLoose(entity) {
  if (!entity || typeof entity !== 'object') return 0;
  // 1) Bilinen dogrudan alanlar.
  for (const key of DEF_ID_FIELDS) {
    try {
      const n = Number(entity[key]);
      if (Number.isFinite(n) && n > 0) return n;
    } catch (e) {}
  }
  // 2) getItemDefinition / getDefinition gibi API'ler.
  try {
    const def = typeof entity.getItemDefinition === 'function' ? entity.getItemDefinition()
      : typeof entity.getDefinition === 'function' ? entity.getDefinition() : null;
    const n = Number(def && (def.definitionId ?? def.id));
    if (Number.isFinite(n) && n > 0) return n;
  } catch (e) {}
  // 3) auction/item alt nesneleri.
  try {
    const inner = (typeof entity.getAuctionData === 'function' && entity.getAuctionData())
      || entity._auction || entity.item || entity.auctionItem || null;
    const n = Number(inner && (inner.item?.definitionId ?? inner.definitionId ?? inner.tradeId));
    if (Number.isFinite(n) && n > 0) return n;
  } catch (e) {}
  return 0;
}

// Detay paneli DOM'unu tarayarak kart kimligini (data-* / id nitelikleri) oku.
// Yalnizca panel kapsayicisi ve dogrudan ebeveyni taranir; buton grubunun kendi
// alt agaci tum kart listelerini icerdiginden yanlis defId üretebilir (atlanır).
function readCardIdsFromDom(group) {
  const result = { definitionId: 0, tradeId: 0 };
  if (!group || !group.closest) return result;
  const attrNames = [
    'data-definition-id', 'data-definitionid', 'data-defid', 'data-item-id', 'data-itemid',
    'data-card-id', 'data-id', 'data-trade-id', 'data-tradeid', 'data-auction-id'
  ];
  const readNode = (node) => {
    if (!node?.getAttribute) return;
    for (const attr of attrNames) {
      const raw = node.getAttribute(attr);
      if (!raw) continue;
      const n = Number(String(raw).replace(/[^0-9]/g, ''));
      if (!Number.isFinite(n) || n <= 0) continue;
      if (/trade|auction/.test(attr)) { if (!result.tradeId) result.tradeId = n; }
      else if (!result.definitionId) result.definitionId = n;
    }
  };
  // EA detail wrappers do not use a consistent class name. Walk the button
  // group's ancestors so IDs on the active panel are found without relying on
  // a particular tab's markup.
  let node = group;
  let depth = 0;
  while (node && depth < 10) {
    readNode(node);
    if (result.definitionId || result.tradeId) return result;
    node = node.parentElement;
    depth += 1;
  }
  return result;
}

// services.Item aramalarindan kalan son sonuc dizisi / secim referanslari.
function findItemEntityInObject(obj, seen, depth) {
  if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 6) return null;
  seen.add(obj);
  if (isItemLike(obj)) return obj;
  if (Array.isArray(obj)) {
    for (const child of obj.slice(0, 30)) {
      const found = findItemEntityInObject(child, seen, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const keys = [
    'item', 'itemEntity', '_item', 'selectedItem', '_selectedItem', 'currentItem',
    '_currentItem', 'displayedItem', 'selectedCard', 'activeItem', 'focusedItem',
    'auctionItem', '_auctionItem', 'itemData', 'data', '_data', 'props', 'children',
    'state', 'model', '_viewmodel', 'viewModel', 'controller', '_controller',
    'presentedViewController', 'detailPanel'
  ];
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
  // 3) Yalnizca servis uzerindeki acik secim referanslari. Arama sonucundaki
  // ilk kart secili kart degildir; onu kullanmak yanlis fiyati aratabilir.
  try {
    const service = win.services && win.services.Item;
    if (service) {
      const preferredKeys = [
        'selectedItem', '_selectedItem', 'currentItem', '_currentItem',
        'selectedItems', '_selectedItems', 'focusedItem', 'highlightedItem'
      ];
      for (const key of preferredKeys) {
        try {
          const val = service[key];
          const found = findItemEntityInObject(val, new WeakSet(), 0);
          if (found) return found;
        } catch (e) {}
      }
    }
  } catch (e) {}
  // 4) Genis tarama: controller agacinda itemEntity benzeri ilk nesne.
  try {
    const app = win.getAppMain ? win.getAppMain() : null;
    if (app) {
      const seen = new WeakSet();
      const queue = [{ obj: app, depth: 0 }];
      while (queue.length) {
        const { obj, depth } = queue.shift();
        if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 5) continue;
        seen.add(obj);
        if (isItemLike(obj)) return obj;
        let names = [];
        try { names = Object.keys(obj); } catch (e) {}
        for (const name of names.slice(0, 80)) {
          try { queue.push({ obj: obj[name], depth: depth + 1 }); } catch (e) {}
        }
      }
    }
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

// Detay paneli basligindaki kart adini oku (EA'da ornek: "Rodri · 87 ST").
function readPanelCardName(group) {
  if (!group || !group.closest) return '';
  const panel = group.closest('.ut-detail-panel, .ut-panel, [class*="detail"]') || document;
  if (!panel.querySelectorAll) return '';
  const nodes = Array.from(panel.querySelectorAll(
    '.ut-detail-panel-title, .ut-panel-title, h1, h2, h3, [class*="title"], [class*="name"]'
  )).slice(0, 40);
  for (const node of nodes) {
    const text = String(node.textContent || '').trim();
    // Cok uzun metinler / buton etiketleri baslik olamaz.
    if (text.length >= 2 && text.length <= 60 && !/[<>{}]/.test(text)) {
      return text.split(/[·|•\-–]\s*\d{2,3}\b/)[0].trim() || text;
    }
  }
  return '';
}

// Panel DOM'unun yanina EA'in kendi React/Fiber verisini gomulü olabilir; fiber
// dugumlerini tarayarak itemEntity benzeri bir nesne bulmayi dene.
function findItemViaReactFiber(group) {
  try {
    const panel = group.closest ? (group.closest('.ut-detail-panel, .ut-panel, [class*="detail"]') || group.parentElement) : null;
    if (!panel) return null;
    const roots = [panel, ...Array.from(panel.querySelectorAll('*')).slice(0, 300)];
    for (const el of roots) {
      if (!el) continue;
      let fiber = el.__reactInternalInstance$ || el._reactInternalFiber || null;
      if (!fiber) {
        for (const key of Object.keys(el)) {
          if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) { fiber = el[key]; break; }
        }
      }
      let hops = 0;
      while (fiber && hops < 40) {
        const props = fiber.memoizedProps || fiber.pendingProps;
        if (props) {
          const found = findItemEntityInObject(props, new WeakSet(), 0);
          if (found) return found;
        }
        fiber = fiber.return;
        hops += 1;
      }
    }
  } catch (e) {}
  return null;
}

// Secili kartin definitionId'sini cozumlemede son care: pazar arama sonucu
// dizisindeki (services.Item cache'i) kart adiyla eslesen ilk kart.
function resolveDefIdByName(group) {
  const name = readPanelCardName(group);
  if (!name) return 0;
  try {
    const service = pageWindow.services && pageWindow.services.Item;
    const caches = ['_lastSearchResult', 'lastSearchResult', '_searchResult', 'items', '_items'];
    for (const key of caches) {
      let list = null;
      try {
        const val = service && service[key];
        list = Array.isArray(val) ? val : (val && Array.isArray(val.items) ? val.items : null);
      } catch (e) {}
      if (!list) continue;
      for (const it of list) {
        try {
          const itemName = String(it?.fullName || it?.name || it?.getFullName?.() || '').trim();
          if (itemName && itemName.toLowerCase() === name.toLowerCase()) {
            const defId = getDefIdLoose(it);
            if (defId > 0) return defId;
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
  return 0;
}

// ---- Card (kart) secimini DOM MutationObserver ile yakala ----
// EA'da bir karta tiklandiginda detay paneli / ut-button-group DOM'a eklenir ya da
// icerigi guncellenir. Bu anda services.Item / controller agacindaki itemEntity
// referansi en taze halindedir; hemen kopyalanip saklanir. Boylece butona tiklandiginda
// ("Kart Seçili Değil" hatasinin onune gecmek icin) secim referansi hâlâ hazirdir.

let lastSelectedCard = null; // { itemEntity, defId, at } | null

function captureSelectedCard() {
  try {
    const itemEntity = resolveSelectedCard();
    if (!itemEntity) return;
    const defId = getItemDefId(itemEntity) || getDefIdLoose(itemEntity);
    if (!(defId > 0)) return;
    lastSelectedCard = { itemEntity, defId, at: Date.now() };
  } catch (e) {}
}

// ---- Secili kart cozumlemesi icin kisa onbellek (cache) ----
// resolveTargetForGroup cok asamali ve pahali bir tarama yapar (controller agaci,
// React fiber, DOM nitelikleri). Ayni grup icin saniyeler boyunca ayni sonucu
// tekrar tekrar uretmek yerine kisa omurlu cache kullanilir.
let cachedTarget = null; // { group, target, at }
const TARGET_CACHE_MS = 2000;

function resolveTargetForGroup(group) {
  if (cachedTarget && cachedTarget.group === group && (Date.now() - cachedTarget.at) < TARGET_CACHE_MS) {
    return cachedTarget.target;
  }
  const target = computeTargetForGroup(group);
  cachedTarget = { group, target, at: Date.now() };
  return target;
}

function computeTargetForGroup(group) {
  // 1) Bu detay paneline ait kart verisi.
  const fiberItem = findItemViaReactFiber(group);
  if (fiberItem) {
    const defId = getItemDefId(fiberItem) || getDefIdLoose(fiberItem);
    if (defId > 0) return { itemEntity: fiberItem, defId };
  }
  // 2) Aktif panel wrapper'indaki data-* kart kimlik nitelikleri.
  const domIds = readCardIdsFromDom(group);
  if (domIds.definitionId > 0) return { itemEntity: null, defId: domIds.definitionId };
  // 3) Panel basligindaki kart adini pazar cache'indeki kartlarla eslestir.
  const byName = resolveDefIdByName(group);
  if (byName > 0) return { itemEntity: null, defId: byName };
  // 4) App/service selection state, then a recent selection captured while
  // the panel was opening. Never let an old global selection override context.
  const itemEntity = resolveSelectedCard();
  if (itemEntity) {
    const defId = getItemDefId(itemEntity) || getDefIdLoose(itemEntity);
    if (defId > 0) return { itemEntity, defId };
  }
  if (lastSelectedCard && lastSelectedCard.defId > 0 && Date.now() - lastSelectedCard.at < 5000) {
    return lastSelectedCard;
  }
  return null;
}

async function runLowestSearch(btn, results, group, target) {
  searchingStates.set(btn, true);
  btn.disabled = true;
  btn.textContent = 'Aranıyor...';
  results.innerHTML = '';
  try {
    // findLowestMarketPrice ilk arguman olarak itemEntity bekler; yalnizca defId
    // cozulebildiyse (DOM niteligi / cache eslestirmesi) minimal bir sahte entity
    // uretilir — makeLowestMarketCriteria bu nesneyi standart akista kullanilir
    // hale getirir.
    const searchTarget = target.itemEntity || makeLowestMarketCriteria({ definitionId: target.defId });
    const result = await findLowestMarketPrice(searchTarget, { gapMs: [150, 400] });
    if (!result || !result.ok || !(result.price > 0)) {
      if (result && result.extinct) {
        btn.textContent = 'Markette yok';
        addMarketLog({ text: '🔎 [En Düşük Fiyatlar] Markette kart bulunamadı (Extinct).', type: 'warn' });
      } else {
        btn.textContent = 'Arama başarısız';
        addMarketLog({ text: `⚠️ [En Düşük Fiyatlar] ${String((result && result.error && result.error.message) || 'EA araması başarısız')}`, type: 'warn' });
      }
      restoreBtnText(group, btn, 4000);
      return;
    }
    renderResults(results, result, group);
    btn.textContent = DEFAULT_BTN_TEXT;
  } catch (err) {
    btn.textContent = 'Hata';
    restoreBtnText(group, btn, 4000);
    addMarketLog({ text: `❌ [En Düşük Fiyatlar] ${String(err?.message || err)}`, type: 'error' });
  } finally {
    searchingStates.set(btn, false);
    btn.disabled = false;
  }
}

const searchingStates = new WeakMap();

function restoreBtnText(group, btn, delayMs) {
  setTimeout(() => {
    if (!searchingStates.get(btn) && btn.isConnected) btn.textContent = DEFAULT_BTN_TEXT;
  }, delayMs);
}

function ensureControls(group) {
  if (!group || group.nodeType !== 1) return;
  let btn = group.querySelector(`.${BTN_CLASS}`);
  if (btn) { scheduleDiagnostics(); return; } // zaten enjekte edildi

  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `ut-btn ${BTN_CLASS}`;
  btn.textContent = DEFAULT_BTN_TEXT;
  btn.title = 'Bu kart için pazardaki en düşük 1., 2. ve 3. Hemen Al fiyatlarını ara';
  // EA panel animasyonlari butonlara pointer-events kapatabiliyor; garanti altina al.
  btn.style.pointerEvents = 'auto';

  const results = document.createElement('span');
  results.className = RESULTS_CLASS;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (searchingStates.get(btn)) return;

    // Secili kati cok asamali cozumle (yukarida aciklanan siralamayla).
    const target = resolveTargetForGroup(group);
    if (!target) {
      btn.textContent = 'Kart seçili değil';
      restoreBtnText(group, btn, 2500);
      return;
    }
    await runLowestSearch(btn, results, group, target);
  });

  group.appendChild(btn);
  group.appendChild(results);
}

// ---- Butonlarin tikanabilirligini tespit et (yalnizca browser console'a yazar) ----
let diagTimer = null;
function scheduleDiagnostics() {
  if (diagTimer !== null) return;
  diagTimer = setTimeout(() => {
    diagTimer = null;
    try { runClickDiagnostics(); } catch (e) {}
  }, 1500);
}

function runClickDiagnostics() {
  try {
    const btns = document.querySelectorAll(`.${BTN_CLASS}`);
    for (const btn of btns) {
      ['click', 'mousedown', 'mouseup'].forEach((type) => {
        btn.addEventListener(type, () => {
          try {
            console.info('[FutRUSH][EnDusukFiyatlar] buton uzerinde ' + type + ' alindi.',
              { text: btn.textContent, disabled: btn.disabled });
          } catch (e) {}
        }, true);
      });
    }
  } catch (e) {}
}

function injectIntoVisibleGroups(root) {
  const scope = root && root.querySelectorAll ? root : document;
  // Kart secimi degistiginde (panel DOM'u guncellendiginde) secim referansini tazele.
  captureSelectedCard();
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
  findItemEntityInObject,
  readCardIdsFromDom,
  computeTargetForGroup,
  resolveSelectedCard,
  findQuickListInputs,
  setSpinnerValue,
  applyToQuickList,
  ensureControls,
  renderResults
};
