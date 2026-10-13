# FutRUSH

EA FC 27 Web App icin Tampermonkey userscript'i. Uygulama `src/` altinda modullere ayrilir ve build sonucunda `dist/futrush.user.js` dosyasina birlesir.

## Kurulum

Node.js ve npm kurulu olmalidir. Bagimliliklari kurup userscript'i olusturun:

```sh
npm install
npm run build
```

Olusan `dist/futrush.user.js` dosyasini Tampermonkey'e ekleyin. `legacy/futrush_v21.js` onceki tek dosyali surumdur; referans olarak saklanir, duzenlenmemelidir.

## Gelistirme

```sh
npm run dev
```

`dist/futrush.dev.user.js` dosyasini Tampermonkey'e bir kez kurun ve tarayici eklentisinde "Allow access to file URLs" secenegini acin. Watch build sonrasinda EA sayfasini yenilemek yeterlidir. Uretim ve dev userscript'lerini ayni anda etkinlestirmeyin; ayni DOM kimliklerini ve localStorage anahtarlarini kullanirlar.

## Dogrulama

```sh
npm run build
npm run lint
npm test
```

Legacy fonksiyonlarinin yeni kaynak dosyalarindaki karsiligini yeniden olusturmak icin:

```sh
npm run migration-map
```

Komut `MIGRATION_MAP.md` dosyasini gunceller ve karsiligi bulunamayan fonksiyonlari terminalde bildirir.

## Klasor ozeti

- `src/`: Uygulama kaynak kodu ve userscript metadata'si.
- `src/core/`: Yapilandirma, ortak state, olaylar, registry ve sync zamanlayicisi.
- `src/ui/`: Panel, butonlar, modallar ve UI olay dinleyicileri.
- `src/targets/`: Hedef oyuncu listesi ve hedef islemleri.
- `src/bot/`: Otomatik alici ve bot log/durum yonetimi.
- `src/ea/`: EA sayfa, servis, pazar ve istek adaptorlari.
- `src/futbin/`: FutBIN URL, HTTP, parser, oyuncu kimligi ve yukleyici modulleri.
- `src/layout/`: Hub panel esleme ve icerik sigdirma davranisi.
- `src/utils/`: DOM, metin, fiyat bicimlendirme ve asenkron yardimcilar.
- `legacy/`: Onceki tek dosyali surum (salt referans).
- `scripts/`: Kaynak denetimi ve migration-map uretim scriptleri.
- `test/`: Vitest birim testleri.
- `dist/`: Build tarafindan uretilen userscript ciktilari; elle duzenlenmez.
- `docs/`: Gelistirme prompt'lari ve proje notlari.

## Mimari

Katmanlar, moduller arasi bagimliliklar, olaylar ve sync kurallari icin [ARCHITECTURE.md](./ARCHITECTURE.md) dosyasina bakin.
