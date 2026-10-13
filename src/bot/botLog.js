import { state } from '../core/state.js';
import { emit } from '../core/events.js';

export function addBotLog(message, type) {
  state.botLogs.unshift({ at: Date.now(), message: String(message), type: type || 'info' });
  state.botLogs.length = Math.min(state.botLogs.length, 100);
  emit('log:added');
}

export function setBotStatus(message) {
  state.botStatus = String(message || '');
  emit('bot:status');
}
