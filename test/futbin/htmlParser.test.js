// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseFutbinPlayers } from '../../src/futbin/htmlParser.js';

describe('parseFutbinPlayers', () => {
  it('parses player rows and filters by rating and missing price', () => {
    const html = `
      <table><tbody>
        <tr class="player-row">
          <td class="table-name"><a href="/27/player/123/example">Player One</a></td>
          <td class="table-rating">90</td>
          <td class="platform-ps-only">1.234</td>
        </tr>
        <tr class="player-row">
          <td class="table-name"><a href="/27/player/456/example">Other Rating</a></td>
          <td class="table-rating">89</td>
          <td class="platform-ps-only">2.000</td>
        </tr>
        <tr class="player-row">
          <td class="table-name"><a href="/27/player/789/example">No Price</a></td>
          <td class="table-rating">90</td>
          <td class="platform-ps-only">N/A</td>
        </tr>
        <a href="?page=3">3</a>
      </tbody></table>`;

    const result = parseFutbinPlayers(html, 90);

    expect(Array.from(result)).toEqual([
      { name: 'Player One', rating: 90, price: 1234, futbinId: '123', eaId: null }
    ]);
    expect(result.pageRowCount).toBe(3);
    expect(result.lastPage).toBe(3);
  });

  it('returns an empty result for an empty result container', () => {
    const result = parseFutbinPlayers('<table><tbody></tbody></table>', 90);

    expect(result).toHaveLength(0);
    expect(result.pageRowCount).toBe(0);
  });

  it('marks a Cloudflare challenge as blocked', () => {
    expect(() => parseFutbinPlayers(
      '<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>',
      90
    )).toThrow(expect.objectContaining({ blocked: true }));
  });
});
