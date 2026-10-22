import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { state } from '../../src/core/state.js';
import { emit } from '../../src/core/events.js';
import { addBotLog } from '../../src/bot/botLog.js';
import { renderBotLogs, addBotLogEntry } from '../../src/ui/panel/tabs/logsTab.js';

describe('logsTab wait overlay and jitter breakdown', () => {
  let dom;
  let container;

  beforeAll(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
  });

  beforeEach(() => {
    state.botLogs = [];
    state.botLogId = 0;
    state.botRunning = false;
    state.botWait = null;
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.className = 'fr-bot-logs-panel';
    document.body.appendChild(container);
    renderBotLogs(container);
  });

  it('adds wait tag and triggers sliding wait animation on "uygun ilan bulunamadı" log row', () => {
    state.botRunning = true;
    addBotLog('Kimmich: Satın Al sınırında uygun ilan bulunamadı.', 'info');
    addBotLogEntry(container);

    const list = container.querySelector('.fr-log-list');
    const row = list.querySelector('.fr-log-row');
    expect(row).toBeTruthy();
    expect(row.querySelector('.log-wait-tag')).toBeNull();

    // Trigger bot:wait
    state.botWait = {
      baseMs: 2500,
      jitterMs: 213,
      totalMs: 2713,
      duration: 2713,
      tierRgb: '245, 158, 11',
      tierColor: '#f59e0b'
    };
    emit('bot:wait');

    // Wait tag should be created
    const tag = row.querySelector('.log-wait-tag');
    expect(tag).toBeTruthy();
    expect(tag.textContent).toBe('2713ms');

    // Sliding animation class and CSS vars should be applied
    expect(row.classList.contains('log-wait-active')).toBe(true);
    expect(row.style.getPropertyValue('--wait-ms')).toBe('2713ms');
    expect(row.style.getPropertyValue('--tier-rgb')).toBe('245, 158, 11');

    // Stored on log entry
    expect(state.botLogs[0].baseMs).toBe(2500);
    expect(state.botLogs[0].jitterMs).toBe(213);
    expect(state.botLogs[0].totalMs).toBe(2713);
  });

  it('does not apply sliding animation to purchase success or missed logs', () => {
    state.botRunning = true;
    addBotLog({ name: 'Musiala', rating: 88, price: 50000, kind: 'success' });
    addBotLogEntry(container);

    const row = container.querySelector('.fr-log-row');
    expect(row.classList.contains('log-fx-success')).toBe(true);

    state.botWait = { baseMs: 2000, jitterMs: 100, totalMs: 2100, duration: 2100, tierRgb: '34, 197, 94' };
    emit('bot:wait');

    expect(row.classList.contains('log-wait-active')).toBe(false);
  });

  it('clears animation immediately when bot stops', () => {
    state.botRunning = true;
    addBotLog('Davies: Satın Al sınırında uygun ilan bulunamadı.', 'info');
    addBotLogEntry(container);

    state.botWait = { baseMs: 2500, jitterMs: 100, totalMs: 2600, duration: 2600, tierRgb: '56, 189, 248' };
    emit('bot:wait');

    const row = container.querySelector('.fr-log-row');
    expect(row.classList.contains('log-wait-active')).toBe(true);

    // Stop bot
    state.botRunning = false;
    state.botWait = null;
    emit('bot:wait');

    expect(row.classList.contains('log-wait-active')).toBe(false);
  });

  it('formats copy text with [bekleme {base}+{jitter}={total} ms] suffix', async () => {
    addBotLog({
      message: 'Kane: Satın Al sınırında uygun ilan bulunamadı.',
      kind: 'info',
      baseMs: 2100,
      jitterMs: 406,
      totalMs: 2506
    });
    renderBotLogs(container);

    let copiedText = '';
    globalThis.GM_setClipboard = (txt) => { copiedText = txt; };

    const copyBtn = container.querySelector('.fr-log-copy');
    copyBtn.click();
    await Promise.resolve();

    expect(copiedText).toContain('[bekleme 2100+406=2506 ms]');
  });
});
