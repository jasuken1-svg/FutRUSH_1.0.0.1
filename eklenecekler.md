# Eklenmesi Değerlendirilebilecekler

Bu belge, FUTBIN entegrasyon kodu incelemesindeki önerileri ve uygulama önceliklerini kaydeder. Buradaki maddeler değerlendirme önerisidir; henüz kaynak koda uygulanmış değildir.

## Öncelik 1 — Kart sürümünü doğru eşleştirme

Mevcut Esmee Brugts / TOTW / gold-base karışıklığı için en önemli ihtiyaç, oyuncu kimliği ile kart sürümü kimliğini birbirinden ayırmaktır.

- EA kart kimliği (`resource_id`, Transfer Market'teki `maskedDefId`) ile temel oyuncu kimliği (`playerid`) ayrı alanlarda tutulmalı.
- FUTBIN kart kimliği (`ID`) EA kimliği olarak kullanılmamalı; FUTBIN kartını ve sayfasını tanımlayan ayrı bir kimlik olarak kalmalı.
- Aday eşleştirmede kart EA ID'si, temel oyuncu ID'si, reyting ve varsa `raretype`/kart sürümü bilgisi birlikte değerlendirilmelidir.
- Tam EA kart ID eşleşmesi en yüksek önceliğe sahip olmalıdır. Ortak `playerid` tek başına özel kartın sürümünü kanıtlamaz.
- Özel kart seçildiği biliniyorsa eşleşme bulunamadığında gold/base karta sessizce düşülmemeli; doğru sürüm bulunamadığı açıkça bildirilmelidir.
- Sürüm bilgisi kesin değilse yanlış kartı seçmek yerine belirsizliği bildirmek daha güvenlidir.

## Öncelik 2 — FUTBIN arama JSON ayrıştırıcısı

Ek parser'daki arama JSON desteği, mevcut ad ve reyting odaklı lookup'ı kart düzeyinde veriyle zenginleştirebilir.

- Arama yanıtından kart görsel URL'si, kart EA ID'si, FUTBIN ID'si, reyting, pozisyon, kart sürümü ve platform fiyatları ayrıştırılabilir.
- Kart EA ID'si görsel URL'sinden çıkarılacaksa bu değer `resource_id`/masked EA ID ile aynı anlamda olduğu doğrulanmalı.
- Kart sürümü (`version`/rarity/promo) ve fiyat bilgisi yalnızca API'nin gerçekten sağladığı alanlardan alınmalı; eksik alanlar tahmin edilmemeli.
- Yeni parser ayrı ve küçük bir FUTBIN modülünde tutulmalı; `fetchFutbinPlayerId` içinde JSON şekli ayrıştırma kodu büyütülmemelidir.

## Öncelik 3 — FUTBIN oyuncu sayfasını güvenli yedek kaynak yapmak

API yanıt vermediğinde oyuncu sayfası parser'ı yedek olarak değerlendirilebilir.

- Sayfadaki fiyatlar platforma göre okunabilir.
- Sayfanın açıkladığı EA resource ID, istenen EA ID ile doğrulanmadan sonuç kabul edilmemeli.
- Cloudflare/403 yanıtı gerçek oyuncu sayfası gibi değerlendirilmemeli.
- Parser hataları ve ağ hataları proje logger düzenine uygun biçimde görünür olmalı.

## Sonraki aşama — Kadro ve galeri parser'ları

Ek kod, FUTBIN kadro/squad ve Gallery koleksiyon verilerini de ayrıştırabiliyor. Bunlar temel oyuncu eşleştirmesinden bağımsız, daha geniş özellikler olarak ele alınmalıdır.

- Kadro verileri formasyon, pozisyon ve oyuncu EA/FUTBIN ID'leriyle SBC veya kadro araçlarına temel olabilir.
- Gallery verileri koleksiyon, kart sürümü, puan ve etiketleriyle ayrı bir koleksiyon özelliğine temel olabilir.
- Bunlar mevcut hedef ekleme akışına topluca taşınmamalı; ihtiyaç ve kullanıcı akışı netleşince modüler biçimde planlanmalıdır.

## Dikkat edilmesi gereken riskler

1. **Aynı EA ID ile birleştirme:** Ek parser'daki `uniqueCards` kayıtları yalnızca EA ID'ye göre birleştiriyor. Farklı FUTBIN kartları aynı EA/görsel ID'sini paylaşıyorsa kart sürümü, FUTBIN ID'si veya reyting bilgisi kaybolabilir. Tekilleştirme anahtarı kullanım amacına göre EA ID ve FUTBIN kart ID'sini birlikte değerlendirmelidir.
2. **Özel görsel yokken temel görsele dönme:** Gallery parser'ındaki özel kart görseli yoksa temel görsele geçiş, bulunan kartın gerçekten base sürüm olduğunu kanıtlamaz. Kaynağın hangi görseli sağladığı ayrı kaydedilmeli.
3. **Sessiz hata yutma:** Ek kodda boş `catch` blokları bulunuyor. Projeye aktarılacak hata yolları sessiz bırakılmamalı; mevcut logger ve hata yönetimi kullanılmalı.
4. **Dış proje bağımlılıkları:** Ek kod başka bir uygulamanın `settings`, storage, datasource, UI ve servis modüllerini import ediyor. Doğrudan kopyalanmamalı; yalnızca gerekli parser davranışları bu projenin modül sözleşmelerine uyarlanmalı.
5. **EA rarity filtresi ayrı bir konu:** FUTBIN parser'ı FUTBIN verisini işler; EA Web App'teki `Special`/`TOTW` seçim değerini Transfer Market sorgusuna aktarmanın yerine geçmez. EA rarity filtresinin seçimini yakalama ve aramaya iletme ayrı bir entegrasyon gerektirir.

## Önerilen uygulama sırası

1. EA kart ID'si, temel oyuncu ID'si ve FUTBIN kart ID'si için açık veri sözleşmesini belirle.
2. Standart ve özel kartların aynı ad/reyting arama yanıtında bulunduğu regresyon testleri yaz.
3. Sürüm farkındalıklı aday seçimini uygula; özel kart bulunamadığında base karta sessiz geçişi engelle.
4. Arama JSON parser'ını ve doğrulanmış EA ID eşleşmesini ekle.
5. Oyuncu sayfası parser'ını yalnızca kimlik doğrulamalı fiyat yedeği olarak değerlendir.
6. Kadro ve Gallery parser'larını ancak ayrı ürün gereksinimleri netleşince planla.

## Uygulama durumu

Bu belge önerileri listeler. Bu inceleme sırasında kaynak kodda değişiklik yapılmamıştır.

## FUTBIN fiyat servisi incelemesi

Bu bölüm, ek olarak paylaşılan FUTBIN fiyat servisi kodunun öncelik kuyruğu, API/oyuncu sayfası kaynakları, tekrar deneme davranışı, cache ve hata yolları açısından değerlendirmesini kaydeder. Kod başka bir uygulamanın ayar, depolama, EA kataloğu ve FUTBIN istemci modüllerine bağlıdır; bu nedenle doğrudan kopyalanması değil, gerekli davranışların FutRUSH sözleşmelerine uyarlanması önerilir.

### Ekten alınabilecek tasarım fikirleri

- **İstek önceliği:** Bot/SBC gibi iş açısından kritik istekleri, kullanıcı tarafından açıkça istenenleri ve yalnızca görünür olan kartları ayrı önceliklerde kuyruğa almak; aynı kart için yinelenen istekleri tekleştirmek.
- **İstek hızı ve bloklanma geri çekilimi:** İstekler arasında taban gecikme ve küçük rastgele fark kullanmak; HTTP 403/429/503 gibi bloklanma işaretlerinde daha uzun süre bekleyerek tekrar denemek.
- **API'den sayfaya kontrollü yedek:** Önce yapılandırılmış FUTBIN API verisini kullanmak, API'de eşleşme yoksa veya uygun yanıt alınamıyorsa kart bağlantısı ve oyuncu sayfası yedeğine geçmek.
- **Aynı API yanıtından cache doldurma:** Arama yanıtında başka takip edilen kartların fiyatı varsa ek istek göndermeden bu verileri cache'e almak. Kart ve sürüm kimlikleri doğrulanmadan kayıtlar birleştirilmemeli.
- **Fiyat değişimi doğrulaması:** Önceki fiyat hâlâ güncelse ve yeni değer olağandışı bir sıçrama gösteriyorsa, yeni fiyatı hemen kesinleştirmek yerine kısa süre sonra yeniden doğrulamak.
- **Durum ve yenileme politikası:** Cache girdisinin kaynağını, platformunu, son başarılı okuma zamanını ve tekrar deneme zamanını saklayarak görünür kartlarla bot hedeflerinin farklı tazelik ihtiyaçlarını karşılamak.

### Doğrulanması gereken hata ve yarış durumları

1. **İş hatalarının sessizce yutulması — yüksek öncelik**
   Kuyruk işleyicisinde `processJob(job).catch(() => {})` biçimindeki yakalama, hata ayrıntısını kaybettiriyor. `finally` bloğu işi tamamlanmış gibi işaretleyip bekleyen çağrıları kayıt veya `null` ile sonuçlandırabiliyor; çağıran taraf ağ/parse hatasını “fiyat yok” durumundan ayıramayabilir. Entegrasyonda beklenmeyen hata logger'a bağlanmalı ve kayıt açık bir hata durumu ile anlamlı yeniden deneme zamanına geçirilmelidir. Beklenen “bulunamadı”/“fiyat yok” sonuçları ise genel hatalardan ayrı kalmalıdır.

2. **Cache temizliği ile devam eden istek yarışı**
   `clearFutbinCache()` bekleyen kuyruğu temizliyor, fakat `inflight` isteği iptal etmiyor veya geçersiz kılmıyor. Temizlikten önce başlayan `processJob` sonradan tamamlanıp eski linki/fiyatı tekrar yazabilir. İstek nesli (generation/token) ya da eşdeğer bir geçersizleştirme kontrolü eklenmeli; sonuç yazılmadan önce işin başladığı neslin hâlâ güncel olduğu doğrulanmalıdır. Kuyrukta bekleyen işlerin bekleyicilerinin çözülmesi korunmalı, devam eden işler için de temizleme sonrası sonuç davranışı açıkça tanımlanmalıdır.

3. **EA kataloğu yüklenirken ilk API aramalarının başlaması**
   `ensureCatalog()` kataloğu asenkron başlatıyor, fakat `readViaApi()` aynı anda `apiQueriesFor()` çağırıyor. Bu nedenle ilk sorgu adı kataloğun common name / first name / last name bilgileri gelmeden hazırlanabilir ve yalnızca daha düşük kaliteli ipucu adını kullanabilir. Katalog yüklemesinin tamamlanmasını beklemek veya katalog henüz hazır değilken sonradan ek sorgu denemek değerlendirilmeli. Katalog yüklemesi başarısız olursa hata görünür olmalı; aynı anda tekrarlı yüklemeler de engellenmelidir.

4. **Tam EA kart ID'si yerine maskeli ID ile sayfa doğrulaması**
   Oyuncu sayfası kontrolü `pageEaId === id` yanında `(pageEaId & 0xffffff) === (id & 0xffffff)` eşitliğini de kabul ediyor. Bu maskeleme özel kartın resource ID'sini base ID'ye indirgediği için aynı temel ID'yi paylaşan farklı sürümleri eşdeğer sayabilir. Bu, oyuncu kimliğini doğrulamaya yarasa da seçili kart sürümünü kanıtlamaz. Sürüm doğrulaması gerektiğinde tam `resource_id`/kart ID'si ve varsa rarity, rating veya FUTBIN kart ID'si ayrıca karşılaştırılmalı; maskeli eşleşme yalnızca “aynı temel oyuncu” bilgisi olarak tutulmalıdır.

5. **Bekleyici sözleşmesinde hata ile fiyat yok ayrımının kaybolması**
   `requestPrice()`/waiter yolu hata, timeout, geçici blok ve gerçek fiyat bulunmaması durumlarını çağırana ayrı ayrı taşımalıdır. Mevcut fiyatın veya `null` değerinin her başarısızlıkta dönmesi çağıran UI/bot kodunun doğru mesajı ve yeniden deneme davranışını seçmesini engelleyebilir. Sonuç türü açık bir başarı/hata/miss sözleşmesi olmalı ve tüm bekleyiciler her bitiş yolunda yalnızca bir kez sonuçlandırılmalıdır.

6. **Tek aktif iş davranışı ve öncelik adaleti**
   Kuyruk bir seferde tek iş çalıştırıyor; bu, FUTBIN'e aşırı yük bindirmeyi önlemek için kullanışlıdır. Ancak sürekli yüksek öncelikli istek gelirse görünür kartlar uzun süre bekleyebilir. Öncelik politikası korunacaksa bekleme süresi ölçülmeli ve gerekirse yaşa dayalı terfi eklenmelidir. Bu, yalnızca gerçek kullanımda açlık (starvation) görülürse ele alınmalı; gereksiz karmaşıklık eklenmemelidir.

7. **Yeniden deneme ve bloklanma durumlarının tutarlılığı**
   İstek seviyesi `deferred`/`blocked` sonuçları ile servis genelindeki `blockedUntil`/`backoffMs` birlikte kullanılıyor. Her hata sınıfının hangi kayıtları duraklattığı, hangilerinin başka bir kaynaktan devam edebildiği test edilmelidir. API araması bloklanmışken bilinen oyuncu sayfası bağlantısının denenebilmesi yararlı olabilir; ancak doğrudan sayfa istekleri de bloklanmışsa tekrarlı denemeyle servise yük bindirilmemelidir.

8. **Platforma bağlı cache doğruluğu**
   Kayıtların platform bilgisi bulunması olumlu; yine de fiyat ve meta verisinin platform değişiminde eski platformdan gösterilmediği doğrulanmalıdır. Cache anahtarının yalnızca EA ID olması, aynı kartın platform fiyatlarını tek kayıtta tutuyorsa platform değişiminde fiyat dizisi/meta alanları da aynı platforma ait olacak şekilde atomik güncellenmelidir.

### FutRUSH'a uyarlama sınırları

- Mevcut [loader.js](./src/futbin/loader.js) zaten FUTBIN API ve HTML sayfaları arasında fallback, sayfalama ve fiyat filtreleme akışına sahip; ek servis onun yerine doğrudan alınmamalı. Kuyruk, backoff ve sıçrama doğrulama gibi ihtiyaç duyulan davranışlar mevcut akışla birleştirilmeden önce mevcut cache ve çağıran sözleşmeleri incelenmelidir.
- [http.js](./src/futbin/http.js) ağ hatası, timeout ve iptal için açık hata üretir. Yeni servis bu ayrımı kaybetmemeli ve boş `catch` ile bastırmamalıdır.
- EA kimliği, temel oyuncu ID'si ve FUTBIN kart ID'si ayrı tutulmalı. Fiyat veya sayfa verisini başka karta tohumlarken yalnızca masked/base ID eşleşmesine güvenilmemelidir.
- Ek kodun `settings`, storage, localization, EA catalog ve UI durumları FutRUSH'taki karşılıklarıyla eşleştirilmeden aktarılmamalıdır. Mevcut localStorage sözleşmeleri ve modül bağımlılık yönü korunmalıdır.
- Görünürlük önceliği ve bot/SBC “hot” önceliği ancak bu çağıran yüzeyler FutRUSH'ta varsa eklenmelidir; mevcut özellikler varsayılarak yeni servis davranışı eklenmemelidir.

### Önerilen entegrasyon ve doğrulama sırası

1. Mevcut `loader.js`/`http.js` akışında çağrıları, fiyat cache'ini ve hataların UI/bot'a nasıl taşındığını belgeleyip korunacak sözleşmeyi belirle.
2. Mevcut hata yönetimiyle uyumlu açık sonuç tiplerini tanımla: başarılı fiyat, fiyat bulunamadı, geçici blok/erteleme ve gerçek istek/parse hatası.
3. Kuyruk veya tekrar deneme eklenecekse önce tek bir kart için yinelenen istek birleştirme ve tek aktif istek davranışına regresyon testleri yaz.
4. Cache temizliği sırasında devam eden istek, timeout, 403/429/503, API'de bulunamayıp sayfa yedeğinde bulunan kart ve her iki kaynağın da başarısız olması senaryolarını test et.
5. Base/special kartlarda aynı masked ID senaryosunu test ederek temel oyuncu eşleşmesinin yanlış kart sürümü/fiyatı kabul etmediğini kanıtla.
6. Ani fiyat sıçraması doğrulamasını eski cache, platform değişimi, tekrar eden aynı fiyat ve gerçekten değişmiş fiyat senaryolarıyla test et.
7. Her küçük entegrasyon aşamasında mevcut build ve ilgili testleri çalıştır; ancak ölçülen bir ihtiyaç varsa yaşa dayalı kuyruk terfisi veya görünürlük takipçisi gibi ek karmaşıklık ekle.

Bu değerlendirme ek kodun tasarımına yöneliktir; belirtilen riskler FutRUSH kaynak kodunda doğrulanmış hata olarak değil, entegrasyonda önlem alınması gereken noktalar olarak ele alınmalıdır. Bu bölüm eklenirken kaynak kod ve test dosyaları değiştirilmemiştir.
