import { describe, expect, it, vi } from 'vitest';

const { pageWindow } = vi.hoisted(() => ({ pageWindow: {} }));
vi.mock('../../src/utils/dom.js', () => ({ pageWindow }));

const { classifyPurchaseError, errorCode } = await import('../../src/ea/errorCodes.js');

describe('purchase error classification', () => {
  it.each([461, 462, 478])('classifies %s as a missed purchase', (code) => {
    expect(classifyPurchaseError({ code })).toMatchObject({ kind: 'missed', code });
  });

  it('classifies no-coins, full, and fatal codes', () => {
    expect(classifyPurchaseError({ code: 470 }).kind).toBe('no-coins');
    expect(classifyPurchaseError({ code: 473 }).kind).toBe('full');
    for (const code of [458, 494, 20000]) {
      expect(classifyPurchaseError({ code }).kind).toBe('fatal');
    }
  });

  it('uses page UTAS codes when they are available', () => {
    pageWindow.UtasErrorCode = { PERMISSION_DENIED: 9001 };
    expect(errorCode('PERMISSION_DENIED')).toBe(9001);
    expect(classifyPurchaseError({ code: 9001 }).kind).toBe('missed');
  });

  it('reads status from the purchase response and handles text and empty errors', () => {
    expect(classifyPurchaseError(undefined, { status: 462 }).kind).toBe('missed');
    expect(classifyPurchaseError('EA denied the request').text).toBe('EA denied the request');
    expect(classifyPurchaseError({ message: 'Rejected' }).text).toBe('Rejected');
    expect(classifyPurchaseError(undefined).text).toBe('Bilinmeyen EA satın alma hatası.');
    expect(classifyPurchaseError({}).text).not.toContain('[object Object]');
  });
});
