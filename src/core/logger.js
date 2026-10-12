const levels = { debug: 10, info: 20, warn: 30, error: 40 };
let threshold = levels.info;

export function setLogLevel(level) {
  if (!Object.prototype.hasOwnProperty.call(levels, level)) throw new Error('Unknown log level: ' + level);
  threshold = levels[level];
}

export function log(level, ...args) {
  if (!Object.prototype.hasOwnProperty.call(levels, level)) throw new Error('Unknown log level: ' + level);
  if (levels[level] < threshold) return;
  const method = level === 'debug' ? 'debug' : level;
  console[method]('[FutRUSH]', ...args);
}

export const debug = (...args) => log('debug', ...args);
export const info = (...args) => log('info', ...args);
export const warn = (...args) => log('warn', ...args);
export const error = (...args) => log('error', ...args);
