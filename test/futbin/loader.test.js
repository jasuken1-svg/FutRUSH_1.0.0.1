// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../../src/core/config.js';

vi.mock('../../src/futbin/http.js', () => ({
  requestFutbinApi: vi.fn(),
  requestFutbinPage: vi.fn()
}));

const { requestFutbinApi, requestFutbinPage } = await import('../../src/futbin/http.js');
const { fetchCheapestPlayers } = await import('../../src/futbin/loader.js');

const apiResponse = {
  status: 200,
  responseText: JSON.stringify({
    data: [{ playername: 'Player One', rating: 90, ps_LCPrice: 1000, ID: 123 }]
  })
};

const pageResponse = {
  status: 200,
  responseText: `<table><tbody>
    <tr class="player-row">
      <td class="table-name"><a href="/27/player/123/player-one">Player One</a></td>
      <td class="table-rating">90</td>
      <td class="platform-ps-only">1.000</td>
    </tr>
  </tbody></table>`
};

afterEach(() => {
  CONFIG.futbin.preferApi = true;
  vi.resetAllMocks();
});

describe('fetchCheapestPlayers', () => {
  it('uses only the API when API preference is enabled and the API succeeds', async () => {
    requestFutbinApi.mockResolvedValue(apiResponse);

    const result = await fetchCheapestPlayers(90, 1);

    expect(result).toMatchObject({ source: 'api', fallback: false });
    expect(result.players).toHaveLength(1);
    expect(requestFutbinApi).toHaveBeenCalledTimes(1);
    expect(requestFutbinPage).not.toHaveBeenCalled();
  });

  it('falls back to the page when the preferred API is blocked', async () => {
    requestFutbinApi.mockResolvedValue({ status: 403, responseText: '' });
    requestFutbinPage.mockResolvedValue(pageResponse);

    const result = await fetchCheapestPlayers(90, 1);

    expect(result).toMatchObject({ source: 'html', fallback: true });
    expect(result.players).toHaveLength(1);
    expect(requestFutbinApi).toHaveBeenCalledTimes(1);
    expect(requestFutbinPage).toHaveBeenCalledTimes(1);
  });

  it('marks the error blocked when both preferred API and page are blocked', async () => {
    requestFutbinApi.mockResolvedValue({ status: 403, responseText: '' });
    requestFutbinPage.mockResolvedValue({ status: 403, responseText: '' });

    await expect(fetchCheapestPlayers(90, 1)).rejects.toMatchObject({ blocked: true });
  });

  it('keeps page-first order and falls back to the API when API preference is disabled', async () => {
    CONFIG.futbin.preferApi = false;
    requestFutbinPage.mockResolvedValue({ status: 403, responseText: '' });
    requestFutbinApi.mockResolvedValue(apiResponse);

    const result = await fetchCheapestPlayers(90, 1);

    expect(result).toMatchObject({ source: 'api', fallback: true });
    expect(requestFutbinPage).toHaveBeenCalledTimes(1);
    expect(requestFutbinApi).toHaveBeenCalledTimes(1);
  });
});
