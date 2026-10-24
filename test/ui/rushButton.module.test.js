import { describe, it, expect } from 'vitest';
import rushButtonModule, { shouldEnableRushButton, initRushButton, syncRushButton } from '../../src/ui/rushButton.module.js';
import { CONFIG } from '../../src/core/config.js';

describe('rushButtonModule registry contract', () => {
  it('has correct module structure and name', () => {
    expect(rushButtonModule.name).toBe('rushButton');
    expect(rushButtonModule.feature).toBe('rushButton');
    expect(typeof rushButtonModule.init).toBe('function');
    expect(typeof rushButtonModule.sync).toBe('function');
    expect(rushButtonModule.initOrder).toBe(4);
  });

  it('shouldEnableRushButton respects CONFIG.features.rushButton', () => {
    CONFIG.features.rushButton = true;
    expect(shouldEnableRushButton()).toBe(true);

    CONFIG.features.rushButton = false;
    expect(shouldEnableRushButton()).toBe(false);
    CONFIG.features.rushButton = true;
  });

  it('initRushButton and syncRushButton run safely without error', () => {
    expect(() => initRushButton()).not.toThrow();
    expect(() => syncRushButton()).not.toThrow();
  });
});
