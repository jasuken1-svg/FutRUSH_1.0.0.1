import { pageWindow } from '../utils/dom.js';

const fallbackCodes = {
  PERMISSION_DENIED: 461,
  STATE_INVALID: 462,
  NOT_ENOUGH_CREDIT: 470,
  DESTINATION_FULL: 473,
  NO_TRADE_EXISTS: 478,
  CAPTCHA_REQUIRED: 458,
  LOCKED_TRANSFER_MARKET: 494,
  ACCOUNT_BANNED: 20000
};

const descriptions = {
  'no-coins': 'Yeterli coin yok.',
  full: 'Transfer listesi dolu.',
  458: 'EA CAPTCHA doğrulaması gerekiyor.',
  494: 'EA Transfer Market hesabı kilitli.',
  20000: 'EA hesabı yasaklanmış.',
  other: 'Bilinmeyen EA satın alma hatası.'
};

export function errorCode(ad) {
  return pageWindow.UtasErrorCode?.[ad] ?? fallbackCodes[ad];
}

function errorText(error) {
  if (typeof error === 'string' && error) return error;
  if (typeof error === 'number' || typeof error === 'bigint') return String(error);
  if (error && typeof error === 'object') {
    if (typeof error.message === 'string' && error.message) return error.message;
    if (error.code !== undefined && error.code !== null) return String(error.code);
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}') return json;
    } catch (serializationError) {
      return 'EA hata nesnesi JSON biçimine dönüştürülemedi.';
    }
  }
  return '';
}

function isCode(code, expected) {
  return code !== null && code !== undefined && String(code) === String(expected);
}

export function classifyPurchaseError(error, purchase) {
  const code = error?.code ?? error?.status ?? purchase?.status ?? (typeof error === 'number' ? error : null);
  const text = errorText(error);
  const missedCodes = ['PERMISSION_DENIED', 'STATE_INVALID', 'NO_TRADE_EXISTS'].map(errorCode);
  const fatalCodes = ['CAPTCHA_REQUIRED', 'LOCKED_TRANSFER_MARKET', 'ACCOUNT_BANNED'].map(errorCode);
  let kind = 'other';
  let description = text || descriptions.other;
  if (missedCodes.some((value) => isCode(code, value))) {
    kind = 'missed';
    description = 'Kart başka bir kullanıcı tarafından alınmış ya da ilan sona ermiş.';
  } else if (isCode(code, errorCode('NOT_ENOUGH_CREDIT'))) {
    kind = 'no-coins';
    description = descriptions[kind];
  } else if (isCode(code, errorCode('DESTINATION_FULL'))) {
    kind = 'full';
    description = descriptions[kind];
  } else if (fatalCodes.some((value) => isCode(code, value))) {
    kind = 'fatal';
    description = descriptions[code] || text || 'EA hesabı veya transfer pazarı işlemi engellendi.';
  }
  return { kind, code: code ?? null, text: description };
}
