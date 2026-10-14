// Iptal edilebilir bekleme: createCancelToken, sleep(ms, token), actionGap(token, [min, max]).
// Bagimlilik yok (saf yardimcilar).

export const createCancelToken = () => {
  const listeners = new Set();
  const token = {
    cancelled: false,
    cancel() {
      if (token.cancelled) return;
      token.cancelled = true;
      Array.from(listeners).forEach((fn) => {
        try { fn(); } catch (e) {}
      });
      listeners.clear();
    },
    on(fn) {
      if (token.cancelled) {
        try { fn(); } catch (e) {}
        return;
      }
      listeners.add(fn);
    },
    off(fn) {
      listeners.delete(fn);
    }
  };
  return token;
};

export const randomBetween = (min, max, rnd = Math.random) => min + rnd() * Math.max(0, max - min);

// ms sonra true; token iptal edilirse hemen false doner.
export const sleep = (ms, token = null) =>
  new Promise((resolve) => {
    if (token && token.cancelled) {
      resolve(false);
      return;
    }
    let timer = null;
    const onCancel = () => {
      clearTimeout(timer);
      resolve(false);
    };
    timer = setTimeout(() => {
      if (token) token.off(onCancel);
      resolve(true);
    }, Math.max(0, ms));
    if (token) token.on(onCancel);
  });

// Eylemler arasi rastgele bekleme. range = [min, max] ms. max <= 0 ise beklemez.
export const actionGap = (token, range = [1500, 2500], rnd = Math.random) => {
  const [min, max] = range;
  if (!(max > 0)) return Promise.resolve(true);
  return sleep(randomBetween(min, max, rnd), token);
};
