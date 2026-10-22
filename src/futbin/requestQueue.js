// FutBIN istek kuyruğu: maksimum 2 eşzamanlı istek, tekilleştirme (dedup),
// 429/403 için Retry-After ve üstel geri çekilme (exponential backoff).
// Bagimliliklar: core/events ve ui/marketLogBox.

import { emit } from '../core/events.js';
import { addMarketLog } from '../ui/marketLogBox.js';

export const MAX_CONCURRENT = 2;
export const INITIAL_BACKOFF_MS = 2000;
export const MAX_BACKOFF_MS = 60000;
export const MAX_RETRIES = 3;

let activeCount = 0;
let backoffUntil = 0;
let currentBackoffDelay = INITIAL_BACKOFF_MS;
let backoffTimer = null;

// url -> Promise
const inFlightRequests = new Map();

// [{ url, executeFn, resolve, reject, retries }]
const queue = [];

export function parseRetryAfter(headers) {
  if (!headers) return null;
  const str = typeof headers === 'object' ? JSON.stringify(headers) : String(headers);
  const match = str.match(/retry-after:\s*([^\r\n",]+)/i);
  if (!match) return null;
  const val = match[1].trim();
  const seconds = Number(val);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  const date = Date.parse(val);
  if (Number.isFinite(date) && date > Date.now()) {
    return date - Date.now();
  }
  return null;
}

export function getFutbinQueueStatus() {
  const now = Date.now();
  const backoffMs = Math.max(0, backoffUntil - now);
  return {
    pending: queue.length,
    active: activeCount,
    backoffMs
  };
}

function broadcastQueueStatus() {
  emit('futbin:queue', getFutbinQueueStatus());
}

export function clearFutbinQueue() {
  queue.length = 0;
  inFlightRequests.clear();
  activeCount = 0;
  backoffUntil = 0;
  currentBackoffDelay = INITIAL_BACKOFF_MS;
  if (backoffTimer) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
  broadcastQueueStatus();
}

function schedulePump() {
  const now = Date.now();
  if (now < backoffUntil) {
    if (!backoffTimer) {
      backoffTimer = setTimeout(() => {
        backoffTimer = null;
        if (Date.now() >= backoffUntil) {
          addMarketLog({
            text: '[FutBIN Kuyruk] Engel süresi bitti, istekler sürdürülüyor.',
            type: 'info'
          });
        }
        broadcastQueueStatus();
        pumpQueue();
      }, Math.max(50, backoffUntil - now));
    }
    return;
  }

  pumpQueue();
}

function pumpQueue() {
  const now = Date.now();
  if (now < backoffUntil) {
    schedulePump();
    return;
  }

  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const task = queue.shift();
    if (!task) break;

    activeCount++;
    broadcastQueueStatus();
    runTask(task);
  }
}

async function runTask(task) {
  try {
    const response = await task.executeFn();
    const status = Number(response?.status || (response && typeof response === 'object' && response.status)) || 200;

    if (status === 429 || status === 403) {
      const headers = response?.responseHeaders || response?.headers;
      const retryAfter = parseRetryAfter(headers);
      const jitter = Math.floor(Math.random() * 500);
      const delay = retryAfter != null
        ? retryAfter
        : Math.min(MAX_BACKOFF_MS, currentBackoffDelay * Math.pow(2, task.retries) + jitter);

      currentBackoffDelay = Math.min(MAX_BACKOFF_MS, Math.max(INITIAL_BACKOFF_MS, delay));
      backoffUntil = Date.now() + delay;

      addMarketLog({
        text: `[FutBIN Kuyruk] HTTP ${status} engeli: ${Math.ceil(delay / 1000)}sn bekleniyor (Deneme: ${task.retries + 1}/${MAX_RETRIES}, ${queue.length + 1} bekleyen).`,
        type: 'error'
      });

      broadcastQueueStatus();

      if (task.retries < MAX_RETRIES) {
        task.retries++;
        queue.unshift(task);
        schedulePump();
      } else {
        addMarketLog({
          text: `[FutBIN] İstek başarısız: Maksimum deneme (${MAX_RETRIES}) aşıldı (${task.url}).`,
          type: 'error'
        });
        task.reject(new Error(`FutBIN isteği başarısız (HTTP ${status}, maksimum deneme aşıldı).`));
      }
    } else {
      currentBackoffDelay = INITIAL_BACKOFF_MS;
      task.resolve(response);
    }
  } catch (err) {
    task.reject(err);
  } finally {
    activeCount--;
    inFlightRequests.delete(task.url);
    broadcastQueueStatus();
    schedulePump();
  }
}

export function enqueueFutbinRequest(url, executeFn) {
  if (!url) return Promise.reject(new Error('Kuyruk için URL gereklidir.'));
  const trimmed = String(url).trim();

  // Deduplication: Aynı URL için bekleyen veya devam eden bir istek varsa mevcut Promise'i dön
  if (inFlightRequests.has(trimmed)) {
    return inFlightRequests.get(trimmed);
  }

  const promise = new Promise((resolve, reject) => {
    queue.push({
      url: trimmed,
      executeFn,
      resolve,
      reject,
      retries: 0
    });
    broadcastQueueStatus();
    schedulePump();
  });

  inFlightRequests.set(trimmed, promise);
  return promise;
}
