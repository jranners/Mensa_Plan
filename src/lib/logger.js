/**
 * Lightweight conditional logger for KStW Mensaplan.
 * Suppresses debug/info/warn logs in production unless debug mode is enabled
 * via `?debug=1` URL query parameter or `localStorage.getItem('kstw_debug') === 'true'`.
 */

/**
 * Checks whether debug logging is enabled in the current environment.
 * @returns {boolean}
 */
export function isDebugEnabled() {
  try {
    if (typeof window !== 'undefined' && window.location?.search?.includes('debug=1')) {
      return true;
    }
    if (typeof localStorage !== 'undefined' && typeof localStorage?.getItem === 'function' && localStorage.getItem('kstw_debug') === 'true') {
      return true;
    }
  } catch {
    // Ignore storage or window access errors in restricted contexts
  }
  return false;
}

export const logger = {
  debug(...args) {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },
  info(...args) {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },
  warn(...args) {
    if (isDebugEnabled()) {
      console.warn(...args);
    }
  },
  error(...args) {
    if (typeof globalThis !== 'undefined' && globalThis.__KSTW_SILENCE_LOGGER__ === true && !isDebugEnabled()) {
      return;
    }
    console.error(...args);
  }
};
