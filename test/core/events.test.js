import { afterEach, describe, expect, it, vi } from 'vitest';
import { emit, off, on } from '../../src/core/events.js';

const subscriptions = [];

afterEach(() => {
  subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
});

describe('event bus', () => {
  it('calls listeners registered with on and passes emitted arguments', () => {
    const listener = vi.fn();
    subscriptions.push(on('test:event:emit', listener));

    emit('test:event:emit', 'value', 42);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith('value', 42);
  });

  it('removes a listener with off', () => {
    const listener = vi.fn();
    on('test:event:off', listener);

    off('test:event:off', listener);
    emit('test:event:off');

    expect(listener).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function from on', () => {
    const listener = vi.fn();
    const unsubscribe = on('test:event:unsubscribe', listener);

    unsubscribe();
    emit('test:event:unsubscribe');

    expect(listener).not.toHaveBeenCalled();
  });
});
