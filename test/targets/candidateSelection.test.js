import { describe, expect, it, vi, beforeEach } from 'vitest';
import { filterCandidates } from '../../src/futbin/candidateMatcher.js';
import { fetchFutbinPlayerId } from '../../src/futbin/playerLookup.js';
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
      raretype: '3'
    },
    {
      ID: '22771',
      playername: 'Esmee Brugts',
      rating: '85',
      resource_id: '50599178',
      playerid: '267530',
      raretype: '3',
      holographicAnimation: '/design2/img/static/card-animations/27/animation.webp'
    },
    {
      ID: '267530',
      playername: 'Esmee Brugts',
      rating: '84',
      resource_id: '267530',
      playerid: '267530',
      raretype: '0'
    }
  ];

  beforeEach(() => {
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
});
