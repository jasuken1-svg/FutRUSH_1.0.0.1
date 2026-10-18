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
            playerid: '515'
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

  it('matches the selected card resource ID among same-name, same-rating card versions', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [515, 22770, 22771].map((resource_id) => ({
            ID: String(resource_id),
            playername: 'Player One',
            rating: '88',
            resource_id: String(resource_id),
            playerid: '515',
            raretype: resource_id === 515 ? '0' : '18'
          }))
        })
      });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Player One',
      rating: 88,
      selectedCardId: 22770
    })).resolves.toBe(22770);
  });

  it('prefers the exact EA resource ID over a matching Futbin ID', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [
            { ID: '515', playername: 'Esmee Brugts', rating: '85', resource_id: '22771', playerid: '515' },
            { ID: '267530', playername: 'Esmee Brugts', rating: '84', resource_id: '267530', playerid: '515' }
          ]
        })
      });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Esmee Brugts',
      rating: 84,
      futbinId: '515',
      selectedCardId: 267530
    })).resolves.toBe(267530);
  });

  it('masks the Futbin resource ID to the selected EA maskedDefId', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [
            { ID: '515', playername: 'Esmee Brugts', rating: '85', resource_id: '16799987', playerid: '515' },
            { ID: '991', playername: 'Esmee Brugts', rating: '84', resource_id: '267530', playerid: '515' }
          ]
        })
      });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Esmee Brugts',
      rating: 84,
      futbinId: '515',
      selectedCardId: 267530
    })).resolves.toBe(267530);
  });

  it('prefers the standard card when no selected card ID is supplied', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [
            { ID: '515', playername: 'Esmee Brugts', rating: '85', resource_id: '16799987', playerid: '515' },
            { ID: '991', playername: 'Esmee Brugts', rating: '84', resource_id: '267530', playerid: '515' }
          ]
        })
      });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Esmee Brugts',
      rating: 84,
      futbinId: '515'
    })).resolves.toBe(267530);
  });

  it('allows disabling the standard-card preference', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [
            { ID: '515', playername: 'Esmee Brugts', rating: '85', resource_id: '16799987', playerid: '515' },
            { ID: '991', playername: 'Esmee Brugts', rating: '84', resource_id: '267530', playerid: '515' }
          ]
        })
      });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Esmee Brugts',
      rating: 84,
      futbinId: '515',
      preferStandard: false
    })).resolves.toBe(22771);
  });

  it('uses playerid as an EA match while returning the matched resource_id when available', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [
            { ID: '22771', playername: 'Esmee Brugts', rating: '85', resource_id: '22771', playerid: '515' },
            { ID: '267530', playername: 'Esmee Brugts', rating: '84', resource_id: '267530', playerid: '515' }
          ]
        })
      });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Esmee Brugts',
      rating: 84,
      selectedCardId: 515
    })).resolves.toBe(267530);
  });

  it('does not treat a shared player ID as an exact match for a different card version', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [
            { playername: 'Esmee Brugts', rating: '85', resource_id: '22771', playerid: '515' },
            { playername: 'Esmee Brugts', rating: '85', resource_id: '22770', playerid: '515' },
            { playername: 'Esmee Brugts', rating: '84', resource_id: '515', playerid: '515' }
          ]
        })
      });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Esmee Brugts',
      rating: 84,
      selectedCardId: 515
    })).resolves.toBe(515);
  });

  it('does not fall back to a different card version when the selected card ID is absent', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [{
            ID: '740',
            playername: 'Player One',
            rating: '88',
            resource_id: '515',
            playerid: '515'
          }]
        })
      });
    });

    await expect(fetchFutbinPlayerId({
      name: 'Player One',
      rating: 88,
      futbinId: '740',
      selectedCardId: 22771
    })).rejects.toThrow('FutBIN yanıtında eşleşen EA oyuncu kimliği bulunamadı');
  });

  it('fills a missing target rating from the matched FutBIN player', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [{
            ID: '740',
            playername: 'Player One',
            rating: '88',
            resource_id: '22770',
            playerid: '515'
          }]
        })
      });
    });
    const target = { name: 'Player One', rating: 0 };

    await expect(fetchFutbinPlayerId(target)).resolves.toBe(22770);

    expect(target.rating).toBe(88);
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
