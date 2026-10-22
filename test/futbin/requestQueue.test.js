import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_CONCURRENT,
  MAX_RETRIES,
  clearFutbinQueue,
  enqueueFutbinRequest,
  getFutbinQueueStatus,
  parseRetryAfter
} from '../../src/futbin/requestQueue.js';

vi.mock('../../src/ui/marketLogBox.js', () => ({
  addMarketLog: vi.fn()
}));

const { addMarketLog } = await import('../../src/ui/marketLogBox.js');

describe('requestQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearFutbinQueue();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearFutbinQueue();
    vi.useRealTimers();
  });

  it('limits concurrency to MAX_CONCURRENT (2)', async () => {
    let currentlyRunning = 0;
    let maxObserved = 0;

    const createTask = () => () => new Promise((resolve) => {
      currentlyRunning++;
      maxObserved = Math.max(maxObserved, currentlyRunning);
      setTimeout(() => {
        currentlyRunning--;
        resolve({ status: 200, responseText: 'ok' });
      }, 50);
    });

    const p1 = enqueueFutbinRequest('url1', createTask());
    const p2 = enqueueFutbinRequest('url2', createTask());
    const p3 = enqueueFutbinRequest('url3', createTask());
    const p4 = enqueueFutbinRequest('url4', createTask());

    expect(getFutbinQueueStatus().active).toBe(2);
    expect(getFutbinQueueStatus().pending).toBe(2);

    await vi.advanceTimersByTimeAsync(60);
    expect(maxObserved).toBe(2);

    await vi.advanceTimersByTimeAsync(60);
    await Promise.all([p1, p2, p3, p4]);

    expect(maxObserved).toBe(MAX_CONCURRENT);
    expect(getFutbinQueueStatus().active).toBe(0);
    expect(getFutbinQueueStatus().pending).toBe(0);
  });

  it('deduplicates in-flight requests for the same URL', async () => {
    let callCount = 0;
    const task = () => new Promise((resolve) => {
      callCount++;
      setTimeout(() => resolve({ status: 200, data: 'shared' }), 100);
    });

    const p1 = enqueueFutbinRequest('https://futbin.org/api/duplicate', task);
    const p2 = enqueueFutbinRequest('https://futbin.org/api/duplicate', task);

    expect(p1).toBe(p2);
    expect(callCount).toBe(1);

    await vi.advanceTimersByTimeAsync(110);
    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1).toBe(res2);
    expect(callCount).toBe(1);
  });

  it('applies exponential backoff on HTTP 429 and retries until success', async () => {
    let attempts = 0;
    const task = vi.fn(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.resolve({ status: 429, responseHeaders: 'retry-after: 2' });
      }
      return Promise.resolve({ status: 200, data: 'recovered' });
    });

    const promise = enqueueFutbinRequest('https://futbin.org/api/backoff', task);

    await vi.advanceTimersByTimeAsync(10);
    expect(attempts).toBe(1);
    expect(getFutbinQueueStatus().backoffMs).toBeGreaterThan(0);
    expect(addMarketLog).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error'
    }));

    // Backoff süresi geçene kadar istek yeniden denenmemeli
    await vi.advanceTimersByTimeAsync(1500);
    expect(attempts).toBe(1);

    // 2000ms dolduğunda retry tetiklenmeli
    await vi.advanceTimersByTimeAsync(600);
    const res = await promise;
    expect(attempts).toBe(2);
    expect(res.data).toBe('recovered');
    expect(getFutbinQueueStatus().backoffMs).toBe(0);
  });

  it('correctly parses Retry-After header in seconds and date format', () => {
    expect(parseRetryAfter('retry-after: 15')).toBe(15000);
    expect(parseRetryAfter('Content-Type: text/html\r\nRetry-After: 30\r\n')).toBe(30000);
    expect(parseRetryAfter('invalid')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });

  it('fails with error and logs to FutRUSH Log when max retries is exceeded', async () => {
    const task = vi.fn(() => Promise.resolve({ status: 403, responseHeaders: '' }));

    const promise = enqueueFutbinRequest('https://futbin.org/api/blocked', task);
    const rejectionExpectation = expect(promise).rejects.toThrow('FutBIN isteği başarısız');

    // Initial attempt + 3 retries = 4 attempts total
    for (let i = 0; i <= MAX_RETRIES + 1; i++) {
      await vi.advanceTimersByTimeAsync(65000);
    }

    await rejectionExpectation;
    expect(addMarketLog).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('Maksimum deneme'),
      type: 'error'
    }));
  });
});
