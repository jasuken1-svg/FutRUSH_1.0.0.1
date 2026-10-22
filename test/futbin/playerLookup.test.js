import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFutbinSearchCache, fetchFutbinPlayerId, fetchPlayerDetailsFromFutbinApi, queryFutbinPlayersByName, searchUniquePlayers } from '../../src/futbin/playerLookup.js';

let originalRequest;

beforeEach(() => {
  clearFutbinSearchCache();
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
      rating: 84
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

  it('queryFutbinPlayersByName caches results for 15 minutes and avoids duplicate network requests', async () => {
    let callCount = 0;
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      callCount++;
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          data: [{ ID: '100', playername: 'Test Player', rating: '85', resource_id: '100', playerid: '100' }]
        })
      });
    });

    const res1 = await queryFutbinPlayersByName('Test Player');
    expect(res1).toHaveLength(1);
    expect(callCount).toBe(1);

    // Second call with same name (even case-insensitive) should use cache
    const res2 = await queryFutbinPlayersByName('test player');
    expect(res2).toEqual(res1);
    expect(callCount).toBe(1);
  });

  describe('searchUniquePlayers (high rating > low rating order)', () => {
    it('groups by unique player and sorts by highest rating descending (e.g. Lamine Yamal before lower-rated players)', async () => {
      const lamRows = [
        { ID: '1', playername: 'Erik Lamela', rating: '77', resource_id: '101', playerid: '101', raretype: '0' },
        { ID: '2', playername: 'Lamine Yamal', rating: '81', resource_id: '201', playerid: '201', raretype: '0' },
        { ID: '3', playername: 'Lamine Yamal', rating: '88', resource_id: '67000201', playerid: '201', raretype: '44', version: 'Trailblazers' },
        { ID: '4', playername: 'Lamine Yamal', rating: '84', resource_id: '67000202', playerid: '201', raretype: '3' },
        { ID: '5', playername: 'Lamare Bogarde', rating: '68', resource_id: '301', playerid: '301', raretype: '0' }
      ];

      globalThis.GM_xmlhttpRequest = vi.fn((options) => {
        options.onload({
          status: 200,
          responseText: JSON.stringify({ data: lamRows })
        });
      });

      const players = await searchUniquePlayers('Lam');

      // Unique players grouped: 3 players (Lamine Yamal, Erik Lamela, Lamare Bogarde)
      expect(players).toHaveLength(3);

      // Sorted strictly: highest rating > lower rating
      expect(players[0].name).toBe('Lamine Yamal');
      expect(players[0].baseRating).toBe(81);
      expect(players[0].highestRating).toBe(88);
      expect(players[0].versions).toHaveLength(3);

      expect(players[1].name).toBe('Erik Lamela');
      expect(players[1].baseRating).toBe(77);
      expect(players[1].highestRating).toBe(77);

      expect(players[2].name).toBe('Lamare Bogarde');
      expect(players[2].baseRating).toBe(68);
      expect(players[2].highestRating).toBe(68);
    });

    it('sets baseRating to player base card rating (e.g. Alexia Putellas Segura base card 91 even if promo is 92)', async () => {
      const putellasRows = [
        { ID: '10', playername: 'Alexia Putellas Segura', rating: '92', resource_id: '67000100', playerid: '100', raretype: '3', version: 'TOTW' },
        { ID: '11', playername: 'Alexia Putellas Segura', rating: '91', resource_id: '100', playerid: '100', raretype: '1' }
      ];

      globalThis.GM_xmlhttpRequest = vi.fn((options) => {
        options.onload({
          status: 200,
          responseText: JSON.stringify({ data: putellasRows })
        });
      });

      const players = await searchUniquePlayers('Alexia Putellas');
      expect(players).toHaveLength(1);
      expect(players[0].name).toBe('Alexia Putellas Segura');
      expect(players[0].baseRating).toBe(91);
      expect(players[0].highestRating).toBe(92);
    });
  });

  describe('fetchPlayerDetailsFromFutbinApi', () => {
    it('fetches player details from getFilteredPlayers and extracts playstylesPlus', async () => {
      const requests = [];
      globalThis.GM_xmlhttpRequest = vi.fn((options) => {
        requests.push(options.url);
        options.onload({
          status: 200,
          responseText: JSON.stringify({
            data: [{
              ID: '999',
              playername: 'Pernille Harder',
              rating: '85',
              resource_id: '231478',
              playerid: '231478',
              playstyles_plus: "u'Precision Header'"
            }]
          })
        });
      });

      const details = await fetchPlayerDetailsFromFutbinApi({
        name: 'Pernille Harder',
        rating: 85,
        eaId: 231478
      });

      expect(details).not.toBeNull();
      expect(details.name).toBe('Pernille Harder');
      expect(details.rating).toBe(85);
      expect(details.playstylesPlus).toEqual([
        expect.objectContaining({ name: 'Precision Header' })
      ]);
      expect(requests[0]).toContain('https://www.futbin.org/futbin/api/27/getFilteredPlayers');
      expect(requests[0]).toContain('search=Pernille+Harder');
    });

    it('falls back to rating search and caches results', async () => {
      let callCount = 0;
      globalThis.GM_xmlhttpRequest = vi.fn((options) => {
        callCount++;
        // search returns empty data
        if (options.url.includes('search=')) {
          options.onload({ status: 200, responseText: '{"data":[]}' });
          return;
        }
        // rating query returns player
        options.onload({
          status: 200,
          responseText: JSON.stringify({
            data: [{
              ID: '123',
              playername: 'Caroline Graham Hansen',
              rating: '90',
              resource_id: '227290',
              playstyles_plus: "['Whipped Cross']"
            }]
          })
        });
      });

      const first = await fetchPlayerDetailsFromFutbinApi({
        name: 'Caroline Graham Hansen',
        rating: 90,
        eaId: 227290
      });
      expect(first).not.toBeNull();
      expect(first.playstylesPlus).toEqual([
        expect.objectContaining({ name: 'Whipped Cross' })
      ]);

      const initialCalls = callCount;
      // Second call should return from cache without network calls
      const cached = await fetchPlayerDetailsFromFutbinApi({
        name: 'Caroline Graham Hansen',
        rating: 90,
        eaId: 227290
      });
      expect(cached).toEqual(first);
      expect(callCount).toBe(initialCalls);
    });

    it('returns null when API returns an error or no match', async () => {
      globalThis.GM_xmlhttpRequest = vi.fn((options) => {
        options.onload({ status: 500, responseText: 'Server Error' });
      });

      const result = await fetchPlayerDetailsFromFutbinApi({
        name: 'Nonexistent Player',
        rating: 80
      });
      expect(result).toBeNull();
    });
  });
});
