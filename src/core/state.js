// UI, hedefler ve bot tarafindan paylasilan calisma zamani durumunu tutar.
// Bagimlilik: yalnizca veri tanimlari.

export const state = {
  geom: null,        // panelin pencere oranı olarak son ölçüsü {l, t, w, h}
  visible: true,     // son tıklanan ana menü Transfers mi (sekme okunamazsa yedek bilgi)
  panelOpen: false,  // SNIPE paneli logoyla açıldı mı
  panelExpanded: false, // SNIPE düğmesinden sekmeler açıldı mı
  activePanelTab: 'targets',
  snipeSettings: { repeat: 0, waitSeconds: [15, 35], autoSell: false, maxPlayers: 1, speed: 0, maxSpendCoins: 0 },
  targetFilter: { kind: 'cheap', ratings: [], count: 5 },
  targets: [],
  savedTargetLists: [],
  selectedSavedTargetListId: null,
  botRunning: false,
  botToken: 0,
  botStatus: '',
  botLogs: [],
  botLogId: 0,
  botStats: { bought: 0, missed: 0, searches: 0, errors: 0 },
  botWait: null,
  targetLoading: false,
  targetStatus: null,
  filterDraft: null,
  logoPresent: false, // Consumables yanındaki logo şu an sayfada mı
  liveScroll: 0      // hub kaydırılmışsa panelin kartlarla birlikte kayması için
};
