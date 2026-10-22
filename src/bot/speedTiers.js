// Snipe botu arama hızı kademeleri ve süre yapılandırması.

export const SPEED_TIERS = [
  { id: 0, key: 'safe', name: 'Güvenli', defaultSec: 5.0, color: '#22c55e', riskNote: null, isWarning: false },
  { id: 1, key: 'balanced', name: 'Dengeli', defaultSec: 4.0, color: '#a3e635', riskNote: null, isWarning: false },
  { id: 2, key: 'fast', name: 'Hızlı', defaultSec: 2.5, color: '#f59e0b', riskNote: null, isWarning: false },
  { id: 3, key: 'turbo', name: 'Turbo', defaultSec: 1.5, color: '#ef4444', riskNote: 'Yüksek ban riski', isWarning: true }
];

export const SPEED_LIMITS = {
  MIN_SEC: 1.0,
  MAX_SEC: 10.0,
  STEP_SEC: 0.2
};

export function clampTierSeconds(val) {
  const num = Math.round(Number(val) * 10) / 10;
  if (isNaN(num)) return SPEED_LIMITS.MIN_SEC;
  return Math.min(SPEED_LIMITS.MAX_SEC, Math.max(SPEED_LIMITS.MIN_SEC, num));
}

export function formatTierSeconds(sec) {
  return (Math.round(Number(sec) * 10) / 10).toFixed(1);
}

export function getEffectiveSpeedDelayMs(snipeSettings) {
  const activeSpeed = Number.isInteger(snipeSettings?.speed) && snipeSettings.speed >= 0 && snipeSettings.speed <= 3
    ? snipeSettings.speed
    : 1;
  const customDelays = snipeSettings?.speedDelays;
  const tier = SPEED_TIERS[activeSpeed] || SPEED_TIERS[1];
  const sec = typeof customDelays?.[activeSpeed] === 'number'
    ? clampTierSeconds(customDelays[activeSpeed])
    : tier.defaultSec;
  return Math.round(sec * 1000);
}
