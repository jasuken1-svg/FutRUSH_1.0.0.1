import { CONFIG } from '../core/config.js';
import { emit } from '../core/events.js';
import { state } from '../core/state.js';

let holdTimer = null;

export function setTargetStatus({ type, message, source, progress, holdMs } = {}) {
  if (holdTimer !== null) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }

  const status = { type, message };
  if (source !== undefined) status.source = source;
  if (progress !== undefined) status.progress = progress;
  state.targetStatus = status;
  emit('targets:status');

  const duration = holdMs ?? (
    type === 'success' ? CONFIG.ui.statusHoldMs :
      type === 'error' ? CONFIG.ui.statusErrorHoldMs : 0
  );
  if (type !== 'loading' && duration > 0) {
    holdTimer = setTimeout(() => {
      holdTimer = null;
      if (state.targetStatus !== status) return;
      state.targetStatus = null;
      emit('targets:status-expire');
    }, duration);
  }
}
