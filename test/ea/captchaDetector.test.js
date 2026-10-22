import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  initDomCaptchaDetector,
  initNetworkCaptchaDetector,
  isCaptchaElement,
  checkCaptchaInDom
} from '../../src/ea/captchaDetector.js';
import { SafetyGovernor, safetyGovernor } from '../../src/bot/safetyGovernor.js';
import { observeEaRequest, isCaptchaResponse } from '../../src/ea/observe.js';
import { renderPanelTabs } from '../../src/ui/panel/panelTabs.js';
import { state } from '../../src/core/state.js';

let dom;
let originalDocument;
let originalWindow;

beforeAll(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://futrush.test' });
  originalDocument = globalThis.document;
  originalWindow = globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
});

afterAll(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
});

describe('Captcha Emergency Stopper (Aşama 4)', () => {
  beforeEach(() => {
    safetyGovernor.resume();
    state.botRunning = true;
    state.botToken = 1;
    state.botLogs = [];
    dom.window.document.body.innerHTML = '';
  });

  afterEach(() => {
    safetyGovernor.resume();
    state.botRunning = false;
  });

  describe('DOM Captcha Detection', () => {
    it('identifies Arkose Labs and FunCaptcha iframes and elements', () => {
      const arkoseIframe = dom.window.document.createElement('iframe');
      arkoseIframe.src = 'https://client-api.arkoselabs.com/fc/api/';
      expect(isCaptchaElement(arkoseIframe)).toBe(true);

      const funcaptchaIframe = dom.window.document.createElement('iframe');
      funcaptchaIframe.src = 'https://funcaptcha.com/fc/api/';
      expect(isCaptchaElement(funcaptchaIframe)).toBe(true);

      const normalIframe = dom.window.document.createElement('iframe');
      normalIframe.src = 'https://example.com';
      expect(isCaptchaElement(normalIframe)).toBe(false);

      const container = dom.window.document.createElement('div');
      container.id = 'fc-iframe-wrap';
      expect(isCaptchaElement(container)).toBe(true);

      const classContainer = dom.window.document.createElement('div');
      classContainer.className = 'arkose-challenge-container';
      expect(isCaptchaElement(classContainer)).toBe(true);
    });

    it('triggers SafetyGovernor.halt("captcha") via MutationObserver when captcha element is added', () => {
      let observerCallback = null;
      class MockMutationObserver {
        constructor(cb) {
          observerCallback = cb;
        }
        observe() {}
        disconnect() {}
      }

      const mockDoc = {
        body: { nodeType: 1 },
        querySelector: vi.fn(() => null)
      };

      initDomCaptchaDetector({
        document: mockDoc,
        MutationObserver: MockMutationObserver
      });

      expect(safetyGovernor.isCaptchaHalted()).toBe(false);

      const captchaNode = {
        nodeType: 1,
        tagName: 'IFRAME',
        src: 'https://client-api.arkoselabs.com/fc/gc/'
      };

      // Simulate DOM mutation
      observerCallback([{ addedNodes: [captchaNode] }]);

      expect(safetyGovernor.isCaptchaHalted()).toBe(true);
      expect(state.botRunning).toBe(false);
      expect(state.botLogs.some((l) => l.type === 'error' && l.message.includes('CAPTCHA'))).toBe(true);
    });

    it('triggers immediately if captcha element already exists in DOM upon initialization', () => {
      const mockDoc = {
        body: { nodeType: 1 },
        querySelector: (sel) => sel.includes('arkoselabs') ? {} : null
      };

      initDomCaptchaDetector({
        document: mockDoc,
        MutationObserver: class { observe() {} disconnect() {} }
      });

      expect(safetyGovernor.isCaptchaHalted()).toBe(true);
    });
  });

  describe('EA Network Response Captcha Detection', () => {
    it('detects captcha response code 458 in isCaptchaResponse', () => {
      expect(isCaptchaResponse({ success: false, status: 458 })).toBe(true);
      expect(isCaptchaResponse({ success: false, error: { code: 458 } })).toBe(true);
      expect(isCaptchaResponse({ success: false, error: { status: '458' } })).toBe(true);
      expect(isCaptchaResponse({ success: false, error: { message: 'EA CAPTCHA doğrulaması gerekiyor.' } })).toBe(true);
      expect(isCaptchaResponse({ success: false, status: 500, error: { code: 500 } })).toBe(false);
    });

    it('observeEaRequest halts safety governor when 458 response is received', async () => {
      const observable = {
        observe: (_scope, cb) => {
          cb(observable, { success: false, status: 458, error: { code: 458 } });
        },
        unobserve: vi.fn()
      };

      expect(safetyGovernor.isCaptchaHalted()).toBe(false);
      await observeEaRequest(observable, 1000);

      expect(safetyGovernor.isCaptchaHalted()).toBe(true);
      expect(state.botRunning).toBe(false);
    });

    it('intercepts fetch response status 458 and halts governor', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 458 });
      const mockWin = { fetch: mockFetch };

      initNetworkCaptchaDetector({ window: mockWin });

      expect(safetyGovernor.isCaptchaHalted()).toBe(false);
      await mockWin.fetch('https://utas.fut.ea.com/ut/game/fc25/transfermarket');

      expect(safetyGovernor.isCaptchaHalted()).toBe(true);
    });
  });

  describe('Locking All Outgoing EA Requests', () => {
    it('observeEaRequest blocks outgoing requests when captcha is halted', async () => {
      safetyGovernor.halt('captcha');
      const observeFn = vi.fn();
      const observable = { observe: observeFn, unobserve: vi.fn() };

      const res = await observeEaRequest(observable, 1000);
      expect(res.blocked).toBe(true);
      expect(res.success).toBe(false);
      expect(observeFn).not.toHaveBeenCalled();
    });

    it('fetch blocks outgoing EA requests when captcha is halted', async () => {
      safetyGovernor.halt('captcha');
      const mockFetch = vi.fn().mockResolvedValue({ status: 200 });
      const mockWin = { fetch: mockFetch };

      initNetworkCaptchaDetector({ window: mockWin });

      await expect(
        mockWin.fetch('https://utas.fut.ea.com/ut/game/fc25/transfermarket')
      ).rejects.toThrow(/kilitlendi/i);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetch allows non-EA and Arkose requests even when captcha is halted', async () => {
      safetyGovernor.halt('captcha');
      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockWin = { fetch: mockFetch };

      initNetworkCaptchaDetector({ window: mockWin });

      const res = await mockWin.fetch('https://client-api.arkoselabs.com/fc/api/');
      expect(res.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('unlocks only when user explicitly calls resume ("Captcha\'yı çözdüm, devam et")', async () => {
      safetyGovernor.halt('captcha');
      expect(safetyGovernor.isCaptchaHalted()).toBe(true);

      // Simulates clicking "Captcha'yı çözdüm, devam et"
      safetyGovernor.resume();

      expect(safetyGovernor.isCaptchaHalted()).toBe(false);
      expect(safetyGovernor.isHalted()).toBe(false);

      const observable = {
        observe: (_scope, cb) => cb(observable, { success: true }),
        unobserve: vi.fn()
      };
      const res = await observeEaRequest(observable, 1000);
      expect(res.success).toBe(true);
    });

    it('renders prominent red banner and "Captcha\'yı çözdüm, devam et" button in panel tabs', () => {
      const panel = dom.window.document.createElement('div');
      renderPanelTabs(panel);

      safetyGovernor.halt('captcha');
      const banner = panel.querySelector('.fr-governor-banner');
      const resumeBtn = panel.querySelector('.fr-governor-resume-btn');

      expect(banner.style.display).toBe('flex');
      expect(banner.classList.contains('fr-governor-banner--captcha')).toBe(true);
      expect(resumeBtn.textContent).toBe("Captcha'yı çözdüm, devam et");

      resumeBtn.click();
      expect(safetyGovernor.isCaptchaHalted()).toBe(false);
      expect(banner.style.display).toBe('none');
    });
  });
});
