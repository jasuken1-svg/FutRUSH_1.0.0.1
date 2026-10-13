// Moduller arasi isimli olaylari kaydeder, yayinlar ve abonelikten cikis saglar.
// Bagimlilik: yalnizca JavaScript Map/Set.

const listeners = new Map();

export function on(eventName, listener) {
  if (typeof listener !== 'function') throw new TypeError('Event listener must be a function.');
  const eventListeners = listeners.get(eventName) || new Set();
  eventListeners.add(listener);
  listeners.set(eventName, eventListeners);
  return () => off(eventName, listener);
}

export function off(eventName, listener) {
  const eventListeners = listeners.get(eventName);
  if (!eventListeners) return;
  eventListeners.delete(listener);
  if (!eventListeners.size) listeners.delete(eventName);
}

export function emit(eventName, ...args) {
  const eventListeners = listeners.get(eventName);
  if (!eventListeners) return;
  for (const listener of [...eventListeners]) listener(...args);
}
