// ==UserScript==
// @name         FutRUSH
// @namespace    local.futrush
// @version      2.0.0
// @description  FutRUSH - Transfers ekranına SNIPE paneli ve sol menüye FutRUSH (Ayarlar) butonu ekler (sadece arayüz)
// @match        https://www.ea.com/*/ea-sports-fc/ultimate-team/web-app/*
// @match        https://www.ea.com/ea-sports-fc/ultimate-team/web-app/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      *
// @connect      futbin.com
// @connect      www.futbin.com
// @connect      futbin.org
// @connect      www.futbin.org
// @connect      fut.gg
// @connect      game-assets.fut.gg
// ==/UserScript==


(() => {
  // src/core/config.js
  var CONFIG = {
    showCardImages: true,
    ui: {
      statusHoldMs: 3e3,
      statusErrorHoldMs: 6e3
    },
    // Özellikleri aç/kapat (bozulan bir şeyi hızlıca devre dışı bırakmak için)
    features: {
      fitContent: true,
      // alt sayfalarda içeriği panelin soluna sığdır
      settingsButton: true,
      // sol menüdeki FutRUSH (Ayarlar) butonu
      searchButton: true,
      // Reset / Search yanındaki FutRUSH butonu
      logoButton: false,
      // Consumables yanındaki logo kaldırıldı
      detailLowestPrices: true
      // EA kart detay panelinde (.ut-button-group) en düşük fiyatlar
    },
    // SNIPE paneli
    panel: {
      id: "fc-snipe-panel",
      storeKey: "fc-snipe-panel-geom",
      widthRatio: 0.63,
      // panel genişliği = kart bloğunun %63'ü
      gapRatio: 0.027,
      // kartlarla arası = kart bloğunun %2.7'si
      sideMargin: 16,
      edge: 8,
      // pencere kenarlarına / üst çubuğa bırakılan boşluk
      bg: "rgba(21, 29, 41, .7)",
      // #151D29, %70 opaklık
      border: "1px solid rgba(255,255,255,.18)",
      radius: "6px",
      buttonText: "SNIPE"
    },
    // Alt sayfalarda içeriği panelin soluna sığdırma
    fit: {
      leftMargin: 8,
      // sol menü ile içerik arası
      gap: 12,
      // içerik ile panel arası
      minScale: 0.5,
      expandY: true,
      // ölçekleme yerine yüksekliği GENİŞLET (yazılar bozulmaz)
      maxExpandY: 3,
      // yükseklik en fazla bu kadar katına çıkar (güvenlik sınırı)
      debug: false
      // true: konsola ölçüm bilgisi yazar
    },
    // FutRUSH (Ayarlar) butonu ve penceresi
    nav: {
      id: "futrush-nav",
      modalId: "futrush-settings",
      defaultIcon: 26
      // diğer menü ikonlarının boyutu okunamazsa kullanılır (px)
    },
    // Consumables yanındaki logo: SNIPE paneli SADECE bu logoya basınca açılır
    logoButton: {
      className: "futrush-logo-btn",
      size: 40,
      // px (40x40)
      gap: 10,
      // Consumables ile logo arası (px)
      anchorPattern: /consumables/i,
      // sekmeyi yazısından tanır (dil değişirse buraya ekle)
      title: "FutRUSH Snipe"
    },
    // Reset / Search yanındaki FutRUSH butonu
    searchButton: {
      className: "futrush-search-btn",
      label: "Ekle FutRUSH",
      resetPattern: /reset|sıfırla/i,
      // Reset butonunu yazısından tanır (dil değişirse buraya ekle)
      debug: false
      // true: konsola ölçüm bilgisi yazar
    },
    // Hedef eklerken EA piyasa fiyatı araması
    targetAdd: {
      priceSource: "ea",
      eaTaxRate: 0.05,
      discountRate: 0.1,
      maxSearches: 5,
      searchGapMs: [1200, 1800],
      actionGapMs: [1500, 2500],
      outlierRatio: 0.9,
      maxConsecutiveErrors: 2
    },
    bot: {
      searchJitterMs: [350, 600],
      cycleJitterMs: [350, 750],
      stopOnFatalPurchaseError: true
    },
    // FutBIN oyuncu listesi entegrasyonu (URL ve HTML seçicileri burada tutulur)
    futbin: {
      baseUrl: "https://www.futbin.com/27/players",
      apiBaseUrl: "https://www.futbin.org/futbin/api/27/getFilteredPlayers",
      platform: "console",
      version: "",
      preferApi: true,
      maxPages: 20,
      pageDelay: 350,
      ratingParam: "player_rating",
      pageParam: "page",
      sortParam: "sort",
      priceRangeParam: "ps_price",
      pcPriceRangeParam: "pc_price",
      priceRange: "200-15000000",
      orderParam: "order",
      selectors: {
        rows: "tr.player-row",
        nameLink: 'a.table-player-name[href*="/player/"], a[href*="/player/"]',
        name: "td.table-name",
        rating: "td.table-rating",
        ratingFallback: '[class*="rating"]',
        consolePrice: "td.platform-ps-only .price, td.platform-ps-only",
        pcPrice: "td.platform-pc-only .price, td.platform-pc-only",
        image: "img[src*='/players/']",
        pageLinks: 'a[href*="page="]',
        emptyResultContainer: "tbody",
        idPattern: /\/player\/(\d+)/i
      }
    },
    // Zamanlama
    timing: {
      tailDelay: 400
      // geçiş animasyonları bittikten sonra bir kez daha ölç (ms)
    }
  };
  var P = CONFIG.panel;
  var F = CONFIG.fit;
  var N = CONFIG.nav;

  // src/core/state.js
  var state = {
    geom: null,
    // panelin pencere oranı olarak son ölçüsü {l, t, w, h}
    visible: true,
    // son tıklanan ana menü Transfers mi (sekme okunamazsa yedek bilgi)
    panelOpen: false,
    // SNIPE paneli logoyla açıldı mı
    panelExpanded: false,
    // SNIPE düğmesinden sekmeler açıldı mı
    activePanelTab: "targets",
    snipeSettings: { repeat: 0, waitSeconds: [15, 35], autoSell: false, dryRun: false, strictMarketCap: false, maxPlayers: 1, speed: 0, speedDelays: { 0: 5, 1: 4, 2: 2.5, 3: 1.5 }, maxSpendCoins: 0, hourlySearchLimit: 1200, dailySearchLimit: 6e3, consecutiveErrorLimit: 3, transferListCapacity: 100, transferListWarnThreshold: 5, maxPriceCapThreshold: 0.5 },
    targetFilter: { kind: "cheap", ratings: [], count: 5 },
    targets: [],
    savedTargetLists: [],
    selectedSavedTargetListId: null,
    botRunning: false,
    botToken: 0,
    botStatus: "",
    botLogs: [],
    botLogId: 0,
    botStats: { bought: 0, simulatedBought: 0, missed: 0, searches: 0, errors: 0 },
    botWait: null,
    targetLoading: false,
    targetStatus: null,
    filterDraft: null,
    logoPresent: false,
    // Consumables yanındaki logo şu an sayfada mı
    liveScroll: 0
    // hub kaydırılmışsa panelin kartlarla birlikte kayması için
  };

  // src/utils/dom.js
  var pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : typeof window !== "undefined" ? window : {};
  var pageStorage = () => pageWindow.localStorage;
  var vw = () => document.documentElement.clientWidth;
  var vh = () => pageWindow.innerHeight;
  function visibleElement(element) {
    if (!element || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    try {
      const style = pageWindow.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    } catch (e) {
      return true;
    }
  }

  // src/core/logger.js
  var levels = { debug: 10, info: 20, warn: 30, error: 40 };
  var threshold = levels.info;
  var warnedKeys = /* @__PURE__ */ new Set();
  function setLogLevel(level) {
    if (!Object.prototype.hasOwnProperty.call(levels, level)) throw new Error("Unknown log level: " + level);
    threshold = levels[level];
  }
  function log(level, ...args) {
    if (!Object.prototype.hasOwnProperty.call(levels, level)) throw new Error("Unknown log level: " + level);
    if (levels[level] < threshold) return;
    const method = level === "debug" ? "debug" : level;
    console[method]("[FutRUSH]", ...args);
  }
  var debug = (...args) => log("debug", ...args);
  var info = (...args) => log("info", ...args);
  var warn = (...args) => log("warn", ...args);
  var error = (...args) => log("error", ...args);
  function warnOnce(key, ...args) {
    if (warnedKeys.has(key)) return;
    warnedKeys.add(key);
    warn(...args);
  }

  // src/core/prefs.js
  var PREFS_KEY = "futrush-prefs";
  var DEFAULT_PREFS = {
    platform: "ps",
    targetAdd: {
      priceSource: "ea",
      discountRate: 0.1,
      maxSearches: 5,
      searchGapMs: [1200, 1800],
      actionGapMs: [1500, 2500],
      outlierRatio: 0.9
    },
    debug: false
  };
  var activePlatform = "ps";
  function getPlatform() {
    return activePlatform;
  }
  function validRange(value, minimum) {
    return Array.isArray(value) && value.length === 2 && value.every((item) => Number.isSafeInteger(item)) && value[0] >= minimum && value[1] >= value[0];
  }
  function validatePrefs(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const platform = source.platform === "pc" ? "pc" : "ps";
    const targetAdd = source.targetAdd && typeof source.targetAdd === "object" && !Array.isArray(source.targetAdd) ? source.targetAdd : {};
    const defaults = DEFAULT_PREFS.targetAdd;
    const priceSource = targetAdd.priceSource === "futbin" ? "futbin" : targetAdd.priceSource === "ea" ? "ea" : defaults.priceSource;
    const discountRate = typeof targetAdd.discountRate === "number" && Number.isFinite(targetAdd.discountRate) && targetAdd.discountRate >= 0 && targetAdd.discountRate <= 0.5 ? Math.round(targetAdd.discountRate * 100) / 100 : defaults.discountRate;
    const maxSearches = Number.isInteger(targetAdd.maxSearches) && targetAdd.maxSearches >= 1 && targetAdd.maxSearches <= 8 ? targetAdd.maxSearches : defaults.maxSearches;
    const searchGapMs = validRange(targetAdd.searchGapMs, 500) ? targetAdd.searchGapMs.slice() : defaults.searchGapMs.slice();
    const actionGapMs = validRange(targetAdd.actionGapMs, 200) ? targetAdd.actionGapMs.slice() : defaults.actionGapMs.slice();
    const outlierRatio = targetAdd.outlierRatio === 0 || typeof targetAdd.outlierRatio === "number" && Number.isFinite(targetAdd.outlierRatio) && targetAdd.outlierRatio >= 0.5 && targetAdd.outlierRatio <= 0.95 ? targetAdd.outlierRatio : defaults.outlierRatio;
    return {
      platform,
      targetAdd: { priceSource, discountRate, maxSearches, searchGapMs, actionGapMs, outlierRatio },
      debug: typeof source.debug === "boolean" ? source.debug : DEFAULT_PREFS.debug
    };
  }
  function loadPrefs() {
    let serialized;
    try {
      serialized = pageStorage().getItem(PREFS_KEY);
    } catch (error2) {
      warnOnce(
        "storage-read:" + PREFS_KEY,
        "[FutRUSH:storage]",
        "Tercihler localStorage\u2019dan okunamad\u0131; varsay\u0131lanlar kullan\u0131l\u0131yor.",
        PREFS_KEY,
        String(error2?.message || error2)
      );
      return validatePrefs(null);
    }
    if (serialized == null) return validatePrefs(null);
    try {
      return validatePrefs(JSON.parse(serialized));
    } catch (error2) {
      warnOnce(
        "storage-json:" + PREFS_KEY,
        "[FutRUSH:storage]",
        "Tercihler JSON olarak okunamad\u0131; varsay\u0131lanlar kullan\u0131l\u0131yor.",
        PREFS_KEY,
        String(error2?.message || error2)
      );
      return validatePrefs(null);
    }
  }
  function savePrefs(raw) {
    const prefs = validatePrefs(raw);
    try {
      pageStorage().setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (error2) {
      error("Tercihler localStorage\u2019a kaydedilemedi.", error2);
    }
    return prefs;
  }
  function applyPrefs(raw) {
    const prefs = validatePrefs(raw);
    activePlatform = prefs.platform;
    CONFIG.futbin.platform = prefs.platform === "pc" ? "pc" : "console";
    Object.assign(CONFIG.targetAdd, prefs.targetAdd);
    setLogLevel(prefs.debug ? "debug" : "info");
    return prefs;
  }

  // src/core/storage.js
  var SETTINGS_SCHEMA_VERSION = 2;
  var SNIPE_SETTINGS_KEY = "futrush-snipe-settings";
  var SNIPE_SETTINGS_DEFAULTS = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    repeat: 0,
    waitSeconds: [15, 35],
    autoSell: false,
    dryRun: false,
    strictMarketCap: false,
    maxPlayers: 1,
    speed: 0,
    speedDelays: { 0: 5, 1: 4, 2: 2.5, 3: 1.5 },
    maxSpendCoins: 0,
    hourlySearchLimit: 1200,
    dailySearchLimit: 6e3,
    consecutiveErrorLimit: 3,
    transferListCapacity: 100,
    transferListWarnThreshold: 5,
    maxPriceCapThreshold: 0.5
  };
  function isNumberInRange(value, min, max) {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  }
  function saveSnipeSettings() {
    try {
      pageStorage().setItem(SNIPE_SETTINGS_KEY, JSON.stringify({
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        repeat: state.snipeSettings.repeat,
        waitSeconds: Array.isArray(state.snipeSettings.waitSeconds) ? state.snipeSettings.waitSeconds.slice(0, 2) : [15, 35],
        autoSell: state.snipeSettings.autoSell,
        dryRun: Boolean(state.snipeSettings.dryRun),
        strictMarketCap: Boolean(state.snipeSettings.strictMarketCap),
        maxPlayers: state.snipeSettings.maxPlayers,
        speed: state.snipeSettings.speed,
        speedDelays: state.snipeSettings.speedDelays || { 0: 5, 1: 4, 2: 2.5, 3: 1.5 },
        maxSpendCoins: state.snipeSettings.maxSpendCoins || 0,
        hourlySearchLimit: state.snipeSettings.hourlySearchLimit ?? SNIPE_SETTINGS_DEFAULTS.hourlySearchLimit,
        dailySearchLimit: state.snipeSettings.dailySearchLimit ?? SNIPE_SETTINGS_DEFAULTS.dailySearchLimit,
        consecutiveErrorLimit: state.snipeSettings.consecutiveErrorLimit ?? SNIPE_SETTINGS_DEFAULTS.consecutiveErrorLimit,
        transferListCapacity: state.snipeSettings.transferListCapacity ?? SNIPE_SETTINGS_DEFAULTS.transferListCapacity,
        transferListWarnThreshold: state.snipeSettings.transferListWarnThreshold ?? SNIPE_SETTINGS_DEFAULTS.transferListWarnThreshold,
        maxPriceCapThreshold: state.snipeSettings.maxPriceCapThreshold ?? SNIPE_SETTINGS_DEFAULTS.maxPriceCapThreshold
      }));
    } catch (e) {
      error("SNIPE ayarlar\u0131 localStorage\u2019a kaydedilemedi.", e);
    }
  }
  function loadSnipeSettings() {
    let serializedSettings;
    try {
      serializedSettings = pageStorage().getItem(SNIPE_SETTINGS_KEY);
    } catch (e) {
      error("SNIPE ayarlar\u0131 localStorage\u2019dan okunamad\u0131.", e);
      Object.assign(state.snipeSettings, SNIPE_SETTINGS_DEFAULTS);
      return;
    }
    let savedSettings;
    try {
      savedSettings = JSON.parse(serializedSettings);
    } catch (e) {
      warn("[FutRUSH:storage]", "SNIPE ayarlar\u0131 JSON olarak okunamad\u0131.", SNIPE_SETTINGS_KEY, String(e?.message || e));
      savedSettings = null;
    }
    const loadedSettings = { ...SNIPE_SETTINGS_DEFAULTS };
    if (savedSettings && typeof savedSettings === "object" && !Array.isArray(savedSettings)) {
      if (isNumberInRange(savedSettings.repeat, 0, 50)) {
        loadedSettings.repeat = savedSettings.repeat;
      }
      if (Array.isArray(savedSettings.waitSeconds) && savedSettings.waitSeconds.length === 2 && isNumberInRange(savedSettings.waitSeconds[0], 0, 120) && isNumberInRange(savedSettings.waitSeconds[1], 0, 120)) {
        loadedSettings.waitSeconds = [
          Math.min(savedSettings.waitSeconds[0], savedSettings.waitSeconds[1]),
          Math.max(savedSettings.waitSeconds[0], savedSettings.waitSeconds[1])
        ];
      } else if (isNumberInRange(savedSettings.waitSeconds, 0, 120)) {
        loadedSettings.waitSeconds = [savedSettings.waitSeconds, savedSettings.waitSeconds];
      }
      if (typeof savedSettings.autoSell === "boolean") {
        loadedSettings.autoSell = savedSettings.autoSell;
      }
      if (typeof savedSettings.dryRun === "boolean") {
        loadedSettings.dryRun = savedSettings.dryRun;
      }
      if (typeof savedSettings.strictMarketCap === "boolean") {
        loadedSettings.strictMarketCap = savedSettings.strictMarketCap;
      }
      if (Number.isSafeInteger(savedSettings.maxPlayers) && savedSettings.maxPlayers >= 1 && savedSettings.maxPlayers <= Number.MAX_SAFE_INTEGER) {
        loadedSettings.maxPlayers = savedSettings.maxPlayers;
      }
      if (Number.isInteger(savedSettings.speed) && savedSettings.speed >= 0 && savedSettings.speed <= 3) {
        loadedSettings.speed = savedSettings.speed;
      }
      if (savedSettings.speedDelays && typeof savedSettings.speedDelays === "object") {
        const delays = { 0: 5, 1: 4, 2: 2.5, 3: 1.5 };
        [0, 1, 2, 3].forEach((k) => {
          const val = Number(savedSettings.speedDelays[k]);
          if (!isNaN(val) && val >= 1 && val <= 10) {
            delays[k] = Math.round(val * 10) / 10;
          }
        });
        loadedSettings.speedDelays = delays;
      }
      if (Number.isSafeInteger(savedSettings.maxSpendCoins) && savedSettings.maxSpendCoins >= 0) {
        loadedSettings.maxSpendCoins = savedSettings.maxSpendCoins;
      }
      if (Number.isSafeInteger(savedSettings.hourlySearchLimit) && savedSettings.hourlySearchLimit >= 0) {
        loadedSettings.hourlySearchLimit = savedSettings.hourlySearchLimit;
      }
      if (Number.isSafeInteger(savedSettings.dailySearchLimit) && savedSettings.dailySearchLimit >= 0) {
        loadedSettings.dailySearchLimit = savedSettings.dailySearchLimit;
      }
      if (Number.isSafeInteger(savedSettings.consecutiveErrorLimit) && savedSettings.consecutiveErrorLimit >= 1) {
        loadedSettings.consecutiveErrorLimit = savedSettings.consecutiveErrorLimit;
      }
      if (Number.isSafeInteger(savedSettings.transferListCapacity) && savedSettings.transferListCapacity >= 10 && savedSettings.transferListCapacity <= 200) {
        loadedSettings.transferListCapacity = savedSettings.transferListCapacity;
      }
      if (Number.isSafeInteger(savedSettings.transferListWarnThreshold) && savedSettings.transferListWarnThreshold >= 0 && savedSettings.transferListWarnThreshold <= 50) {
        loadedSettings.transferListWarnThreshold = savedSettings.transferListWarnThreshold;
      }
      if (typeof savedSettings.maxPriceCapThreshold === "number" && Number.isFinite(savedSettings.maxPriceCapThreshold) && savedSettings.maxPriceCapThreshold >= 0.1 && savedSettings.maxPriceCapThreshold <= 5) {
        loadedSettings.maxPriceCapThreshold = savedSettings.maxPriceCapThreshold;
      }
      if (!savedSettings.schemaVersion || savedSettings.schemaVersion < SETTINGS_SCHEMA_VERSION) {
        loadedSettings.schemaVersion = SETTINGS_SCHEMA_VERSION;
      }
    }
    Object.assign(state.snipeSettings, loadedSettings);
  }
  function loadCoreStorage() {
    try {
      state.geom = JSON.parse(pageStorage().getItem(P.storeKey));
    } catch (e) {
      warn("[FutRUSH:storage]", "Panel geometrisi localStorage\u2019dan okunamad\u0131.", P.storeKey, String(e?.message || e));
    }
    try {
      const savedTargetFilter = JSON.parse(pageStorage().getItem("futrush-saved-target-filter"));
      if (savedTargetFilter && Array.isArray(savedTargetFilter.ratings)) {
        state.targetFilter = {
          kind: savedTargetFilter.kind === "custom" ? "custom" : "cheap",
          ratings: savedTargetFilter.ratings.slice(0, 1).map(Number).filter(Number.isFinite),
          count: Math.max(1, Number(savedTargetFilter.count) || 5)
        };
      }
    } catch (e) {
      warn("[FutRUSH:storage]", "Kay\u0131tl\u0131 hedef filtresi localStorage\u2019dan okunamad\u0131.", "futrush-saved-target-filter", String(e?.message || e));
    }
    loadSnipeSettings();
    applyPrefs(loadPrefs());
  }

  // src/core/registry.js
  var modules = [];
  function register({ name, feature, init, sync: sync2, destroy, initOrder }) {
    modules.push({ name, feature, init, sync: sync2, destroy, initOrder });
  }
  function isEnabled(module) {
    return !module.feature || CONFIG.features[module.feature] !== false;
  }
  function run(module, method, context) {
    if (!isEnabled(module) || typeof module[method] !== "function") return;
    try {
      module[method](context);
    } catch (err) {
      error("[FutRUSH:" + module.name + "]", err);
    }
  }
  function initAll() {
    [...modules].sort((a, b) => (a.initOrder ?? Infinity) - (b.initOrder ?? Infinity)).forEach((module) => run(module, "init"));
  }
  function syncAll(ctx) {
    modules.forEach((module) => run(module, "sync", ctx));
  }
  function destroyAll() {
    modules.forEach((module) => run(module, "destroy"));
  }
  var registry = { register, initAll, syncAll, destroyAll };

  // src/core/events.js
  var listeners = /* @__PURE__ */ new Map();
  function on(eventName, listener) {
    if (typeof listener !== "function") throw new TypeError("Event listener must be a function.");
    const eventListeners = listeners.get(eventName) || /* @__PURE__ */ new Set();
    eventListeners.add(listener);
    listeners.set(eventName, eventListeners);
    return () => off(eventName, listener);
  }
  function off(eventName, listener) {
    const eventListeners = listeners.get(eventName);
    if (!eventListeners) return;
    eventListeners.delete(listener);
    if (!eventListeners.size) listeners.delete(eventName);
  }
  function emit(eventName, ...args) {
    const eventListeners = listeners.get(eventName);
    if (!eventListeners) return;
    for (const listener of [...eventListeners]) listener(...args);
  }

  // src/core/scheduler.js
  function sync() {
    const marketTile = document.querySelector(".ut-tile-transfer-market");
    const onHub = !!(marketTile && marketTile.getBoundingClientRect().width > 0);
    syncAll({ onHub, marketTile });
  }
  var queued = false;
  var tail = null;
  function schedule() {
    clearTimeout(tail);
    tail = setTimeout(sync, CONFIG.timing.tailDelay);
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }
  on("layout:request-sync", sync);

  // src/core/domEvents.js
  function initDomEvents() {
    document.addEventListener("click", (e) => {
      const item = e.target.closest && e.target.closest('[class*="tab-bar-item"]');
      if (!item) return;
      state.visible = /transfer/i.test(item.className + " " + item.textContent);
      schedule();
    }, true);
    if (typeof MutationObserver !== "undefined" && document.body) {
      new MutationObserver((mutations) => {
        const onlyInternal = mutations.every((m) => {
          const target = m.target;
          return target && target.closest && (target.closest("#fr-hub-view") || target.closest("#fc-snipe-panel") || target.closest(".fr-market-log-box") || target.closest(".fr-bot-logs-panel"));
        });
        if (!onlyInternal) {
          schedule();
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
    pageWindow.addEventListener("resize", schedule);
    pageWindow.addEventListener("scroll", (e) => {
      if (e.target && e.target.closest && (e.target.closest("#fr-hub-view") || e.target.closest("#fc-snipe-panel"))) {
        return;
      }
      schedule();
    }, true);
    const preventMiddleClickAutoscroll = (e) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };
    document.addEventListener("pointerdown", preventMiddleClickAutoscroll, { capture: true });
    document.addEventListener("mousedown", preventMiddleClickAutoscroll, { capture: true });
    document.addEventListener("auxclick", preventMiddleClickAutoscroll, { capture: true });
  }

  // src/layout/hubSync.js
  var ro = null;
  var observedContainer = null;
  function syncFromHub(marketTile, onResize) {
    const tilesContainer = marketTile.parentElement;
    if (!tilesContainer) return false;
    if (observedContainer !== tilesContainer) {
      if (ro) ro.disconnect();
      ro = new ResizeObserver(onResize);
      ro.observe(tilesContainer);
      observedContainer = tilesContainer;
    }
    tilesContainer.style.transform = "";
    const tiles = tilesContainer.querySelectorAll('[class*="ut-tile-transfer"]');
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    tiles.forEach((el) => {
      const q = el.getBoundingClientRect();
      if (q.width === 0 || q.height === 0) return;
      l = Math.min(l, q.left);
      t = Math.min(t, q.top);
      r = Math.max(r, q.right);
      b = Math.max(b, q.bottom);
    });
    if (!isFinite(l)) return false;
    const blockW = r - l;
    const gap = blockW * P.gapRatio;
    let panelW = blockW * P.widthRatio;
    let shift = (panelW + gap) / 2;
    shift = Math.max(0, Math.min(shift, l - P.sideMargin));
    const newRight = r - shift;
    const room = vw() - P.sideMargin - (newRight + gap);
    panelW = Math.max(0, Math.min(panelW, room));
    let off2 = 0;
    for (let n = tilesContainer; n; n = n.parentElement) off2 += n.scrollTop || 0;
    state.liveScroll = off2;
    state.geom = {
      l: (newRight + gap) / vw(),
      t: (t + off2) / vh(),
      w: panelW / vw(),
      h: (b - t) / vh()
    };
    try {
      pageStorage().setItem(P.storeKey, JSON.stringify(state.geom));
    } catch (e) {
      warnOnce("storage-write:" + P.storeKey, "[FutRUSH:hubSync]", "Panel geometrisi localStorage\u2019a kaydedilemedi.", P.storeKey, String(e?.message || e));
    }
    return true;
  }
  function createHubSyncModule(onResize) {
    return {
      name: "hubSync",
      sync({ onHub, marketTile }) {
        if (onHub) {
          state.visible = true;
          syncFromHub(marketTile, onResize);
        } else {
          state.liveScroll = 0;
        }
      }
    };
  }

  // src/futbin/eaId.js
  var BASE_ID_MAX = 16777215;
  var toBaseId = (id) => Number(id) > 0 ? Number(id) % (BASE_ID_MAX + 1) : 0;
  var isBaseId = (id) => {
    const n = Number(id);
    return Number.isSafeInteger(n) && n > 0 && n <= BASE_ID_MAX;
  };
  var idOf = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : 0;

  // src/targets/targetStore.js
  function saveTargets() {
    try {
      pageStorage().setItem("futrush-targets", JSON.stringify(state.targets));
    } catch (e) {
      warnOnce("storage-write:futrush-targets", "[FutRUSH:targetStore]", "Aktif hedefler localStorage\u2019a kaydedilemedi.", "futrush-targets", String(e?.message || e));
    }
  }
  function saveSavedTargetLists(lists) {
    pageStorage().setItem("futrush-saved-targets", JSON.stringify(lists));
  }
  function normalizeTarget(item, mode) {
    if (mode === "live") {
      if (!item || typeof item.name !== "string" || !Number.isFinite(Number(item.rating)) || !Number.isFinite(Number(item.price))) return null;
      const price = Math.max(1, Math.round(Number(item.price)));
      const rating = Math.round(Number(item.rating));
      const futbinId = item.futbinId == null ? null : String(item.futbinId);
      const eaId = idOf(item.eaId);
      const playerId = idOf(item.playerId) || toBaseId(eaId);
      const versionKnown = typeof item.versionKnown === "boolean" ? item.versionKnown : false;
      return {
        id: String(item.id || (futbinId ? "futbin:" + futbinId : item.name + ":" + rating)),
        name: item.name,
        rating,
        eaId,
        playerId,
        versionKnown,
        eaIdTargetKey: typeof item.eaIdTargetKey === "string" ? item.eaIdTargetKey : null,
        price,
        searches: Math.max(1, Math.round(Number(item.searches) || 3)),
        buyNow: Math.max(1, Math.round(Number(item.buyNow) || price)),
        futbinId,
        position: item.position || "",
        commonName: item.commonName || "",
        versionLabel: item.versionLabel || "",
        playerImageUrl: item.playerImageUrl || "",
        promoImageUrl: item.promoImageUrl || "",
        holographicAnimationUrl: item.holographicAnimationUrl || "",
        stats: item.stats && typeof item.stats === "object" ? {
          pac: Number(item.stats.pac) || 0,
          sho: Number(item.stats.sho) || 0,
          pas: Number(item.stats.pas) || 0,
          dri: Number(item.stats.dri) || 0,
          def: Number(item.stats.def) || 0,
          phy: Number(item.stats.phy) || 0,
          labels: Array.isArray(item.stats.labels) ? item.stats.labels : null
        } : null,
        nationImageUrl: item.nationImageUrl || "",
        clubImageUrl: item.clubImageUrl || "",
        leagueImageUrl: item.leagueImageUrl || "",
        leagueImageFallbacks: Array.isArray(item.leagueImageFallbacks) ? item.leagueImageFallbacks : [],
        leagueName: item.leagueName || "",
        playstylesPlus: Array.isArray(item.playstylesPlus) ? item.playstylesPlus : [],
        priceUpdatedAt: Number(item.priceUpdatedAt) || 0,
        priceTrend: item.priceTrend || null,
        priceHistory: Array.isArray(item.priceHistory) ? item.priceHistory.slice(0, 5) : [],
        nationId: Number(item.nationId) || 0,
        clubId: Number(item.clubId) || 0,
        leagueId: Number(item.leagueId) || 0,
        raretype: item.raretype != null ? item.raretype : null,
        isHolo: Boolean(item.isHolo),
        searchDisabled: Boolean(item.searchDisabled),
        escalation: item.escalation && typeof item.escalation === "object" ? {
          enabled: Boolean(item.escalation.enabled),
          afterSeconds: typeof item.escalation.afterSeconds === "number" && Number.isFinite(item.escalation.afterSeconds) ? Math.max(120, Math.floor(item.escalation.afterSeconds)) : Math.max(120, Math.floor((Number(item.escalation.afterMinutes) || 0) * 60) || 120),
          afterMinutes: typeof item.escalation.afterSeconds === "number" && Number.isFinite(item.escalation.afterSeconds) ? Math.max(2, item.escalation.afterSeconds / 60) : Math.max(2, Number(item.escalation.afterMinutes) || 2),
          maxSteps: Math.max(1, Math.min(10, Math.floor(Number(item.escalation.maxSteps) || 3))),
          steps: Math.max(0, Math.floor(Number(item.escalation.steps) || 0)),
          activeMs: 0
        } : {
          enabled: false,
          afterSeconds: 120,
          afterMinutes: 2,
          maxSteps: 3,
          steps: 0,
          activeMs: 0
        }
      };
    }
    if (mode === "savedList") {
      if (!item || typeof item.name !== "string" || !(Number(item.price) > 0)) return null;
      const eaId = idOf(item.eaId);
      const playerId = idOf(item.playerId) || toBaseId(eaId);
      const versionKnown = typeof item.versionKnown === "boolean" ? item.versionKnown : false;
      return {
        id: String(item.id || item.futbinId || item.name + ":" + item.rating),
        name: item.name,
        rating: Math.round(Number(item.rating) || 0),
        eaId,
        playerId,
        versionKnown,
        eaIdTargetKey: typeof item.eaIdTargetKey === "string" ? item.eaIdTargetKey : null,
        price: Math.round(Number(item.price)),
        searches: Math.max(1, Math.round(Number(item.searches) || 3)),
        buyNow: Math.max(1, Math.round(Number(item.buyNow) || Number(item.price))),
        futbinId: item.futbinId == null ? null : String(item.futbinId),
        position: item.position || "",
        commonName: item.commonName || "",
        versionLabel: item.versionLabel || "",
        playerImageUrl: item.playerImageUrl || "",
        promoImageUrl: item.promoImageUrl || "",
        holographicAnimationUrl: item.holographicAnimationUrl || "",
        stats: item.stats && typeof item.stats === "object" ? {
          pac: Number(item.stats.pac) || 0,
          sho: Number(item.stats.sho) || 0,
          pas: Number(item.stats.pas) || 0,
          dri: Number(item.stats.dri) || 0,
          def: Number(item.stats.def) || 0,
          phy: Number(item.stats.phy) || 0,
          labels: Array.isArray(item.stats.labels) ? item.stats.labels : null
        } : null,
        nationImageUrl: item.nationImageUrl || "",
        clubImageUrl: item.clubImageUrl || "",
        leagueImageUrl: item.leagueImageUrl || "",
        leagueImageFallbacks: Array.isArray(item.leagueImageFallbacks) ? item.leagueImageFallbacks : [],
        leagueName: item.leagueName || "",
        playstylesPlus: Array.isArray(item.playstylesPlus) ? item.playstylesPlus : [],
        priceUpdatedAt: Number(item.priceUpdatedAt) || 0,
        priceTrend: item.priceTrend || null,
        priceHistory: Array.isArray(item.priceHistory) ? item.priceHistory.slice(0, 5) : [],
        nationId: Number(item.nationId) || 0,
        clubId: Number(item.clubId) || 0,
        leagueId: Number(item.leagueId) || 0,
        raretype: item.raretype != null ? item.raretype : null,
        isHolo: Boolean(item.isHolo),
        searchDisabled: Boolean(item.searchDisabled),
        escalation: item.escalation && typeof item.escalation === "object" ? {
          enabled: Boolean(item.escalation.enabled),
          afterSeconds: typeof item.escalation.afterSeconds === "number" && Number.isFinite(item.escalation.afterSeconds) ? Math.max(120, Math.floor(item.escalation.afterSeconds)) : Math.max(120, Math.floor((Number(item.escalation.afterMinutes) || 0) * 60) || 120),
          afterMinutes: typeof item.escalation.afterSeconds === "number" && Number.isFinite(item.escalation.afterSeconds) ? Math.max(2, item.escalation.afterSeconds / 60) : Math.max(2, Number(item.escalation.afterMinutes) || 2),
          maxSteps: Math.max(1, Math.min(10, Math.floor(Number(item.escalation.maxSteps) || 3))),
          steps: Math.max(0, Math.floor(Number(item.escalation.steps) || 0)),
          activeMs: 0
        } : {
          enabled: false,
          afterSeconds: 120,
          afterMinutes: 2,
          maxSteps: 3,
          steps: 0,
          activeMs: 0
        }
      };
    }
    throw new TypeError('Target normalization mode must be "live" or "savedList".');
  }
  function loadTargetStorage() {
    try {
      const savedTargets = JSON.parse(pageStorage().getItem("futrush-targets"));
      if (Array.isArray(savedTargets)) state.targets = savedTargets.map((item) => normalizeTarget(item, "live")).filter(Boolean);
    } catch (e) {
      warn("[FutRUSH:targetStore]", "Aktif hedefler localStorage\u2019dan okunamad\u0131.", "futrush-targets", String(e?.message || e));
    }
    try {
      const savedCustomData = JSON.parse(pageStorage().getItem("futrush-saved-targets"));
      if (Array.isArray(savedCustomData) && savedCustomData.length && savedCustomData[0].players) {
        state.savedTargetLists = savedCustomData.filter((list) => list && typeof list.name === "string" && Array.isArray(list.players)).map((list) => ({
          id: String(list.id || list.name),
          name: list.name,
          savedAt: Number(list.savedAt) || Date.now(),
          players: list.players.map((item) => normalizeTarget(item, "savedList")).filter(Boolean)
        }));
      } else if (Array.isArray(savedCustomData) && savedCustomData.length) {
        const legacyPlayers = savedCustomData.map((item) => normalizeTarget(item, "savedList")).filter(Boolean);
        if (legacyPlayers.length) {
          state.savedTargetLists = [{ id: "legacy-saved-targets", name: "Kay\u0131tl\u0131 Liste", savedAt: Date.now(), players: legacyPlayers }];
        }
      }
      if (state.savedTargetLists.length) state.selectedSavedTargetListId = state.savedTargetLists[0].id;
    } catch (e) {
      warn("[FutRUSH:targetStore]", "Kay\u0131tl\u0131 hedef listeleri localStorage\u2019dan okunamad\u0131.", "futrush-saved-targets", String(e?.message || e));
    }
  }

  // src/ea/page.js
  function inTransfers() {
    const items = Array.from(document.querySelectorAll(".ut-tab-bar-item"));
    const selected = items.find((i) => /\bselected\b/.test(i.className));
    if (selected) return /transfer/i.test(selected.className + " " + selected.textContent);
    return state.visible;
  }
  function topLimit() {
    let limit = 0;
    document.querySelectorAll('[class*="bar-view"]').forEach((el) => {
      const q = el.getBoundingClientRect();
      const isTopBar = q.width > 600 && q.height > 20 && q.height < 200 && q.top < vh() * 0.35;
      if (isTopBar) limit = Math.max(limit, q.bottom);
    });
    if (limit > 0) return limit + P.edge;
    const area = document.querySelector(".ut-navigation-container-view--content");
    return area ? area.getBoundingClientRect().top + P.edge : 0;
  }

  // src/ui/panel/panel.css.js
  var P2 = CONFIG.panel;
  var panelCss = `
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
    #${P2.id} {
      position: fixed;
      z-index: 5;
      display: none;
      align-items: center;
      justify-content: center;
      border-radius: ${P2.radius};
      background: ${P2.bg};
      border: ${P2.border};
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

      /* Kart \xD6zel De\u011Fi\u015Fkenleri (\xD6L\xC7\xDCLER) */
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

    #${P2.id} * { box-sizing: border-box; }

    #${P2.id} .fc-snipe-btn {
      padding: 12px 30px;
      font-size: 20px;
      font-weight: 600;
      color: #e8f4f6;
      background: transparent;
      border: 2px solid rgba(255,255,255,.55);
      border-radius: 12px;
      cursor: pointer;
    }

    #${P2.id}.fc-snipe-expanded {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      padding: 12px;
    }

    #${P2.id} .fc-snipe-tabs {
      display: flex;
      flex: 0 0 auto;
      gap: 8px;
      width: 100%;
      border-bottom: 1px solid rgba(255,255,255,.2);
    }

    #${P2.id} .fc-snipe-tab {
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

    #${P2.id} .fc-snipe-tab[aria-selected="true"] {
      color: #fff;
      border-bottom-color: #00e5ff;
    }

    #${P2.id} .fc-snipe-tab-content {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      padding: 10px 4px 4px;
      color: #e8f4f6;
    }

    #${P2.id} .fc-snipe-tab-content[data-active-tab="settings"] { overflow-y: auto; scrollbar-width: none; }
    #${P2.id} .fc-snipe-tab-content[data-active-tab="settings"]::-webkit-scrollbar { display: none; }

    #${P2.id} .fr-settings-view {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 100%;
      font-family: inherit;
      font-size: 12px;
    }

    #${P2.id} .fr-setting-row {
      padding: 9px 11px;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      background: rgba(4,12,22,.3);
    }

    #${P2.id} .fr-setting-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 7px;
      color: #e8f4f6;
      font-size: 12px;
      font-weight: 600;
    }

    #${P2.id} .fr-setting-value { color: #00e5ff; font-variant-numeric: tabular-nums; }

    #${P2.id} .fr-range {
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

    #${P2.id} .fr-range::-webkit-slider-thumb {
      width: 13px; height: 13px; appearance: none; border: 2px solid #eaffff; border-radius: 50%;
      background: #00cfe8; box-shadow: 0 0 8px rgba(0,229,255,.55); cursor: pointer;
    }

    #${P2.id} .fr-range::-moz-range-thumb {
      width: 10px; height: 10px; border: 2px solid #eaffff; border-radius: 50%;
      background: #00cfe8; box-shadow: 0 0 8px rgba(0,229,255,.55); cursor: pointer;
    }

    #${P2.id} .fr-toggle {
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

    #${P2.id} .fr-toggle::after {
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

    #${P2.id} .fr-toggle[aria-checked="true"] { background: #00aabb; border-color: #00e5ff; }
    #${P2.id} .fr-toggle[aria-checked="true"]::after { transform: translateX(16px); background: #fff; }
    #${P2.id} .fr-toggle.fr-toggle--dryrun[aria-checked="true"] { background: #eab308; border-color: #facc15; }

    #${P2.id} .fr-dry-run-top-badge {
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

    #${P2.id} .fr-counter { display: flex; align-items: center; gap: 12px; }
    #${P2.id} .fr-counter button {
      width: 27px; height: 27px; padding: 0; border: 1px solid rgba(255,255,255,.22);
      border-radius: 6px; color: #e8f4f6; background: rgba(255,255,255,.08); font-size: 18px; cursor: pointer;
      transition: background .16s ease, transform .16s ease; user-select: none;
    }
    #${P2.id} .fr-counter button:active { transform: scale(.92); background: rgba(0,229,255,.2); }
    #${P2.id} .fr-counter-value { min-width: 22px; text-align: center; color: #00e5ff; font-size: 15px; font-weight: 700; }
    #${P2.id} .fr-counter-compact { gap: 4px; width: 100%; }
    #${P2.id} .fr-counter-compact button { flex: 0 0 24px; width: 24px; height: 28px; font-size: 15px; }
    #${P2.id} .fr-counter-compact .fr-counter-input { flex: 1 1 auto; min-width: 0; text-align: center; }
    #${P2.id} .fr-counter-editable { gap: 6px; width: 100%; }
    #${P2.id} .fr-counter-editable button { flex: 0 0 28px; width: 28px; height: 30px; font-size: 16px; }
    #${P2.id} .fr-counter-editable .fr-counter-input { flex: 1 1 auto; min-width: 0; text-align: center; }

    #${P2.id} .speed-tier-top-badge {
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
    #${P2.id} .speed-tier-badge-dot { font-size: 9px; line-height: 1; }
    #${P2.id} .speed-tier-badge-name { font-weight: 700; }
    #${P2.id} .speed-tier-badge-sec { color: #e8f4f6; font-variant-numeric: tabular-nums; opacity: .9; }

    #${P2.id} .fr-balance-top-badge {
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
    #${P2.id} .fr-balance-top-badge.is-unknown {
      border-color: rgba(245, 158, 11, 0.4);
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
    }

    /* Arama H\u0131z\u0131 4 Kademeli Kart Grubu */
    #${P2.id} .speed-tier-setting-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #${P2.id} .speed-tier-active-summary {
      font-size: 11px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    #${P2.id} .speed-tier-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
    }
    @container (max-width: 380px) {
      #${P2.id} .speed-tier-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 480px) {
      #${P2.id} .speed-tier-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    #${P2.id} .speed-tier-card {
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
    #${P2.id} .speed-tier-card:hover {
      opacity: 0.8;
      border-color: rgba(255,255,255,.25);
    }
    #${P2.id} .speed-tier-card.is-active {
      opacity: 1;
      border-color: var(--tier-color);
      box-shadow: 0 0 10px var(--tier-color), inset 0 0 8px rgba(0,0,0,.4);
      background: rgba(4,12,22,.85);
    }
    #${P2.id} .speed-tier-top-stripe {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      border-top-left-radius: 5px;
      border-top-right-radius: 5px;
      background: var(--tier-color);
    }
    #${P2.id} .speed-tier-card-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 2px;
    }
    #${P2.id} .speed-tier-name-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2px;
    }
    #${P2.id} .speed-tier-name {
      color: var(--tier-color);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${P2.id} .speed-tier-warn-icon {
      font-size: 11px;
      color: #ef4444;
      font-weight: 900;
    }
    #${P2.id} .speed-tier-reset-btn {
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
    #${P2.id} .speed-tier-reset-btn:hover {
      color: #fff;
      background: rgba(255,255,255,.12);
    }
    #${P2.id} .speed-tier-default-hint {
      color: #8da2ae;
      font-size: 9.5px;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    #${P2.id} .speed-tier-risk-note {
      color: #ef4444;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.1;
      margin-top: 1px;
    }
    #${P2.id} .speed-tier-counter {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2px;
      margin-top: 4px;
      width: 100%;
      box-sizing: border-box;
    }
    #${P2.id} .speed-tier-step-btn {
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
    #${P2.id} .speed-tier-step-btn:hover:not(:disabled) {
      background: var(--tier-color);
      color: #040c16;
    }
    #${P2.id} .speed-tier-step-btn:active:not(:disabled) {
      transform: scale(.92);
    }
    #${P2.id} .speed-tier-step-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      border-color: rgba(255,255,255,.15);
      color: rgba(255,255,255,.3);
    }
    #${P2.id} .speed-tier-value {
      flex: 1 1 auto;
      text-align: center;
      color: var(--tier-color);
      font-size: 12px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      min-width: 0;
    }

    #${P2.id} .fr-setting-input {
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
    #${P2.id} .fr-setting-input::-webkit-inner-spin-button,
    #${P2.id} .fr-setting-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    #${P2.id} .fr-setting-input:focus {
      border-color: #00e5ff;
      box-shadow: 0 0 6px rgba(0,229,255,.3);
    }
    #${P2.id} .fr-setting-input::placeholder {
      color: rgba(255,255,255,.3);
    }

    #${P2.id} .fr-range-dual {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 5px;
    }

    #${P2.id} .fr-dual-field {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 11px;
      color: #9cb3be;
    }
    #${P2.id} .fr-dual-field span {
      font-weight: 500;
    }

    #${P2.id} .fr-start {
      position: relative; isolation: isolate; overflow: hidden;
      display: flex; align-items: center; justify-content: center; gap: 9px;
      width: 100%; min-height: 38px; margin-top: auto; padding: 8px 12px;
      border: 1px solid rgba(62,168,255,.72); border-radius: 8px; color: #eafcff;
      background: linear-gradient(100deg, #1b6ef3, #0aa5ff);
      font: inherit; font-size: 13px; font-weight: 700; letter-spacing: .03em; cursor: pointer;
      transition: border-color .25s ease, box-shadow .2s ease, transform .12s ease;
    }

    #${P2.id} .fr-start::before {
      position: absolute; z-index: -1; inset: 0; content: '';
      background: linear-gradient(100deg, #ff5261, #c9283a); opacity: 0;
      transition: opacity .25s ease;
    }
    #${P2.id} .fr-start:hover[data-state="idle"] { box-shadow: 0 0 14px rgba(62,168,255,.38); }
    #${P2.id} .fr-start[data-state="running"] { border-color: rgba(255,82,97,.8); animation: fr-start-pulse 2.4s ease-in-out infinite; }
    #${P2.id} .fr-start[data-state="running"]::before { opacity: 1; }
    #${P2.id} .fr-start:active { transform: scale(.98); }
    #${P2.id} .fr-start-icon { width: 18px; height: 22px; flex: 0 0 auto; }
    #${P2.id} .fr-start-icon-running { display: none; width: 18px; height: 18px; }
    #${P2.id} .fr-start[data-state="running"] .fr-start-icon-idle { display: none; }
    #${P2.id} .fr-start[data-state="running"] .fr-start-icon-running { display: block; }
    #${P2.id} .fr-start-label { display: grid; }
    #${P2.id} .fr-start-label > span { grid-area: 1 / 1; transition: opacity .12s ease; }
    #${P2.id} .fr-start-label-running { opacity: 0; }
    #${P2.id} .fr-start[data-state="running"] .fr-start-label-idle { opacity: 0; }
    #${P2.id} .fr-start[data-state="running"] .fr-start-label-running { opacity: 1; }
    @keyframes fr-start-pulse {
      0%, 100% { box-shadow: 0 0 5px rgba(255,82,97,.28), 0 0 12px rgba(201,40,58,.15); }
      50% { box-shadow: 0 0 13px rgba(255,82,97,.58), 0 0 24px rgba(201,40,58,.32); }
    }

    /* \xD6zet \xC7ubu\u011Fu (B\xF6l\xFCm 3.4) */
    #${P2.id} .fr-target-summary-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 10px; border-radius: 6px;
      background: rgba(0, 229, 255, 0.06); border: 1px solid rgba(0, 229, 255, 0.2);
      font-size: 11px; font-weight: 600; color: #c8d7df;
    }
    #${P2.id} .fr-summary-item { display: inline-flex; align-items: center; gap: 4px; }
    #${P2.id} .fr-summary-val { font-weight: 700; color: #00e5ff; font-variant-numeric: tabular-nums; }
    #${P2.id} .fr-summary-profit { color: #51d88a; }

    /* Arama \xC7ubu\u011Fu */
    #${P2.id} .fr-target-search-box {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 4px;
      z-index: 60;
    }
    #${P2.id} .fr-target-search-row { display: flex; gap: 6px; align-items: center; }
    #${P2.id} .fr-target-search-input {
      flex: 1; height: 32px; padding: 0 10px;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
      background: rgba(0,0,0,0.3); color: #fff; font-size: 12px;
      outline: none; transition: border-color 0.15s ease;
    }
    #${P2.id} .fr-target-search-input:focus { border-color: #00e5ff; }
    #${P2.id} .fr-target-update-prices-btn {
      height: 32px; padding: 0 10px; border: 1px solid rgba(0,229,255,0.4);
      border-radius: 6px; background: rgba(0,229,255,0.12); color: #00e5ff;
      font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap;
      transition: all 0.15s ease;
    }
    #${P2.id} .fr-target-update-prices-btn:hover { background: rgba(0,229,255,0.22); }
    #${P2.id} .fr-target-update-prices-btn.is-updating { opacity: 0.6; pointer-events: none; }

    /* Arama Sonu\xE7lar\u0131 */
    #${P2.id} .fr-target-search-results {
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
    #${P2.id} .fr-search-result-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 8px; border-radius: 4px; cursor: pointer; color: #fff; font-size: 12px;
    }
    #${P2.id} .fr-search-result-item:hover { background: rgba(0,229,255,0.15); }
    #${P2.id} .fr-search-player-rating-badge {
      font-size: 11px; font-weight: 800; color: #ffd447;
      background: rgba(255,212,71,0.15); padding: 1px 6px; border-radius: 4px;
    }

    /* Aday Listesi (B\xF6l\xFCm 2.3) */
    #${P2.id} .fr-candidate-selector {
      position: absolute; top: 38px; left: 4px; right: 4px; bottom: 44px; z-index: 50;
      padding: 10px; border: 1px solid #00e5ff; border-radius: 8px;
      background: rgba(6, 18, 30, 0.98); backdrop-filter: blur(8px);
      box-shadow: 0 8px 32px rgba(0,0,0,.85); display: flex; flex-direction: column;
    }
    #${P2.id} .fr-candidate-header {
      display: flex; align-items: center; justify-content: space-between;
      color: #00e5ff; font-size: 12px; font-weight: 700; margin-bottom: 6px; flex: 0 0 auto;
    }
    #${P2.id} .fr-candidate-cancel {
      border: 0; background: transparent; color: #ff5261;
      font-size: 18px; font-weight: 700; cursor: pointer; padding: 0 4px;
    }
    #${P2.id} .fr-candidate-list {
      display: flex; flex-direction: column; gap: 6px; flex: 1 1 auto;
      min-height: 0; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: rgba(0,229,255,.3) transparent;
      scrollbar-gutter: stable;
    }
    #${P2.id} .fr-candidate-card {
      padding: 6px 8px; border: 1px solid rgba(255,255,255,.12);
      border-radius: 6px; background: rgba(4,12,22,.6);
      display: flex; align-items: center; gap: 10px;
    }
    #${P2.id} .fr-candidate-body { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 4px; }
    #${P2.id} .fr-candidate-title { display: flex; align-items: center; justify-content: space-between; }
    #${P2.id} .fr-candidate-name { color: #ffd447; font-size: 12px; font-weight: 700; }
    #${P2.id} .fr-candidate-rating { color: #fff; font-size: 11px; font-weight: 700; background: rgba(255,255,255,.1); padding: 1px 4px; border-radius: 4px; }
    #${P2.id} .fr-candidate-badge {
      display: inline-flex; align-self: flex-start; width: fit-content;
      padding: 1px 6px; border-radius: 4px; color: #00e5ff; font-size: 11px; font-weight: 600;
      background: rgba(0,229,255,.15);
    }
    #${P2.id} .fr-candidate-badge-holo {
      background: linear-gradient(90deg, rgba(0,229,255,.25), rgba(255,100,200,.25));
      border: 1px solid rgba(0,229,255,.5);
      color: #00e5ff;
      text-shadow: 0 0 4px rgba(0,229,255,.6);
    }
    #${P2.id} .fr-candidate-meta { color: #8da2ae; font-size: 11px; font-variant-numeric: tabular-nums; }
    #${P2.id} .fr-candidate-price { color: #8de8b5; font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
    #${P2.id} .fr-candidate-btn {
      margin-top: 4px; padding: 4px 8px; border: 1px solid rgba(0,229,255,.5);
      border-radius: 5px; color: #040c16; background: #00e5ff;
      font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; transition: filter .15s ease;
    }
    #${P2.id} .fr-candidate-btn:hover { filter: brightness(1.15); }
    #${P2.id} .fr-candidate-btn:active { transform: scale(.98); }

    /* ==============================================================
       OTANT\u0130K EA KART B\u0130LE\u015EEN\u0130 (.fr-ea-card) - B\xD6L\xDCM 1.3
       ============================================================== */
    #${P2.id} .fr-ea-card {
      position: relative; user-select: none; display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start; border-radius: 6px; overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,.5); flex-shrink: 0; background: rgba(0,0,0,.25);
      container-type: inline-size; width: 105px !important; height: 152.7px !important; flex: 0 0 105px !important;
      font-family: var(--card-font);
    }
    #${P2.id} .fr-ea-card-preview {
      --card-w: 105px;
      --card-h: 152.7px;
    }
    #${P2.id} .fr-ea-card-thumb {
      --card-w: 70px;
      --card-h: 101.8px;
    }

    #${P2.id} .fr-ea-card.is-skeleton {
      animation: fr-card-skeleton 1.5s ease-in-out infinite alternate;
    }
    @keyframes fr-card-skeleton {
      from { filter: brightness(0.7); opacity: 0.6; }
      to { filter: brightness(1.2); opacity: 0.9; }
    }

    #${P2.id} .fr-ea-card-bg {
      position: absolute; inset: 0; background-size: 100% 100%; background-position: center; background-repeat: no-repeat; z-index: 1; opacity: 1;
    }

    /* 1. Sol \xDCst: Reyting & Mevki */
    #${P2.id} .fr-ea-card .fr-ea-card-top-left {
      position: absolute; top: 23% !important; left: 12% !important;
      display: flex; flex-direction: column; align-items: center; z-index: 4; line-height: 0.95; pointer-events: none;
    }
    #${P2.id} .fr-ea-card .fr-ea-card-rating {
      position: static !important; top: auto !important; left: auto !important;
      font-size: 15cqw !important; line-height: 0.95; font-weight: 900; color: #000 !important; text-shadow: none; letter-spacing: -0.3px;
    }
    #${P2.id} .fr-ea-card .fr-ea-card-pos {
      position: static !important; top: auto !important; left: auto !important;
      font-size: 7.5cqw !important; font-weight: 800; color: #000 !important; text-shadow: none; margin-top: 1px;
    }

    /* 2. Oyuncu Portresi */
    #${P2.id} .fr-ea-card .fr-ea-card-player-img {
      position: absolute; top: 26% !important; right: 19% !important;
      width: 58.5% !important; height: 58% !important; object-fit: contain; object-position: center top !important;
      transform: translateY(-10%) scale(1.07) !important;
      transform-origin: center top !important;
      z-index: 2; pointer-events: none; filter: drop-shadow(0 2px 4px rgba(0,0,0,.6));
      border-radius: 0; background: transparent; margin: 0; flex: none;
    }

    /* 3. \u0130sim \u015Eeridi */
    #${P2.id} .fr-ea-card .fr-ea-card-name-plate {
      position: absolute; top: 62.5% !important; left: 10%; right: 10%; height: 9.5%; z-index: 3;
      display: flex; align-items: center; justify-content: center; pointer-events: none;
      background: none;
      border-radius: 2px;
    }
    #${P2.id} .fr-ea-card .fr-ea-card-name {
      font-size: 8.5cqw !important; font-weight: 100 !important; text-transform: uppercase; color: #000;
      font-family: var(--card-name-font, var(--card-font));
      text-shadow: none; letter-spacing: -0.2px; padding: 0 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
    }

    /* 4. 6 \u0130statistik Strip (Tek Sat\u0131r 6 S\xFCtun) */
    #${P2.id} .fr-ea-card .fr-ea-card-stats-grid {
      position: absolute; top: 69% !important; left: 14.5% !important; right: 14.5% !important; height: 13.5%;
      display: grid; grid-template-columns: repeat(6, 1fr); align-items: center;
      justify-items: center; column-gap: 1px; z-index: 3; pointer-events: none;
      background: none;
      border-radius: 2px;
    }
    #${P2.id} .fr-ea-stat-item {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      line-height: 1; min-width: 0;
    }
    #${P2.id} .fr-ea-card .fr-ea-stat-lbl {
      display: var(--card-stat-lbl-display, flex);
      font-size: 6.5cqw !important; font-weight: 100 !important; letter-spacing: -0.3px; color: #000; line-height: 1;
      font-family: var(--card-stat-font, var(--card-font));
      text-shadow: none;
    }
    #${P2.id} .fr-ea-card .fr-ea-stat-val {
      font-size: 6.5cqw !important; font-weight: 100 !important; color: #000; line-height: 1.05;
      font-family: var(--card-stat-font, var(--card-font));
      text-shadow: none; font-variant-numeric: tabular-nums;
    }
    #${P2.id} .fr-ea-card.is-dark-card .fr-ea-card-rating,
    #${P2.id} .fr-ea-card.is-dark-card .fr-ea-card-pos,
    #${P2.id} .fr-ea-card.is-dark-card .fr-ea-card-name,
    #${P2.id} .fr-ea-card.is-dark-card .fr-ea-stat-lbl,
    #${P2.id} .fr-ea-card.is-dark-card .fr-ea-stat-val {
      color: #d9a900 !important;
    }
    #${P2.id} .fr-ea-card.fr-ea-card-holo .fr-ea-card-rating,
    #${P2.id} .fr-ea-card.fr-ea-card-holo .fr-ea-card-pos {
      color: #fff !important;
    }
    @container (max-width: 75px) {
      #${P2.id} .fr-ea-stat-lbl { display: none; }
      #${P2.id} .fr-ea-stat-val { font-size: 8.5cqw; }
    }

    /* 5. Alt Armalar (\xDClke, Lig, Kul\xFCp) */
    #${P2.id} .fr-ea-card .fr-ea-card-bottom-crests {
      position: absolute; top: 81% !important; bottom: auto; height: 9.5%; left: 17.5% !important; right: 17.5% !important;
      display: flex; align-items: center; justify-content: center; gap: 8.5cqw !important;
      z-index: 3; pointer-events: none;
    }
    #${P2.id} .fr-ea-crest {
      max-width: none; max-height: none; object-fit: contain;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,.7));
    }
    #${P2.id} .fr-ea-card .fr-ea-crest-nation { width: 11cqw !important; height: -11cqw !important; }
    #${P2.id} .fr-ea-card .fr-ea-crest-league { width: 11cqw !important; height: 11cqw !important; }
    #${P2.id} .fr-ea-card .fr-ea-crest-club { width: 13cqw !important; height: 11.5cqw !important; }

    /* 6. PlayStyle+ Simgeleri (B4) */
    #${P2.id} .fr-ea-card .fr-ea-card-playstyles,
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
    #${P2.id} .fr-ea-card .fr-ea-ps,
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
    #${P2.id} .fr-ea-card .fr-ea-ps img,
    .fr-ea-card .fr-ea-ps img {
      width: 150% !important;
      height: 150% !important;
      object-fit: contain !important;
    }
    #${P2.id} .fr-ea-card .fr-ea-ps::after,
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

    #${P2.id} .fr-ea-card.fr-ea-card-holo {
      box-shadow: 0 0 12px rgba(160, 32, 240, 0.45), 0 0 22px rgba(0, 229, 255, 0.35), inset 0 0 10px rgba(255, 255, 255, 0.25);
      border: 1px solid rgba(200, 160, 255, 0.65);
    }

    #${P2.id} .fr-card-holo-shimmer {
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
    #${P2.id} .fr-card-holo-webp {
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
       HEDEF L\u0130STES\u0130 & KARTLARI
       ============================================================== */
    #${P2.id} .fr-target-view {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 100%;
      position: relative;
    }
    #${P2.id} .fc-snipe-tab-content[data-active-tab="targets"] {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    #${P2.id} .fr-target-status {
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
    #${P2.id} .fr-target-status[hidden] {
      display: none !important;
    }
    #${P2.id} .fr-target-status-exiting {
      opacity: 0;
      transform: translateY(-8px);
      pointer-events: none;
    }
    #${P2.id} .fr-target-status[data-type="success"] {
      border-color: #51d88a;
      background: rgba(12, 38, 25, 0.95);
      color: #b7f5cf;
    }
    #${P2.id} .fr-target-status[data-type="error"] {
      border-color: #ff5261;
      background: rgba(45, 14, 18, 0.95);
      color: #ffb3ba;
    }
    #${P2.id} .fr-target-status[data-type="info"] {
      border-color: #00e5ff;
      background: rgba(10, 30, 48, 0.95);
      color: #d0f7ff;
    }
    #${P2.id} .fr-target-status[data-type="loading"] {
      border-color: #ffd447;
      background: rgba(40, 32, 10, 0.95);
      color: #fff0b3;
    }
    #${P2.id} .fr-target-status-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    }
    #${P2.id} .fr-target-status-icon {
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
    #${P2.id} .fr-target-status-icon[data-type="loading"] {
      border: 2px solid rgba(255,212,71,0.25);
      border-top-color: #ffd447;
      animation: fr-status-spin 0.8s linear infinite;
    }
    #${P2.id} .fr-target-status-main {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    #${P2.id} .fr-target-status-message {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 auto;
      min-width: 0;
      position: relative;
    }
    #${P2.id} .fr-target-status-message.is-overflowing {
      text-overflow: clip;
      overflow: visible;
      animation: fr-status-marquee var(--marquee-duration, 6s) linear infinite alternate;
    }
    @keyframes fr-status-marquee {
      0%, 20% { transform: translateX(0); }
      80%, 100% { transform: translateX(calc(-1 * var(--marquee-overflow, 50px))); }
    }
    #${P2.id} .fr-target-progress-label {
      font-size: 10px;
      color: #aebfc8;
      font-variant-numeric: tabular-nums;
      flex: 0 0 auto;
    }
    #${P2.id} .fr-target-progress {
      width: 100%;
      height: 3px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 99px;
      overflow: hidden;
    }
    #${P2.id} .fr-target-progress-fill {
      height: 100%;
      background: #00e5ff;
      border-radius: inherit;
      transition: width 0.25s ease;
    }
    #${P2.id} .fr-target-list {
      display: flex; flex: 1 1 auto; flex-direction: column; gap: 7px;
      min-height: 0; overflow-y: auto; overscroll-behavior: contain;
      padding: 1px 3px 2px 1px; scrollbar-width: none;
    }
    #${P2.id} .fr-target-list::-webkit-scrollbar { display: none; }
    #${P2.id} .fr-target-empty { margin: auto; color: #90a2ad; font-size: 12px; text-align: center; }

    #${P2.id} .fr-target-card {
      display: flex; align-items: stretch; gap: 10px; flex: 0 0 auto;
      padding: 8px 10px; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; background: rgba(4,12,22,.48);
      position: relative; transition: filter 0.2s ease, opacity 0.2s ease;
    }
    #${P2.id} .fr-target-card.is-search-inactive {
      opacity: 0.65;
    }
    #${P2.id} .fr-target-card.is-search-inactive > :not(.fr-target-card-body),
    #${P2.id} .fr-target-card.is-search-inactive .fr-target-card-body > :not(.fr-target-card-top),
    #${P2.id} .fr-target-card.is-search-inactive .fr-target-top-right {
      filter: grayscale(0.9) brightness(0.8);
      opacity: 0.7;
    }
    #${P2.id} .fr-target-card.is-search-inactive.is-price-exceeded {
      opacity: 0.85;
    }
    #${P2.id} .fr-target-card.is-search-inactive.is-price-exceeded > :not(.fr-target-card-body),
    #${P2.id} .fr-target-card.is-search-inactive.is-price-exceeded .fr-target-card-body > :not(.fr-target-card-top),
    #${P2.id} .fr-target-card.is-search-inactive.is-price-exceeded .fr-target-top-right {
      filter: none;
      opacity: 1;
    }
    #${P2.id} .fr-target-card.is-insufficient-balance {
      border-color: rgba(245, 158, 11, 0.45);
      background: rgba(245, 158, 11, 0.05);
    }
    #${P2.id} .fr-target-card.is-price-exceeded {
      border-color: rgba(239, 68, 68, 0.8) !important;
      background: rgba(239, 68, 68, 0.1) !important;
      animation: fr-price-exceeded-glow 1.5s ease-in-out infinite alternate !important;
    }
    #${P2.id} .fr-target-card.is-price-exceeded .fr-target-counter-input[aria-label="SATIN AL de\u011Feri"] {
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
    #${P2.id} .fr-target-badge-insufficient {
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
    #${P2.id} .fr-target-card-body {
      display: flex; flex-direction: column; justify-content: space-between; flex: 1; min-width: 0; gap: 6px;
    }
    #${P2.id} .fr-target-card-top {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
    }
    #${P2.id} .fr-target-top-left {
      display: inline-flex; align-items: center; gap: 5px; min-width: 0; flex-wrap: nowrap;
    }
    #${P2.id} .fr-escalation-top-group {
      display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
    }
    #${P2.id} .fr-target-top-right {
      display: flex; align-items: center; gap: 8px;
    }
    #${P2.id} .fr-target-last-update {
      font-size: 9px; color: #8da2ae; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    #${P2.id} .fr-target-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
    #${P2.id} .fr-target-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    #${P2.id} .fr-target-name { overflow: hidden; color: #ffd447; font-size: 13px; font-weight: 700; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
    #${P2.id} .fr-target-meta-line { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
    #${P2.id} .fr-target-rating { color: #c8d7df; font-size: 11px; font-weight: 700; }
    #${P2.id} .fr-target-version-badge { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; background: rgba(0,229,255,.15); color: #00e5ff; }
    #${P2.id} .fr-target-trend-up { color: #52c41a; font-weight: 800; font-size: 10px; line-height: 1; cursor: help; }
    #${P2.id} .fr-target-trend-down { color: #ff4d4f; font-weight: 800; font-size: 10px; line-height: 1; cursor: help; }
    #${P2.id} .fr-target-trend-same { color: #fadb14; font-size: 9px; line-height: 1; cursor: help; vertical-align: middle; }
    #${P2.id} .fr-target-remove {
      flex: 0 0 18px; width: 18px; height: 18px; margin: 0; padding: 0; border: 0;
      color: #ff5261; background: transparent; font: 700 16px/18px Arial,sans-serif; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    #${P2.id} .fr-target-remove:hover { color: #ff7582; }

    #${P2.id} .fr-target-controls {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: flex-end;
    }
    #${P2.id} .fr-target-controls > div {
      display: flex; flex-direction: column; justify-content: flex-end;
    }

    #${P2.id} .fr-target-search-toggle {
      display: inline-flex; align-items: center; justify-content: center; gap: 3px;
      margin: 0; padding: 1px 6px; border-radius: 4px;
      font-family: inherit; font-size: 11px; font-weight: 700; cursor: pointer;
      line-height: 1.2; transition: all .15s ease; width: fit-content; user-select: none;
    }
    #${P2.id} .fr-target-search-toggle.is-active {
      color: #b0bec5; background: rgba(0,255,136,.1);
      border: 1px solid rgba(0,255,136,.35);
    }
    #${P2.id} .fr-target-search-toggle.is-active .fr-search-toggle-status {
      color: #00ff88; font-weight: 800;
    }
    #${P2.id} .fr-target-search-toggle.is-active:hover {
      background: rgba(0,255,136,.18);
    }
    #${P2.id} .fr-target-search-toggle.is-inactive {
      color: #ffb4bc;
      background: rgba(239, 68, 68, 0.22);
      border: 1px solid rgba(239, 68, 68, 0.75);
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
      filter: grayscale(0) !important;
    }
    #${P2.id} .fr-target-search-toggle.is-inactive .fr-search-toggle-status {
      color: #ff3b4e;
      font-weight: 800;
      text-shadow: 0 0 6px rgba(255, 59, 78, 0.6);
      filter: grayscale(0) !important;
    }
    #${P2.id} .fr-target-search-toggle.is-inactive:hover {
      background: rgba(239, 68, 68, 0.32);
      border-color: #ff3b4e;
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
    }

    #${P2.id} .fr-target-profit {
      font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
      margin-bottom: 2px; line-height: 1.2; text-align: center; white-space: nowrap;
    }
    #${P2.id} .fr-target-profit.is-profit { color: #51d88a; }
    #${P2.id} .fr-target-profit.is-loss { color: #ff5261; }

    #${P2.id} .fr-target-control-title {
      margin-bottom: 3px; color: #aebfc8; font-size: 11px; font-weight: 700;
      letter-spacing: .04em; text-align: center; text-transform: uppercase;
    }
    #${P2.id} .fr-target-counter { display: flex; align-items: center; justify-content: center; gap: 5px; }
    #${P2.id} .fr-target-counter-editable { gap: 5px; }
    #${P2.id} .fr-target-counter-has-lowest {
      display: grid; grid-template-columns: 22px minmax(0, 1fr) 22px;
      align-items: center; gap: 5px;
    }
    #${P2.id} .fr-target-counter-has-lowest .fr-target-lowest-btn {
      grid-column: 1 / -1; justify-self: stretch; width: 100% !important;
      min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis;
    }
    #${P2.id} .fr-target-counter button {
      flex: 0 0 22px; width: 22px; height: 22px; padding: 0; border: 1px solid rgba(255,255,255,.2);
      border-radius: 5px; color: #e8f4f6; background: rgba(255,255,255,.08);
      font-size: 14px; line-height: 1; cursor: pointer; user-select: none;
    }
    #${P2.id} .fr-target-counter button:active { background: rgba(0,229,255,.2); }
    #${P2.id} .fr-target-lowest-btn {
      flex: 0 0 auto !important; width: auto !important; height: 22px !important; padding: 0 6px !important;
      font-size: 10px !important; white-space: nowrap; letter-spacing: .02em;
      /* Varsayilan gorunum sabit: hover/focus/active hicbir gorsel degisiklik YAPMAZ. */
      color: inherit !important; background: transparent !important; border: none !important;
      box-shadow: none !important; text-shadow: none !important; filter: none !important;
      transform: none !important; transition: none !important; animation: none !important;
      outline: none !important; cursor: pointer !important; pointer-events: auto !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    /* Hover efektleri TAMAMEN kaldirildi: uzerine gelindiginde renk, arka plan, parlama,
       buyume/transform, border degisimi gibi hicbir gorsel reaksiyon olmamali.
       pointer-events acik kalir (tiklanabilirlik korunur). */
    #${P2.id} .fr-target-lowest-btn:hover,
    #${P2.id} .fr-target-lowest-btn:focus,
    #${P2.id} .fr-target-lowest-btn:focus-visible,
    #${P2.id} .fr-target-lowest-btn:active,
    #${P2.id} .fr-target-counter button.fr-target-lowest-btn:hover,
    #${P2.id} .fr-target-counter button.fr-target-lowest-btn:active,
    #${P2.id} .fr-target-counter-editable .fr-target-lowest-btn:hover {
      color: inherit !important; background: transparent !important; border: none !important;
      box-shadow: none !important; text-shadow: none !important; filter: none !important;
      transform: none !important; scale: none !important; translate: none !important;
      transition: none !important; animation: none !important; outline: none !important;
      cursor: pointer !important; opacity: 1 !important; pointer-events: auto !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    #${P2.id} .fr-target-lowest-btn[disabled],
    #${P2.id} .fr-target-lowest-btn[disabled]:hover { opacity: .55; cursor: wait; }
    #${P2.id} .fr-target-counter-input {
      box-sizing: border-box; flex: 1 1 auto; width: 100%; max-width: 9ch; min-width: 44px; height: 22px;
      padding: 2px 3px; border: 1px solid rgba(255,255,255,.16); border-radius: 4px;
      color: #00e5ff; background: rgba(255,255,255,.05); font: inherit; font-size: 12px;
      font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; appearance: textfield;
    }
    #${P2.id} .fr-target-counter-input::-webkit-inner-spin-button,
    #${P2.id} .fr-target-counter-input::-webkit-outer-spin-button { margin: 0; appearance: none; }
    #${P2.id} .fr-target-counter-input:focus { outline: 1px solid rgba(0,229,255,.7); }

    #${P2.id} .fr-target-card-bottom {
      display: flex; justify-content: flex-end; width: 100%; margin-top: 2px;
    }
    #${P2.id} .fr-target-futbin-price {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; font-weight: 600; color: #8da2ae; font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    #${P2.id} .fr-target-futbin-icon {
      width: 12px; height: 12px; display: inline-block; vertical-align: middle; border-radius: 2px; flex-shrink: 0;
    }

    /* Otomatik Fiyat Artt\u0131rma (Escalation) Bile\u015Feni */
    #${P2.id} .fr-target-effective-lbl {
      font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums;
      margin-bottom: 2px; line-height: 1.2; text-align: center; white-space: nowrap;
      height: 14px; color: #00e5ff; overflow: hidden; text-overflow: ellipsis;
    }
    #${P2.id} .fr-escalation-toggle-btn {
      display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 1px; padding: 1px 6px; border-radius: 4px;
      font-family: inherit; font-size: 11px; font-weight: 700;
      cursor: pointer; line-height: 1.15; user-select: none;
      white-space: nowrap; flex-shrink: 0; transition: all 0.15s ease;
    }
    #${P2.id} .fr-escalation-btn-label {
      display: inline-flex; align-items: center; gap: 2px; font-size: 11px;
    }
    #${P2.id} .fr-escalation-active-sec {
      font-size: 9px; font-weight: 700; opacity: 0.85; line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    #${P2.id} .fr-escalation-toggle-btn.is-active {
      color: #b0bec5; background: rgba(0, 229, 255, 0.12); border: 1px solid rgba(0, 229, 255, 0.45);
    }
    #${P2.id} .fr-escalation-toggle-btn.is-active .fr-escalation-toggle-status {
      color: #00e5ff; font-weight: 800;
    }
    #${P2.id} .fr-escalation-toggle-btn.is-inactive {
      color: #8da2ae; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.18);
    }
    #${P2.id} .fr-escalation-toggle-btn.is-inactive .fr-escalation-toggle-status {
      color: #8da2ae; font-weight: 700;
    }
    #${P2.id} .fr-escalation-gear-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 19px; height: 19px; padding: 0; border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 4px; background: rgba(255, 255, 255, 0.06); color: #c8d7df;
      font-size: 11px; cursor: pointer; flex-shrink: 0; transition: all 0.15s ease;
    }
    #${P2.id} .fr-escalation-gear-btn:hover {
      background: rgba(0, 229, 255, 0.2); border-color: #00e5ff; color: #fff;
    }
    #${P2.id} .fr-escalation-badges-wrap {
      display: inline-flex; align-items: center; gap: 3px; overflow: hidden;
    }
    #${P2.id} .fr-escalation-badge {
      display: inline-flex; align-items: center; padding: 1px 4px; border-radius: 3px;
      font-size: 9px; font-weight: 800; letter-spacing: 0.02em; white-space: nowrap; user-select: none;
    }
    #${P2.id} .fr-escalation-badge-step {
      color: #00e5ff; background: rgba(0, 229, 255, 0.15); border: 1px solid rgba(0, 229, 255, 0.45);
    }
    #${P2.id} .fr-escalation-badge-ceiling {
      color: #ff5261; background: rgba(255, 82, 97, 0.22); border: 1px solid rgba(255, 82, 97, 0.65);
      animation: fr-ceiling-pulse 1.8s ease-in-out infinite alternate;
    }
    @keyframes fr-ceiling-pulse {
      from { box-shadow: 0 0 2px rgba(255, 82, 97, 0.3); }
      to { box-shadow: 0 0 8px rgba(255, 82, 97, 0.7); }
    }
    #${P2.id} .fr-escalation-badge-loss {
      color: #fbbf24; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.65);
    }
    #${P2.id} .fr-escalation-popover {
      position: absolute; bottom: 25px; left: 6px; right: 6px; z-index: 100;
      display: flex; flex-direction: column; gap: 6px; padding: 8px 10px;
      background: rgba(6, 18, 30, 0.98); border: 1px solid rgba(0, 229, 255, 0.55);
      border-radius: 6px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(8px); animation: fr-popover-in 0.15s ease;
    }
    #${P2.id} .fr-escalation-popover[hidden] {
      display: none !important;
    }
    @keyframes fr-popover-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #${P2.id} .fr-escalation-popover-head {
      display: flex; align-items: center; justify-content: space-between;
      color: #00e5ff; font-size: 11px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 4px;
    }
    #${P2.id} .fr-escalation-popover-close {
      border: 0; background: transparent; color: #ff5261; font-size: 15px; font-weight: 700;
      cursor: pointer; padding: 0 2px; line-height: 1;
    }
    #${P2.id} .fr-escalation-popover-close:hover { color: #ff7582; }
    #${P2.id} .fr-escalation-preview {
      font-size: 10.5px; font-weight: 700; color: #00e5ff; font-variant-numeric: tabular-nums;
    }
    #${P2.id} .fr-escalation-inputs-row {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    #${P2.id} .fr-escalation-field {
      display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: #aebfc8;
    }
    #${P2.id} .fr-escalation-field-label { font-weight: 600; white-space: nowrap; }

    #${P2.id} .fr-escalation-stepper {
      display: inline-flex; align-items: center; gap: 2px;
    }
    #${P2.id} .fr-escalation-step-btn {
      width: 17px; height: 20px; padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px; background: rgba(255, 255, 255, 0.08);
      color: #e8f4f6; font-size: 13px; font-weight: 700; line-height: 1;
      cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s ease;
    }
    #${P2.id} .fr-escalation-step-btn:hover {
      background: rgba(0, 229, 255, 0.25); border-color: #00e5ff; color: #fff;
    }
    #${P2.id} .fr-escalation-step-btn:active {
      transform: scale(0.95);
    }
    #${P2.id} .fr-escalation-field-input {
      width: 36px; height: 20px; padding: 1px 2px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 3px; background: rgba(255, 255, 255, 0.06);
      color: #fff; font: inherit; font-size: 11px; font-weight: 700;
      text-align: center; font-variant-numeric: tabular-nums; outline: none;
      -webkit-appearance: none; -moz-appearance: textfield; appearance: textfield;
      transition: border-color 0.15s ease;
    }
    #${P2.id} .fr-escalation-field-input::-webkit-inner-spin-button,
    #${P2.id} .fr-escalation-field-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    #${P2.id} .fr-escalation-field-input:focus { border-color: #00e5ff; }
    #${P2.id} .fr-escalation-field-input.is-invalid {
      border-color: #ff5261 !important; background: rgba(255, 82, 97, 0.12) !important;
    }
    #${P2.id} .fr-escalation-inline-error {
      color: #ff5261; font-size: 9.5px; font-weight: 600; line-height: 1.2;
    }

    /* Alt Eylemler */
    #${P2.id} .fr-target-actions { display: flex; flex: 0 0 auto; gap: 8px; margin-top: auto; padding-top: 6px; }
    #${P2.id} .fr-target-action {
      flex: 1; min-height: 34px; border: 1px solid transparent; border-radius: 7px;
      color: #fff; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
      transition: filter .18s ease, transform .18s ease;
    }
    #${P2.id} .fr-target-action:hover { filter: brightness(1.15); }
    #${P2.id} .fr-target-action:active { transform: scale(.97); }
    #${P2.id} .fr-target-save { background: linear-gradient(135deg, #0879dc, #13b5f4); border-color: rgba(115,214,255,.6); }
    #${P2.id} .fr-target-load { background: linear-gradient(135deg, #bd2537, #f04452); border-color: rgba(255,150,155,.6); }

    /* Log Sekmesi ve Log Paneli */
    #${P2.id} .fr-logs-view, .fr-bot-logs-panel .fr-logs-view { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; font-size: 11px; }
    .fr-bot-logs-panel .fr-logs-header {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.12); flex: 0 0 auto;
    }
    .fr-bot-logs-panel .fr-logs-header-title {
      font-size: 12px; font-weight: 700; color: #00e5ff; letter-spacing: 0.5px;
    }
    #${P2.id} .fr-log-summary, .fr-bot-logs-panel .fr-log-summary { flex: 0 0 auto; color: #aebfc8; font-size: 11px; font-variant-numeric: tabular-nums; }
    #${P2.id} .fr-log-toolbar, .fr-bot-logs-panel .fr-log-toolbar { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 6px; }
    #${P2.id} .fr-log-filters, .fr-bot-logs-panel .fr-log-filters { display: flex; gap: 4px; }
    #${P2.id} .fr-log-filter-btn, .fr-bot-logs-panel .fr-log-filter-btn {
      padding: 3px 6px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
      color: #9bb1bc; background: transparent; font-size: 10px; font-weight: 600; cursor: pointer;
    }
    #${P2.id} .fr-log-filter-btn.active, .fr-bot-logs-panel .fr-log-filter-btn.active { color: #00e5ff; border-color: #00e5ff; background: rgba(0,229,255,0.1); }
    #${P2.id} .fr-log-actions, .fr-bot-logs-panel .fr-log-actions { display: flex; gap: 4px; }
    #${P2.id} .fr-log-btn, .fr-bot-logs-panel .fr-log-btn {
      padding: 3px 6px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
      color: #c8d7df; background: rgba(255,255,255,0.05); font-size: 10px; font-weight: 600; cursor: pointer;
    }
    #${P2.id} .fr-log-btn:hover, .fr-bot-logs-panel .fr-log-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    #${P2.id} .fr-log-clear, .fr-bot-logs-panel .fr-log-clear {
      padding: 4px 7px; border: 1px solid rgba(255,82,97,.3); border-radius: 99px;
      color: #ff9ca4; background: rgba(255,255,255,.04); font: inherit; font-size: 11px; cursor: pointer;
      transition: background .16s ease, border-color .16s ease, color .16s ease;
    }
    #${P2.id} .fr-log-clear:hover, .fr-bot-logs-panel .fr-log-clear:hover { background: rgba(255,82,97,.12); color: #ffb3ba; }
    #${P2.id} .fr-log-list, .fr-bot-logs-panel .fr-log-list {
      display: flex; flex: 1 1 auto; flex-direction: column; gap: 5px;
      min-height: 0; overflow-y: auto; overscroll-behavior: contain;
      padding: 1px 3px 2px 1px;
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 229, 255, 0.35) transparent;
      color: #c8d7df; font-size: 11px;
    }
    #${P2.id} .fr-log-list::-webkit-scrollbar, .fr-bot-logs-panel .fr-log-list::-webkit-scrollbar {
      width: 1px !important;
      height: 1px !important;
      background: transparent !important;
    }
    #${P2.id} .fr-log-list::-webkit-scrollbar-track, .fr-bot-logs-panel .fr-log-list::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.25) !important;
      border-radius: 1px;
    }
    #${P2.id} .fr-log-list::-webkit-scrollbar-thumb, .fr-bot-logs-panel .fr-log-list::-webkit-scrollbar-thumb {
      background: rgba(0, 229, 255, 0.35) !important;
      border-radius: 1px;
      transition: background 0.2s ease;
    }
    #${P2.id} .fr-log-list::-webkit-scrollbar-thumb:hover, .fr-bot-logs-panel .fr-log-list::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 229, 255, 0.75) !important;
      box-shadow: 0 0 4px rgba(0, 229, 255, 0.8) !important;
    }
    #${P2.id} .fr-log-row, .fr-bot-logs-panel .fr-log-row {
      display: grid; grid-template-columns: 52px minmax(0,1fr); align-items: start; gap: 6px;
      padding: 6px 7px; border-left: 2px solid #3ea8ff; border-radius: 0 4px 4px 0;
      color: #bfe4ff; background: rgba(62,168,255,.12); flex: 0 0 auto;
      position: relative;
    }
    #${P2.id} .fr-log-time, .fr-bot-logs-panel .fr-log-time { color: inherit; opacity: .86; font-size: 10px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    #${P2.id} .fr-log-message, .fr-bot-logs-panel .fr-log-message { min-width: 0; overflow-wrap: anywhere; }
    #${P2.id} .fr-log-row[data-tone="success"], .fr-bot-logs-panel .fr-log-row[data-tone="success"] { border-left-color: #51d88a; color: #b7f5cf; background: rgba(81,216,138,.12); }
    #${P2.id} .fr-log-row[data-tone="info"], .fr-bot-logs-panel .fr-log-row[data-tone="info"] { border-left-color: #3ea8ff; color: #bfe4ff; background: rgba(62,168,255,.12); }
    #${P2.id} .fr-log-row[data-tone="error"], .fr-bot-logs-panel .fr-log-row[data-tone="error"] { border-left-color: #ff5261; color: #ffb3ba; background: rgba(255,82,97,.14); }
    #${P2.id} .fr-log-enter, .fr-bot-logs-panel .fr-log-enter { animation: fr-log-enter .2s ease both; }

    /* Parlama (Glow) Animasyonu \u2014 Al\u0131nd\u0131 ve BA\u015EKASI ALDI */
    #${P2.id} .log-fx-success, .fr-bot-logs-panel .log-fx-success { --fx: 34,197,94; color: #bbf7d0 !important; }
    #${P2.id} .log-fx-lost, .fr-bot-logs-panel .log-fx-lost { --fx: 239,68,68; color: #fecaca !important; }
    #${P2.id} .log-fx-success, .fr-bot-logs-panel .log-fx-success,
    #${P2.id} .log-fx-lost, .fr-bot-logs-panel .log-fx-lost {
      position: relative; overflow: hidden;
      font-weight: 700;
      letter-spacing: .2px;
      text-shadow: 0 0 8px rgba(var(--fx),.8);
      border-left-color: transparent !important;
      background: linear-gradient(90deg, rgba(var(--fx),.28), rgba(var(--fx),.12)), rgba(62,168,255,.12);
      box-shadow: inset 5px 0 0 rgb(var(--fx)), 0 0 0 1px rgba(var(--fx),.6), 0 0 20px rgba(var(--fx),.45);
    }
    #${P2.id} .log-fx-success.log-fx-new, .fr-bot-logs-panel .log-fx-success.log-fx-new {
      animation: logFxBurst 1.8s ease-out, logFxPulse 1.8s ease-in-out 1.8s 4;
    }
    #${P2.id} .log-fx-lost.log-fx-new, .fr-bot-logs-panel .log-fx-lost.log-fx-new {
      animation: logFxBurst 1.8s ease-out, logFxShake .5s ease-in-out, logFxPulse 1.8s ease-in-out 1.8s 4;
    }
    #${P2.id} .log-fx-new::after, .fr-bot-logs-panel .log-fx-new::after {
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

    /* Sat\u0131r \xDCzeri Kayan Bekleme Animasyonu */
    #${P2.id} .fr-log-row.log-wait-active, .fr-bot-logs-panel .fr-log-row.log-wait-active,
    #${P2.id} .log-row.log-wait-active, .fr-bot-logs-panel .log-row.log-wait-active {
      position: relative; overflow: hidden;
    }
    #${P2.id} .fr-log-row.log-wait-active > *, .fr-bot-logs-panel .fr-log-row.log-wait-active > *,
    #${P2.id} .log-row.log-wait-active > *, .fr-bot-logs-panel .log-row.log-wait-active > * {
      position: relative; z-index: 1; text-shadow: 0 1px 3px rgba(0,0,0,.7);
    }
    #${P2.id} .fr-log-row.log-wait-active::before, .fr-bot-logs-panel .fr-log-row.log-wait-active::before,
    #${P2.id} .log-row.log-wait-active::before, .fr-bot-logs-panel .log-row.log-wait-active::before {
      content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
      background: linear-gradient(90deg, rgba(var(--tier-rgb,56,189,248),.20) 0%, rgba(var(--tier-rgb,56,189,248),.45) 75%, rgba(var(--tier-rgb,56,189,248),.70) 100%);
      border-right: 3px solid rgba(var(--tier-rgb,56,189,248),1);
      box-shadow: 6px 0 20px rgba(var(--tier-rgb,56,189,248),.85), 0 0 10px rgba(var(--tier-rgb,56,189,248),.5);
      transform: translateX(-100%);
      animation: logWaitSlide var(--wait-ms, 2500ms) linear forwards;
    }
    #${P2.id} .fr-log-row.log-wait-fading::before, .fr-bot-logs-panel .fr-log-row.log-wait-fading::before,
    #${P2.id} .log-row.log-wait-fading::before, .fr-bot-logs-panel .log-row.log-wait-fading::before {
      opacity: 0;
      transition: opacity 300ms ease;
    }
    @keyframes logWaitSlide {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }
    #${P2.id} .log-wait-tag, .fr-bot-logs-panel .log-wait-tag {
      position: absolute; right: 6px; bottom: 1px; z-index: 2;
      font-size: 10px; transform: scale(.5); transform-origin: right bottom;
      line-height: 1; opacity: .75; color: #94a3b8; pointer-events: none; white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      #${P2.id} .log-fx-new, .fr-bot-logs-panel .log-fx-new,
      #${P2.id} .log-fx-new::after, .fr-bot-logs-panel .log-fx-new::after,
      #${P2.id} .log-fx-lost.log-fx-new, .fr-bot-logs-panel .log-fx-lost.log-fx-new {
        animation: none !important;
      }
      #${P2.id} .fr-log-row.log-wait-active::before, .fr-bot-logs-panel .fr-log-row.log-wait-active::before,
      #${P2.id} .log-row.log-wait-active::before, .fr-bot-logs-panel .log-row.log-wait-active::before {
        animation: none !important;
        transform: translateX(0);
        opacity: .5;
      }
    }

    #${P2.id} .fr-waitbar, .fr-bot-logs-panel .fr-waitbar { flex: 0 0 auto; padding: 5px 7px; border: 1px solid rgba(0,229,255,.17); border-radius: 6px; background: rgba(0,229,255,.035); }
    #${P2.id} .fr-waitbar[hidden], .fr-bot-logs-panel .fr-waitbar[hidden] { display: none; }
    #${P2.id} .fr-waitbar-label, .fr-bot-logs-panel .fr-waitbar-label { margin-bottom: 4px; color: #b7d7dd; font-size: 11px; font-variant-numeric: tabular-nums; }
    #${P2.id} .fr-waitbar-track, .fr-bot-logs-panel .fr-waitbar-track { height: 3px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.12); }
    #${P2.id} .fr-waitbar-fill, .fr-bot-logs-panel .fr-waitbar-fill {
      width: 100%; height: 100%; border-radius: inherit; background: rgba(0,229,255,.8);
      transform: scaleX(1); transform-origin: left center;
      animation: fr-wait-drain var(--fr-wait-duration) linear forwards;
      animation-delay: var(--fr-wait-delay, 0ms);
    }

    #${P2.id} .fr-governor-banner {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 7px 10px; margin: 0 0 8px 0; border-radius: 6px;
      background: rgba(255, 68, 68, 0.18); border: 1px solid rgba(255, 68, 68, 0.6);
      color: #ff6b6b; font-size: 11px; font-weight: 600; line-height: 1.3;
      flex: 0 0 auto; width: 100%; box-sizing: border-box;
    }
    #${P2.id} .fr-governor-banner.fr-governor-banner--captcha {
      background: rgba(220, 38, 38, 0.95);
      border: 2px solid #ff2222;
      color: #ffffff;
      padding: 9px 12px;
      box-shadow: 0 0 16px rgba(239, 68, 68, 0.6);
    }
    #${P2.id} .fr-governor-banner-msg { flex: 1 1 auto; min-width: 0; word-break: break-word; }
    #${P2.id} .fr-governor-resume-btn {
      flex: 0 0 auto; background: #00e5ff; color: #001018; border: none; border-radius: 4px;
      padding: 4px 8px; font-weight: 700; font-size: 11px; cursor: pointer; white-space: nowrap;
    }
    #${P2.id} .fr-governor-resume-btn:hover { background: #33ebff; }
    #${P2.id} .fr-governor-resume-btn.fr-governor-resume-btn--captcha {
      background: #ffffff;
      color: #b91c1c;
      font-weight: 800;
      font-size: 11px;
      border: 1px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    #${P2.id} .fr-governor-resume-btn.fr-governor-resume-btn--captcha:hover {
      background: #fee2e2;
    }

    @keyframes fr-status-spin { to { transform: rotate(360deg); } }
    @keyframes fr-status-enter { from { opacity: 0; transform: translateX(7px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fr-status-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
    @keyframes fr-status-flash { 0% { box-shadow: 0 0 0 rgba(81,216,138,0); } 35% { box-shadow: 0 0 14px rgba(81,216,138,.34); } 100% { box-shadow: 0 0 0 rgba(81,216,138,0); } }
    @keyframes fr-log-enter { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fr-wait-drain { to { transform: scaleX(0); } }

    @media (prefers-reduced-motion: reduce) {
      #${P2.id} .fr-card-holo-shimmer,
      #${P2.id} .fr-target-status-icon[data-type="loading"],
      #${P2.id} .fr-status-success-flash,
      #${P2.id} .fr-target-status[data-type="loading"]::after,
      #${P2.id} .fr-start[data-state="running"],
      #${P2.id} .fr-log-enter,
      #${P2.id} .fr-waitbar-fill { animation: none !important; }
      #${P2.id} .fr-target-progress-fill,
      #${P2.id} .fr-target-status,
      #${P2.id} .fr-start,
      #${P2.id} .fr-start::before,
      #${P2.id} .fr-start-label,
      #${P2.id} .fr-start-label > span,
      #${P2.id} .fr-log-clear { transition: none !important; }
    }
  `;

  // src/bot/botLog.js
  function addBotLog(message, type) {
    state.botLogId++;
    const entry = message && typeof message === "object" ? {
      id: state.botLogId,
      at: Date.now(),
      name: String(message.name ?? ""),
      rating: Number(message.rating) || 0,
      price: Number(message.price) || 0,
      profit: Number(message.profit) || 0,
      totalProfit: Number(message.totalProfit) || 0,
      kind: String(message.kind || type || "info"),
      message: String(message.message ?? ""),
      baseMs: message.baseMs != null ? Number(message.baseMs) : void 0,
      jitterMs: message.jitterMs != null ? Number(message.jitterMs) : void 0,
      totalMs: message.totalMs != null ? Number(message.totalMs) : void 0
    } : { id: state.botLogId, at: Date.now(), message: String(message), type: type || "info" };
    state.botLogs.unshift(entry);
    state.botLogs.length = Math.min(state.botLogs.length, 100);
    emit("log:added");
  }
  function setBotStatus(message) {
    state.botStatus = String(message || "");
    emit("bot:status");
  }

  // src/bot/safetyGovernor.js
  var GOVERNOR_STORAGE_KEY = "futrush-safety-governor";
  var ONE_HOUR_MS = 60 * 60 * 1e3;
  var ONE_DAY_MS = 24 * 60 * 60 * 1e3;
  function safeStorage() {
    try {
      if (typeof pageStorage === "function") {
        const s = pageStorage();
        if (s && typeof s.getItem === "function") return s;
      }
    } catch {
    }
    return {
      getItem: () => null,
      setItem: () => {
      },
      removeItem: () => {
      }
    };
  }
  var SafetyGovernor = class {
    constructor(deps = {}) {
      this.storage = deps.storage || safeStorage;
      this.searches = [];
      this.consecutiveErrors = 0;
      this.halted = false;
      this.haltReason = null;
      this.captchaHalted = false;
      this.load();
    }
    load() {
      try {
        const raw = this.storage()?.getItem(GOVERNOR_STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data.searches)) {
            const now = Date.now();
            this.searches = data.searches.filter((t) => typeof t === "number" && t >= now - ONE_DAY_MS);
          }
          if (typeof data.consecutiveErrors === "number") {
            this.consecutiveErrors = data.consecutiveErrors;
          }
          if (typeof data.halted === "boolean") {
            this.halted = data.halted;
            this.haltReason = data.haltReason || null;
          }
          if (typeof data.captchaHalted === "boolean") {
            this.captchaHalted = data.captchaHalted;
          }
        }
      } catch {
        this.searches = [];
        this.consecutiveErrors = 0;
        this.halted = false;
        this.haltReason = null;
        this.captchaHalted = false;
      }
    }
    save() {
      try {
        this.pruneOldSearches();
        const payload = {
          searches: this.searches,
          consecutiveErrors: this.consecutiveErrors,
          halted: this.halted,
          haltReason: this.haltReason,
          captchaHalted: this.captchaHalted
        };
        this.storage()?.setItem(GOVERNOR_STORAGE_KEY, JSON.stringify(payload));
      } catch {
      }
    }
    pruneOldSearches() {
      const cutoff = Date.now() - ONE_DAY_MS;
      this.searches = this.searches.filter((t) => t >= cutoff);
    }
    canSearch(context = {}) {
      if (this.isHalted()) {
        return { allowed: false, reason: this.getHaltReason() };
      }
      const now = Date.now();
      this.pruneOldSearches();
      const hourlyLimit = Number(state.snipeSettings?.hourlySearchLimit) || 0;
      if (hourlyLimit > 0) {
        const hourlyCount = this.searches.filter((t) => t >= now - ONE_HOUR_MS).length;
        if (hourlyCount >= hourlyLimit) {
          const reason = `Saatlik arama limiti doldu (${hourlyCount}/${hourlyLimit}).`;
          this.halt(reason);
          return { allowed: false, reason };
        }
      }
      const dailyLimit = Number(state.snipeSettings?.dailySearchLimit) || 0;
      if (dailyLimit > 0) {
        const dailyCount = this.searches.filter((t) => t >= now - ONE_DAY_MS).length;
        if (dailyCount >= dailyLimit) {
          const reason = `G\xFCnl\xFCk arama limiti doldu (${dailyCount}/${dailyLimit}).`;
          this.halt(reason);
          return { allowed: false, reason };
        }
      }
      const currentBought = Number(context.currentBought) || 0;
      const maxPlayers = Number(state.snipeSettings?.maxPlayers) || 0;
      if (maxPlayers > 0 && currentBought >= maxPlayers) {
        const reason = "Al\u0131m limiti doldu: " + currentBought + " oyuncu.";
        this.halt(reason);
        return { allowed: false, reason };
      }
      const currentSpent = Number(context.currentSpent) || 0;
      const nextCost = Number(context.nextCost) || 0;
      const maxSpendCoins = Number(state.snipeSettings?.maxSpendCoins) || 0;
      if (maxSpendCoins > 0) {
        if (currentSpent >= maxSpendCoins) {
          const reason = "Harcama limiti doldu: " + currentSpent.toLocaleString("tr-TR") + " coin.";
          this.halt(reason);
          return { allowed: false, reason };
        }
        if (nextCost > 0 && currentSpent + nextCost > maxSpendCoins) {
          const reason = "Harcama limiti a\u015F\u0131lacak: " + (currentSpent + nextCost).toLocaleString("tr-TR") + " > " + maxSpendCoins.toLocaleString("tr-TR") + " coin.";
          this.halt(reason);
          return { allowed: false, reason };
        }
      }
      return { allowed: true };
    }
    recordSearch() {
      this.searches.push(Date.now());
      this.save();
      emit("governor:update", this.getStats());
    }
    recordResult(statusCode) {
      const code = Number(statusCode);
      const isError = code === 429 || code === 500 || code === 502 || code === 503 || code === 520 || code >= 500 && code < 600;
      if (isError) {
        this.consecutiveErrors++;
        const limit = Math.max(1, Number(state.snipeSettings?.consecutiveErrorLimit) || 3);
        if (this.consecutiveErrors >= limit) {
          const reason = `Ard\u0131\u015F\u0131k ${this.consecutiveErrors} EA sunucu hatas\u0131 (${statusCode}) al\u0131nd\u0131. G\xFCvenlik i\xE7in durduruldu.`;
          this.halt(reason);
        } else {
          this.save();
        }
      } else if (code === 200 || code >= 200 && code < 300) {
        if (this.consecutiveErrors > 0) {
          this.consecutiveErrors = 0;
          this.save();
        }
      }
    }
    recordPurchase(price = 0) {
      this.recordResult(200);
      this.save();
      emit("governor:update", this.getStats());
    }
    halt(reason) {
      const isCaptcha = reason === "captcha" || typeof reason === "string" && reason.toLowerCase() === "captcha";
      this.halted = true;
      this.captchaHalted = isCaptcha;
      this.haltReason = isCaptcha ? "captcha" : reason || "G\xFCvenlik durdurucu devrede.";
      this.save();
      if (state.botRunning) {
        state.botRunning = false;
        state.botToken++;
      }
      const statusText = isCaptcha ? "CAPTCHA tespit edildi! G\xFCvenlik durdurucu devrede." : this.haltReason;
      const logText = isCaptcha ? "\u26D4 CAPTCHA tespit edildi! T\xFCm EA istekleri kilitlendi. L\xFCtfen do\u011Frulamay\u0131 \xE7\xF6z\xFCn." : this.haltReason;
      setBotStatus(statusText);
      addBotLog(logText, "error");
      emit("governor:halt", { reason: this.haltReason, isCaptcha });
    }
    isHalted() {
      return this.halted === true;
    }
    isCaptchaHalted() {
      return this.halted === true && (this.captchaHalted === true || this.haltReason === "captcha");
    }
    getHaltReason() {
      return this.haltReason;
    }
    resume() {
      this.halted = false;
      this.haltReason = null;
      this.captchaHalted = false;
      this.consecutiveErrors = 0;
      this.save();
      setBotStatus("G\xFCvenlik durdurucu s\u0131f\u0131rland\u0131.");
      addBotLog("G\xFCvenlik durdurucu s\u0131f\u0131rland\u0131. Taramaya devam edilebilir.", "success");
      emit("governor:resume");
    }
    getStats() {
      const now = Date.now();
      this.pruneOldSearches();
      const hourlySearches = this.searches.filter((t) => t >= now - ONE_HOUR_MS).length;
      const dailySearches = this.searches.filter((t) => t >= now - ONE_DAY_MS).length;
      return {
        hourlySearches,
        dailySearches,
        hourlyLimit: Number(state.snipeSettings?.hourlySearchLimit) || 0,
        dailyLimit: Number(state.snipeSettings?.dailySearchLimit) || 0,
        consecutiveErrors: this.consecutiveErrors,
        consecutiveErrorLimit: Number(state.snipeSettings?.consecutiveErrorLimit) || 3,
        halted: this.halted,
        captchaHalted: this.captchaHalted,
        haltReason: this.haltReason
      };
    }
    static halt(reason) {
      return safetyGovernor.halt(reason);
    }
    static resume() {
      return safetyGovernor.resume();
    }
    static isHalted() {
      return safetyGovernor.isHalted();
    }
    static isCaptchaHalted() {
      return safetyGovernor.isCaptchaHalted();
    }
  };
  var safetyGovernor = new SafetyGovernor();

  // src/utils/async.js
  function wait(ms) {
    return new Promise((resolve) => pageWindow.setTimeout(resolve, ms));
  }

  // src/utils/cancelToken.js
  var createCancelToken = () => {
    const listeners2 = /* @__PURE__ */ new Set();
    const token = {
      cancelled: false,
      cancel() {
        if (token.cancelled) return;
        token.cancelled = true;
        Array.from(listeners2).forEach((fn) => {
          try {
            fn();
          } catch (e) {
          }
        });
        listeners2.clear();
      },
      on(fn) {
        if (token.cancelled) {
          try {
            fn();
          } catch (e) {
          }
          return;
        }
        listeners2.add(fn);
      },
      off(fn) {
        listeners2.delete(fn);
      }
    };
    return token;
  };
  var randomBetween = (min, max, rnd = Math.random) => min + rnd() * Math.max(0, max - min);
  var sleep = (ms, token = null) => new Promise((resolve) => {
    if (token && token.cancelled) {
      resolve(false);
      return;
    }
    let timer = null;
    const onCancel = () => {
      clearTimeout(timer);
      resolve(false);
    };
    timer = setTimeout(() => {
      if (token) token.off(onCancel);
      resolve(true);
    }, Math.max(0, ms));
    if (token) token.on(onCancel);
  });

  // src/ea/errorCodes.js
  var fallbackCodes = {
    PERMISSION_DENIED: 461,
    STATE_INVALID: 462,
    NOT_ENOUGH_CREDIT: 470,
    DESTINATION_FULL: 473,
    NO_TRADE_EXISTS: 478,
    CAPTCHA_REQUIRED: 458,
    LOCKED_TRANSFER_MARKET: 494,
    ACCOUNT_BANNED: 2e4
  };
  var descriptions = {
    "no-coins": "Yeterli coin yok.",
    full: "Transfer listesi dolu.",
    458: "EA CAPTCHA do\u011Frulamas\u0131 gerekiyor.",
    494: "EA Transfer Market hesab\u0131 kilitli.",
    2e4: "EA hesab\u0131 yasaklanm\u0131\u015F.",
    other: "Bilinmeyen EA sat\u0131n alma hatas\u0131."
  };
  function errorCode(ad) {
    return pageWindow.UtasErrorCode?.[ad] ?? fallbackCodes[ad];
  }
  function errorText(error2) {
    if (typeof error2 === "string" && error2) return error2;
    if (typeof error2 === "number" || typeof error2 === "bigint") return String(error2);
    if (error2 && typeof error2 === "object") {
      if (typeof error2.message === "string" && error2.message) return error2.message;
      if (error2.code !== void 0 && error2.code !== null) return String(error2.code);
      try {
        const json = JSON.stringify(error2);
        if (json && json !== "{}") return json;
      } catch (serializationError) {
        return "EA hata nesnesi JSON bi\xE7imine d\xF6n\xFC\u015Ft\xFCr\xFClemedi.";
      }
    }
    return "";
  }
  function isCode(code, expected) {
    return code !== null && code !== void 0 && String(code) === String(expected);
  }
  function classifyPurchaseError(error2, purchase) {
    const code = error2?.code ?? error2?.status ?? purchase?.status ?? (typeof error2 === "number" ? error2 : null);
    const text = errorText(error2);
    const missedCodes = ["PERMISSION_DENIED", "STATE_INVALID", "NO_TRADE_EXISTS"].map(errorCode);
    const fatalCodes = ["CAPTCHA_REQUIRED", "LOCKED_TRANSFER_MARKET", "ACCOUNT_BANNED"].map(errorCode);
    let kind = "other";
    let description = text || descriptions.other;
    if (missedCodes.some((value) => isCode(code, value))) {
      kind = "missed";
      description = "Kart ba\u015Fka bir kullan\u0131c\u0131 taraf\u0131ndan al\u0131nm\u0131\u015F ya da ilan sona ermi\u015F.";
    } else if (isCode(code, errorCode("NOT_ENOUGH_CREDIT"))) {
      kind = "no-coins";
      description = descriptions[kind];
    } else if (isCode(code, errorCode("DESTINATION_FULL"))) {
      kind = "full";
      description = descriptions[kind];
    } else if (fatalCodes.some((value) => isCode(code, value))) {
      kind = "fatal";
      description = descriptions[code] || text || "EA hesab\u0131 veya transfer pazar\u0131 i\u015Flemi engellendi.";
    }
    return { kind, code: code ?? null, text: description };
  }

  // src/ea/observe.js
  function isCaptchaResponse(response) {
    if (!response) return false;
    const captchaCode = errorCode("CAPTCHA_REQUIRED") ?? 458;
    const code = response.error?.code ?? response.error?.status ?? response.status ?? response.code;
    if (code !== null && code !== void 0 && (code === captchaCode || String(code) === String(captchaCode) || String(code) === "458")) {
      return true;
    }
    const msg = response.error?.message || response.error || response.message || "";
    if (typeof msg === "string" && /captcha/i.test(msg)) {
      return true;
    }
    return false;
  }
  function observeEaRequest(observable, timeoutMs) {
    if (safetyGovernor.isCaptchaHalted()) {
      return Promise.resolve({ success: false, blocked: true, error: "CAPTCHA kilitli: T\xFCm giden EA istekleri durduruldu." });
    }
    return new Promise((resolve) => {
      if (!observable || typeof observable.observe !== "function") {
        resolve({ success: false, invalid: true, error: "EA iste\u011Fi g\xF6zlemlenemedi." });
        return;
      }
      const safeSetTimeout = typeof pageWindow?.setTimeout === "function" ? pageWindow.setTimeout.bind(pageWindow) : setTimeout;
      const safeClearTimeout = typeof pageWindow?.clearTimeout === "function" ? pageWindow.clearTimeout.bind(pageWindow) : clearTimeout;
      const scope = {};
      let finished = false;
      let timer = 0;
      let senderRef = observable;
      const finish = (response) => {
        if (finished) return;
        finished = true;
        if (timer) safeClearTimeout(timer);
        try {
          (senderRef || observable).unobserve(scope);
        } catch (e) {
          debug("[FutRUSH:ea]", "EA istek g\xF6zlemi temizlenemedi.", String(e?.message || e));
        }
        if (isCaptchaResponse(response)) {
          SafetyGovernor.halt("captcha");
        }
        resolve(response || { success: false });
      };
      timer = safeSetTimeout(() => finish({ success: false, timeout: true }), timeoutMs || 15e3);
      try {
        observable.observe(scope, (sender, response) => {
          senderRef = sender || observable;
          finish(response);
        });
      } catch (error2) {
        finish({ success: false, error: error2.message || String(error2) });
      }
    });
  }

  // src/ea/priceSteps.js
  var MIN_PRICE = 200;
  var MAX_PRICE = 14999e3;
  var MIN_BIN = MIN_PRICE;
  var PRICE_TIERS = Object.freeze([
    { min: 200, max: 1e3, step: 50 },
    { min: 1e3, max: 1e4, step: 100 },
    { min: 1e4, max: 5e4, step: 250 },
    { min: 5e4, max: 1e5, step: 500 },
    { min: 1e5, max: MAX_PRICE, step: 1e3 }
  ]);
  var clampPrice = (price) => {
    const num = Number(price);
    if (!Number.isFinite(num) || num < MIN_PRICE) return MIN_PRICE;
    if (num > MAX_PRICE) return MAX_PRICE;
    return Math.round(num);
  };
  var getPriceStep = (price) => {
    const p = Number(price) || 0;
    for (const tier of PRICE_TIERS) {
      if (p < tier.max) return tier.step;
    }
    return 1e3;
  };
  var roundToPriceStep = (price, mode = "nearest") => {
    const num = Number(price);
    if (!Number.isFinite(num) || num <= 0) return 0;
    if (num < MIN_PRICE) {
      if (mode === "up") return MIN_PRICE;
      if (mode === "down") return 0;
      return num >= MIN_PRICE / 2 ? MIN_PRICE : 0;
    }
    if (num >= MAX_PRICE) return MAX_PRICE;
    const step = getPriceStep(num);
    let rounded;
    if (mode === "down") {
      rounded = Math.floor(num / step) * step;
    } else if (mode === "up") {
      rounded = Math.ceil(num / step) * step;
    } else {
      rounded = Math.round(num / step) * step;
    }
    return Math.min(MAX_PRICE, Math.max(MIN_PRICE, rounded));
  };
  var roundDownToStep = (price) => {
    const value = Math.floor(Number(price) || 0);
    if (value <= 0) return 0;
    return roundToPriceStep(value, "down");
  };
  var roundUpToStep = (price) => {
    const value = Math.ceil(Number(price) || 0);
    if (value <= 0) return 0;
    return roundToPriceStep(value, "up");
  };
  var roundToNearestStep = (price) => roundToPriceStep(price, "nearest");
  var parsePriceInput = (raw) => Number(String(raw ?? "").replace(/[^\d]/g, "")) || 0;
  var nextPriceUp = (price) => {
    const p = Number(price) || 0;
    if (p < MIN_PRICE) return MIN_PRICE;
    if (p >= MAX_PRICE) return MAX_PRICE;
    const stepped = roundToPriceStep(p, "down");
    const next = stepped + getPriceStep(stepped);
    return Math.min(MAX_PRICE, next);
  };
  var priceAbove = nextPriceUp;
  var nextPriceDown = (price) => {
    const p = Number(price) || 0;
    if (p <= MIN_PRICE) return MIN_PRICE;
    if (p > MAX_PRICE) return roundToPriceStep(MAX_PRICE, "down");
    const stepped = roundToPriceStep(p, "up");
    const prevStep = getPriceStep(stepped - 1);
    const prev = stepped - prevStep;
    return Math.max(MIN_PRICE, prev);
  };
  var priceBelow = (price) => price > MIN_PRICE ? nextPriceDown(price) : 0;
  var getNextLowerPrice = (price) => priceBelow(price);
  var bindPriceStepRounding = (inputElement, onCommit) => {
    if (!inputElement) return () => {
    };
    let lastCommitted = null;
    const handler = () => {
      const val = parsePriceInput(inputElement.value);
      if (val <= 0) return;
      const rounded = clampPrice(roundToNearestStep(val));
      if (rounded === lastCommitted) return;
      lastCommitted = rounded;
      if (typeof onCommit === "function") {
        onCommit(rounded);
      } else {
        inputElement.value = rounded.toLocaleString("tr-TR");
      }
    };
    inputElement.addEventListener("blur", handler);
    inputElement.addEventListener("change", handler);
    return () => {
      inputElement.removeEventListener("blur", handler);
      inputElement.removeEventListener("change", handler);
    };
  };
  function runPriceStepSelfTests() {
    const testCases = [
      // Alt sınır & altı
      { name: "clampPrice alt s\u0131n\u0131r alt\u0131 (< 200)", fn: () => clampPrice(100), expected: 200 },
      { name: "clampPrice negatif", fn: () => clampPrice(-50), expected: 200 },
      { name: "clampPrice alt s\u0131n\u0131r (200)", fn: () => clampPrice(200), expected: 200 },
      { name: "roundToPriceStep alt s\u0131n\u0131r (200)", fn: () => roundToPriceStep(200, "nearest"), expected: 200 },
      { name: "nextPriceDown alt s\u0131n\u0131r (200) -> 200", fn: () => nextPriceDown(200), expected: 200 },
      // 200 - 1.000 arası (50 basamağı)
      { name: "getPriceStep(200) -> 50", fn: () => getPriceStep(200), expected: 50 },
      { name: "getPriceStep(950) -> 50", fn: () => getPriceStep(950), expected: 50 },
      { name: "nextPriceUp(200) -> 250", fn: () => nextPriceUp(200), expected: 250 },
      { name: "roundToPriceStep(240, nearest) -> 250", fn: () => roundToPriceStep(240, "nearest"), expected: 250 },
      { name: "roundToPriceStep(220, nearest) -> 200", fn: () => roundToPriceStep(220, "nearest"), expected: 200 },
      { name: "roundToPriceStep(980, nearest) -> 1000", fn: () => roundToPriceStep(980, "nearest"), expected: 1e3 },
      { name: "roundToPriceStep(980, down) -> 950", fn: () => roundToPriceStep(980, "down"), expected: 950 },
      { name: "roundToPriceStep(980, up) -> 1000", fn: () => roundToPriceStep(980, "up"), expected: 1e3 },
      // 1.000 sınır geçişi
      { name: "getPriceStep(1000) -> 100", fn: () => getPriceStep(1e3), expected: 100 },
      { name: "nextPriceUp(950) -> 1000", fn: () => nextPriceUp(950), expected: 1e3 },
      { name: "nextPriceUp(1000) -> 1100", fn: () => nextPriceUp(1e3), expected: 1100 },
      { name: "nextPriceDown(1000) -> 950", fn: () => nextPriceDown(1e3), expected: 950 },
      { name: "nextPriceDown(1100) -> 1000", fn: () => nextPriceDown(1100), expected: 1e3 },
      // 1.000 - 10.000 arası (100 basamağı)
      { name: "roundToPriceStep(1040, nearest) -> 1000", fn: () => roundToPriceStep(1040, "nearest"), expected: 1e3 },
      { name: "roundToPriceStep(1060, nearest) -> 1100", fn: () => roundToPriceStep(1060, "nearest"), expected: 1100 },
      { name: "roundToPriceStep(5420, down) -> 5400", fn: () => roundToPriceStep(5420, "down"), expected: 5400 },
      // 10.000 sınır geçişi (250 basamağına geçiş)
      { name: "getPriceStep(10000) -> 250", fn: () => getPriceStep(1e4), expected: 250 },
      { name: "nextPriceUp(9900) -> 10000", fn: () => nextPriceUp(9900), expected: 1e4 },
      { name: "nextPriceUp(10000) -> 10250", fn: () => nextPriceUp(1e4), expected: 10250 },
      { name: "nextPriceDown(10000) -> 9900", fn: () => nextPriceDown(1e4), expected: 9900 },
      { name: "nextPriceDown(10250) -> 10000", fn: () => nextPriceDown(10250), expected: 1e4 },
      { name: "roundToPriceStep(10120, down) -> 10000", fn: () => roundToPriceStep(10120, "down"), expected: 1e4 },
      { name: "roundToPriceStep(10120, up) -> 10250", fn: () => roundToPriceStep(10120, "up"), expected: 10250 },
      // 49.950 -> 50.000 geçişi ve 50.000 sınırı (500 basamağına geçiş)
      { name: "roundToPriceStep(49950, nearest) -> 50000", fn: () => roundToPriceStep(49950, "nearest"), expected: 5e4 },
      { name: "roundToPriceStep(49950, up) -> 50000", fn: () => roundToPriceStep(49950, "up"), expected: 5e4 },
      { name: "roundToPriceStep(49950, down) -> 49750", fn: () => roundToPriceStep(49950, "down"), expected: 49750 },
      { name: "getPriceStep(50000) -> 500", fn: () => getPriceStep(5e4), expected: 500 },
      { name: "nextPriceUp(49750) -> 50000", fn: () => nextPriceUp(49750), expected: 5e4 },
      { name: "nextPriceUp(50000) -> 50500", fn: () => nextPriceUp(5e4), expected: 50500 },
      { name: "nextPriceDown(50000) -> 49750", fn: () => nextPriceDown(5e4), expected: 49750 },
      { name: "nextPriceDown(50500) -> 50000", fn: () => nextPriceDown(50500), expected: 5e4 },
      // 100.000 sınır geçişi (1.000 basamağına geçiş)
      { name: "getPriceStep(100000) -> 1000", fn: () => getPriceStep(1e5), expected: 1e3 },
      { name: "nextPriceUp(99500) -> 100000", fn: () => nextPriceUp(99500), expected: 1e5 },
      { name: "nextPriceUp(100000) -> 101000", fn: () => nextPriceUp(1e5), expected: 101e3 },
      { name: "nextPriceDown(100000) -> 99500", fn: () => nextPriceDown(1e5), expected: 99500 },
      { name: "nextPriceDown(101000) -> 100000", fn: () => nextPriceDown(101e3), expected: 1e5 },
      { name: "roundToPriceStep(100400, nearest) -> 100000", fn: () => roundToPriceStep(100400, "nearest"), expected: 1e5 },
      { name: "roundToPriceStep(100600, nearest) -> 101000", fn: () => roundToPriceStep(100600, "nearest"), expected: 101e3 },
      // Üst sınır (14.999.000)
      { name: "clampPrice \xFCst s\u0131n\u0131r \xFCzeri (15.000.000) -> 14999000", fn: () => clampPrice(15e6), expected: 14999e3 },
      { name: "roundToPriceStep \xFCst s\u0131n\u0131r \xFCzeri -> 14999000", fn: () => roundToPriceStep(15e6, "nearest"), expected: 14999e3 },
      { name: "nextPriceUp(14998000) -> 14999000", fn: () => nextPriceUp(14998e3), expected: 14999e3 },
      { name: "nextPriceUp(14999000) tavan -> 14999000", fn: () => nextPriceUp(14999e3), expected: 14999e3 }
    ];
    let passed = 0;
    let failed = 0;
    for (const tc of testCases) {
      try {
        const res = tc.fn();
        if (res === tc.expected) {
          passed++;
        } else {
          failed++;
          console.error(`[FutRUSH PriceSteps Fail] ${tc.name}: Beklenen ${tc.expected}, Al\u0131nan ${res}`);
        }
      } catch (err) {
        failed++;
        console.error(`[FutRUSH PriceSteps Error] ${tc.name}:`, err);
      }
    }
    const summary = `[FutRUSH PriceSteps Test] Toplam: ${testCases.length} | Ge\xE7en: ${passed} | Kalan (Ba\u015Far\u0131s\u0131z): ${failed}`;
    console.log(summary);
    return { total: testCases.length, passed, failed };
  }
  if (typeof window !== "undefined") {
    window.__testPriceSteps = runPriceStepSelfTests;
  }

  // src/ea/market.js
  var HIGH_BID_STEPS = [
    1499e4,
    14991e3,
    14992e3,
    14993e3,
    14994e3,
    14995e3,
    14996e3,
    14997e3,
    14998e3,
    14999e3,
    15e6
  ];
  var SPECIAL_OR_HIGH_MIN_BIDS = [
    0,
    150,
    200,
    250,
    300,
    350,
    400,
    450,
    500,
    550,
    600
  ];
  var STANDARD_LOW_MIN_BIDS = [
    0,
    150
  ];
  var cacheBustCounter = 0;
  function makeAutoBuyCriteria(targetOrId, maxBuyOrOptions, maybeOptions) {
    const Criteria = pageWindow.UTSearchCriteriaDTO;
    if (typeof Criteria !== "function") throw new Error("EA arama \xF6l\xE7\xFCtleri haz\u0131r de\u011Fil. Web App\u2019i yenileyip tekrar deneyin.");
    const criteria = new Criteria();
    criteria.type = "player";
    let rawMaxBuy;
    let options;
    if (typeof maxBuyOrOptions === "object" && maxBuyOrOptions !== null) {
      options = maxBuyOrOptions;
      rawMaxBuy = options.maxBuy;
    } else {
      rawMaxBuy = maxBuyOrOptions;
      options = maybeOptions || {};
    }
    const rawId = typeof targetOrId === "object" && targetOrId !== null ? targetOrId.eaId || targetOrId.playerId : targetOrId;
    criteria.maskedDefId = Number(rawId) & 16777215;
    const target = typeof targetOrId === "object" && targetOrId !== null ? targetOrId : null;
    const inputBuyNow = Number(rawMaxBuy ?? target?.buyNow) || 0;
    const snappedMaxBuy = roundDownToStep(inputBuyNow);
    const resolvedMaxBuy = snappedMaxBuy < MIN_BIN ? MIN_BIN : snappedMaxBuy;
    criteria.maxBuy = resolvedMaxBuy;
    criteria.offset = 0;
    criteria.count = 21;
    if (target) {
      const raretype = Number(target.raretype);
      if (raretype > 0) {
        criteria.level = "SP";
        criteria.rarities = [raretype];
      } else if (Array.isArray(target.rarityIds) && target.rarityIds.length > 0) {
        criteria.level = "SP";
        criteria.rarities = target.rarityIds.map(Number);
      }
    }
    if (!options.disableCacheBust) {
      let bustIndex;
      if (typeof options.cacheBustStep === "number" && Number.isFinite(options.cacheBustStep)) {
        bustIndex = Math.abs(Math.floor(options.cacheBustStep));
      } else if (typeof options.searchIndex === "number" && Number.isFinite(options.searchIndex)) {
        bustIndex = Math.abs(Math.floor(options.searchIndex));
      } else {
        bustIndex = cacheBustCounter++;
      }
      const raretype = Number(target?.raretype) || 0;
      const isSpecial = raretype > 0 || Array.isArray(target?.rarityIds) && target.rarityIds.length > 0;
      const minBidBasePool = resolvedMaxBuy >= 1500 || isSpecial ? SPECIAL_OR_HIGH_MIN_BIDS : STANDARD_LOW_MIN_BIDS;
      let minBidPool = minBidBasePool.filter((bid) => bid === 0 || bid < resolvedMaxBuy && bid <= 600);
      if (!minBidPool.length) minBidPool = [0];
      const minBid = minBidPool[bustIndex % minBidPool.length];
      const maxBid = HIGH_BID_STEPS[Math.floor(bustIndex / minBidPool.length) % HIGH_BID_STEPS.length];
      if (minBid > 0) {
        criteria.minBid = minBid;
      }
      criteria.maxBid = maxBid;
    }
    return criteria;
  }
  async function searchAutoBuyOffers(target, eaId, token, options = {}) {
    if (safetyGovernor.isCaptchaHalted()) return { stopped: true, offers: [] };
    const services = pageWindow.services;
    const service = services && services.Item;
    if (!service || typeof service.searchTransferMarket !== "function") throw new Error("EA Transfer Market arama servisi bulunamad\u0131.");
    if (typeof service.clearTransferMarketCache === "function") {
      try {
        service.clearTransferMarketCache();
      } catch (e) {
        debug("[FutRUSH:ea]", "EA Transfer Market \xF6nbelle\u011Fi temizlenemedi.", String(e?.message || e));
      }
    }
    const rawBuyNow = Number(options.effectiveBuyNow ?? target?.buyNow) || 0;
    const snapped = roundDownToStep(rawBuyNow);
    const maxBuy = snapped < MIN_BIN ? MIN_BIN : snapped;
    const criteria = makeAutoBuyCriteria(target || eaId, maxBuy, options);
    const response = await observeEaRequest(service.searchTransferMarket(criteria, 1), 18e3);
    if (token !== state.botToken || !state.botRunning) return { stopped: true, offers: [] };
    if (!response.success) {
      const detail = response.error?.message || response.error || (response.timeout ? "zaman a\u015F\u0131m\u0131" : "EA iste\u011Fi ba\u015Far\u0131s\u0131z");
      throw new Error("EA pazar aramas\u0131 ba\u015Far\u0131s\u0131z: " + detail);
    }
    const items = Array.from(response.data?.items || []);
    const offers = items.map((item) => {
      let auction = null;
      try {
        auction = item.getAuctionData?.() || item._auction || null;
      } catch (e) {
        warnOnce("ea-auction-data-shape", "[FutRUSH:ea]", "EA ilan auction verisi okunamad\u0131.", "auction", String(e?.message || e));
      }
      const tradeId = Number(auction?.tradeId) || 0;
      const price = Number(auction?.buyNowPrice) || 0;
      const defId = Number(item?.definitionId) || 0;
      const itemBaseId = defId & 16777215;
      const rating = Number(item?.rating) || 0;
      const targetEaId = Number(target?.eaId || eaId) || 0;
      const targetBaseId = targetEaId & 16777215;
      if (!auction || !tradeId || auction.tradeOwner || itemBaseId !== targetBaseId || !price || price > maxBuy) return null;
      if (target.rating && rating !== Number(target.rating)) return null;
      if (target.versionKnown && targetEaId > 16777215 && defId !== targetEaId) return null;
      return { item, auction, price, rating, tradeId };
    }).filter(Boolean).sort((a, b) => a.price - b.price || (Number(b.auction.expires) || 0) - (Number(a.auction.expires) || 0));
    return { stopped: false, offers };
  }
  async function buyAutoOffer(offer) {
    if (safetyGovernor.isCaptchaHalted()) {
      return { success: false, blocked: true, error: "CAPTCHA kilitli" };
    }
    const service = pageWindow.services?.Item;
    if (!service || typeof service.bid !== "function") throw new Error("EA sat\u0131n alma servisi bulunamad\u0131.");
    const observable = service.bid(offer.item, offer.price);
    return observeEaRequest(observable, 15e3);
  }

  // src/ui/marketLogBox.js
  var currentBoxEl = null;
  var currentListEl = null;
  var observer = null;
  var isOpenFloating = false;
  var MAX_LOGS = 25;
  var logHistory = [];
  function ensureStyles() {
    if (typeof document === "undefined" || document.getElementById("fr-market-log-style")) return;
    const st = document.createElement("style");
    st.id = "fr-market-log-style";
    st.textContent = `
    .ut-market-search-filters-view .search-prices {
      position: relative !important;
      overflow: visible !important;
    }
    .fr-market-log-box {
      position: fixed;
      top: 65px;
      right: 24px;
      width: 420px;
      min-width: 260px;
      max-width: 90vw;
      height: 213px;
      min-height: 80px;
      max-height: 85vh;
      background: rgba(21, 29, 41, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px !important;
      box-sizing: border-box;
      display: none;
      flex-direction: column;
      z-index: 99999 !important;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #e6f6f7;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      transition: opacity 0.15s ease;
      pointer-events: auto !important;
      user-select: none;
      padding: 10px;
    }
    .fr-market-log-box * {
      box-sizing: border-box;
    }
    .fr-market-log-box .fr-logs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      flex: 0 0 auto;
    }
    .fr-market-log-box .fr-logs-header-title {
      font-size: 11px;
      font-weight: 700;
      color: #00e5ff;
      letter-spacing: 0.5px;
    }
    .fr-market-log-list {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 4px 1px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 229, 255, 0.35) transparent;
      overscroll-behavior: contain;
      pointer-events: auto !important;
      cursor: default;
    }
    .fr-market-log-list::-webkit-scrollbar {
      width: 1px !important;
      height: 1px !important;
      background: transparent !important;
    }
    .fr-market-log-list::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.25) !important;
      border-radius: 1px;
    }
    .fr-market-log-list::-webkit-scrollbar-thumb {
      background: rgba(0, 229, 255, 0.35) !important;
      border-radius: 1px;
      transition: background 0.2s ease;
    }
    .fr-market-log-list::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 229, 255, 0.75) !important;
      box-shadow: 0 0 4px rgba(0, 229, 255, 0.8) !important;
    }
    .fr-market-log-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 100px;
      text-align: center;
      color: #8fa0b5;
      padding: 10px;
      margin: auto 0;
      line-height: 1.5;
      user-select: none;
    }
    .fr-market-log-empty-sub {
      font-size: 10px;
      color: #8fa0b5;
    }
    .fr-market-log-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 2px 6px;
      min-height: 20px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      font-size: 10px;
      line-height: 1.25;
      color: #e2e8f0;
      flex: 0 0 auto;
      user-select: text;
      cursor: default;
      overflow: hidden;
      width: 100%;
    }
    .fr-market-log-item.is-success {
      border-left: 2px solid #52c41a;
    }
    .fr-market-log-item.is-error {
      border-left: 2px solid #ff4d4f;
    }
    .fr-market-log-text {
      flex: 1 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      position: relative;
      display: inline-block;
      cursor: pointer;
    }
    .fr-market-log-text.is-sliding {
      text-overflow: clip !important;
      overflow: visible !important;
      animation: fr-marquee-slide var(--marquee-duration, 3s) ease-in-out infinite alternate !important;
    }
    @keyframes fr-marquee-slide {
      0%, 15% { transform: translateX(0); }
      85%, 100% { transform: translateX(calc(-1 * var(--marquee-overflow, 50px))); }
    }
  `;
    document.head.appendChild(st);
  }
  function isPinnedListOpen() {
    const plist = document.querySelector(".ut-market-search-filters-view .ut-pinned-list, .ut-pinned-list");
    if (!plist) return false;
    if (plist.offsetParent === null || plist.hidden) return false;
    const style = window.getComputedStyle(plist);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    if (plist.offsetHeight <= 5 && plist.offsetWidth <= 5) return false;
    const hasPlayer = plist.querySelector('.listFUTItem, .ut-pinned-list-item, [class*="player"]') !== null || plist.children.length > 0;
    return hasPlayer;
  }
  function syncMarketLogVisibility() {
    if (!currentBoxEl) return;
    if (!isOpenFloating) {
      currentBoxEl.style.display = "none";
      return;
    }
    const inSearchPrices = currentBoxEl.closest && currentBoxEl.closest(".search-prices");
    if (inSearchPrices) {
      const open = isPinnedListOpen();
      currentBoxEl.style.display = open ? "flex" : "none";
    } else {
      currentBoxEl.style.display = isOpenFloating ? "flex" : "none";
    }
  }
  function openMarketLogBox() {
    isOpenFloating = true;
    if (!currentBoxEl || !currentBoxEl.isConnected) {
      mountMarketLogBox();
    }
    if (currentBoxEl) {
      currentBoxEl.style.display = "flex";
    }
  }
  function setupObserver(searchPrices) {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    const scope = searchPrices.closest(".ut-market-search-filters-view") || searchPrices.parentElement;
    if (!scope) return;
    observer = new MutationObserver(() => {
      syncMarketLogVisibility();
    });
    observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
  }
  function addMarketLog({ text, type = "info" }) {
    if (!text) return;
    const time = (/* @__PURE__ */ new Date()).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const entry = { text, type, time, id: Date.now() + Math.random() };
    logHistory.unshift(entry);
    if (logHistory.length > MAX_LOGS) {
      logHistory.pop();
    }
    const list = currentListEl || currentBoxEl && currentBoxEl.querySelector(".fr-market-log-list");
    if (list && list.isConnected) {
      const empty = list.querySelector(".fr-market-log-empty");
      if (empty) empty.remove();
      const wasAtTop = list.scrollTop <= 15;
      const row = document.createElement("div");
      row.className = "fr-market-log-item" + (entry.type === "success" ? " is-success" : entry.type === "error" ? " is-error" : "");
      const textSpan = document.createElement("span");
      textSpan.className = "fr-market-log-text";
      textSpan.textContent = `[${entry.time.slice(0, 5)}] ${entry.text}`;
      textSpan.title = "";
      row.appendChild(textSpan);
      let slideTimer = null;
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        if (textSpan.classList.contains("is-sliding")) {
          textSpan.classList.remove("is-sliding");
          if (slideTimer) {
            clearTimeout(slideTimer);
            slideTimer = null;
          }
          return;
        }
        if (textSpan.scrollWidth > textSpan.clientWidth + 1) {
          textSpan.classList.add("is-sliding");
          const overflow = textSpan.scrollWidth - textSpan.clientWidth;
          textSpan.style.setProperty("--marquee-overflow", `${overflow + 8}px`);
          const duration = Math.max(2.5, Math.min(5, overflow / 40));
          textSpan.style.setProperty("--marquee-duration", `${duration}s`);
          if (slideTimer) clearTimeout(slideTimer);
          slideTimer = setTimeout(() => {
            textSpan.classList.remove("is-sliding");
            slideTimer = null;
          }, 2e4);
        }
      });
      list.prepend(row);
      while (list.querySelectorAll(".fr-market-log-item").length > MAX_LOGS) {
        list.lastElementChild.remove();
      }
      if (wasAtTop) {
        list.scrollTop = 0;
      }
    } else {
      renderMarketLogBox(true);
    }
  }
  function mountMarketLogBox(targetContainer) {
    if (typeof document === "undefined") return;
    ensureStyles();
    const searchPrices = document.querySelector(".ut-market-search-filters-view .search-prices");
    if (searchPrices) {
      searchPrices.querySelectorAll("input").forEach((input) => {
        if (input.dataset.frBoundPrice) return;
        input.dataset.frBoundPrice = "true";
        bindPriceStepRounding(input);
      });
      setupObserver(searchPrices);
    }
    if (targetContainer) {
      let box = targetContainer.querySelector(".fr-market-log-box") || currentBoxEl || document.querySelector(".fr-market-log-box");
      if (!box) {
        box = document.createElement("div");
        box.className = "fr-market-log-box";
      }
      if (box.parentElement !== targetContainer) {
        targetContainer.appendChild(box);
      }
      currentBoxEl = box;
      setupBoxElements(box);
      renderMarketLogBox();
      return;
    }
    if (!currentBoxEl || !currentBoxEl.isConnected) {
      let box = document.querySelector(".fr-market-log-box");
      if (!box) {
        box = document.createElement("div");
        box.className = "fr-market-log-box";
        document.body.appendChild(box);
      }
      currentBoxEl = box;
      setupBoxElements(box);
    }
    renderMarketLogBox();
  }
  function setupBoxElements(box) {
    if (box.dataset.frSetup) return;
    box.dataset.frSetup = "true";
    let header = box.querySelector(".fr-logs-header");
    if (!header) {
      header = document.createElement("div");
      header.className = "fr-logs-header";
      header.innerHTML = '<span class="fr-logs-header-title">Genel Loglar</span>';
      box.appendChild(header);
    }
    let list = box.querySelector(".fr-market-log-list");
    if (!list) {
      list = document.createElement("div");
      list.className = "fr-market-log-list";
      box.appendChild(list);
    }
    currentListEl = list;
  }
  function renderMarketLogBox(forceTop = false) {
    if (typeof document === "undefined") return;
    if (!currentBoxEl || !currentBoxEl.isConnected) {
      mountMarketLogBox();
      if (!currentBoxEl) return;
    }
    setupBoxElements(currentBoxEl);
    syncMarketLogVisibility();
    const list = currentListEl || currentBoxEl.querySelector(".fr-market-log-list");
    if (!list) return;
    const wasAtTop = forceTop || list.scrollTop <= 15;
    const prevScrollTop = list.scrollTop;
    list.replaceChildren();
    if (!logHistory.length) {
      const empty = document.createElement("div");
      empty.className = "fr-market-log-empty";
      empty.innerHTML = '<span class="fr-market-log-empty-sub">Hedef ve i\u015Flem bildirimleri burada anl\u0131k olarak g\xF6sterilir.</span>';
      list.appendChild(empty);
    } else {
      logHistory.forEach((item) => {
        const row = document.createElement("div");
        row.className = "fr-market-log-item" + (item.type === "success" ? " is-success" : item.type === "error" ? " is-error" : "");
        const textSpan = document.createElement("span");
        textSpan.className = "fr-market-log-text";
        textSpan.textContent = `[${item.time.slice(0, 5)}] ${item.text}`;
        textSpan.title = "";
        row.appendChild(textSpan);
        let slideTimer = null;
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          if (textSpan.classList.contains("is-sliding")) {
            textSpan.classList.remove("is-sliding");
            if (slideTimer) {
              clearTimeout(slideTimer);
              slideTimer = null;
            }
            return;
          }
          if (textSpan.scrollWidth > textSpan.clientWidth + 1) {
            textSpan.classList.add("is-sliding");
            const overflow = textSpan.scrollWidth - textSpan.clientWidth;
            textSpan.style.setProperty("--marquee-overflow", `${overflow + 8}px`);
            const duration = Math.max(2.5, Math.min(5, overflow / 40));
            textSpan.style.setProperty("--marquee-duration", `${duration}s`);
            if (slideTimer) clearTimeout(slideTimer);
            slideTimer = setTimeout(() => {
              textSpan.classList.remove("is-sliding");
              slideTimer = null;
            }, 2e4);
          }
        });
        list.appendChild(row);
      });
    }
    if (wasAtTop) {
      list.scrollTop = 0;
    } else {
      list.scrollTop = prevScrollTop;
    }
  }
  on("targets:status", () => {
    if (state.targetStatus?.message) {
      addMarketLog({
        text: state.targetStatus.message,
        type: state.targetStatus.type || "info"
      });
    }
  });

  // src/ea/balance.js
  var currentBalance = null;
  var observer2 = null;
  var balanceListeners = /* @__PURE__ */ new Set();
  var nullLogged = false;
  function getBalance() {
    try {
      const serviceAmount = pageWindow.services?.User?.getUser?.()?.coins?.amount;
      if (typeof serviceAmount === "number" && Number.isFinite(serviceAmount)) {
        return serviceAmount;
      }
      if (serviceAmount != null && String(serviceAmount).trim() !== "") {
        const parsed = Number(serviceAmount);
        if (Number.isFinite(parsed)) return parsed;
      }
    } catch {
    }
    if (typeof document !== "undefined") {
      const coinEl = document.querySelector('.view-navbar-currency-coins, .currency-coins, [class*="currency-coins"], .view-navbar-currency');
      if (coinEl) {
        const text = coinEl.textContent || "";
        const parsed = parsePriceInput(text);
        if (parsed > 0 || text.includes("0")) {
          return parsed;
        }
      }
    }
    return null;
  }
  function applyBalanceProtection(balance) {
    if (balance === null) {
      if (!nullLogged) {
        nullLogged = true;
        addMarketLog({ text: "Bakiye okunam\u0131yor. Hedefler aktif tutuluyor.", type: "warn" });
      }
      return;
    }
    nullLogged = false;
    let changed = false;
    const targets = Array.isArray(state.targets) ? state.targets : [];
    for (const target of targets) {
      const maxBuy = Number(target.buyNow) || 0;
      const isInsufficient = maxBuy > balance;
      if (isInsufficient && !target.insufficientBalance) {
        target.insufficientBalance = true;
        changed = true;
        addMarketLog({
          text: `${target.name}: Bakiye yetersiz (${balance.toLocaleString("tr-TR")} < ${maxBuy.toLocaleString("tr-TR")}), hedef pasife al\u0131nd\u0131.`,
          type: "warn"
        });
      } else if (!isInsufficient && target.insufficientBalance) {
        target.insufficientBalance = false;
        changed = true;
        addMarketLog({
          text: `${target.name}: Bakiye yeterli (${balance.toLocaleString("tr-TR")} >= ${maxBuy.toLocaleString("tr-TR")}), hedef tekrar aktif.`,
          type: "info"
        });
      }
    }
    if (changed) {
      emit("targets:changed");
    }
  }
  function syncBalance() {
    const newBal = getBalance();
    const prevBal = currentBalance;
    const isChanged = newBal !== prevBal;
    currentBalance = newBal;
    state.currentBalance = newBal;
    applyBalanceProtection(newBal);
    if (isChanged) {
      for (const listener of balanceListeners) {
        try {
          listener(newBal, prevBal);
        } catch (err) {
          console.error("[FutRUSH:balance]", err);
        }
      }
      emit("balance:changed", newBal);
    }
    return newBal;
  }
  function ensureBalanceObserver() {
    if (observer2 || typeof document === "undefined") return;
    const targetNode = document.querySelector(".view-navbar-currency, .ut-navigation-container-view--currency, header") || document.body;
    if (!targetNode) return;
    observer2 = new MutationObserver(() => {
      syncBalance();
    });
    observer2.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  on("targets:changed", () => {
    if (currentBalance !== null) {
      applyBalanceProtection(currentBalance);
    }
  });

  // src/ea/piles.js
  var PILE_IDS = {
    TRANSFER: 5,
    UNASSIGNED: 6,
    WATCHLIST: 8
  };
  var nullLogged2 = false;
  var lastWarnedRemaining = null;
  var lastUnassignedLogged = 0;
  function getTransferListCapacity() {
    try {
      const itemRepo = pageWindow.repositories?.Item;
      if (typeof itemRepo?.getPileSize === "function") {
        const size = itemRepo.getPileSize(PILE_IDS.TRANSFER);
        if (typeof size === "number" && Number.isFinite(size) && size > 0) return size;
      }
      const coll = itemRepo?.pileSizes?._collection;
      if (coll && typeof coll[PILE_IDS.TRANSFER] === "number") {
        return coll[PILE_IDS.TRANSFER];
      }
    } catch {
    }
    const stateCap = Number(state.snipeSettings?.transferListCapacity);
    if (Number.isFinite(stateCap) && stateCap > 0) return stateCap;
    return 100;
  }
  function getTransferListCount() {
    try {
      const itemRepo = pageWindow.repositories?.Item;
      if (typeof itemRepo?.getTransferItems === "function") {
        const items = itemRepo.getTransferItems();
        if (Array.isArray(items)) return items.length;
      }
      if (typeof itemRepo?.transfer?.count === "number" && itemRepo.transfer.count >= 0) {
        return itemRepo.transfer.count;
      }
      if (itemRepo?.transfer?._collection && typeof itemRepo.transfer._collection === "object") {
        return Object.keys(itemRepo.transfer._collection).length;
      }
    } catch {
    }
    if (typeof document !== "undefined") {
      const tile = document.querySelector(".ut-tile-transfer-list .total-transfers-data, .ut-tile-transfer-list .tile-stat-value");
      if (tile) {
        const text = tile.textContent || "";
        const parsed = parsePriceInput(text);
        if (parsed > 0 || text.includes("0")) return parsed;
      }
    }
    return null;
  }
  function isTransferListFull() {
    try {
      const itemRepo = pageWindow.repositories?.Item;
      if (typeof itemRepo?.isPileFull === "function") {
        const full = itemRepo.isPileFull(PILE_IDS.TRANSFER);
        if (typeof full === "boolean") return full;
      }
    } catch {
    }
    const count = getTransferListCount();
    if (count === null) return null;
    const cap = getTransferListCapacity();
    return count >= cap;
  }
  function getUnassignedCount() {
    try {
      const itemRepo = pageWindow.repositories?.Item;
      if (typeof itemRepo?.getUnassignedItems === "function") {
        const items = itemRepo.getUnassignedItems();
        if (Array.isArray(items)) return items.length;
      }
      if (typeof itemRepo?.unassigned?.count === "number" && itemRepo.unassigned.count >= 0) {
        return itemRepo.unassigned.count;
      }
      if (itemRepo?.unassigned?._collection && typeof itemRepo.unassigned._collection === "object") {
        return Object.keys(itemRepo.unassigned._collection).length;
      }
    } catch {
    }
    if (typeof document !== "undefined") {
      const badge = document.querySelector('.ut-navigation-container-view--unassigned, [class*="unassigned"] .badge');
      if (badge) {
        const parsed = parsePriceInput(badge.textContent || "");
        if (parsed > 0) return parsed;
      }
    }
    return 0;
  }
  function checkPilesProtection(governor) {
    const count = getTransferListCount();
    const capacity = getTransferListCapacity();
    const isFull = isTransferListFull();
    const unassigned = getUnassignedCount();
    if (unassigned > 0 && unassigned !== lastUnassignedLogged) {
      lastUnassignedLogged = unassigned;
      addMarketLog({
        text: `\u26A0\uFE0F Kul\xFCpte ${unassigned} atanmam\u0131\u015F (unassigned) kart var.`,
        type: "warn"
      });
      emit("piles:unassigned-changed", unassigned);
    } else if (unassigned === 0 && lastUnassignedLogged !== 0) {
      lastUnassignedLogged = 0;
      emit("piles:unassigned-changed", 0);
    }
    if (count === null || capacity === null) {
      if (!nullLogged2) {
        nullLogged2 = true;
        addMarketLog({
          text: "Transfer Listesi dolulu\u011Fu okunam\u0131yor. Bot \xE7al\u0131\u015Fmaya devam ediyor.",
          type: "warn"
        });
        emit("piles:unknown");
      }
      return true;
    }
    nullLogged2 = false;
    if (isFull === true || count >= capacity) {
      const reasonText = `Transfer Listesi dolu (${count}/${capacity}). G\xFCvenlik i\xE7in tarama durduruldu.`;
      addMarketLog({
        text: `\u26D4 ${reasonText}`,
        type: "error"
      });
      if (governor && typeof governor.halt === "function") {
        governor.halt("liste_dolu");
      }
      emit("piles:full", { count, capacity });
      return false;
    }
    const warnThreshold = Math.max(1, Number(state.snipeSettings?.transferListWarnThreshold) || 5);
    const remaining = capacity - count;
    if (remaining <= warnThreshold) {
      if (lastWarnedRemaining !== remaining) {
        lastWarnedRemaining = remaining;
        addMarketLog({
          text: `\u26A0\uFE0F Transfer Listesinde az yer kald\u0131: ${remaining} bo\u015F slot (${count}/${capacity}).`,
          type: "warn"
        });
        emit("piles:warn-threshold", { count, capacity, remaining });
      }
    } else {
      lastWarnedRemaining = null;
    }
    emit("piles:update", { count, capacity, remaining });
    return true;
  }

  // src/ea/priceCapGuard.js
  var DEFAULT_MAX_PRICE_THRESHOLD = 0.5;
  function isExceedingFutbin(buyNow, futbinPrice) {
    const buy = Number(buyNow) || 0;
    const fb = Number(futbinPrice);
    if (!Number.isFinite(fb) || fb <= 0 || buy <= 0) return false;
    return buy > fb;
  }
  function calculateMaxAllowedPrice(futbinPrice, thresholdRate) {
    const fb = Number(futbinPrice);
    if (!Number.isFinite(fb) || fb <= 0) return null;
    const rate = typeof thresholdRate === "number" && Number.isFinite(thresholdRate) && thresholdRate > 0 ? thresholdRate : Number(state.snipeSettings?.maxPriceCapThreshold) || DEFAULT_MAX_PRICE_THRESHOLD;
    const rawCap = fb * (1 + rate);
    return roundDownToStep(rawCap);
  }
  function validatePriceCap(enteredBuyNow, futbinPrice, options = {}) {
    const buyNow = Number(enteredBuyNow) || 0;
    const fb = Number(futbinPrice);
    if (!Number.isFinite(fb) || fb <= 0) {
      return { allowed: true, maxAllowed: null };
    }
    const maxAllowed = calculateMaxAllowedPrice(fb, options.thresholdRate);
    if (maxAllowed === null) {
      return { allowed: true, maxAllowed: null };
    }
    if (buyNow > maxAllowed) {
      const ratePercent = Math.round((Number(options.thresholdRate) || (Number(state.snipeSettings?.maxPriceCapThreshold) || DEFAULT_MAX_PRICE_THRESHOLD)) * 100);
      return {
        allowed: false,
        maxAllowed,
        futbinPrice: fb,
        reason: `Fiyat FutBIN piyasa de\u011Ferinin (${fb.toLocaleString("tr-TR")}) %${ratePercent} \xFCzerinde (${buyNow.toLocaleString("tr-TR")} > ${maxAllowed.toLocaleString("tr-TR")}). Fazla s\u0131f\u0131r korumas\u0131 devrede.`
      };
    }
    return { allowed: true, maxAllowed };
  }
  function checkPriceCapGuard(target, offerPrice, options = {}) {
    const futbinRef = Number(target?.price);
    const priceToCheck = offerPrice != null ? Number(offerPrice) : Number(target?.buyNow);
    const strictMode = options.strictMarketCap !== void 0 ? Boolean(options.strictMarketCap) : Boolean(state.snipeSettings?.strictMarketCap);
    if (strictMode && isExceedingFutbin(priceToCheck, futbinRef)) {
      const text = `\u{1F6E1}\uFE0F [Fiyat Korumas\u0131 - Kat\u0131 Mod] ${target?.name || "Oyuncu"}: Sat\u0131n Al (${priceToCheck.toLocaleString("tr-TR")}) FutBIN piyasa fiyat\u0131n\u0131 (${futbinRef.toLocaleString("tr-TR")}) a\u015F\u0131yor! Tarama ve sat\u0131n alma engellendi.`;
      addMarketLog({
        text,
        type: "error"
      });
      emit("target:price-cap-exceeded", { target, offerPrice: priceToCheck, reason: "exceeds_futbin" });
      return false;
    }
    const result = validatePriceCap(priceToCheck, futbinRef);
    if (!result.allowed) {
      const text = `\u{1F6E1}\uFE0F [Fiyat Korumas\u0131] ${target?.name || "Oyuncu"}: A\u015F\u0131r\u0131 tavan fiyat/fazla s\u0131f\u0131r engellendi! ${result.reason}`;
      addMarketLog({
        text,
        type: "error"
      });
      emit("target:price-cap-exceeded", { target, offerPrice: priceToCheck, result });
      return false;
    }
    return true;
  }

  // src/ea/escalation.js
  var MIN_ESCALATION_SECONDS = 120;
  var DEFAULT_ESCALATION_SECONDS = 120;
  var MIN_ESCALATION_STEPS = 1;
  var MAX_ESCALATION_STEPS = 10;
  var DEFAULT_MAX_STEPS = 3;
  var PRICE_STALE_TIMEOUT_MS = 24 * 60 * 60 * 1e3;
  function isFutbinFreshAndValid(target, now = Date.now()) {
    const futbinPrice = Number(target?.price);
    if (!Number.isFinite(futbinPrice) || futbinPrice <= 0) return false;
    const updatedAt = Number(target?.priceUpdatedAt) || 0;
    if (!updatedAt || now - updatedAt > PRICE_STALE_TIMEOUT_MS) return false;
    return true;
  }
  function computeEffectiveBuyNow(target, ctx = {}) {
    const baseBuyNow = Math.max(MIN_BIN, roundDownToStep(Number(target?.buyNow) || MIN_BIN));
    const escalation = target?.escalation;
    const enabled = Boolean(escalation?.enabled);
    const requestedSteps = Math.max(0, Math.floor(Number(escalation?.steps) || 0));
    const maxSteps = Math.max(MIN_ESCALATION_STEPS, Math.min(MAX_ESCALATION_STEPS, Math.floor(Number(escalation?.maxSteps) || DEFAULT_MAX_STEPS)));
    const now = typeof ctx.now === "number" ? ctx.now : Date.now();
    const futbinValid = isFutbinFreshAndValid(target, now);
    const futbinPrice = Number(target?.price) || 0;
    let faz2Cap = null;
    if (futbinValid && futbinPrice > 0) {
      faz2Cap = calculateMaxAllowedPrice(futbinPrice, ctx.maxPriceCapThreshold);
    }
    if (!enabled || requestedSteps === 0) {
      let effective = baseBuyNow;
      let isAtCeiling2 = false;
      let ceilingReason2 = null;
      if (faz2Cap !== null && effective > faz2Cap) {
        effective = faz2Cap;
        isAtCeiling2 = true;
        ceilingReason2 = "Faz 2 tavan\u0131 a\u015F\u0131ld\u0131";
      }
      const isRiskOfLoss2 = futbinValid && effective > Math.round(futbinPrice * 0.95);
      return {
        effectiveBuyNow: effective,
        baseBuyNow,
        stepsApplied: 0,
        isAtCeiling: isAtCeiling2,
        ceilingReason: ceilingReason2,
        isRiskOfLoss: isRiskOfLoss2,
        futbinValid,
        maxAllowedCap: faz2Cap
      };
    }
    let maxStepsCap = baseBuyNow;
    for (let i = 0; i < maxSteps; i++) {
      maxStepsCap = priceAbove(maxStepsCap);
    }
    const stepsToApply = Math.min(requestedSteps, maxSteps);
    let currentSteppedPrice = baseBuyNow;
    let actuallyAppliedSteps = 0;
    for (let i = 0; i < stepsToApply; i++) {
      const nextCandidate = priceAbove(currentSteppedPrice);
      if (faz2Cap !== null && nextCandidate > faz2Cap) {
        break;
      }
      currentSteppedPrice = nextCandidate;
      actuallyAppliedSteps++;
    }
    let finalEffective = currentSteppedPrice;
    let isAtCeiling = false;
    let ceilingReason = null;
    if (faz2Cap !== null && finalEffective >= faz2Cap) {
      finalEffective = Math.min(finalEffective, faz2Cap);
      isAtCeiling = true;
      ceilingReason = "Faz 2 a\u015F\u0131r\u0131 harcama tavan\u0131na ula\u015F\u0131ld\u0131";
    }
    if (actuallyAppliedSteps >= maxSteps || finalEffective >= maxStepsCap) {
      isAtCeiling = true;
      ceilingReason = ceilingReason || `Maksimum basamak s\u0131n\u0131r\u0131na (${maxSteps}) ula\u015F\u0131ld\u0131`;
    }
    const isRiskOfLoss = futbinValid && finalEffective > Math.round(futbinPrice * 0.95);
    return {
      effectiveBuyNow: finalEffective,
      baseBuyNow,
      stepsApplied: actuallyAppliedSteps,
      isAtCeiling,
      ceilingReason: isAtCeiling ? ceilingReason : null,
      isRiskOfLoss,
      futbinValid,
      maxAllowedCap: faz2Cap
    };
  }
  function recordEscalationSearch(target, outcome, ctx = {}) {
    const escalation = target?.escalation;
    if (!escalation || !escalation.enabled) {
      return { steppedUp: false, reachedCeiling: false, oldEffective: Number(target?.buyNow) || MIN_BIN, newEffective: Number(target?.buyNow) || MIN_BIN, steps: 0 };
    }
    const beforeCalc = computeEffectiveBuyNow(target, ctx);
    if (outcome.matchFound) {
      escalation.activeMs = 0;
      return {
        steppedUp: false,
        reachedCeiling: beforeCalc.isAtCeiling,
        oldEffective: beforeCalc.effectiveBuyNow,
        newEffective: beforeCalc.effectiveBuyNow,
        steps: escalation.steps || 0
      };
    }
    if (!outcome.canProgress) {
      return {
        steppedUp: false,
        reachedCeiling: beforeCalc.isAtCeiling,
        oldEffective: beforeCalc.effectiveBuyNow,
        newEffective: beforeCalc.effectiveBuyNow,
        steps: escalation.steps || 0
      };
    }
    const safeDeltaMs = Math.max(0, Math.min(Number(outcome.elapsedMs) || 0, 3e4));
    escalation.activeMs = (Number(escalation.activeMs) || 0) + safeDeltaMs;
    const afterSeconds = typeof escalation.afterSeconds === "number" && Number.isFinite(escalation.afterSeconds) ? Math.max(MIN_ESCALATION_SECONDS, Math.floor(escalation.afterSeconds)) : Math.max(MIN_ESCALATION_SECONDS, Math.floor((Number(escalation.afterMinutes) || 0) * 60) || DEFAULT_ESCALATION_SECONDS);
    const targetDurationMs = afterSeconds * 1e3;
    if (escalation.activeMs < targetDurationMs) {
      return {
        steppedUp: false,
        reachedCeiling: beforeCalc.isAtCeiling,
        oldEffective: beforeCalc.effectiveBuyNow,
        newEffective: beforeCalc.effectiveBuyNow,
        steps: escalation.steps || 0
      };
    }
    escalation.activeMs = 0;
    if (!beforeCalc.futbinValid) {
      return {
        steppedUp: false,
        reachedCeiling: false,
        oldEffective: beforeCalc.effectiveBuyNow,
        newEffective: beforeCalc.effectiveBuyNow,
        steps: escalation.steps || 0
      };
    }
    const maxSteps = Math.max(MIN_ESCALATION_STEPS, Math.min(MAX_ESCALATION_STEPS, Math.floor(Number(escalation.maxSteps) || DEFAULT_MAX_STEPS)));
    const currentSteps = Math.max(0, Math.floor(Number(escalation.steps) || 0));
    const candidateTarget = {
      ...target,
      escalation: { ...escalation, steps: currentSteps + 1 }
    };
    const afterCalc = computeEffectiveBuyNow(candidateTarget, ctx);
    if (currentSteps < maxSteps && afterCalc.effectiveBuyNow > beforeCalc.effectiveBuyNow) {
      escalation.steps = currentSteps + 1;
      escalation.ceilingLogged = false;
      const durationLabel = afterSeconds >= 60 && afterSeconds % 60 === 0 ? `${afterSeconds / 60} dk` : `${afterSeconds} sn`;
      const logMessage2 = `${target.name}: ${durationLabel} bulunamad\u0131, hedef ${beforeCalc.effectiveBuyNow.toLocaleString("tr-TR")} \u2192 ${afterCalc.effectiveBuyNow.toLocaleString("tr-TR")} (+${escalation.steps})`;
      return {
        steppedUp: true,
        reachedCeiling: afterCalc.isAtCeiling,
        oldEffective: beforeCalc.effectiveBuyNow,
        newEffective: afterCalc.effectiveBuyNow,
        steps: escalation.steps,
        logMessage: logMessage2
      };
    }
    let logMessage;
    if (!escalation.ceilingLogged) {
      escalation.ceilingLogged = true;
      logMessage = `${target.name}: Fiyat artt\u0131rma tavan\u0131na ula\u015Ft\u0131 (${beforeCalc.effectiveBuyNow.toLocaleString("tr-TR")}), daha fazla art\u0131r\u0131lamaz.`;
    }
    return {
      steppedUp: false,
      reachedCeiling: true,
      oldEffective: beforeCalc.effectiveBuyNow,
      newEffective: beforeCalc.effectiveBuyNow,
      steps: escalation.steps || 0,
      logMessage
    };
  }
  function resetEscalationOnPurchase(target) {
    if (target) {
      target._lastSearchActiveAt = null;
    }
    if (target?.escalation) {
      const hadProgress = Boolean(target.escalation.enabled && (target.escalation.steps > 0 || target.escalation.activeMs > 0));
      target.escalation.steps = 0;
      target.escalation.activeMs = 0;
      target.escalation.ceilingLogged = false;
      return hadProgress;
    }
    return false;
  }
  function resetEscalationOnManualChange(target) {
    if (target) {
      target._lastSearchActiveAt = null;
    }
    if (target?.escalation) {
      target.escalation.steps = 0;
      target.escalation.activeMs = 0;
      target.escalation.ceilingLogged = false;
    }
  }
  function runEscalationSelfTests() {
    const now = Date.now();
    const testCases = [
      {
        name: "Duraklat\u0131lm\u0131\u015Fken / canProgress false iken saya\xE7 ilerlememeli",
        fn: () => {
          const t = { name: "P1", buyNow: 1e3, price: 2e3, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 10, maxSteps: 3, steps: 0, activeMs: 0 } };
          const res = recordEscalationSearch(t, { matchFound: false, elapsedMs: 5e3, canProgress: false }, { now });
          return t.escalation.activeMs === 0 && !res.steppedUp;
        }
      },
      {
        name: "S\xFCre dolunca (activeMs >= afterMinutes) steps 1 artmal\u0131",
        fn: () => {
          const t = { name: "P2", buyNow: 1e3, price: 3e3, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 3, steps: 0, activeMs: 5 * 60 * 1e3 - 1e3 } };
          const res = recordEscalationSearch(t, { matchFound: false, elapsedMs: 2e3, canProgress: true }, { now });
          return res.steppedUp && t.escalation.steps === 1 && t.escalation.activeMs === 0;
        }
      },
      {
        name: "maxSteps s\u0131n\u0131r\u0131na ula\u015F\u0131l\u0131nca daha fazla artmamal\u0131",
        fn: () => {
          const t = { name: "P3", buyNow: 1e3, price: 5e3, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 2, steps: 2, activeMs: 5 * 60 * 1e3 } };
          const res = recordEscalationSearch(t, { matchFound: false, elapsedMs: 1e3, canProgress: true }, { now });
          return !res.steppedUp && res.reachedCeiling && t.escalation.steps === 2;
        }
      },
      {
        name: "Faz 2 a\u015F\u0131r\u0131 harcama tavan\u0131 s\u0131n\u0131r\u0131 (FutBIN * (1 + e\u015Fik)) a\u015F\u0131lmamal\u0131",
        fn: () => {
          const t = { name: "P4", buyNow: 1400, price: 1e3, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 3, steps: 1, activeMs: 5 * 60 * 1e3 } };
          recordEscalationSearch(t, { matchFound: false, elapsedMs: 1e3, canProgress: true }, { now, maxPriceCapThreshold: 0.5 });
          const eff = computeEffectiveBuyNow(t, { now, maxPriceCapThreshold: 0.5 });
          return eff.effectiveBuyNow === 1500 && eff.isAtCeiling;
        }
      },
      {
        name: "maxSteps ile Faz 2 tavan\u0131ndan d\xFC\u015F\xFCk olan s\u0131n\u0131r se\xE7ilmeli",
        fn: () => {
          const t = { name: "P5", buyNow: 1e4, price: 1e4, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 1, steps: 5, activeMs: 0 } };
          const eff = computeEffectiveBuyNow(t, { now, maxPriceCapThreshold: 0.5 });
          return eff.effectiveBuyNow === 10250 && eff.stepsApplied === 1;
        }
      },
      {
        name: "FutBIN referans\u0131 null/ge\xE7ersiz iken art\u0131rma yap\u0131lmamal\u0131",
        fn: () => {
          const t = { name: "P6", buyNow: 1e3, price: null, priceUpdatedAt: null, escalation: { enabled: true, afterMinutes: 5, maxSteps: 3, steps: 0, activeMs: 5 * 60 * 1e3 } };
          const res = recordEscalationSearch(t, { matchFound: false, elapsedMs: 1e3, canProgress: true }, { now });
          return !res.steppedUp && t.escalation.steps === 0;
        }
      },
      {
        name: "Sat\u0131n alma sonras\u0131 resetEscalationOnPurchase ile ad\u0131mlar s\u0131f\u0131rlanmal\u0131",
        fn: () => {
          const t = { name: "P7", buyNow: 1e3, price: 2e3, escalation: { enabled: true, steps: 2, activeMs: 12e3, ceilingLogged: true } };
          resetEscalationOnPurchase(t);
          return t.escalation.steps === 0 && t.escalation.activeMs === 0 && !t.escalation.ceilingLogged;
        }
      },
      {
        name: "E\u015Fle\u015Fme bulununca activeMs s\u0131f\u0131rlanmal\u0131 fakat steps korunmal\u0131",
        fn: () => {
          const t = { name: "P8", buyNow: 1e3, price: 2e3, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 10, maxSteps: 3, steps: 2, activeMs: 3e4 } };
          recordEscalationSearch(t, { matchFound: true, elapsedMs: 1e3, canProgress: true }, { now });
          return t.escalation.steps === 2 && t.escalation.activeMs === 0;
        }
      },
      {
        name: "Kullan\u0131c\u0131 buyNow de\u011Fi\u015Ftirdi\u011Finde resetEscalationOnManualChange ile s\u0131f\u0131rlanmal\u0131",
        fn: () => {
          const t = { name: "P9", buyNow: 1e3, escalation: { enabled: true, steps: 3, activeMs: 4e3 } };
          resetEscalationOnManualChange(t);
          return t.escalation.steps === 0 && t.escalation.activeMs === 0;
        }
      },
      {
        name: "1.000 s\u0131n\u0131r ge\xE7i\u015Fi: 950 -> 1.000 -> 1.100 basamak atlamas\u0131",
        fn: () => {
          const t = { name: "P10", buyNow: 950, price: 5e3, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 3, steps: 2 } };
          const eff = computeEffectiveBuyNow(t, { now });
          return eff.effectiveBuyNow === 1100;
        }
      },
      {
        name: "10.000 s\u0131n\u0131r ge\xE7i\u015Fi: 9.900 -> 10.000 -> 10.250 basamak atlamas\u0131",
        fn: () => {
          const t = { name: "P11", buyNow: 9900, price: 2e4, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 3, steps: 2 } };
          const eff = computeEffectiveBuyNow(t, { now });
          return eff.effectiveBuyNow === 10250;
        }
      },
      {
        name: "Tavan d\xFC\u015F\xFCnce efektif fiyat\u0131n a\u015Fa\u011F\u0131 \xE7ekilmesi",
        fn: () => {
          const t = { name: "P12", buyNow: 1e3, price: 1e3, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 3, steps: 3 } };
          const eff = computeEffectiveBuyNow(t, { now, maxPriceCapThreshold: 0.1 });
          return eff.effectiveBuyNow === 1100 && eff.isAtCeiling;
        }
      },
      {
        name: "Tavana ula\u015Ft\u0131 logunun tek kez yaz\u0131lmas\u0131",
        fn: () => {
          const t = { name: "P13", buyNow: 1e3, price: 5e3, priceUpdatedAt: now, escalation: { enabled: true, afterMinutes: 5, maxSteps: 1, steps: 1, activeMs: 5 * 60 * 1e3, ceilingLogged: false } };
          const res1 = recordEscalationSearch(t, { matchFound: false, elapsedMs: 1e3, canProgress: true }, { now });
          const res2 = recordEscalationSearch(t, { matchFound: false, elapsedMs: 5 * 60 * 1e3, canProgress: true }, { now });
          return Boolean(res1.logMessage) && !res2.logMessage && t.escalation.ceilingLogged === true;
        }
      },
      {
        name: "Zarar riski uyar\u0131s\u0131: efektif fiyat > FutBIN * 0.95",
        fn: () => {
          const t = { name: "P14", buyNow: 1e3, price: 1e3, priceUpdatedAt: now, escalation: { enabled: true, maxSteps: 1, steps: 0 } };
          const eff = computeEffectiveBuyNow(t, { now });
          return eff.isRiskOfLoss === true;
        }
      },
      {
        name: "Eski kay\u0131t (escalation alan\u0131 yok) varsay\u0131lan kapal\u0131 \xE7al\u0131\u015Fmal\u0131",
        fn: () => {
          const t = { name: "P15", buyNow: 2500, price: 5e3, priceUpdatedAt: now };
          const eff = computeEffectiveBuyNow(t, { now });
          return eff.effectiveBuyNow === 2500 && eff.stepsApplied === 0;
        }
      }
    ];
    let passed = 0;
    let failed = 0;
    for (const tc of testCases) {
      try {
        const ok = tc.fn();
        if (ok) {
          passed++;
        } else {
          failed++;
          console.error(`[Escalation Test FAIL] ${tc.name}`);
        }
      } catch (err) {
        failed++;
        console.error(`[Escalation Test ERROR] ${tc.name}:`, err);
      }
    }
    const summary = `[FutRUSH Escalation Test] Toplam: ${testCases.length} | Ge\xE7en: ${passed} | Kalan (Ba\u015Far\u0131s\u0131z): ${failed}`;
    console.log(summary);
    return { total: testCases.length, passed, failed };
  }
  if (typeof window !== "undefined") {
    window.__testEscalation = runEscalationSelfTests;
    window.__escalationDebug = {
      fastForward(targetId, ms) {
        const target = (window.__FUTRUSH__?.state?.targets || []).find((t) => t.id === targetId || t.name === targetId);
        if (!target || !target.escalation) return false;
        target.escalation.activeMs = (Number(target.escalation.activeMs) || 0) + Number(ms);
        return true;
      }
    };
  }

  // src/utils/strings.js
  function normalizePlayerName(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  // src/utils/format.js
  function parsePrice(text) {
    const value = String(text || "").replace(/[\u00a0\u202f\u2009]/g, "\xA0").trim().toUpperCase();
    const match = value.match(/(\d{1,3}(?:[.,\u00a0]\d{3})+|\d+(?:[.,]\d{1,2})?)\s?([KM])?(?![A-Z])/);
    if (!match) return 0;
    const grouped = /^\d{1,3}(?:[.,\u00a0]\d{3})+$/.test(match[1]);
    const amount = grouped ? parseInt(match[1].replace(/[^\d]/g, ""), 10) : parseFloat(match[1].replace(",", "."));
    const scale = { K: 1e3, M: 1e6 }[match[2] || ""] || 1;
    const price = Math.round(amount * scale);
    return Number.isFinite(price) ? price : 0;
  }
  var parseFutbinPrice = parsePrice;
  var DEFAULT_PRICE_TIERS = Object.freeze([
    { min: 1e5, inc: 1e3 },
    { min: 5e4, inc: 500 },
    { min: 1e4, inc: 250 },
    { min: 1e3, inc: 100 },
    { min: 150, inc: 50 },
    { min: 0, inc: 150 }
  ]);
  var fallbackPriceTiers = DEFAULT_PRICE_TIERS;
  var MAX_TIER_PRICE = 15e6;
  function getJsPriceTiers(pageWin) {
    const tiers = pageWin && pageWin.JSUtils && pageWin.JSUtils.PRICE_TIERS;
    return Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_PRICE_TIERS;
  }
  function tierIncrement(tier) {
    return Number(tier && (tier.inc || tier.step)) || 50;
  }
  function matchingPriceTier(price, priceTiers) {
    let best = null;
    for (const tier of priceTiers) {
      if (price >= (Number(tier.min) || 0)) {
        if (!best || (Number(tier.min) || 0) > (Number(best.min) || 0)) best = tier;
      }
    }
    return best;
  }
  function roundPriceToTier(value, priceTiers = fallbackPriceTiers) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 0;
    const price = Math.max(0, Math.min(MAX_TIER_PRICE, num));
    const tier = matchingPriceTier(price, priceTiers);
    const inc = tierIncrement(tier);
    return Math.max(0, Math.min(MAX_TIER_PRICE, Math.round(price / inc) * inc));
  }
  function buyNowStep(price) {
    if (price <= 1e3) return 50;
    if (price <= 1e4) return 100;
    if (price <= 5e4) return 250;
    if (price <= 1e5) return 500;
    return 1e3;
  }

  // src/futbin/platform.js
  function getFutbinRowPrice(row, platform = getPlatform()) {
    if (!row) return null;
    const plat = platform === "pc" ? "pc" : "ps";
    const candidates = plat === "pc" ? [row.pc_LCPrice, row.pc_price, row.LCPrice, row.price, row.min_price] : [row.ps_LCPrice, row.ps_price, row.LCPrice, row.price, row.min_price];
    for (const val of candidates) {
      if (val === void 0 || val === null || val === "") continue;
      if (typeof val === "number" && Number.isFinite(val) && val > 0) {
        return Math.round(val);
      }
      const parsed = parseFutbinPrice(val);
      if (parsed > 0) return parsed;
    }
    return null;
  }
  function formatFutbinRowPrice(row, platform = getPlatform()) {
    const price = getFutbinRowPrice(row, platform);
    const platLabel = platform === "pc" ? "PC" : "PS";
    if (!price) {
      return platLabel + " fiyat: fiyat yok";
    }
    return platLabel + " fiyat: " + price.toLocaleString("tr-TR");
  }

  // src/futbin/candidateMatcher.js
  var FUTBIN_SEASON = "fifa27";
  var LEAGUE_NAMES_BY_ID = {
    13: "Premier League",
    14: "EFL Championship",
    16: "Ligue 1 McDonald's",
    19: "Bundesliga",
    31: "Serie A Enilive",
    53: "LALIGA EA SPORTS",
    10: "Eredivisie",
    308: "Liga Portugal",
    68: "Trendyol S\xFCper Lig",
    39: "MLS",
    350: "ROSHN Saudi League",
    50: "Scottish Premiership",
    4: "Pro League",
    2118: "ICONS"
  };
  function getLeagueName(row) {
    if (!row) return "";
    const directName = row.league_name || row.leagueName || row.league_title || row.leaguename;
    if (directName) return String(directName).trim();
    const id = Number(row.league || row.leagueId || 0);
    return LEAGUE_NAMES_BY_ID[id] || (id > 0 ? `Lig #${id}` : "");
  }
  function getLeagueImageUrls(leagueId) {
    if (!leagueId || Number(leagueId) <= 0) return { leagueImageUrl: "", leagueImageFallbacks: [] };
    const id = Number(leagueId);
    const primary = `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/league/${id}.png`;
    const fallbacks = [
      `https://cdn.futbin.com/content/fifa26/img/league/${id}.png`,
      `https://cdn.futbin.com/content/fifa25/img/league/${id}.png`,
      `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/leagues/${id}.png`,
      `https://cdn.futbin.com/content/fifa25/img/leagues/${id}.png`
    ];
    return { leagueImageUrl: primary, leagueImageFallbacks: fallbacks };
  }
  function normalizePlaystyleName(raw) {
    if (!raw) return "";
    return String(raw).trim().replace(/\+$/, "").trim().replace(/^[\[\(\s]*u?['"]*|['"\s\)\]]*$/gi, "").trim();
  }
  var PLAYSTYLE_ICON_KEY_MAP = {
    chipshot: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/1.2.png",
    powershot: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/2.2.png",
    deadball: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/3.2.png",
    finesseshot: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/0.2.png",
    pingedpass: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/6.2.png",
    incisivepass: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/5.3.png",
    longballpass: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/7.2.png",
    tikitaka: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/8.2.png",
    whippedpass: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/9.2.png",
    whippedcross: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/9.2.png",
    firsttouch: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/19.2.png",
    pressproven: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/21.2.png",
    rapid: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/17.2.png",
    technical: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/16.2.png",
    block: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/11.2.png",
    bruiser: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/15.2.png",
    intercept: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/12.2.png",
    jockey: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/10.2.png",
    slidetackle: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/14.2.png",
    anticipate: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/13.2.png",
    acrobatic: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/25.2.png",
    relentless: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/23.2.png",
    quickstep: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/22.2.png",
    longthrow: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/26.2.png",
    farthrow: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/28.3.png",
    footwork: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/29.3.png",
    crossclaimer: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/30.3.png",
    "1v1closedown": "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/31.3.png",
    farreach: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/32.3.png",
    deflector: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/33.3.png",
    lowdrivenshot: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/34.3.png",
    aerialfortress: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/35.3.png",
    aerial: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/35.3.png",
    enforcer: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/36.3.png",
    gamechanger: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/37.3.png",
    inventive: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/38.3.png",
    precisionheader: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/39.3.png",
    powerheader: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/39.3.png",
    trickster: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/20.2.png",
    trivela: "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=180/2027/play-styles/37.3.png"
  };
  function resolvePlaystyleIconUrl(name) {
    const clean = normalizePlaystyleName(name);
    if (!clean) return "";
    const key = clean.toLowerCase().replace(/[^a-z0-9]/g, "");
    return PLAYSTYLE_ICON_KEY_MAP[key] || "";
  }
  function extractPlaystylesPlus(row) {
    if (!row) return [];
    const rawPs = row.playstyles_plus ?? row.playstylesPlus ?? row.playstyle_plus ?? row.playstyleplus ?? row.playStylesPlus;
    const toPlaystyleObj = (rawName, explicitIcon = "") => {
      const name = normalizePlaystyleName(rawName);
      if (!name) return null;
      const iconUrl = explicitIcon || resolvePlaystyleIconUrl(name);
      return { name, iconUrl };
    };
    if (Array.isArray(rawPs)) {
      return rawPs.slice(0, 4).map((p) => {
        if (typeof p === "string") return toPlaystyleObj(p);
        return toPlaystyleObj(p.name || p.title || p.label || "", p.icon || p.image || p.imageUrl || "");
      }).filter(Boolean);
    }
    if (typeof rawPs === "string" && rawPs.trim()) {
      try {
        const parsed = JSON.parse(rawPs.replace(/'/g, '"'));
        if (Array.isArray(parsed)) return extractPlaystylesPlus({ playstyles_plus: parsed });
      } catch (_) {
      }
      return rawPs.replace(/[\[\]]/g, "").split(/[,;|]/).map((s) => toPlaystyleObj(s)).filter(Boolean).slice(0, 4);
    }
    const generalPs = row.playstyles || row.playStyles;
    if (Array.isArray(generalPs)) {
      const plusItems = generalPs.filter((p) => {
        if (typeof p === "string") return p.includes("+") || p.endsWith("+");
        return p.plus || p.is_plus || p.isPlus || String(p.tier || "").includes("plus") || String(p.name || "").includes("+");
      }).slice(0, 4);
      if (plusItems.length > 0) {
        return plusItems.map((p) => {
          if (typeof p === "string") return toPlaystyleObj(p);
          return toPlaystyleObj(p.name || p.title || "", p.icon || p.image || p.imageUrl || "");
        }).filter(Boolean);
      }
    }
    return [];
  }
  function isHolo(row) {
    return Boolean(row?.holographicAnimation);
  }
  function isTotwCard(row) {
    if (!row) return false;
    const raretype = Number(row.raretype ?? -1);
    if (raretype === 3 || raretype === 18) return true;
    const version = String(row.version || row.rare_name || row.card_type || "");
    return /totw|team of the week/i.test(version);
  }
  function parsePromoFromUrl(url) {
    if (typeof url !== "string" || !url) return "";
    const match = url.match(/\/(\d+)_([a-zA-Z0-9_-]+)\.(?:png|webp|jpg|jpeg)/i);
    if (!match) return "";
    const slug = match[2].replace(/[_-]+/g, " ").trim();
    return slug.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function getVersionLabel(row) {
    const holo = isHolo(row);
    const raretype = Number(row?.raretype ?? 0);
    if (raretype === 3) {
      return holo ? "TOTW (Holo)" : "TOTW (Standart)";
    }
    if (!isSpecialCard(row)) {
      return "Base";
    }
    const rawVersion = String(row?.version || row?.rare_name || "").trim();
    let promoName = rawVersion;
    if (!promoName && row?.cardImage) {
      promoName = parsePromoFromUrl(row.cardImage);
    }
    if (!promoName && row?.rare_image) {
      promoName = parsePromoFromUrl(row.rare_image);
    }
    if (!promoName) {
      promoName = raretype > 0 ? `Promo #${raretype}` : "\xD6zel";
    }
    return holo ? `${promoName} (Holo)` : promoName;
  }
  function isSpecialCard(row) {
    if (!row) return false;
    const resId = Number(row.resource_id) || 0;
    if (resId >= 16777216) return true;
    const raretype = Number(row.raretype ?? 0);
    return raretype !== 0 && raretype !== 1 || Boolean(row.holographicAnimation);
  }
  function formatCardDisplayName(name, commonName) {
    const raw = (commonName || name || "").trim();
    if (!raw || raw.length <= 14) return raw;
    const parts = raw.split(/\s+/);
    return parts[parts.length - 1] || raw;
  }
  function resolveFutbinImageUrl(rawUrl, fallback = "") {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) return fallback;
    const trimmed = rawUrl.trim();
    if (/^p?\d+$/i.test(trimmed)) {
      return `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/players/${trimmed}.png`;
    }
    if (trimmed.startsWith("//")) {
      return "https:" + trimmed;
    }
    if (trimmed.startsWith("/")) {
      if (trimmed.startsWith("/design")) {
        return "https://www.futbin.org" + trimmed;
      }
      return "https://cdn.futbin.com" + trimmed;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return fallback || trimmed;
  }
  function sortCandidatesByPriceAsc(candidates) {
    if (!Array.isArray(candidates)) return [];
    return candidates.slice().sort((a, b) => {
      const priceA = Number(a?.price) || 0;
      const priceB = Number(b?.price) || 0;
      if (priceA > 0 && priceB > 0) {
        if (priceA !== priceB) return priceA - priceB;
        return (Number(a?.rating) || 0) - (Number(b?.rating) || 0);
      }
      if (priceA > 0 && priceB <= 0) return -1;
      if (priceA <= 0 && priceB > 0) return 1;
      return (Number(a?.rating) || 0) - (Number(b?.rating) || 0);
    });
  }
  function mapCandidate(row) {
    if (!row) return null;
    const eaId = Number(row.resource_id) || Number(row.playerid) || idOf(row.resource_id) || idOf(row.playerid);
    const baseId = toBaseId(row.playerid || row.resource_id);
    const playerId = baseId;
    const rating = Number(row.rating) || 0;
    const futbinId = String(row.ID ?? row.id ?? "");
    const holo = isHolo(row);
    const raretype = Number(row.raretype ?? 0);
    const position = String(row.position || "").trim();
    const rawPlayerImg = row.specialPlayerImage || row.normalPlayerImage || row.image || row.special_img || row.playerimage || row.player_image || row.card_image || "";
    const playerImageFallbackUrl = eaId && eaId > 0 && eaId >= 16777216 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/players/p${eaId}.png` : baseId ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/players/${baseId}.png` : "";
    const playerImageUrl = resolveFutbinImageUrl(rawPlayerImg, playerImageFallbackUrl);
    const rawPromoImg = row.cardImage || row.rare_card_image || row.rare_image || row.version_image || "";
    const fallbackPromoImg = raretype && raretype > 1 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/${raretype}_card.png` : raretype === 1 ? rating >= 75 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/1_gold_rare.png` : rating >= 65 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/1_silver_rare.png` : `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/1_bronze_rare.png` : rating >= 75 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/0_gold.png` : rating >= 65 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/0_silver.png` : `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/cards/hd/0_bronze.png`;
    const promoImageUrl = resolveFutbinImageUrl(rawPromoImg, fallbackPromoImg);
    const rawHoloAnim = row.holographicAnimation || row.card_animation || "";
    const holographicAnimationUrl = resolveFutbinImageUrl(rawHoloAnim);
    const price = getFutbinRowPrice(row) || 0;
    const isGk = position.toUpperCase() === "GK" || position.toUpperCase() === "KL";
    const statLabels = isGk ? ["DIV", "HAN", "KIC", "REF", "SPE", "POS"] : ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"];
    const stats = row.pac != null || row.sho != null || row.div != null ? {
      pac: Number(isGk ? row.div ?? row.pac : row.pac ?? 0) || 0,
      sho: Number(isGk ? row.han ?? row.sho : row.sho ?? 0) || 0,
      pas: Number(isGk ? row.kic ?? row.pas : row.pas ?? 0) || 0,
      dri: Number(isGk ? row.ref ?? row.dri : row.dri ?? 0) || 0,
      def: Number(isGk ? row.spe ?? row.def : row.def ?? 0) || 0,
      phy: Number(isGk ? row.pos ?? row.phy : row.phy ?? 0) || 0,
      labels: statLabels
    } : null;
    const nationId = Number(row.nation) || 0;
    const clubId = Number(row.club) || 0;
    const leagueId = Number(row.league) || 0;
    const nationImageUrl = nationId > 0 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/nation/${nationId}.png` : "";
    const clubImageUrl = clubId > 0 ? `https://cdn.futbin.com/content/${FUTBIN_SEASON}/img/clubs/dark/${clubId}.png` : "";
    const { leagueImageUrl, leagueImageFallbacks } = getLeagueImageUrls(leagueId);
    const leagueName = getLeagueName(row);
    const playstylesPlus = extractPlaystylesPlus(row);
    const commonName = row.common_name || row.playername || "";
    return {
      futbinId,
      eaId,
      baseId,
      playerId,
      name: commonName || row.playername || "",
      commonName,
      displayName: formatCardDisplayName(row.playername, commonName),
      rating,
      position,
      raretype,
      isHolo: holo,
      holographicAnimationUrl,
      versionLabel: getVersionLabel(row),
      playerImageUrl,
      playerImageFallbackUrl,
      promoImageUrl,
      price,
      stats,
      nationId,
      clubId,
      leagueId,
      nationImageUrl,
      clubImageUrl,
      leagueImageUrl,
      leagueImageFallbacks,
      leagueName,
      playstylesPlus
    };
  }
  function normalizeQuality(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    if (s === "g" || s === "gold" || s === "alt\u0131n" || s === "altin") return "gold";
    if (s === "s" || s === "silver" || s === "g\xFCm\xFC\u015F" || s === "gumus") return "silver";
    if (s === "b" || s === "bronze" || s === "bronz") return "bronze";
    if (s === "sp" || s === "special" || s === "\xF6zel" || s === "ozel") return "special";
    return s;
  }
  function getQualityTier(rating) {
    const r = Number(rating) || 0;
    if (r >= 75) return "gold";
    if (r >= 65) return "silver";
    if (r > 0) return "bronze";
    return null;
  }
  function validateQualityFilter(cardRating, filterQuality) {
    const normFilter = normalizeQuality(filterQuality);
    if (!normFilter || normFilter === "special") return null;
    const cardTier = getQualityTier(cardRating);
    if (!cardTier) return null;
    if (normFilter !== cardTier) {
      if (cardTier === "gold") {
        return "Se\xE7ilen kart kalitesi (Gold) ile pazar filtreleri (Bronz/Silver) uyu\u015Fmuyor.";
      }
      const tierName = cardTier.charAt(0).toUpperCase() + cardTier.slice(1);
      const filterName = normFilter.charAt(0).toUpperCase() + normFilter.slice(1);
      return `Se\xE7ilen kart kalitesi (${tierName}) ile pazar filtreleri (${filterName}) uyu\u015Fmuyor.`;
    }
    return null;
  }
  function filterCandidates(rows, intent) {
    if (!Array.isArray(rows) || !intent) return [];
    const targetPlayerId = toBaseId(intent.playerId);
    const rarityIds = Array.isArray(intent.rarityIds) ? intent.rarityIds.map(String).filter(Boolean) : [];
    const specialRarities = rarityIds.filter((rid) => rid !== "0" && rid !== "1");
    const wantsTotw = rarityIds.includes("3") || rarityIds.includes("18");
    const wantsSpecial = wantsTotw || intent.quality === "SP" || normalizeQuality(intent.quality) === "special" || intent.wantsSpecial === true || specialRarities.length > 0;
    return rows.filter((row) => {
      if (!row) return false;
      const rowPlayerId = toBaseId(row.playerid || row.resource_id);
      if (targetPlayerId > 0 && rowPlayerId !== targetPlayerId) {
        return false;
      }
      if (intent.quality) {
        const rowRating = Number(row.rating) || 0;
        const normQuality = normalizeQuality(intent.quality);
        if (normQuality && normQuality !== "special") {
          const rowTier = getQualityTier(rowRating);
          if (rowTier && rowTier !== normQuality) {
            return false;
          }
        }
      }
      if (wantsSpecial && !isSpecialCard(row)) {
        return false;
      }
      if (rarityIds.length > 0) {
        const rowRaretype = String(row.raretype ?? "");
        const matchesRarity = rarityIds.some((rid) => {
          if (rid === "3" || rid === "18") {
            return isTotwCard(row);
          }
          return rowRaretype === rid;
        });
        if (!matchesRarity) {
          return false;
        }
      }
      return true;
    }).map(mapCandidate);
  }

  // src/futbin/requestQueue.js
  var MAX_CONCURRENT = 2;
  var INITIAL_BACKOFF_MS = 2e3;
  var MAX_BACKOFF_MS = 6e4;
  var MAX_RETRIES = 3;
  var activeCount = 0;
  var backoffUntil = 0;
  var currentBackoffDelay = INITIAL_BACKOFF_MS;
  var backoffTimer = null;
  var inFlightRequests = /* @__PURE__ */ new Map();
  var queue = [];
  function parseRetryAfter(headers) {
    if (!headers) return null;
    const str = typeof headers === "object" ? JSON.stringify(headers) : String(headers);
    const match = str.match(/retry-after:\s*([^\r\n",]+)/i);
    if (!match) return null;
    const val = match[1].trim();
    const seconds = Number(val);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1e3;
    }
    const date = Date.parse(val);
    if (Number.isFinite(date) && date > Date.now()) {
      return date - Date.now();
    }
    return null;
  }
  function getFutbinQueueStatus() {
    const now = Date.now();
    const backoffMs = Math.max(0, backoffUntil - now);
    return {
      pending: queue.length,
      active: activeCount,
      backoffMs
    };
  }
  function broadcastQueueStatus() {
    emit("futbin:queue", getFutbinQueueStatus());
  }
  function schedulePump() {
    const now = Date.now();
    if (now < backoffUntil) {
      if (!backoffTimer) {
        backoffTimer = setTimeout(() => {
          backoffTimer = null;
          if (Date.now() >= backoffUntil) {
            addMarketLog({
              text: "[FutBIN Kuyruk] Engel s\xFCresi bitti, istekler s\xFCrd\xFCr\xFCl\xFCyor.",
              type: "info"
            });
          }
          broadcastQueueStatus();
          pumpQueue();
        }, Math.max(50, backoffUntil - now));
      }
      return;
    }
    pumpQueue();
  }
  function pumpQueue() {
    const now = Date.now();
    if (now < backoffUntil) {
      schedulePump();
      return;
    }
    while (activeCount < MAX_CONCURRENT && queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      activeCount++;
      broadcastQueueStatus();
      runTask(task);
    }
  }
  async function runTask(task) {
    try {
      const response = await task.executeFn();
      const status = Number(response?.status || response && typeof response === "object" && response.status) || 200;
      if (status === 429 || status === 403) {
        const headers = response?.responseHeaders || response?.headers;
        const retryAfter = parseRetryAfter(headers);
        const jitter = Math.floor(Math.random() * 500);
        const delay = retryAfter != null ? retryAfter : Math.min(MAX_BACKOFF_MS, currentBackoffDelay * Math.pow(2, task.retries) + jitter);
        currentBackoffDelay = Math.min(MAX_BACKOFF_MS, Math.max(INITIAL_BACKOFF_MS, delay));
        backoffUntil = Date.now() + delay;
        addMarketLog({
          text: `[FutBIN Kuyruk] HTTP ${status} engeli: ${Math.ceil(delay / 1e3)}sn bekleniyor (Deneme: ${task.retries + 1}/${MAX_RETRIES}, ${queue.length + 1} bekleyen).`,
          type: "error"
        });
        broadcastQueueStatus();
        if (task.retries < MAX_RETRIES) {
          task.retries++;
          queue.unshift(task);
          schedulePump();
        } else {
          addMarketLog({
            text: `[FutBIN] \u0130stek ba\u015Far\u0131s\u0131z: Maksimum deneme (${MAX_RETRIES}) a\u015F\u0131ld\u0131 (${task.url}).`,
            type: "error"
          });
          task.reject(new Error(`FutBIN iste\u011Fi ba\u015Far\u0131s\u0131z (HTTP ${status}, maksimum deneme a\u015F\u0131ld\u0131).`));
        }
      } else {
        currentBackoffDelay = INITIAL_BACKOFF_MS;
        task.resolve(response);
      }
    } catch (err) {
      task.reject(err);
    } finally {
      activeCount--;
      inFlightRequests.delete(task.url);
      broadcastQueueStatus();
      schedulePump();
    }
  }
  function enqueueFutbinRequest(url, executeFn) {
    if (!url) return Promise.reject(new Error("Kuyruk i\xE7in URL gereklidir."));
    const trimmed = String(url).trim();
    if (inFlightRequests.has(trimmed)) {
      return inFlightRequests.get(trimmed);
    }
    const promise = new Promise((resolve, reject) => {
      queue.push({
        url: trimmed,
        executeFn,
        resolve,
        reject,
        retries: 0
      });
      broadcastQueueStatus();
      schedulePump();
    });
    inFlightRequests.set(trimmed, promise);
    return promise;
  }

  // src/futbin/http.js
  function requestFutbinPage(url) {
    return enqueueFutbinRequest(url, () => new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("FutBIN iste\u011Fi i\xE7in GM_xmlhttpRequest kullan\u0131lam\u0131yor. Userscript izinlerini kontrol edin."));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 25e3,
        headers: { "Accept": "text/html,application/xhtml+xml" },
        onload: (response) => resolve(response),
        onerror: () => reject(new Error("FutBIN ba\u011Flant\u0131s\u0131 kurulamad\u0131. A\u011F ba\u011Flant\u0131n\u0131z\u0131 kontrol edin.")),
        ontimeout: () => reject(new Error("FutBIN yan\u0131t\u0131 zaman a\u015F\u0131m\u0131na u\u011Frad\u0131.")),
        onabort: () => reject(new Error("FutBIN iste\u011Fi iptal edildi."))
      });
    }));
  }
  function requestFutbinApi(url) {
    return enqueueFutbinRequest(url, () => new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("FutBIN iste\u011Fi i\xE7in GM_xmlhttpRequest kullan\u0131lam\u0131yor."));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 2e4,
        headers: { "Accept": "application/json, text/plain, */*" },
        onload: (response) => resolve(response),
        onerror: () => reject(new Error("FutBIN API ba\u011Flant\u0131s\u0131 kurulamad\u0131.")),
        ontimeout: () => reject(new Error("FutBIN API yan\u0131t\u0131 zaman a\u015F\u0131m\u0131na u\u011Frad\u0131.")),
        onabort: () => reject(new Error("FutBIN API iste\u011Fi iptal edildi."))
      });
    }));
  }

  // src/futbin/playerLookup.js
  var SPECIAL_OFFSET = 16777216;
  var eaIdFrom = (value) => (Number(value) || 0) & 16777215;
  function isStandardRow(row) {
    const resourceId = Number(row.resource_id);
    const playerId = Number(row.playerid);
    const id = resourceId > 0 ? resourceId : playerId;
    return id > 0 && id < SPECIAL_OFFSET;
  }
  function scoreRow(row, {
    wantedName = "",
    wantedFutbinId = "",
    selectedCardId = 0,
    preferStandard = true,
    targetRating = 0,
    index = 0
  } = {}) {
    if (!row) return 0;
    const rawResourceId = Number(row.resource_id) || 0;
    const rawPlayerId = Number(row.playerid) || 0;
    if (!rawResourceId && !rawPlayerId) return 0;
    const cardId = Number(selectedCardId) || 0;
    const isBase = isBaseId(cardId);
    const resourceId = idOf(row.resource_id);
    const playerId = idOf(row.playerid);
    const resourceMasked = eaIdFrom(row.resource_id);
    const playerMasked = eaIdFrom(row.playerid);
    const selectedResourceMatches = Boolean(cardId && (resourceId === cardId || resourceMasked === cardId));
    const selectedPlayerMatches = Boolean(cardId && isBase && (playerId === cardId || playerMasked === cardId));
    if (cardId && !selectedResourceMatches && !selectedPlayerMatches) return 0;
    const exactFutbinId = Boolean(wantedFutbinId && String(row.ID || row.id || "") === String(wantedFutbinId));
    if (index > 0 && !cardId && !exactFutbinId) return 0;
    const names = [row.playername, row.common_name].map(normalizePlayerName).filter(Boolean);
    const exactName = wantedName ? names.includes(wantedName) : true;
    const partialName = wantedName && wantedName.length >= 3 && names.some((name) => name.includes(wantedName) || wantedName.includes(name));
    if (wantedName && !exactName && !partialName && !exactFutbinId && !selectedResourceMatches) {
      return 0;
    }
    const ratingMatches = !targetRating || Number(row.rating) === Number(targetRating);
    const nameScore = exactName ? ratingMatches ? 100 : 80 : partialName ? ratingMatches ? 40 : 20 : 0;
    if (selectedResourceMatches) {
      return 4e3 + nameScore;
    }
    if (exactFutbinId && !cardId) {
      return 2500 + nameScore;
    }
    if (selectedPlayerMatches) {
      return 2e3 + nameScore;
    }
    if (preferStandard && !cardId && isStandardRow(row)) {
      return 1200 + nameScore;
    }
    return nameScore;
  }
  var searchCache = /* @__PURE__ */ new Map();
  var detailsCache = /* @__PURE__ */ new Map();
  var CACHE_TTL_MS = 15 * 60 * 1e3;
  function rowMatchesPlayer(row, { eaId = 0, futbinId = "", name = "", rating = 0 } = {}) {
    if (!row) return false;
    const rowEaId = Number(row.resource_id || row.playerid || 0);
    if (eaId && rowEaId && (rowEaId === Number(eaId) || (rowEaId & 16777215) === (Number(eaId) & 16777215))) {
      return true;
    }
    if (futbinId && String(row.ID ?? row.id) === String(futbinId)) {
      return true;
    }
    if (name) {
      const normWanted = normalizePlayerName(name);
      const rowPlayername = normalizePlayerName(row.playername || "");
      const rowCommonName = normalizePlayerName(row.common_name || "");
      const nameMatches = rowPlayername && (rowPlayername === normWanted || rowPlayername.includes(normWanted) || normWanted.includes(rowPlayername)) || rowCommonName && (rowCommonName === normWanted || rowCommonName.includes(normWanted) || normWanted.includes(rowCommonName));
      if (nameMatches) {
        if (rating && Number(row.rating) !== Number(rating)) return false;
        return true;
      }
    }
    return false;
  }
  async function fetchPlayerDetailsFromFutbinApi({ name = "", rating = 0, eaId = 0, futbinId = "" } = {}) {
    const cacheKey = `${eaId || futbinId || normalizePlayerName(name)}_${rating}`;
    const cached = detailsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    let targetRating = Number(rating) || 0;
    let targetFutbinId = futbinId ? String(futbinId) : "";
    let targetEaId = eaId ? Number(eaId) : 0;
    if ((!targetRating || !targetFutbinId) && name) {
      try {
        const searchRows = await queryFutbinPlayersByName(name);
        if (Array.isArray(searchRows) && searchRows.length > 0) {
          const found = searchRows.find(
            (r) => targetEaId && (Number(r.resource_id) === targetEaId || Number(r.playerid) === targetEaId) || targetRating && Number(r.rating) === targetRating
          ) || searchRows[0];
          if (found) {
            if (!targetRating && found.rating) targetRating = Number(found.rating);
            if (!targetFutbinId && found.ID) targetFutbinId = String(found.ID);
            if (!targetEaId && (found.resource_id || found.playerid)) targetEaId = Number(found.resource_id || found.playerid);
          }
        }
      } catch (_) {
      }
    }
    if (!targetRating) return null;
    const cfg = CONFIG.futbin;
    const isPc = cfg.platform === "pc";
    for (let page = 1; page <= 3; page++) {
      try {
        const ratingUrl = new URL(cfg.apiBaseUrl);
        ratingUrl.searchParams.set("platform", isPc ? "PC" : "PS");
        ratingUrl.searchParams.set("page", String(page));
        ratingUrl.searchParams.set("rating", `${targetRating}-${targetRating}`);
        ratingUrl.searchParams.set(isPc ? "pcprice" : "ps4price", cfg.priceRange);
        ratingUrl.searchParams.set("sort", isPc ? "pc_price" : "ps_price");
        ratingUrl.searchParams.set("order", "asc");
        const res = await requestFutbinApi(ratingUrl.toString());
        if (res && res.status >= 200 && res.status < 300) {
          const payload = JSON.parse(res.responseText || "{}");
          if (Array.isArray(payload?.data) && payload.data.length > 0) {
            const matchedRow = payload.data.find(
              (row) => rowMatchesPlayer(row, {
                eaId: targetEaId,
                futbinId: targetFutbinId,
                name,
                rating: targetRating
              })
            );
            if (matchedRow) {
              const candidate = mapCandidate(matchedRow);
              if (candidate) {
                detailsCache.set(cacheKey, { data: candidate, timestamp: Date.now() });
                return candidate;
              }
            }
            if (payload.data.length < 30) break;
          } else {
            break;
          }
        } else {
          break;
        }
      } catch (_) {
        break;
      }
    }
    return null;
  }
  function queryFutbinPlayersByName(name, options = {}) {
    const cleanName = String(name || "").trim();
    if (!cleanName) {
      return Promise.resolve([]);
    }
    const key = normalizePlayerName(cleanName);
    const cached = searchCache.get(key);
    if (!options?.bypassCache && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return Promise.resolve(cached.data);
    }
    const url = "https://www.futbin.org/futbin/api/searchPlayersByName?playername=" + encodeURIComponent(cleanName);
    return enqueueFutbinRequest(url, () => new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("FutBIN oyuncu e\u015Fle\u015Ftirmesi i\xE7in userscript izni bulunamad\u0131."));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 15e3,
        headers: { "Accept": "application/json, text/plain, */*" },
        onload: (response) => {
          if (response.status === 429 || response.status === 403) {
            resolve(response);
            return;
          }
          if (response.status < 200 || response.status >= 300) {
            reject(new Error("FutBIN oyuncu e\u015Fle\u015Ftirme iste\u011Fi ba\u015Far\u0131s\u0131z (HTTP " + response.status + ")."));
            return;
          }
          resolve(response);
        },
        onerror: () => reject(new Error("FutBIN oyuncu e\u015Fle\u015Ftirme ba\u011Flant\u0131s\u0131 kurulamad\u0131.")),
        ontimeout: () => reject(new Error("FutBIN oyuncu e\u015Fle\u015Ftirme iste\u011Fi zaman a\u015F\u0131m\u0131na u\u011Frad\u0131."))
      });
    })).then((response) => {
      try {
        const payload = JSON.parse(response.responseText || "");
        const data = Array.isArray(payload?.data) ? payload.data : [];
        searchCache.set(key, { data, timestamp: Date.now() });
        return data;
      } catch (error2) {
        throw error2;
      }
    });
  }
  async function searchPlayerAllVersions(name, options = {}) {
    const rows = await queryFutbinPlayersByName(name, options);
    if (!Array.isArray(rows) || !rows.length) return [];
    const candidates = rows.map(mapCandidate).filter(Boolean);
    return sortCandidatesByPriceAsc(candidates);
  }
  async function searchUniquePlayers(name) {
    const rows = await queryFutbinPlayersByName(name);
    if (!Array.isArray(rows) || !rows.length) return [];
    const playerMap = /* @__PURE__ */ new Map();
    for (const row of rows) {
      if (!row) continue;
      const baseId = toBaseId(row.playerid || row.resource_id);
      const candidate = mapCandidate(row);
      if (!candidate) continue;
      const groupKey = baseId > 0 ? `id_${baseId}` : `name_${normalizePlayerName(candidate.name)}`;
      if (!playerMap.has(groupKey)) {
        playerMap.set(groupKey, {
          baseId,
          name: candidate.name,
          highestRating: candidate.rating,
          baseRating: candidate.rating,
          versions: [candidate]
        });
      } else {
        const group = playerMap.get(groupKey);
        group.versions.push(candidate);
        if (candidate.rating > group.highestRating) {
          group.highestRating = candidate.rating;
        }
      }
    }
    const players = Array.from(playerMap.values());
    players.forEach((player) => {
      player.versions = sortCandidatesByPriceAsc(player.versions);
      const baseCandidate = player.versions.find((v) => !isSpecialCard(v.raw) || v.versionLabel === "Base");
      if (baseCandidate) {
        player.baseRating = Number(baseCandidate.rating) || 0;
        player.baseCard = baseCandidate;
        if (baseCandidate.name) player.name = baseCandidate.name;
      } else {
        const minRating = Math.min(...player.versions.map((v) => Number(v.rating) || 0));
        player.baseRating = minRating > 0 ? minRating : player.highestRating;
        player.baseCard = player.versions[0];
      }
    });
    players.sort((a, b) => {
      const diff = (Number(b.baseRating) || 0) - (Number(a.baseRating) || 0);
      if (diff !== 0) return diff;
      const highestDiff = (Number(b.highestRating) || 0) - (Number(a.highestRating) || 0);
      if (highestDiff !== 0) return highestDiff;
      return a.name.localeCompare(b.name);
    });
    return players;
  }
  function fetchFutbinPlayerId(target) {
    return new Promise((resolve, reject) => {
      const targetName = String(target.name || "").trim();
      const wantedName = normalizePlayerName(targetName);
      const wantedFutbinId = String(target.futbinId || "");
      const selectedCardId = eaIdFrom(target.selectedCardId);
      const rarityIds = Array.isArray(target.rarityIds) ? target.rarityIds.map(String) : [];
      const wantsSpecial = target.quality === "SP" || target.wantsSpecial === true || rarityIds.length > 0;
      const wantsSpecialRarity = wantsSpecial;
      const preferStandard = target.preferStandard !== false && !selectedCardId && !wantsSpecial;
      const targetPlayerId = toBaseId(target.playerId || selectedCardId);
      const fallbackTerms = wantedFutbinId ? [...new Set(targetName.split(/\s+/).reverse().filter((part) => part.length >= 3))].slice(0, 3) : [];
      const searches = [targetName, ...fallbackTerms].filter((name, index, all) => name && all.indexOf(name) === index);
      let lastRows = [];
      console.log("[FutRUSH:futbin] Lookup start:", JSON.stringify({ targetName, targetPlayerId, rarityIds, wantsSpecial }));
      const search = async (index) => {
        if (index >= searches.length) {
          console.warn("[FutRUSH] FutBIN e\u015Fle\u015Fme yan\u0131t\u0131:", {
            name: target.name,
            rating: target.rating,
            futbinId: target.futbinId,
            rows: lastRows.slice(0, 8)
          });
          const detail = target.futbinId ? " FutBIN kart kimli\u011Fi " + target.futbinId + " ve oyuncu ad\u0131 e\u015Fle\u015Fmedi." : selectedCardId ? " Se\xE7ili kart kimli\u011Fi " + selectedCardId + ", oyuncu ad\u0131 ve reytingle e\u015Fle\u015Fmedi." : " Oyuncu ad\u0131: " + String(target.name || "(bo\u015F)") + (target.rating ? ", reyting: " + target.rating : "") + ".";
          reject(new Error("FutBIN yan\u0131t\u0131nda e\u015Fle\u015Fen EA oyuncu kimli\u011Fi bulunamad\u0131." + detail));
          return;
        }
        try {
          const rows = await queryFutbinPlayersByName(searches[index]);
          lastRows = rows;
          console.log("[FutRUSH:futbin] API response data length:", rows.length, "wantsSpecial:", wantsSpecial);
          if (target.quality) {
            const normQuality = normalizeQuality(target.quality);
            if (normQuality && normQuality !== "special") {
              const playerRows = targetPlayerId > 0 ? rows.filter((r) => toBaseId(r.playerid || r.resource_id) === targetPlayerId) : rows.filter((r) => wantedName && [r.playername, r.common_name].map(normalizePlayerName).filter(Boolean).some((n) => n === wantedName || wantedName.includes(n) || n.includes(wantedName)));
              if (playerRows.length > 0) {
                const maxRating = Math.max(...playerRows.map((r) => Number(r.rating) || 0));
                const conflict = validateQualityFilter(maxRating, target.quality);
                if (conflict) {
                  reject(new Error(conflict));
                  return;
                }
              }
            }
          }
          if (wantsSpecialRarity) {
            const matched = filterCandidates(rows, {
              playerId: targetPlayerId,
              rarityIds,
              quality: target.quality,
              wantsSpecial
            });
            console.log("[FutRUSH:futbin] filterCandidates matched count:", matched.length, "candidates:", JSON.stringify(matched.map((c) => ({ id: c.futbinId, eaId: c.eaId, rating: c.rating, label: c.versionLabel }))));
            const wantsTotw = rarityIds.includes("3");
            if (wantsTotw) {
              if (matched.length > 1) {
                resolve({
                  status: "ambiguous",
                  candidates: matched,
                  name: targetName
                });
                return;
              }
            } else {
              if (matched.length === 1) {
                const c = matched[0];
                resolve(target.returnDetails ? {
                  status: "ok",
                  eaId: c.eaId,
                  rating: c.rating,
                  candidate: c
                } : c.eaId);
                return;
              }
              if (matched.length > 1 && target.rating) {
                const ratingMatches = matched.filter((c) => Number(c.rating) === Number(target.rating));
                if (ratingMatches.length === 1) {
                  const c = ratingMatches[0];
                  resolve(target.returnDetails ? {
                    status: "ok",
                    eaId: c.eaId,
                    rating: c.rating,
                    candidate: c
                  } : c.eaId);
                  return;
                }
                if (ratingMatches.length > 1) {
                  resolve({
                    status: "ambiguous",
                    candidates: sortCandidatesByPriceAsc(ratingMatches),
                    name: targetName
                  });
                  return;
                }
              }
              if (matched.length > 1) {
                resolve({
                  status: "ambiguous",
                  candidates: sortCandidatesByPriceAsc(matched),
                  name: targetName
                });
                return;
              }
            }
            if (matched.length === 1) {
              const c = matched[0];
              resolve(target.returnDetails ? {
                status: "ok",
                eaId: c.eaId,
                rating: c.rating,
                candidate: c
              } : c.eaId);
              return;
            }
            search(index + 1);
            return;
          }
          const candidates = rows.map((row) => ({
            row,
            score: scoreRow(row, {
              wantedName,
              wantedFutbinId,
              selectedCardId,
              preferStandard,
              targetRating: target.rating,
              index
            })
          })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
          const candidate = candidates[0]?.row;
          const eaId = eaIdFrom(candidate?.resource_id) || eaIdFrom(candidate?.playerid);
          if (!eaId) {
            search(index + 1);
            return;
          }
          if (!target.rating && Number(candidate.rating) > 0) target.rating = Number(candidate.rating);
          if (target.returnDetails) {
            resolve({
              status: "ok",
              eaId,
              rating: Number(candidate.rating) || 0,
              candidate: mapCandidate(candidate)
            });
            return;
          }
          resolve(eaId);
        } catch (error2) {
          reject(error2);
        }
      };
      search(0);
    });
  }

  // src/targets/targetStatus.js
  var holdTimer = null;
  function setTargetStatus({ type, message, source, progress, holdMs } = {}) {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    const status = { type, message };
    if (source !== void 0) status.source = source;
    if (progress !== void 0) status.progress = progress;
    state.targetStatus = status;
    emit("targets:status");
    const duration = holdMs ?? (type === "success" ? CONFIG.ui.statusHoldMs : type === "error" ? CONFIG.ui.statusErrorHoldMs : 0);
    if (type !== "loading" && duration > 0) {
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (state.targetStatus !== status) return;
        state.targetStatus = null;
        emit("targets:status-expire");
      }, duration);
    }
  }

  // src/targets/targetOps.js
  function applyTargetAddDiscount(player, discountRate = CONFIG.targetAdd.discountRate) {
    const rate = typeof discountRate === "number" && Number.isFinite(discountRate) && discountRate >= 0 && discountRate < 1 ? discountRate : typeof CONFIG.targetAdd.discountRate === "number" && Number.isFinite(CONFIG.targetAdd.discountRate) && CONFIG.targetAdd.discountRate >= 0 && CONFIG.targetAdd.discountRate < 1 ? CONFIG.targetAdd.discountRate : 0.1;
    const originalPrice = Number(player.price);
    const discountedPrice = Number.isFinite(originalPrice) ? Math.round(originalPrice * 0.95 * (1 - rate)) : MIN_BIN;
    const buyNow = Math.max(MIN_BIN, roundDownToStep(discountedPrice));
    return { ...player, price: originalPrice, buyNow };
  }
  function findDuplicateTarget(targets, candidate, { matchFutbinId = true } = {}) {
    return targets.find(
      (item) => matchFutbinId && candidate.futbinId && item.futbinId && String(item.futbinId) === String(candidate.futbinId) || item.rating === candidate.rating && item.name.trim().toLocaleLowerCase() === candidate.name.trim().toLocaleLowerCase()
    );
  }
  function targetEaIdKey(target) {
    return JSON.stringify([
      String(target.name),
      Number(target.rating),
      target.futbinId == null ? null : String(target.futbinId)
    ]);
  }
  function normalizedEaId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) return 0;
    return id & 16777215;
  }
  function hasCurrentTargetEaId(target) {
    const eaId = normalizedEaId(target.eaId);
    if (!eaId) return false;
    return !target.eaIdTargetKey || target.eaIdTargetKey === targetEaIdKey(target);
  }
  async function resolveTargetEaId(target) {
    if (hasCurrentTargetEaId(target)) {
      const eaId2 = normalizedEaId(target.eaId);
      if (target.eaIdTargetKey !== targetEaIdKey(target)) {
        target.eaId = eaId2;
        target.eaIdTargetKey = targetEaIdKey(target);
        saveTargets();
      }
      return target.eaId;
    }
    const fetchedEaId = Number(await fetchFutbinPlayerId(target));
    const eaId = normalizedEaId(fetchedEaId);
    if (!eaId) throw new Error("FutBIN yan\u0131t\u0131nda ge\xE7erli EA oyuncu kimli\u011Fi bulunamad\u0131.");
    target.eaId = eaId;
    target.eaIdTargetKey = targetEaIdKey(target);
    saveTargets();
    return eaId;
  }
  function saveTargetSnapshot(listName) {
    if (!state.targets.length) {
      setTargetStatus({ type: "error", message: "Kaydedilecek oyuncu hedefi bulunmuyor." });
      return false;
    }
    const snapshot = state.targets.map((player) => ({
      id: player.id,
      name: player.name,
      commonName: player.commonName || player.name,
      rating: player.rating,
      position: player.position || "",
      eaId: player.eaId || 0,
      eaIdTargetKey: player.eaIdTargetKey || null,
      price: player.price,
      searches: player.searches,
      buyNow: player.buyNow,
      futbinId: player.futbinId,
      versionLabel: player.versionLabel || "",
      playerImageUrl: player.playerImageUrl || "",
      promoImageUrl: player.promoImageUrl || "",
      holographicAnimationUrl: player.holographicAnimationUrl || "",
      stats: player.stats || null,
      nationImageUrl: player.nationImageUrl || "",
      leagueImageUrl: player.leagueImageUrl || "",
      clubImageUrl: player.clubImageUrl || "",
      raretype: player.raretype != null ? player.raretype : null,
      isHolo: Boolean(player.isHolo)
    }));
    try {
      const name = String(listName || "").trim();
      if (!name) return false;
      const existing = state.savedTargetLists.find((list) => list.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
      const savedList = { id: existing ? existing.id : "list:" + Date.now() + ":" + Math.random().toString(36).slice(2, 7), name, savedAt: Date.now(), players: snapshot };
      const nextLists = existing ? state.savedTargetLists.map((list) => list.id === existing.id ? savedList : list) : [savedList].concat(state.savedTargetLists);
      saveSavedTargetLists(nextLists);
      state.savedTargetLists = nextLists;
      state.selectedSavedTargetListId = savedList.id;
      setTargetStatus({ type: "success", message: "\u201C" + name + "\u201D ad\u0131yla " + snapshot.length + " oyuncu kaydedildi." });
      emit("targets:changed");
      return true;
    } catch (error2) {
      setTargetStatus({ type: "error", message: "Oyuncu listesi kaydedilemedi. Taray\u0131c\u0131 depolama alan\u0131n\u0131 kontrol edin." });
      return false;
    }
  }
  function restoreSavedTargets() {
    const savedList = state.savedTargetLists.find((list) => list.id === state.selectedSavedTargetListId);
    if (!savedList || !savedList.players.length) return 0;
    let restored = 0;
    savedList.players.forEach((saved) => {
      const duplicate = findDuplicateTarget(state.targets, saved);
      if (duplicate) {
        duplicate.price = saved.price;
        if (normalizedEaId(saved.eaId)) {
          duplicate.eaId = normalizedEaId(saved.eaId);
          duplicate.eaIdTargetKey = saved.eaIdTargetKey || null;
        }
        duplicate.searches = saved.searches;
        duplicate.buyNow = saved.buyNow;
      } else {
        state.targets.push({ ...saved });
      }
      restored++;
    });
    saveTargets();
    emit("targets:changed");
    return restored;
  }
  function mergeTargetPlayers(players) {
    let added = 0;
    players.forEach((player) => {
      const nameKey = player.name.trim().toLocaleLowerCase();
      const duplicate = findDuplicateTarget(state.targets, player);
      if (duplicate) {
        if (!duplicate.eaId && normalizedEaId(player.eaId)) {
          duplicate.eaId = normalizedEaId(player.eaId);
          duplicate.eaIdTargetKey = player.eaIdTargetKey || null;
        }
        if (player.playerImageUrl && !duplicate.playerImageUrl) duplicate.playerImageUrl = player.playerImageUrl;
        if (player.promoImageUrl && !duplicate.promoImageUrl) duplicate.promoImageUrl = player.promoImageUrl;
        if (player.versionLabel && !duplicate.versionLabel) duplicate.versionLabel = player.versionLabel;
        if (player.commonName && !duplicate.commonName) duplicate.commonName = player.commonName;
        if (player.position && !duplicate.position) duplicate.position = player.position;
        if (player.stats && !duplicate.stats) duplicate.stats = player.stats;
        if (player.nationImageUrl && !duplicate.nationImageUrl) duplicate.nationImageUrl = player.nationImageUrl;
        if (player.leagueImageUrl && !duplicate.leagueImageUrl) duplicate.leagueImageUrl = player.leagueImageUrl;
        if (player.clubImageUrl && !duplicate.clubImageUrl) duplicate.clubImageUrl = player.clubImageUrl;
        if (player.leagueName && !duplicate.leagueName) duplicate.leagueName = player.leagueName;
        if (player.leagueImageFallbacks && !duplicate.leagueImageFallbacks) duplicate.leagueImageFallbacks = player.leagueImageFallbacks;
        if (Array.isArray(player.playstylesPlus) && player.playstylesPlus.length > 0 && (!duplicate.playstylesPlus || !duplicate.playstylesPlus.length)) duplicate.playstylesPlus = player.playstylesPlus;
        if (player.priceUpdatedAt && !duplicate.priceUpdatedAt) duplicate.priceUpdatedAt = player.priceUpdatedAt;
        if (player.holographicAnimationUrl && !duplicate.holographicAnimationUrl) duplicate.holographicAnimationUrl = player.holographicAnimationUrl;
        if (player.isHolo) duplicate.isHolo = true;
        return;
      }
      const futbinId = player.futbinId == null ? null : String(player.futbinId);
      state.targets.push({
        id: futbinId ? "futbin:" + futbinId : nameKey + ":" + player.rating,
        name: player.name,
        commonName: player.commonName || player.name,
        rating: player.rating,
        position: player.position || "",
        eaId: Number(player.eaId) || 0,
        eaIdTargetKey: player.eaIdTargetKey || null,
        price: player.price,
        searches: 3,
        buyNow: player.buyNow != null ? player.buyNow : player.price,
        futbinId,
        playerId: player.playerId || toBaseId(player.eaId),
        versionKnown: Boolean(player.versionKnown),
        versionLabel: player.versionLabel || "",
        playerImageUrl: player.playerImageUrl || "",
        promoImageUrl: player.promoImageUrl || "",
        holographicAnimationUrl: player.holographicAnimationUrl || "",
        stats: player.stats || null,
        nationImageUrl: player.nationImageUrl || "",
        leagueImageUrl: player.leagueImageUrl || "",
        clubImageUrl: player.clubImageUrl || "",
        leagueImageFallbacks: Array.isArray(player.leagueImageFallbacks) ? player.leagueImageFallbacks : [],
        leagueName: player.leagueName || "",
        playstylesPlus: Array.isArray(player.playstylesPlus) ? player.playstylesPlus : [],
        priceUpdatedAt: Number(player.priceUpdatedAt) || Date.now(),
        nationId: Number(player.nationId) || 0,
        clubId: Number(player.clubId) || 0,
        leagueId: Number(player.leagueId) || 0,
        raretype: player.raretype != null ? player.raretype : null,
        isHolo: Boolean(player.isHolo)
      });
      added++;
    });
    saveTargets();
    emit("targets:changed");
    return added;
  }

  // src/bot/idle.js
  async function idleWait(ms, token, kind) {
    const duration = Math.max(0, Number(ms) || 0);
    const prevMeta = state.botWait || {};
    state.botWait = {
      start: Date.now(),
      duration,
      kind,
      baseMs: prevMeta.baseMs ?? duration,
      jitterMs: prevMeta.jitterMs ?? 0,
      totalMs: duration,
      tierRgb: prevMeta.tierRgb ?? "56, 189, 248",
      tierColor: prevMeta.tierColor ?? "#38bdf8"
    };
    let elapsed = 0;
    try {
      emit("bot:wait");
      while (elapsed < duration) {
        if (token !== state.botToken || !state.botRunning) return false;
        const slice = Math.min(100, duration - elapsed);
        await wait(slice);
        elapsed += slice;
      }
      return token === state.botToken && state.botRunning;
    } finally {
      state.botWait = null;
      emit("bot:wait");
    }
  }

  // src/bot/speedTiers.js
  var SPEED_TIERS = [
    { id: 0, key: "safe", name: "G\xFCvenli", defaultSec: 5, color: "#22c55e", rgb: "34, 197, 94", riskNote: null, isWarning: false },
    { id: 1, key: "balanced", name: "Dengeli", defaultSec: 4, color: "#a3e635", rgb: "163, 230, 53", riskNote: null, isWarning: false },
    { id: 2, key: "fast", name: "H\u0131zl\u0131", defaultSec: 2.5, color: "#f59e0b", rgb: "245, 158, 11", riskNote: null, isWarning: false },
    { id: 3, key: "turbo", name: "Turbo", defaultSec: 1.5, color: "#ef4444", rgb: "239, 68, 68", riskNote: "Y\xFCksek ban riski", isWarning: true }
  ];
  var SPEED_LIMITS = {
    MIN_SEC: 1,
    MAX_SEC: 10,
    STEP_SEC: 0.2
  };
  function clampTierSeconds(val) {
    const num = Math.round(Number(val) * 10) / 10;
    if (isNaN(num)) return SPEED_LIMITS.MIN_SEC;
    return Math.min(SPEED_LIMITS.MAX_SEC, Math.max(SPEED_LIMITS.MIN_SEC, num));
  }
  function formatTierSeconds(sec) {
    return (Math.round(Number(sec) * 10) / 10).toFixed(1);
  }
  function getEffectiveSpeedDelayMs(snipeSettings) {
    const activeSpeed = Number.isInteger(snipeSettings?.speed) && snipeSettings.speed >= 0 && snipeSettings.speed <= 3 ? snipeSettings.speed : 1;
    const customDelays = snipeSettings?.speedDelays;
    const tier = SPEED_TIERS[activeSpeed] || SPEED_TIERS[1];
    const sec = typeof customDelays?.[activeSpeed] === "number" ? clampTierSeconds(customDelays[activeSpeed]) : tier.defaultSec;
    return Math.round(sec * 1e3);
  }

  // src/bot/autoBuyer.js
  var defaultSearchJitterMs = [...CONFIG.bot.searchJitterMs];
  var defaultCycleJitterMs = [...CONFIG.bot.cycleJitterMs];
  function stopAutoBuyer(reason) {
    if (!state.botRunning) return;
    state.botRunning = false;
    state.botToken++;
    state.botWait = null;
    if (Array.isArray(state.targets)) {
      for (const t of state.targets) {
        delete t._lastSearchActiveAt;
      }
    }
    emit("bot:wait");
    setBotStatus(reason || "Tarama durduruldu.");
    addBotLog(state.botStatus, "error");
  }
  async function startAutoBuyer() {
    if (state.botRunning) return;
    if (safetyGovernor.isHalted()) {
      setBotStatus("G\xFCvenlik durdurucu devrede: " + safetyGovernor.getHaltReason());
      addBotLog("\u26D4 Bot ba\u015Flat\u0131lamad\u0131: " + safetyGovernor.getHaltReason() + ' (Devam etmek i\xE7in "Devam Et" butonuna bas\u0131n).', "error");
      return;
    }
    if (!state.targets.length) {
      setBotStatus("\xD6nce Oyuncu Hedefleri listesine oyuncu ekleyin.");
      addBotLog(state.botStatus, "error");
      return;
    }
    const service = pageWindow.services?.Item;
    if (!service || typeof service.searchTransferMarket !== "function" || typeof service.bid !== "function") {
      setBotStatus("EA Transfer Market haz\u0131r de\u011Fil. Transfer ekran\u0131n\u0131 a\xE7\u0131p tekrar deneyin.");
      addBotLog(state.botStatus, "error");
      return;
    }
    state.botRunning = true;
    const token = ++state.botToken;
    if (Array.isArray(state.targets)) {
      for (const t of state.targets) {
        delete t._lastSearchActiveAt;
      }
    }
    state.botStats = { bought: 0, missed: 0, searches: 0, errors: 0 };
    state.botWait = null;
    emit("bot:stats");
    setBotStatus("Oyuncular e\u015Fle\u015Ftiriliyor...");
    addBotLog("FutRUSH taramas\u0131 ba\u015Flat\u0131ld\u0131.", "success");
    runAutoBuyer(token);
  }
  async function runAutoBuyer(token, deps = {}) {
    const getSpeedDelay = () => getEffectiveSpeedDelayMs(state.snipeSettings);
    const settings = state.snipeSettings;
    const search = deps.searchAutoBuyOffers || searchAutoBuyOffers;
    const buy = deps.buyAutoOffer || buyAutoOffer;
    const idle = deps.idleWait || idleWait;
    const resolveId = deps.resolveTargetEaId || resolveTargetEaId;
    const coinBalance = deps.getCoinBalance || getBalance;
    const rnd = deps.random || Math.random;
    const validJitterRange = (range, fallback) => Array.isArray(range) && range.length === 2 && range.every(Number.isFinite) && range[0] >= 0 && range[1] >= range[0] ? range : fallback;
    const searchJitterRange = validJitterRange(CONFIG.bot.searchJitterMs, defaultSearchJitterMs);
    const cycleJitterRange = validJitterRange(CONFIG.bot.cycleJitterMs, defaultCycleJitterMs);
    const jitterMs = (range) => Math.round(randomBetween(range[0], range[1], rnd));
    const incrementStat = (name) => {
      state.botStats[name]++;
      emit("bot:stats");
    };
    let cycles = 0;
    let bought = 0;
    let totalSpent = 0;
    let totalProfit = 0;
    let searchIndex = 0;
    const governor = deps.safetyGovernor || safetyGovernor;
    const attemptedTrades = /* @__PURE__ */ new Set();
    const loggedMatches = /* @__PURE__ */ new Set();
    const newlyResolvedTargets = /* @__PURE__ */ new Set();
    const checkLimitsReached = (nextCost = 0) => {
      if (!checkPilesProtection(governor)) return true;
      const check = governor.canSearch({ currentSpent: totalSpent, currentBought: bought, nextCost });
      return !check.allowed;
    };
    try {
      for (const target of state.targets) {
        if (target.searchDisabled || target.insufficientBalance) continue;
        if (token !== state.botToken || !state.botRunning) return;
        const needsResolution = !hasCurrentTargetEaId(target);
        await resolveId(target);
        if (token !== state.botToken || !state.botRunning) return;
        if (needsResolution && hasCurrentTargetEaId(target)) newlyResolvedTargets.add(target);
        await wait(250);
      }
      do {
        cycles++;
        for (let targetIndex = 0; targetIndex < state.targets.length; targetIndex++) {
          const target = state.targets[targetIndex];
          if (target.searchDisabled || target.insufficientBalance) continue;
          if (!checkPriceCapGuard(target, target.buyNow)) {
            stopAutoBuyer(`Fiyat korumas\u0131: ${target.name} (Buy Now: ${Number(target.buyNow).toLocaleString("tr-TR")} > FutBIN: ${Number(target.price).toLocaleString("tr-TR")})`);
            return;
          }
          const eaId = Number(target.eaId) || 0;
          const attempts = Math.max(1, Math.round(Number(target.searches) || 1));
          for (let attempt = 1; attempt <= attempts; attempt++) {
            if (token !== state.botToken || !state.botRunning) return;
            if (checkLimitsReached()) return;
            const effectiveCalc = computeEffectiveBuyNow(target, { maxPriceCapThreshold: state.snipeSettings?.maxPriceCapThreshold });
            const currentSearchBuyNow = effectiveCalc.effectiveBuyNow;
            if (!checkPriceCapGuard(target, currentSearchBuyNow)) {
              stopAutoBuyer("Fiyat korumas\u0131: " + target.name + " efektif SATIN AL (" + currentSearchBuyNow.toLocaleString("tr-TR") + ") FutBIN tavan\u0131n\u0131 a\u015F\u0131yor!");
              return;
            }
            setBotStatus(target.name + " aran\u0131yor (" + attempt + "/" + attempts + ") \xB7 en fazla " + Number(target.buyNow).toLocaleString("tr-TR"));
            incrementStat("searches");
            if (newlyResolvedTargets.has(target) && !loggedMatches.has(target)) {
              addBotLog(target.name + " EA oyuncu kimli\u011Fiyle e\u015Fle\u015Ftirildi.", "success");
              loggedMatches.add(target);
            }
            searchIndex++;
            governor.recordSearch();
            const searchStartTime = Date.now();
            const result = await search(target, eaId, token, { searchIndex, effectiveBuyNow: currentSearchBuyNow });
            const searchEndTime = Date.now();
            const now = searchEndTime;
            const searchDurationMs = Math.max(0, searchEndTime - searchStartTime);
            const rawDelta = typeof target._lastSearchActiveAt === "number" && target._lastSearchActiveAt > 0 ? now - target._lastSearchActiveAt : searchDurationMs;
            const elapsedMs = Math.max(searchDurationMs, Math.min(rawDelta, 8e3));
            target._lastSearchActiveAt = now;
            if (result.stopped) return;
            const offer = result.offers.find((item) => !attemptedTrades.has(item.tradeId));
            if (!offer) {
              governor.recordResult(200);
              addBotLog(target.name + ": Sat\u0131n Al s\u0131n\u0131r\u0131nda uygun ilan bulunamad\u0131.", "info");
              const escRecord = recordEscalationSearch(target, { matchFound: false, elapsedMs, canProgress: true }, { maxPriceCapThreshold: state.snipeSettings?.maxPriceCapThreshold });
              if (escRecord.logMessage) {
                addMarketLog({ text: "\u{1F4C8} [Otomatik Artt\u0131rma] " + escRecord.logMessage, type: escRecord.steppedUp ? "info" : "warn" });
              }
              emit("escalation:update", target);
            } else {
              recordEscalationSearch(target, { matchFound: true, elapsedMs, canProgress: true });
              emit("escalation:update", target);
              attemptedTrades.add(offer.tradeId);
              if (checkLimitsReached(offer.price)) return;
              if (!checkPilesProtection(governor)) return;
              if (!checkPriceCapGuard(target, offer.price)) {
                stopAutoBuyer(`Fiyat korumas\u0131: ${target.name} teklif fiyat\u0131 FutBIN referans\u0131n\u0131 a\u015F\u0131yor (${offer.price.toLocaleString("tr-TR")})`);
                return;
              }
              const balance = coinBalance();
              if (balance != null && offer.price > balance) {
                addMarketLog({
                  text: `${target.name}: Sat\u0131n alma atland\u0131 \u2014 Bakiye yetersiz (${balance.toLocaleString("tr-TR")} < ${offer.price.toLocaleString("tr-TR")}).`,
                  type: "warn"
                });
                continue;
              }
              if (state.snipeSettings.dryRun) {
                const reset = resetEscalationOnPurchase(target);
                if (reset) {
                  addMarketLog({ text: "\u{1F3AF} [Otomatik Artt\u0131rma - Kuru \xC7al\u0131\u015Ft\u0131rma] " + target.name + " sim\xFCle al\u0131nd\u0131, fiyat ad\u0131mlar\u0131 s\u0131f\u0131rland\u0131.", type: "info" });
                  emit("escalation:update", target);
                }
                governor.recordPurchase(offer.price);
                incrementStat("simulatedBought");
                addBotLog({
                  name: target.name,
                  rating: offer.rating,
                  price: offer.price,
                  kind: "dryRun"
                });
                setBotStatus("KURU \xC7ALI\u015ETIRMA: " + target.name + " " + offer.price.toLocaleString("tr-TR") + " fiyat\u0131ndan al\u0131n\u0131rd\u0131");
              } else {
                setBotStatus(target.name + " \xB7 " + offer.price.toLocaleString("tr-TR") + " coin i\xE7in sat\u0131n alma deneniyor...");
                let purchase;
                try {
                  purchase = await buy(offer);
                } catch (error2) {
                  purchase = { success: false, error: error2 };
                }
                if (token !== state.botToken || !state.botRunning) return;
                if (purchase.success) {
                  const reset = resetEscalationOnPurchase(target);
                  if (reset) {
                    addMarketLog({ text: "\u{1F3AF} [Otomatik Artt\u0131rma] " + target.name + " sat\u0131n al\u0131nd\u0131, fiyat ad\u0131mlar\u0131 s\u0131f\u0131rland\u0131.", type: "success" });
                    emit("escalation:update", target);
                  }
                  bought++;
                  totalSpent += offer.price;
                  incrementStat("bought");
                  governor.recordPurchase(offer.price);
                  const futbinPrice = Number(target.price) || 0;
                  const cardProfit = futbinPrice > 0 ? Math.round(futbinPrice * 0.95) - offer.price : 0;
                  totalProfit += cardProfit;
                  addBotLog({
                    name: target.name,
                    rating: offer.rating,
                    price: offer.price,
                    profit: cardProfit,
                    totalProfit,
                    kind: "success"
                  });
                } else {
                  const error2 = purchase.error;
                  const classified = classifyPurchaseError(error2, purchase);
                  governor.recordResult(classified.code || (classified.kind === "fatal" ? 500 : 0));
                  let rawError;
                  try {
                    rawError = JSON.stringify(error2 ?? purchase);
                  } catch (serializationError) {
                    rawError = String(error2?.message || error2?.code || "JSON bi\xE7imine d\xF6n\xFC\u015Ft\xFCr\xFClemeyen EA hata nesnesi");
                  }
                  debug("[FutRUSH:bot]", "Sat\u0131n alma ba\u015Far\u0131s\u0131z; ham EA hatas\u0131:", (rawError || String(error2 || purchase)).slice(0, 300));
                  incrementStat(classified.kind === "missed" ? "missed" : "errors");
                  if (classified.kind === "other") {
                    warnOnce("purchase-error-other", "[FutRUSH:bot]", "S\u0131n\u0131fland\u0131r\u0131lmam\u0131\u015F EA sat\u0131n alma hatas\u0131:", (rawError || classified.text).slice(0, 300));
                  }
                  const codeText = classified.code === null ? "" : " (kod " + classified.code + ")";
                  if (classified.kind === "missed") {
                    addBotLog({ name: target.name, rating: offer.rating, price: offer.price, kind: "missed" });
                  } else {
                    addBotLog(target.name + ": sat\u0131n alma ba\u015Far\u0131s\u0131z \u2014 " + classified.text + codeText, "error");
                  }
                  if (classified.code === 458 || String(classified.code) === "458") {
                    governor.halt("captcha");
                    return;
                  }
                  if (classified.kind === "fatal" && CONFIG.bot.stopOnFatalPurchaseError) {
                    stopAutoBuyer("Kritik EA sat\u0131n alma hatas\u0131 nedeniyle tarama durduruldu.");
                  }
                }
              }
            }
            const hasMoreSearches = attempt < attempts || state.targets.slice(targetIndex + 1).some((t) => !t.searchDisabled && !t.insufficientBalance);
            if (checkLimitsReached()) return;
            if (hasMoreSearches && state.botRunning && token === state.botToken) {
              const baseDelay2 = getSpeedDelay();
              const jitter2 = jitterMs(searchJitterRange);
              const totalDelay2 = baseDelay2 + jitter2;
              debug("[FutRUSH:bot]", "Arama aras\u0131 gecikme:", totalDelay2, "ms (taban " + baseDelay2 + " + jitter " + jitter2 + ")");
              const activeTier2 = SPEED_TIERS[state.snipeSettings?.speed] || SPEED_TIERS[1];
              state.botWait = {
                baseMs: baseDelay2,
                jitterMs: jitter2,
                totalMs: totalDelay2,
                duration: totalDelay2,
                tierColor: activeTier2.color,
                tierRgb: activeTier2.rgb || "56, 189, 248"
              };
              if (state.botLogs[0] && state.botLogs[0].message?.includes("uygun ilan bulunamad\u0131")) {
                state.botLogs[0].baseMs = baseDelay2;
                state.botLogs[0].jitterMs = jitter2;
                state.botLogs[0].totalMs = totalDelay2;
              }
              await idle(totalDelay2, token, "search");
            }
          }
          if (checkLimitsReached()) break;
        }
        if (!state.botRunning || token !== state.botToken) return;
        if (checkLimitsReached()) return;
        if (settings.repeat > 0 && cycles >= settings.repeat) {
          stopAutoBuyer("Tarama tamamland\u0131. Ba\u015Far\u0131l\u0131 al\u0131m: " + bought + ".");
          return;
        }
        let baseDelay = 4e3;
        const waitCfg = settings.waitSeconds;
        if (Array.isArray(waitCfg) && waitCfg.length === 2) {
          const minSec = Math.max(0, Math.min(Number(waitCfg[0]) || 0, Number(waitCfg[1]) || 0));
          const maxSec = Math.max(0, Math.max(Number(waitCfg[0]) || 0, Number(waitCfg[1]) || 0));
          if (maxSec > 0) {
            const chosenSec = Math.round(randomBetween(minSec, maxSec, rnd));
            baseDelay = chosenSec * 1e3;
          } else {
            baseDelay = getSpeedDelay();
          }
        } else if (typeof waitCfg === "number" && waitCfg > 0) {
          baseDelay = waitCfg * 1e3;
        } else {
          baseDelay = getSpeedDelay();
        }
        const jitter = jitterMs(cycleJitterRange);
        const totalDelay = baseDelay + jitter;
        debug("[FutRUSH:bot]", "D\xF6ng\xFC sonu gecikme:", totalDelay, "ms (taban " + baseDelay + " + jitter " + jitter + ")");
        const activeTier = SPEED_TIERS[state.snipeSettings?.speed] || SPEED_TIERS[1];
        state.botWait = {
          baseMs: baseDelay,
          jitterMs: jitter,
          totalMs: totalDelay,
          duration: totalDelay,
          tierColor: activeTier.color,
          tierRgb: activeTier.rgb || "56, 189, 248"
        };
        if (state.botLogs[0] && state.botLogs[0].message?.includes("uygun ilan bulunamad\u0131")) {
          state.botLogs[0].baseMs = baseDelay;
          state.botLogs[0].jitterMs = jitter;
          state.botLogs[0].totalMs = totalDelay;
        }
        await idle(totalDelay, token, "cycle");
      } while (state.botRunning && token === state.botToken);
    } catch (error2) {
      if (token === state.botToken) {
        const code = error2?.status || error2?.code;
        if (code === 458 || String(code) === "458") {
          governor.halt("captcha");
        } else {
          governor.recordResult(code || 500);
          incrementStat("errors");
          state.botRunning = false;
          state.botToken++;
          setBotStatus(error2.message || "FutRUSH taramas\u0131 hata nedeniyle durdu.");
          addBotLog(state.botStatus, "error");
        }
      }
    }
  }

  // src/ui/panel/panelLogic.js
  function logTone(type) {
    if (type === "success") return "success";
    if (type === "dryRun") return "warn";
    if (type === "error" || type === "missed" || type === "warn") return "error";
    return "info";
  }
  function botLogType(entry) {
    return entry?.kind || entry?.type || "info";
  }
  function summarizeBotStats(stats = {}) {
    return {
      bought: Number(stats.bought) || 0,
      simulatedBought: Number(stats.simulatedBought) || 0,
      missed: Number(stats.missed) || 0,
      searches: Number(stats.searches) || 0
    };
  }
  function formatWaitCountdown(remainingMs) {
    const seconds = Math.max(0, Number(remainingMs) || 0) / 1e3;
    const rounded = Number(seconds.toFixed(1));
    const text = rounded.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
    return text + " sn";
  }
  function normalizeTargetStatus(status) {
    if (!status || typeof status !== "object") return null;
    const normalized = {
      type: status.type || "info",
      message: String(status.message ?? "")
    };
    if (status.source) normalized.source = status.source;
    if (status.progress && Number.isFinite(Number(status.progress.done)) && Number.isFinite(Number(status.progress.total))) {
      normalized.progress = {
        done: Number(status.progress.done),
        total: Number(status.progress.total)
      };
    }
    return normalized;
  }

  // src/targets/pinnedPlayer.js
  function commitCandidateTarget(candidate, price) {
    const rating = Number(candidate.rating) || 0;
    const futbinPrice = Number(candidate.price) > 0 ? Math.round(Number(candidate.price)) : 0;
    const userPrice = Number(price) > 0 ? Math.round(Number(price)) : 0;
    const discountRate = typeof CONFIG.targetAdd?.discountRate === "number" && Number.isFinite(CONFIG.targetAdd.discountRate) ? CONFIG.targetAdd.discountRate : 0.1;
    const defaultBuyNow = futbinPrice > 0 ? Math.max(MIN_PRICE, roundDownToStep(Math.round(futbinPrice * 0.95 * (1 - discountRate)))) : Number(candidate.raw?.ps_LCPrice) || Number(candidate.raw?.pc_LCPrice) || 1e4;
    const finalBuyNow = userPrice > 0 && userPrice !== futbinPrice ? userPrice : defaultBuyNow;
    const finalMarketPrice = futbinPrice > 0 ? futbinPrice : userPrice > 0 ? userPrice : finalBuyNow;
    const versionLabel = candidate.versionLabel && candidate.versionLabel !== "Base" ? candidate.versionLabel : rating >= 75 ? "Gold" : rating >= 65 ? "Silver" : rating > 0 ? "Bronze" : candidate.versionLabel || "Base";
    const targetIdentity = {
      name: candidate.name,
      commonName: candidate.commonName || candidate.name,
      displayName: candidate.displayName || candidate.commonName || candidate.name,
      rating,
      position: candidate.position || "",
      futbinId: candidate.futbinId || null,
      eaId: candidate.eaId,
      baseId: toBaseId(candidate.baseId || candidate.playerId || candidate.eaId),
      playerId: candidate.playerId || candidate.baseId,
      raretype: candidate.raretype,
      versionLabel,
      isHolo: candidate.isHolo,
      playerImageUrl: candidate.playerImageUrl || "",
      playerImageFallbackUrl: candidate.playerImageFallbackUrl || "",
      promoImageUrl: candidate.promoImageUrl || "",
      holographicAnimationUrl: candidate.holographicAnimationUrl || "",
      stats: candidate.stats || null,
      nationId: candidate.nationId || 0,
      clubId: candidate.clubId || 0,
      leagueId: candidate.leagueId || 0,
      nationImageUrl: candidate.nationImageUrl || "",
      clubImageUrl: candidate.clubImageUrl || "",
      leagueImageUrl: candidate.leagueImageUrl || "",
      leagueImageFallbacks: Array.isArray(candidate.leagueImageFallbacks) ? candidate.leagueImageFallbacks : [],
      leagueName: candidate.leagueName || "",
      playstylesPlus: Array.isArray(candidate.playstylesPlus) ? candidate.playstylesPlus : [],
      priceUpdatedAt: Date.now(),
      versionKnown: true
    };
    const candidateBaseId = toBaseId(candidate.eaId || candidate.playerId || candidate.baseId);
    if (candidateBaseId > 0) {
      const staleIndex = state.targets.findIndex(
        (t) => !t.versionKnown && toBaseId(t.eaId || t.playerId) === candidateBaseId
      );
      if (staleIndex !== -1) {
        state.targets.splice(staleIndex, 1);
      }
    }
    const added = mergeTargetPlayers([{
      ...targetIdentity,
      eaIdTargetKey: targetEaIdKey(targetIdentity),
      price: finalMarketPrice,
      buyNow: finalBuyNow
    }]);
    state.pendingCandidates = null;
    if (added) {
      setTargetStatus({
        type: "success",
        message: candidate.name + (rating ? " (" + rating + ")" : "") + (candidate.versionLabel ? " [" + candidate.versionLabel + "]" : "") + " \xB7 Buy Now " + finalBuyNow.toLocaleString("tr-TR") + " hedeflere eklendi."
      });
    } else {
      const duplicate = findDuplicateTarget(state.targets, targetIdentity, { matchFutbinId: false });
      if (duplicate) {
        duplicate.eaId = candidate.eaId;
        duplicate.playerId = candidate.playerId || candidate.baseId;
        duplicate.versionKnown = true;
        duplicate.rating = rating;
        duplicate.raretype = candidate.raretype;
        duplicate.versionLabel = candidate.versionLabel;
        duplicate.position = candidate.position || duplicate.position || "";
        duplicate.commonName = candidate.commonName || duplicate.commonName || "";
        duplicate.displayName = targetIdentity.displayName;
        duplicate.stats = candidate.stats || duplicate.stats || null;
        duplicate.nationId = candidate.nationId || duplicate.nationId || 0;
        duplicate.clubId = candidate.clubId || duplicate.clubId || 0;
        duplicate.leagueId = candidate.leagueId || duplicate.leagueId || 0;
        duplicate.nationImageUrl = candidate.nationImageUrl || duplicate.nationImageUrl || "";
        duplicate.clubImageUrl = candidate.clubImageUrl || duplicate.clubImageUrl || "";
        duplicate.leagueImageUrl = candidate.leagueImageUrl || duplicate.leagueImageUrl || "";
        duplicate.leagueImageFallbacks = Array.isArray(candidate.leagueImageFallbacks) ? candidate.leagueImageFallbacks : duplicate.leagueImageFallbacks || [];
        duplicate.leagueName = candidate.leagueName || duplicate.leagueName || "";
        duplicate.playstylesPlus = Array.isArray(candidate.playstylesPlus) && candidate.playstylesPlus.length > 0 ? candidate.playstylesPlus : duplicate.playstylesPlus || [];
        duplicate.isHolo = candidate.isHolo;
        duplicate.holographicAnimationUrl = candidate.holographicAnimationUrl || duplicate.holographicAnimationUrl || "";
        duplicate.playerImageUrl = candidate.playerImageUrl || duplicate.playerImageUrl || "";
        duplicate.playerImageFallbackUrl = candidate.playerImageFallbackUrl || duplicate.playerImageFallbackUrl || "";
        duplicate.promoImageUrl = candidate.promoImageUrl || duplicate.promoImageUrl || "";
        duplicate.eaIdTargetKey = targetEaIdKey(duplicate);
        duplicate.buyNow = finalBuyNow;
        duplicate.price = finalMarketPrice;
        duplicate.priceUpdatedAt = Date.now();
        saveTargets();
        setTargetStatus({
          type: "success",
          message: candidate.name + " zaten listede; s\xFCr\xFCm ve Buy Now fiyat\u0131 g\xFCncellendi."
        });
      }
    }
    emit("targets:changed");
  }
  async function hydrateTargetsWithFutbin(onItemComplete) {
    const needsHydration = state.targets.filter((t) => !t.hydrationAttempted && (!t.playerImageUrl || !t.promoImageUrl || !t.stats || !t.clubImageUrl || !t.leagueImageUrl || !t.playstylesPlus || !t.playstylesPlus.length));
    if (!needsHydration.length) return;
    needsHydration.forEach((t) => {
      t.hydrationAttempted = true;
      t.isSkeleton = true;
    });
    for (const target of needsHydration) {
      try {
        const queryName = target.commonName || target.name;
        const details = await fetchPlayerDetailsFromFutbinApi({
          name: queryName,
          rating: target.rating,
          eaId: target.eaId,
          futbinId: target.futbinId
        });
        if (details) {
          if ((!target.playstylesPlus || !target.playstylesPlus.length) && details.playstylesPlus?.length) {
            target.playstylesPlus = details.playstylesPlus;
          }
          if (!target.playerImageUrl && details.playerImageUrl) target.playerImageUrl = details.playerImageUrl;
          if (!target.promoImageUrl && details.promoImageUrl) target.promoImageUrl = details.promoImageUrl;
          if (!target.playerImageFallbackUrl && details.playerImageFallbackUrl) target.playerImageFallbackUrl = details.playerImageFallbackUrl;
          if (!target.nationImageUrl && details.nationImageUrl) target.nationImageUrl = details.nationImageUrl;
          if (!target.clubImageUrl && details.clubImageUrl) target.clubImageUrl = details.clubImageUrl;
          if (!target.leagueImageUrl && details.leagueImageUrl) target.leagueImageUrl = details.leagueImageUrl;
          if ((!target.leagueImageFallbacks || !target.leagueImageFallbacks.length) && details.leagueImageFallbacks?.length) target.leagueImageFallbacks = details.leagueImageFallbacks;
          if (!target.leagueName && details.leagueName) target.leagueName = details.leagueName;
          if (!target.stats && details.stats) target.stats = details.stats;
          if (!target.position && details.position) target.position = details.position;
          if (!target.futbinId && details.futbinId) target.futbinId = details.futbinId;
          if (!target.versionLabel && details.versionLabel) target.versionLabel = details.versionLabel;
          if (!target.price && details.price) target.price = details.price;
          target.priceUpdatedAt = Date.now();
        }
        const versions = await searchPlayerAllVersions(queryName);
        if (Array.isArray(versions) && versions.length) {
          const matched = versions.find(
            (v) => target.eaId && v.eaId === target.eaId || target.futbinId && String(v.futbinId) === String(target.futbinId) || target.rating && v.rating === target.rating
          ) || versions[0];
          if (matched) {
            if (matched.commonName && target.name !== matched.commonName) {
              target.name = matched.commonName;
              target.commonName = matched.commonName;
            }
            if (!target.playerImageUrl) target.playerImageUrl = matched.playerImageUrl;
            if (!target.promoImageUrl) target.promoImageUrl = matched.promoImageUrl;
            if (!target.playerImageFallbackUrl) target.playerImageFallbackUrl = matched.playerImageFallbackUrl;
            if (!target.nationImageUrl) target.nationImageUrl = matched.nationImageUrl;
            if (!target.clubImageUrl) target.clubImageUrl = matched.clubImageUrl;
            if (!target.leagueImageUrl) target.leagueImageUrl = matched.leagueImageUrl;
            if (!target.leagueImageFallbacks && matched.leagueImageFallbacks) target.leagueImageFallbacks = matched.leagueImageFallbacks;
            if (!target.leagueName && matched.leagueName) target.leagueName = matched.leagueName;
            if ((!target.playstylesPlus || !target.playstylesPlus.length) && matched.playstylesPlus?.length) target.playstylesPlus = matched.playstylesPlus;
            if (!target.stats) target.stats = matched.stats;
            if (!target.position) target.position = matched.position;
            if (!target.futbinId) target.futbinId = matched.futbinId;
            if (!target.versionLabel) target.versionLabel = matched.versionLabel;
            if (!target.price && matched.price) target.price = matched.price;
            target.priceUpdatedAt = Date.now();
          }
        }
      } catch (e) {
      }
      delete target.isSkeleton;
    }
    saveTargets();
    if (typeof onItemComplete === "function") onItemComplete();
  }

  // src/futbin/imageLoader.js
  var FUTBIN_REFERER = "https://www.futbin.org/";
  var MAX_CACHE_BYTES = 30 * 1024 * 1024;
  var NEGATIVE_CACHE_TTL_MS = 60 * 1e3;
  var imageDataCache = /* @__PURE__ */ new Map();
  var currentCacheBytes = 0;
  var inflightRequests = /* @__PURE__ */ new Map();
  var negativeCache = /* @__PURE__ */ new Map();
  function evictLruIfNeeded(newBytes) {
    while (currentCacheBytes + newBytes > MAX_CACHE_BYTES && imageDataCache.size > 0) {
      const oldestKey = imageDataCache.keys().next().value;
      const entry = imageDataCache.get(oldestKey);
      if (entry) {
        currentCacheBytes -= entry.bytes || 0;
        imageDataCache.delete(oldestKey);
      }
    }
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("FileReader did not return a string"));
        }
      };
      reader.onerror = () => reject(reader.error || new Error("Blob read error"));
      reader.readAsDataURL(blob);
    });
  }
  function fetchImageBlobUrl(url) {
    if (!url || typeof url !== "string") return Promise.resolve("");
    const trimmed = url.trim();
    if (!trimmed) return Promise.resolve("");
    if (imageDataCache.has(trimmed)) {
      const entry = imageDataCache.get(trimmed);
      imageDataCache.delete(trimmed);
      imageDataCache.set(trimmed, entry);
      return Promise.resolve(entry.dataUrl);
    }
    const failedAt = negativeCache.get(trimmed);
    if (failedAt && Date.now() - failedAt < NEGATIVE_CACHE_TTL_MS) {
      return Promise.resolve("");
    }
    if (failedAt) {
      negativeCache.delete(trimmed);
    }
    if (inflightRequests.has(trimmed)) {
      return inflightRequests.get(trimmed);
    }
    const promise = enqueueFutbinRequest(trimmed, () => new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        resolve({ status: 500 });
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: trimmed,
        responseType: "blob",
        timeout: 1e4,
        headers: {
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": trimmed.includes("fut.gg") ? "https://www.fut.gg/" : FUTBIN_REFERER
        },
        onload: (res) => resolve(res),
        onerror: () => resolve({ status: 500 }),
        ontimeout: () => resolve({ status: 504 }),
        onabort: () => resolve({ status: 0 })
      });
    })).then(async (res) => {
      if (res && res.status >= 200 && res.status < 300 && res.response) {
        try {
          const rawHeader = res.responseHeaders || "";
          const match = rawHeader.match(/content-type:\s*([^\r\n;]+)/i);
          const contentType = match ? match[1].trim().toLowerCase() : res.response.type || "";
          if (contentType && !contentType.startsWith("image/")) {
            negativeCache.set(trimmed, Date.now());
            return "";
          }
          const dataUrl = await blobToDataUrl(res.response);
          if (dataUrl && dataUrl.startsWith("data:image/")) {
            const approxBytes = dataUrl.length * 2;
            evictLruIfNeeded(approxBytes);
            imageDataCache.set(trimmed, { dataUrl, bytes: approxBytes });
            currentCacheBytes += approxBytes;
            negativeCache.delete(trimmed);
            return dataUrl;
          }
        } catch (e) {
        }
      }
      negativeCache.set(trimmed, Date.now());
      return "";
    }).catch(() => {
      negativeCache.set(trimmed, Date.now());
      return "";
    }).finally(() => {
      inflightRequests.delete(trimmed);
    });
    inflightRequests.set(trimmed, promise);
    return promise;
  }
  function loadFutbinImage(imgElement, url, fallbackUrl = "") {
    if (!imgElement) return;
    imgElement.setAttribute("referrerpolicy", "no-referrer");
    imgElement.setAttribute("crossorigin", "anonymous");
    imgElement.loading = "lazy";
    imgElement.crossOrigin = "anonymous";
    const fallbackList = Array.isArray(fallbackUrl) ? fallbackUrl.filter((u) => typeof u === "string" && u.trim()) : typeof fallbackUrl === "string" && fallbackUrl.trim() ? [fallbackUrl.trim()] : [];
    const primaryUrl = (url || "").trim();
    const allUrls = primaryUrl ? [primaryUrl, ...fallbackList] : fallbackList;
    const requestedKey = allUrls.join(";");
    if (allUrls.length === 0) {
      imgElement.src = "";
      imgElement.style.opacity = "0";
      return;
    }
    imgElement.dataset.futbinRequested = requestedKey;
    const tryUrl = (index) => {
      if (index >= allUrls.length) {
        if (imgElement.dataset.futbinRequested === requestedKey) {
          imgElement.style.opacity = "0";
        }
        return;
      }
      const targetUrl = allUrls[index];
      fetchImageBlobUrl(targetUrl).then((dataUrl) => {
        if (imgElement.dataset.futbinRequested !== requestedKey) return;
        if (dataUrl) {
          imgElement.src = dataUrl;
          imgElement.style.opacity = "1";
        } else {
          tryUrl(index + 1);
        }
      });
    };
    tryUrl(0);
  }
  function applyFutbinBgImage(element, url, fallbackUrl = "") {
    if (!element) return;
    const fallbackList = Array.isArray(fallbackUrl) ? fallbackUrl.filter((u) => typeof u === "string" && u.trim()) : typeof fallbackUrl === "string" && fallbackUrl.trim() ? [fallbackUrl.trim()] : [];
    const primaryUrl = (url || "").trim();
    const allUrls = primaryUrl ? [primaryUrl, ...fallbackList] : fallbackList;
    const requestedKey = allUrls.join(";");
    if (allUrls.length === 0) {
      element.style.backgroundImage = "none";
      return;
    }
    element.dataset.futbinBgRequested = requestedKey;
    const tryUrl = (index) => {
      if (index >= allUrls.length) {
        if (element.dataset.futbinBgRequested === requestedKey) {
          element.style.backgroundImage = "none";
        }
        return;
      }
      const targetUrl = allUrls[index];
      fetchImageBlobUrl(targetUrl).then((dataUrl) => {
        if (element.dataset.futbinBgRequested !== requestedKey) return;
        if (dataUrl) {
          element.style.backgroundImage = `url("${dataUrl}")`;
        } else {
          tryUrl(index + 1);
        }
      });
    };
    tryUrl(0);
  }

  // src/ui/panel/cardRenderer.js
  var PARTICLES = /* @__PURE__ */ new Set(["de", "da", "do", "dos", "das", "del", "della", "di", "van", "von", "der", "den", "ten", "ter", "le", "la", "el", "al", "bin", "ben", "mac", "st"]);
  var SUFFIXES = /* @__PURE__ */ new Set(["jr", "jr.", "junior", "j\xFAnior", "filho", "neto", "sr", "sr."]);
  function surnameOf(full) {
    const parts = String(full || "").trim().split(/\s+/);
    if (parts.length < 2) return full;
    if (SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
      return parts.slice(-2).join(" ");
    }
    let i = parts.length - 1;
    while (i > 1 && PARTICLES.has(parts[i - 1].toLowerCase())) i--;
    return parts.slice(i).join(" ");
  }
  function fitCardName(nameSpan, { nameAuto = true, nameMinScale = 70 } = {}) {
    if (!nameSpan) return;
    if (typeof nameSpan.clientWidth === "number" && typeof nameSpan.scrollWidth === "number" && nameSpan.clientWidth === 0 && nameSpan.scrollWidth === 0) {
      return;
    }
    const full = nameSpan.title || nameSpan.dataset.fullName || nameSpan.textContent || "";
    nameSpan.dataset.fullName = full;
    nameSpan.textContent = full;
    nameSpan.style.removeProperty("font-size");
    if (nameAuto) {
      const isOverflowing = () => nameSpan.scrollWidth > nameSpan.clientWidth + 1;
      if (isOverflowing()) {
        nameSpan.textContent = surnameOf(full);
        if (isOverflowing()) {
          const baseSizeCqw = 8.5;
          for (let s = 95; s >= nameMinScale; s -= 5) {
            nameSpan.style.setProperty("font-size", (baseSizeCqw * s / 100).toFixed(2) + "cqw");
            if (!isOverflowing()) break;
          }
        }
      }
    }
  }
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.querySelectorAll(".fr-ea-card-name").forEach((span) => {
        fitCardName(span, {
          nameAuto: CONFIG.nameAuto !== false,
          nameMinScale: typeof CONFIG.nameMinScale === "number" ? CONFIG.nameMinScale : 70
        });
      });
    }).catch(() => {
    });
  }
  function isDarkCard(item) {
    if (!item) return false;
    const raretype = Number(item.raretype ?? 0);
    if (raretype <= 1) return false;
    const promo = String(item.promoImageUrl || "").toLowerCase();
    if (promo.includes("gold") || promo.includes("silver") || promo.includes("bronze")) {
      return false;
    }
    return true;
  }
  function createEaCardElement(item, { size = "preview" } = {}) {
    const card = document.createElement("div");
    const sizeClass = size === "thumb" ? "fr-ea-card-thumb" : "fr-ea-card-preview";
    const holoClass = item.isHolo ? " fr-ea-card-holo" : "";
    const skeletonClass = item.isSkeleton ? " is-skeleton" : "";
    const darkClass = isDarkCard(item) ? " is-dark-card" : "";
    card.className = `fr-ea-card ${sizeClass}${holoClass}${skeletonClass}${darkClass} fr-target-thumb-wrap`;
    const showImages = CONFIG.showCardImages !== false;
    if (showImages && item.promoImageUrl) {
      const bg = document.createElement("div");
      bg.className = "fr-ea-card-bg fr-target-thumb-bg";
      applyFutbinBgImage(bg, item.promoImageUrl);
      card.appendChild(bg);
    }
    if (showImages && item.isHolo) {
      const shimmer = document.createElement("div");
      shimmer.className = "fr-card-holo-shimmer";
      card.appendChild(shimmer);
      if (item.holographicAnimationUrl) {
        const webp = document.createElement("img");
        webp.className = "fr-card-holo-webp";
        loadFutbinImage(webp, item.holographicAnimationUrl);
        card.appendChild(webp);
      }
    }
    const topLeft = document.createElement("div");
    topLeft.className = "fr-ea-card-top-left";
    if (item.rating) {
      const rating = document.createElement("div");
      rating.className = "fr-ea-card-rating";
      rating.textContent = String(item.rating);
      topLeft.appendChild(rating);
    }
    if (item.position) {
      const pos = document.createElement("div");
      pos.className = "fr-ea-card-pos";
      pos.textContent = String(item.position).toUpperCase();
      topLeft.appendChild(pos);
    }
    card.appendChild(topLeft);
    if (showImages && Array.isArray(item.playstylesPlus) && item.playstylesPlus.length > 0) {
      const psWrap = document.createElement("div");
      psWrap.className = "fr-ea-card-playstyles";
      item.playstylesPlus.slice(0, 4).forEach((ps) => {
        const rawName = typeof ps === "string" ? ps : ps.name || "";
        const psName = normalizePlaystyleName(rawName);
        if (!psName) return;
        const iconUrl = typeof ps === "object" && ps.iconUrl ? ps.iconUrl : resolvePlaystyleIconUrl(psName);
        if (!iconUrl) return;
        const psEl = document.createElement("div");
        psEl.className = "fr-ea-ps";
        psEl.title = `${psName}+`;
        const iconImg = document.createElement("img");
        iconImg.alt = psName;
        loadFutbinImage(iconImg, iconUrl);
        psEl.appendChild(iconImg);
        psWrap.appendChild(psEl);
      });
      if (psWrap.childNodes.length > 0) {
        card.appendChild(psWrap);
      }
    }
    if (showImages && item.playerImageUrl) {
      const playerImg = document.createElement("img");
      playerImg.className = "fr-ea-card-player-img fr-target-thumb";
      playerImg.alt = item.name || "";
      loadFutbinImage(playerImg, item.playerImageUrl, item.playerImageFallbackUrl || "");
      card.appendChild(playerImg);
    }
    const namePlate = document.createElement("div");
    namePlate.className = "fr-ea-card-name-plate";
    const nameSpan = document.createElement("span");
    nameSpan.className = "fr-ea-card-name";
    const fullName = item.displayName || item.commonName || item.name || "";
    nameSpan.textContent = fullName;
    nameSpan.title = item.name || fullName;
    namePlate.title = item.name || fullName;
    namePlate.appendChild(nameSpan);
    card.appendChild(namePlate);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        fitCardName(nameSpan, {
          nameAuto: CONFIG.nameAuto !== false,
          nameMinScale: typeof CONFIG.nameMinScale === "number" ? CONFIG.nameMinScale : 70
        });
      });
    }
    if (item.stats && (item.stats.pac > 0 || item.stats.dri > 0 || item.stats.div > 0)) {
      const isGk = String(item.position || "").toUpperCase() === "GK" || String(item.position || "").toUpperCase() === "KL";
      const labels = item.stats.labels || (isGk ? ["DIV", "HAN", "KIC", "REF", "SPE", "POS"] : ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"]);
      const s1 = item.stats.pac ?? 0;
      const s2 = item.stats.sho ?? 0;
      const s3 = item.stats.pas ?? 0;
      const s4 = item.stats.dri ?? 0;
      const s5 = item.stats.def ?? 0;
      const s6 = item.stats.phy ?? 0;
      const statsGrid = document.createElement("div");
      statsGrid.className = "fr-ea-card-stats-grid";
      statsGrid.append(
        createStatRow(s1, labels[0] || "PAC"),
        createStatRow(s2, labels[1] || "SHO"),
        createStatRow(s3, labels[2] || "PAS"),
        createStatRow(s4, labels[3] || "DRI"),
        createStatRow(s5, labels[4] || "DEF"),
        createStatRow(s6, labels[5] || "PHY")
      );
      card.appendChild(statsGrid);
    }
    if (showImages && (item.nationImageUrl || item.leagueImageUrl || item.clubImageUrl || item.leagueImageFallbacks && item.leagueImageFallbacks.length > 0)) {
      const crests = document.createElement("div");
      crests.className = "fr-ea-card-bottom-crests";
      if (item.nationImageUrl) {
        const nationImg = document.createElement("img");
        nationImg.className = "fr-ea-crest fr-ea-crest-nation";
        nationImg.alt = "Nation";
        loadFutbinImage(nationImg, item.nationImageUrl);
        crests.appendChild(nationImg);
      }
      if (item.leagueImageUrl || item.leagueImageFallbacks && item.leagueImageFallbacks.length > 0) {
        const leagueImg = document.createElement("img");
        leagueImg.className = "fr-ea-crest fr-ea-crest-league";
        leagueImg.alt = item.leagueName || "League";
        if (item.leagueName) {
          leagueImg.title = item.leagueName;
        }
        loadFutbinImage(leagueImg, item.leagueImageUrl, item.leagueImageFallbacks || []);
        crests.appendChild(leagueImg);
      }
      if (item.clubImageUrl) {
        const clubImg = document.createElement("img");
        clubImg.className = "fr-ea-crest fr-ea-crest-club";
        clubImg.alt = "Club";
        loadFutbinImage(clubImg, item.clubImageUrl);
        crests.appendChild(clubImg);
      }
      if (crests.childElementCount > 0) {
        card.appendChild(crests);
      }
    }
    return card;
  }
  function createStatRow(val, label) {
    const row = document.createElement("div");
    row.className = "fr-ea-stat fr-ea-stat-item";
    const lblEl = document.createElement("span");
    lblEl.className = "fr-ea-stat-lbl";
    lblEl.textContent = label;
    const valEl = document.createElement("span");
    valEl.className = "fr-ea-stat-val";
    valEl.textContent = String(val || "0");
    row.append(lblEl, valEl);
    return row;
  }

  // src/ea/lowestBin.js
  var DEFAULT_PAGE_SIZE = 20;
  var KEPT_PRICES = 10;
  var lowestOf = (values) => values.reduce((min, value) => value > 0 && (min === 0 || value < min) ? value : min, 0);
  var findLowestBin = async (search, options = {}) => {
    const {
      reference = 0,
      // baslangic tavani icin tahmini fiyat (ornegin FutBIN fiyati); 0 = tavansiz
      maxSearches = 5,
      match = () => true,
      // hangi ilanlar hedef oyuncuya ait
      pageSize = DEFAULT_PAGE_SIZE,
      gapMs = [1200, 1800],
      // iki arama arasi rastgele bekleme [min, max]; max <= 0 ise yok
      token = null,
      sleepFn = sleep,
      rnd = Math.random,
      spread = false,
      // az ilan goruldu ise ust fiyata bir arama daha (aykiri ilan tespiti icin)
      spreadRatio = 1.6,
      spreadMin = 3
    } = options;
    const limit = Math.max(1, Math.floor(Number(maxSearches)) || 1);
    const seen = /* @__PURE__ */ new Map();
    const tried = /* @__PURE__ */ new Set();
    let cap = reference > 0 ? Math.max(MIN_BIN, roundDownToStep(reference)) : 0;
    let covered = 0;
    let searches = 0;
    let cancelled = false;
    let failure = null;
    const best = () => lowestOf(Array.from(seen.values()));
    const isExact = () => {
      const current = best();
      return current > 0 && covered >= priceBelow(current);
    };
    const pause = async () => {
      if (!Array.isArray(gapMs) || !(gapMs[1] > 0)) return true;
      return sleepFn(randomBetween(gapMs[0], gapMs[1], rnd), token);
    };
    const run2 = async (maxBuy) => {
      if (searches > 0 && !await pause()) {
        cancelled = true;
        return null;
      }
      if (token && token.cancelled) {
        cancelled = true;
        return null;
      }
      tried.add(maxBuy);
      const result = await search(maxBuy);
      searches += 1;
      if (!result || !result.ok) {
        return { failed: result && result.error || { message: "EA aramas\u0131 ba\u015Far\u0131s\u0131z" } };
      }
      const listings = Array.isArray(result.listings) ? result.listings : [];
      const count = Number.isFinite(result.count) ? result.count : listings.length;
      listings.forEach((listing, index) => {
        if (match(listing)) seen.set(listing.tradeId ? String(listing.tradeId) : searches + ":" + index, listing.price);
      });
      return { listings, full: count >= pageSize };
    };
    while (searches < limit && !tried.has(cap)) {
      const page = await run2(cap);
      if (!page) break;
      if (page.failed) {
        failure = page.failed;
        break;
      }
      if (!page.full) covered = cap === 0 ? Infinity : Math.max(covered, cap);
      if (isExact()) break;
      const current = best();
      if (!page.full) {
        if (cap === 0) break;
        cap = current ? priceBelow(current) : searches >= limit - 1 ? 0 : roundDownToStep(Math.max(priceAbove(cap), cap * 1.5));
      } else {
        const floor = lowestOf(page.listings.map((listing) => listing.price));
        const next = floor ? priceBelow(floor) : 0;
        if (next < MIN_BIN) break;
        cap = next;
      }
    }
    let spreadFailed = false;
    if (!failure && !cancelled && spread && best() && seen.size < spreadMin) {
      const wide = roundUpToStep(best() * spreadRatio);
      if (!tried.has(wide)) {
        const page = await run2(wide);
        spreadFailed = !!(page && page.failed);
      }
    }
    const price = best();
    const prices = Array.from(seen.values()).sort((a, b) => a - b).slice(0, KEPT_PRICES);
    const base = {
      price: price || null,
      count: price ? prices.filter((value) => value === price).length : 0,
      prices,
      searches,
      spreadFailed
    };
    if (failure) return { ok: false, error: failure, exact: false, ...base };
    if (cancelled) return { ok: false, cancelled: true, exact: false, ...base };
    const none = !price && covered === Infinity;
    return { ok: true, none, exact: none || isExact(), ...base };
  };
  var robustMarketPrice = ({ price = 0, prices = [] } = {}, { ratio = 0.9, minListings = 3, maxSkip = 2 } = {}) => {
    const sorted = (prices || []).filter((value) => value > 0).sort((a, b) => a - b);
    if (!sorted.length) return { price: price || null, count: 0, skipped: [] };
    const skipped = [];
    let index = 0;
    if (ratio > 0 && sorted.length >= minListings) {
      const reference = sorted[2];
      while (index < maxSkip && index < sorted.length - 1 && sorted[index] < reference * ratio && sorted[index] !== sorted[index + 1]) {
        skipped.push(sorted[index]);
        index += 1;
      }
    }
    const market = sorted[index];
    return { price: market, count: sorted.filter((value) => value === market).length, skipped };
  };

  // src/ea/marketPrice.js
  var getMarketPrice = async (search, {
    eaId,
    rating = 0,
    reference = 0,
    token = null,
    maxSearches = 5,
    gapMs = [1200, 1800],
    outlierRatio = 0.9,
    spread = true,
    sleepFn,
    rnd
  } = {}) => {
    const baseId = (Number(eaId) || 0) & 16777215;
    const ratingNumber = Number(rating) || 0;
    const match = (listing) => !listing.own && listing.price > 0 && listing.baseId === baseId && (!ratingNumber || listing.rating === ratingNumber);
    const options = { reference, maxSearches, gapMs, token, match, spread: spread && outlierRatio > 0 };
    if (sleepFn) options.sleepFn = sleepFn;
    if (rnd) options.rnd = rnd;
    const result = await findLowestBin(search, options);
    if (!result.ok) {
      return { ok: false, price: null, lowest: result.price, skipped: [], count: 0, searches: result.searches, exact: false, cancelled: !!result.cancelled, error: result.error };
    }
    if (!result.price) {
      return { ok: true, price: null, lowest: null, skipped: [], count: 0, searches: result.searches, exact: result.exact, none: result.none };
    }
    const market = robustMarketPrice(result, { ratio: outlierRatio });
    return {
      ok: true,
      price: market.price,
      lowest: result.price,
      skipped: market.skipped,
      count: market.count,
      searches: result.searches,
      exact: result.exact,
      none: false
    };
  };

  // src/ea/marketPage.js
  var auctionOf = (item) => {
    try {
      return typeof item.getAuctionData === "function" && item.getAuctionData() || item._auction || null;
    } catch (e) {
      return item && item._auction ? item._auction : null;
    }
  };
  var fetchMarketPage = async (eaId, maxBuy = 0, { timeoutMs = 18e3 } = {}) => {
    if (safetyGovernor.isCaptchaHalted()) {
      return { ok: false, count: 0, listings: [], error: { message: "CAPTCHA kilitli" } };
    }
    const service = pageWindow.services && pageWindow.services.Item;
    const Criteria = pageWindow.UTSearchCriteriaDTO;
    if (!service || typeof service.searchTransferMarket !== "function") {
      return { ok: false, count: 0, listings: [], error: { message: "EA Transfer Market arama servisi bulunamad\u0131." } };
    }
    if (typeof Criteria !== "function") {
      return { ok: false, count: 0, listings: [], error: { message: "EA arama \xF6l\xE7\xFCtleri haz\u0131r de\u011Fil." } };
    }
    try {
      if (typeof service.clearTransferMarketCache === "function") service.clearTransferMarketCache();
    } catch (e) {
    }
    const criteria = new Criteria();
    criteria.type = "player";
    criteria.maskedDefId = Number(eaId) & 16777215;
    if (Number(maxBuy) > 0) criteria.maxBuy = Number(maxBuy);
    criteria.offset = 0;
    criteria.count = 21;
    const response = await observeEaRequest(service.searchTransferMarket(criteria, 1), timeoutMs);
    if (!response || !response.success) {
      const detail = response && response.error && (response.error.message || response.error) || (response && response.timeout ? "zaman a\u015F\u0131m\u0131" : "EA iste\u011Fi ba\u015Far\u0131s\u0131z");
      return { ok: false, count: 0, listings: [], error: { message: String(detail), timeout: !!(response && response.timeout) } };
    }
    const items = Array.from(response.data && response.data.items || []);
    const listings = items.map((item) => {
      const auction = auctionOf(item);
      return {
        tradeId: Number(auction && auction.tradeId) || 0,
        price: Number(auction && auction.buyNowPrice) || 0,
        rating: Number(item && item.rating) || 0,
        baseId: (Number(item && item.definitionId) || 0) & 16777215,
        own: !!(auction && auction.tradeOwner)
      };
    }).filter((listing) => listing.price > 0);
    return { ok: true, count: items.length, listings };
  };

  // src/ui/icons.js
  var ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 2 64 84" preserveAspectRatio="xMidYMid meet"> <defs> <linearGradient id="fr-ring" x1="0" y1="0" x2="1" y2="1"> <stop offset="0" stop-color="#00E5FF"/> <stop offset=".55" stop-color="#7C4DFF"/> <stop offset="1" stop-color="#FF2D95"/> </linearGradient> <linearGradient id="fr-bg" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#14264A"/> <stop offset="1" stop-color="#0A1226"/> </linearGradient> <linearGradient id="fr-bolt" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#FFF176"/> <stop offset=".5" stop-color="#FFB300"/> <stop offset="1" stop-color="#FF4D2E"/> </linearGradient> </defs> <path d="M40 4 L70 14 V46 C70 64 56 76 40 83 C24 76 10 64 10 46 V14 Z" fill="url(#fr-bg)" stroke="url(#fr-ring)" stroke-width="3" stroke-linejoin="round"/> <path d="M15 30h11M13 41h13M17 52h9" stroke="#00E5FF" stroke-width="3" stroke-linecap="round" opacity=".9"/> <polygon points="48,12 29,45 40,45 35,72 56,36 44,36 53,12" fill="url(#fr-bolt)" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="1" stroke-linejoin="round"/> </svg>';
  var LOGO_SVG = ICON_SVG.replace(/fr-(ring|bg|bolt)/g, "fr-lg-$1");
  var FUTBIN_ICON_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADFklEQVRYha2XO2gVQRSGvxuTmIeKoIVgo4IEBR/FGJOIMYY0RkVFplDjVEpEKxtBtBCsNHYWYiHCSKrxBRoSo4SUSkYQKx9IBGMQX1ETVGL0Wuxu3OyduXtzrz8s7J75d85/9585c24GD6TVtcBnoNLH8eAbUG+Eel4IuSzPWGsRyQEWAHek1QtLFbCtiOQRVgLd0uo5pQioL0EAQDtwNo2UcQWl1TUE/s91DE8A2VkIOWCEuuMbLPfEt3qSvwOWGqH+zEJAXvgs8Pnf+z+Tg/8L+PyfklbvLzJXFrhhhJrMK0BaXQ2s8UxyOLyKxWXgSDzgsqAFqCoywU8gn0Wd0urONAHtRSYHuAXsDYX4cFFa3ZxPQCn7v98IdZtgF33ycCqAm9LqZZBYA9LqKmCt58WTwFiKgD4AI9RDaXUjcA9Y7uAtAjqBk8lFuAW3/x+ALiPU7xQB0zBCvZRWNwB3gQ0OyiPItcDnf99sksdQ58gR4THkbsONHvL96EZafQ1Y7eCcNkL1hpx1wHmgzSNgOEtmZIYAafVc/P7bkFMB7AFqHZw30uoVwDlgN/4iB9BzXRzMkiA1A9UO8ifgRXi/yZN8EjgBSNJriCH4OiQFFOL/dg+nEjiYkjgLtBmhBuLBuD8+//tj9w0pSfIhAxxPNillANLqSmCd58W4/+tnkfAZ8DER2wGcyREAbAZqHJN85p//TcC8AhKPAB0EFdXFPyWtXpIU4PP2nhFqKoUTF3sUqDNCdRMsWNeCHAXeRw/RIlzsmbQQ/78T9H6XjFBfY/GCmppIwDFAAKsS5Mj/cvz+txihhhxx36J+EH8oAzBCjQM7CT5jhC8ECwmCXz/fMdk48CQZLKSoRZiuA0aoV9LqfUBPGC/E/0GylMshnax6rbiL2mtgOB6YUaeNUP0Exy4ER2mEJo+AHWSYyLnA14Z3JZvanIPCCHUB6AaGAMLC4fM/E86RvFz/N54CV5NB34FxCPgV3jcQ/N8rBaPALiPUj4IEGKHiPV3a/k/DINBhhHrrGsx3ZEZoLCLpGDAAXCHoE73NzF89J9UVxMx9nQAAAABJRU5ErkJggg==";

  // src/ui/panel/tabs/targetsTab.js
  var isHydrating = false;
  var isUpdatingPrices = false;
  var statusRemovalTimer = null;
  var lastUpdateInterval = null;
  function renderStatus(status, targetLoading) {
    const normalized = normalizeTargetStatus(status) || (targetLoading ? {
      type: "loading",
      message: "FutBIN oyuncular\u0131 y\xFCkleniyor...",
      source: "futbin"
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
    if (!timestamp) return "Son g\xFCncelleme: \u2014";
    const diffMs = Date.now() - Number(timestamp);
    if (diffMs < 0 || isNaN(diffMs)) return "Son g\xFCncelleme: \u2014";
    const diffSec = Math.floor(diffMs / 1e3);
    if (diffSec < 45) return "Son g\xFCncelleme: Az \xF6nce";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Son g\xFCncelleme: ${diffMin} dakika \xF6nce`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Son g\xFCncelleme: ${diffHours} saat \xF6nce`;
    const diffDays = Math.floor(diffHours / 24);
    return `Son g\xFCncelleme: ${diffDays} g\xFCn \xF6nce`;
  }
  function formatPriceHistoryTooltip(player) {
    const history = Array.isArray(player?.priceHistory) && player.priceHistory.length ? player.priceHistory : [];
    if (!history.length) {
      if (player?.price) {
        const d = player.priceUpdatedAt ? new Date(player.priceUpdatedAt) : /* @__PURE__ */ new Date();
        const dateStr = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const timeStr = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        return `Mevcut Fiyat: ${Number(player.price).toLocaleString("tr-TR")} coin (${dateStr} ${timeStr})`;
      }
      return "Fiyat ge\xE7mi\u015Fi bulunmuyor";
    }
    const lines = ["Son Fiyat G\xFCncellemeleri:"];
    history.slice(0, 5).forEach((item, idx) => {
      const d = new Date(item.at || Date.now());
      const dateStr = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      lines.push(`${idx + 1}. ${Number(item.price).toLocaleString("tr-TR")} coin \xB7 ${dateStr} ${timeStr}`);
    });
    return lines.join("\n");
  }
  var activeHoldRepeatStops = /* @__PURE__ */ new Set();
  function attachHoldRepeat(button, onTrigger) {
    let timer = null;
    let interval = null;
    let didTriggerOnDown = false;
    const stop = () => {
      activeHoldRepeatStops.delete(stop);
      window.removeEventListener("mouseup", stop, true);
      window.removeEventListener("touchend", stop, true);
      window.removeEventListener("touchcancel", stop, true);
      window.removeEventListener("blur", stop);
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
      if (e.type === "mousedown" && e.button !== 0) {
        if (e.button === 1) e.preventDefault();
        return;
      }
      didTriggerOnDown = true;
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
      activeHoldRepeatStops.add(stop);
      window.addEventListener("mouseup", stop, { capture: true, once: true });
      window.addEventListener("touchend", stop, { capture: true, once: true });
      window.addEventListener("touchcancel", stop, { capture: true, once: true });
      window.addEventListener("blur", stop, { once: true });
      onTrigger(e);
      timer = setTimeout(() => {
        if (!button.isConnected) {
          stop();
          return;
        }
        interval = setInterval(() => {
          if (!button.isConnected) {
            stop();
            return;
          }
          onTrigger(e);
        }, 70);
      }, 1e3);
    };
    button.addEventListener("mousedown", start);
    button.addEventListener("mouseup", stop);
    button.addEventListener("mouseleave", stop);
    button.addEventListener("touchstart", start, { passive: true });
    button.addEventListener("touchend", stop);
    button.addEventListener("touchcancel", stop);
    button.addEventListener("click", (e) => {
      e.preventDefault();
      if (!didTriggerOnDown) {
        onTrigger(e);
      }
    });
  }
  function updateTargetStatus(statusElement, status, targetLoading) {
    if (!statusElement) return;
    const normalized = renderStatus(status, targetLoading);
    if (!normalized) {
      statusElement.hidden = true;
      statusElement.removeAttribute("data-type");
      statusElement.replaceChildren();
      return;
    }
    cancelStatusRemoval(statusElement);
    statusElement.classList.remove("fr-target-status-exiting");
    statusElement.hidden = false;
    const previousType = statusElement.getAttribute("data-type");
    const previousMessage = statusElement.querySelector(".fr-target-status-message")?.textContent;
    statusElement.setAttribute("data-type", normalized.type);
    let row = statusElement.querySelector(".fr-target-status-row");
    if (!row) {
      row = document.createElement("div");
      row.className = "fr-target-status-row";
      const icon2 = document.createElement("span");
      icon2.className = "fr-target-status-icon";
      icon2.setAttribute("aria-hidden", "true");
      const main = document.createElement("div");
      main.className = "fr-target-status-main";
      const message2 = document.createElement("span");
      message2.className = "fr-target-status-message";
      const progressLabel2 = document.createElement("span");
      progressLabel2.className = "fr-target-progress-label";
      progressLabel2.hidden = true;
      main.append(message2, progressLabel2);
      row.append(icon2, main);
      statusElement.appendChild(row);
    }
    const icon = row.querySelector(".fr-target-status-icon");
    icon.dataset.type = normalized.type;
    icon.textContent = normalized.type === "loading" ? "" : normalized.type === "success" ? "\u2713" : normalized.type === "error" ? "!" : "\xB7";
    const message = row.querySelector(".fr-target-status-message");
    if (previousMessage !== normalized.message || !message.textContent) {
      message.textContent = normalized.message;
    }
    const scheduleMeasure = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
    scheduleMeasure(() => {
      if (message && message.scrollWidth > message.clientWidth + 1) {
        message.classList.add("is-overflowing");
        const overflow = message.scrollWidth - message.clientWidth;
        message.style.setProperty("--marquee-overflow", `${overflow + 8}px`);
        const duration = Math.max(4, Math.min(10, overflow / 25));
        message.style.setProperty("--marquee-duration", `${duration}s`);
      } else if (message) {
        message.classList.remove("is-overflowing");
      }
    });
    const progressLabel = row.querySelector(".fr-target-progress-label");
    let progress = statusElement.querySelector(".fr-target-progress");
    if (normalized.progress) {
      if (!progress) {
        progress = document.createElement("div");
        progress.className = "fr-target-progress";
        const fill = document.createElement("div");
        fill.className = "fr-target-progress-fill";
        progress.appendChild(fill);
        statusElement.appendChild(progress);
      }
      const done = Math.max(0, Number(normalized.progress.done) || 0);
      const total = Math.max(0, Number(normalized.progress.total) || 0);
      const width = total ? Math.min(100, done / total * 100) : 0;
      progress.querySelector(".fr-target-progress-fill").style.width = width + "%";
      progressLabel.textContent = done + "/" + total;
      progressLabel.hidden = false;
    } else {
      progress?.remove();
      progressLabel.textContent = "";
      progressLabel.hidden = true;
    }
    if (normalized.type === "success" && (previousType !== "success" || previousMessage !== normalized.message)) {
      statusElement.classList.remove("fr-status-success-flash");
      void statusElement.offsetWidth;
      statusElement.classList.add("fr-status-success-flash");
    } else {
      statusElement.classList.remove("fr-status-success-flash");
    }
  }
  function expireTargetStatus(content) {
    const statusElement = content.querySelector(".fr-target-status");
    if (!statusElement || statusElement.hidden) return;
    statusElement.classList.add("fr-target-status-exiting");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      statusElement.hidden = true;
      statusElement.removeAttribute("data-type");
      statusElement.replaceChildren();
      return;
    }
    statusRemovalTimer = setTimeout(() => {
      statusElement.hidden = true;
      statusElement.removeAttribute("data-type");
      statusElement.replaceChildren();
      statusRemovalTimer = null;
    }, 220);
  }
  function createEscalationControl(player, onUpdate, updateEffectiveLabel) {
    if (!player.escalation) {
      player.escalation = {
        enabled: false,
        afterSeconds: 120,
        afterMinutes: 2,
        maxSteps: 3,
        steps: 0,
        activeMs: 0
      };
    }
    const getSeconds = () => {
      return Math.max(120, Math.floor(Number(player.escalation.afterSeconds) || (Number(player.escalation.afterMinutes) ? player.escalation.afterMinutes * 60 : 120)));
    };
    const topGroup = document.createElement("div");
    topGroup.className = "fr-escalation-top-group";
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    const gearBtn = document.createElement("button");
    gearBtn.type = "button";
    gearBtn.className = "fr-escalation-gear-btn";
    gearBtn.innerHTML = "\u2699\uFE0F";
    gearBtn.title = "Oto Artt\u0131r Ayarlar\u0131";
    gearBtn.setAttribute("aria-label", `${player.name} i\xE7in Oto Artt\u0131r Ayarlar\u0131`);
    topGroup.append(toggleBtn, gearBtn);
    const badgesWrap = document.createElement("div");
    badgesWrap.className = "fr-escalation-badges-wrap";
    const popover = document.createElement("div");
    popover.className = "fr-escalation-popover";
    popover.hidden = true;
    const popoverHead = document.createElement("div");
    popoverHead.className = "fr-escalation-popover-head";
    const popoverTitle = document.createElement("span");
    popoverTitle.textContent = "Oto Artt\u0131r Ayarlar\u0131";
    const popoverClose = document.createElement("button");
    popoverClose.type = "button";
    popoverClose.className = "fr-escalation-popover-close";
    popoverClose.textContent = "\xD7";
    popoverClose.setAttribute("aria-label", "Kapat");
    popoverClose.addEventListener("click", (e) => {
      e.stopPropagation();
      popover.hidden = true;
    });
    popoverHead.append(popoverTitle, popoverClose);
    const preview = document.createElement("div");
    preview.className = "fr-escalation-preview";
    const inputsRow = document.createElement("div");
    inputsRow.className = "fr-escalation-inputs-row";
    const minWrap = document.createElement("div");
    minWrap.className = "fr-escalation-field";
    const minLabel = document.createElement("label");
    minLabel.className = "fr-escalation-field-label";
    minLabel.textContent = "Ka\xE7 sn bulunamazsa:";
    const minStepper = document.createElement("div");
    minStepper.className = "fr-escalation-stepper";
    const minMinus = document.createElement("button");
    minMinus.type = "button";
    minMinus.className = "fr-escalation-step-btn";
    minMinus.textContent = "\u2212";
    minMinus.setAttribute("aria-label", `${player.name} i\xE7in s\xFCreyi 5 saniye azalt`);
    const minInput = document.createElement("input");
    minInput.type = "text";
    minInput.inputMode = "numeric";
    minInput.className = "fr-escalation-field-input";
    minInput.setAttribute("min", "120");
    minInput.value = String(getSeconds());
    minInput.setAttribute("aria-label", `${player.name} i\xE7in bulunamazsa art\u0131rma s\xFCresi`);
    const minPlus = document.createElement("button");
    minPlus.type = "button";
    minPlus.className = "fr-escalation-step-btn";
    minPlus.textContent = "+";
    minPlus.setAttribute("aria-label", `${player.name} i\xE7in s\xFCreyi 5 saniye art\u0131r`);
    minStepper.append(minMinus, minInput, minPlus);
    minWrap.append(minLabel, minStepper);
    const maxWrap = document.createElement("div");
    maxWrap.className = "fr-escalation-field";
    const maxLabel = document.createElement("label");
    maxLabel.className = "fr-escalation-field-label";
    maxLabel.textContent = "En fazla basamak:";
    const maxStepper = document.createElement("div");
    maxStepper.className = "fr-escalation-stepper";
    const maxMinus = document.createElement("button");
    maxMinus.type = "button";
    maxMinus.className = "fr-escalation-step-btn";
    maxMinus.textContent = "\u2212";
    maxMinus.setAttribute("aria-label", `${player.name} i\xE7in maksimum basama\u011F\u0131 azalt`);
    const maxInput = document.createElement("input");
    maxInput.type = "text";
    maxInput.inputMode = "numeric";
    maxInput.className = "fr-escalation-field-input";
    maxInput.setAttribute("min", "1");
    maxInput.setAttribute("max", "10");
    maxInput.value = String(player.escalation.maxSteps || 3);
    maxInput.setAttribute("aria-label", `${player.name} i\xE7in maksimum art\u0131rma basama\u011F\u0131`);
    const maxPlus = document.createElement("button");
    maxPlus.type = "button";
    maxPlus.className = "fr-escalation-step-btn";
    maxPlus.textContent = "+";
    maxPlus.setAttribute("aria-label", `${player.name} i\xE7in maksimum basama\u011F\u0131 art\u0131r`);
    maxStepper.append(maxMinus, maxInput, maxPlus);
    maxWrap.append(maxLabel, maxStepper);
    inputsRow.append(minWrap, maxWrap);
    const errorEl = document.createElement("div");
    errorEl.className = "fr-escalation-inline-error";
    errorEl.hidden = true;
    popover.append(popoverHead, preview, inputsRow, errorEl);
    gearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      popover.hidden = !popover.hidden;
    });
    minInput.addEventListener("wheel", (e) => {
      e.preventDefault();
      minInput.blur();
    }, { passive: false });
    maxInput.addEventListener("wheel", (e) => {
      e.preventDefault();
      maxInput.blur();
    }, { passive: false });
    const render = () => {
      const effCalc = computeEffectiveBuyNow(player, {
        maxPriceCapThreshold: state.snipeSettings?.maxPriceCapThreshold
      });
      const isEnabled2 = Boolean(player.escalation?.enabled);
      const steps = Math.max(0, Math.floor(Number(player.escalation?.steps) || 0));
      const activeSec = Math.floor((Number(player.escalation?.activeMs) || 0) / 1e3);
      toggleBtn.className = "fr-escalation-toggle-btn " + (isEnabled2 ? "is-active" : "is-inactive");
      toggleBtn.innerHTML = `<span class="fr-escalation-btn-label">Oto Artt\u0131r: <span class="fr-escalation-toggle-status">${isEnabled2 ? "A\xE7\u0131k" : "Kapal\u0131"}</span></span><span class="fr-escalation-active-sec">(${activeSec} sn)</span>`;
      toggleBtn.title = `Bulunamazsa fiyat\u0131 otomatik artt\u0131r (A\xE7/Kapat) \xB7 Ge\xE7en s\xFCre: ${activeSec} sn`;
      badgesWrap.replaceChildren();
      if (isEnabled2) {
        if (steps > 0) {
          const stepBadge = document.createElement("span");
          stepBadge.className = "fr-escalation-badge fr-escalation-badge-step";
          stepBadge.textContent = `+${steps} basamak`;
          badgesWrap.appendChild(stepBadge);
        }
        if (effCalc.isAtCeiling) {
          const ceilingBadge = document.createElement("span");
          ceilingBadge.className = "fr-escalation-badge fr-escalation-badge-ceiling";
          ceilingBadge.textContent = "TAVAN";
          ceilingBadge.title = effCalc.ceilingReason || "Fiyat artt\u0131rma tavan\u0131na ula\u015F\u0131ld\u0131";
          badgesWrap.appendChild(ceilingBadge);
        }
        if (effCalc.isRiskOfLoss) {
          const lossWarning = document.createElement("span");
          lossWarning.className = "fr-escalation-badge fr-escalation-badge-loss";
          lossWarning.textContent = "\u26A0\uFE0F Zarar riski";
          lossWarning.title = "Efektif fiyat FutBIN piyasa fiyat\u0131n\u0131n %95\u2019ini a\u015F\u0131yor (%5 EA vergi sonras\u0131 zarar riski)";
          badgesWrap.appendChild(lossWarning);
        }
      }
      const baseFmt = Number(player.buyNow).toLocaleString("tr-TR");
      const effFmt = Number(effCalc.effectiveBuyNow).toLocaleString("tr-TR");
      preview.textContent = steps > 0 ? `${baseFmt} \u2192 ${effFmt} (+${steps})` : `${baseFmt} (+0)`;
      if (document.activeElement !== minInput) {
        minInput.value = String(getSeconds());
      }
      if (document.activeElement !== maxInput) {
        maxInput.value = String(player.escalation.maxSteps || 3);
      }
      if (typeof updateEffectiveLabel === "function") {
        updateEffectiveLabel();
      }
    };
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasEnabled = Boolean(player.escalation?.enabled);
      player.escalation.enabled = !wasEnabled;
      if (!player.escalation.enabled) {
        if (player.escalation.steps > 0 || player.escalation.activeMs > 0) {
          resetEscalationOnManualChange(player);
          addMarketLog({
            text: `\u23F9\uFE0F [Fiyat Artt\u0131rma] ${player.name}: Otomatik artt\u0131rma kapat\u0131ld\u0131, basamaklar taban fiyata s\u0131f\u0131rland\u0131.`,
            type: "info"
          });
        }
      } else {
        const durText = getSeconds() + " sn";
        addMarketLog({
          text: `\u25B6\uFE0F [Fiyat Artt\u0131rma] ${player.name}: Otomatik artt\u0131rma a\xE7\u0131ld\u0131 (${durText}, maks ${player.escalation.maxSteps} basamak).`,
          type: "info"
        });
      }
      saveTargets();
      render();
      if (typeof onUpdate === "function") onUpdate();
    });
    minMinus.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = getSeconds();
      const nextVal = Math.max(120, cur - 5);
      player.escalation.afterSeconds = nextVal;
      player.escalation.afterMinutes = nextVal / 60;
      minInput.value = String(nextVal);
      errorEl.hidden = true;
      minInput.classList.remove("is-invalid");
      saveTargets();
    });
    minPlus.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = getSeconds();
      const nextVal = cur + 5;
      player.escalation.afterSeconds = nextVal;
      player.escalation.afterMinutes = nextVal / 60;
      minInput.value = String(nextVal);
      errorEl.hidden = true;
      minInput.classList.remove("is-invalid");
      saveTargets();
    });
    maxMinus.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = Math.max(1, Math.min(10, Math.floor(Number(player.escalation.maxSteps) || 3)));
      const nextVal = Math.max(1, cur - 1);
      player.escalation.maxSteps = nextVal;
      maxInput.value = String(nextVal);
      errorEl.hidden = true;
      maxInput.classList.remove("is-invalid");
      saveTargets();
      render();
    });
    maxPlus.addEventListener("click", (e) => {
      e.stopPropagation();
      const cur = Math.max(1, Math.min(10, Math.floor(Number(player.escalation.maxSteps) || 3)));
      const nextVal = Math.min(10, cur + 1);
      player.escalation.maxSteps = nextVal;
      maxInput.value = String(nextVal);
      errorEl.hidden = true;
      maxInput.classList.remove("is-invalid");
      saveTargets();
      render();
    });
    const validateAndCommitSeconds = (forceRevert = false) => {
      const val = Number(minInput.value.trim());
      if (!Number.isFinite(val) || !Number.isInteger(val) || val < 120) {
        errorEl.textContent = "S\xFCre en d\xFC\u015F\xFCk 120 saniye olmal\u0131d\u0131r.";
        errorEl.hidden = false;
        minInput.classList.add("is-invalid");
        if (forceRevert) {
          const safe = Math.max(120, Math.floor(val) || 120);
          player.escalation.afterSeconds = safe;
          player.escalation.afterMinutes = safe / 60;
          minInput.value = String(safe);
          minInput.classList.remove("is-invalid");
          errorEl.hidden = true;
          saveTargets();
        }
        return false;
      }
      errorEl.hidden = true;
      minInput.classList.remove("is-invalid");
      player.escalation.afterSeconds = val;
      player.escalation.afterMinutes = val / 60;
      saveTargets();
      return true;
    };
    const validateAndCommitMaxSteps = (forceRevert = false) => {
      const val = Number(maxInput.value.trim());
      if (!Number.isFinite(val) || !Number.isInteger(val) || val < 1 || val > 10) {
        errorEl.textContent = "En fazla basamak 1 ile 10 aras\u0131nda olmal\u0131d\u0131r.";
        errorEl.hidden = false;
        maxInput.classList.add("is-invalid");
        if (forceRevert) {
          const safe = Math.max(1, Math.min(10, Math.floor(val) || 3));
          player.escalation.maxSteps = safe;
          maxInput.value = String(safe);
          maxInput.classList.remove("is-invalid");
          errorEl.hidden = true;
          saveTargets();
          render();
        }
        return false;
      }
      errorEl.hidden = true;
      maxInput.classList.remove("is-invalid");
      player.escalation.maxSteps = val;
      saveTargets();
      render();
      return true;
    };
    minInput.addEventListener("input", () => validateAndCommitSeconds(false));
    minInput.addEventListener("change", () => validateAndCommitSeconds(true));
    minInput.addEventListener("blur", () => validateAndCommitSeconds(true));
    maxInput.addEventListener("input", () => validateAndCommitMaxSteps(false));
    maxInput.addEventListener("change", () => validateAndCommitMaxSteps(true));
    maxInput.addEventListener("blur", () => validateAndCommitMaxSteps(true));
    render();
    return { topGroup, bottomLeft: badgesWrap, badgesWrap, popover, refresh: render };
  }
  function renderTargetContent(content) {
    activeHoldRepeatStops.forEach((stop) => {
      try {
        stop();
      } catch (_) {
      }
    });
    activeHoldRepeatStops.clear();
    const existingList = content.querySelector(".fr-target-list");
    const previousScrollTop = existingList ? existingList.scrollTop : 0;
    if (lastUpdateInterval) {
      clearInterval(lastUpdateInterval);
      lastUpdateInterval = null;
    }
    const previousStatus = content.querySelector(".fr-target-status");
    content.innerHTML = '<div class="fr-target-view"><div class="fr-target-status" aria-live="polite"></div><div class="fr-target-list" role="list"></div><div class="fr-target-actions"><button class="fr-target-action fr-target-save" type="button" data-filter-mode="save">Kaydet</button><button class="fr-target-action fr-target-load" type="button" data-filter-mode="load">Y\xFCkle</button></div></div>';
    const status = content.querySelector(".fr-target-status");
    if (previousStatus) status.replaceWith(previousStatus);
    updateTargetStatus(previousStatus || status, state.targetStatus, state.targetLoading);
    const targetView = content.querySelector(".fr-target-view");
    const list = content.querySelector(".fr-target-list");
    if (!isHydrating && state.targets.some((t) => !t.hydrationAttempted && (!t.playerImageUrl || !t.promoImageUrl || !t.stats || !t.clubImageUrl || !t.playstylesPlus || !t.playstylesPlus.length))) {
      isHydrating = true;
      hydrateTargetsWithFutbin().then(() => {
        isHydrating = false;
        renderTargetContent(content);
      }).catch(() => {
        isHydrating = false;
      });
    }
    const searchBox = document.createElement("div");
    searchBox.className = "fr-target-search-box";
    const searchRow = document.createElement("div");
    searchRow.className = "fr-target-search-row";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "fr-target-search-input";
    searchInput.placeholder = "Oyuncu Ara (FutBIN)...";
    searchInput.setAttribute("aria-label", "Oyuncu Ara (FutBIN)");
    const updatePricesBtn = document.createElement("button");
    updatePricesBtn.type = "button";
    updatePricesBtn.className = "fr-target-update-prices-btn";
    updatePricesBtn.textContent = "G\xFCncelle \u{1F4B0}";
    updatePricesBtn.setAttribute("title", "T\xFCm hedef oyuncular\u0131n FutBIN fiyatlar\u0131n\u0131 g\xFCncelle");
    updatePricesBtn.addEventListener("click", async () => {
      if (isUpdatingPrices) return;
      if (!state.targets.length) {
        setTargetStatus({ type: "info", message: "G\xFCncellenecek hedef oyuncu bulunmuyor." });
        return;
      }
      isUpdatingPrices = true;
      updatePricesBtn.classList.add("is-updating");
      updatePricesBtn.textContent = "\u23F3 G\xFCncelleniyor...";
      setTargetStatus({ type: "loading", message: "Fiyatlar FutBIN \xFCzerinden g\xFCncelleniyor..." });
      let updatedCount = 0;
      try {
        const discountRate = typeof CONFIG.targetAdd?.discountRate === "number" && Number.isFinite(CONFIG.targetAdd.discountRate) && CONFIG.targetAdd.discountRate >= 0 && CONFIG.targetAdd.discountRate < 1 ? CONFIG.targetAdd.discountRate : 0.1;
        for (let i = 0; i < state.targets.length; i++) {
          const target = state.targets[i];
          setTargetStatus({
            type: "loading",
            message: `Fiyatlar FutBIN'den al\u0131n\u0131yor (${i + 1}/${state.targets.length}): ${target.name}...`
          });
          const versions = await searchPlayerAllVersions(target.name, { bypassCache: true });
          if (Array.isArray(versions) && versions.length) {
            let matched = target.futbinId ? versions.find((v) => String(v.futbinId) === String(target.futbinId)) : null;
            if (!matched && target.eaId) {
              matched = versions.find((v) => Number(v.eaId) === Number(target.eaId));
            }
            if (!matched && target.rating) {
              matched = versions.find(
                (v) => Number(v.rating) === Number(target.rating) && (target.raretype != null && v.raretype === target.raretype || target.versionLabel && v.versionLabel === target.versionLabel || Boolean(v.isHolo) === Boolean(target.isHolo))
              );
            }
            if (!matched && (target.versionLabel || target.isHolo)) {
              matched = versions.find(
                (v) => target.versionLabel && v.versionLabel === target.versionLabel || target.isHolo && v.isHolo
              );
            }
            const isStandardTarget = !target.isHolo && (!target.versionLabel || ["Gold", "Silver", "Bronze", "Base"].includes(target.versionLabel));
            if (!matched && isStandardTarget && target.rating) {
              matched = versions.find((v) => Number(v.rating) === Number(target.rating) && !v.isHolo);
            }
            if (!matched && !isStandardTarget) {
              matched = versions.find((v) => v.isHolo || v.versionLabel && !["Gold", "Silver", "Bronze", "Base"].includes(v.versionLabel));
            }
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
                target.priceTrend = oldPrice > 0 ? futbinPrice > oldPrice ? "up" : futbinPrice < oldPrice ? "down" : "same" : "same";
                target.priceHistory = Array.isArray(target.priceHistory) ? target.priceHistory : [];
                if (oldPrice > 0 && target.priceHistory.length === 0) {
                  target.priceHistory.push({ price: oldPrice, at: target.priceUpdatedAt - 1e3 });
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
        setTargetStatus({ type: "success", message: `${updatedCount} oyuncunun fiyat\u0131 ve SATIN AL hedefleri k\xE2r marj\u0131na g\xF6re g\xFCncellendi.` });
      } catch (err) {
        setTargetStatus({ type: "error", message: "Fiyat g\xFCncelleme s\u0131ras\u0131nda hata olu\u015Ftu." });
      } finally {
        isUpdatingPrices = false;
        updatePricesBtn.classList.remove("is-updating");
        renderTargetContent(content);
      }
    });
    searchRow.append(searchInput, updatePricesBtn);
    const searchResults = document.createElement("div");
    searchResults.className = "fr-target-search-results";
    searchResults.hidden = true;
    searchBox.append(searchRow, searchResults);
    let searchTimer = null;
    searchInput.addEventListener("input", () => {
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
            const emptyItem = document.createElement("div");
            emptyItem.className = "fr-search-item-empty";
            emptyItem.textContent = "Sonu\xE7 bulunamad\u0131.";
            searchResults.appendChild(emptyItem);
          } else {
            players.forEach((player) => {
              const item = document.createElement("div");
              item.className = "fr-search-result-item fr-search-player-item";
              item.setAttribute("role", "button");
              item.setAttribute("tabindex", "0");
              const nameEl = document.createElement("div");
              nameEl.className = "fr-search-item-name";
              nameEl.textContent = player.name;
              const ratingBadge = document.createElement("span");
              ratingBadge.className = "fr-search-player-rating-badge";
              ratingBadge.textContent = String(player.baseRating || player.highestRating || "");
              item.append(nameEl, ratingBadge);
              item.addEventListener("click", () => {
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
      const bal = state.currentBalance !== void 0 ? state.currentBalance : getBalance();
      const balText = bal === null ? '<span style="color: #f59e0b;">Okunam\u0131yor</span>' : `${Number(bal).toLocaleString("tr-TR")}`;
      summaryBar.innerHTML = `
      <span class="fr-summary-item">Hedef: <strong class="fr-summary-val">${totalTargetCards}</strong></span>
      <span class="fr-summary-item">Gereken: <strong class="fr-summary-val">${totalCoinsNeeded.toLocaleString("tr-TR")}</strong></span>
      <span class="fr-summary-item">Tahmini K\xE2r: <strong class="fr-summary-val fr-summary-profit">${totalEstProfit > 0 ? "+" : ""}${totalEstProfit.toLocaleString("tr-TR")}</strong></span>
      <span class="fr-summary-item fr-summary-balance">Bakiye: <strong class="fr-summary-balance-val">${balText}</strong></span>
    `;
    };
    if (state.targets.length > 0) {
      summaryBar = document.createElement("div");
      summaryBar.className = "fr-target-summary-bar";
      updateSummaryBar();
      targetView.insertBefore(summaryBar, list);
    }
    if (state.pendingCandidates && Array.isArray(state.pendingCandidates.candidates)) {
      const selector = document.createElement("div");
      selector.className = "fr-candidate-selector";
      const header = document.createElement("div");
      header.className = "fr-candidate-header";
      const headerTitle = document.createElement("span");
      headerTitle.textContent = state.pendingCandidates.name + " S\xFCr\xFCm\xFCn\xFC Se\xE7in:";
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "fr-candidate-cancel";
      cancelBtn.textContent = "\xD7";
      cancelBtn.setAttribute("aria-label", "Se\xE7imi iptal et");
      cancelBtn.addEventListener("click", () => {
        state.pendingCandidates = null;
        setTargetStatus({ type: "info", message: "Kart se\xE7imi iptal edildi." });
        emit("targets:changed");
      });
      header.append(headerTitle, cancelBtn);
      selector.appendChild(header);
      const candidateList = document.createElement("div");
      candidateList.className = "fr-candidate-list";
      state.pendingCandidates.candidates.forEach((candidate) => {
        const card = document.createElement("div");
        card.className = "fr-candidate-card";
        if (candidate.promoImageUrl || candidate.playerImageUrl) {
          const cardPreview = createEaCardElement(candidate, { size: "thumb" });
          card.appendChild(cardPreview);
        }
        const body = document.createElement("div");
        body.className = "fr-candidate-body";
        const title = document.createElement("div");
        title.className = "fr-candidate-title";
        const name = document.createElement("span");
        name.className = "fr-candidate-name";
        name.textContent = candidate.name;
        const rating = document.createElement("span");
        rating.className = "fr-candidate-rating";
        rating.textContent = String(candidate.rating || "\u2014");
        title.append(name, rating);
        const badge = document.createElement("div");
        badge.className = "fr-candidate-badge" + (candidate.isHolo ? " fr-candidate-badge-holo" : "");
        badge.textContent = candidate.versionLabel || "\xD6zel";
        const meta = document.createElement("div");
        meta.className = "fr-candidate-meta";
        const leagueText = candidate.leagueName ? " \xB7 " + candidate.leagueName : "";
        meta.textContent = "FutBIN " + candidate.futbinId + " \xB7 resource " + candidate.eaId + leagueText;
        const priceEl = document.createElement("div");
        priceEl.className = "fr-candidate-price";
        const candidatePriceVal = Number(candidate.price) || 0;
        priceEl.textContent = candidatePriceVal > 0 ? `${getPlatform().toUpperCase()} fiyat: ${candidatePriceVal.toLocaleString("tr-TR")}` : candidate.raw ? formatFutbinRowPrice(candidate.raw, getPlatform()) : "Fiyat yok";
        const selectBtn = document.createElement("button");
        selectBtn.type = "button";
        selectBtn.className = "fr-candidate-btn";
        selectBtn.textContent = "Bu kart\u0131 ekle";
        selectBtn.addEventListener("click", async () => {
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
            } catch (_) {
            }
          }
          commitCandidateTarget(candidate);
          renderTargetContent(content);
        });
        body.append(title, badge, meta, priceEl, selectBtn);
        card.appendChild(body);
        candidateList.appendChild(card);
      });
      selector.appendChild(candidateList);
      content.querySelector(".fr-target-view").insertBefore(selector, list);
    }
    if (!state.targets.length) {
      const empty = document.createElement("div");
      empty.className = "fr-target-empty";
      empty.textContent = "Hen\xFCz oyuncu hedefi yok.";
      list.appendChild(empty);
    }
    state.targets.forEach((player, index) => {
      if (!player.priceUpdatedAt) {
        player.priceUpdatedAt = Date.now();
      }
      const isPriceExceeded = isExceedingFutbin(player.buyNow, player.price);
      const isSearchActive = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !isPriceExceeded);
      const card = document.createElement("div");
      card.className = "fr-target-card" + (isSearchActive ? "" : " is-search-inactive") + (player.insufficientBalance ? " is-insufficient-balance" : "") + (isPriceExceeded ? " is-price-exceeded" : "");
      card.setAttribute("role", "listitem");
      if (player.playerImageUrl || player.promoImageUrl) {
        const previewCard = createEaCardElement(player, { size: "preview" });
        card.appendChild(previewCard);
      }
      const body = document.createElement("div");
      body.className = "fr-target-card-body";
      let updateEffective = () => {
      };
      const escalationControl = createEscalationControl(
        player,
        () => updateSummaryBar(),
        () => updateEffective()
      );
      card.dataset.targetId = String(player.id || player.name + ":" + player.rating);
      card._refreshEscalation = () => {
        escalationControl?.refresh();
        updateEffective();
      };
      const topBar = document.createElement("div");
      topBar.className = "fr-target-card-top";
      const topLeft = document.createElement("div");
      topLeft.className = "fr-target-top-left";
      const searchToggle = document.createElement("button");
      searchToggle.type = "button";
      const toggleActive = !player.searchDisabled;
      searchToggle.className = "fr-target-search-toggle " + (toggleActive ? "is-active" : "is-inactive");
      searchToggle.innerHTML = `Arama: <span class="fr-search-toggle-status">${toggleActive ? "A\xE7\u0131k" : "Kapal\u0131"}</span>`;
      searchToggle.setAttribute("title", "Aramay\u0131 A\xE7/Kapat");
      searchToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        player.searchDisabled = !player.searchDisabled;
        saveTargets();
        const active = !player.searchDisabled;
        searchToggle.className = "fr-target-search-toggle " + (active ? "is-active" : "is-inactive");
        searchToggle.innerHTML = `Arama: <span class="fr-search-toggle-status">${active ? "A\xE7\u0131k" : "Kapal\u0131"}</span>`;
        const priceExceeded = isExceedingFutbin(player.buyNow, player.price);
        card.classList.toggle("is-price-exceeded", priceExceeded);
        const isStillActive = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !priceExceeded);
        card.classList.toggle("is-search-inactive", !isStillActive);
      });
      topLeft.append(searchToggle, escalationControl.topGroup);
      const topRight = document.createElement("div");
      topRight.className = "fr-target-top-right";
      if (player.insufficientBalance) {
        const insufficientBadge = document.createElement("span");
        insufficientBadge.className = "fr-target-badge-insufficient";
        insufficientBadge.textContent = "Bakiye Yetersiz";
        insufficientBadge.title = "Maksimum al\u0131\u015F fiyat\u0131 bakiyeden y\xFCksek oldu\u011Fu i\xE7in arama atlan\u0131yor";
        topRight.appendChild(insufficientBadge);
      }
      const lastUpdate = document.createElement("span");
      lastUpdate.className = "fr-target-last-update";
      lastUpdate.dataset.updatedAt = String(player.priceUpdatedAt || 0);
      lastUpdate.textContent = formatRelativeTime(player.priceUpdatedAt);
      if (player.priceUpdatedAt) {
        lastUpdate.setAttribute("title", new Date(player.priceUpdatedAt).toLocaleString("tr-TR"));
      }
      const remove = document.createElement("button");
      remove.className = "fr-target-remove";
      remove.type = "button";
      remove.textContent = "\xD7";
      remove.setAttribute("aria-label", player.name + " hedefini sil");
      remove.addEventListener("click", () => {
        const [deletedPlayer] = state.targets.splice(index, 1);
        saveTargets();
        emit("targets:changed");
        updateSummaryBar();
        addMarketLog({
          text: `${deletedPlayer.name} hedeflerden silindi.`
        });
      });
      topRight.append(lastUpdate, remove);
      topBar.append(topLeft, topRight);
      body.appendChild(topBar);
      const head = document.createElement("div");
      head.className = "fr-target-card-head";
      const info2 = document.createElement("div");
      info2.className = "fr-target-info";
      const name = document.createElement("div");
      name.className = "fr-target-name";
      name.textContent = player.name;
      const metaLine = document.createElement("div");
      metaLine.className = "fr-target-meta-line";
      const rating = document.createElement("span");
      rating.className = "fr-target-rating";
      rating.textContent = player.rating ? String(player.rating) : "\u2014";
      metaLine.appendChild(rating);
      const effectiveVersion = player.versionLabel || (player.rating >= 75 ? "Gold" : player.rating >= 65 ? "Silver" : player.rating > 0 ? "Bronze" : "Base");
      const badge = document.createElement("span");
      badge.className = "fr-target-version-badge";
      badge.textContent = effectiveVersion;
      metaLine.appendChild(badge);
      info2.append(name, metaLine);
      head.appendChild(info2);
      body.appendChild(head);
      const controls = document.createElement("div");
      controls.className = "fr-target-controls";
      [
        { key: "searches", label: "TUR SAYISI", step: 1, min: 1 },
        { key: "buyNow", label: "SATIN AL", step: 100, min: MIN_PRICE }
      ].forEach((control) => {
        const group = document.createElement("div");
        const title = document.createElement("div");
        title.className = "fr-target-control-title";
        title.textContent = control.label;
        let updateProfit = () => {
        };
        if (control.key === "searches") {
          const effectiveEl = document.createElement("div");
          effectiveEl.className = "fr-target-effective-lbl";
          updateEffective = () => {
            const effCalc = computeEffectiveBuyNow(player, {
              maxPriceCapThreshold: state.snipeSettings?.maxPriceCapThreshold
            });
            const isEnabled2 = Boolean(player.escalation?.enabled);
            const steps = Math.max(0, Math.floor(Number(player.escalation?.steps) || 0));
            if (isEnabled2) {
              const baseFmt = Number(player.buyNow).toLocaleString("tr-TR");
              const effFmt = Number(effCalc.effectiveBuyNow).toLocaleString("tr-TR");
              effectiveEl.textContent = steps > 0 ? `${baseFmt} \u2192 ${effFmt} (+${steps})` : `Efektif: ${baseFmt}`;
              effectiveEl.title = `Efektif Sat\u0131n Al: ${effFmt} coin (${steps} basamak artt\u0131r\u0131ld\u0131)`;
            } else {
              effectiveEl.textContent = "";
              effectiveEl.title = "";
            }
          };
          updateEffective();
          group.append(effectiveEl, title);
        } else if (control.key === "buyNow") {
          const profitEl = document.createElement("div");
          profitEl.className = "fr-target-profit";
          updateProfit = (val) => {
            const futbinPrice = Number(player.price) || 0;
            const currentBuyNow = Number(val ?? player.buyNow) || 0;
            if (futbinPrice > 0) {
              const netProfit = Math.round(futbinPrice * 0.95) - currentBuyNow;
              const sign = netProfit > 0 ? "+" : "";
              profitEl.textContent = `K\xE2r: ${sign}${netProfit.toLocaleString("tr-TR")}`;
              profitEl.className = "fr-target-profit " + (netProfit >= 0 ? "is-profit" : "is-loss");
            } else {
              profitEl.textContent = "K\xE2r: \u2014";
              profitEl.className = "fr-target-profit";
            }
          };
          updateProfit(player.buyNow);
          group.append(profitEl, title);
        } else {
          group.appendChild(title);
        }
        const counter = document.createElement("div");
        counter.className = "fr-target-counter fr-target-counter-editable";
        const LOWEST_BTN_DEFAULT_TEXT = "\u{1F50E} En D\xFC\u015F\xFCk";
        const LOWEST_BTN_RESET_MS = 1e4;
        let lowestBtn = null;
        let lowestSearching = false;
        let lowestResetTimer = null;
        const clearLowestResetTimer = () => {
          if (lowestResetTimer !== null) {
            clearTimeout(lowestResetTimer);
            lowestResetTimer = null;
          }
        };
        const resetLowestBtnText = () => {
          clearLowestResetTimer();
          if (!lowestBtn || lowestSearching) return;
          lowestBtn.textContent = LOWEST_BTN_DEFAULT_TEXT;
        };
        const unbindLowestBtn = () => {
          clearLowestResetTimer();
          if (lowestBtn && lowestBtn.parentNode === counter) {
            counter.removeEventListener("detach", unbindLowestBtn);
          }
        };
        counter.addEventListener("detach", unbindLowestBtn);
        const setLowestBusy = (busy) => {
          lowestSearching = busy;
          if (!lowestBtn) return;
          if (busy) clearLowestResetTimer();
          lowestBtn.disabled = busy;
          if (busy) lowestBtn.textContent = "Aran\u0131yor...";
          lowestBtn.title = busy ? "EA Transfer Market taran\u0131yor..." : "En D\xFC\u015F\xFCk Hemen Al fiyat\u0131n\u0131 bul (fiyat yaln\u0131zca butonda g\xF6sterilir, SATIN AL kutusuna yaz\u0131lmaz)";
        };
        if (control.key === "buyNow") {
          counter.classList.add("fr-target-counter-has-lowest");
          lowestBtn = document.createElement("button");
          lowestBtn.type = "button";
          lowestBtn.className = "fr-target-lowest-btn";
          setLowestBusy(false);
          lowestBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (lowestSearching || state.botRunning || safetyGovernor?.isCaptchaHalted?.()) {
              setTargetStatus({ type: "error", message: "Bot \xE7al\u0131\u015F\u0131rken veya CAPTCHA kilidi varken fiyat aramas\u0131 ba\u015Flat\u0131lamaz." });
              return;
            }
            const eaId = Number(player.eaId) > 0 ? Number(player.eaId) & 16777215 : 0;
            if (!eaId) {
              setTargetStatus({ type: "error", message: `${player.name}: EA kart kimli\u011Fi (eaId) bulunamad\u0131; arama yap\u0131lam\u0131yor.` });
              return;
            }
            setLowestBusy(true);
            try {
              const result = await getMarketPrice((maxBuy) => fetchMarketPage(eaId, maxBuy), {
                eaId,
                rating: player.rating,
                reference: Number(player.price) || 0,
                maxSearches: CONFIG.targetAdd?.maxSearches ?? 5,
                gapMs: [300, 700],
                // soft-ban korumasi: iki arama arasi rastgele jitter
                outlierRatio: CONFIG.targetAdd?.outlierRatio ?? 0.9
              });
              if (result.none || !result.ok && !result.price && !result.lowest) {
                setTargetStatus({ type: "error", message: `Markette kart bulunamad\u0131 (Extinct): ${player.name}` });
                return;
              }
              if (!result.ok) {
                const errorMsg = String(result.error?.message || result.error || "EA aramas\u0131 ba\u015Far\u0131s\u0131z");
                const rateLimited = /429|rate.?limit|too many/i.test(errorMsg);
                setTargetStatus({
                  type: "error",
                  message: rateLimited ? `Fiyat aramas\u0131 h\u0131z s\u0131n\u0131r\u0131na tak\u0131ld\u0131 (429): ${player.name}. Biraz sonra tekrar deneyin.` : `Fiyat aramas\u0131 ba\u015Far\u0131s\u0131z (${player.name}): ${errorMsg}`
                });
                return;
              }
              const found = Number(result.price || result.lowest) || 0;
              if (!(found > 0)) {
                setTargetStatus({ type: "error", message: `Markette kart bulunamad\u0131 (Extinct): ${player.name}` });
                return;
              }
              const shown = found.toLocaleString("tr-TR");
              lowestBtn.textContent = `\u{1F50E} ${shown}`;
              lowestBtn.title = `En d\xFC\u015F\xFCk BIN: ${shown} coin \u2014 10 sn i\xE7inde buton eski metnine d\xF6ner (SATIN AL kutusu de\u011Fi\u015Ftirilmedi).`;
              clearLowestResetTimer();
              lowestResetTimer = setTimeout(() => {
                lowestResetTimer = null;
                resetLowestBtnText();
              }, LOWEST_BTN_RESET_MS);
            } catch (err) {
              setTargetStatus({ type: "error", message: `Fiyat aramas\u0131 hatas\u0131 (${player.name}): ${String(err?.message || err)}` });
            } finally {
              setLowestBusy(false);
            }
          });
        }
        const minus = document.createElement("button");
        minus.type = "button";
        minus.textContent = "\u2212";
        minus.setAttribute("aria-label", control.label + " azalt");
        const formatVal = (k, v) => k === "buyNow" ? Number(v).toLocaleString("tr-TR") : String(v);
        const parseVal = (k, s) => {
          if (k === "buyNow") {
            const clean = String(s || "").replace(/[.\s]/g, "").replace(/,/g, ".");
            return clean === "" ? NaN : Number(clean);
          }
          return s === "" ? NaN : Number(s);
        };
        const value = document.createElement("input");
        value.className = "fr-target-counter-input";
        value.type = "text";
        value.inputMode = "numeric";
        value.setAttribute("aria-label", control.label + " de\u011Feri");
        value.value = formatVal(control.key, player[control.key]);
        const plus = document.createElement("button");
        plus.type = "button";
        plus.textContent = "+";
        plus.setAttribute("aria-label", control.label + " art\u0131r");
        const change = (direction, multiplier = 1) => {
          const current = Number(player[control.key]);
          if (control.key === "buyNow") {
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
                text: `\u{1F504} [Fiyat Artt\u0131rma] ${player.name}: SATIN AL elle de\u011Fi\u015Ftirildi, artt\u0131rma basamaklar\u0131 s\u0131f\u0131rland\u0131.`,
                type: "info"
              });
            }
          } else {
            const step = control.step * multiplier;
            player[control.key] = Math.max(control.min, current + direction * step);
          }
          saveTargets();
          value.value = formatVal(control.key, player[control.key]);
          if (control.key === "buyNow") {
            updateProfit(player.buyNow);
            escalationControl?.refresh();
            const priceExceeded = isExceedingFutbin(player.buyNow, player.price);
            card.classList.toggle("is-price-exceeded", priceExceeded);
            const active = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !priceExceeded);
            card.classList.toggle("is-search-inactive", !active);
          }
          updateSummaryBar();
        };
        value.addEventListener("keydown", (e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            change(1, e.shiftKey ? 10 : 1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            change(-1, e.shiftKey ? 10 : 1);
          }
        });
        value.addEventListener("input", () => {
          const entered = parseVal(control.key, value.value);
          if (Number.isSafeInteger(entered) && entered >= control.min) {
            player[control.key] = entered;
            saveTargets();
            if (control.key === "buyNow") {
              if (player.escalation && (player.escalation.steps > 0 || player.escalation.activeMs > 0)) {
                resetEscalationOnManualChange(player);
                addMarketLog({
                  text: `\u{1F504} [Fiyat Artt\u0131rma] ${player.name}: SATIN AL elle de\u011Fi\u015Ftirildi, artt\u0131rma basamaklar\u0131 s\u0131f\u0131rland\u0131.`,
                  type: "info"
                });
              }
              updateProfit(entered);
              escalationControl?.refresh();
              const priceExceeded = isExceedingFutbin(entered, player.price);
              card.classList.toggle("is-price-exceeded", priceExceeded);
              const active = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !priceExceeded);
              card.classList.toggle("is-search-inactive", !active);
            }
            updateSummaryBar();
          }
        });
        const commitValue = () => {
          const enteredValue = parseVal(control.key, value.value);
          const completedValue = control.key === "buyNow" ? Number.isFinite(enteredValue) ? clampPrice(roundToPriceStep(enteredValue, "nearest")) : NaN : enteredValue;
          if (!Number.isSafeInteger(enteredValue) || enteredValue < control.min || completedValue < control.min) {
            value.value = formatVal(control.key, player[control.key]);
            setTargetStatus({
              type: "error",
              message: control.label + " i\xE7in " + control.min + " veya daha b\xFCy\xFCk bir tam say\u0131 girin."
            });
            return;
          }
          if (control.key === "buyNow") {
            const futbinPrice = Number(player.price) || 0;
            if (futbinPrice > 0 && completedValue > futbinPrice) {
              setTargetStatus({
                type: "error",
                message: `Maksimum Fiyat Korumas\u0131: ${player.name} SATIN AL (${completedValue.toLocaleString("tr-TR")}) FutBIN piyasa fiyat\u0131n\u0131 (${futbinPrice.toLocaleString("tr-TR")}) a\u015F\u0131yor! Tarama durdurulacakt\u0131r.`,
                holdMs: 25e3
              });
              addMarketLog({
                text: `\u{1F6E1}\uFE0F [Fiyat Korumas\u0131] ${player.name}: SATIN AL (${completedValue.toLocaleString("tr-TR")}) FutBIN piyasa de\u011Ferini (${futbinPrice.toLocaleString("tr-TR")}) a\u015F\u0131yor.`,
                type: "warn"
              });
            } else {
              const capCheck = validatePriceCap(completedValue, player.price);
              if (!capCheck.allowed) {
                setTargetStatus({
                  type: "error",
                  message: `Maksimum Fiyat Korumas\u0131: ${capCheck.reason}`,
                  holdMs: 25e3
                });
                addMarketLog({
                  text: `\u{1F6E1}\uFE0F [Fiyat Korumas\u0131] ${player.name}: ${capCheck.reason}`,
                  type: "warn"
                });
              }
            }
          }
          player[control.key] = completedValue;
          value.value = formatVal(control.key, completedValue);
          saveTargets();
          if (control.key === "buyNow") {
            if (player.escalation && (player.escalation.steps > 0 || player.escalation.activeMs > 0)) {
              resetEscalationOnManualChange(player);
              addMarketLog({
                text: `\u{1F504} [Fiyat Artt\u0131rma] ${player.name}: SATIN AL elle de\u011Fi\u015Ftirildi, artt\u0131rma basamaklar\u0131 s\u0131f\u0131rland\u0131.`,
                type: "info"
              });
            }
            updateProfit(completedValue);
            escalationControl?.refresh();
            const priceExceeded = isExceedingFutbin(completedValue, player.price);
            card.classList.toggle("is-price-exceeded", priceExceeded);
            const active = !player.searchDisabled && !player.insufficientBalance && (!state.snipeSettings?.strictMarketCap || !priceExceeded);
            card.classList.toggle("is-search-inactive", !active);
          }
          updateSummaryBar();
        };
        value.addEventListener("change", commitValue);
        value.addEventListener("blur", commitValue);
        attachHoldRepeat(minus, (e) => change(-1, e?.shiftKey ? 10 : 1));
        attachHoldRepeat(plus, (e) => change(1, e?.shiftKey ? 10 : 1));
        counter.append(minus, value, plus);
        if (lowestBtn) counter.appendChild(lowestBtn);
        group.append(counter);
        controls.appendChild(group);
      });
      body.appendChild(controls);
      const bottomBar = document.createElement("div");
      bottomBar.className = "fr-target-card-bottom";
      const futbinPriceEl = document.createElement("span");
      futbinPriceEl.className = "fr-target-futbin-price";
      const fbVal = Number(player.price) || 0;
      let trendHtml = "";
      const tooltipText = formatPriceHistoryTooltip(player);
      if (player.priceTrend === "up") {
        trendHtml = ` <span class="fr-target-trend-up" title="${tooltipText}" role="button" aria-label="Fiyat artt\u0131">\u25B2</span>`;
      } else if (player.priceTrend === "down") {
        trendHtml = ` <span class="fr-target-trend-down" title="${tooltipText}" role="button" aria-label="Fiyat d\xFC\u015Ft\xFC">\u25BC</span>`;
      } else if (player.priceTrend === "same") {
        trendHtml = ` <span class="fr-target-trend-same" title="${tooltipText}" role="button" aria-label="Fiyat de\u011Fi\u015Fmedi">\u25A0</span>`;
      }
      const iconHtml = `<img src="${FUTBIN_ICON_DATA}" class="fr-target-futbin-icon" width="12" height="12" alt="FutBIN" />`;
      futbinPriceEl.innerHTML = fbVal > 0 ? `${iconHtml} <span>${fbVal.toLocaleString("tr-TR")}</span>${trendHtml}` : `${iconHtml} <span>\u2014</span>`;
      bottomBar.append(escalationControl.badgesWrap, futbinPriceEl);
      body.appendChild(bottomBar);
      card.appendChild(escalationControl.popover);
      card.appendChild(body);
      list.appendChild(card);
    });
    if (previousScrollTop > 0) {
      list.scrollTop = previousScrollTop;
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          if (list) list.scrollTop = previousScrollTop;
        });
      }
    }
    if (state.targets.length > 0) {
      lastUpdateInterval = setInterval(() => {
        if (!content.isConnected) {
          clearInterval(lastUpdateInterval);
          lastUpdateInterval = null;
          return;
        }
        content.querySelectorAll(".fr-target-last-update").forEach((el) => {
          const ts = Number(el.dataset.updatedAt);
          if (ts) el.textContent = formatRelativeTime(ts);
        });
      }, 1e4);
    }
    content.querySelector('[data-filter-mode="save"]').addEventListener("click", () => {
      if (!state.targets.length) {
        setTargetStatus({ type: "error", message: "Kaydedilecek oyuncu hedefi bulunmuyor." });
        renderTargetContent(content);
        return;
      }
      emit("ui:open-save-dialog");
    });
    content.querySelector('[data-filter-mode="load"]').addEventListener("click", () => emit("ui:open-filter-modal", { mode: "load" }));
  }
  function updateTargetEscalationDisplay(target) {
    if (!target) return;
    const targetId = String(target.id || target.name + ":" + target.rating);
    const card = document.querySelector(`.fr-target-card[data-target-id="${targetId}"]`);
    if (card && typeof card._refreshEscalation === "function") {
      card._refreshEscalation();
    }
  }

  // src/ui/panel/tabs/settingsTab.js
  function renderPanelSettings(content) {
    const s = state.snipeSettings;
    if (!s.speedDelays || typeof s.speedDelays !== "object") {
      s.speedDelays = { 0: 5, 1: 4, 2: 2.5, 3: 1.5 };
    }
    const activeSpeedId = Number.isInteger(s.speed) && s.speed >= 0 && s.speed <= 3 ? s.speed : 1;
    const waitRange = Array.isArray(s.waitSeconds) && s.waitSeconds.length === 2 ? s.waitSeconds : [15, 35];
    const waitDisplay = waitRange[0] === waitRange[1] ? waitRange[0] + " sn" : waitRange[0] + " - " + waitRange[1] + " sn";
    const hourlyVal = s.hourlySearchLimit !== void 0 && s.hourlySearchLimit !== "" && s.hourlySearchLimit !== 1200 ? s.hourlySearchLimit : "";
    const dailyVal = s.dailySearchLimit !== void 0 && s.dailySearchLimit !== "" && s.dailySearchLimit !== 6e3 ? s.dailySearchLimit : "";
    const hourlyDisplay = s.hourlySearchLimit === 0 ? "Limitsiz" : s.hourlySearchLimit || 1200;
    const dailyDisplay = s.dailySearchLimit === 0 ? "Limitsiz" : s.dailySearchLimit || 6e3;
    const speedCardsHtml = '<div class="speed-tier-grid">' + SPEED_TIERS.map((tier) => {
      const isActive = tier.id === activeSpeedId;
      const currentSec = typeof s.speedDelays[tier.id] === "number" ? clampTierSeconds(s.speedDelays[tier.id]) : tier.defaultSec;
      const warnHtml = tier.isWarning ? '<span class="speed-tier-warn-icon" aria-hidden="true">\u26A0 </span>' : "";
      const riskNoteHtml = tier.riskNote ? '<div class="speed-tier-risk-note">' + tier.riskNote + "</div>" : "";
      const isMin = currentSec <= SPEED_LIMITS.MIN_SEC + 1e-3;
      const isMax = currentSec >= SPEED_LIMITS.MAX_SEC - 1e-3;
      return '<div class="speed-tier-card' + (isActive ? " is-active" : "") + '" data-tier-id="' + tier.id + '" style="--tier-color: ' + tier.color + ';" role="button" tabindex="0" aria-pressed="' + isActive + '" aria-label="' + tier.name + ' arama h\u0131z\u0131 kademesi"><div class="speed-tier-top-stripe"></div><div class="speed-tier-card-header"><div class="speed-tier-name-row"><span class="speed-tier-name">' + warnHtml + tier.name + '</span><button type="button" class="speed-tier-reset-btn" data-tier-reset="' + tier.id + '" title="Varsay\u0131lana d\xF6nd\xFCr (' + formatTierSeconds(tier.defaultSec) + ' sn)" aria-label="' + tier.name + ' varsay\u0131lana d\xF6nd\xFCr">\u21BA</button></div><div class="speed-tier-default-hint">Varsay\u0131lan: ' + formatTierSeconds(tier.defaultSec) + " sn</div>" + riskNoteHtml + '</div><div class="speed-tier-counter" data-tier-counter="' + tier.id + '"><button type="button" class="speed-tier-step-btn speed-tier-minus" data-step="-0.2" aria-label="' + tier.name + ' s\xFCresini 0.2 sn azalt"' + (isMin ? " disabled" : "") + '>\u2212</button><span class="speed-tier-value" data-tier-val="' + tier.id + '">' + formatTierSeconds(currentSec) + ' sn</span><button type="button" class="speed-tier-step-btn speed-tier-plus" data-step="0.2" aria-label="' + tier.name + ' s\xFCresini 0.2 sn art\u0131r"' + (isMax ? " disabled" : "") + ">+</button></div></div>";
    }).join("") + "</div>";
    content.innerHTML = '<div class="fr-settings-view"><div class="fr-setting-row" title="Hedef listesindeki oyuncular\u0131n s\u0131rayla aramas\u0131n\u0131n ba\u015Ftan sona ka\xE7 tur tekrarlanaca\u011F\u0131n\u0131 belirler. 0 se\xE7ilirse durdurulana kadar sonsuz d\xF6ng\xFCde \xE7al\u0131\u015F\u0131r."><div class="fr-setting-head"><span>Oyuncu Listesi Tekrar\u0131</span><span class="fr-setting-value" data-value="repeat">' + s.repeat + '</span></div><input class="fr-range" data-setting="repeat" type="range" min="0" max="50" step="1" value="' + s.repeat + '" aria-label="Oyuncu listesi ka\xE7 kez tekrarlanacak"></div><div class="fr-setting-row" title="Hedef listesindeki t\xFCm oyuncular\u0131n bir tur aramas\u0131 tamamland\u0131ktan sonra botun yeni tura ge\xE7meden \xF6nce bekleyece\u011Fi rastgele s\xFCre aral\u0131\u011F\u0131 (saniye)."><div class="fr-setting-head"><span>Bekleme S\xFCresi (Arama Bitince)</span><span class="fr-setting-value" data-value="waitSeconds">' + waitDisplay + '</span></div><div class="fr-range-dual"><div class="fr-dual-field"><span>Min (sn)</span><div class="fr-counter fr-counter-compact"><button type="button" data-wait-step="-1" data-wait-idx="0" aria-label="Min bekleme azalt">\u2212</button><input class="fr-setting-input fr-counter-input" data-setting="waitSeconds.0" type="number" min="1" max="120" step="1" value="' + waitRange[0] + '" aria-label="Minimum bekleme saniyesi"><button type="button" data-wait-step="1" data-wait-idx="0" aria-label="Min bekleme art\u0131r">+</button></div></div><div class="fr-dual-field"><span>Max (sn)</span><div class="fr-counter fr-counter-compact"><button type="button" data-wait-step="-1" data-wait-idx="1" aria-label="Max bekleme azalt">\u2212</button><input class="fr-setting-input fr-counter-input" data-setting="waitSeconds.1" type="number" min="1" max="120" step="1" value="' + waitRange[1] + '" aria-label="Maksimum bekleme saniyesi"><button type="button" data-wait-step="1" data-wait-idx="1" aria-label="Max bekleme art\u0131r">+</button></div></div></div></div><div class="fr-setting-row" title="Ba\u015Far\u0131yla sat\u0131n al\u0131nan kartlar\u0131 otomatik olarak hedeflenen sat\u0131\u015F fiyat\u0131yla transfer pazar\u0131na listeler veya transfer listesine g\xF6nderir."><div class="fr-setting-head"><span>Otomatik Sat\u0131\u015F (Ald\u0131ktan Sonra)</span><button class="fr-toggle" data-toggle="autoSell" type="button" role="switch" aria-checked="' + s.autoSell + '" aria-label="Otomatik Sat\u0131\u015F"></button></div></div><div class="fr-setting-row" title="Sim\xFClasyon modu: Piyasada hedef kartlar\u0131 arar ve buldu\u011Funda sat\u0131n alma iste\u011Fi g\xF6ndermeden yaln\u0131zca g\xFCnl\xFC\u011Fe log d\xFC\u015Fer. Coin harcamadan test etmenizi sa\u011Flar."><div class="fr-setting-head"><span>Kuru \xC7al\u0131\u015Ft\u0131rma (Sat\u0131n Alma Yapma)</span><button class="fr-toggle fr-toggle--dryrun" data-toggle="dryRun" type="button" role="switch" aria-checked="' + Boolean(s.dryRun) + '" aria-label="Kuru \xC7al\u0131\u015Ft\u0131rma"></button></div></div><div class="fr-setting-row" title="Hedefte belirlenen Sat\u0131n Al fiyat\u0131 FutBIN referans piyasa de\u011Ferinden y\xFCksek oldu\u011Funda kart\u0131n aramas\u0131n\u0131 ve al\u0131m\u0131n\u0131 kesin olarak engeller ve botu durdurur."><div class="fr-setting-head"><span>Piyasa \xDCst\xFC Al\u0131m\u0131 Kesin Engelle</span><button class="fr-toggle" data-toggle="strictMarketCap" type="button" role="switch" aria-checked="' + Boolean(s.strictMarketCap) + '" aria-label="Piyasa \xDCst\xFC Al\u0131m\u0131 Kesin Engelle"></button></div></div><div class="fr-setting-row" title="Botun oturum boyunca sat\u0131n alabilece\u011Fi toplam oyuncu adedi s\u0131n\u0131r\u0131. Bu say\u0131ya ula\u015F\u0131ld\u0131\u011F\u0131nda bot otomatik olarak durur."><div class="fr-setting-head"><span>En Fazla Al\u0131nacak Oyuncu</span></div><div class="fr-counter"><button type="button" data-count="-1" aria-label="Oyuncu say\u0131s\u0131n\u0131 azalt">\u2212</button><span class="fr-counter-value" data-value="maxPlayers">' + s.maxPlayers + '</span><button type="button" data-count="1" aria-label="Oyuncu say\u0131s\u0131n\u0131 art\u0131r">+</button></div></div><div class="fr-setting-row speed-tier-setting-row" title="Piyasa aramalar\u0131 aras\u0131ndaki bekleme h\u0131z kademesi. H\u0131zl\u0131 kademeler EA rate-limit riskini art\u0131rabilir; g\xFCvenli kademeler botun daha uzun s\xFCre ban yemeden \xE7al\u0131\u015Fmas\u0131n\u0131 sa\u011Flar."><div class="fr-setting-head"><span>Arama H\u0131z\u0131</span><span class="speed-tier-active-summary" data-value="speed-summary"></span></div>' + speedCardsHtml + '</div><div class="fr-setting-row" title="Botun oturum s\xFCresince harcayabilece\u011Fi maksimum toplam coin tutar\u0131. 0 veya bo\u015F b\u0131rak\u0131l\u0131rsa limitsiz harcama yap\u0131l\u0131r; limite ula\u015F\u0131l\u0131nca bot durur."><div class="fr-setting-head"><span>Harcama Limiti (Coin)</span><span class="fr-setting-value" data-value="maxSpendCoins">' + (s.maxSpendCoins ? Number(s.maxSpendCoins).toLocaleString("tr-TR") : "Limitsiz") + '</span></div><div class="fr-counter fr-counter-editable"><button type="button" data-spend-step="-1000" aria-label="Harcama limitini 1000 azalt">\u2212</button><input class="fr-setting-input fr-counter-input" data-setting="maxSpendCoins" type="number" min="0" step="1000" placeholder="0 = limitsiz" value="' + (s.maxSpendCoins || "") + '" aria-label="Harcama limiti coin olarak"><button type="button" data-spend-step="1000" aria-label="Harcama limitini 1000 art\u0131r">+</button></div></div><div class="fr-setting-row" title="1 saat i\xE7erisinde EA sunucular\u0131na g\xF6nderilebilecek maksimum arama iste\u011Fi say\u0131s\u0131. EA softban korumas\u0131 i\xE7in 1200 \xF6nerilir. 0 girilirse limitsiz olur."><div class="fr-setting-head"><span>Saatlik Arama Limiti</span><span class="fr-setting-value" data-value="hourlySearchLimit">' + hourlyDisplay + '</span></div><input class="fr-setting-input" data-setting="hourlySearchLimit" type="number" min="0" step="50" placeholder="Varsay\u0131lan= 1200" value="' + hourlyVal + '" aria-label="Saatlik Arama Limiti"></div><div class="fr-setting-row" title="24 saatlik d\xF6ng\xFCde g\xF6nderilebilecek toplam arama iste\u011Fi tavan\u0131. EA pazar engellerinden korunmak i\xE7in varsay\u0131lan 6000 dir. 0 girilirse limitsiz olur."><div class="fr-setting-head"><span>G\xFCnl\xFCk Arama Limiti</span><span class="fr-setting-value" data-value="dailySearchLimit">' + dailyDisplay + '</span></div><input class="fr-setting-input" data-setting="dailySearchLimit" type="number" min="0" step="100" placeholder="Varsay\u0131lan=6000" value="' + dailyVal + '" aria-label="G\xFCnl\xFCk Arama Limiti"></div><div class="fr-setting-row" title="EA sunucular\u0131ndan \xFCst \xFCste gelen hata (429 rate limit, 500 sunucu hatas\u0131 vb.) say\u0131s\u0131 bu s\u0131n\u0131ra ula\u015Ft\u0131\u011F\u0131nda hesab\u0131n\u0131z\u0131 korumak i\xE7in bot aramay\u0131 durdurur."><div class="fr-setting-head"><span>Ard\u0131\u015F\u0131k Hata Limiti</span><span class="fr-setting-value" data-value="consecutiveErrorLimit">' + (s.consecutiveErrorLimit || 3) + '</span></div><input class="fr-setting-input" data-setting="consecutiveErrorLimit" type="number" min="1" max="20" step="1" value="' + (s.consecutiveErrorLimit || 3) + '" aria-label="Ard\u0131\u015F\u0131k Hata Limiti"></div><div class="fr-setting-row" title="Transfer listesinde kalan bo\u015F yer say\u0131s\u0131 bu e\u015Fi\u011Fin alt\u0131na indi\u011Finde uyar\u0131 verir veya transfer listesinin tamamen t\u0131kanmas\u0131n\u0131 \xF6nler."><div class="fr-setting-head"><span>Transfer Listesi Doluluk Uyar\u0131s\u0131</span><span class="fr-setting-value" data-value="transferListWarnThreshold">' + (s.transferListWarnThreshold ?? 5) + ' slot</span></div><input class="fr-setting-input" data-setting="transferListWarnThreshold" type="number" min="1" max="50" step="1" value="' + (s.transferListWarnThreshold ?? 5) + '" aria-label="Transfer Listesi Doluluk Uyar\u0131s\u0131"></div><div class="fr-setting-row" title="Yanl\u0131\u015Fl\u0131kla fazla s\u0131f\u0131r veya \xE7ok y\xFCksek fiyat girilmesini \xF6nler. Sat\u0131n Al fiyat\u0131 FutBIN referans de\u011Ferini bu y\xFCzdeden fazla a\u015Farsa bot al\u0131m\u0131 iptal eder ve durur."><div class="fr-setting-head"><span>A\u015F\u0131r\u0131 Fiyat Tavan Korumas\u0131 (%)</span><span class="fr-setting-value" data-value="maxPriceCapThreshold">%' + Math.round((s.maxPriceCapThreshold ?? 0.5) * 100) + '</span></div><input class="fr-setting-input" data-setting="maxPriceCapThreshold" type="number" min="10" max="500" step="5" value="' + Math.round((s.maxPriceCapThreshold ?? 0.5) * 100) + '" aria-label="A\u015F\u0131r\u0131 Fiyat Tavan Korumas\u0131"></div><button class="fr-start" type="button" data-state="' + (state.botRunning ? "running" : "idle") + '" aria-pressed="' + state.botRunning + '" aria-label="' + (state.botRunning ? "Durdur FutRUSH" : "Ba\u015Flat FutRUSH") + '"><svg class="fr-start-icon fr-start-icon-idle" viewBox="0 0 24 32" aria-hidden="true"><path d="M14 1 3 18h7l-1 13 12-19h-8z" fill="currentColor" stroke="rgba(255,255,255,.8)" stroke-width="1" stroke-linejoin="round"/></svg><svg class="fr-start-icon fr-start-icon-running" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/></svg><span class="fr-start-label" aria-hidden="true"><span class="fr-start-label-idle">Ba\u015Flat FutRUSH</span><span class="fr-start-label-running">Durdur FutRUSH</span></span></button></div>';
    const updateSpeedSummary = () => {
      const summaryEl = content.querySelector('[data-value="speed-summary"]');
      if (!summaryEl) return;
      const tier = SPEED_TIERS[s.speed] || SPEED_TIERS[1];
      const sec = s.speedDelays?.[tier.id] ?? tier.defaultSec;
      summaryEl.innerHTML = `<span style="color: ${tier.color}">\u25CF ${tier.name} (${formatTierSeconds(sec)} sn)</span>`;
    };
    updateSpeedSummary();
    const syncTierCards = () => {
      content.querySelectorAll(".speed-tier-card").forEach((card) => {
        const tierId = Number(card.dataset.tierId);
        const isActive = tierId === s.speed;
        card.classList.toggle("is-active", isActive);
        card.setAttribute("aria-pressed", String(isActive));
        const valEl = card.querySelector("[data-tier-val]");
        const currentSec = s.speedDelays?.[tierId] ?? SPEED_TIERS[tierId].defaultSec;
        if (valEl) valEl.textContent = formatTierSeconds(currentSec) + " sn";
        const minusBtn = card.querySelector(".speed-tier-minus");
        const plusBtn = card.querySelector(".speed-tier-plus");
        if (minusBtn) minusBtn.disabled = currentSec <= SPEED_LIMITS.MIN_SEC + 1e-3;
        if (plusBtn) plusBtn.disabled = currentSec >= SPEED_LIMITS.MAX_SEC - 1e-3;
      });
      updateSpeedSummary();
      emit("bot:speed-changed");
    };
    content.querySelectorAll(".speed-tier-card").forEach((card) => {
      const tierId = Number(card.dataset.tierId);
      card.addEventListener("click", () => {
        s.speed = tierId;
        saveSnipeSettings();
        syncTierCards();
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          s.speed = tierId;
          saveSnipeSettings();
          syncTierCards();
        }
      });
      const resetBtn = card.querySelector("[data-tier-reset]");
      if (resetBtn) {
        resetBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const tier = SPEED_TIERS[tierId];
          s.speedDelays[tierId] = tier.defaultSec;
          saveSnipeSettings();
          syncTierCards();
        });
      }
      card.querySelectorAll(".speed-tier-step-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
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
    content.querySelectorAll(".fr-range").forEach((input) => {
      const updateRange = () => {
        const min = Number(input.min);
        const max = Number(input.max);
        const progress = (Number(input.value) - min) / (max - min) * 100;
        input.style.setProperty("--fr-progress", progress + "%");
      };
      updateRange();
      const updateSetting = () => {
        const key = input.dataset.setting;
        s[key] = Number(input.value);
        content.querySelector('[data-value="' + key + '"]').textContent = String(s[key]);
        updateRange();
      };
      input.addEventListener("input", updateSetting);
      input.addEventListener("change", () => {
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
        const text = s.waitSeconds[0] === s.waitSeconds[1] ? s.waitSeconds[0] + " sn" : s.waitSeconds[0] + " - " + s.waitSeconds[1] + " sn";
        content.querySelector('[data-value="waitSeconds"]').textContent = text;
      };
      input.addEventListener("input", updateWait);
      input.addEventListener("change", () => {
        updateWait();
        saveSnipeSettings();
      });
    });
    content.querySelectorAll("[data-wait-step]").forEach((btn) => {
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
        const text = s.waitSeconds[0] === s.waitSeconds[1] ? s.waitSeconds[0] + " sn" : s.waitSeconds[0] + " - " + s.waitSeconds[1] + " sn";
        content.querySelector('[data-value="waitSeconds"]').textContent = text;
        saveSnipeSettings();
      });
    });
    const spendInput = content.querySelector('.fr-setting-input[data-setting="maxSpendCoins"]');
    if (spendInput) {
      const updateSpend = () => {
        const val = Math.max(0, Math.floor(Number(spendInput.value) || 0));
        s.maxSpendCoins = val;
        content.querySelector('[data-value="maxSpendCoins"]').textContent = val ? val.toLocaleString("tr-TR") : "Limitsiz";
      };
      spendInput.addEventListener("input", updateSpend);
      const commitSpend = () => {
        const raw = Math.max(0, Math.floor(Number(spendInput.value) || 0));
        const val = raw > 0 ? clampPrice(roundToPriceStep(raw, "nearest")) : 0;
        s.maxSpendCoins = val;
        spendInput.value = val > 0 ? String(val) : "";
        content.querySelector('[data-value="maxSpendCoins"]').textContent = val ? val.toLocaleString("tr-TR") : "Limitsiz";
        saveSnipeSettings();
      };
      spendInput.addEventListener("change", commitSpend);
      spendInput.addEventListener("blur", commitSpend);
      content.querySelectorAll("[data-spend-step]").forEach((btn) => {
        const step = Number(btn.dataset.spendStep) || 0;
        attachHoldRepeat(btn, () => {
          const raw = Math.max(0, Math.floor(Number(spendInput.value) || 0));
          let next = raw + step;
          if (next < 0) next = 0;
          const val = next > 0 ? clampPrice(roundToPriceStep(next, "nearest")) : 0;
          s.maxSpendCoins = val;
          spendInput.value = val > 0 ? String(val) : "";
          content.querySelector('[data-value="maxSpendCoins"]').textContent = val ? val.toLocaleString("tr-TR") : "Limitsiz";
          saveSnipeSettings();
        });
      });
    }
    content.querySelectorAll(".fr-toggle").forEach((toggle) => {
      toggle.addEventListener("click", (event) => {
        const key = toggle.dataset.toggle;
        if (key === "dryRun") {
          s.dryRun = !s.dryRun;
          event.currentTarget.setAttribute("aria-checked", String(s.dryRun));
          saveSnipeSettings();
          emit("bot:dryrun-changed");
        } else if (key === "strictMarketCap") {
          s.strictMarketCap = !s.strictMarketCap;
          event.currentTarget.setAttribute("aria-checked", String(s.strictMarketCap));
          saveSnipeSettings();
          emit("bot:strict-market-cap-changed");
        } else {
          s.autoSell = !s.autoSell;
          event.currentTarget.setAttribute("aria-checked", String(s.autoSell));
          saveSnipeSettings();
        }
      });
    });
    content.querySelectorAll("[data-count]").forEach((button) => {
      const step = Number(button.dataset.count) || 0;
      attachHoldRepeat(button, () => {
        s.maxPlayers = Math.max(1, s.maxPlayers + step);
        content.querySelector('[data-value="maxPlayers"]').textContent = String(s.maxPlayers);
        saveSnipeSettings();
      });
    });
    content.querySelector(".fr-start").addEventListener("click", () => {
      if (state.botRunning) stopAutoBuyer("Kullan\u0131c\u0131 taraf\u0131ndan durduruldu.");
      else startAutoBuyer();
    });
    ["hourlySearchLimit", "dailySearchLimit", "consecutiveErrorLimit", "transferListWarnThreshold", "maxPriceCapThreshold"].forEach((key) => {
      const inp = content.querySelector('.fr-setting-input[data-setting="' + key + '"]');
      if (!inp) return;
      const updateVal = () => {
        const raw = inp.value.trim();
        if (raw === "") {
          const def = key === "hourlySearchLimit" ? 1200 : key === "dailySearchLimit" ? 6e3 : key === "consecutiveErrorLimit" ? 3 : key === "transferListWarnThreshold" ? 5 : 0.5;
          s[key] = def;
          content.querySelector('[data-value="' + key + '"]').textContent = key === "transferListWarnThreshold" ? def + " slot" : key === "maxPriceCapThreshold" ? "%" + Math.round(def * 100) : String(def);
        } else {
          const parsed = Number(raw) || 0;
          if (key === "maxPriceCapThreshold") {
            const clamped = Math.max(10, Math.min(500, Math.floor(parsed)));
            s[key] = clamped / 100;
            content.querySelector('[data-value="' + key + '"]').textContent = "%" + clamped;
          } else {
            const val = Math.max(0, Math.floor(parsed));
            s[key] = val;
            content.querySelector('[data-value="' + key + '"]').textContent = key === "transferListWarnThreshold" ? val + " slot" : val ? String(val) : key === "consecutiveErrorLimit" ? "3" : "Limitsiz";
          }
        }
      };
      inp.addEventListener("input", updateVal);
      inp.addEventListener("change", () => {
        updateVal();
        saveSnipeSettings();
      });
    });
  }

  // src/ui/panel/waitBar.js
  var activeUnmount = null;
  function unmountWaitBar() {
    if (!activeUnmount) return;
    const unmount = activeUnmount;
    unmount();
  }
  function mountWaitBar(container) {
    unmountWaitBar();
    container.innerHTML = '<div class="fr-waitbar-label" aria-live="off"></div><div class="fr-waitbar-track" aria-hidden="true"><div class="fr-waitbar-fill"></div></div>';
    const label = container.querySelector(".fr-waitbar-label");
    const fill = container.querySelector(".fr-waitbar-fill");
    let intervalId = null;
    const clearTicker = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const remainingTime = () => {
      const wait2 = state.botWait;
      return wait2 ? Math.max(0, Number(wait2.duration) - (Date.now() - Number(wait2.start))) : 0;
    };
    const update = (restartAnimation = false) => {
      const wait2 = state.botWait;
      if (!wait2 || !state.botRunning || Number(wait2.duration) <= 0 || document.visibilityState === "hidden") {
        container.hidden = true;
        clearTicker();
        return;
      }
      container.hidden = false;
      label.textContent = (wait2.kind === "search" ? "Sonraki arama \xB7 " : "Sonraki tur \xB7 ") + formatWaitCountdown(remainingTime());
      if (restartAnimation) {
        fill.style.animation = "none";
        fill.getBoundingClientRect();
        fill.style.animation = "";
        fill.style.setProperty("--fr-wait-duration", Number(wait2.duration) + "ms");
        fill.style.setProperty("--fr-wait-delay", -Math.max(0, Date.now() - Number(wait2.start)) + "ms");
      }
      if (intervalId === null) intervalId = setInterval(() => update(), 100);
    };
    const stopWaitSubscription = on("bot:wait", () => update(true));
    const stopStatusSubscription = on("bot:status", () => update());
    const onVisibilityChange = () => update(true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    update(true);
    let mounted = true;
    const unmount = () => {
      if (!mounted) return;
      mounted = false;
      if (activeUnmount === unmount) activeUnmount = null;
      clearTicker();
      stopWaitSubscription();
      stopStatusSubscription();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      container.hidden = true;
    };
    activeUnmount = unmount;
    return unmount;
  }

  // src/ui/panel/panelTabs.js
  function renderPanelTabs(panel2) {
    unmountWaitBar();
    const tabs = [
      { id: "targets", label: "Oyuncu Hedefleri" },
      { id: "settings", label: "Ayarlar" }
    ];
    if (state.activePanelTab === "logs") {
      state.activePanelTab = "targets";
    }
    panel2.classList.add("fc-snipe-expanded");
    panel2.innerHTML = '<div class="fr-governor-banner" style="display: none;" role="alert"><span class="fr-governor-banner-msg"></span><button class="fr-governor-resume-btn" type="button">Devam Et \u25B6</button></div><div class="fc-snipe-tabs" role="tablist" aria-label="SNIPE sekmeleri">' + tabs.map((tab) => '<button class="fc-snipe-tab" type="button" role="tab" data-tab="' + tab.id + '" aria-selected="' + (state.activePanelTab === tab.id) + '">' + tab.label + "</button>").join("") + '<div class="fr-dry-run-top-badge" role="status" aria-label="Kuru \xE7al\u0131\u015Ft\u0131rma modu aktif" style="display: none;">KURU \xC7ALI\u015ETIRMA</div><div class="speed-tier-top-badge" role="status" aria-label="Aktif arama h\u0131z\u0131"></div><div class="fr-balance-top-badge" role="status" aria-label="G\xFCncel bakiye">\u{1FA99} \u2014</div></div><div class="fc-snipe-tab-content" role="tabpanel" aria-live="polite"></div>';
    const content = panel2.querySelector(".fc-snipe-tab-content");
    renderPanelTabContent(content);
    panel2.querySelectorAll(".fc-snipe-tab").forEach((button) => {
      button.addEventListener("click", () => {
        state.activePanelTab = button.dataset.tab;
        panel2.querySelectorAll(".fc-snipe-tab").forEach((tab) => tab.setAttribute("aria-selected", String(tab === button)));
        renderPanelTabContent(content);
      });
    });
    const dryRunBadge = panel2.querySelector(".fr-dry-run-top-badge");
    const syncDryRunBadge = () => {
      if (!dryRunBadge) return;
      dryRunBadge.style.display = state.snipeSettings?.dryRun ? "inline-flex" : "none";
    };
    syncDryRunBadge();
    on("bot:dryrun-changed", syncDryRunBadge);
    const speedBadge = panel2.querySelector(".speed-tier-top-badge");
    const syncSpeedBadge = () => {
      if (!speedBadge) return;
      const speed = Number.isInteger(state.snipeSettings?.speed) ? state.snipeSettings.speed : 1;
      const tier = SPEED_TIERS[speed] || SPEED_TIERS[1];
      const sec = state.snipeSettings?.speedDelays?.[speed] ?? tier.defaultSec;
      const warnIcon = tier.isWarning ? "\u26A0 " : "";
      speedBadge.innerHTML = `<span class="speed-tier-badge-dot" style="color:${tier.color}">\u25CF</span> <span class="speed-tier-badge-name" style="color:${tier.color}">${warnIcon}${tier.name}</span> <span class="speed-tier-badge-sec">${formatTierSeconds(sec)} sn</span>`;
      speedBadge.style.borderColor = tier.color + "55";
      speedBadge.style.background = tier.color + "18";
    };
    syncSpeedBadge();
    on("bot:speed-changed", syncSpeedBadge);
    const balanceBadge = panel2.querySelector(".fr-balance-top-badge");
    const syncBalanceBadge = (bal) => {
      if (!balanceBadge) return;
      const val = bal !== void 0 ? bal : state.currentBalance !== void 0 ? state.currentBalance : getBalance();
      if (val === null) {
        balanceBadge.textContent = "\u{1FA99} Bakiye okunam\u0131yor";
        balanceBadge.className = "fr-balance-top-badge is-unknown";
        balanceBadge.title = "Bakiye okunam\u0131yor";
      } else {
        balanceBadge.textContent = "\u{1FA99} " + Number(val).toLocaleString("tr-TR");
        balanceBadge.className = "fr-balance-top-badge";
        balanceBadge.title = "Mevcut Coin Bakiyesi: " + Number(val).toLocaleString("tr-TR");
      }
    };
    syncBalanceBadge();
    on("balance:changed", syncBalanceBadge);
    const banner = panel2.querySelector(".fr-governor-banner");
    const bannerMsg = panel2.querySelector(".fr-governor-banner-msg");
    const resumeBtn = panel2.querySelector(".fr-governor-resume-btn");
    const syncBanner = () => {
      if (!banner) return;
      if (safetyGovernor.isHalted()) {
        banner.style.display = "flex";
        const isCaptcha = safetyGovernor.isCaptchaHalted?.();
        if (isCaptcha) {
          banner.classList.add("fr-governor-banner--captcha");
          bannerMsg.innerHTML = "\u{1F6A8} <strong>CAPTCHA TESP\u0130T ED\u0130LD\u0130!</strong> EA do\u011Frulamas\u0131 gerekiyor.";
          if (resumeBtn) {
            resumeBtn.textContent = "Captcha'y\u0131 \xE7\xF6zd\xFCm, devam et";
            resumeBtn.classList.add("fr-governor-resume-btn--captcha");
          }
        } else if (safetyGovernor.getHaltReason() === "liste_dolu") {
          banner.classList.remove("fr-governor-banner--captcha");
          bannerMsg.textContent = "\u26D4 Transfer Listesi dolu! Devam etmek i\xE7in listede yer a\xE7\u0131n.";
          if (resumeBtn) {
            resumeBtn.textContent = "Devam Et \u25B6";
            resumeBtn.classList.remove("fr-governor-resume-btn--captcha");
          }
        } else {
          banner.classList.remove("fr-governor-banner--captcha");
          bannerMsg.textContent = "\u26D4 " + safetyGovernor.getHaltReason();
          if (resumeBtn) {
            resumeBtn.textContent = "Devam Et \u25B6";
            resumeBtn.classList.remove("fr-governor-resume-btn--captcha");
          }
        }
      } else {
        banner.style.display = "none";
        banner.classList.remove("fr-governor-banner--captcha");
      }
    };
    syncBanner();
    panel2.querySelector(".fr-governor-resume-btn")?.addEventListener("click", () => {
      safetyGovernor.resume();
      syncBanner();
    });
    on("governor:halt", syncBanner);
    on("governor:resume", syncBanner);
  }
  function renderPanelTabContent(content) {
    unmountWaitBar();
    content.dataset.activeTab = state.activePanelTab;
    if (state.activePanelTab === "settings") {
      renderPanelSettings(content);
      return;
    }
    renderTargetContent(content);
  }

  // src/ui/panel/panel.js
  var panel = null;
  function initPanel() {
    const style = document.createElement("style");
    style.textContent = panelCss;
    document.head.appendChild(style);
    panel = document.createElement("div");
    panel.id = P.id;
    panel.innerHTML = '<button class="fc-snipe-btn" type="button">' + P.buttonText + "</button>";
    panel.querySelector(".fc-snipe-btn").addEventListener("click", () => {
      state.panelExpanded = true;
      renderPanelTabs(panel);
    });
    document.body.appendChild(panel);
    loadCoreStorage();
    loadTargetStorage();
  }
  function panelShown() {
    return CONFIG.features.logoButton && state.panelOpen && state.logoPresent && inTransfers();
  }
  function applyGeom() {
    if (panel && panel.closest && panel.closest("#fr-hub-view")) {
      const geom2 = state.geom;
      const w02 = geom2 ? geom2.w * vw() : 480;
      const h02 = geom2 ? geom2.h * vh() : 620;
      panel.style.position = "relative";
      panel.style.left = "";
      panel.style.top = "";
      panel.style.width = Math.round(w02) + "px";
      panel.style.height = Math.round(h02) + "px";
      panel.style.display = "flex";
      if (!state.panelExpanded) {
        state.panelExpanded = true;
        renderPanelTabs(panel);
      }
      return;
    }
    const geom = state.geom;
    if (!geom) {
      panel.style.display = "none";
      return;
    }
    const left = geom.l * vw();
    const top0 = geom.t * vh() - state.liveScroll;
    const w0 = geom.w * vw();
    const h0 = geom.h * vh();
    const top = Math.max(top0, topLimit());
    const h = Math.max(0, Math.min(h0, vh() - P.edge - top));
    const w = Math.max(0, Math.min(w0, vw() - P.edge - left));
    panel.style.left = Math.round(left) + "px";
    panel.style.top = Math.round(top) + "px";
    panel.style.width = Math.round(w) + "px";
    panel.style.height = Math.round(h) + "px";
    panel.style.display = panelShown() ? "flex" : "none";
    if (!state.panelExpanded) panel.classList.remove("fc-snipe-expanded");
  }

  // src/layout/fitContent.js
  var fitted = [];
  function resetFitted() {
    fitted.forEach((el) => {
      el.style.transform = "";
      el.style.transformOrigin = "";
      el.style.removeProperty("height");
      el.style.removeProperty("min-height");
      el.style.removeProperty("max-height");
      el.style.removeProperty("box-sizing");
    });
    fitted.length = 0;
  }
  function fitContent(onHub) {
    resetFitted();
    if (onHub || !state.geom || !panelShown()) return;
    const area = document.querySelector(".ut-navigation-container-view--content");
    const areaLeft = area ? area.getBoundingClientRect().left : 0;
    const panelLeft = state.geom.l * vw();
    const all = Array.from(document.querySelectorAll(".ut-content")).filter((el) => {
      const q = el.getBoundingClientRect();
      return q.width > 600 && q.height > 100;
    });
    const tops = all.filter((el) => !all.some((o) => o !== el && o.contains(el)));
    const pq = panel.getBoundingClientRect();
    tops.forEach((el) => {
      const q = el.getBoundingClientRect();
      const freeLeft = areaLeft + F.leftMargin;
      const freeW = panelLeft - F.gap - freeLeft;
      if (freeW <= 0) return;
      const fits = q.right <= panelLeft - F.gap;
      const sx = fits ? 1 : Math.max(F.minScale, Math.min(1, freeW / q.width));
      const dx = fits ? 0 : Math.round(freeLeft + (freeW - q.width * sx) / 2 - q.left);
      const sy = sx;
      let dy = 0, newH = null;
      if (F.expandY && pq.height > 100 && q.height > 50) {
        const targetH = pq.height / sy;
        if (targetH > q.height) {
          newH = Math.min(targetH, q.height * F.maxExpandY);
        }
        dy = Math.round(pq.top - q.top);
      }
      if (dx === 0 && dy === 0 && newH === null && Math.abs(sx - 1) < 5e-3) return;
      const applyT = () => {
        el.style.transformOrigin = "0 0";
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx.toFixed(4)})`;
      };
      const applyH = () => {
        el.style.setProperty("box-sizing", "border-box", "important");
        el.style.setProperty("max-height", "none", "important");
        el.style.setProperty("height", Math.round(newH) + "px", "important");
        el.style.setProperty("min-height", Math.round(newH) + "px", "important");
      };
      const fixTop = () => {
        const r = el.getBoundingClientRect();
        const d = Math.round(pq.top - r.top);
        if (d !== 0) {
          dy += d;
          applyT();
        }
        return d;
      };
      applyT();
      if (newH !== null) {
        applyH();
        for (let i = 0; i < 3; i++) {
          fixTop();
          const r = el.getBoundingClientRect();
          if (r.height <= 0 || Math.abs(pq.height - r.height) <= 2) break;
          newH = Math.max(q.height, Math.min(q.height * F.maxExpandY, newH * (pq.height / r.height)));
          applyH();
        }
        fixTop();
      }
      if (F.debug) {
        const r = el.getBoundingClientRect();
        console.log("[futrush fit]", el.className, { natural: { top: q.top, h: q.height }, panel: { top: pq.top, bottom: pq.bottom }, final: { top: r.top, bottom: r.bottom }, sx, dx, dy, newH });
      }
      fitted.push(el);
    });
  }

  // src/layout/fitContent.module.js
  var fitContent_module_default = {
    name: "fitContent",
    feature: "fitContent",
    sync: ({ onHub }) => fitContent(onHub)
  };

  // src/ui/logoButton.js
  var LG = CONFIG.logoButton;
  function initLogoButton() {
  }
  function placeLogoButton() {
    const logo = document.querySelector("button." + LG.className);
    if (logo) logo.remove();
    state.logoPresent = false;
    state.panelOpen = false;
  }

  // src/ui/logoButton.module.js
  var logoButton_module_default = {
    name: "logoButton",
    feature: "logoButton",
    init: initLogoButton,
    sync: placeLogoButton,
    initOrder: 2
  };

  // src/ui/panel/panel.module.js
  var panel_module_default = {
    name: "panel",
    init: initPanel,
    sync: applyGeom,
    initOrder: 0
  };

  // src/ui/panel/tabs/logsTab.js
  var activeLogFilter = "all";
  var activeAnimatedRow = null;
  var waitEventsRegistered = false;
  function clearActiveWaitAnimation() {
    if (activeAnimatedRow) {
      activeAnimatedRow.classList.remove("log-wait-active", "log-wait-fading");
      activeAnimatedRow = null;
    }
  }
  function createLogRow(entry, animate) {
    const row = document.createElement("div");
    row.className = "fr-log-row log-row" + (animate ? " fr-log-enter" : "");
    const type = botLogType(entry);
    row.dataset.type = type;
    row.dataset.tone = logTone(type);
    row.dataset.logId = String(entry.id);
    if (entry.kind === "success") {
      row.classList.add("log-fx-success");
      if (animate) {
        row.classList.add("log-fx-new");
        setTimeout(() => row.classList.remove("log-fx-new"), 9200);
      }
    } else if (entry.kind === "missed") {
      row.classList.add("log-fx-lost");
      if (animate) {
        row.classList.add("log-fx-new");
        setTimeout(() => row.classList.remove("log-fx-new"), 9200);
      }
    }
    const time = document.createElement("time");
    time.className = "fr-log-time";
    time.dateTime = new Date(entry.at).toISOString();
    time.textContent = new Date(entry.at).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const message = document.createElement("span");
    message.className = "fr-log-message";
    if (entry.kind === "success" || entry.kind === "missed" || entry.kind === "dryRun") {
      if (entry.kind === "dryRun") {
        message.appendChild(document.createTextNode(
          "KURU \xC7ALI\u015ETIRMA: " + String(entry.name) + " (" + entry.rating + ") " + Number(entry.price).toLocaleString("tr-TR") + " fiyat\u0131ndan al\u0131n\u0131rd\u0131"
        ));
        const coin = document.createElement("span");
        coin.className = "fr-log-coin";
        coin.textContent = " \u{1F9EA}";
        coin.setAttribute("aria-label", "kuru \xE7al\u0131\u015Ft\u0131rma sim\xFClasyonu");
        message.appendChild(coin);
      } else {
        message.appendChild(document.createTextNode(
          String(entry.name) + " (" + entry.rating + ") " + Number(entry.price).toLocaleString("tr-TR") + " "
        ));
        const coin = document.createElement("span");
        coin.className = "fr-log-coin";
        coin.textContent = entry.kind === "success" ? "\u{1F60D}" : "\u{1F621}";
        coin.setAttribute("aria-label", entry.kind === "success" ? "al\u0131nd\u0131" : "ba\u015Fkas\u0131 ald\u0131");
        if (entry.kind === "success") {
          const profitVal = Number(entry.totalProfit ?? entry.profit ?? 0);
          const profitFormatted = profitVal !== 0 ? (profitVal > 0 ? "+" : "") + profitVal.toLocaleString("tr-TR") : "0";
          message.append(coin, document.createTextNode(" ALINDI. Toplam k\xE2r " + profitFormatted));
        } else {
          message.append(coin, document.createTextNode(" BA\u015EKASI ALDI."));
        }
      }
    } else {
      message.textContent = entry.message || "";
    }
    row.append(time, message);
    if (entry.baseMs != null && entry.jitterMs != null && entry.totalMs != null) {
      const tag = document.createElement("span");
      tag.className = "log-wait-tag";
      tag.textContent = `${entry.totalMs}ms`;
      row.appendChild(tag);
    }
    return row;
  }
  function updateBotLogStats(content) {
    const summary = content.querySelector(".fr-log-summary");
    if (!summary) return;
    const stats = summarizeBotStats(state.botStats);
    const simText = stats.simulatedBought > 0 ? ` \xB7 Sim\xFCle ${stats.simulatedBought}` : "";
    summary.textContent = "Al\u0131nan " + stats.bought + simText + " \xB7 Ka\xE7\u0131r\u0131lan " + stats.missed + " \xB7 Arama " + stats.searches;
  }
  function getFilteredLogs() {
    const logs = state.botLogs.slice(0, 100);
    if (activeLogFilter === "success") {
      return logs.filter((l) => l.kind === "success");
    }
    if (activeLogFilter === "error") {
      return logs.filter((l) => l.kind === "error");
    }
    return logs;
  }
  function renderLogRows(content, forceTop = false) {
    const list = content.querySelector(".fr-log-list");
    if (!list) return;
    const wasAtTop = forceTop || list.scrollTop <= 15;
    const prevScrollTop = list.scrollTop;
    const entries = getFilteredLogs();
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "fr-target-empty";
      empty.textContent = "Hen\xFCz FutRUSH i\u015Flem kayd\u0131 yok.";
      list.appendChild(empty);
      return;
    }
    entries.forEach((entry) => list.appendChild(createLogRow(entry, false)));
    if (wasAtTop) {
      list.scrollTop = 0;
    } else {
      list.scrollTop = prevScrollTop;
    }
  }
  function copyToClipboard(text) {
    if (typeof globalThis.GM_setClipboard === "function") {
      globalThis.GM_setClipboard(text, "text");
      return Promise.resolve();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
  }
  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch {
    }
    return Promise.resolve();
  }
  function handleLiveWaitUpdate() {
    const wait2 = state.botWait;
    if (!wait2 || !state.botRunning || wait2.duration <= 0) {
      clearActiveWaitAnimation();
      return;
    }
    const latestEntry = state.botLogs[0];
    if (!latestEntry || !latestEntry.message?.includes("uygun ilan bulunamad\u0131")) {
      clearActiveWaitAnimation();
      return;
    }
    latestEntry.baseMs = wait2.baseMs;
    latestEntry.jitterMs = wait2.jitterMs;
    latestEntry.totalMs = wait2.totalMs || wait2.duration;
    const panelLists = document.querySelectorAll(".fr-bot-logs-panel .fr-log-list, #fc-snipe-panel .fr-log-list, .fr-logs-view .fr-log-list");
    panelLists.forEach((list) => {
      const row = list.querySelector(`[data-log-id="${latestEntry.id}"]`) || list.firstElementChild;
      if (!row || !row.classList.contains("fr-log-row")) return;
      let tag = row.querySelector(".log-wait-tag");
      if (!tag) {
        tag = document.createElement("span");
        tag.className = "log-wait-tag";
        row.appendChild(tag);
      }
      tag.textContent = `${latestEntry.totalMs}ms`;
      clearActiveWaitAnimation();
      row.style.setProperty("--wait-ms", `${wait2.duration}ms`);
      row.style.setProperty("--tier-rgb", wait2.tierRgb || "56, 189, 248");
      row.classList.add("log-wait-active");
      activeAnimatedRow = row;
      const onAnimationEnd = (e) => {
        if (e.animationName === "logWaitSlide") {
          row.removeEventListener("animationend", onAnimationEnd);
          row.classList.add("log-wait-fading");
          setTimeout(() => {
            row.classList.remove("log-wait-active", "log-wait-fading");
            if (activeAnimatedRow === row) {
              activeAnimatedRow = null;
            }
          }, 300);
        }
      };
      row.addEventListener("animationend", onAnimationEnd);
    });
  }
  function ensureWaitEvents() {
    if (waitEventsRegistered) return;
    waitEventsRegistered = true;
    on("bot:wait", handleLiveWaitUpdate);
    on("bot:stop", clearActiveWaitAnimation);
  }
  function renderBotLogs(content) {
    ensureWaitEvents();
    if (content.querySelector(".fr-logs-view")) {
      updateBotLogStats(content);
      return;
    }
    content.innerHTML = '<div class="fr-logs-view"><div class="fr-logs-header"><span class="fr-logs-header-title">Loglar</span><div class="fr-log-summary"></div></div><div class="fr-waitbar" hidden></div><div class="fr-log-toolbar"><div class="fr-log-filters"><button class="fr-log-filter-btn' + (activeLogFilter === "all" ? " active" : "") + '" data-filter="all" type="button">T\xFCm\xFC</button><button class="fr-log-filter-btn' + (activeLogFilter === "success" ? " active" : "") + '" data-filter="success" type="button">Ba\u015Far\u0131</button><button class="fr-log-filter-btn' + (activeLogFilter === "error" ? " active" : "") + '" data-filter="error" type="button">Hata</button></div><div class="fr-log-actions"><button class="fr-log-btn fr-log-copy" type="button">Kopyala</button><button class="fr-log-btn fr-log-export" type="button">D\u0131\u015Fa Aktar</button><button class="fr-log-clear" type="button">Temizle</button></div></div><div class="fr-log-list" role="log" aria-live="polite"></div></div>';
    content.querySelectorAll(".fr-log-filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        content.querySelectorAll(".fr-log-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeLogFilter = btn.dataset.filter;
        renderLogRows(content, true);
      });
    });
    const copyBtn = content.querySelector(".fr-log-copy");
    copyBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const lines = getFilteredLogs().map((l) => {
        const time = new Date(l.at).toLocaleTimeString("tr-TR");
        let baseStr = "";
        if (l.kind === "success") {
          const profitVal = Number(l.totalProfit ?? l.profit ?? 0);
          const profitFormatted = profitVal !== 0 ? (profitVal > 0 ? "+" : "") + profitVal.toLocaleString("tr-TR") : "0";
          baseStr = `[${time}] ${l.name} (${l.rating}) ${Number(l.price).toLocaleString("tr-TR")} \u{1F60D} ALINDI. Toplam k\xE2r ${profitFormatted}`;
        } else if (l.kind === "missed") {
          baseStr = `[${time}] ${l.name} (${l.rating}) ${Number(l.price).toLocaleString("tr-TR")} \u{1F621} BA\u015EKASI ALDI.`;
        } else if (l.kind === "dryRun") {
          baseStr = `[${time}] KURU \xC7ALI\u015ETIRMA: ${l.name} (${l.rating}) ${Number(l.price).toLocaleString("tr-TR")} fiyat\u0131ndan al\u0131n\u0131rd\u0131`;
        } else {
          baseStr = `[${time}] ${l.name ? l.name + " - " : ""}${l.message || ""}`;
        }
        if (l.baseMs != null && l.jitterMs != null && l.totalMs != null) {
          baseStr += ` [bekleme ${l.baseMs}+${l.jitterMs}=${l.totalMs} ms]`;
        }
        return baseStr;
      });
      copyToClipboard(lines.join("\n")).then(() => {
        const orig = copyBtn.textContent;
        copyBtn.textContent = "Kopyaland\u0131!";
        setTimeout(() => {
          copyBtn.textContent = orig;
        }, 1500);
      });
    });
    const exportBtn = content.querySelector(".fr-log-export");
    exportBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const data = JSON.stringify(getFilteredLogs(), null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `futrush-logs-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 100);
    });
    const clearBtn = content.querySelector(".fr-log-clear");
    clearBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.botLogs.length = 0;
      renderLogRows(content, true);
    });
    updateBotLogStats(content);
    renderLogRows(content, true);
    mountWaitBar(content.querySelector(".fr-waitbar"));
  }
  function addBotLogEntry(content) {
    const list = content.querySelector(".fr-log-list");
    if (!list) return;
    const entry = state.botLogs[0];
    if (!entry || list.querySelector('[data-log-id="' + entry.id + '"]')) return;
    if (activeLogFilter === "success" && entry.kind !== "success") return;
    if (activeLogFilter === "error" && entry.kind !== "error") return;
    const wasAtTop = list.scrollTop <= 15;
    const empty = list.querySelector(".fr-target-empty");
    if (empty) empty.remove();
    list.prepend(createLogRow(entry, true));
    while (list.querySelectorAll(".fr-log-row").length > 100) list.lastElementChild.remove();
    if (wasAtTop) list.scrollTop = 0;
  }

  // src/ui/futrushPage.js
  var tabEl = null;
  var hubContainer = null;
  var eaContentHidden = false;
  var stylesInjected = false;
  function ensureStyles2() {
    if (stylesInjected || document.getElementById("fr-futrush-page-style")) return;
    const style = document.createElement("style");
    style.id = "fr-futrush-page-style";
    style.textContent = `
    .ut-tab-bar-item.fr-tab-bar-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      background: transparent;
      border: 0;
      outline: 0;
      cursor: pointer;
      padding: 6px 4px;
      color: var(--fr-tab-color, rgba(255, 255, 255, 0.7));
      transition: color 0.15s, background-color 0.15s;
    }
    .ut-tab-bar-item.fr-tab-bar-item::before {
      display: none !important;
      content: none !important;
    }
    .ut-tab-bar-item.fr-tab-bar-item:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }
    .ut-tab-bar-item.fr-tab-bar-item.selected {
      color: #fff !important;
      background: rgba(0, 229, 255, 0.12) !important;
    }
    .ut-tab-bar-item.fr-tab-bar-item .fr-tab-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      flex: 0 0 26px;
      margin-bottom: 4px;
    }
    .ut-tab-bar-item.fr-tab-bar-item .fr-tab-icon svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .ut-tab-bar-item.fr-tab-bar-item.selected .fr-tab-icon {
      filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.85));
    }
    .ut-tab-bar-item.fr-tab-bar-item .fr-tab-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      letter-spacing: 0.5px;
      text-align: center;
      line-height: 1.2;
    }

    #fr-hub-view {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: calc(100vh - 70px);
      box-sizing: border-box;
      display: none;
      flex-direction: row;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 15px;
      padding: 16px;
      overflow-x: auto;
      overflow-y: auto;
      background: rgba(10, 17, 28, 0.98);
      z-index: 10;
    }
    #fr-hub-view #fc-snipe-panel {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      flex: 0 0 auto !important;
      display: flex !important;
      border-radius: 6px !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
    }
    .fr-hub-side-col {
      display: flex;
      flex-direction: column;
      gap: 5px;
      width: 420px;
      flex: 0 0 420px;
      box-sizing: border-box;
    }
    .fr-bot-logs-panel {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: 420px !important;
      min-width: 420px !important;
      max-width: 420px !important;
      height: 380px !important;
      min-height: 380px !important;
      max-height: 380px !important;
      flex: 0 0 380px !important;
      background: rgba(21, 29, 41, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px !important;
      box-sizing: border-box;
      padding: 10px;
      display: flex !important;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #e6f6f7;
    }
    .fr-hub-side-col .fr-market-log-box {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: 420px !important;
      min-width: 420px !important;
      max-width: 420px !important;
      height: 213px !important;
      min-height: 213px !important;
      max-height: 213px !important;
      flex: 0 0 213px !important;
      background: rgba(21, 29, 41, 0.7) !important;
      backdrop-filter: blur(8px) !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      border-radius: 6px !important;
      box-sizing: border-box !important;
      padding: 10px !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      color: #e6f6f7 !important;
    }
  `;
    document.head.appendChild(style);
    stylesInjected = true;
  }
  function updateNavigationTitle(isFutrushActive) {
    const navBar = document.querySelector(".ut-navigation-bar-view");
    if (!navBar) return;
    const titleEl = navBar.querySelector('.title, h1, [class*="title"]');
    if (!titleEl) return;
    if (isFutrushActive) {
      if (titleEl.textContent !== "FutRUSH Panel") {
        if (!titleEl.dataset.frOrigTitle && titleEl.textContent) {
          titleEl.dataset.frOrigTitle = titleEl.textContent;
        }
        titleEl.textContent = "FutRUSH Panel";
      }
    } else if (titleEl.dataset.frOrigTitle && titleEl.textContent === "FutRUSH Panel") {
      titleEl.textContent = titleEl.dataset.frOrigTitle;
      delete titleEl.dataset.frOrigTitle;
    }
  }
  function setupGlobalTabListeners() {
    document.addEventListener("click", (e) => {
      const clickedItem = e.target.closest && e.target.closest(".ut-tab-bar-item");
      if (!clickedItem) return;
      if (clickedItem === tabEl) {
        openFutrushPage();
      } else {
        closeFutrushPage();
      }
    }, true);
  }
  function initFutrushPage() {
    ensureStyles2();
    setupGlobalTabListeners();
  }
  function ensureHubContainer() {
    if (!hubContainer || !hubContainer.isConnected) {
      let existing = document.getElementById("fr-hub-view");
      if (!existing) {
        existing = document.createElement("div");
        existing.id = "fr-hub-view";
      }
      hubContainer = existing;
      const navContainer = document.querySelector(".ut-navigation-container-view");
      const contentArea = document.querySelector(".ut-navigation-container-view--content");
      if (navContainer) {
        if (existing.parentElement !== navContainer) {
          navContainer.appendChild(existing);
        }
      } else if (contentArea && contentArea.parentElement) {
        if (existing.parentElement !== contentArea.parentElement) {
          contentArea.parentElement.appendChild(existing);
        }
      } else if (document.body && existing.parentElement !== document.body) {
        document.body.appendChild(existing);
      }
    }
    if (panel && panel.parentElement !== hubContainer) {
      if (hubContainer.firstChild) {
        hubContainer.insertBefore(panel, hubContainer.firstChild);
      } else {
        hubContainer.appendChild(panel);
      }
    }
    let sideCol = hubContainer.querySelector(".fr-hub-side-col");
    if (!sideCol) {
      sideCol = document.createElement("div");
      sideCol.className = "fr-hub-side-col";
      hubContainer.appendChild(sideCol);
    }
    if (panel && sideCol.previousElementSibling !== panel) {
      hubContainer.insertBefore(sideCol, panel.nextSibling);
    }
    let botLogsPanel = sideCol.querySelector(".fr-bot-logs-panel");
    if (!botLogsPanel) {
      botLogsPanel = document.createElement("div");
      botLogsPanel.className = "fr-bot-logs-panel";
      sideCol.appendChild(botLogsPanel);
      renderBotLogs(botLogsPanel);
    } else if (!botLogsPanel.querySelector(".fr-logs-view")) {
      renderBotLogs(botLogsPanel);
    }
    const existingLogBox = sideCol.querySelector(".fr-market-log-box");
    if (!existingLogBox) {
      mountMarketLogBox(sideCol);
    }
    const logBox = sideCol.querySelector(".fr-market-log-box");
    if (botLogsPanel && logBox && logBox.previousElementSibling !== botLogsPanel) {
      sideCol.insertBefore(logBox, botLogsPanel.nextSibling);
    }
    return hubContainer;
  }
  function openFutrushPage() {
    state.futrushPageActive = true;
    if (tabEl) {
      tabEl.classList.add("selected");
    }
    const nav = document.querySelector("nav.ut-tab-bar") || document.querySelector(".ut-tab-bar");
    if (nav) {
      nav.querySelectorAll(".ut-tab-bar-item").forEach((item) => {
        if (item !== tabEl) item.classList.remove("selected");
      });
    }
    ensureHubContainer();
    openMarketLogBox();
    const contentArea = document.querySelector(".ut-navigation-container-view--content");
    if (contentArea) {
      contentArea.style.setProperty("display", "none", "important");
      eaContentHidden = true;
    }
    if (hubContainer) {
      hubContainer.style.setProperty("display", "flex", "important");
    }
    updateNavigationTitle(true);
    if (panel) {
      if (!state.panelExpanded) {
        state.panelExpanded = true;
        renderPanelTabs(panel);
      }
      applyGeom();
    }
    const botLogsPanel = hubContainer.querySelector(".fr-bot-logs-panel");
    if (botLogsPanel && !botLogsPanel.querySelector(".fr-logs-view")) {
      renderBotLogs(botLogsPanel);
    }
    const currentLogBox = hubContainer.querySelector(".fr-market-log-box");
    if (!currentLogBox) {
      renderMarketLogBox();
    }
  }
  function closeFutrushPage() {
    state.futrushPageActive = false;
    if (tabEl) {
      tabEl.classList.remove("selected");
    }
    if (hubContainer) {
      hubContainer.style.setProperty("display", "none", "important");
    }
    const contentArea = document.querySelector(".ut-navigation-container-view--content");
    if (contentArea && eaContentHidden) {
      contentArea.style.display = "";
      eaContentHidden = false;
    }
    updateNavigationTitle(false);
  }
  function syncPageVisibility() {
    if (!tabEl || !hubContainer) return;
    const nav = tabEl.parentElement;
    if (!nav) return;
    const otherSelected = Array.from(nav.querySelectorAll(".ut-tab-bar-item")).find(
      (item) => item !== tabEl && item.classList.contains("selected")
    );
    if (otherSelected) {
      if (state.futrushPageActive) {
        closeFutrushPage();
      }
    } else if (state.futrushPageActive && (!hubContainer || hubContainer.style.display === "none")) {
      openFutrushPage();
    }
  }
  function placeFutrushTab() {
    ensureStyles2();
    const nav = document.querySelector("nav.ut-tab-bar") || document.querySelector(".ut-tab-bar");
    if (!nav) return;
    if (!tabEl) {
      tabEl = document.createElement("button");
      tabEl.type = "button";
      tabEl.className = "ut-tab-bar-item fr-tab-bar-item";
      tabEl.title = "FutRUSH";
      tabEl.setAttribute("aria-label", "FutRUSH");
      tabEl.innerHTML = '<span class="fr-tab-icon">' + LOGO_SVG + '</span><span class="fr-tab-label">FutRUSH</span>';
      tabEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFutrushPage();
      });
    }
    const items = Array.from(nav.querySelectorAll(".ut-tab-bar-item")).filter(
      (item) => item !== tabEl && !item.classList.contains("fr-tab-bar-item")
    );
    const evoIndex = items.findIndex(
      (i) => /evolution|geliştirme|gelistirme/i.test(i.className + " " + i.textContent)
    );
    const sbcIndex = items.findIndex(
      (i) => /sbc|kko|kadro.*kurma/i.test(i.className + " " + i.textContent)
    );
    let targetBefore = null;
    if (evoIndex !== -1) {
      targetBefore = items[evoIndex];
    } else if (sbcIndex !== -1) {
      targetBefore = items[sbcIndex + 1] || null;
    } else if (items.length >= 3) {
      targetBefore = items[3];
    }
    if (targetBefore) {
      if (tabEl.nextSibling !== targetBefore || tabEl.parentElement !== nav) {
        nav.insertBefore(tabEl, targetBefore);
      }
    } else {
      if (tabEl.parentElement !== nav) {
        nav.appendChild(tabEl);
      }
    }
    ensureHubContainer();
    syncPageVisibility();
  }

  // src/ui/futrushPage.module.js
  var futrushPage_module_default = {
    name: "futrushPage",
    init: initFutrushPage,
    sync: placeFutrushTab,
    initOrder: 1
  };

  // src/ui/searchButton.js
  var SB = CONFIG.searchButton;
  function initSearchButton() {
  }
  function placeSearchButton() {
    mountMarketLogBox();
    syncMarketLogVisibility();
    if (typeof document !== "undefined") {
      const existing = document.querySelectorAll("." + SB.className);
      existing.forEach((el) => {
        const parent = el.parentElement;
        if (parent) {
          parent.style.removeProperty("display");
          parent.style.removeProperty("flex-wrap");
          parent.style.removeProperty("align-items");
          parent.style.removeProperty("column-gap");
          Array.from(parent.children).forEach((child) => {
            child.style.removeProperty("flex");
            child.style.removeProperty("width");
            child.style.removeProperty("min-width");
            child.style.removeProperty("max-width");
            child.style.removeProperty("margin");
            child.style.removeProperty("box-sizing");
            child.style.removeProperty("height");
          });
        }
        el.remove();
      });
    }
  }

  // src/ui/searchButton.module.js
  var searchButton_module_default = {
    name: "searchButton",
    feature: "searchButton",
    init: initSearchButton,
    sync: placeSearchButton,
    initOrder: 3
  };

  // src/ui/settingsModal.js
  var SNIPE_DEFAULTS = { repeat: 0, waitSeconds: [15, 35], autoSell: false, maxPlayers: 1, speed: 0, maxSpendCoins: 0 };
  var CONFIRM_DELAY_MS = 4e3;
  var currentPrefs = null;
  var activeBody = null;
  var botStatusUnsubscribe = null;
  var confirmationTimers = /* @__PURE__ */ new Map();
  function setBotDisabledState() {
    if (!activeBody) return;
    ["clear-targets", "reset-snipe"].forEach((action) => {
      const button = activeBody.querySelector('[data-action="' + action + '"]');
      const note = activeBody.querySelector('[data-disabled-note="' + action + '"]');
      if (button) button.disabled = state.botRunning;
      if (note) note.hidden = !state.botRunning;
    });
  }
  function settingMarkup(label, key, control, hint) {
    return '<div class="fr-settings-field"><label class="fr-settings-label" for="fr-setting-' + key + '">' + label + "</label>" + control.replace('id="__ID__"', 'id="fr-setting-' + key + '"') + '<span class="fr-settings-hint">' + hint + '</span><span class="fr-settings-error" data-error="' + key + '" aria-live="polite"></span></div>';
  }
  function makePrefsFromControls(body) {
    const targetAdd = {};
    let platform = currentPrefs?.platform || "ps";
    body.querySelectorAll("[data-pref]").forEach((input) => {
      const [key, index] = input.dataset.pref.split(".");
      if (index !== void 0) {
        if (!Array.isArray(targetAdd[key])) targetAdd[key] = [...currentPrefs.targetAdd[key]];
        targetAdd[key][Number(index)] = Number(input.value);
      } else if (key === "debug") {
        return;
      } else if (key === "platform") {
        platform = input.value;
      } else if (key === "showCardImages") {
        return;
      } else if (key === "priceSource") {
        targetAdd[key] = input.value;
      } else if (key === "outlierRatio") {
        targetAdd[key] = Number(input.value);
      } else {
        targetAdd[key] = Number(input.value);
      }
    });
    return {
      platform,
      targetAdd: { ...currentPrefs.targetAdd, ...targetAdd },
      debug: body.querySelector('[data-pref="debug"]').checked
    };
  }
  function setError(body, key, message) {
    const error2 = body.querySelector('[data-error="' + key + '"]');
    if (error2) error2.textContent = message;
  }
  function restoreControls(body, key) {
    if (key === "searchGapMs" || key === "actionGapMs") {
      body.querySelectorAll('[data-pref^="' + key + '."]').forEach((input2) => {
        input2.value = String(currentPrefs.targetAdd[key][Number(input2.dataset.pref.split(".")[1])]);
      });
      return;
    }
    const input = body.querySelector('[data-pref="' + key + '"]');
    if (!input) return;
    if (key === "platform") {
      input.value = currentPrefs.platform;
      return;
    }
    if (key === "showCardImages") {
      input.value = String(CONFIG.showCardImages !== false);
      return;
    }
    input.value = String(key === "debug" ? currentPrefs.debug : currentPrefs.targetAdd[key]);
    if (key === "debug") input.checked = currentPrefs.debug;
  }
  function validationMessage(key) {
    if (key === "searchGapMs") return "En az 500 ms olmal\u0131; \xFCst s\u0131n\u0131r alt s\u0131n\u0131rdan k\xFC\xE7\xFCk olamaz.";
    if (key === "actionGapMs") return "En az 200 ms olmal\u0131; \xFCst s\u0131n\u0131r alt s\u0131n\u0131rdan k\xFC\xE7\xFCk olamaz.";
    if (key === "maxSearches") return "1 ile 8 aras\u0131nda tam say\u0131 girin.";
    if (key === "outlierRatio") return "E\u015Fik kapal\u0131 veya %50-%95 aras\u0131nda olmal\u0131.";
    if (key === "discountRate") return "\u0130ndirim oran\u0131 %0 ile %50 aras\u0131nda olmal\u0131.";
    return "Ge\xE7erli bir de\u011Fer se\xE7in.";
  }
  function handlePrefChange(event) {
    const input = event.currentTarget;
    const [key] = input.dataset.pref.split(".");
    if (key === "showCardImages") {
      CONFIG.showCardImages = input.value === "true";
      try {
        pageStorage().setItem("futrush-show-card-images", String(CONFIG.showCardImages));
      } catch (e) {
      }
      emit("targets:changed");
      return;
    }
    const raw = makePrefsFromControls(activeBody);
    if (input.dataset.pref === "debug") raw.debug = input.checked;
    const next = validatePrefs(raw);
    const changedValue = key === "debug" ? raw.debug !== next.debug : key === "platform" ? raw.platform !== next.platform : key === "showCardImages" ? raw.showCardImages !== next.showCardImages : JSON.stringify(raw.targetAdd[key]) !== JSON.stringify(next.targetAdd[key]);
    if (changedValue) {
      restoreControls(activeBody, key);
      setError(activeBody, key, validationMessage(key));
      return;
    }
    currentPrefs = savePrefs(next);
    applyPrefs(currentPrefs);
    setError(activeBody, key, "");
  }
  function runConfirmed(button, action) {
    if (state.botRunning && (action === "clear-targets" || action === "reset-snipe")) return;
    const timer = confirmationTimers.get(button);
    if (timer) {
      clearTimeout(timer);
      confirmationTimers.delete(button);
      button.textContent = button.dataset.originalLabel;
      button.removeAttribute("data-confirming");
      action();
      return;
    }
    button.dataset.originalLabel = button.textContent;
    button.textContent = "Emin misin?";
    button.dataset.confirming = "true";
    confirmationTimers.set(button, setTimeout(() => {
      confirmationTimers.delete(button);
      button.textContent = button.dataset.originalLabel;
      button.removeAttribute("data-confirming");
    }, CONFIRM_DELAY_MS));
  }
  function showActionMessage(message, isError = false) {
    const status = activeBody?.querySelector(".fr-settings-status");
    if (status) {
      status.textContent = message;
      status.style.color = isError ? "#ffb27e" : "#80e6bd";
    }
  }
  function clearTargets() {
    if (state.botRunning) return;
    state.targets = [];
    saveTargets();
    emit("targets:changed");
    emit("panel:request-render");
    showActionMessage("Hedefler temizlendi.");
  }
  function clearSavedTargetLists() {
    try {
      saveSavedTargetLists([]);
    } catch (error2) {
      error("Kay\u0131tl\u0131 hedef listeleri silinemedi.", error2);
      showActionMessage("Kay\u0131tl\u0131 listeler silinemedi.", true);
      return;
    }
    state.savedTargetLists = [];
    state.selectedSavedTargetListId = null;
    emit("targets:changed");
    emit("panel:request-render");
    showActionMessage("Kay\u0131tl\u0131 listeler silindi.");
  }
  function resetSnipeSettings() {
    if (state.botRunning) return;
    Object.assign(state.snipeSettings, SNIPE_DEFAULTS);
    saveSnipeSettings();
    emit("panel:request-render");
    showActionMessage("SNIPE ayarlar\u0131 varsay\u0131lana al\u0131nd\u0131.");
  }
  function clearLogs() {
    state.botLogs = [];
    emit("log:added");
    emit("panel:request-render");
    showActionMessage("Loglar temizlendi.");
  }
  function actionRow(action, label, disabled = false) {
    return '<div class="fr-settings-action-row"><button class="fr-settings-action" type="button" data-action="' + action + '"' + (disabled ? " disabled" : "") + ">" + label + '</button><span class="fr-settings-disabled-note" data-disabled-note="' + action + '" hidden>Bot \xE7al\u0131\u015F\u0131rken kullan\u0131lamaz</span></div>';
  }
  function renderSettingsBody(body) {
    activeBody = body;
    currentPrefs = loadPrefs();
    applyPrefs(currentPrefs);
    if (!botStatusUnsubscribe) botStatusUnsubscribe = on("bot:status", setBotDisabledState);
    const targetAdd = currentPrefs.targetAdd;
    const searchOptions = Array.from({ length: 8 }, (_, index) => {
      const value = index + 1;
      return '<option value="' + value + '"' + (targetAdd.maxSearches === value ? " selected" : "") + ">" + value + "</option>";
    }).join("");
    const discountOptions = Array.from({ length: 51 }, (_, index) => {
      const percentage = index;
      const value = percentage / 100;
      let label = percentage + "%";
      if (percentage === 0) label += " (Ba\u015Fa ba\u015F / %0 Net K\xE2r)";
      else if (percentage === 5) label += " (%5 Net K\xE2r)";
      else if (percentage === 10) label += " (%10 Net K\xE2r - \xD6nerilen)";
      return '<option value="' + value + '"' + (Math.abs(targetAdd.discountRate - value) < 1e-3 ? " selected" : "") + ">" + label + "</option>";
    }).join("");
    const outlierOptions = '<option value="0"' + (targetAdd.outlierRatio === 0 ? " selected" : "") + ">Kapal\u0131</option>" + Array.from({ length: 46 }, (_, index) => {
      const percentage = index + 50;
      const value = percentage / 100;
      return '<option value="' + value + '"' + (targetAdd.outlierRatio === value ? " selected" : "") + ">" + percentage + "%</option>";
    }).join("");
    body.innerHTML = '<div class="fr-settings-content"><section class="fr-settings-card"><h2>Hedef ekleme</h2>' + settingMarkup("Fiyat kayna\u011F\u0131", "priceSource", '<select class="fr-settings-control" id="__ID__" data-pref="priceSource"><option value="ea"' + (targetAdd.priceSource === "ea" ? " selected" : "") + '>EA</option><option value="futbin"' + (targetAdd.priceSource === "futbin" ? " selected" : "") + ">FutBIN</option></select>", "EA piyasa fiyat\u0131n\u0131 veya FutBIN fiyat\u0131n\u0131 kullan\u0131r.") + settingMarkup("Platform", "platform", '<select class="fr-settings-control" id="__ID__" data-pref="platform"><option value="ps"' + (currentPrefs.platform === "ps" ? " selected" : "") + '>PS</option><option value="pc"' + (currentPrefs.platform === "pc" ? " selected" : "") + ">PC</option></select>", "FutBIN fiyat referans\u0131 i\xE7in platform se\xE7imi.") + settingMarkup("Oyuncu Kart G\xF6rseli", "showCardImages", '<select class="fr-settings-control" id="__ID__" data-pref="showCardImages"><option value="true"' + (CONFIG.showCardImages !== false ? " selected" : "") + '>A\xE7\u0131k (G\xF6rselleri Y\xFCkle)</option><option value="false"' + (CONFIG.showCardImages === false ? " selected" : "") + ">Kapal\u0131 (G\xF6rselleri Gizle)</option></select>", "Kapal\u0131 oldu\u011Funda kart g\xF6rselleri gizlenir ve gereksiz istek yap\u0131lmaz.") + settingMarkup("\u0130ndirim oran\u0131 / K\xE2r marj\u0131", "discountRate", '<select class="fr-settings-control" id="__ID__" data-pref="discountRate">' + discountOptions + "</select>", "Piyasa fiyat\u0131ndan d\xFC\u015F\xFClecek indirim / k\xE2r marj\u0131 oran\u0131.") + settingMarkup("Maksimum arama say\u0131s\u0131", "maxSearches", '<select class="fr-settings-control" id="__ID__" data-pref="maxSearches">' + searchOptions + "</select>", "EA aramas\u0131nda kullan\u0131lacak en fazla deneme say\u0131s\u0131.") + settingMarkup("Arama aral\u0131\u011F\u0131 (ms)", "searchGapMs", '<div class="fr-settings-range"><label>Min<input class="fr-settings-control" id="__ID__" data-pref="searchGapMs.0" type="number" step="1" value="' + targetAdd.searchGapMs[0] + '"></label><label>Max<input class="fr-settings-control" data-pref="searchGapMs.1" type="number" step="1" value="' + targetAdd.searchGapMs[1] + '"></label></div>', "D\xFC\u015F\xFCk aral\u0131k EA\u2019n\u0131n hata vermesine yol a\xE7abilir.") + settingMarkup("Oyuncu aras\u0131 aral\u0131k (ms)", "actionGapMs", '<div class="fr-settings-range"><label>Min<input class="fr-settings-control" id="__ID__" data-pref="actionGapMs.0" type="number" step="1" value="' + targetAdd.actionGapMs[0] + '"></label><label>Max<input class="fr-settings-control" data-pref="actionGapMs.1" type="number" step="1" value="' + targetAdd.actionGapMs[1] + '"></label></div>', "D\xFC\u015F\xFCk aral\u0131k EA isteklerinin reddedilmesine neden olabilir.") + settingMarkup("Ayk\u0131r\u0131 ilan e\u015Fi\u011Fi", "outlierRatio", '<select class="fr-settings-control" id="__ID__" data-pref="outlierRatio">' + outlierOptions + "</select>", "Bu oran\u0131n alt\u0131ndaki ilan fiyatlar\u0131 ayk\u0131r\u0131 kabul edilir.") + '</section><section class="fr-settings-card"><h2>Veri</h2><div class="fr-settings-actions">' + actionRow("clear-targets", "Hedefleri temizle", state.botRunning) + actionRow("clear-saved-lists", "Kay\u0131tl\u0131 listeleri sil") + actionRow("reset-snipe", "SNIPE ayarlar\u0131n\u0131 varsay\u0131lana al", state.botRunning) + actionRow("clear-logs", "Loglar\u0131 temizle") + '<div class="fr-settings-status" aria-live="polite"></div></div></section><section class="fr-settings-card"><h2>Hata ay\u0131klama</h2><label class="fr-settings-toggle"><span>Ayr\u0131nt\u0131l\u0131 konsol logu</span><input type="checkbox" data-pref="debug"' + (currentPrefs.debug ? " checked" : "") + '></label><div class="fr-settings-version">S\xFCr\xFCm: ' + (true ? "2.0.0" : "dev") + "</div></section></div>";
    body.querySelectorAll("[data-pref]").forEach((input) => input.addEventListener("change", handlePrefChange));
    body.querySelectorAll("[data-action]").forEach((button) => {
      const actions = {
        "clear-targets": clearTargets,
        "clear-saved-lists": clearSavedTargetLists,
        "reset-snipe": resetSnipeSettings,
        "clear-logs": clearLogs
      };
      button.addEventListener("click", () => runConfirmed(button, actions[button.dataset.action]));
    });
    setBotDisabledState();
  }

  // src/ui/settingsModal.css.js
  var settingsModalCss = `
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

  // src/ui/navButton.js
  var navBtn = null;
  var modal = null;
  function initSettings() {
    const navStyle = document.createElement("style");
    navStyle.textContent = `
    #${N.id} {
      position: fixed; z-index: 5; display: none;
      flex-direction: column; align-items: center; justify-content: flex-start;
      box-sizing: border-box; margin: 0; padding: 0;
      background: transparent; border: 0; outline: 0; cursor: pointer;
      color: var(--fr-color, rgba(255,255,255,.7));
      transition: color .15s, background-color .15s;
    }
    #${N.id}:hover { color: #fff; background: rgba(255,255,255,.06); }
    #${N.id}.fr-open { color: #fff; }
    #${N.id} .fr-icon { display: block; flex: 0 0 auto; }
    #${N.id} .fr-icon svg { display: block; width: 100%; height: 100%; }
    #${N.id}.fr-open .fr-icon { filter: drop-shadow(0 0 6px rgba(0,229,255,.6)); }
    #${N.id} .fr-l1, #${N.id} .fr-l2 {
      display: block; width: 100%; text-align: center; white-space: nowrap; color: inherit;
    }

    #${N.modalId} { position: fixed; inset: 0; z-index: 100; display: none; font-family: Arial, sans-serif; }
    #${N.modalId} .fr-backdrop { position: absolute; inset: 0; background: rgba(5,10,20,.65); }
    #${N.modalId} .fr-dialog {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: min(640px, 90vw); height: min(480px, 80vh);
      display: flex; flex-direction: column;
      background: #0f1a2c; border: 1px solid rgba(255,255,255,.18); border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,.55); overflow: hidden;
    }
    #${N.modalId} .fr-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,.12);
      background: linear-gradient(90deg, rgba(0,229,255,.12), rgba(124,77,255,.12), rgba(255,45,149,.12));
    }
    #${N.modalId} .fr-title { font-size: 18px; font-weight: 700; color: #fff; }
    #${N.modalId} .fr-title b {
      background: linear-gradient(90deg, #FFB300, #FF2D95); -webkit-background-clip: text;
      background-clip: text; color: transparent;
    }
    #${N.modalId} .fr-close {
      width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
      color: #fff; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.2); font-size: 16px;
    }
    #${N.modalId} .fr-close:hover { background: rgba(255,255,255,.18); }
    #${N.modalId} .fr-body { flex: 1; padding: 18px; overflow: auto; }
  ` + settingsModalCss;
    document.head.appendChild(navStyle);
    navBtn = document.createElement("button");
    navBtn.id = N.id;
    navBtn.type = "button";
    navBtn.title = "FutRUSH (Ayarlar)";
    navBtn.setAttribute("aria-label", "FutRUSH (Ayarlar)");
    navBtn.innerHTML = '<span class="fr-icon">' + ICON_SVG + '</span><span class="fr-l1">FutRUSH</span><span class="fr-l2">Ayarlar</span>';
    document.body.appendChild(navBtn);
    modal = document.createElement("div");
    modal.id = N.modalId;
    modal.innerHTML = '<div class="fr-backdrop"></div><div class="fr-dialog" role="dialog" aria-label="FutRUSH Ayarlar"><div class="fr-head"><span class="fr-title"><b>FutRUSH</b> \xB7 Ayarlar</span><button class="fr-close" type="button" aria-label="Kapat">\u2715</button></div><div class="fr-body" id="futrush-settings-body"></div></div>';
    document.body.appendChild(modal);
    navBtn.addEventListener("click", () => modal.style.display === "block" ? closeSettings() : openSettings());
    modal.querySelector(".fr-backdrop").addEventListener("click", closeSettings);
    modal.querySelector(".fr-close").addEventListener("click", closeSettings);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSettings();
    });
  }
  function openSettings() {
    renderSettingsBody(modal.querySelector("#futrush-settings-body"));
    modal.style.display = "block";
    navBtn.classList.add("fr-open");
  }
  function closeSettings() {
    modal.style.display = "none";
    navBtn.classList.remove("fr-open");
  }
  function placeNav() {
    if (!navBtn) return;
    const nav = document.querySelector("nav.ut-tab-bar") || document.querySelector(".ut-tab-bar");
    const q = nav && nav.getBoundingClientRect();
    if (!q || q.width < 40 || q.height < 200) {
      navBtn.style.display = "none";
      return;
    }
    const items = Array.from(nav.querySelectorAll(".ut-tab-bar-item"));
    const settings = items.find((i) => /icon-settings/.test(i.className));
    const others = items.filter((i) => i !== settings);
    const ref = others.find((i) => !/\bselected\b/.test(i.className)) || others[0];
    if (!ref) {
      navBtn.style.display = "none";
      return;
    }
    const rq = ref.getBoundingClientRect();
    const lab = ref.querySelector("span");
    const lq = lab ? lab.getBoundingClientRect() : null;
    const cs = lab ? getComputedStyle(lab) : null;
    const lh = lq && lq.height > 8 ? Math.round(lq.height) : 17;
    const labelTop = lq ? lq.top - rq.top : 37;
    let iconSize = N.defaultIcon;
    try {
      const ps = getComputedStyle(ref, "::before");
      const pw = parseFloat(ps.width), ph = parseFloat(ps.height);
      const v = Math.max(isFinite(pw) ? pw : 0, isFinite(ph) ? ph : 0);
      if (v >= 14 && v <= 48) iconSize = Math.round(v);
    } catch (e) {
    }
    const pad = Math.max(2, Math.round((labelTop - iconSize) / 2));
    const lastBottom = others.reduce((m, i) => Math.max(m, i.getBoundingClientRect().bottom), q.top);
    const limitBottom = settings ? settings.getBoundingClientRect().top : q.bottom;
    const H = Math.round(rq.height + lh);
    if (lastBottom + H > limitBottom) {
      navBtn.style.display = "none";
      return;
    }
    if (cs) {
      navBtn.style.setProperty("--fr-color", cs.color);
      navBtn.style.fontFamily = cs.fontFamily;
      navBtn.style.fontSize = cs.fontSize;
      navBtn.style.fontWeight = cs.fontWeight;
      navBtn.style.letterSpacing = cs.letterSpacing;
    }
    navBtn.style.left = Math.round(rq.left) + "px";
    navBtn.style.top = Math.round(lastBottom) + "px";
    navBtn.style.width = Math.round(rq.width) + "px";
    navBtn.style.height = H + "px";
    navBtn.style.paddingTop = pad + "px";
    const icon = navBtn.querySelector(".fr-icon");
    icon.style.width = iconSize + "px";
    icon.style.height = iconSize + "px";
    icon.style.marginBottom = labelTop - pad - iconSize + "px";
    navBtn.querySelectorAll(".fr-l1, .fr-l2").forEach((el) => {
      el.style.height = lh + "px";
      el.style.lineHeight = lh + "px";
    });
    navBtn.style.display = "flex";
  }

  // src/ui/navButton.module.js
  var navButton_module_default = {
    name: "navButton",
    feature: "settingsButton",
    init: initSettings,
    sync: placeNav,
    initOrder: 1
  };

  // src/ea/lowestMarketPrice.js
  var LOWEST_MARKET_STEPS = 9;
  var DEFAULT_MARKET_PAGE_SIZE = 21;
  var MAX_TOP_PRICE_COUNT = DEFAULT_MARKET_PAGE_SIZE;
  var MAX_TIER_PRICE2 = 15e6;
  var CHEAP_CACHE_BUST_MAX_BID = 600;
  var auctionOf2 = (item) => {
    try {
      return typeof item.getAuctionData === "function" && item.getAuctionData() || item._auction || null;
    } catch (e) {
      return item && item._auction ? item._auction : null;
    }
  };
  function getItemDefId(item) {
    if (!item) return 0;
    return Number(
      item.definitionId || item._auction?.item?.definitionId || item.auctionItem?.item?.definitionId || item.data?.definitionId || item._data?.definitionId || item.item?.definitionId || 0
    );
  }
  function getBuyNow(item) {
    if (!item) return 0;
    const a = auctionOf2(item);
    const v = a?.buyNowPrice ?? item?.buyNowPrice ?? item?._auction?.buyNowPrice;
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  }
  function resolveItemSearchType(itemEntity) {
    if (!itemEntity) return "player";
    if (typeof itemEntity.getSearchType === "function") {
      try {
        const type = itemEntity.getSearchType();
        if (type) return type;
      } catch (e) {
      }
    }
    if (typeof itemEntity.type === "string" && itemEntity.type) return itemEntity.type;
    if (typeof itemEntity.isPlayer === "function") {
      try {
        if (itemEntity.isPlayer()) return "player";
      } catch (e) {
      }
    }
    return "player";
  }
  function resolveItemCategory(itemEntity) {
    if (itemEntity && typeof itemEntity.category === "string" && itemEntity.category) return itemEntity.category;
    return "any";
  }
  function nextMaxBuyFromLowest(lowestPrice, priceTiers) {
    const lowest = Number(lowestPrice) || 0;
    const reduced = lowest - buyNowStep(lowest);
    let next = roundPriceToTier(reduced, priceTiers);
    if (next >= lowest) {
      next = roundPriceToTier(lowest - 1, priceTiers);
      if (next >= lowest) next = lowest - 50;
    }
    return Math.max(0, Math.min(MAX_TIER_PRICE2, next));
  }
  function applyCacheBustMinBid(criteria, stepIndex) {
    const maxBuy = Number(criteria.maxBuy) || 0;
    const isSpecial = criteria.level === "SP" || Array.isArray(criteria.rarities) && criteria.rarities.length > 0;
    const basePool = maxBuy >= 1500 || isSpecial ? SPECIAL_OR_HIGH_MIN_BIDS : STANDARD_LOW_MIN_BIDS;
    const pool = basePool.filter((bid) => bid === 0 || bid < maxBuy && bid <= CHEAP_CACHE_BUST_MAX_BID);
    const minBid = pool.length ? pool[Math.abs(stepIndex) % pool.length] : 0;
    if (minBid > 0) {
      criteria.minBid = minBid;
    } else {
      delete criteria.minBid;
    }
    return minBid;
  }
  function makeLowestMarketCriteria(itemEntity, { maxBuy, createCriteria } = {}) {
    const Criteria = typeof createCriteria === "function" ? null : pageWindow.UTSearchCriteriaDTO;
    const criteria = typeof createCriteria === "function" ? createCriteria() : typeof Criteria === "function" ? new Criteria() : { count: DEFAULT_MARKET_PAGE_SIZE };
    const defId = getItemDefId(itemEntity);
    criteria.defId = [defId];
    const type = resolveItemSearchType(itemEntity);
    criteria.type = type;
    if (type === "player" && defId > 0) {
      criteria.maskedDefId = Number(defId) & 16777215;
    }
    const category = resolveItemCategory(itemEntity);
    if (category && category !== "any") {
      criteria.category = category;
    }
    if (maxBuy != null && Number.isFinite(Number(maxBuy))) {
      criteria.maxBuy = Math.max(0, Math.min(MAX_TIER_PRICE2, Number(maxBuy)));
    }
    return criteria;
  }
  function updateBucketedSearchCriteria(criteria) {
    const service = pageWindow.services && pageWindow.services.Item;
    const candidates = [service, service && service._searchViewModel, service && service.searchViewModel];
    for (const candidate of candidates) {
      if (candidate && typeof candidate.updateSearchCriteria === "function") {
        try {
          candidate.updateSearchCriteria(criteria);
        } catch (e) {
        }
        return;
      }
    }
    try {
      const searchModel = pageWindow.getAppMain?.()?.getRootViewController?.()?.getPresentedViewController?.()?.getCurrentViewController?.()?._viewmodel;
      if (searchModel && typeof searchModel.updateSearchCriteria === "function") {
        searchModel.updateSearchCriteria(criteria);
      }
    } catch (e) {
    }
  }
  function emitSearchPin(criteria) {
    try {
      const pin = pageWindow.services && pageWindow.services.PIN;
      if (!pin || typeof pin.sendData !== "function") return;
      const eventType = pageWindow.PINEventType && pageWindow.PINEventType.PAGE_VIEW || "page_view";
      pin.sendData(eventType, { type: "Transfer Market Search", criteria });
    } catch (e) {
    }
  }
  function matchingBuyNowItems(items, definitionId) {
    const wanted = Number(definitionId);
    const wantedBase = wanted > 0 ? wanted & 16777215 : 0;
    return (Array.isArray(items) ? items : []).filter((item) => {
      const itDefId = getItemDefId(item);
      if (itDefId > 0 && wanted > 0) {
        const itBase = itDefId & 16777215;
        if (itDefId !== wanted && itBase !== wantedBase) return false;
      }
      const price = getBuyNow(item);
      return price > 0;
    });
  }
  function sliceFromItems(items, definitionId) {
    const matched = matchingBuyNowItems(items, definitionId);
    let lowestPrice = 0;
    for (const item of matched) {
      const price = getBuyNow(item);
      if (price > 0 && (lowestPrice === 0 || price < lowestPrice)) lowestPrice = price;
    }
    if (!lowestPrice) return null;
    const count = matched.filter((item) => getBuyNow(item) === lowestPrice).length;
    return { price: lowestPrice, count };
  }
  function getItemUniqueKey(item) {
    if (!item) return null;
    try {
      const direct = Number(item.tradeId);
      if (Number.isFinite(direct) && direct > 0) return String(direct);
    } catch (e) {
    }
    try {
      const tid = Number(auctionOf2(item)?.tradeId);
      if (Number.isFinite(tid) && tid > 0) return String(tid);
    } catch (e) {
    }
    return null;
  }
  function groupMatchedByPrice(items, definitionId) {
    const buckets = /* @__PURE__ */ new Map();
    for (const item of matchingBuyNowItems(items, definitionId)) {
      const price = getBuyNow(item);
      if (!(price > 0)) continue;
      let bucket = buckets.get(price);
      if (!bucket) {
        bucket = { ids: /* @__PURE__ */ new Set(), unknown: 0 };
        buckets.set(price, bucket);
      }
      const key = getItemUniqueKey(item);
      if (key != null) bucket.ids.add(key);
      else bucket.unknown += 1;
    }
    return buckets;
  }
  function createTopPriceAccumulator() {
    return /* @__PURE__ */ new Map();
  }
  function recordStepBuckets(accumulator, buckets) {
    for (const [price, bucket] of buckets) {
      let entry = accumulator.get(price);
      if (!entry) {
        entry = { seen: /* @__PURE__ */ new Set(), bestUnknown: 0, pageTruncated: false, capCut: false, stepsSeen: 0, lastStepSeen: 0 };
        accumulator.set(price, entry);
      }
      entry.stepsSeen += 1;
      if (entry.stepsSeen > 1) {
        entry.pageTruncated = false;
        entry.capCut = false;
      }
      for (const id of bucket.ids) entry.seen.add(id);
      if (bucket.unknown > entry.bestUnknown) entry.bestUnknown = bucket.unknown;
    }
    return accumulator;
  }
  function markTierStepsSeen(accumulator, step) {
    if (!Number.isFinite(step)) return accumulator;
    for (const entry of accumulator.values()) entry.lastStepSeen = step;
    return accumulator;
  }
  function markTruncatedLowestTier(accumulator, lowestSeen, highestSeen, listedAtLowest, fullPage, matchedCount) {
    if (!(fullPage > 0) || !(matchedCount >= fullPage)) return accumulator;
    if (!(lowestSeen > 0) || lowestSeen === highestSeen) return accumulator;
    if (!(listedAtLowest >= fullPage)) return accumulator;
    const entry = accumulator.get(Number(lowestSeen));
    if (entry) entry.pageTruncated = true;
    return accumulator;
  }
  function resolveTierCount(entry) {
    const rawCount = entry.seen.size + entry.bestUnknown;
    let count = Math.max(1, rawCount);
    if (entry.pageTruncated && !(entry.stepsSeen > 1)) count = Math.max(count, MAX_TOP_PRICE_COUNT);
    return Math.min(MAX_TOP_PRICE_COUNT, count);
  }
  function buildTopPrices(accumulator, limit = 3) {
    const tiers = [];
    for (const [price, entry] of accumulator) {
      tiers.push({ price, count: resolveTierCount(entry) });
    }
    tiers.sort((a, b) => a.price - b.price);
    return tiers.slice(0, Math.max(0, limit)).map((tier, index) => ({ rank: index + 1, ...tier }));
  }
  async function searchLowestMarketPage(criteria, { timeoutMs = 18e3, services } = {}) {
    if (safetyGovernor.isCaptchaHalted()) {
      return { ok: false, items: [], error: { message: "CAPTCHA kilitli" } };
    }
    const service = services && services.Item || pageWindow.services && pageWindow.services.Item;
    if (!service || typeof service.searchTransferMarket !== "function") {
      return { ok: false, items: [], error: { message: "EA Transfer Market arama servisi bulunamad\u0131." } };
    }
    try {
      if (typeof service.clearTransferMarketCache === "function") service.clearTransferMarketCache();
    } catch (e) {
    }
    updateBucketedSearchCriteria(criteria);
    emitSearchPin(criteria);
    const response = await observeEaRequest(service.searchTransferMarket(criteria, 1), timeoutMs);
    if (!response || !response.success) {
      const detail = response && response.error && (response.error.message || response.error) || (response && response.timeout ? "zaman a\u015F\u0131m\u0131" : "EA iste\u011Fi ba\u015Far\u0131s\u0131z");
      return { ok: false, items: [], error: { message: String(detail), timeout: !!(response && response.timeout) } };
    }
    const items = Array.isArray(response.data?.items) ? response.data.items : Array.isArray(response.items) ? response.items : Array.isArray(response.data) ? response.data : [];
    return { ok: true, items };
  }
  async function findLowestMarketPrice(itemEntity, options = {}) {
    const definitionId = getItemDefId(itemEntity);
    if (!definitionId) {
      return { ok: false, status: "ERROR", extinct: false, error: { message: "Kart kimli\u011Fi yok" }, reason: "invalid-input" };
    }
    const {
      maxSteps = LOWEST_MARKET_STEPS,
      searchPage,
      services,
      createCriteria,
      sleepFn,
      sleep: optSleep,
      rnd = Math.random,
      gapMs = [100, 300],
      onStep = null,
      onProgress = null,
      priceTiers = options.priceTiers || getJsPriceTiers(pageWindow),
      fullPage = DEFAULT_MARKET_PAGE_SIZE,
      cacheBust = true
    } = options;
    const actualSleep = sleepFn || optSleep || sleep;
    const actualSearchPage = searchPage || ((crit) => searchLowestMarketPage(crit, { services }));
    const slices = [];
    const topAccumulator = createTopPriceAccumulator();
    let pageSize = fullPage;
    let sawFullPage = false;
    let assignedMaxBuy = null;
    const criteria = makeLowestMarketCriteria(itemEntity, { createCriteria });
    for (let step = 1; step <= maxSteps; step += 1) {
      if (typeof onStep === "function") onStep(step, maxSteps, assignedMaxBuy);
      if (typeof onProgress === "function") onProgress({ step, maxSteps, assignedMaxBuy });
      const page = await actualSearchPage(criteria);
      if (!page || !page.ok) {
        const errorMsg = String(page && page.error && (page.error.message || page.error) || "EA aramas\u0131 ba\u015Far\u0131s\u0131z");
        const rateLimited = /429|rate.?limit|too many/i.test(errorMsg);
        if (slices.length === 0) {
          return {
            ok: false,
            status: "ERROR",
            extinct: false,
            error: page && page.error || { message: errorMsg },
            reason: rateLimited ? "rate-limited" : "service-failed",
            slices,
            topPrices: []
          };
        }
        break;
      }
      const items = Array.isArray(page.items) ? page.items : [];
      if (!items.length) break;
      if (!sawFullPage) {
        pageSize = Math.max(fullPage, items.length);
        sawFullPage = true;
      }
      const slice = sliceFromItems(items, definitionId);
      if (slice) {
        slices.push({ ...slice, step });
      } else {
        break;
      }
      const stepBuckets = groupMatchedByPrice(items, definitionId);
      for (const [price, entry] of topAccumulator) {
        if (entry.lastStepSeen === step - 1 && !stepBuckets.has(price)) entry.capCut = true;
      }
      recordStepBuckets(topAccumulator, stepBuckets);
      markTierStepsSeen(topAccumulator, step);
      const isFullPage = items.length >= pageSize;
      if (isFullPage) {
        let lowestSeen = Infinity;
        let highestSeen = 0;
        for (const price of stepBuckets.keys()) {
          if (price < lowestSeen) lowestSeen = price;
          if (price > highestSeen) highestSeen = price;
        }
        const listedAtLowest = matchingBuyNowItems(items, definitionId).filter((item) => getBuyNow(item) === lowestSeen).length;
        markTruncatedLowestTier(topAccumulator, lowestSeen, highestSeen, listedAtLowest, pageSize, items.length);
      }
      if (!isFullPage) break;
      const nextMaxBuy = nextMaxBuyFromLowest(slice.price, priceTiers);
      if (!(nextMaxBuy > 0) || assignedMaxBuy != null && nextMaxBuy >= assignedMaxBuy) break;
      criteria.maxBuy = nextMaxBuy;
      assignedMaxBuy = nextMaxBuy;
      if (cacheBust) applyCacheBustMinBid(criteria, step);
      if (step < maxSteps) {
        const [minGap, maxGap] = gapMs;
        if (maxGap > 0) await actualSleep(randomBetween(minGap, maxGap, rnd));
      }
    }
    if (slices.length === 0) {
      return { ok: true, status: "EXTINCT", extinct: true, price: null, count: 0, slices, topPrices: [] };
    }
    slices.sort((a, b) => a.price - b.price);
    const cheapest = slices[0].price;
    const best = slices.filter((slice) => slice.price === cheapest).pop();
    let topPrices = buildTopPrices(topAccumulator, 3);
    if (!topPrices.length) {
      const byPrice = /* @__PURE__ */ new Map();
      for (const slice of slices) {
        const entry = byPrice.get(slice.price);
        if (!entry || slice.count > entry.count) byPrice.set(slice.price, { count: slice.count });
      }
      topPrices = [...byPrice.entries()].sort((a, b) => a[0] - b[0]).slice(0, 3).map(([price, entry], index) => ({ rank: index + 1, price, count: Math.min(MAX_TOP_PRICE_COUNT, entry.count) }));
    }
    return {
      ok: true,
      status: "OK",
      extinct: false,
      price: best.price,
      count: best.count,
      slices,
      topPrices,
      lowerTierPrice: getNextLowerPrice(best.price) || null
    };
  }

  // src/ui/ea/detailLowestPrices.js
  var BTN_CLASS = "fr-detail-lowest-btn";
  var RESULTS_CLASS = "fr-detail-lowest-results";
  var ITEM_CLASS = "fr-detail-price-option";
  var GROUP_SELECTOR = ".ut-button-group";
  var QUICK_LIST_SCOPE_SELECTOR = ".ut-quick-list-panel-view";
  var INJECT_DEBOUNCE_MS = 250;
  var DEFAULT_BTN_TEXT = "\u{1F50E} En D\xFC\u015F\xFCk Fiyatlar";
  var observer3 = null;
  var injectTimer = null;
  var formatPrice = (value) => Number(value || 0).toLocaleString("tr-TR");
  function isItemLike(entity) {
    if (!entity || typeof entity !== "object") return false;
    if (typeof entity.getSearchType === "function" && typeof entity.getAuctionData === "function") return true;
    return ["definitionId", "_definitionId", "defId", "assetId", "itemId", "cardId"].some((key) => Number(entity[key]) > 0) || Boolean(entity._auction && getDefIdLoose(entity));
  }
  var DEF_ID_FIELDS = [
    "definitionId",
    "_definitionId",
    "defId",
    "id",
    "_id",
    "itemId",
    "assetId",
    "baseId",
    "cardId"
  ];
  function getDefIdLoose(entity) {
    if (!entity || typeof entity !== "object") return 0;
    for (const key of DEF_ID_FIELDS) {
      try {
        const n = Number(entity[key]);
        if (Number.isFinite(n) && n > 0) return n;
      } catch (e) {
      }
    }
    try {
      const def = typeof entity.getItemDefinition === "function" ? entity.getItemDefinition() : typeof entity.getDefinition === "function" ? entity.getDefinition() : null;
      const n = Number(def && (def.definitionId ?? def.id));
      if (Number.isFinite(n) && n > 0) return n;
    } catch (e) {
    }
    try {
      const inner = typeof entity.getAuctionData === "function" && entity.getAuctionData() || entity._auction || entity.item || entity.auctionItem || null;
      const n = Number(inner && (inner.item?.definitionId ?? inner.definitionId ?? inner.tradeId));
      if (Number.isFinite(n) && n > 0) return n;
    } catch (e) {
    }
    return 0;
  }
  function readCardIdsFromDom(group) {
    const result = { definitionId: 0, tradeId: 0 };
    if (!group || !group.closest) return result;
    const attrNames = [
      "data-definition-id",
      "data-definitionid",
      "data-defid",
      "data-item-id",
      "data-itemid",
      "data-card-id",
      "data-id",
      "data-trade-id",
      "data-tradeid",
      "data-auction-id"
    ];
    const readNode = (node2) => {
      if (!node2?.getAttribute) return;
      for (const attr of attrNames) {
        const raw = node2.getAttribute(attr);
        if (!raw) continue;
        const n = Number(String(raw).replace(/[^0-9]/g, ""));
        if (!Number.isFinite(n) || n <= 0) continue;
        if (/trade|auction/.test(attr)) {
          if (!result.tradeId) result.tradeId = n;
        } else if (!result.definitionId) result.definitionId = n;
      }
    };
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
  function findItemEntityInObject(obj, seen, depth) {
    if (!obj || typeof obj !== "object" || seen.has(obj) || depth > 6) return null;
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
      "item",
      "itemEntity",
      "_item",
      "selectedItem",
      "_selectedItem",
      "currentItem",
      "_currentItem",
      "displayedItem",
      "selectedCard",
      "activeItem",
      "focusedItem",
      "auctionItem",
      "_auctionItem",
      "itemData",
      "data",
      "_data",
      "props",
      "children",
      "state",
      "model",
      "_viewmodel",
      "viewModel",
      "controller",
      "_controller",
      "presentedViewController",
      "detailPanel"
    ];
    for (const key of keys) {
      try {
        const found = findItemEntityInObject(obj[key], seen, depth + 1);
        if (found) return found;
      } catch (e) {
      }
    }
    return null;
  }
  function resolveSelectedCard() {
    const win2 = pageWindow;
    const globals = [win2.__FUTRUSH_SELECTED_ITEM__, win2.selectedItem, win2.currentItem];
    for (const candidate of globals) {
      if (isItemLike(candidate)) return candidate;
    }
    try {
      const app = win2.getAppMain ? win2.getAppMain() : null;
      const root = app && app.getRootViewController ? app.getRootViewController() : null;
      const presented = root && root.getPresentedViewController ? root.getPresentedViewController() : null;
      const current = root && root.getCurrentViewController ? root.getCurrentViewController() : null;
      for (const scope of [presented, current, root, app]) {
        const found = findItemEntityInObject(scope, /* @__PURE__ */ new WeakSet(), 0);
        if (found) return found;
      }
    } catch (e) {
    }
    try {
      const service = win2.services && win2.services.Item;
      if (service) {
        const preferredKeys = [
          "selectedItem",
          "_selectedItem",
          "currentItem",
          "_currentItem",
          "selectedItems",
          "_selectedItems",
          "focusedItem",
          "highlightedItem"
        ];
        for (const key of preferredKeys) {
          try {
            const val = service[key];
            const found = findItemEntityInObject(val, /* @__PURE__ */ new WeakSet(), 0);
            if (found) return found;
          } catch (e) {
          }
        }
      }
    } catch (e) {
    }
    try {
      const app = win2.getAppMain ? win2.getAppMain() : null;
      if (app) {
        const seen = /* @__PURE__ */ new WeakSet();
        const queue2 = [{ obj: app, depth: 0 }];
        while (queue2.length) {
          const { obj, depth } = queue2.shift();
          if (!obj || typeof obj !== "object" || seen.has(obj) || depth > 5) continue;
          seen.add(obj);
          if (isItemLike(obj)) return obj;
          let names = [];
          try {
            names = Object.keys(obj);
          } catch (e) {
          }
          for (const name of names.slice(0, 80)) {
            try {
              queue2.push({ obj: obj[name], depth: depth + 1 });
            } catch (e) {
            }
          }
        }
      }
    } catch (e) {
    }
    return null;
  }
  function fireEvent(el, type) {
    try {
      const Ctor = pageWindow.Event || window.Event;
      el.dispatchEvent(new Ctor(type, { bubbles: true }));
    } catch (e) {
    }
  }
  function setSpinnerValue(spin, rawValue) {
    const value = String(Math.max(0, Math.round(Number(rawValue) || 0)));
    let handledByApi = false;
    const control = spin._utControl || spin.control || spin.closest && spin.closest(".ut-number-input-spinner");
    if (control) {
      try {
        if (typeof control.setValue === "function") {
          control.setValue(Number(value));
          handledByApi = true;
        } else if (typeof control.updateValue === "function") {
          control.updateValue(Number(value));
          handledByApi = true;
        }
      } catch (e) {
      }
      try {
        const vm = control._viewmodel || control.viewmodel || control.viewModel;
        if (vm && typeof vm.set === "function") vm.set("value", Number(value));
      } catch (e) {
      }
    }
    try {
      const proto = Object.getPrototypeOf(spin);
      const desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(spin, value);
      else spin.value = value;
    } catch (e) {
      try {
        spin.value = value;
      } catch (e2) {
      }
    }
    fireEvent(spin, "input");
    fireEvent(spin, "change");
    fireEvent(spin, "blur");
    if (!handledByApi && control && typeof control.refresh === "function") {
      try {
        control.refresh();
      } catch (e) {
      }
    }
  }
  function findQuickListInputs(group) {
    const scope = group && group.closest ? group.closest(QUICK_LIST_SCOPE_SELECTOR) : null;
    const root = scope || document;
    const spins = Array.from(root.querySelectorAll(".ut-number-input-spinner")).filter(visibleElement);
    if (!spins.length) return { start: null, buyNow: null };
    const classify = (el) => {
      const haystack = [
        el.id,
        el.name,
        el.getAttribute && el.getAttribute("aria-label"),
        el.getAttribute && el.getAttribute("data-qa-id"),
        el.getAttribute && el.getAttribute("data-qa-automation-name"),
        el.className
      ].filter(Boolean).join(" ").toLowerCase();
      if (/buynow|buy-now|sofort|bin/.test(haystack)) return "buynow";
      if (/start|minbid|min-bid|opening|bid/.test(haystack)) return "start";
      const labelEl = el.labels && el.labels[0] || el.closest && el.closest("label") || el.parentElement && el.parentElement.previousElementSibling;
      const labelText = labelEl ? String(labelEl.textContent || "").toLowerCase() : "";
      if (/hemen al|buy now|sofortkauf/.test(labelText)) return "buynow";
      if (/başlangıç|start price|startpreis|opening|min\.? gebot|asgari/.test(labelText)) return "start";
      return null;
    };
    let start = null;
    let buyNow = null;
    for (const spin of spins) {
      const kind = classify(spin);
      if (kind === "start" && !start) start = spin;
      else if (kind === "buynow" && !buyNow) buyNow = spin;
    }
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
      addMarketLog({ text: `\u26A0\uFE0F [En D\xFC\u015F\xFCk Fiyatlar] Quick List giri\u015Fleri bulunamad\u0131; fiyat uygulanamad\u0131 (se\xE7ilen: ${formatPrice(selectedPrice)}).`, type: "warn" });
      return false;
    }
    const binValue = Math.max(0, Math.round(Number(selectedPrice) || 0));
    const startValue = getNextLowerPrice(binValue) || binValue;
    if (buyNow) setSpinnerValue(buyNow, binValue);
    if (start) setSpinnerValue(start, startValue);
    addMarketLog({
      text: `\u{1F4B0} [En D\xFC\u015F\xFCk Fiyatlar] Se\xE7ilen: ${formatPrice(binValue)} \u2192 Hemen Al: ${formatPrice(binValue)}, Ba\u015Flang\u0131\xE7: ${formatPrice(startValue)} inputlar\u0131na yaz\u0131ld\u0131.`,
      type: "info"
    });
    return true;
  }
  function renderResults(container, result, group) {
    container.innerHTML = "";
    const topPrices = result && Array.isArray(result.topPrices) ? result.topPrices : [];
    for (const tier of topPrices.slice(0, 3)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ut-btn ${ITEM_CLASS}`;
      const count = Math.min(21, Math.max(1, Number(tier.count) || 1));
      btn.textContent = `${tier.rank}) ${formatPrice(tier.price)} (x${count})`;
      btn.title = `Ba\u015Flang\u0131\xE7: ${formatPrice(getNextLowerPrice(tier.price) || tier.price)} \u2022 Hemen Al: ${formatPrice(tier.price)} \u2014 t\u0131klay\u0131nca Quick List inputlar\u0131na yaz\u0131l\u0131r`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        container.querySelectorAll(`.${ITEM_CLASS}`).forEach((el) => el.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        applyToQuickList(group, tier.price);
      });
      container.appendChild(btn);
    }
  }
  function readPanelCardName(group) {
    if (!group || !group.closest) return "";
    const panel2 = group.closest('.ut-detail-panel, .ut-panel, [class*="detail"]') || document;
    if (!panel2.querySelectorAll) return "";
    const nodes = Array.from(panel2.querySelectorAll(
      '.ut-detail-panel-title, .ut-panel-title, h1, h2, h3, [class*="title"], [class*="name"]'
    )).slice(0, 40);
    for (const node of nodes) {
      const text = String(node.textContent || "").trim();
      if (text.length >= 2 && text.length <= 60 && !/[<>{}]/.test(text)) {
        return text.split(/[·|•\-–]\s*\d{2,3}\b/)[0].trim() || text;
      }
    }
    return "";
  }
  function findItemViaReactFiber(group) {
    try {
      const panel2 = group.closest ? group.closest('.ut-detail-panel, .ut-panel, [class*="detail"]') || group.parentElement : null;
      if (!panel2) return null;
      const roots = [panel2, ...Array.from(panel2.querySelectorAll("*")).slice(0, 300)];
      for (const el of roots) {
        if (!el) continue;
        let fiber = el.__reactInternalInstance$ || el._reactInternalFiber || null;
        if (!fiber) {
          for (const key of Object.keys(el)) {
            if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
              fiber = el[key];
              break;
            }
          }
        }
        let hops = 0;
        while (fiber && hops < 40) {
          const props = fiber.memoizedProps || fiber.pendingProps;
          if (props) {
            const found = findItemEntityInObject(props, /* @__PURE__ */ new WeakSet(), 0);
            if (found) return found;
          }
          fiber = fiber.return;
          hops += 1;
        }
      }
    } catch (e) {
    }
    return null;
  }
  function resolveDefIdByName(group) {
    const name = readPanelCardName(group);
    if (!name) return 0;
    try {
      const service = pageWindow.services && pageWindow.services.Item;
      const caches = ["_lastSearchResult", "lastSearchResult", "_searchResult", "items", "_items"];
      for (const key of caches) {
        let list = null;
        try {
          const val = service && service[key];
          list = Array.isArray(val) ? val : val && Array.isArray(val.items) ? val.items : null;
        } catch (e) {
        }
        if (!list) continue;
        for (const it of list) {
          try {
            const itemName = String(it?.fullName || it?.name || it?.getFullName?.() || "").trim();
            if (itemName && itemName.toLowerCase() === name.toLowerCase()) {
              const defId = getDefIdLoose(it);
              if (defId > 0) return defId;
            }
          } catch (e) {
          }
        }
      }
    } catch (e) {
    }
    return 0;
  }
  var lastSelectedCard = null;
  function captureSelectedCard() {
    try {
      const itemEntity = resolveSelectedCard();
      if (!itemEntity) return;
      const defId = getItemDefId(itemEntity) || getDefIdLoose(itemEntity);
      if (!(defId > 0)) return;
      lastSelectedCard = { itemEntity, defId, at: Date.now() };
    } catch (e) {
    }
  }
  var cachedTarget = null;
  var TARGET_CACHE_MS = 2e3;
  function resolveTargetForGroup(group) {
    if (cachedTarget && cachedTarget.group === group && Date.now() - cachedTarget.at < TARGET_CACHE_MS) {
      return cachedTarget.target;
    }
    const target = computeTargetForGroup(group);
    cachedTarget = { group, target, at: Date.now() };
    return target;
  }
  function computeTargetForGroup(group) {
    const fiberItem = findItemViaReactFiber(group);
    if (fiberItem) {
      const defId = getItemDefId(fiberItem) || getDefIdLoose(fiberItem);
      if (defId > 0) return { itemEntity: fiberItem, defId };
    }
    const domIds = readCardIdsFromDom(group);
    if (domIds.definitionId > 0) return { itemEntity: null, defId: domIds.definitionId };
    const byName = resolveDefIdByName(group);
    if (byName > 0) return { itemEntity: null, defId: byName };
    const itemEntity = resolveSelectedCard();
    if (itemEntity) {
      const defId = getItemDefId(itemEntity) || getDefIdLoose(itemEntity);
      if (defId > 0) return { itemEntity, defId };
    }
    if (lastSelectedCard && lastSelectedCard.defId > 0 && Date.now() - lastSelectedCard.at < 5e3) {
      return lastSelectedCard;
    }
    return null;
  }
  async function runLowestSearch(btn, results, group, target) {
    searchingStates.set(btn, true);
    btn.disabled = true;
    btn.textContent = "Aran\u0131yor...";
    results.innerHTML = "";
    try {
      const searchTarget = target.itemEntity || makeLowestMarketCriteria({ definitionId: target.defId });
      const result = await findLowestMarketPrice(searchTarget, { gapMs: [150, 400] });
      if (!result || !result.ok || !(result.price > 0)) {
        if (result && result.extinct) {
          btn.textContent = "Markette yok";
          addMarketLog({ text: "\u{1F50E} [En D\xFC\u015F\xFCk Fiyatlar] Markette kart bulunamad\u0131 (Extinct).", type: "warn" });
        } else {
          btn.textContent = "Arama ba\u015Far\u0131s\u0131z";
          addMarketLog({ text: `\u26A0\uFE0F [En D\xFC\u015F\xFCk Fiyatlar] ${String(result && result.error && result.error.message || "EA aramas\u0131 ba\u015Far\u0131s\u0131z")}`, type: "warn" });
        }
        restoreBtnText(group, btn, 4e3);
        return;
      }
      renderResults(results, result, group);
      btn.textContent = DEFAULT_BTN_TEXT;
    } catch (err) {
      btn.textContent = "Hata";
      restoreBtnText(group, btn, 4e3);
      addMarketLog({ text: `\u274C [En D\xFC\u015F\xFCk Fiyatlar] ${String(err?.message || err)}`, type: "error" });
    } finally {
      searchingStates.set(btn, false);
      btn.disabled = false;
    }
  }
  var searchingStates = /* @__PURE__ */ new WeakMap();
  function restoreBtnText(group, btn, delayMs) {
    setTimeout(() => {
      if (!searchingStates.get(btn) && btn.isConnected) btn.textContent = DEFAULT_BTN_TEXT;
    }, delayMs);
  }
  function ensureControls(group) {
    if (!group || group.nodeType !== 1) return;
    let btn = group.querySelector(`.${BTN_CLASS}`);
    if (btn) {
      scheduleDiagnostics();
      return;
    }
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = `ut-btn ${BTN_CLASS}`;
    btn.textContent = DEFAULT_BTN_TEXT;
    btn.title = "Bu kart i\xE7in pazardaki en d\xFC\u015F\xFCk 1., 2. ve 3. Hemen Al fiyatlar\u0131n\u0131 ara";
    btn.style.pointerEvents = "auto";
    const results = document.createElement("span");
    results.className = RESULTS_CLASS;
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (searchingStates.get(btn)) return;
      const target = resolveTargetForGroup(group);
      if (!target) {
        btn.textContent = "Kart se\xE7ili de\u011Fil";
        restoreBtnText(group, btn, 2500);
        return;
      }
      await runLowestSearch(btn, results, group, target);
    });
    group.appendChild(btn);
    group.appendChild(results);
  }
  var diagTimer = null;
  function scheduleDiagnostics() {
    if (diagTimer !== null) return;
    diagTimer = setTimeout(() => {
      diagTimer = null;
      try {
        runClickDiagnostics();
      } catch (e) {
      }
    }, 1500);
  }
  function runClickDiagnostics() {
    try {
      const btns = document.querySelectorAll(`.${BTN_CLASS}`);
      for (const btn of btns) {
        ["click", "mousedown", "mouseup"].forEach((type) => {
          btn.addEventListener(type, () => {
            try {
              console.info(
                "[FutRUSH][EnDusukFiyatlar] buton uzerinde " + type + " alindi.",
                { text: btn.textContent, disabled: btn.disabled }
              );
            } catch (e) {
            }
          }, true);
        });
      }
    } catch (e) {
    }
  }
  function injectIntoVisibleGroups(root) {
    const scope = root && root.querySelectorAll ? root : document;
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
      try {
        injectIntoVisibleGroups(document);
      } catch (e) {
      }
    }, INJECT_DEBOUNCE_MS);
  }
  function initDetailLowestPrices() {
    if (observer3 || typeof MutationObserver === "undefined" || !document.body) return;
    observer3 = new MutationObserver(scheduleInject);
    observer3.observe(document.body, { childList: true, subtree: true });
    scheduleInject();
  }
  function destroyDetailLowestPrices() {
    if (observer3) {
      try {
        observer3.disconnect();
      } catch (e) {
      }
      observer3 = null;
    }
    if (injectTimer !== null) {
      clearTimeout(injectTimer);
      injectTimer = null;
    }
    document.querySelectorAll(`.${BTN_CLASS}, .${RESULTS_CLASS}`).forEach((el) => el.remove());
  }

  // src/ui/ea/detailLowestPrices.module.js
  var detailLowestPrices_module_default = {
    name: "detailLowestPrices",
    feature: "detailLowestPrices",
    init: initDetailLowestPrices,
    destroy: destroyDetailLowestPrices,
    initOrder: 5
  };

  // src/ui/panel/panelEvents.js
  function updateStartButton(content) {
    const button = content.querySelector(".fr-start");
    if (!button) return;
    const running = state.botRunning;
    button.dataset.state = running ? "running" : "idle";
    button.setAttribute("aria-pressed", String(running));
    button.setAttribute("aria-label", running ? "Durdur FutRUSH" : "Ba\u015Flat FutRUSH");
  }
  function registerPanelEvents() {
    on("panel:request-render", () => {
      const content = panel?.querySelector(".fc-snipe-tab-content");
      if (content) renderPanelTabContent(content);
    });
    on("targets:changed", () => {
      const content = panel?.querySelector(".fc-snipe-tab-content");
      if (content && state.activePanelTab === "targets") renderTargetContent(content);
    });
    on("escalation:update", (target) => {
      const content = panel?.querySelector(".fc-snipe-tab-content");
      if (content && state.activePanelTab === "targets") updateTargetEscalationDisplay(target);
    });
    on("balance:changed", () => {
      const content = panel?.querySelector(".fc-snipe-tab-content");
      if (content && state.activePanelTab === "targets") renderTargetContent(content);
    });
    on("targets:status", () => {
      const content = panel?.querySelector(".fc-snipe-tab-content");
      if (!content || state.activePanelTab !== "targets") return;
      const status = content.querySelector(".fr-target-status");
      if (status) updateTargetStatus(status, state.targetStatus, state.targetLoading);
      else renderTargetContent(content);
    });
    on("targets:status-expire", () => {
      const content = panel?.querySelector(".fc-snipe-tab-content");
      if (content && state.activePanelTab === "targets") expireTargetStatus(content);
    });
    on("log:added", () => {
      const content = panel?.querySelector(".fc-snipe-tab-content");
      if (content && state.activePanelTab === "logs") addBotLogEntry(content);
      const botLogsPanel = document.querySelector(".fr-bot-logs-panel");
      if (botLogsPanel) addBotLogEntry(botLogsPanel);
    });
    on("bot:stats", () => {
      const content = panel?.querySelector(".fc-snipe-tab-content");
      if (content && state.activePanelTab === "logs") updateBotLogStats(content);
      const botLogsPanel = document.querySelector(".fr-bot-logs-panel");
      if (botLogsPanel) updateBotLogStats(botLogsPanel);
    });
    on("bot:status", () => {
      const content = panel?.querySelector(".fc-snipe-tab-content");
      if (content && state.activePanelTab === "settings") {
        updateStartButton(content);
      }
    });
  }

  // src/ui/modals/saveDialog.css.js
  var saveDialogCss = ":host{all:initial;position:fixed!important;inset:0!important;z-index:2147483001!important;display:grid!important;place-items:center!important;font-family:Arial,Helvetica,sans-serif!important;color:#fff!important;}*,*::before,*::after{box-sizing:border-box;}.backdrop{position:absolute;inset:0;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.72);}.dialog{width:min(360px,92vw);padding:16px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:linear-gradient(120deg,#101412,#1a201d);box-shadow:0 12px 40px rgba(0,0,0,.45);}.title{margin-bottom:10px;font-size:16px;font-weight:700;}input{width:100%;height:36px;padding:0 10px;border:1px solid rgba(255,255,255,.2);border-radius:5px;outline:none;color:#fff;background:rgba(0,0,0,.3);font:13px Arial,sans-serif;}input:focus{border-color:#00d5ef;}.error{min-height:16px;margin-top:5px;color:#ff8790;font-size:11px;}.actions{display:flex;justify-content:flex-end;gap:7px;margin-top:8px;}button{min-width:74px;height:30px;padding:0 10px;border:1px solid rgba(255,255,255,.16);border-radius:5px;color:#fff;background:rgba(255,255,255,.08);font:700 11px Arial,sans-serif;cursor:pointer;}.save{border-color:rgba(0,213,239,.55);background:linear-gradient(135deg,#0879dc,#13a9d5);}";

  // src/ui/modals/saveDialog.js
  function openTargetSaveDialog() {
    document.querySelector(".fr-target-save-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "fr-target-save-overlay";
    const shadow = overlay.attachShadow({ mode: "open" });
    shadow.innerHTML = "<style>" + saveDialogCss + '</style><div class="backdrop"><div class="dialog" role="dialog" aria-modal="true" aria-label="Oyuncu listesini kaydet"><div class="title">Oyuncu listesini kaydet</div><input maxlength="40" placeholder="Liste ad\u0131" aria-label="Liste ad\u0131"><div class="error" aria-live="polite"></div><div class="actions"><button type="button" class="cancel">\u0130ptal</button><button type="button" class="save">Kaydet</button></div></div></div>';
    document.body.appendChild(overlay);
    const input = shadow.querySelector("input");
    const error2 = shadow.querySelector(".error");
    const close = () => overlay.remove();
    const submit = () => {
      const name = input.value.trim();
      if (!name) {
        error2.textContent = "L\xFCtfen kay\u0131t i\xE7in bir isim yaz\u0131n.";
        input.focus();
        return;
      }
      saveTargetSnapshot(name);
      close();
      emit("targets:changed");
    };
    shadow.querySelector(".cancel").addEventListener("click", close);
    shadow.querySelector(".save").addEventListener("click", submit);
    shadow.querySelector(".backdrop").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
      if (event.key === "Escape") close();
    });
    input.focus();
  }
  function registerModalEvents() {
    on("ui:open-save-dialog", () => openTargetSaveDialog());
  }

  // src/futbin/urls.js
  function buildFutbinUrl(rating, page) {
    const cfg = CONFIG.futbin;
    const url = new URL(cfg.baseUrl);
    const isPc = cfg.platform === "pc";
    const priceParam = isPc ? cfg.pcPriceRangeParam : cfg.priceRangeParam;
    url.searchParams.set(cfg.ratingParam, rating + "-" + rating);
    url.searchParams.set("platform", isPc ? "PC" : "PS");
    if (cfg.version) url.searchParams.set("version", cfg.version);
    if (page > 1) url.searchParams.set(cfg.pageParam, String(page));
    else url.searchParams.delete(cfg.pageParam);
    url.searchParams.set(priceParam, cfg.priceRange);
    url.searchParams.set(cfg.sortParam, priceParam);
    url.searchParams.set(cfg.orderParam, "asc");
    return url.toString();
  }
  function buildFutbinApiUrl(rating, page) {
    const cfg = CONFIG.futbin;
    const isPc = cfg.platform === "pc";
    const url = new URL(cfg.apiBaseUrl);
    url.searchParams.set("platform", isPc ? "PC" : "PS");
    url.searchParams.set("page", String(page));
    url.searchParams.set("rating", rating + "-" + rating);
    url.searchParams.set(isPc ? "pcprice" : "ps4price", cfg.priceRange);
    url.searchParams.set("sort", isPc ? "pc_price" : "ps_price");
    url.searchParams.set("order", "asc");
    if (cfg.version) url.searchParams.set("version", cfg.version);
    return url.toString();
  }

  // src/futbin/apiParser.js
  function parseFutbinApiPlayers(body, requestedRating) {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (error2) {
      throw new Error("FutBIN API yan\u0131t\u0131 JSON olarak \xE7\xF6z\xFCmlenemedi.");
    }
    if (!payload || !Array.isArray(payload.data)) {
      throw new Error("FutBIN API oyuncu listesi bulunamad\u0131 (data alan\u0131 de\u011Fi\u015Fmi\u015F olabilir).");
    }
    const priceField = CONFIG.futbin.platform === "pc" ? "pc_LCPrice" : "ps_LCPrice";
    const players = payload.data.map((row) => {
      const rating = Number(row.rating) || 0;
      const price = Number(row[priceField]) || 0;
      const commonName = String(row.common_name || "").trim().replace(/\s+/g, " ");
      const fullName = String(row.playername || "").trim().replace(/\s+/g, " ");
      const name = commonName || fullName;
      if (!name || rating !== requestedRating || !Number.isFinite(price) || price <= 0) return null;
      if (row.resource_id || row.playerid || row.league || row.club || row.nation) {
        const candidate = mapCandidate(row);
        if (candidate) {
          return {
            ...candidate,
            name,
            commonName: commonName || name,
            price
          };
        }
      }
      return { name, rating, price, futbinId: row.ID == null ? null : String(row.ID) };
    }).filter(Boolean);
    players.pageRowCount = payload.data.length;
    return players;
  }

  // src/futbin/htmlParser.js
  function parseFutbinPlayers(html, requestedRating) {
    const cfg = CONFIG.futbin;
    const selectors = cfg.selectors;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const pageText = (doc.body?.textContent || "").slice(0, 4e3);
    const hasPlayerRows = doc.querySelector(selectors.rows) !== null;
    const blockedPattern = /<title>\s*just a moment|cf-browser-verification|cf_chl_opt|cf-chl-|challenge-platform\/h\/|id=["']challenge-(?:form|running|body-text|stage)["']|enable javascript and cookies to continue|oops, there was an error - 403|attention required/i;
    if (!hasPlayerRows && (blockedPattern.test(html) || /just a moment|attention required/i.test(pageText))) {
      const error2 = new Error("FutBIN iste\u011Fi engellendi (Cloudflare). Bir s\xFCre sonra tekrar deneyin.");
      error2.blocked = true;
      throw error2;
    }
    const rows = Array.from(doc.querySelectorAll(selectors.rows));
    if (!rows.length) {
      if (doc.querySelector(selectors.emptyResultContainer)) {
        const emptyResult = [];
        emptyResult.pageRowCount = 0;
        return emptyResult;
      }
      throw new Error("FutBIN oyuncu sat\u0131rlar\u0131 bulunamad\u0131; rows se\xE7icisini kontrol edin: " + selectors.rows);
    }
    const priceSelector = cfg.platform === "pc" ? selectors.pcPrice : selectors.consolePrice;
    let lastPage = 0;
    doc.querySelectorAll(selectors.pageLinks).forEach((link) => {
      try {
        lastPage = Math.max(lastPage, Number(new URL(link.href, cfg.baseUrl).searchParams.get(cfg.pageParam)) || 0);
      } catch (e) {
        warnOnce("futbin-pagination-url", "[FutRUSH:futbin]", "FutBIN sayfalama ba\u011Flant\u0131s\u0131 \xE7\xF6z\xFCmlenemedi.", "pagination-link", String(e?.message || e));
      }
    });
    const players = rows.map((row) => {
      const link = row.querySelector(selectors.nameLink);
      const nameNode = link || row.querySelector(selectors.name);
      const name = (nameNode?.textContent || nameNode?.getAttribute("data-player-name") || "").trim().replace(/\s+/g, " ");
      if (!name) return null;
      const ratingNode = row.querySelector(selectors.rating);
      const ratingText = ratingNode?.textContent || row.querySelector(selectors.ratingFallback)?.textContent || "";
      const ratingMatch = String(ratingText).match(/\b(\d{2})\b/);
      const rating = ratingMatch ? Number(ratingMatch[1]) : 0;
      if (rating !== requestedRating) return null;
      const priceNode = row.querySelector(priceSelector);
      const price = parseFutbinPrice(priceNode?.textContent || "");
      if (!price) return null;
      const href = link?.getAttribute("href") || "";
      const idMatch = href.match(selectors.idPattern);
      const image = row.querySelector(selectors.image);
      return { name, rating, price, futbinId: idMatch ? idMatch[1] : null, eaId: image?.getAttribute("src") || null };
    }).filter(Boolean);
    players.pageRowCount = rows.length;
    players.lastPage = lastPage;
    return players;
  }

  // src/futbin/loader.js
  async function loadFromFutbinApi(rating, count) {
    const found = /* @__PURE__ */ new Map();
    for (let page = 1; page <= CONFIG.futbin.maxPages && found.size < count; page++) {
      if (page > 1) await wait(CONFIG.futbin.pageDelay);
      const url = buildFutbinApiUrl(rating, page);
      const response = await requestFutbinApi(url);
      if (response.status === 403 || response.status === 429 || response.status === 503) {
        console.error("[FutRUSH] FutBIN API iste\u011Fi engellendi:", response.status, url, (response.responseText || "").slice(0, 500));
        const error2 = new Error("FutBIN iste\u011Fi engellendi (" + response.status + "). Bir s\xFCre sonra tekrar deneyin.");
        error2.blocked = true;
        throw error2;
      }
      if (response.status < 200 || response.status >= 300) throw new Error("FutBIN API yan\u0131t vermedi (HTTP " + response.status + ").");
      const players = parseFutbinApiPlayers(response.responseText || "", rating);
      players.forEach((player) => {
        const key = player.futbinId ? "id:" + player.futbinId : "name:" + player.name.toLocaleLowerCase() + ":" + player.rating;
        if (!found.has(key)) found.set(key, player);
      });
      if (!players.pageRowCount) break;
    }
    return Array.from(found.values()).sort((a, b) => a.price - b.price).slice(0, count);
  }
  async function loadFromFutbinPage(rating, count) {
    const found = /* @__PURE__ */ new Map();
    let lastPage = CONFIG.futbin.maxPages;
    for (let page = 1; page <= CONFIG.futbin.maxPages && found.size < count && page <= lastPage; page++) {
      if (page > 1) await wait(CONFIG.futbin.pageDelay);
      const url = buildFutbinUrl(rating, page);
      let response;
      try {
        response = await requestFutbinPage(url);
      } catch (error2) {
        console.error("[FutRUSH] FutBIN iste\u011Fi ba\u015Far\u0131s\u0131z:", url, error2);
        throw error2;
      }
      const body = response.responseText || "";
      if (response.status === 403 || response.status === 429 || response.status === 503 || /cloudflare|cf-chl|just a moment|attention required/i.test(body.slice(0, 4e3))) {
        const error2 = new Error("FutBIN sayfas\u0131 engellendi (" + response.status + ").");
        error2.blocked = true;
        error2.status = response.status;
        error2.url = url;
        throw error2;
      }
      if (response.status < 200 || response.status >= 300) {
        console.error("[FutRUSH] FutBIN HTTP hatas\u0131:", response.status, url);
        throw new Error("FutBIN yan\u0131t vermedi (HTTP " + response.status + ").");
      }
      let players2;
      try {
        players2 = parseFutbinPlayers(body, rating);
      } catch (error2) {
        console.error("[FutRUSH] FutBIN HTML ayr\u0131\u015Ft\u0131r\u0131lamad\u0131:", url, error2);
        throw error2;
      }
      players2.forEach((player) => {
        const key = player.futbinId ? "id:" + player.futbinId : "name:" + player.name.toLocaleLowerCase() + ":" + player.rating;
        if (!found.has(key)) found.set(key, player);
      });
      if (players2.lastPage) lastPage = Math.min(CONFIG.futbin.maxPages, players2.lastPage);
      if (players2.pageRowCount === 0) break;
    }
    const players = Array.from(found.values()).sort((a, b) => a.price - b.price).slice(0, count);
    if (!players.length) throw new Error("Se\xE7ilen reytingde FutBIN fiyat\u0131 bulunan oyuncu yok.");
    return players;
  }
  function noPlayersError() {
    return new Error("Se\xE7ilen reytingde FutBIN fiyat\u0131 bulunan oyuncu yok.");
  }
  async function fetchCheapestPlayers(rating, count) {
    if (CONFIG.futbin.preferApi) {
      let apiError;
      try {
        const players = await loadFromFutbinApi(rating, count);
        if (!players.length) throw noPlayersError();
        return { players, source: "api", fallback: false };
      } catch (error2) {
        apiError = error2;
        console.warn("[FutRUSH] FutBIN API ba\u015Far\u0131s\u0131z; sayfa yede\u011Fi deneniyor:", error2);
      }
      try {
        const players = await loadFromFutbinPage(rating, count);
        return { players, source: "html", fallback: true };
      } catch (pageError) {
        pageError.blocked = Boolean(apiError.blocked && pageError.blocked);
        throw pageError;
      }
    }
    try {
      const players = await loadFromFutbinPage(rating, count);
      return { players, source: "html", fallback: false };
    } catch (pageError) {
      if (!pageError.blocked) throw pageError;
      console.warn("[FutRUSH] FutBIN sayfas\u0131 engellendi; MagicBuyer uyumlu liste API yede\u011Fi deneniyor:", pageError.status, pageError.url);
      try {
        const players = await loadFromFutbinApi(rating, count);
        if (!players.length) throw noPlayersError();
        return { players, source: "api", fallback: true };
      } catch (apiError) {
        apiError.blocked = Boolean(pageError.blocked && apiError.blocked);
        throw apiError;
      }
    }
  }

  // src/targets/futbinImport.js
  var activeToken = null;
  function importStatus(added, fallback, fallbackCount, total) {
    let message = added ? added + " oyuncu hedef listesine eklendi" : "Bulunan oyuncular zaten hedef listesinde";
    if (fallback) message += " (FutBIN yedek kayna\u011F\u0131)";
    if (fallbackCount === 0 && total > 0) message += " (fiyatlar EA'dan)";
    else if (fallbackCount > 0 && fallbackCount < total) message += " (" + fallbackCount + " oyuncuda FutBIN fiyat\u0131 kullan\u0131ld\u0131)";
    else if (fallbackCount === total && total > 0) message += " (" + fallbackCount + " oyuncuda FutBIN fiyat\u0131 kullan\u0131ld\u0131)";
    return message + ".";
  }
  async function importWithEaPrices(players, fallback, token, fetchPage, sleepFn, randomBetweenFn, sleepBetweenFn) {
    let added = 0;
    let fallbackCount = 0;
    let consecutiveErrors = 0;
    let stopEaSearch = false;
    const settings = CONFIG.targetAdd;
    if (activeToken === token) state.targetLoading = false;
    for (let index = 0; index < players.length; index++) {
      if (token.cancelled) break;
      const player = players[index];
      let didEaSearch = false;
      let usedEaPrice = false;
      const reference = player.price;
      if (activeToken === token) {
        setTargetStatus({
          type: "loading",
          message: "EA fiyat\u0131 al\u0131n\u0131yor " + (index + 1) + "/" + players.length + ": " + player.name,
          source: "mixed",
          progress: { done: index, total: players.length }
        });
        emit("targets:changed");
      }
      if (!token.cancelled && !state.botRunning && !stopEaSearch) {
        let eaId = Number(player.eaId) > 0 ? Number(player.eaId) & 16777215 : 0;
        if (!eaId) {
          try {
            eaId = await resolveTargetEaId(player);
          } catch (error2) {
            warnOnce(
              "target-ea-id-lookup",
              "[FutRUSH:targets]",
              "Oyuncunun EA kimli\u011Fi \xE7\xF6z\xFClemedi; FutBIN fiyat\u0131 kullan\u0131lacak.",
              error2
            );
          }
        }
        if (eaId > 0 && !token.cancelled && !state.botRunning) {
          player.eaId = eaId;
          didEaSearch = true;
          try {
            const options = {
              eaId,
              rating: player.rating,
              reference,
              token,
              maxSearches: settings.maxSearches,
              gapMs: settings.searchGapMs,
              outlierRatio: settings.outlierRatio
            };
            if (sleepFn) options.sleepFn = sleepFn;
            const result = await getMarketPrice((maxBuy) => fetchPage(eaId, maxBuy), options);
            if (!token.cancelled) {
              if (result.ok) {
                consecutiveErrors = 0;
                if (result.price) {
                  player.price = result.price;
                  player.buyNow = result.price;
                  usedEaPrice = true;
                }
                if (result.skipped && result.skipped.length) {
                  info("EA fiyat\u0131 hesaplan\u0131rken ayk\u0131r\u0131 ilanlar atland\u0131:", player.name, result.skipped);
                }
              } else {
                consecutiveErrors++;
                if (consecutiveErrors >= settings.maxConsecutiveErrors) {
                  stopEaSearch = true;
                  warnOnce(
                    "target-ea-price-consecutive-errors",
                    "[FutRUSH:targets]",
                    "Art arda EA fiyat aramas\u0131 ba\u015Far\u0131s\u0131z oldu; kalan oyuncularda FutBIN fiyat\u0131 kullan\u0131lacak.",
                    result.error
                  );
                }
              }
            }
          } catch (error2) {
            consecutiveErrors++;
            if (consecutiveErrors >= settings.maxConsecutiveErrors) {
              stopEaSearch = true;
              warnOnce(
                "target-ea-price-consecutive-errors",
                "[FutRUSH:targets]",
                "Art arda EA fiyat aramas\u0131 ba\u015Far\u0131s\u0131z oldu; kalan oyuncularda FutBIN fiyat\u0131 kullan\u0131lacak.",
                error2
              );
            }
          }
        }
      }
      if (token.cancelled) break;
      if (!usedEaPrice) {
        player.price = reference;
        player.buyNow = reference;
        fallbackCount++;
      }
      const importedPlayer = applyTargetAddDiscount(player, settings.discountRate);
      added += mergeTargetPlayers([importedPlayer]);
      const shouldWait = didEaSearch && index < players.length - 1 && !token.cancelled;
      const gap = shouldWait ? randomBetweenFn(settings.actionGapMs[0], settings.actionGapMs[1]) : 0;
      if (activeToken === token && index < players.length - 1) {
        setTargetStatus({
          type: "success",
          message: player.name + " \xB7 Buy Now " + Number(importedPlayer.buyNow).toLocaleString("tr-TR") + " hedeflere eklendi.",
          source: usedEaPrice ? "ea" : "futbin",
          progress: { done: index + 1, total: players.length },
          ...shouldWait ? { holdMs: gap } : {}
        });
      }
      emit("targets:changed");
      if (shouldWait) await sleepBetweenFn(gap, token);
    }
    if (token.cancelled) return { added, fallbackCount, total: players.length, fallback, cancelled: true };
    return { added, fallbackCount, total: players.length, fallback };
  }
  async function importCheapestTargets(rating, count, deps = {}) {
    if (activeToken) activeToken.cancel();
    const token = createCancelToken();
    activeToken = token;
    const loadPlayers = deps.fetchCheapestPlayers || fetchCheapestPlayers;
    const fetchPage = deps.fetchMarketPage || fetchMarketPage;
    const sleepFn = deps.sleepFn;
    const randomBetweenFn = deps.randomBetween || randomBetween;
    const sleepBetweenFn = deps.sleep || sleep;
    state.targetLoading = true;
    setTargetStatus({
      type: "loading",
      message: "FutBIN oyuncular\u0131 y\xFCkleniyor...",
      source: "futbin",
      progress: { done: 0, total: count }
    });
    emit("targets:changed");
    try {
      const result = await loadPlayers(rating, count);
      if (activeToken !== token || token.cancelled) return;
      if (CONFIG.targetAdd.priceSource !== "ea") {
        if (!result.players || result.players.length === 0) {
          const added = mergeTargetPlayers([]);
          const fallbackNote = result.fallback ? " (FutBIN yedek kayna\u011F\u0131)" : "";
          setTargetStatus({
            type: "success",
            message: added ? added + " oyuncu hedef listesine eklendi" + fallbackNote + "." : "Bulunan oyuncular zaten hedef listesinde.",
            source: "futbin",
            progress: { done: 0, total: 0 },
            holdMs: CONFIG.ui.statusHoldMs
          });
          return;
        }
        const total = result.players.length;
        let addedTotal = 0;
        for (let i = 0; i < total; i++) {
          if (token.cancelled || activeToken !== token) break;
          const player = result.players[i];
          const importedPlayer = applyTargetAddDiscount(player, CONFIG.targetAdd.discountRate);
          const added = mergeTargetPlayers([importedPlayer]);
          if (typeof added === "number") addedTotal += added;
          else if (added) addedTotal += 1;
          if (activeToken === token && !token.cancelled) {
            setTargetStatus({
              type: "loading",
              message: `${player.name} hedeflere eklendi (${i + 1}/${total})...`,
              source: "futbin",
              progress: { done: i + 1, total }
            });
            emit("targets:changed");
          }
          if (i < total - 1 && !token.cancelled && activeToken === token) {
            const delay = randomBetweenFn(1e3, 2e3);
            await sleepBetweenFn(delay, token);
          }
        }
        if (activeToken === token && !token.cancelled) {
          const fallbackNote = result.fallback ? " (FutBIN yedek kayna\u011F\u0131)" : "";
          setTargetStatus({
            type: "success",
            message: addedTotal ? `${addedTotal} oyuncu hedef listesine eklendi${fallbackNote}.` : "Bulunan oyuncular zaten hedef listesinde.",
            source: "futbin",
            progress: { done: total, total },
            holdMs: CONFIG.ui.statusHoldMs
          });
        }
        return;
      }
      const imported = await importWithEaPrices(result.players, result.fallback, token, fetchPage, sleepFn, randomBetweenFn, sleepBetweenFn);
      if (activeToken === token) {
        const source = imported.total === 0 || imported.fallbackCount === imported.total ? "futbin" : imported.fallbackCount === 0 ? "ea" : "mixed";
        setTargetStatus({
          type: "success",
          message: importStatus(imported.added, imported.fallback, imported.fallbackCount, imported.total),
          source,
          progress: { done: imported.total, total: imported.total },
          holdMs: CONFIG.ui.statusHoldMs
        });
      }
    } catch (error2) {
      if (activeToken === token) {
        setTargetStatus({
          type: "error",
          message: error2.message || "FutBIN oyuncular\u0131 y\xFCklenemedi.",
          source: state.targetStatus?.source || "futbin",
          progress: state.targetStatus?.progress || { done: 0, total: count }
        });
        if (error2.blocked) console.error("[FutRUSH] FutBIN engelleme ayr\u0131nt\u0131s\u0131:", error2);
      }
    } finally {
      if (activeToken === token) {
        state.targetLoading = false;
        emit("targets:changed");
      }
    }
  }

  // src/ui/modals/filterModal.css.js
  var filterModalCss = ':host{all:initial;position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2147483000!important;display:block!important;font-family:Arial,Helvetica,sans-serif!important;color:#fff!important;}*,*::before,*::after{box-sizing:border-box;}.fr-filter-backdrop{position:absolute;inset:0;display:grid;place-items:center;padding:12px;background:rgba(0,0,0,.68);}.fr-filter-modal{position:relative;display:flex;flex-direction:column;width:min(50vw,1300px);height:min(50vh,600px);min-width:0;min-height:0;overflow:hidden;color:#fff;background:linear-gradient(110deg,#101412 0%,#151a18 50%,#101412 100%);font-family:Arial,Helvetica,sans-serif;}.fr-filter-title{display:grid;place-items:center;flex:0 0 9%;min-height:0;padding:0 8px;text-align:center;background:rgba(0,0,0,.32);font-size:clamp(24px,1.9vw,34px);line-height:1.1;}.fr-filter-kind{display:grid;flex:0 0 9.3%;min-height:0;grid-template-columns:minmax(0,1fr) minmax(0,1fr);width:100%;overflow:hidden;}.fr-filter-kind button{display:grid;place-items:center;width:100%;min-width:0;height:100%;margin:0;padding:3px 6px;border:0;border-radius:0;color:#fff;background:rgba(0,0,0,.2);font:700 clamp(18px,1vw,22px)/1.2 Arial,Helvetica,sans-serif;white-space:nowrap;cursor:pointer;}.fr-filter-kind button[aria-selected="true"]{color:#111;background:#fff;}.fr-filter-rating-title,.fr-filter-count-title{display:grid;place-items:center;flex:0 0 5.3%;min-height:0;padding:0 6px;text-align:center;background:rgba(0,0,0,.45);font-size:clamp(16px,.9vw,18px);line-height:1.1;}.fr-filter-rating-grid{display:grid;flex:0 0 34%;min-width:0;min-height:0;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));column-gap:1.1%;row-gap:1.2vh;padding:8px .7%;}.fr-filter-rating{display:grid;place-items:center;width:100%;height:100%;min-width:0;min-height:0;margin:0;padding:0;border:0;border-radius:0;color:#fff;background:#0b0d0c;font:400 clamp(16px,.9vw,20px)/1 Arial,Helvetica,sans-serif;cursor:pointer;touch-action:manipulation;}.fr-filter-rating:hover{background:#171b19;}.fr-filter-rating[aria-pressed="true"]{outline:2px solid #00b9ee;outline-offset:-2px;background:#111e21;}.fr-filter-custom-list{display:none;flex:1 1 auto;min-height:0;flex-direction:column;gap:5px;overflow:auto;padding:8px 10px;}.fr-filter-custom-summary{flex:0 0 auto;color:#aebfc8;font-size:12px;text-align:center;}.fr-filter-custom-row{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:34px;padding:5px 9px;border:1px solid rgba(255,255,255,.1);color:#fff;background:rgba(0,0,0,.24);font:12px Arial,Helvetica,sans-serif;text-align:left;cursor:pointer;}.fr-filter-custom-row[aria-pressed="true"]{border-color:#00b9ee;background:rgba(0,185,238,.12);}.fr-filter-custom-name{min-width:0;overflow:hidden;color:#ffd447;font-weight:700;text-overflow:ellipsis;white-space:nowrap;}.fr-filter-custom-data{flex:0 0 auto;color:#d8e4e8;font-size:11px;white-space:nowrap;}.fr-filter-custom-player{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px;padding:3px 9px;border-bottom:1px solid rgba(255,255,255,.08);font-size:11px;}.fr-filter-custom-player-name{min-width:0;overflow:hidden;color:#dbe7e9;text-overflow:ellipsis;white-space:nowrap;}.fr-filter-custom-player-data{flex:0 0 auto;color:#aebfc8;white-space:nowrap;}.fr-filter-custom-empty{margin:auto;color:#aebfc8;font-size:13px;text-align:center;}.fr-filter-modal.is-custom .fr-filter-rating-title,.fr-filter-modal.is-custom .fr-filter-rating-grid,.fr-filter-modal.is-custom .fr-filter-count-title,.fr-filter-modal.is-custom .fr-filter-count{display:none;}.fr-filter-modal.is-custom .fr-filter-custom-list{display:flex;}.fr-filter-count{display:flex;flex:0 0 10.5%;align-items:flex-end;justify-content:center;min-height:0;padding:0 12px;}.fr-filter-count button{display:grid;place-items:center;flex:0 0 clamp(30px,1.6vw,60px);width:clamp(30px,1.6vw,60px);height:80%;min-height:0;margin:0;padding:0;border:0;border-radius:0;color:#101010;background:#fff;font:700 clamp(16px,.85vw,22px)/1 Arial,Helvetica,sans-serif;cursor:pointer;}.fr-filter-count button:first-child{border-radius:24px 0 0 24px;}.fr-filter-count button:last-child{border-radius:0 24px 24px 0;}.fr-filter-count-value{display:grid;place-items:center;width:min(18.2vw,680px);height:80%;min-height:0;background:rgba(0,0,0,.25);font-size:clamp(16px,.8vw,22px);}.fr-filter-footer{display:flex;flex:0 0 26.6%;min-height:0;flex-direction:column;}.fr-filter-submit,.fr-filter-cancel{display:flex;align-items:center;flex:1 1 50%;width:100%;min-height:0;margin:0;padding:0 1.2%;border:0;border-radius:0;text-align:left;color:#fff;background:transparent;font:400 clamp(18px,1.05vw,24px)/1.2 Arial,Helvetica,sans-serif;cursor:pointer;}.fr-filter-submit{padding:7px 1.2% 0;border-bottom:1px solid rgba(255,255,255,.2);}.fr-filter-cancel{padding:0 1.2% 7px;color:#ff573b;}@media(max-width:700px){.fr-filter-modal{width:min(92vw,1300px);height:min(70vh,600px)}.fr-filter-title{font-size:clamp(22px,4.5vw,30px)}.fr-filter-rating-title,.fr-filter-count-title{font-size:clamp(15px,2.8vw,18px)}.fr-filter-rating{font-size:clamp(15px,3vw,18px)}.fr-filter-count-value{width:min(35vw,680px)}}';

  // src/ui/modals/filterModal.js
  function openFilterModal(mode) {
    document.querySelector(".fr-filter-overlay")?.remove();
    state.filterDraft = { kind: state.targetFilter.kind, ratings: state.targetFilter.ratings.slice(0, 1), count: state.targetFilter.count };
    const overlay = document.createElement("div");
    overlay.className = "fr-filter-overlay";
    const shadow = overlay.attachShadow({ mode: "open" });
    shadow.innerHTML = "<style>" + filterModalCss + '</style><div class="fr-filter-backdrop"><div class="fr-filter-modal" role="dialog" aria-modal="true" aria-label="Kay\u0131tl\u0131 Filtreler"><div class="fr-filter-title">Kay\u0131tl\u0131 Filtreler</div><div class="fr-filter-kind" role="tablist"><button type="button" data-kind="cheap" role="tab" aria-selected="' + (state.filterDraft.kind === "cheap") + '">En ucuz</button><button type="button" data-kind="custom" role="tab" aria-selected="' + (state.filterDraft.kind === "custom") + '">\xD6zel</button></div><div class="fr-filter-rating-title">Reyting Se\xE7ici</div><div class="fr-filter-rating-grid"></div><div class="fr-filter-custom-list"></div><div class="fr-filter-count-title">En ucuz say\u0131s\u0131</div><div class="fr-filter-count"><button type="button" data-count="-1" aria-label="En ucuz say\u0131s\u0131n\u0131 azalt">-</button><span class="fr-filter-count-value">5</span><button type="button" data-count="1" aria-label="En ucuz say\u0131s\u0131n\u0131 art\u0131r">+</button></div><div class="fr-filter-footer"><button type="button" class="fr-filter-submit">' + (mode === "save" ? "Kaydet" : "Y\xFCkle") + '</button><button type="button" class="fr-filter-cancel">\u0130ptal</button></div></div></div>';
    document.body.appendChild(overlay);
    const modal2 = shadow.querySelector(".fr-filter-modal");
    const ratingGrid = modal2.querySelector(".fr-filter-rating-grid");
    const countValue = modal2.querySelector(".fr-filter-count-value");
    const ratingTitle = modal2.querySelector(".fr-filter-rating-title");
    const customList = modal2.querySelector(".fr-filter-custom-list");
    const renderCustomTargets = () => {
      customList.replaceChildren();
      const summary = document.createElement("div");
      summary.className = "fr-filter-custom-summary";
      summary.textContent = state.savedTargetLists.length ? "Kay\u0131tl\u0131 listeler \xB7 " + state.savedTargetLists.length : "Hen\xFCz \xF6zel liste kaydedilmedi.";
      customList.appendChild(summary);
      if (!state.savedTargetLists.length) {
        const empty = document.createElement("div");
        empty.className = "fr-filter-custom-empty";
        empty.textContent = "Oyuncu Hedefleri b\xF6l\xFCm\xFCnden Kaydet\u2019e bas\u0131n.";
        customList.appendChild(empty);
        return;
      }
      state.savedTargetLists.forEach((savedList) => {
        const row = document.createElement("button");
        row.className = "fr-filter-custom-row";
        row.type = "button";
        row.dataset.listId = savedList.id;
        row.setAttribute("aria-pressed", String(savedList.id === state.selectedSavedTargetListId));
        const name = document.createElement("span");
        name.className = "fr-filter-custom-name";
        name.textContent = savedList.name;
        const details = document.createElement("span");
        details.className = "fr-filter-custom-data";
        details.textContent = savedList.players.length + " oyuncu";
        row.append(name, details);
        row.addEventListener("click", () => {
          state.selectedSavedTargetListId = savedList.id;
          renderCustomTargets();
        });
        customList.appendChild(row);
      });
      const selectedList = state.savedTargetLists.find((list) => list.id === state.selectedSavedTargetListId);
      if (selectedList) selectedList.players.forEach((player) => {
        const row = document.createElement("div");
        row.className = "fr-filter-custom-player";
        const name = document.createElement("span");
        name.className = "fr-filter-custom-player-name";
        name.textContent = player.name + (player.rating ? " \xB7 " + player.rating : "");
        const details = document.createElement("span");
        details.className = "fr-filter-custom-player-data";
        details.textContent = "Searches " + player.searches + " \xB7 Buy Now " + Number(player.buyNow).toLocaleString("tr-TR");
        row.append(name, details);
        customList.appendChild(row);
      });
    };
    const renderRatings = () => {
      ratingGrid.innerHTML = Array.from({ length: 12 }, (_, index) => 81 + index).map(
        (rating) => '<button class="fr-filter-rating" type="button" data-rating="' + rating + '" aria-pressed="' + state.filterDraft.ratings.includes(rating) + '">' + rating + "</button>"
      ).join("");
      ratingGrid.querySelectorAll("[data-rating]").forEach((button) => button.addEventListener("click", () => {
        const rating = Number(button.dataset.rating);
        const ratings = state.filterDraft.ratings;
        state.filterDraft.ratings = ratings.includes(rating) ? [] : [rating];
        ratingTitle.textContent = "Reyting Se\xE7ici";
        ratingGrid.querySelectorAll("[data-rating]").forEach((item) => item.setAttribute("aria-pressed", String(Number(item.dataset.rating) === state.filterDraft.ratings[0])));
      }));
    };
    renderRatings();
    renderCustomTargets();
    countValue.textContent = String(state.filterDraft.count);
    const setKind = (kind) => {
      state.filterDraft.kind = kind;
      modal2.classList.toggle("is-custom", kind === "custom");
      modal2.querySelectorAll("[data-kind]").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.kind === kind)));
    };
    modal2.querySelectorAll("[data-kind]").forEach((button) => button.addEventListener("click", () => {
      setKind(button.dataset.kind);
    }));
    setKind(state.filterDraft.kind);
    modal2.querySelectorAll("[data-count]").forEach((button) => button.addEventListener("click", () => {
      state.filterDraft.count = Math.max(1, state.filterDraft.count + Number(button.dataset.count));
      countValue.textContent = String(state.filterDraft.count);
    }));
    modal2.querySelector(".fr-filter-cancel").addEventListener("click", () => overlay.remove());
    shadow.querySelector(".fr-filter-backdrop").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) overlay.remove();
    });
    modal2.querySelector(".fr-filter-submit").addEventListener("click", () => {
      if (mode === "load" && state.filterDraft.kind === "cheap" && !state.filterDraft.ratings.length) {
        ratingTitle.textContent = "L\xFCtfen reyting se\xE7in";
        return;
      }
      const nextFilter = { kind: state.filterDraft.kind, ratings: state.filterDraft.ratings.slice(), count: state.filterDraft.count };
      state.targetFilter = nextFilter;
      if (mode === "load" && nextFilter.kind === "custom" && !state.savedTargetLists.length) {
        customList.querySelector(".fr-filter-custom-summary").textContent = "\xD6nce Oyuncu Hedefleri b\xF6l\xFCm\xFCnden bir liste kaydedin.";
        return;
      }
      overlay.remove();
      const targetContent = panel.querySelector(".fc-snipe-tab-content");
      if (targetContent && state.activePanelTab === "targets") renderTargetContent(targetContent);
      if (mode === "load" && nextFilter.kind === "cheap") importCheapestTargets(nextFilter.ratings[0], nextFilter.count);
      if (mode === "load" && nextFilter.kind === "custom") {
        const restored = restoreSavedTargets();
        const loadedList = state.savedTargetLists.find((list) => list.id === state.selectedSavedTargetListId);
        setTargetStatus({ type: "success", message: "\u201C" + (loadedList ? loadedList.name : "\xD6zel liste") + "\u201D listesinden " + restored + " oyuncu adet ve fiyat bilgileriyle aktar\u0131ld\u0131." });
        if (targetContent && state.activePanelTab === "targets") renderTargetContent(targetContent);
      }
    });
  }
  function registerModalEvents2() {
    on("ui:open-filter-modal", ({ mode }) => openFilterModal(mode));
  }

  // src/ea/captchaDetector.js
  var CAPTCHA_SELECTORS = [
    'iframe[src*="arkoselabs"]',
    'iframe[src*="funcaptcha"]',
    "#fc-iframe-wrap",
    "#Arkose",
    "#arkose",
    '[data-theme="arkose"]',
    '[id*="arkose" i]',
    '[id*="funcaptcha" i]',
    '[class*="arkose" i]',
    '[class*="funcaptcha" i]'
  ];
  function isCaptchaElement(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = (node.tagName || "").toLowerCase();
    if (tag === "iframe") {
      const src = (node.getAttribute?.("src") || node.src || "").toLowerCase();
      if (src.includes("arkoselabs") || src.includes("funcaptcha")) return true;
    }
    const id = (node.id || "").toLowerCase();
    const className = (typeof node.className === "string" ? node.className : "").toLowerCase();
    if (id.includes("arkose") || id.includes("funcaptcha") || id.includes("fc-iframe-wrap")) return true;
    if (className.includes("arkose") || className.includes("funcaptcha")) return true;
    if (typeof node.querySelector === "function") {
      try {
        for (const sel of CAPTCHA_SELECTORS) {
          if (node.querySelector(sel)) return true;
        }
      } catch {
      }
    }
    return false;
  }
  function checkCaptchaInDom(root = document) {
    if (!root || typeof root.querySelector !== "function") return false;
    try {
      for (const sel of CAPTCHA_SELECTORS) {
        if (root.querySelector(sel)) return true;
      }
    } catch {
    }
    return false;
  }
  function isEaUrl(url) {
    if (!url || typeof url !== "string") return false;
    const u = url.toLowerCase();
    if (u.includes("arkoselabs") || u.includes("funcaptcha")) return false;
    return u.includes("utas.") || u.includes("/ut/game/") || u.includes("ea.com/ea-sports-fc") || u.includes("ea.com/fifa");
  }
  var observerInstance = null;
  var hookedWindows = /* @__PURE__ */ new WeakSet();
  function initDomCaptchaDetector(deps = {}) {
    const doc = deps.document || (typeof document !== "undefined" ? document : null);
    if (!doc) return null;
    const target = doc.body || doc.documentElement;
    if (!target) return null;
    if (checkCaptchaInDom(doc)) {
      SafetyGovernor.halt("captcha");
    }
    const ObserverClass = deps.MutationObserver || (typeof MutationObserver !== "undefined" ? MutationObserver : null);
    if (!ObserverClass) return null;
    const observer4 = new ObserverClass((mutations) => {
      if (safetyGovernor.isCaptchaHalted()) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (node.nodeType === 1 && (isCaptchaElement(node) || checkCaptchaInDom(node))) {
            debug("[FutRUSH:captcha]", "Arkose/FunCaptcha DOM elementi tespit edildi.");
            SafetyGovernor.halt("captcha");
            return;
          }
        }
      }
    });
    try {
      observer4.observe(target, { childList: true, subtree: true });
    } catch {
    }
    return observer4;
  }
  function initNetworkCaptchaDetector(deps = {}) {
    const win2 = deps.window || pageWindow;
    if (!win2 || hookedWindows.has(win2)) return;
    hookedWindows.add(win2);
    if (typeof win2.fetch === "function") {
      const origFetch = win2.fetch;
      win2.fetch = async function(...args) {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        if (isEaUrl(url) && safetyGovernor.isCaptchaHalted()) {
          throw new Error("EA iste\u011Fi kilitlendi: Captcha \xE7\xF6z\xFClmesi bekleniyor.");
        }
        const response = await origFetch.apply(this, args);
        if (response && Number(response.status) === 458) {
          debug("[FutRUSH:captcha]", "EA a\u011F yan\u0131t\u0131nda 458 (Captcha) kodu tespit edildi (fetch).");
          SafetyGovernor.halt("captcha");
        }
        return response;
      };
    }
    if (typeof win2.XMLHttpRequest === "function") {
      const OrigXHR = win2.XMLHttpRequest;
      const origOpen = OrigXHR.prototype.open;
      const origSend = OrigXHR.prototype.send;
      OrigXHR.prototype.open = function(method, url, ...rest) {
        this.__frUrl = url;
        return origOpen.apply(this, [method, url, ...rest]);
      };
      OrigXHR.prototype.send = function(...args) {
        if (isEaUrl(this.__frUrl) && safetyGovernor.isCaptchaHalted()) {
          try {
            this.abort();
          } catch {
          }
          throw new Error("EA iste\u011Fi kilitlendi: Captcha \xE7\xF6z\xFClmesi bekleniyor.");
        }
        this.addEventListener("load", () => {
          if (Number(this.status) === 458) {
            debug("[FutRUSH:captcha]", "EA a\u011F yan\u0131t\u0131nda 458 (Captcha) kodu tespit edildi (XHR).");
            SafetyGovernor.halt("captcha");
          }
        });
        return origSend.apply(this, args);
      };
    }
  }
  function syncCaptchaScreenBanner(deps = {}) {
    const doc = deps.document || (typeof document !== "undefined" ? document : null);
    if (!doc) return;
    let banner = doc.getElementById("fr-captcha-screen-banner");
    if (safetyGovernor.isCaptchaHalted()) {
      if (!banner && doc.body) {
        banner = doc.createElement("div");
        banner.id = "fr-captcha-screen-banner";
        banner.setAttribute("role", "alert");
        banner.style.cssText = [
          "position: fixed",
          "top: 0",
          "left: 0",
          "right: 0",
          "z-index: 9999999",
          "background: #dc2626",
          "color: #ffffff",
          "padding: 12px 20px",
          "box-shadow: 0 4px 20px rgba(0,0,0,0.5)",
          "display: flex",
          "align-items: center",
          "justify-content: space-between",
          "gap: 16px",
          "font-family: system-ui, -apple-system, sans-serif",
          "font-size: 13px",
          "font-weight: 700"
        ].join(";");
        banner.innerHTML = [
          '<div style="display:flex;align-items:center;gap:10px;">',
          '<span style="font-size:22px;">\u{1F6A8}</span>',
          "<span><strong>CAPTCHA TESP\u0130T ED\u0130LD\u0130!</strong> EA do\u011Frulamas\u0131 tamamlanana kadar t\xFCm bot ve EA istekleri durduruldu.</span>",
          "</div>",
          '<button type="button" id="fr-captcha-screen-resume-btn" style="background:#ffffff;color:#dc2626;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);">',
          "Captcha'y\u0131 \xE7\xF6zd\xFCm, devam et",
          "</button>"
        ].join("");
        doc.body.appendChild(banner);
        banner.querySelector("#fr-captcha-screen-resume-btn")?.addEventListener("click", () => {
          SafetyGovernor.resume();
        });
      } else if (banner) {
        banner.style.display = "flex";
      }
    } else if (banner) {
      banner.remove();
    }
  }
  function initCaptchaDetector(deps = {}) {
    observerInstance = initDomCaptchaDetector(deps);
    initNetworkCaptchaDetector(deps);
    on("governor:halt", () => syncCaptchaScreenBanner(deps));
    on("governor:resume", () => syncCaptchaScreenBanner(deps));
    syncCaptchaScreenBanner(deps);
    return {
      destroy: () => {
        if (observerInstance) {
          try {
            observerInstance.disconnect();
          } catch {
          }
          observerInstance = null;
        }
      }
    };
  }

  // src/main.js
  registry.register(createHubSyncModule(schedule));
  registry.register(logoButton_module_default);
  registry.register(panel_module_default);
  registry.register(futrushPage_module_default);
  registry.register(searchButton_module_default);
  registry.register(fitContent_module_default);
  registry.register(navButton_module_default);
  registry.register(detailLowestPrices_module_default);
  registerPanelEvents();
  registerModalEvents();
  registerModalEvents2();
  initCaptchaDetector();
  ensureBalanceObserver();
  syncBalance();
  loadCoreStorage();
  initAll();
  initDomEvents();
  sync();
  var win = typeof unsafeWindow !== "undefined" ? unsafeWindow : typeof window !== "undefined" ? window : null;
  if (win) {
    win.__FUTRUSH__ = { state, CONFIG, registry };
  }
})();
