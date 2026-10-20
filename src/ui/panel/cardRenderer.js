// EA FC Ultimate Team otantik kart bilesenini HTML ve CSS katmanlariyla olusturur.
// Bagimliliklar: futbin/imageLoader.

import { loadFutbinImage, applyFutbinBgImage } from '../../futbin/imageLoader.js';

export function createEaCardElement(item, { size = 'thumb' } = {}) {
  const card = document.createElement('div');
  const sizeClass = size === 'preview' ? 'fr-ea-card-preview fr-candidate-card-preview' : 'fr-ea-card-thumb fr-target-thumb-wrap';
  card.className = `fr-ea-card ${sizeClass}` + (item.isHolo ? ' fr-ea-card-holo' : '');

  // 1. Arka plan şablonu (Promo/Gold/TOTW vb.)
  if (item.promoImageUrl) {
    const bg = document.createElement('div');
    bg.className = size === 'preview' ? 'fr-ea-card-bg fr-candidate-card-bg' : 'fr-ea-card-bg fr-target-thumb-bg';
    applyFutbinBgImage(bg, item.promoImageUrl);
    card.appendChild(bg);
  }

  // 2. Holografik efekt katmanları
  if (item.isHolo) {
    const shimmer = document.createElement('div');
    shimmer.className = 'fr-card-holo-shimmer';
    card.appendChild(shimmer);

    if (item.holographicAnimationUrl) {
      const webp = document.createElement('img');
      webp.className = 'fr-card-holo-webp';
      loadFutbinImage(webp, item.holographicAnimationUrl);
      card.appendChild(webp);
    }
  }

  // 3. Sol Üst: Reyting ve Mevki
  const topLeft = document.createElement('div');
  topLeft.className = 'fr-ea-card-top-left';

  if (item.rating) {
    const rating = document.createElement('div');
    rating.className = size === 'preview' ? 'fr-ea-card-rating fr-candidate-card-rating' : 'fr-ea-card-rating';
    rating.textContent = String(item.rating);
    topLeft.appendChild(rating);
  }

  if (item.position) {
    const pos = document.createElement('div');
    pos.className = size === 'preview' ? 'fr-ea-card-pos fr-candidate-card-pos' : 'fr-ea-card-pos';
    pos.textContent = String(item.position).toUpperCase();
    topLeft.appendChild(pos);
  }
  card.appendChild(topLeft);

  // 4. Oyuncu Portresi
  if (item.playerImageUrl) {
    const playerImg = document.createElement('img');
    playerImg.className = size === 'preview' ? 'fr-ea-card-player-img fr-candidate-player-img' : 'fr-ea-card-player-img fr-target-thumb';
    playerImg.alt = item.name || '';
    loadFutbinImage(playerImg, item.playerImageUrl);
    card.appendChild(playerImg);
  }

  // 5. İsim Plakası (Orta)
  const namePlate = document.createElement('div');
  namePlate.className = 'fr-ea-card-name-plate';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'fr-ea-card-name';
  nameSpan.textContent = item.commonName || item.name || '';
  namePlate.appendChild(nameSpan);
  card.appendChild(namePlate);

  // 6. 6 Temel İstatistik (PAC, SHO, PAS, DRI, DEF, PHY) - EA Tek Satır 6 Sütun
  if (item.stats && (item.stats.pac > 0 || item.stats.dri > 0)) {
    const statsGrid = document.createElement('div');
    statsGrid.className = 'fr-ea-card-stats-grid';
    statsGrid.append(
      createStatRow(item.stats.pac, 'PAC'),
      createStatRow(item.stats.sho, 'SHO'),
      createStatRow(item.stats.pas, 'PAS'),
      createStatRow(item.stats.dri, 'DRI'),
      createStatRow(item.stats.def, 'DEF'),
      createStatRow(item.stats.phy, 'PHY')
    );
    card.appendChild(statsGrid);
  }

  // 7. En Alt: Ülke, Lig ve Kulüp Armaları
  const crests = document.createElement('div');
  crests.className = 'fr-ea-card-bottom-crests';

  if (item.nationImageUrl) {
    const nationImg = document.createElement('img');
    nationImg.className = 'fr-ea-crest fr-ea-crest-nation';
    nationImg.alt = 'Nation';
    loadFutbinImage(nationImg, item.nationImageUrl);
    crests.appendChild(nationImg);
  }

  if (item.leagueImageUrl) {
    const leagueImg = document.createElement('img');
    leagueImg.className = 'fr-ea-crest fr-ea-crest-league';
    leagueImg.alt = 'League';
    loadFutbinImage(leagueImg, item.leagueImageUrl);
    crests.appendChild(leagueImg);
  }

  if (item.clubImageUrl) {
    const clubImg = document.createElement('img');
    clubImg.className = 'fr-ea-crest fr-ea-crest-club';
    clubImg.alt = 'Club';
    loadFutbinImage(clubImg, item.clubImageUrl);
    crests.appendChild(clubImg);
  }

  if (crests.childElementCount > 0) {
    card.appendChild(crests);
  }

  return card;
}

function createStatRow(val, label) {
  const row = document.createElement('div');
  row.className = 'fr-ea-stat fr-ea-stat-item';
  const lblEl = document.createElement('span');
  lblEl.className = 'fr-ea-stat-lbl';
  lblEl.textContent = label;
  const valEl = document.createElement('span');
  valEl.className = 'fr-ea-stat-val';
  valEl.textContent = String(val || '0');
  row.append(lblEl, valEl);
  return row;
}
