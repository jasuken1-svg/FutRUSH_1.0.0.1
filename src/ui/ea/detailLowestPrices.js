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

import { visibleElement } from '../../utils/dom.js';
import { findLowestMarketPrice, getItemDefId } from '../../ea/lowestMarketPrice.js';
import { getNextLowerPrice } from '../../ea/priceSteps.js';
import { addMarketLog } from '../marketLogBox.js';

const pageWindow = (typeof unsafeWindow !== 'undefined' && unsafeWindow)
  ? unsafeWindow
  : (typeof window !== 'undefined' ? window : globalThis);
const BTN_CLASS = 'fr-detail-lowest-btn';
const RESULTS_CLASS = 'fr-detail-lowest-results';
const ITEM_CLASS = 'fr-detail-price-option';
const GROUP_SELECTOR = [
  '.ut-button-group', '.DetailView .ut-button-group', '.ut-item-details-view .ut-button-group',
  '.QuickListPanel .ut-button-group', '.ut-squad-slot-pedestal-view .ut-button-group',
  '.DetailPanel .ut-button-group', '.ut-quick-list-panel-view .ut-button-group',
  '.itemDetail .ut-button-group'
].join(', ');
const QUICK_LIST_SCOPE_SELECTOR = [
  '.ut-quick-list-panel-view', '.QuickListPanel', '.DetailPanel', '.DetailView',
  '.ut-item-details-view', '.ut-squad-slot-pedestal-view', '.itemDetail'
].join(', ');
const INJECT_DEBOUNCE_MS = 250;
const DEFAULT_BTN_TEXT = '🔎 En Düşük Fiyatlar';

let observer = null;
let injectTimer = null;

const formatPrice = (value) => Number(value || 0).toLocaleString('tr-TR');

// ---- Secili kart varligini (itemEntity) EA nesnelerinden cozumler ----

function isItemLike(entity) {
  if (!entity || typeof entity !== 'object') return false;
  if (typeof entity.getSearchType === 'function' && typeof entity.getAuctionData === 'function') return true;
  if (['definitionId', '_definitionId', 'defId', 'resourceId']
    .some((key) => Number(entity[key]) > 0)) return true;
  if (['assetId', 'baseId', 'itemId', 'cardId', 'maskedDefId']
    .some((key) => Number(entity[key]) > 0) && (entity._auction || entity.auctionItem || entity.type)) return true;
  const hasItemApi = entity._auction || entity.auctionItem ||
    typeof entity.getItemDefinition === 'function' ||
    typeof entity.getDefinition === 'function' ||
    typeof entity.getAuctionData === 'function' ||
    typeof entity.isPlayer === 'function';
  return Boolean(hasItemApi && getDefIdLoose(entity));
}

// Kart tanimi icin genis alan listesi (EA surumlerine gore degisken adlar).
const DEF_ID_FIELDS = [
  'definitionId', 'resourceId', '_definitionId', 'defId'
];

function getDefIdLoose(entity) {
  if (!entity || typeof entity !== 'object') return 0;
  // Only full definition/resource identifiers belong in the exact defId filter.
  for (const key of DEF_ID_FIELDS) {
    try {
      const n = Number(entity[key]);
      if (Number.isFinite(n) && n > 0) return n;
    } catch (e) {}
  }
  // getItemDefinition / getDefinition may expose the full version identifier.
  try {
    const def = typeof entity.getItemDefinition === 'function' ? entity.getItemDefinition()
      : typeof entity.getDefinition === 'function' ? entity.getDefinition() : null;
    const n = Number(def && (def.definitionId ?? def.resourceId ?? def.id));
    if (Number.isFinite(n) && n > 0) return n;
  } catch (e) {}
  for (const nested of [entity.data, entity._data, entity.item, entity._item, entity._entity]) {
    const n = Number(nested && (nested.definitionId ?? nested.resourceId));
    if (Number.isFinite(n) && n > 0) return n;
  }
  // 3) auction/item alt nesneleri.
  try {
    const inner = (typeof entity.getAuctionData === 'function' && entity.getAuctionData())
      || entity._auction || entity.item || entity.auctionItem || null;
    const n = Number(inner && (inner.item?.definitionId ?? inner.item?.resourceId ?? inner.definitionId ?? inner.resourceId));
    if (Number.isFinite(n) && n > 0) return n;
  } catch (e) {}
  return 0;
}

function getBaseIdLoose(entity) {
  if (!entity || typeof entity !== 'object') return 0;
  for (const key of ['baseId', 'assetId', 'maskedDefId']) {
    const value = Number(entity[key]);
    if (Number.isFinite(value) && value > 0) return value & 0xffffff;
  }
  for (const nested of [entity.data, entity._data, entity.item, entity._item, entity._entity]) {
    const value = Number(nested && (nested.baseId ?? nested.assetId ?? nested.maskedDefId));
    if (Number.isFinite(value) && value > 0) return value & 0xffffff;
  }
  return 0;
}

// Detay paneli DOM'unu tarayarak kart kimligini (data-* / id nitelikleri) oku.
// Yalnizca panel kapsayicisi ve dogrudan ebeveyni taranir; buton grubunun kendi
// alt agaci tum kart listelerini icerdiginden yanlis defId üretebilir (atlanır).
function readCardIdsFromDom(group) {
  const result = { definitionId: 0, baseId: 0, tradeId: 0 };
  if (!group) return result;
  const attrNames = [
    'data-definition-id', 'data-definitionid', 'data-defid', 'data-item-id', 'data-itemid',
    'data-card-id', 'data-id', 'data-resource-id', 'data-asset-id',
    'data-trade-id', 'data-tradeid', 'data-auction-id'
  ];
  const readNode = (node) => {
    if (!node?.getAttribute) return;
    for (const attr of attrNames) {
      const raw = node.getAttribute(attr);
      if (!raw) continue;
      const n = Number(String(raw).replace(/[^0-9]/g, ''));
      if (!Number.isFinite(n) || n <= 0) continue;
      if (/trade|auction/.test(attr)) { if (!result.tradeId) result.tradeId = n; }
      else if (/asset-id/.test(attr)) {
        if (!result.baseId) result.baseId = n & 0xffffff;
      } else if (!result.definitionId) {
        result.definitionId = n;
      }
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

function getItemEntityDefId(item) {
  return getItemDefId(item) || getDefIdLoose(item);
}

function getItemEntityBaseId(item) {
  return getBaseIdLoose(item) || (getItemEntityDefId(item) & 0xffffff);
}

function readItemReferenceFromElement(element) {
  let node = element;
  let depth = 0;
  while (node && depth < 12) {
    for (const candidate of [
      node._item, node.item, node.__item, node._entity,
      node._controller?._item, node._view?._item
    ]) {
      const item = findItemEntityInObject(candidate, new WeakSet(), 0);
      if (item) return item;
    }
    try {
      const jqueryData = typeof pageWindow.$ === 'function' ? pageWindow.$(node)?.data?.() : null;
      const item = findItemEntityInObject(jqueryData, new WeakSet(), 0);
      if (item) return item;
    } catch (e) {}
    node = node.parentElement;
    depth += 1;
  }
  return null;
}

function getCurrentViewController() {
  try {
    const app = pageWindow.getAppMain?.();
    const root = app?.getRootViewController?.();
    const presented = root?.getPresentedViewController?.();
    let current = presented?.getCurrentViewController?.()
      || root?.getCurrentViewController?.()
      || root?.currentController
      || null;
    for (let depth = 0; current && depth < 8; depth += 1) {
      const next = current.getCurrentViewController?.()
        || current.currentController
        || current._currentController;
      if (!next || next === current) break;
      current = next;
    }
    return current;
  } catch (e) {
    return null;
  }
}

function getCurrentViewModelItem(controller) {
  const viewModels = [
    controller?.viewmodel,
    controller?._viewmodel,
    controller?._viewModel,
    controller?.viewModel
  ];
  for (const viewModel of viewModels) {
    if (!viewModel) continue;
    for (const method of ['current', 'getSelectedItem', 'getCurrentItem', 'get']) {
      try {
        if (typeof viewModel[method] !== 'function') continue;
        const item = findItemEntityInObject(viewModel[method](), new WeakSet(), 0);
        if (item) return item;
      } catch (e) {}
    }
  }
  return null;
}

function getControllerItem(controller, paths) {
  for (const getValue of paths) {
    try {
      const item = findItemEntityInObject(getValue(controller), new WeakSet(), 0);
      if (item) return item;
    } catch (e) {}
  }
  return null;
}

function getCollectionItems(source) {
  if (!source) return null;
  if (Array.isArray(source)) return source;
  for (const value of [source.items, source._items, source.models, source._models, source._collection]) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.models)) return value.models;
  }
  try {
    const items = source.getItems?.();
    if (Array.isArray(items)) return items;
  } catch (e) {}
  return null;
}

function getListItemIndex(element) {
  const listItem = element?.closest?.('li.listFUTItem, .ut-item-row');
  if (!listItem?.parentElement) return null;
  const siblings = Array.from(listItem.parentElement.children).filter((sibling) =>
    sibling.matches('li.listFUTItem, .ut-item-row')
  );
  const index = siblings.indexOf(listItem);
  return index >= 0 ? { listItem, index } : null;
}

function resolveItemFromListIndex(element, currentController = getCurrentViewController()) {
  const indexed = getListItemIndex(element);
  if (!indexed) return null;
  const listControllerPaths = [
    (controller) => controller?._leftController,
    (controller) => controller?._listController,
    (controller) => controller?.leftController,
    (controller) => controller?.listController,
    (controller) => controller?._Controller?._leftController,
    (controller) => controller?._Controller?._listController,
    (controller) => controller?._rightController?._currentController,
    (controller) => controller?.rightController?.currentController,
    (controller) => controller?._listViewController
  ];
  for (const getController of listControllerPaths) {
    let controller;
    try { controller = getController(currentController); } catch (e) {}
    if (!controller) continue;
    const sources = [
      controller._viewmodel, controller._viewModel, controller._collection,
      controller.items, controller._items, controller._listViewController?._viewmodel,
      controller._listViewController?._collection
    ];
    for (const source of sources) {
      const items = getCollectionItems(source);
      const item = items?.[indexed.index];
      const entity = findItemEntityInObject(item, new WeakSet(), 0);
      if (entity) return entity;
    }
  }
  return null;
}

function getSquadSlotIndex(slot) {
  const slotId = Number(slot?.getAttribute?.('data-slot-id'));
  if (Number.isInteger(slotId) && slotId >= 0) return slotId;
  const index = Number(slot?.getAttribute?.('index'));
  if (Number.isInteger(index) && index >= 0) return index;
  const slots = Array.from(document.querySelectorAll('.ut-squad-slot-view'));
  const slotIndex = slots.indexOf(slot);
  return slotIndex >= 0 ? slotIndex : null;
}

function resolveSquadSlotItem(element, currentController) {
  const slot = element?.closest?.('.ut-squad-slot-view');
  if (!slot) return null;
  const slotIndex = getSquadSlotIndex(slot);
  if (slotIndex == null) return null;
  const squad = currentController?._squadController?._squad
    || currentController?._squad
    || currentController?._Controller?._squadController?._squad;
  let players = squad?._players;
  try {
    if (!Array.isArray(players)) players = squad?.getPlayers?.();
  } catch (e) {}
  return findItemEntityInObject(players?.[slotIndex], new WeakSet(), 0);
}

function resolveItemFromEaViewController(element = null) {
  const currentController = getCurrentViewController();
  if (!currentController) return null;
  const detailController = currentController._itemDetailController
    || currentController.itemDetailController
    || currentController.rightController?.currentController
    || currentController._rightController?._currentController;
  const itemDetailController = detailController?.currentController
    || detailController?._currentController;
  const controllerItem = getControllerItem(currentController, [
    (c) => c?._Controller?._rightController?._currentController?._quickListPanel?._item,
    (c) => c?._Controller?._rightController?._currentController?._itemDetailController?._item,
    (c) => c?._rightController?._currentController?._quickListPanel?._item,
    (c) => c?._rightController?._currentController?._itemDetailController?._item,
    (c) => c?._rightController?._currentController?._item,
    (c) => c?.rightController?.currentController?._quickListPanel?._item,
    (c) => c?.rightController?.currentController?._itemDetailController?._item,
    (c) => c?.rightController?.currentController?._item,
    (c) => c?._itemDetailController?.currentController?.viewmodel?.current?.(),
    (c) => c?.itemDetailController?.currentController?.viewmodel?.current?.(),
    (c) => c?.rightController?.currentController?.viewmodel?.current?.(),
    (c) => c?._squad?._players?.[c?._itemDetailController?.currentController?.viewmodel?.getIndex?.()]?._item,
    (c) => c?._detailController?._item,
    (c) => c?._itemDetailController?._item,
    (c) => c?._squadController?._selectedSlot?._item,
    (c) => c?._selectedItem,
    (c) => c?._leftController?._selectedItem,
    (c) => c?.leftController?._selectedItem
  ]);
  if (controllerItem) return controllerItem;

  const listItem = resolveItemFromListIndex(element, currentController);
  if (listItem) return listItem;
  const squadItem = resolveSquadSlotItem(element, currentController);
  if (squadItem) return squadItem;

  const activeViewModelItem = getCurrentViewModelItem(itemDetailController)
    || getCurrentViewModelItem(detailController);
  if (activeViewModelItem) return activeViewModelItem;

  const listController = currentController._leftController
    || currentController.leftController
    || currentController._listController
    || currentController.listController
    || currentController._listViewController;
  return getControllerItem(listController, [
    (c) => c?._viewmodel?.selected,
    (c) => c?._viewmodel?._selectedItem,
    (c) => c?._viewmodel?.selectedItem,
    (c) => c?._listViewController?._viewmodel?.selected,
    (c) => c?.viewmodel?.selected,
    (c) => c?.viewmodel?.current?.()
  ]) || getCurrentViewModelItem(listController);
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
    'presentedViewController', 'detailPanel', 'value', 'entity', 'card', 'player'
  ];
  const extraKeys = Object.keys(obj).filter((key) =>
    !keys.includes(key) && !['return', 'alternate', 'ownerDocument', 'parentNode', 'childNodes'].includes(key) &&
    !key.startsWith('__reactFiber$')
  ).slice(0, 40);
  for (const key of [...keys, ...extraKeys]) {
    try {
      const found = findItemEntityInObject(obj[key], seen, depth + 1);
      if (found) return found;
    } catch (e) {}
  }
  return null;
}

function resolveSelectedCard() {
  const win = pageWindow;
  // EA UTViewController state is the primary source for the active detail item.
  const activeItem = resolveItemFromEaViewController();
  if (activeItem) return activeItem;
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
    (spin.closest && spin.closest('.ut-number-input-spinner, .ut-numeric-input-spinner-control, .numericInput'));
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
  const controls = Array.from(root.querySelectorAll(
    '.ut-number-input-spinner, .ut-numeric-input-spinner-control, .numericInput'
  )).filter(visibleElement);
  const inputs = [];
  for (const control of controls) {
    const input = control.matches('input') ? control : control.querySelector('input');
    if (input && visibleElement(input) && !inputs.includes(input)) inputs.push(input);
  }
  for (const input of Array.from(root.querySelectorAll('input.numericInput, .numericInput input')).filter(visibleElement)) {
    if (!inputs.includes(input)) inputs.push(input);
  }
  const spins = inputs;
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
  updateQuickListControllerValues(group, startValue, binValue);
  addMarketLog({
    text: `💰 [En Düşük Fiyatlar] Seçilen: ${formatPrice(binValue)} → Hemen Al: ${formatPrice(binValue)}, Başlangıç: ${formatPrice(startValue)} inputlarına yazıldı.`,
    type: 'info'
  });
  return true;
}

function getQuickListController(group) {
  const currentController = getCurrentViewController();
  const candidates = [
    currentController?._Controller?._rightController?._currentController?._quickListPanel,
    currentController?._rightController?._currentController?._quickListPanel,
    currentController?._quickListPanel
  ];
  if (group?.closest) {
    const panel = group.closest(QUICK_LIST_SCOPE_SELECTOR);
    for (let node = panel; node; node = node.parentElement) {
      for (const candidate of [node._quickListPanel, node._controller?._quickListPanel]) {
        if (candidate) candidates.push(candidate);
      }
    }
  }
  return candidates.find(Boolean) || null;
}

function updateQuickListControllerValues(group, startValue, buyNowValue) {
  const controller = getQuickListController(group);
  if (!controller) return;
  const update = (methodNames, propertyNames, value) => {
    let handled = false;
    for (const name of methodNames) {
      try {
        if (typeof controller[name] === 'function') {
          controller[name](value);
          handled = true;
          break;
        }
      } catch (e) {}
    }
    for (const name of propertyNames) {
      try {
        if (name in controller) {
          controller[name] = value;
          handled = true;
        }
      } catch (e) {}
    }
    return handled;
  };
  update(
    ['setStartPrice', 'setMinBid', 'updateStartPrice'],
    ['_startPrice', 'startPrice', '_minBid', 'minBid'],
    startValue
  );
  update(
    ['setBuyNowPrice', 'setBuyNow', 'updateBuyNowPrice'],
    ['_buyNowPrice', 'buyNowPrice', '_buyNow', 'buyNow'],
    buyNowValue
  );
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
function findFiberForElement(el) {
  if (!el) return null;
  try {
    if (el.__reactInternalInstance$ || el._reactInternalFiber) {
      return el.__reactInternalInstance$ || el._reactInternalFiber;
    }
    const key = Object.keys(el).find((name) =>
      name.startsWith('__reactFiber$') || name.startsWith('__reactInternalInstance$')
    );
    return key ? el[key] : null;
  } catch (e) {
    return null;
  }
}

function findItemInReactProps(el) {
  if (!el) return null;
  try {
    for (const key of Object.keys(el)) {
      if (!key.startsWith('__reactProps$')) continue;
      const found = findItemEntityInObject(el[key], new WeakSet(), 0);
      if (found) return found;
    }
  } catch (e) {}
  return null;
}

function findItemViaReactFiberElement(element, boundary = null) {
  let node = element;
  let ancestors = 0;
  while (node && ancestors < 12 && (!boundary || boundary.contains(node))) {
    const reactPropItem = findItemInReactProps(node);
    if (reactPropItem) return reactPropItem;
    let fiber = findFiberForElement(node);
    let hops = 0;
    while (fiber && hops < 40) {
      for (const value of [fiber.memoizedProps, fiber.pendingProps, fiber.memoizedState, fiber.stateNode]) {
        const found = findItemEntityInObject(value, new WeakSet(), 0);
        if (found) return found;
      }
      fiber = fiber.return;
      hops += 1;
    }
    node = node.parentElement;
    ancestors += 1;
  }
  return null;
}

function findItemViaReactFiber(group) {
  try {
    const panel = group.closest
      ? (group.closest('.ut-detail-panel, .ut-panel, .ut-quick-list-panel-view, [class*="detail"]') || group)
      : group;
    if (!panel) return null;
    const roots = [panel, ...Array.from(panel.querySelectorAll('*')).slice(0, 300)];
    for (const el of roots) {
      const item = findItemViaReactFiberElement(el, panel);
      if (item) return item;
    }
  } catch (e) {}
  return null;
}

function captureSelectedCardFromElement(element) {
  const itemEntity = readItemReferenceFromElement(element)
    || resolveItemFromEaViewController(element)
    || findItemViaReactFiberElement(element);
  const itemDefId = itemEntity ? getItemEntityDefId(itemEntity) : 0;
  const domIds = readCardIdsFromDom(element);
  const baseId = itemEntity ? getItemEntityBaseId(itemEntity) : 0;
  const defId = itemDefId || domIds.definitionId || baseId || domIds.baseId;
  if (!(defId > 0)) return false;
  lastSelectedCard = {
    itemEntity: itemDefId ? itemEntity : null,
    defId,
    baseId: itemDefId ? baseId : (domIds.baseId || (domIds.definitionId & 0xffffff)),
    at: Date.now()
  };
  cachedTarget = null;
  return true;
}

function captureCardFromClick(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
  const elements = path.filter((node) => node && node.nodeType === 1);
  if (elements.some((node) => node.matches?.(`.${BTN_CLASS}, .${RESULTS_CLASS}, .${ITEM_CLASS}`))) return;
  const cardSelectors = [
    '.listFUTItem', '.ut-item-row', '.ut-squad-slot-view', '.small.player.item',
    '.entityContainer', '.ut-item', '.ut-item-view'
  ];
  if (!elements.some((node) => cardSelectors.some((selector) => node.matches?.(selector)))) return;

  let captured = false;
  for (const element of elements) {
    if (captureSelectedCardFromElement(element)) {
      captured = true;
      break;
    }
  }
  if (!captured && elements.some((node) => node.matches?.(
    '.ut-item, .ut-item-view, [class*="ut-item"], [class*="item-view"], [data-resource-id], [data-trade-id]'
  ))) {
    setTimeout(captureSelectedCard, 0);
  }
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
    const defId = getItemEntityDefId(itemEntity);
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

function resolveDetailTarget(group) {
  const currentTarget = resolveTargetForGroup(group);
  if (currentTarget) {
    cachedTarget = { group, target: currentTarget, at: Date.now() };
    return currentTarget;
  }
  return lastSelectedCard && lastSelectedCard.defId > 0 ? lastSelectedCard : null;
}

function computeTargetForGroup(group) {
  // The active EA controller is authoritative on the live OOP-based app.
  const controllerItem = resolveItemFromEaViewController(group);
  if (controllerItem) {
    const defId = getItemEntityDefId(controllerItem);
    if (defId > 0) return { itemEntity: controllerItem, defId };
    const baseId = getItemEntityBaseId(controllerItem);
    if (baseId > 0) return { itemEntity: null, defId: baseId, baseId };
  }
  // Keep React/Fiber support for older markup and test fixtures.
  const fiberItem = findItemViaReactFiber(group);
  if (fiberItem) {
    const defId = getItemEntityDefId(fiberItem);
    if (defId > 0) return { itemEntity: fiberItem, defId };
    const baseId = getItemEntityBaseId(fiberItem);
    if (baseId > 0) return { itemEntity: null, defId: baseId, baseId };
  }
  // 2) Aktif panel wrapper'indaki data-* kart kimlik nitelikleri.
  const domIds = readCardIdsFromDom(group);
  if (domIds.definitionId > 0) return { itemEntity: null, defId: domIds.definitionId };
  if (domIds.baseId > 0) return { itemEntity: null, defId: domIds.baseId, baseId: domIds.baseId };
  // 3) Panel basligindaki kart adini pazar cache'indeki kartlarla eslestir.
  const byName = resolveDefIdByName(group);
  if (byName > 0) return { itemEntity: null, defId: byName };
  // 4) App/service selection state, then a recent selection captured while
  // the panel was opening. Never let an old global selection override context.
  const itemEntity = resolveSelectedCard();
  if (itemEntity) {
    const defId = getItemEntityDefId(itemEntity);
    if (defId > 0) return { itemEntity, defId };
    const baseId = getItemEntityBaseId(itemEntity);
    if (baseId > 0) return { itemEntity: null, defId: baseId, baseId };
  }
  if (lastSelectedCard && lastSelectedCard.defId > 0) {
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
    // Preserve whether the resolved identifier is exact or only a base ID.
    const searchTarget = target.itemEntity && getItemDefId(target.itemEntity) > 0
      ? target.itemEntity
      : (target.baseId
        ? { baseId: target.baseId, type: 'player' }
        : { definitionId: target.defId, type: 'player' });
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
    const target = resolveDetailTarget(group);
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
  document.addEventListener('click', captureCardFromClick, true);
  observer = new MutationObserver(scheduleInject);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleInject();
}

export function destroyDetailLowestPrices() {
  document.removeEventListener('click', captureCardFromClick, true);
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
  getItemEntityDefId,
  getItemEntityBaseId,
  findItemInReactProps,
  findItemViaReactFiberElement,
  captureSelectedCardFromElement,
  captureCardFromClick,
  resolveDetailTarget,
  resolveItemFromEaViewController,
  resolveItemFromListIndex,
  resolveSquadSlotItem,
  readCardIdsFromDom,
  computeTargetForGroup,
  resolveSelectedCard,
  findQuickListInputs,
  setSpinnerValue,
  applyToQuickList,
  ensureControls,
  renderResults
};
