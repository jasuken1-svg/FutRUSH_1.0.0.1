// EA oyuncu ve kart kimlikleri icin yardimci fonksiyonlar.
// Maskesiz tam kimlik, taban kimlik (baseId) ve karsilastirma islemleri.

export const BASE_ID_MAX = 0xffffff;

export const toBaseId = (id) => (Number(id) > 0 ? Number(id) % (BASE_ID_MAX + 1) : 0);

export const isBaseId = (id) => {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 && n <= BASE_ID_MAX;
};

export const idOf = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : 0);

// 'exact' | 'same_player' | 'mismatch' | 'unverified' | 'unverified_base'
export const compareEaIds = (requested, page) => {
  const req = idOf(requested);
  if (!req) return 'mismatch';
  const pg = idOf(page);
  if (!pg) return isBaseId(req) ? 'unverified_base' : 'unverified';
  if (req === pg) return 'exact';
  return toBaseId(req) === toBaseId(pg) ? 'same_player' : 'mismatch';
};
