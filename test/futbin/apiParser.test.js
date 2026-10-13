import { describe, expect, it } from 'vitest';
import { parseFutbinApiPlayers } from '../../src/futbin/apiParser.js';

describe('parseFutbinApiPlayers', () => {
  it('parses valid players and reports the source row count', () => {
    const result = parseFutbinApiPlayers(JSON.stringify({
      data: [
        { playername: '  Player   One ', rating: '90', ps_LCPrice: '12500', ID: 456 },
        { common_name: 'Player Two', rating: 90, ps_LCPrice: 2000 }
      ]
    }), 90);

    expect(Array.from(result)).toEqual([
      { name: 'Player One', rating: 90, price: 12500, futbinId: '456' },
      { name: 'Player Two', rating: 90, price: 2000, futbinId: null }
    ]);
    expect(result.pageRowCount).toBe(2);
  });

  it('filters rows with another rating and rows with a zero price', () => {
    const result = parseFutbinApiPlayers(JSON.stringify({
      data: [
        { playername: 'Other Rating', rating: 89, ps_LCPrice: 100 },
        { playername: 'Free', rating: 90, ps_LCPrice: 0 },
        { playername: 'Kept', rating: 90, ps_LCPrice: 50 }
      ]
    }), 90);

    expect(Array.from(result)).toEqual([
      { name: 'Kept', rating: 90, price: 50, futbinId: null }
    ]);
    expect(result.pageRowCount).toBe(3);
  });

  it('throws for malformed JSON', () => {
    expect(() => parseFutbinApiPlayers('{not json', 90))
      .toThrow('FutBIN API yanıtı JSON olarak çözümlenemedi.');
  });

  it.each(['{}', 'null', '{"data":{}}'])('throws when data is missing or not an array: %s', (body) => {
    expect(() => parseFutbinApiPlayers(body, 90))
      .toThrow('FutBIN API oyuncu listesi bulunamadı (data alanı değişmiş olabilir).');
  });
});
