import { afterEach, describe, expect, it, vi } from 'vitest';
import { warnOnce } from '../../src/core/logger.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('warnOnce', () => {
  it('logs only once for the same key and logs for a different key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    warnOnce('logger-test-repeat', 'İlk uyarı');
    warnOnce('logger-test-repeat', 'Yinelenen uyarı');
    warnOnce('logger-test-distinct', 'Farklı uyarı');

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenNthCalledWith(1, '[FutRUSH]', 'İlk uyarı');
    expect(warn).toHaveBeenNthCalledWith(2, '[FutRUSH]', 'Farklı uyarı');
  });
});
