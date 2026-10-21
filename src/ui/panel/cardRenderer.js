// EA FC Ultimate Team otantik kart bilesenini HTML ve CSS katmanlariyla olusturur.
// Bagimliliklar: futbin/imageLoader ve core/config.

import { loadFutbinImage, applyFutbinBgImage } from '../../futbin/imageLoader.js';
import { CONFIG } from '../../core/config.js';

const PARTICLES = new Set(['de', 'da', 'do', 'dos', 'das', 'del', 'della', 'di', 'van', 'von', 'der', 'den', 'ten', 'ter', 'le', 'la', 'el', 'al', 'bin', 'ben', 'mac', 'st']);
const SUFFIXES = new Set(['jr', 'jr.', 'junior', 'júnior', 'filho', 'neto', 'sr', 'sr.']);

export function surnameOf(full) {
  const parts = String(full || '').trim().split(/\s+/);
  if (parts.length < 2) return full;
  if (SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
    return parts.slice(-2).join(' ');
  }
  let i = parts.length - 1;
  while (i > 1 && PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return parts.slice(i).join(' ');
}

export function fitCardName(nameSpan, { nameAuto = true, nameMinScale = 70 } = {}) {
  if (!nameSpan) return;
  if (typeof nameSpan.clientWidth === 'number' && typeof nameSpan.scrollWidth === 'number' && nameSpan.clientWidth === 0 && nameSpan.scrollWidth === 0) {
    return; // gizli sekme veya test ortamı
  }
  const full = nameSpan.title || nameSpan.dataset.fullName || nameSpan.textContent || '';
  nameSpan.dataset.fullName = full;
  nameSpan.textContent = full;
  nameSpan.style.removeProperty('font-size');

  if (nameAuto) {
    const isOverflowing = () => nameSpan.scrollWidth > nameSpan.clientWidth + 1;
    if (isOverflowing()) {
      nameSpan.textContent = surnameOf(full);
      if (isOverflowing()) {
        const baseSizeCqw = 8.5;
        for (let s = 95; s >= nameMinScale; s -= 5) {
          nameSpan.style.setProperty('font-size', (baseSizeCqw * s / 100).toFixed(2) + 'cqw');
          if (!isOverflowing()) break;
        }
      }
    }
  }
}

// Font geç yüklenirse isimleri yeniden boyutlandır
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    document.querySelectorAll('.fr-ea-card-name').forEach((span) => {
      fitCardName(span, {
        nameAuto: CONFIG.nameAuto !== false,
        nameMinScale: typeof CONFIG.nameMinScale === 'number' ? CONFIG.nameMinScale : 70
      });
    });
  }).catch(() => {});
}

export function isDarkCard(item) {
  if (!item) return false;
  const raretype = Number(item.raretype ?? 0);
  if (raretype <= 1) return false;
  const promo = String(item.promoImageUrl || '').toLowerCase();
  if (promo.includes('gold') || promo.includes('silver') || promo.includes('bronze')) {
    return false;
  }
  return true;
}

export function createEaCardElement(item, { size = 'preview' } = {}) {
  const card = document.createElement('div');
  const sizeClass = size === 'thumb' ? 'fr-ea-card-thumb' : 'fr-ea-card-preview';
  const holoClass = item.isHolo ? ' fr-ea-card-holo' : '';
  const skeletonClass = item.isSkeleton ? ' is-skeleton' : '';
  const darkClass = isDarkCard(item) ? ' is-dark-card' : '';
  card.className = `fr-ea-card ${sizeClass}${holoClass}${skeletonClass}${darkClass} fr-target-thumb-wrap`;

  const showImages = CONFIG.showCardImages !== false;

  // 1. Arka plan şablonu (Promo/Gold/TOTW vb.)
  if (showImages && item.promoImageUrl) {
    const bg = document.createElement('div');
    bg.className = 'fr-ea-card-bg fr-target-thumb-bg';
    applyFutbinBgImage(bg, item.promoImageUrl);
    card.appendChild(bg);
  }

  // 2. Holografik efekt katmanları
  if (showImages && item.isHolo) {
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
    rating.className = 'fr-ea-card-rating';
    rating.textContent = String(item.rating);
    topLeft.appendChild(rating);
  }

  if (item.position) {
    const pos = document.createElement('div');
    pos.className = 'fr-ea-card-pos';
    pos.textContent = String(item.position).toUpperCase();
    topLeft.appendChild(pos);
  }
  card.appendChild(topLeft);

  // 3.5 Sol Taraf: PlayStyle+ Simgeleri (B4: en fazla 4, altın daire + "+" rozeti)
  if (showImages && Array.isArray(item.playstylesPlus) && item.playstylesPlus.length > 0) {
    const psWrap = document.createElement('div');
    psWrap.className = 'fr-ea-card-playstyles';
    item.playstylesPlus.slice(0, 4).forEach((ps) => {
      const psEl = document.createElement('div');
      psEl.className = 'fr-ea-ps';
      const psName = typeof ps === 'string' ? ps : (ps.name || '');
      psEl.title = psName ? `${psName}+` : 'PlayStyle+';
      const iconUrl = typeof ps === 'object' ? (ps.iconUrl || ps.icon || '') : '';
      if (iconUrl) {
        const iconImg = document.createElement('img');
        iconImg.alt = psName;
        loadFutbinImage(iconImg, iconUrl);
        psEl.appendChild(iconImg);
      } else {
        psEl.textContent = (psName.slice(0, 2) || 'PS').toUpperCase();
      }
      psWrap.appendChild(psEl);
    });
    card.appendChild(psWrap);
  }

  // 4. Oyuncu Portresi
  if (showImages && item.playerImageUrl) {
    const playerImg = document.createElement('img');
    playerImg.className = 'fr-ea-card-player-img fr-target-thumb';
    playerImg.alt = item.name || '';
    loadFutbinImage(playerImg, item.playerImageUrl, item.playerImageFallbackUrl || '');
    card.appendChild(playerImg);
  }

  // 5. İsim Plakası (Orta)
  const namePlate = document.createElement('div');
  namePlate.className = 'fr-ea-card-name-plate';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'fr-ea-card-name';
  const fullName = item.displayName || item.commonName || item.name || '';
  nameSpan.textContent = fullName;
  nameSpan.title = item.name || fullName;
  namePlate.title = item.name || fullName;
  namePlate.appendChild(nameSpan);
  card.appendChild(namePlate);

  // İsim sığmazsa soyada kısaltma ve küçültme (B1)
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      fitCardName(nameSpan, {
        nameAuto: CONFIG.nameAuto !== false,
        nameMinScale: typeof CONFIG.nameMinScale === 'number' ? CONFIG.nameMinScale : 70
      });
    });
  }

  // 6. 6 Temel İstatistik (Outfield: PAC/SHO/PAS/DRI/DEF/PHY, GK: DIV/HAN/KIC/REF/SPE/POS)
  if (item.stats && (item.stats.pac > 0 || item.stats.dri > 0 || item.stats.div > 0)) {
    const isGk = String(item.position || '').toUpperCase() === 'GK' || String(item.position || '').toUpperCase() === 'KL';
    const labels = item.stats.labels || (isGk
      ? ['DIV', 'HAN', 'KIC', 'REF', 'SPE', 'POS']
      : ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']);

    const s1 = item.stats.pac ?? 0;
    const s2 = item.stats.sho ?? 0;
    const s3 = item.stats.pas ?? 0;
    const s4 = item.stats.dri ?? 0;
    const s5 = item.stats.def ?? 0;
    const s6 = item.stats.phy ?? 0;

    const statsGrid = document.createElement('div');
    statsGrid.className = 'fr-ea-card-stats-grid';
    statsGrid.append(
      createStatRow(s1, labels[0] || 'PAC'),
      createStatRow(s2, labels[1] || 'SHO'),
      createStatRow(s3, labels[2] || 'PAS'),
      createStatRow(s4, labels[3] || 'DRI'),
      createStatRow(s5, labels[4] || 'DEF'),
      createStatRow(s6, labels[5] || 'PHY')
    );
    card.appendChild(statsGrid);
  }

  // 7. En Alt: Ülke, Lig ve Kulüp Armaları
  if (showImages && (item.nationImageUrl || item.leagueImageUrl || item.clubImageUrl || (item.leagueImageFallbacks && item.leagueImageFallbacks.length > 0))) {
    const crests = document.createElement('div');
    crests.className = 'fr-ea-card-bottom-crests';

    if (item.nationImageUrl) {
      const nationImg = document.createElement('img');
      nationImg.className = 'fr-ea-crest fr-ea-crest-nation';
      nationImg.alt = 'Nation';
      loadFutbinImage(nationImg, item.nationImageUrl);
      crests.appendChild(nationImg);
    }

    if (item.leagueImageUrl || (item.leagueImageFallbacks && item.leagueImageFallbacks.length > 0)) {
      const leagueImg = document.createElement('img');
      leagueImg.className = 'fr-ea-crest fr-ea-crest-league';
      leagueImg.alt = item.leagueName || 'League';
      if (item.leagueName) {
        leagueImg.title = item.leagueName;
      }
      loadFutbinImage(leagueImg, item.leagueImageUrl, item.leagueImageFallbacks || []);
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
