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

export function buyNowStep(price) {
  if (price <= 1000) return 50;
  if (price <= 10000) return 100;
  if (price <= 50000) return 250;
  if (price <= 100000) return 500;
  return 1000;
}
