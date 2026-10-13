import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadRegistry() {
  vi.resetModules();
  return {
    registryModule: await import('../../src/core/registry.js'),
    configModule: await import('../../src/core/config.js')
  };
}

describe('module registry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips modules whose feature flag is false', async () => {
    const { registryModule, configModule } = await loadRegistry();
    const init = vi.fn();
    configModule.CONFIG.features.disabledFeature = false;

    registryModule.register({ name: 'disabled', feature: 'disabledFeature', init });
    registryModule.initAll();

    expect(init).not.toHaveBeenCalled();
  });

  it('continues initializing other modules after one init throws', async () => {
    const { registryModule } = await loadRegistry();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const nextInit = vi.fn();

    registryModule.register({ name: 'throws', init: () => { throw new Error('init failed'); } });
    registryModule.register({ name: 'continues', init: nextInit });
    registryModule.initAll();

    expect(nextInit).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });

  it('continues syncing other modules after one sync throws', async () => {
    const { registryModule } = await loadRegistry();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const nextSync = vi.fn();
    const context = { value: 1 };

    registryModule.register({ name: 'throws', sync: () => { throw new Error('sync failed'); } });
    registryModule.register({ name: 'continues', sync: nextSync });
    registryModule.syncAll(context);

    expect(nextSync).toHaveBeenCalledOnce();
    expect(nextSync).toHaveBeenCalledWith(context);
    expect(error).toHaveBeenCalledOnce();
  });

  it('syncs modules in registration order', async () => {
    const { registryModule } = await loadRegistry();
    const calls = [];

    registryModule.register({ name: 'first', sync: () => calls.push('first') });
    registryModule.register({ name: 'second', sync: () => calls.push('second') });
    registryModule.register({ name: 'third', sync: () => calls.push('third') });
    registryModule.syncAll({});

    expect(calls).toEqual(['first', 'second', 'third']);
  });
});
