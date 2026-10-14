// EA fiyat basamaklari. Gecerli fiyatlar: 200-950 arasi 50, 1.000-9.900 arasi 100,
// 10.000-49.750 arasi 250, 50.000-99.500 arasi 500, 100.000 ustu 1.000.
// (utils/format.js'teki buyNowStep'e dokunmaz; sinir degerleri burada kesin.)

export const MIN_BIN = 200;

export const stepForPrice = (price) => {
  if (price < 1000) return 50;
  if (price < 10000) return 100;
  if (price < 50000) return 250;
  if (price < 100000) return 500;
  return 1000;
};

export const priceAbove = (price) => price + stepForPrice(price);

// MIN_BIN ve altinda 0 doner (daha ucuz gecerli fiyat yok).
export const priceBelow = (price) => (price > MIN_BIN ? price - stepForPrice(price - 1) : 0);

export const roundDownToStep = (price) => {
  const value = Math.floor(Number(price) || 0);
  if (value <= 0) return 0;
  const step = stepForPrice(value);
  return Math.floor(value / step) * step;
};

export const roundUpToStep = (price) => {
  const value = Math.ceil(Number(price) || 0);
  if (value <= 0) return 0;
  const step = stepForPrice(value);
  return Math.ceil(value / step) * step;
};
