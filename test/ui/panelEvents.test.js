import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const { renderPanelTabContent } = vi.hoisted(() => ({
  renderPanelTabContent: vi.fn()
}));

vi.mock('../../src/ui/panel/panelTabs.js', () => ({ renderPanelTabContent }));
vi.mock('../../src/ui/panel/panel.js', () => ({
  panel: globalThis.__futrushPanelEventsTestPanel
}));
vi.mock('../../src/ui/panel/tabs/logsTab.js', () => ({
  addBotLogEntry: vi.fn(),
  updateBotLogStats: vi.fn()
}));
vi.mock('../../src/ui/panel/tabs/targetsTab.js', () => ({
  expireTargetStatus: vi.fn(),
  renderTargetContent: vi.fn(),
  updateTargetStatus: vi.fn()
}));

let dom;
let emit;
let registerPanelEvents;
let content;

beforeAll(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://futrush.test' });
  globalThis.document = dom.window.document;
  const panel = document.createElement('div');
  content = document.createElement('div');
  content.className = 'fc-snipe-tab-content';
  panel.appendChild(content);
  globalThis.__futrushPanelEventsTestPanel = panel;

  ({ emit } = await import('../../src/core/events.js'));
  ({ registerPanelEvents } = await import('../../src/ui/panel/panelEvents.js'));
  registerPanelEvents();
});

beforeEach(() => {
  renderPanelTabContent.mockClear();
});

describe('panel events', () => {
  it('rerenders the active panel tab when requested', () => {
    emit('panel:request-render');

    expect(renderPanelTabContent).toHaveBeenCalledOnce();
    expect(renderPanelTabContent).toHaveBeenCalledWith(content);
  });

  it('ignores render requests when the panel has no expanded content', () => {
    content.remove();

    emit('panel:request-render');

    expect(renderPanelTabContent).not.toHaveBeenCalled();
  });
});
