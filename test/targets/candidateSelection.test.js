import { describe, expect, it, vi, beforeEach } from 'vitest';
import { filterCandidates } from '../../src/futbin/candidateMatcher.js';
import { clearFutbinSearchCache, fetchFutbinPlayerId, searchPlayerAllVersions } from '../../src/futbin/playerLookup.js';
import { state } from '../../src/core/state.js';
import { commitCandidateTarget } from '../../src/targets/pinnedPlayer.js';

describe('candidate selection integration', () => {
  const brugtsData = [
    {
      ID: '22770',
      playername: 'Esmee Brugts',
      rating: '85',
      resource_id: '67376394',
      playerid: '267530',
      raretype: '3',
      image: 'https://cdn.futbin.com/players/p67376394.png',
      cardImage: 'https://cdn.futbin.com/cards/hd/3_team_of_the_week.png',
      ps_LCPrice: 82500
    },
    {
      ID: '22771',
      playername: 'Esmee Brugts',
      rating: '85',
      resource_id: '50599178',
      playerid: '267530',
      raretype: '3',
      holographicAnimation: '/design2/img/static/card-animations/27/animation.webp',
      image: 'https://cdn.futbin.com/players/p50599178.png',
      ps_LCPrice: 108000
    },
    {
      ID: '267530',
      playername: 'Esmee Brugts',
      rating: '84',
      resource_id: '267530',
      playerid: '267530',
      raretype: '0',
      image: 'https://cdn.futbin.com/players/p267530.png',
      ps_LCPrice: 1200
    }
  ];

  beforeEach(() => {
    clearFutbinSearchCache();
    state.targets = [];
    state.pendingCandidates = null;
  });

  it('filters out 84 gold base card and returns only the two 85 TOTW cards when TOTW rarity is requested', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({ data: brugtsData })
      });
    });

    const result = await fetchFutbinPlayerId({
      name: 'Esmee Brugts',
      playerId: 267530,
      rarityIds: ['3'],
      returnDetails: true
    });

    expect(result.status).toBe('ambiguous');
    expect(result.candidates).toHaveLength(2);

    // Both cards must have rating 85, neither is 84
    expect(result.candidates.map((c) => c.rating)).toEqual([85, 85]);
    expect(result.candidates.map((c) => c.versionLabel)).toEqual(['TOTW (Standart)', 'TOTW (Holo)']);
    expect(result.candidates.map((c) => c.eaId)).toEqual([67376394, 50599178]);
  });

  it('commitCandidateTarget adds target with rating 85 and full EA definition ID', () => {
    const candidate = {
      name: 'Esmee Brugts',
      rating: 85,
      futbinId: '22770',
      eaId: 67376394,
      playerId: 267530,
      versionLabel: 'TOTW (Standart)'
    };

    commitCandidateTarget(candidate, 83000);

    expect(state.targets).toHaveLength(1);
    expect(state.targets[0]).toMatchObject({
      name: 'Esmee Brugts',
      rating: 85,
      eaId: 67376394,
      price: 83000,
      versionKnown: true
    });
    expect(state.pendingCandidates).toBeNull();
  });

  it('directly resolves status: "ok" for non-TOTW promo when there is a single match', async () => {
    const promoData = [
      {
        ID: '12345',
        playername: 'Test Promo Player',
        rating: '89',
        resource_id: '67999888',
        playerid: '999888',
        raretype: '44',
        version: 'Trailblazers'
      },
      {
        ID: '999888',
        playername: 'Test Promo Player',
        rating: '85',
        resource_id: '999888',
        playerid: '999888',
        raretype: '0'
      }
    ];

    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({ data: promoData })
      });
    });

    const result = await fetchFutbinPlayerId({
      name: 'Test Promo Player',
      playerId: 999888,
      rarityIds: ['44'],
      returnDetails: true
    });

    expect(result.status).toBe('ok');
    expect(result.eaId).toBe(67999888);
    expect(result.candidate.versionLabel).toBe('Trailblazers');
  });

  it('directly resolves status: "ok" for non-TOTW promo matching target.rating among multiple cards', async () => {
    const promoData = [
      {
        ID: '12345',
        playername: 'Multi Promo Player',
        rating: '87',
        resource_id: '67000001',
        playerid: '55555',
        raretype: '72',
        version: 'Heroes'
      },
      {
        ID: '12346',
        playername: 'Multi Promo Player',
        rating: '89',
        resource_id: '67000002',
        playerid: '55555',
        raretype: '72',
        version: 'Heroes'
      }
    ];

    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({ data: promoData })
      });
    });

    const result = await fetchFutbinPlayerId({
      name: 'Multi Promo Player',
      playerId: 55555,
      rating: 89,
      rarityIds: ['72'],
      returnDetails: true
    });

    expect(result.status).toBe('ok');
    expect(result.eaId).toBe(67000002);
    expect(result.rating).toBe(89);
  });

  it('searchPlayerAllVersions returns all versions sorted by price ascending', async () => {
    globalThis.GM_xmlhttpRequest = vi.fn((options) => {
      options.onload({
        status: 200,
        responseText: JSON.stringify({ data: brugtsData })
      });
    });

    const versions = await searchPlayerAllVersions('Esmee Brugts');

    expect(versions).toHaveLength(3);
    // Lowest price first: 1200 (Base) -> 82500 (TOTW Standart) -> 108000 (TOTW Holo)
    expect(versions[0].price).toBe(1200);
    expect(versions[0].versionLabel).toBe('Base');
    expect(versions[0].rating).toBe(84);

    expect(versions[1].price).toBe(82500);
    expect(versions[1].versionLabel).toBe('TOTW (Standart)');
    expect(versions[1].rating).toBe(85);

    expect(versions[2].price).toBe(108000);
    expect(versions[2].versionLabel).toBe('TOTW (Holo)');
    expect(versions[2].rating).toBe(85);

    // Image URLs present
    expect(versions[1].playerImageUrl).toBe('https://cdn.futbin.com/players/p67376394.png');
    expect(versions[1].promoImageUrl).toBe('https://cdn.futbin.com/cards/hd/3_team_of_the_week.png');
  });
});
