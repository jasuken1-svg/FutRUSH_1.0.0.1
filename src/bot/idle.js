// Bot beklemelerini durdurma belirtecini izleyerek dilimlere ayirir.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { wait } from '../utils/async.js';

export async function idleWait(ms, token, kind) {
  const duration = Math.max(0, Number(ms) || 0);
  state.botWait = { start: Date.now(), duration, kind };
  let elapsed = 0;
  try {
    emit('bot:wait');
    while (elapsed < duration) {
      if (token !== state.botToken || !state.botRunning) return false;
      const slice = Math.min(100, duration - elapsed);
      await wait(slice);
      elapsed += slice;
    }
    return token === state.botToken && state.botRunning;
  } finally {
    state.botWait = null;
    emit('bot:wait');
  }
}
