import { afterEach, describe, expect, it, vi } from 'vitest';
import { on } from '../../src/core/events.js';
import { state } from '../../src/core/state.js';

vi.mock('../../src/utils/dom.js', () => ({
  pageWindow: { setTimeout: (...args) => globalThis.setTimeout(...args) }
}));

const { idleWait } = await import('../../src/bot/idle.js');

afterEach(() => {
  vi.useRealTimers();
  state.botWait = null;
  state.botRunning = false;
  state.botToken = 0;
});

describe('idleWait', () => {
  it('records and clears wait state while emitting both wait events', async () => {
    vi.useFakeTimers();
    state.botRunning = true;
    state.botToken = 4;
    const snapshots = [];
    const unsubscribe = on('bot:wait', () => snapshots.push(state.botWait));
    const waiting = idleWait(250, 4, 'search');
    await vi.advanceTimersByTimeAsync(250);

    expect(await waiting).toBe(true);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({ duration: 250, kind: 'search' });
    expect(snapshots[1]).toBeNull();
    unsubscribe();
  });

  it('returns false promptly when the token changes or the bot stops', async () => {
    vi.useFakeTimers();
    state.botRunning = true;
    state.botToken = 5;
    const tokenWait = idleWait(500, 5, 'search');
    setTimeout(() => { state.botToken++; }, 50);
    await vi.advanceTimersByTimeAsync(500);
    expect(await tokenWait).toBe(false);
    expect(state.botWait).toBeNull();

    state.botRunning = true;
    const stoppedWait = idleWait(500, state.botToken, 'cycle');
    state.botRunning = false;
    await vi.advanceTimersByTimeAsync(500);
    expect(await stoppedWait).toBe(false);
    expect(state.botWait).toBeNull();
  });
});
