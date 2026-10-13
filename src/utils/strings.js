// Oyuncu adlarini karsilastirma ve eslestirme icin normalize eder.
// Bagimlilik: yalnizca standart JavaScript metin API'leri.

export function normalizePlayerName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
