# FutRUSH — Claude devir notu

Son güncelleme: 2026-10-17
Amaç: Yeni Claude sohbetinin mevcut kod, tamamlanan işler, commit geçmişi ve açık doğrulama adımlarını hızlıca devralması.

## Hızlı durum

- Proje: EA FC 27 Web App için Tampermonkey userscript'i.
- Kaynak: `src/` altındaki ES modülleri; derleme çıktısı `dist/futrush.user.js`.
- Referans tek dosya: `legacy/futrush_v21.js`; taşıma planı `PLAN.md`.
- Dal: `master`; bu not ilk yazılırken kaynak HEAD `f2c00f1` idi. Devir notu `104a04a` (`Claude devir notunu ekle`) commit'inde eklendi; sonraki belge güncellemesinin tabanı `0ac4ce0` idi. Bu dosya mevcut HEAD hash'ini sabitlemez; güncel durum için `git log -1` kullan.
- `f2c00f1`, bu belgenin hazırlanma anındaki kaynak commit'ini belirtir; belgenin kendi commit hash'i değildir. Devir notunun ilk yazım anında ve son doğrulama geçişinde çalışma ağacı temizdi.
- Aşama 1–6 tamamlanmış görünüyor. `MIGRATION_MAP.md` legacy'deki 60 top-level fonksiyonun 60'ının da yeni kaynakta eşleştiğini kaydediyor.
- Son yerel doğrulamada `npm test` başarılı: 24 test dosyası, 229 test geçti. `npm run build` başarılı; `dist/futrush.user.js` 180.2 KB olarak üretildi.
- Çalışan EA FC Web App üzerinde Tampermonkey ile manuel/gerçek kullanıcı akışı doğrulaması ilk yazım anında ve son doğrulama geçişinde yapılmadı (doğrulanamadı).

## Mimari ve çalışma kuralları

- `src/main.js` modülleri birleştiren giriş noktası; `src/meta.txt` userscript header'ını taşır.
- Katman yönü: `ui → targets/bot → ea/futbin → utils/core`. EA erişimi `src/ea/` altında kalmalı; iş mantığı UI'ı import etmemeli.
- Modül sözleşmesi ve hata yalıtımı `src/core/registry.js` içindedir. UI dışı modüllerle UI arasındaki iletişim `src/core/events.js` üzerinden yapılır.
- Sabit sync sırası: `syncFromHub → placeLogoButton → applyGeom → placeSearchButton → fitContent → placeNav`.
- Hedef normalizasyonu `normalizeTarget(item, mode)` için `live` ve `savedList` modlarının davranışları bilerek ayrı tutulmalı.
- Davranış değişikliği, seçici/regex/gecikme/CSS/Türkçe metin değişikliği yapmadan önce `legacy/futrush_v21.js` ile karşılaştırma gerekir.
- Proje yönergeleri: `.github/copilot-instructions.md`; taşıma planı: `PLAN.md`; aşama prompt'ları: `docs/PROMPTS.md`; mimari: `ARCHITECTURE.md`.

## Tamamlanan çalışmalar

### Modülerleştirme (Aşama 1–6)

- v21 tek dosyalı kaynak, `src/` altında modüllere ayrıldı; `npm run build` tek userscript dosyası üretir.
- Core, utils, EA ve FutBIN modülleri ayrıldı.
- Hedef/bot mantığı ayrıldı; olay bus'ı kullanıma alındı.
- UI, panel, sekme, modal ve butonlar modüllere taşındı.
- Layout, scheduler ve registry tamamlandı; kayıt ve sync sırası korunuyor.
- Birim testleri, mimari dokümanı ve legacy eşleme haritası eklendi.

### Modülerleştirme sonrası commit'lerde görülen ürün değişiklikleri

- FutBIN sorgusunda API birincil kaynak, HTML yedek kaynak haline getirildi.
- Tercihler, hata ayıklama ayarları ve SNIPE ayarlarının saklanması eklendi.
- Hedef ekleme akışına EA piyasa fiyatı (`lowestBin`) ve aralıklı ekleme eklendi.
- Otomatik alıcıya arama/tur arası gecikmeler, durdurulabilir bekleme ve satın alma hatası sınıflandırması eklendi.
- Panelde hedef durum kartı, log sekmesi, durum/bekleme göstergeleri ve ek satın alma/tur bilgileri eklendi.
- FutBIN oyuncu eşleştirmesine tam ad bulunamadığında ad parçalarıyla yedek arama eklendi.
- Yükleme akışında EA'nın %5 vergisi hesaba katıldı.
- Alım logları, kronolojik akış ve yeni EA oyuncu kimliği eşleşmesinde tek seferlik bildirim eklendi.
- Hedef fiyatı güncellenince sıralamanın korunması sağlandı.

## Commit geçmişi (devir belgesinin ilk eklendiği ana kadar)

Kronolojik sırada:

1. `2b85a78` — v21 + iskelet
2. `22b12ae` — Klasör yapısı düzeltildi, Aşama 1 build
3. `0927ac9` — Aşama 2: yaprak modüller
4. `164f04f` — Aşama 3: targets, bot, futbin ayrımı
5. `2885225` — Aşama 4a: panel ve sekmeler
6. `d4ba85f` — Aşama 4b: modallar ve butonlar
7. `29b0b16` — Aşama 5: layout, scheduler, registry
8. `49bcd04` — Aşama 6a: testler
9. `3cf307c` — Aşama 6b: dokümantasyon
10. `970db6d` — FutBIN: API birincil kaynak, HTML yedek
11. `7a69a80` — snipeSettings kalıcı (futrush-snipe-settings)
12. `d718b3f` — Sessiz catch blokları: logger.warn / warnOnce
13. `df10318` — Hedef eklerken EA piyasa fiyatı (lowestBin) + aralıklı ekleme
14. `0ff75f0` — Ayarlar modali: hedef ekleme, veri, hata ayıklama (futrush-prefs)
15. `6ddb8be` — Bot: oyuncular arası bekleme, kesilebilir bekleme, satın alma hatası sınıflandırma
16. `079ae9e` — Arayüz: hedef durum kartı, Loglar sekmesi, bekleme göstergesi
17. `3c53dcd` — Arayüz: durum kartı otomatik kaybolma, Başlat butonu, sade Loglar
18. `dd31624` — Boş test dosyası kaldırıldı
19. `69c3d11` — autoBuyer: arama ve tur arası rastgele gecikme (CONFIG.bot)
20. `e66c897` — FutBIN eşleştirme: tam ad boş dönerse ad parçalarıyla yedek arama
21. `199d2d1` — Hedef listesi: fiyat değişince sıra korunur, SATIN AL ve TUR SAYISI etiketleri
22. `1f6f759` — Aynı başlıklı hedef listesi değişikliğinin devamı: hedef/bot davranışı ve ek testler
23. `1177660` — Yükle ekranı: hedef fiyatından %5 EA vergisi düşülür
24. `4b30ba0` — Loglar: ALINDI/BASKASI ALDI satırları, kronolojik akış, gizli kaydırma çubuğu
25. `f2c00f1` — EA kimliği eşleşme izi; eşleştirildi logu yalnızca yeni eşleşmede
26. `104a04a` — Claude devir notu

### Sonraki commitler

27. `0ac4ce0` — Devir ve mimari belgelerini güncelle
28. `cc1894a` — Panel render event aboneligini tamamla
29. `8bebd24` — Devir notu HEAD kaydını netleştir

`199d2d1` ve `1f6f759` aynı commit mesajını taşısa da farklı commitlerdir: `199d2d1` hedef sekmesi/CSS ve UI testlerini; `1f6f759` ise bunlara ek olarak bot hedef güncelleme sırası, FutBIN import sırası, fiyat formatlaması ve ilgili testleri değiştirir. `git show --stat` çıktıları farklı dosya ve değişiklik sayılarını doğrular.

Yukarıdaki liste `104a04a` ile, yani bu devir belgesinin ilk eklendiği commit'te biter. Sonraki doküman düzeltmeleri için güncel commit geçmişi `git log` ile kontrol edilmelidir; bu dosya kendisini içeren commit hash'ini listeleyemez.

## Eksikler ve doğrulanmamış noktalar

- **Gerçek sayfa doğrulaması eksik:** EA Web App üzerinde Tampermonkey kurulumu, login/Transfers akışı ve satın alma davranışı ilk yazım anında ve son doğrulama geçişinde denenmedi (doğrulanamadı). Birim testleri gerçek EA servislerini doğrulamaz.
- Son doğrulama geçişinde `npm run lint`, `npm run migration-map`, `npm test` ve `npm run build` çalıştırıldı; lint/build başarılı, migration-map 60 fonksiyonu tarayıp eksik bildirmedi, testler 24 dosya/229 test olarak geçti. Testlerde FutBIN engellenme/yedek akışları beklenen 403 uyarılarını stderr'e yazdı.
- Kaynak kodu için ilk yazım anında ve son doğrulama geçişinde ayrıca güvenlik denetimi, manuel UI incelemesi veya legacy ile satır/satır davranış karşılaştırması yapılmadı.
- `id` biçimi live hedeflerde `futbin:<id>`, kayıtlı hedeflerde ham `futbinId` olabiliyor. Bu bilinen farktır; otomatik birleştirilmemeli.
- `src/` ve `test/` içinde `TODO`, `FIXME`, `XXX` araması bu incelemede eşleşme bulmadı. Bu, test edilmeyen runtime davranışlarının olmadığı anlamına gelmez.
- `ARCHITECTURE.md` event tablosunda bazı event'ler ve storage tablosunda `futrush-prefs` ile `futrush-snipe-settings` eksikti; bu devir güncellemesinde kaynakla eşleştirildi.
- `settingsModal.js` `panel:request-render` yayıyordu ancak panel listener'ı yoktu; son düzeltmede `ui/panel/panelEvents.js` aktif panel sekmesini yeniden çizmek üzere abone edildi ve birim testi eklendi.
- `ARCHITECTURE.md` klasör haritası ve `.github/copilot-instructions.md` eski bilinen noktaları bu güncellemede kaynak kodla eşleştirildi.

### Proje yönergelerinde düzeltilen eski notlar

`.github/copilot-instructions.md` içindeki eski “bilinen noktalar” kodla çelişiyordu; bu güncellemede kaldırıldı:

- “`state.snipeSettings` kalıcı değil” notuna karşın `src/core/storage.js` `futrush-snipe-settings` anahtarıyla okuma/yazma yapıyor; `test/core/storage.test.js` bunu test ediyor.
- “Ayarlar modalının body'si boş” notuna karşın `src/ui/settingsModal.js` tercih, hedef ekleme/veri ve hata ayıklama içeriklerini oluşturuyor.
- “`runAutoBuyer` içindeki `eaId` kullanılmıyor” notuna karşın `src/bot/autoBuyer.js` içinde `eaId`, `search(target, eaId, token)` çağrısına aktarılıyor.

Korunması gereken mevcut istisna, live listedeki `futbin:<id>` ve kayıtlı listedeki ham `futbinId` biçim farkıdır; yönerge bunu tek formata indirmemeyi söyler.

## Devir ve son doğrulama geçişinde yapılanlar / yapılmayanlar

**Yapılanlar**

- Dal, HEAD, çalışma ağacı, commit geçmişi, plan/mimari/eşleme dokümanları ve ilgili güncel kaynak incelendi; aynı mesajlı iki commit'in farklı kapsamları `git show --stat` ile karşılaştırıldı.
- `npm run lint` başarılı.
- `npm run migration-map` başarılı; 60 fonksiyon incelendi, eksik fonksiyon yok.
- `npm test` başarılı: **24/24 test dosyası, 229/229 test**. FutBIN fallback senaryoları beklenen 403 uyarılarını stderr'e yazdı.
- `npm run build` başarılı; `dist/futrush.user.js` 180.2 KB olarak üretildi.
- `panel:request-render` listener'ı eklendi ve iki regresyon testi yazıldı; `ARCHITECTURE.md` event/folder haritası, `.github/copilot-instructions.md` eski notlar ve bu devir dosyasının durum bilgileri güncellendi.
- Sonraki kod ve belge düzeltmeleri (panel render dinleyicisi, doküman güncellemeleri ve HEAD kayıt netleştirmesi) `master` dalına commit edilip `origin/master`'a push edildi.
- `settingsTab.js` UTF-8 ve BOM denetimi yapıldı; dosyanın BOM içermediği ve geçerli UTF-8 olduğu doğrulandı.

**Yapılmayanlar**

- EA canlı ortamında doğrulama, güvenlik incelemesi ve legacy ile satır satır karşılaştırma yapılmadı (doğrulanamadı).
- Canlı EA/Tampermonkey testi ve uygulamalı kullanıcı akışı doğrulaması yapılmadı (doğrulanamadı).

## Claude için önerilen devam

1. Önce `.github/copilot-instructions.md`, `PLAN.md`, `ARCHITECTURE.md` ve bu dosyayı oku.
2. Kullanıcıdan yeni bir iş gelmeden refactor veya davranış değişikliği başlatma.
3. Yeni bir özellik/bug işi için kaynak ve testleri incele; özellikle legacy davranışını koru ve modül sınırlarını sürdür.
4. Kod değişikliğinden sonra en az `npm test` ve `npm run build` çalıştır; değişen kapsam uygunsa `npm run lint` de çalıştır.
5. Mümkünse EA Web App + Tampermonkey üzerinde manuel doğrulama yap ve doğrulanamayan noktaları açıkça raporla.
