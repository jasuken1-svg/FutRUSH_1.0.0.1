// EA fiyat basamakları ve yuvarlama modülü (tek kaynak).
// Bağımsız saf fonksiyonlar: DOM veya global duruma bağlı değildir.

export const MIN_PRICE = 200;
export const MAX_PRICE = 14999000;
export const MIN_BIN = MIN_PRICE;

export const PRICE_TIERS = Object.freeze([
  { min: 200, max: 1000, step: 50 },
  { min: 1000, max: 10000, step: 100 },
  { min: 10000, max: 50000, step: 250 },
  { min: 50000, max: 100000, step: 500 },
  { min: 100000, max: MAX_PRICE, step: 1000 }
]);

export const clampPrice = (price) => {
  const num = Number(price);
  if (!Number.isFinite(num) || num < MIN_PRICE) return MIN_PRICE;
  if (num > MAX_PRICE) return MAX_PRICE;
  return Math.round(num);
};

export const getPriceStep = (price) => {
  const p = Number(price) || 0;
  for (const tier of PRICE_TIERS) {
    if (p < tier.max) return tier.step;
  }
  return 1000;
};

export const stepForPrice = getPriceStep;

export const roundToPriceStep = (price, mode = 'nearest') => {
  const num = Number(price);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num < MIN_PRICE) {
    if (mode === 'up') return MIN_PRICE;
    if (mode === 'down') return 0;
    return num >= MIN_PRICE / 2 ? MIN_PRICE : 0;
  }
  if (num >= MAX_PRICE) return MAX_PRICE;

  const step = getPriceStep(num);
  let rounded;
  if (mode === 'down') {
    rounded = Math.floor(num / step) * step;
  } else if (mode === 'up') {
    rounded = Math.ceil(num / step) * step;
  } else {
    rounded = Math.round(num / step) * step;
  }
  return Math.min(MAX_PRICE, Math.max(MIN_PRICE, rounded));
};

export const roundDownToStep = (price) => {
  const value = Math.floor(Number(price) || 0);
  if (value <= 0) return 0;
  return roundToPriceStep(value, 'down');
};

export const roundUpToStep = (price) => {
  const value = Math.ceil(Number(price) || 0);
  if (value <= 0) return 0;
  return roundToPriceStep(value, 'up');
};

export const nextPriceUp = (price) => {
  const p = Number(price) || 0;
  if (p < MIN_PRICE) return MIN_PRICE;
  if (p >= MAX_PRICE) return MAX_PRICE;
  const stepped = roundToPriceStep(p, 'down');
  const next = stepped + getPriceStep(stepped);
  return Math.min(MAX_PRICE, next);
};

export const priceAbove = nextPriceUp;

export const nextPriceDown = (price) => {
  const p = Number(price) || 0;
  if (p <= MIN_PRICE) return MIN_PRICE;
  if (p > MAX_PRICE) return roundToPriceStep(MAX_PRICE, 'down');
  const stepped = roundToPriceStep(p, 'up');
  const prevStep = getPriceStep(stepped - 1);
  const prev = stepped - prevStep;
  return Math.max(MIN_PRICE, prev);
};

export const priceBelow = (price) => (price > MIN_PRICE ? nextPriceDown(price) : 0);

export const bindPriceStepRounding = (inputElement, onCommit) => {
  if (!inputElement) return () => {};
  const handler = () => {
    const rawStr = String(inputElement.value || '').replace(/[.\s]/g, '').replace(/,/g, '.');
    const val = Number(rawStr);
    if (!Number.isFinite(val) || val <= 0) return;
    const rounded = clampPrice(roundToPriceStep(val, 'nearest'));
    if (typeof onCommit === 'function') {
      onCommit(rounded);
    } else {
      inputElement.value = rounded.toLocaleString('tr-TR');
    }
  };
  inputElement.addEventListener('blur', handler);
  inputElement.addEventListener('change', handler);
  return () => {
    inputElement.removeEventListener('blur', handler);
    inputElement.removeEventListener('change', handler);
  };
};

export function runPriceStepSelfTests() {
  const testCases = [
    // Alt sınır & altı
    { name: 'clampPrice alt sınır altı (< 200)', fn: () => clampPrice(100), expected: 200 },
    { name: 'clampPrice negatif', fn: () => clampPrice(-50), expected: 200 },
    { name: 'clampPrice alt sınır (200)', fn: () => clampPrice(200), expected: 200 },
    { name: 'roundToPriceStep alt sınır (200)', fn: () => roundToPriceStep(200, 'nearest'), expected: 200 },
    { name: 'nextPriceDown alt sınır (200) -> 200', fn: () => nextPriceDown(200), expected: 200 },

    // 200 - 1.000 arası (50 basamağı)
    { name: 'getPriceStep(200) -> 50', fn: () => getPriceStep(200), expected: 50 },
    { name: 'getPriceStep(950) -> 50', fn: () => getPriceStep(950), expected: 50 },
    { name: 'nextPriceUp(200) -> 250', fn: () => nextPriceUp(200), expected: 250 },
    { name: 'roundToPriceStep(240, nearest) -> 250', fn: () => roundToPriceStep(240, 'nearest'), expected: 250 },
    { name: 'roundToPriceStep(220, nearest) -> 200', fn: () => roundToPriceStep(220, 'nearest'), expected: 200 },
    { name: 'roundToPriceStep(980, nearest) -> 1000', fn: () => roundToPriceStep(980, 'nearest'), expected: 1000 },
    { name: 'roundToPriceStep(980, down) -> 950', fn: () => roundToPriceStep(980, 'down'), expected: 950 },
    { name: 'roundToPriceStep(980, up) -> 1000', fn: () => roundToPriceStep(980, 'up'), expected: 1000 },

    // 1.000 sınır geçişi
    { name: 'getPriceStep(1000) -> 100', fn: () => getPriceStep(1000), expected: 100 },
    { name: 'nextPriceUp(950) -> 1000', fn: () => nextPriceUp(950), expected: 1000 },
    { name: 'nextPriceUp(1000) -> 1100', fn: () => nextPriceUp(1000), expected: 1100 },
    { name: 'nextPriceDown(1000) -> 950', fn: () => nextPriceDown(1000), expected: 950 },
    { name: 'nextPriceDown(1100) -> 1000', fn: () => nextPriceDown(1100), expected: 1000 },

    // 1.000 - 10.000 arası (100 basamağı)
    { name: 'roundToPriceStep(1040, nearest) -> 1000', fn: () => roundToPriceStep(1040, 'nearest'), expected: 1000 },
    { name: 'roundToPriceStep(1060, nearest) -> 1100', fn: () => roundToPriceStep(1060, 'nearest'), expected: 1100 },
    { name: 'roundToPriceStep(5420, down) -> 5400', fn: () => roundToPriceStep(5420, 'down'), expected: 5400 },

    // 10.000 sınır geçişi (250 basamağına geçiş)
    { name: 'getPriceStep(10000) -> 250', fn: () => getPriceStep(10000), expected: 250 },
    { name: 'nextPriceUp(9900) -> 10000', fn: () => nextPriceUp(9900), expected: 10000 },
    { name: 'nextPriceUp(10000) -> 10250', fn: () => nextPriceUp(10000), expected: 10250 },
    { name: 'nextPriceDown(10000) -> 9900', fn: () => nextPriceDown(10000), expected: 9900 },
    { name: 'nextPriceDown(10250) -> 10000', fn: () => nextPriceDown(10250), expected: 10000 },
    { name: 'roundToPriceStep(10120, down) -> 10000', fn: () => roundToPriceStep(10120, 'down'), expected: 10000 },
    { name: 'roundToPriceStep(10120, up) -> 10250', fn: () => roundToPriceStep(10120, 'up'), expected: 10250 },

    // 49.950 -> 50.000 geçişi ve 50.000 sınırı (500 basamağına geçiş)
    { name: 'roundToPriceStep(49950, nearest) -> 50000', fn: () => roundToPriceStep(49950, 'nearest'), expected: 50000 },
    { name: 'roundToPriceStep(49950, up) -> 50000', fn: () => roundToPriceStep(49950, 'up'), expected: 50000 },
    { name: 'roundToPriceStep(49950, down) -> 49750', fn: () => roundToPriceStep(49950, 'down'), expected: 49750 },
    { name: 'getPriceStep(50000) -> 500', fn: () => getPriceStep(50000), expected: 500 },
    { name: 'nextPriceUp(49750) -> 50000', fn: () => nextPriceUp(49750), expected: 50000 },
    { name: 'nextPriceUp(50000) -> 50500', fn: () => nextPriceUp(50000), expected: 50500 },
    { name: 'nextPriceDown(50000) -> 49750', fn: () => nextPriceDown(50000), expected: 49750 },
    { name: 'nextPriceDown(50500) -> 50000', fn: () => nextPriceDown(50500), expected: 50000 },

    // 100.000 sınır geçişi (1.000 basamağına geçiş)
    { name: 'getPriceStep(100000) -> 1000', fn: () => getPriceStep(100000), expected: 1000 },
    { name: 'nextPriceUp(99500) -> 100000', fn: () => nextPriceUp(99500), expected: 100000 },
    { name: 'nextPriceUp(100000) -> 101000', fn: () => nextPriceUp(100000), expected: 101000 },
    { name: 'nextPriceDown(100000) -> 99500', fn: () => nextPriceDown(100000), expected: 99500 },
    { name: 'nextPriceDown(101000) -> 100000', fn: () => nextPriceDown(101000), expected: 100000 },
    { name: 'roundToPriceStep(100400, nearest) -> 100000', fn: () => roundToPriceStep(100400, 'nearest'), expected: 100000 },
    { name: 'roundToPriceStep(100600, nearest) -> 101000', fn: () => roundToPriceStep(100600, 'nearest'), expected: 101000 },

    // Üst sınır (14.999.000)
    { name: 'clampPrice üst sınır üzeri (15.000.000) -> 14999000', fn: () => clampPrice(15000000), expected: 14999000 },
    { name: 'roundToPriceStep üst sınır üzeri -> 14999000', fn: () => roundToPriceStep(15000000, 'nearest'), expected: 14999000 },
    { name: 'nextPriceUp(14998000) -> 14999000', fn: () => nextPriceUp(14998000), expected: 14999000 },
    { name: 'nextPriceUp(14999000) tavan -> 14999000', fn: () => nextPriceUp(14999000), expected: 14999000 }
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
        console.error(`[FutRUSH PriceSteps Fail] ${tc.name}: Beklenen ${tc.expected}, Alınan ${res}`);
      }
    } catch (err) {
      failed++;
      console.error(`[FutRUSH PriceSteps Error] ${tc.name}:`, err);
    }
  }

  const summary = `[FutRUSH PriceSteps Test] Toplam: ${testCases.length} | Geçen: ${passed} | Kalan (Başarısız): ${failed}`;
  console.log(summary);
  return { total: testCases.length, passed, failed };
}

if (typeof window !== 'undefined') {
  window.__testPriceSteps = runPriceStepSelfTests;
}
