// Bot durumu ve loglarini ortak state'e yazar, degisiklik olaylarini yayinlar.
// Bagimliliklar: core/state ve core/events.

import { state } from '../core/state.js';
import { emit } from '../core/events.js';

export function addBotLog(message, type) {
  state.botLogId++;
  const entry = message && typeof message === 'object'
    ? {
        id: state.botLogId,
        at: Date.now(),
        name: String(message.name ?? ''),
        rating: Number(message.rating) || 0,
        price: Number(message.price) || 0,
        kind: String(message.kind || type || 'info')
      }
    : { id: state.botLogId, at: Date.now(), message: String(message), type: type || 'info' };
  state.botLogs.unshift(entry);
  state.botLogs.length = Math.min(state.botLogs.length, 100);
  emit('log:added');
}

export function setBotStatus(message) {
  state.botStatus = String(message || '');
  emit('bot:status');
}
