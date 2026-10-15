// FutBIN fiyatlarini ayrıştırir ve Buy Now fiyat adimini hesaplar.
// Bagimlilik: yalnizca standart JavaScript sayi/metin API'leri.

export function parsePrice(text) {
  const value = String(text || '').replace(/[\u00a0\u202f\u2009]/g, '\u00a0').trim().toUpperCase();
  const match = value.match(/(\d{1,3}(?:[.,\u00a0]\d{3})+|\d+(?:[.,]\d{1,2})?)\s?([KM])?(?![A-Z])/);
  if (!match) return 0;
  const grouped = /^\d{1,3}(?:[.,\u00a0]\d{3})+$/.test(match[1]);
  const amount = grouped ? parseInt(match[1].replace(/[^\d]/g, ''), 10) : parseFloat(match[1].replace(',', '.'));
  const scale = { K: 1000, M: 1000000 }[match[2] || ''] || 1;
  const price = Math.round(amount * scale);
  return Number.isFinite(price) ? price : 0;
}

export const parseFutbinPrice = parsePrice;

const fallbackPriceTiers = [
  { min: 100000, inc: 1000 },
  { min: 50000, inc: 500 },
  { min: 10000, inc: 250 },
  { min: 1000, inc: 100 },
  { min: 150, inc: 50 },
  { min: 0, inc: 150 }
];

export function floorPrice(value, priceTiers = fallbackPriceTiers) {
  const price = Math.floor(Number(value) || 0);
  if (price < 150) return 0;
  const tier = priceTiers.find((item) => price >= item.min);
  if (!tier) return 0;
  return Math.floor(price / tier.inc) * tier.inc;
}

export function buyNowStep(price) {
  if (price <= 1000) return 50;
  if (price <= 10000) return 100;
  if (price <= 50000) return 250;
  if (price <= 100000) return 500;
  return 1000;
}
