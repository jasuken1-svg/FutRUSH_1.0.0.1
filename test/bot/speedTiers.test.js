import { describe, expect, it } from 'vitest';
import {
  SPEED_TIERS,
  SPEED_LIMITS,
  clampTierSeconds,
  formatTierSeconds,
  getEffectiveSpeedDelayMs
} from '../../src/bot/speedTiers.js';

describe('speedTiers module', () => {
  it('defines 4 tiers with appropriate colors, names and default times', () => {
    expect(SPEED_TIERS).toHaveLength(4);
    expect(SPEED_TIERS[0]).toMatchObject({ id: 0, name: 'Güvenli', defaultSec: 5.0, color: '#22c55e', isWarning: false });
    expect(SPEED_TIERS[1]).toMatchObject({ id: 1, name: 'Dengeli', defaultSec: 4.0, color: '#a3e635', isWarning: false });
    expect(SPEED_TIERS[2]).toMatchObject({ id: 2, name: 'Hızlı', defaultSec: 2.5, color: '#f59e0b', isWarning: false });
    expect(SPEED_TIERS[3]).toMatchObject({ id: 3, name: 'Turbo', defaultSec: 1.5, color: '#ef4444', isWarning: true });
    expect(SPEED_TIERS[3].riskNote).toBe('Yüksek ban riski');
  });

  it('clamps seconds within [1.0, 10.0] with 1 decimal precision', () => {
    expect(clampTierSeconds(0.4)).toBe(1.0);
    expect(clampTierSeconds(15.2)).toBe(10.0);
    expect(clampTierSeconds(2.5000000000000004)).toBe(2.5);
    expect(clampTierSeconds(2.76)).toBe(2.8);
    expect(formatTierSeconds(2.5)).toBe('2.5');
    expect(formatTierSeconds(4)).toBe('4.0');
  });

  it('computes effective speed delay in ms dynamically based on active tier and customized delay', () => {
    const settings = {
      speed: 2,
      speedDelays: { 0: 5.0, 1: 4.0, 2: 3.1, 3: 1.5 }
    };
    expect(getEffectiveSpeedDelayMs(settings)).toBe(3100);

    // When speed changes live:
    settings.speed = 3;
    expect(getEffectiveSpeedDelayMs(settings)).toBe(1500);

    // Fallback when custom delays missing
    expect(getEffectiveSpeedDelayMs({ speed: 0 })).toBe(5000);
  });
});
