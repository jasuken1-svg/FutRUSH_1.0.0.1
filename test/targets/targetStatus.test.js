import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/core/config.js';
import { on } from '../../src/core/events.js';
import { state } from '../../src/core/state.js';
import { setTargetStatus } from '../../src/targets/targetStatus.js';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  state.targetStatus = null;
});

describe('setTargetStatus', () => {
  it('expires a held status and emits targets:status-expire', () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const updated = vi.fn();
    const stop = on('targets:status-expire', expired);
    const stopUpdated = on('targets:status', updated);

    setTargetStatus({ type: 'success', message: 'Eklendi', holdMs: 300 });
    expect(state.targetStatus.message).toBe('Eklendi');
    expect(updated).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(299);
    expect(state.targetStatus.message).toBe('Eklendi');
    vi.advanceTimersByTime(1);
    expect(state.targetStatus).toBeNull();
    expect(expired).toHaveBeenCalledOnce();

    stop();
    stopUpdated();
  });

  it('cancels the previous timer when a new status replaces it', () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const stop = on('targets:status-expire', expired);

    setTargetStatus({ type: 'success', message: 'İlk', holdMs: 100 });
    vi.advanceTimersByTime(50);
    setTargetStatus({ type: 'error', message: 'İkinci', holdMs: 200 });
    vi.advanceTimersByTime(50);
    expect(state.targetStatus.message).toBe('İkinci');
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(state.targetStatus).toBeNull();
    expect(expired).toHaveBeenCalledOnce();

    stop();
  });

  it('keeps loading statuses until another status replaces them', () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const stop = on('targets:status-expire', expired);

    setTargetStatus({ type: 'loading', message: 'Yükleniyor', holdMs: 10 });
    vi.advanceTimersByTime(10000);
    expect(state.targetStatus.message).toBe('Yükleniyor');
    expect(expired).not.toHaveBeenCalled();

    stop();
  });

  it('uses the configured default hold durations for success and error', () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const stop = on('targets:status-expire', expired);

    expect(CONFIG.ui.statusHoldMs).toBe(3000);
    expect(CONFIG.ui.statusErrorHoldMs).toBe(6000);
    setTargetStatus({ type: 'success', message: 'Tamamlandı' });
    vi.advanceTimersByTime(2999);
    expect(state.targetStatus.message).toBe('Tamamlandı');
    vi.advanceTimersByTime(1);
    expect(state.targetStatus).toBeNull();

    setTargetStatus({ type: 'error', message: 'Hata' });
    vi.advanceTimersByTime(5999);
    expect(state.targetStatus.message).toBe('Hata');
    vi.advanceTimersByTime(1);
    expect(state.targetStatus).toBeNull();
    expect(expired).toHaveBeenCalledTimes(2);

    stop();
  });
});
