export const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
export const pageStorage = () => pageWindow.localStorage;
export const vw = () => document.documentElement.clientWidth;
export const vh = () => pageWindow.innerHeight;

export function visibleElement(element) {
  if (!element || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  try {
    const style = pageWindow.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  } catch (e) { return true; }
}
