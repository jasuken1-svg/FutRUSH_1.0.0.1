// Ozellik bayraklari, UI secicileri, panel yerlesimi ve FutBIN parametrelerini tanimlar.
// Bagimlilik: yalnizca uygulama genelinde tuketilen sabit degerler.

export const CONFIG = {
  showCardImages: true,
  ui: {
    statusHoldMs: 3000,
    statusErrorHoldMs: 6000
  },

  // Özellikleri aç/kapat (bozulan bir şeyi hızlıca devre dışı bırakmak için)
  features: {
    fitContent: true,       // alt sayfalarda içeriği panelin soluna sığdır
    settingsButton: true,   // sol menüdeki FutRUSH (Ayarlar) butonu
    searchButton: true,     // Reset / Search yanındaki FutRUSH butonu
    logoButton: true        // Consumables yanındaki logo (SNIPE panelini açan tek buton)
  },

  // SNIPE paneli
  panel: {
    id: 'fc-snipe-panel',
    storeKey: 'fc-snipe-panel-geom',
    widthRatio: 0.63,       // panel genişliği = kart bloğunun %63'ü
    gapRatio: 0.027,        // kartlarla arası = kart bloğunun %2.7'si
    sideMargin: 16,
    edge: 8,                // pencere kenarlarına / üst çubuğa bırakılan boşluk
    bg: 'rgba(21, 29, 41, .7)',                 // #151D29, %70 opaklık
    border: '1px solid rgba(255,255,255,.18)',
    radius: '6px',
    buttonText: 'SNIPE'
  },

  // Alt sayfalarda içeriği panelin soluna sığdırma
  fit: {
    leftMargin: 8,          // sol menü ile içerik arası
    gap: 12,                // içerik ile panel arası
    minScale: 0.5,
    expandY: true,          // ölçekleme yerine yüksekliği GENİŞLET (yazılar bozulmaz)
    maxExpandY: 3,          // yükseklik en fazla bu kadar katına çıkar (güvenlik sınırı)
    debug: false            // true: konsola ölçüm bilgisi yazar
  },

  // FutRUSH (Ayarlar) butonu ve penceresi
  nav: {
    id: 'futrush-nav',
    modalId: 'futrush-settings',
    defaultIcon: 26         // diğer menü ikonlarının boyutu okunamazsa kullanılır (px)
  },

  // Consumables yanındaki logo: SNIPE paneli SADECE bu logoya basınca açılır
  logoButton: {
    className: 'futrush-logo-btn',
    size: 40,                         // px (40x40)
    gap: 10,                          // Consumables ile logo arası (px)
    anchorPattern: /consumables/i,    // sekmeyi yazısından tanır (dil değişirse buraya ekle)
    title: 'FutRUSH Snipe'
  },

  // Reset / Search yanındaki FutRUSH butonu
  searchButton: {
    className: 'futrush-search-btn',
    label: 'Ekle FutRUSH',
    resetPattern: /reset|sıfırla/i,   // Reset butonunu yazısından tanır (dil değişirse buraya ekle)
    debug: false                      // true: konsola ölçüm bilgisi yazar
  },

  // Hedef eklerken EA piyasa fiyatı araması
  targetAdd: {
    priceSource: 'ea',
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
    baseUrl: 'https://www.futbin.com/27/players',
    apiBaseUrl: 'https://www.futbin.org/futbin/api/27/getFilteredPlayers',
    platform: 'console',
    version: '',
    preferApi: true,
    maxPages: 20,
    pageDelay: 350,
    ratingParam: 'player_rating',
    pageParam: 'page',
    sortParam: 'sort',
    priceRangeParam: 'ps_price',
    pcPriceRangeParam: 'pc_price',
    priceRange: '200-15000000',
    orderParam: 'order',
    selectors: {
      rows: 'tr.player-row',
      nameLink: 'a.table-player-name[href*="/player/"], a[href*="/player/"]',
      name: 'td.table-name',
      rating: 'td.table-rating',
      ratingFallback: '[class*="rating"]',
      consolePrice: 'td.platform-ps-only .price, td.platform-ps-only',
      pcPrice: 'td.platform-pc-only .price, td.platform-pc-only',
      image: "img[src*='/players/']",
      pageLinks: 'a[href*="page="]',
      emptyResultContainer: 'tbody',
      idPattern: /\/player\/(\d+)/i
    }
  },

  // Zamanlama
  timing: {
    tailDelay: 400          // geçiş animasyonları bittikten sonra bir kez daha ölç (ms)
  }
};

export const P = CONFIG.panel;
export const F = CONFIG.fit;
export const N = CONFIG.nav;
