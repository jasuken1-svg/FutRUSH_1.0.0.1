import { describe, expect, it } from 'vitest';
import { isHolo, getVersionLabel, mapCandidate, filterCandidates } from '../../src/futbin/candidateMatcher.js';
import { scoreRow } from '../../src/futbin/playerLookup.js';

describe('candidateMatcher', () => {
  const normalTotwRow = {
    ID: '22770',
    playername: 'Esmee Brugts',
    rating: '85',
    resource_id: '67376394',
    playerid: '267530',
    raretype: '3'
  };

  const holoTotwRow = {
    ID: '22771',
    playername: 'Esmee Brugts',
    rating: '85',
    resource_id: '50599178',
    playerid: '267530',
    raretype: '3',
    holographicAnimation: '/design2/img/static/card-animations/27/animation.webp'
  };

  const goldBaseRow = {
    ID: '267530',
    playername: 'Esmee Brugts',
    rating: '84',
    resource_id: '267530',
    playerid: '267530',
    raretype: '0'
  };

  const otherPlayerTotwRow = {
    ID: '99999',
    playername: 'Other Player',
    rating: '86',
    resource_id: '67123456',
    playerid: '123456',
    raretype: '3'
  };

  describe('isHolo', () => {
    it('returns true strictly when holographicAnimation is present', () => {
      expect(isHolo(holoTotwRow)).toBe(true);
      expect(isHolo(normalTotwRow)).toBe(false);
      expect(isHolo(goldBaseRow)).toBe(false);
      expect(isHolo(null)).toBe(false);
      expect(isHolo({})).toBe(false);
    });
  });

  describe('getVersionLabel', () => {
    it('labels TOTW cards as "TOTW (Holo)" or "TOTW (Standart)"', () => {
      expect(getVersionLabel(holoTotwRow)).toBe('TOTW (Holo)');
      expect(getVersionLabel(normalTotwRow)).toBe('TOTW (Standart)');
    });

    it('labels non-TOTW cards as "Standart" or "Özel (Holo)"', () => {
      expect(getVersionLabel(goldBaseRow)).toBe('Standart');
      expect(getVersionLabel({ raretype: '18', holographicAnimation: 'path.webp' })).toBe('Özel (Holo)');
    });
  });

  describe('filterCandidates', () => {
    it('filters strictly to playerid === intent.playerId and raretype === "3" for TOTW intents', () => {
      const intent = {
        name: 'Esmee Brugts',
        playerId: 267530,
        rarityIds: ['3']
      };

      const rows = [goldBaseRow, normalTotwRow, holoTotwRow, otherPlayerTotwRow];
      const candidates = filterCandidates(rows, intent);

      expect(candidates).toHaveLength(2);
      expect(candidates.map((c) => c.futbinId)).toEqual(['22770', '22771']);
      expect(candidates.map((c) => c.eaId)).toEqual([67376394, 50599178]);
      expect(candidates.map((c) => c.versionLabel)).toEqual(['TOTW (Standart)', 'TOTW (Holo)']);
      expect(candidates.map((c) => c.rating)).toEqual([85, 85]);
    });

    it('returns empty array when no candidates match', () => {
      const intent = {
        name: 'Non Existing',
        playerId: 999999,
        rarityIds: ['3']
      };
      expect(filterCandidates([goldBaseRow, normalTotwRow], intent)).toEqual([]);
    });
  });

  describe('scoreRow futbinId and specific version scoring', () => {
    it('awards higher score to exact futbinId match than preferStandard bonus', () => {
      const rows = [goldBaseRow, normalTotwRow];
      const scoreGold = scoreRow(goldBaseRow, {
        wantedName: 'esmee brugts',
        wantedFutbinId: '22770',
        preferStandard: true
      });
      const scoreTotw = scoreRow(normalTotwRow, {
        wantedName: 'esmee brugts',
        wantedFutbinId: '22770',
        preferStandard: true
      });

      expect(scoreTotw).toBeGreaterThan(scoreGold);
    });

    it('matches ONLY exact resource_id when selectedCardId is a special version ID', () => {
      const scoreNormal = scoreRow(normalTotwRow, {
        wantedName: 'esmee brugts',
        selectedCardId: 67376394
      });
      const scoreHolo = scoreRow(holoTotwRow, {
        wantedName: 'esmee brugts',
        selectedCardId: 67376394
      });

      expect(scoreNormal).toBeGreaterThan(0);
      expect(scoreHolo).toBe(0);
    });
  });
});
