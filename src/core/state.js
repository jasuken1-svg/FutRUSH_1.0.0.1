export const state = {
  geom: null,        // panelin pencere oranı olarak son ölçüsü {l, t, w, h}
  visible: true,     // son tıklanan ana menü Transfers mi (sekme okunamazsa yedek bilgi)
  panelOpen: false,  // SNIPE paneli logoyla açıldı mı
  panelExpanded: false, // SNIPE düğmesinden sekmeler açıldı mı
  activePanelTab: 'targets',
  snipeSettings: { repeat: 0, waitSeconds: 0, autoSell: false, maxPlayers: 1, speed: 0 },
  targetFilter: { kind: 'cheap', ratings: [], count: 5 },
  targets: [],
  savedTargetLists: [],
  selectedSavedTargetListId: null,
  botRunning: false,
  botToken: 0,
  botStatus: '',
  botLogs: [],
  targetLoading: false,
  targetStatus: null,
  filterDraft: null,
  logoPresent: false, // Consumables yanındaki logo şu an sayfada mı
  liveScroll: 0      // hub kaydırılmışsa panelin kartlarla birlikte kayması için
};
