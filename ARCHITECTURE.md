# FutRUSH mimarisi

## Klasor haritasi

| Klasor | Sorumluluk |
|---|---|
| `src/` | Userscript giris noktasi (`main.js`) ve paket metadata'si (`meta.txt`). |
| `src/core/` | `CONFIG`, paylasilan `state`, olay bus'i, modul registry'si, loglama, DOM olaylari, depolama yukleme ve sync zamanlayicisi. |
| `src/ui/` | EA sayfasina eklenen arayuz bilesenleri: logo/arama/navigasyon dugmeleri, SNIPE paneli, sekmeler, modal ve UI olay dinleyicileri. |
| `src/ui/panel/` | Panel iskeleti, stilleri, sekme yonetimi ve panel icin event tepkileri. |
| `src/ui/panel/tabs/` | Hedefler, bot ayarlari ve bot loglari sekmelerinin cizimi. |
| `src/ui/modals/` | Hedef filtresi ve kayitli hedef listesi modal pencereleri ile stilleri. |
| `src/targets/` | Hedef kaydi normalizasyonu, kalici depolama, birlestirme, kayitli listeler ve EA'de secilmis oyuncu islemleri. |
| `src/bot/` | Otomatik alici dongusu ile bot durum/log yayinlari. |
| `src/ea/` | EA sayfa durumu, Transfer Market arama/satin alma servisleri, istek gozlemleme ve coin bakiyesi adaptoru. |
| `src/futbin/` | FutBIN adresleri ve istekleri, HTML/API ayrıştırma, oyuncu kimligi cozumleme ve liste yukleme. |
| `src/layout/` | Hub kartlarindan panel geometrisi olcme ve hub disinda sayfa icerigini sigdirma. |
| `src/utils/` | Sayfa DOM/pencere adaptoru, fiyat ve metin normalizasyonu, gecikme yardimcisi. |
| `legacy/` | Modullestirme oncesi `futrush_v21.js`; yalnizca referans amacli. |
| `scripts/` | Kaynak dogrulama ve `MIGRATION_MAP.md` uretim scriptleri. |
| `test/` | Vitest testleri; test klasorleri kaynak modullerin alanlarini izler. |
| `dist/` | Build ciktilari (`futrush.user.js`, gelistirme userscript'i); elle duzenlenmemelidir. |
| `docs/` | Gelistirme prompt'lari ve proje belgeleri. |

## Katman kurali

Beklenen bagimlilik yonu yukaridan asagiya dogrudur:

```text
ui -> targets / bot -> ea / futbin -> utils / core
```

- `ui/` kullanici etkilesimini ve cizimi sahiplenir; is kurallarini `targets/` veya `bot/` araciligiyla cagirir.
- `targets/` ve `bot/` hedef/bot is kurallarini sahiplenir; sayfa servislerine `ea/` ve veri kaynagina `futbin/` uzerinden erisir.
- `ea/` ve `futbin/` dis sistem adaptoru katmanidir; ortak konfigurasyon, state ve yardimcilardan daha yukari katmanlara baglanmaz.
- `utils/` ve `core/` alt seviye paylasilan temeldir. UI'ye bagimlilik eklenmez; moduller arasi UI tepkileri olay bus'i ile bildirilir.
- Katmanlar arasi geri bagimlilik olusturmayin. `main.js` kompozisyon kokudur: modulleri birbirine kaydeder ama is mantigini tasimaz.

## Modul sozlesmesi

`core/registry.js` su alanlara sahip modulleri kaydeder:

| Alan | Sozlesme |
|---|---|
| `name` | Loglarda kullanilan modul adi. |
| `feature` | Istege bagli `CONFIG.features` anahtari. Deger `false` ise modul calistirilmaz. |
| `init()` | Modulu hazirlar; opsiyoneldir. `initOrder` kucukten buyuge calisir; tanimsiz deger en sona gider. |
| `sync(context)` | Her sayfa senkronizasyonunda calisir; opsiyoneldir. Context `{ onHub, marketTile }` seklindedir. |
| `destroy()` | Modulu kapatir/temizler; opsiyoneldir. |

`registry.register({ name, feature, init, sync, destroy, initOrder })` ekleme noktasidir. `initAll`, `syncAll` ve `destroyAll` metod cagrilarini ayri ayri try/catch ile sinirlar ve hatalari `[FutRUSH:<modul>]` onekiyle logger'a yazar. Sync sirasi kayit sirasidir; init sirasi `initOrder` ile belirlenir.

## Event listesi

Tum event'ler `core/events.js` uzerinden isim ve opsiyonel argumanlarla yayinlanir. Mevcut event listener'lar payload'i pozisyonel arguman veya nesne olarak alir.

| Event | Yayan | Dinleyen | Payload |
|---|---|---|---|
| `layout:request-sync` | `ui/logoButton.js` (logo dugmesine tiklama) | `core/scheduler.js` | Arguman yok; aninda `sync()` ister. |
| `targets:changed` | `targets/targetOps.js`, `targets/futbinImport.js`, `targets/pinnedPlayer.js`, `ui/modals/saveDialog.js` | `ui/panel/panelEvents.js` | Arguman yok; panel aciksa secili hedef sekmesini yeniler. |
| `log:added` | `bot/botLog.js` / `addBotLog` | `ui/panel/panelEvents.js` | Arguman yok; log sekmesi aciksa loglari yeniler. |
| `bot:status` | `bot/botLog.js` / `setBotStatus` | `ui/panel/panelEvents.js` | Arguman yok; ayarlar sekmesi aciksa durum ve dugme etiketini yeniler. |
| `ui:open-save-dialog` | `ui/panel/tabs/targetsTab.js` | `ui/modals/saveDialog.js` | Arguman yok; hedef listesini kaydetme modalini acar. |
| `ui:open-filter-modal` | `ui/panel/tabs/targetsTab.js` | `ui/modals/filterModal.js` | `{ mode: 'load' }`; hedef filtresi/kayitli liste modalini acar. |

Yeni bir moduller arasi etki gerekiyorsa dogrudan UI modulu cagirmak yerine event yayinlayin; mevcut event adlarini degistirirken hem yayini hem dinleyicileri guncelleyin.

## Baslangic ve sync sirasi

`src/main.js` modulleri sirayla registry'ye kaydeder, panel/modal event dinleyicilerini baglar, `initAll()` cagirir, DOM olay gozlemcisini kurar ve ilk `sync()` cagrisi ile sayfayi yerlestirir. `initAll()` modul init'lerini `initOrder` degerine gore siralar.

`core/scheduler.js` her sync'te `.ut-tile-transfer-market` hub kartini ve gorunurlugunu olcer, ardindan `{ onHub, marketTile }` context'ini `syncAll()`'a verir. Registry'deki sync cagri sirasi ve gerekcesi:

1. `hubSync`: hub kartlarini olcer, panel geometrisini gunceller/kaydeder ve ResizeObserver'a `schedule` callback'ini kullanir. Olculer sonraki UI yerlesimleri icin once hazir olmalidir.
2. `logoButton`: Consumables yanindaki logoyu bulur ve konumlandirir; gorunurluk/panel durumunun panel geometrisinden once hesaplanmasi gerekir.
3. `panel`: panelin mevcut geometri ve aciklik durumunu uygular.
4. `searchButton`: arama satirina dugmeyi yerlestirir; sonraki icerik olcumunun dogal boyutla yapilmasi icin bu adim fit isleminin onundedir.
5. `fitContent`: hub disi icerigi panelin yanina sigdirir.
6. `navButton`: sol navigasyon dugmesini son layout olculeriyle yerlestirir.

`schedule()` ayni frame icindeki tekrar cagrilari birlestirir ve gecis animasyonlari icin `CONFIG.timing.tailDelay` sonunda bir son sync daha calistirir. Hub `ResizeObserver` callback'i `layout/hubSync.js` icine disaridan enjekte edilir.

## Kalici depolama

`utils/dom.js` icindeki `pageStorage()` sayfanin `localStorage`'ini kullanir.

| Anahtar | Okuma/yazma | Icerik ve sahip |
|---|---|---|
| `fc-snipe-panel-geom` | Okuma: `core/storage.js`; yazma: `layout/hubSync.js` | Panel geometrisi `{ l, t, w, h }` oranlari; anahtar adi `CONFIG.panel.storeKey` ile gelir. |
| `futrush-saved-target-filter` | Okuma: `core/storage.js` | Kayitli filtre `{ kind, ratings, count }`; yalnizca gecerli degerler state'e yuklenir. |
| `futrush-targets` | Okuma/yazma: `targets/targetStore.js` | Aktif hedef oyunculari. |
| `futrush-saved-targets` | Okuma/yazma: `targets/targetStore.js` | Kayitli oyuncu listeleri; eski duz liste formati icin uyumluluk donusumu vardir. |

## `CONFIG.features` bayraklari

Bayraklar `src/core/config.js` icindedir; registry modulunun `feature` alaniyla eslesir. `false` degeri ilgili modulun registry tarafindan calistirilmasini durdurur.

| Bayrak | Varsayilan | Modul |
|---|---:|---|
| `fitContent` | `true` | `layout/fitContent.module.js` |
| `settingsButton` | `true` | `ui/navButton.module.js` |
| `searchButton` | `true` | `ui/searchButton.module.js` |
| `logoButton` | `true` | `ui/logoButton.module.js` |

SNIPE paneli ozellik bayragina bagli degildir; panel modulu her zaman kayit edilir. EA/FutBIN secicileri de ayni dosyanin `CONFIG.futbin.selectors` ve dugme alanlarinda tutulur.

## Yeni ozellik ekleme

Ornek: Transfers ekranina yeni bir UI modulu eklemek.

1. Isin katmanini secin: arayuz `src/ui/`, hedef davranisi `src/targets/` veya bot isi `src/bot/` altinda olsun. Servis/format ayrintilarini kendi katmanina yerlestirin.
2. Ozellik icin bir modul dosyasi olusturun; `name`, gerekiyorsa `feature`, ve uygun `init`, `sync(context)`, `destroy` metodlarini tanimlayin. Gereksiz metodlari eklemeyin.
3. Ozellik kapatilabilir olacaksa `CONFIG.features` altina varsayilan `true` bayragi ekleyin ve modulde ayni anahtari `feature` olarak kullanin.
4. `src/main.js` icine modul import'unu ve `registry.register(...)` kaydini ekleyin. Sync bagimliliklarina gore kayit sirasini, init bagimliliklarina gore `initOrder` degerini belirleyin.
5. Baska bir katmanin UI'yi dogrudan cagirmasi gerekiyorsa bagimlilik yonunu ters cevirmeyin; `core/events.js` ile event yayinlayip UI tarafinda dinleyin. Payload'i ve tum dinleyicileri belgeleyin.
6. Mantigi kapsayan Vitest testini `test/` altina ekleyin; ardindan `npm run build`, `npm run lint` ve `npm test` calistirin.
7. Modul sozlesmesini, olaylari, sync sirasi veya sorumluluk tablosunu degistirdiyseniz bu dosyayi da guncelleyin.

## Belirti -> bakilacak dosya

| Belirti | Ilk bakilacak yer |
|---|---|
| Logo cikmiyor/yanlis yerde | `src/ui/logoButton.js` ve `src/core/config.js` icindeki logo/selector degerleri. |
| FutBIN oyuncu listesi yuklenmiyor | `src/futbin/loader.js`; ayrica `src/futbin/http.js`, parser'lar ve `src/core/config.js` FutBIN ayarlari. |
| Bot alim yapmiyor | `src/ea/market.js` ve `src/bot/autoBuyer.js`; EA istekleri icin `src/ea/observe.js` ve `src/ea/services.js`. |
| Panel yanlis yerde | `src/layout/hubSync.js`; ayrica `src/core/config.js` panel geometri degerleri ve `src/ui/panel/panel.js`. |
| Arama dugmesi gorunmuyor | `src/ui/searchButton.js` ve `src/core/config.js` icindeki `searchButton` secicileri. |
| Ayar dugmesi cikmiyor | `src/ui/navButton.js`, `src/ui/navButton.module.js` ve `CONFIG.features.settingsButton`. |
| Hedef listesi kayboluyor/duzgun kaydolmuyor | `src/targets/targetStore.js` ve `src/core/storage.js` localStorage anahtarlari. |
| Panel icerigi eski kaliyor | `src/ui/panel/panelEvents.js` ve degisiklik event'ini yayinlayan `src/targets/` ya da `src/bot/` modulu. |
