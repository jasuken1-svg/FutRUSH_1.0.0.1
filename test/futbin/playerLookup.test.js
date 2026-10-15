import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFutbinPlayerId } from '../../src/futbin/playerLookup.js';

let originalRequest;

beforeEach(() => {
  originalRequest = Object.getOwnPropertyDescriptor(globalThis, 'GM_xmlhttpRequest');
});

afterEach(() => {
  if (originalRequest) Object.defineProperty(globalThis, 'GM_xmlhttpRequest', originalRequest);
  else delete globalThis.GM_xmlhttpRequest;
  vi.restoreAllMocks();
});

describe('fetchFutbinPlayerId', () => {
  it('retries a stale full-name query and accepts only the matching Futbin card ID', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const requests = [];
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      requests.push(options.url);
      const responseText = requests.length === 1
        ? '{"data":[]}'
        : JSON.stringify({
          data: [{
            ID: '740',
            playername: 'Lindsey Heaps',
            rating: '86',
            resource_id: '231432',
            playerid: '231432'
          }]
        });
      options.onload({ status: 200, responseText });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Lindsey Heaps',
      rating: 86,
      futbinId: '740'
    })).resolves.toBe(231432);

    expect(requests).toEqual([
      'https://www.futbin.org/futbin/api/searchPlayersByName?playername=Lindsey%20Heaps',
      'https://www.futbin.org/futbin/api/searchPlayersByName?playername=Heaps'
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not use a name-only result during a Futbin ID fallback search', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const requests = [];
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      requests.push(options.url);
      options.onload({
        status: 200,
        responseText: requests.length === 1
          ? '{"data":[]}'
          : JSON.stringify({
            data: [{
              ID: '999',
              playername: 'Lindsey Heaps',
              rating: '86',
              resource_id: '111',
              playerid: '111'
            }]
          })
      });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Lindsey Heaps',
      rating: 86,
      futbinId: '740'
    })).rejects.toThrow('FutBIN kart kimliği 740');
  });
});
