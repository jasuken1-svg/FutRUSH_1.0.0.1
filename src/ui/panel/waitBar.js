import { on } from '../../core/events.js';
import { state } from '../../core/state.js';
import { formatWaitCountdown } from './panelLogic.js';

let activeUnmount = null;

export function unmountWaitBar() {
  if (!activeUnmount) return;
  const unmount = activeUnmount;
  unmount();
}

export function mountWaitBar(container) {
  unmountWaitBar();
  container.innerHTML =
    '<div class="fr-waitbar-label" aria-live="off"></div>' +
    '<div class="fr-waitbar-track" aria-hidden="true"><div class="fr-waitbar-fill"></div></div>';
  const label = container.querySelector('.fr-waitbar-label');
  const fill = container.querySelector('.fr-waitbar-fill');
  let intervalId = null;

  const clearTicker = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const remainingTime = () => {
    const wait = state.botWait;
    return wait ? Math.max(0, Number(wait.duration) - (Date.now() - Number(wait.start))) : 0;
  };

  const update = (restartAnimation = false) => {
    const wait = state.botWait;
    if (!wait || !state.botRunning || Number(wait.duration) <= 0 || document.visibilityState === 'hidden') {
      container.hidden = true;
      clearTicker();
      return;
    }
    container.hidden = false;
    label.textContent = (wait.kind === 'search' ? 'Sonraki arama · ' : 'Sonraki tur · ') + formatWaitCountdown(remainingTime());
    if (restartAnimation) {
      fill.style.animation = 'none';
      fill.getBoundingClientRect();
      fill.style.animation = '';
      fill.style.setProperty('--fr-wait-duration', Number(wait.duration) + 'ms');
      fill.style.setProperty('--fr-wait-delay', -Math.max(0, Date.now() - Number(wait.start)) + 'ms');
    }
    if (intervalId === null) intervalId = setInterval(() => update(), 100);
  };

  const stopWaitSubscription = on('bot:wait', () => update(true));
  const stopStatusSubscription = on('bot:status', () => update());
  const onVisibilityChange = () => update(true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  update(true);

  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    if (activeUnmount === unmount) activeUnmount = null;
    clearTicker();
    stopWaitSubscription();
    stopStatusSubscription();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    container.hidden = true;
  };
  activeUnmount = unmount;
  return unmount;
}
