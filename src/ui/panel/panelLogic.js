export function logTone(type) {
  if (type === 'success') return 'success';
  if (type === 'error' || type === 'missed' || type === 'warn') return 'error';
  return 'info';
}

export function botLogType(entry) {
  return entry?.kind || entry?.type || 'info';
}

export function chronologicalBotLogs(logs = []) {
  return logs.slice().reverse();
}

export function shouldAutoScrollLogList({ scrollHeight = 0, scrollTop = 0, clientHeight = 0 } = {}) {
  return scrollHeight - scrollTop - clientHeight <= 2;
}

export function summarizeBotStats(stats = {}) {
  return {
    bought: Number(stats.bought) || 0,
    missed: Number(stats.missed) || 0,
    searches: Number(stats.searches) || 0
  };
}

export function formatWaitCountdown(remainingMs) {
  const seconds = Math.max(0, Number(remainingMs) || 0) / 1000;
  const rounded = Number(seconds.toFixed(1));
  const text = rounded.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  return text + ' sn';
}

export function normalizeTargetStatus(status) {
  if (!status || typeof status !== 'object') return null;
  const normalized = {
    type: status.type || 'info',
    message: String(status.message ?? '')
  };
  if (status.source) normalized.source = status.source;
  if (
    status.progress &&
    Number.isFinite(Number(status.progress.done)) &&
    Number.isFinite(Number(status.progress.total))
  ) {
    normalized.progress = {
      done: Number(status.progress.done),
      total: Number(status.progress.total)
    };
  }
  return normalized;
}
