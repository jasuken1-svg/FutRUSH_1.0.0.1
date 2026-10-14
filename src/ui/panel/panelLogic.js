const ISSUE_TYPES = new Set(['missed', 'error', 'warn']);

export function filterBotLogs(logs, filter) {
  if (filter === 'purchases') return logs.filter((entry) => entry.type === 'success');
  if (filter === 'issues') return logs.filter((entry) => ISSUE_TYPES.has(entry.type));
  return logs;
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
