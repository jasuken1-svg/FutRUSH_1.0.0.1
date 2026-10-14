import { describe, expect, it } from 'vitest';
import {
  formatWaitCountdown,
  logTone,
  normalizeTargetStatus,
  summarizeBotStats
} from '../../src/ui/panel/panelLogic.js';

describe('panel logic', () => {
  it.each([
    ['success', 'success'],
    ['info', 'info'],
    ['error', 'error'],
    ['missed', 'error'],
    ['warn', 'error'],
    ['unknown', 'info']
  ])('maps log type %s to tone %s', (type, tone) => {
    expect(logTone(type)).toBe(tone);
  });

  it('summarizes bought, missed, and search counts', () => {
    expect(summarizeBotStats({ bought: 4, missed: 2, searches: 9, errors: 1 })).toEqual({
      bought: 4,
      missed: 2,
      searches: 9
    });
  });

  it('formats decimal and whole-second countdowns in Turkish', () => {
    expect(formatWaitCountdown(3200)).toBe('3,2 sn');
    expect(formatWaitCountdown(12000)).toBe('12 sn');
  });

  it('normalizes legacy status objects without requiring optional fields', () => {
    expect(normalizeTargetStatus({ type: 'success', message: 'Tamamlandı' })).toEqual({
      type: 'success',
      message: 'Tamamlandı'
    });
    expect(normalizeTargetStatus({
      type: 'loading',
      message: 'Yükleniyor',
      source: 'mixed',
      progress: { done: '2', total: 4 }
    })).toEqual({
      type: 'loading',
      message: 'Yükleniyor',
      source: 'mixed',
      progress: { done: 2, total: 4 }
    });
  });
});
