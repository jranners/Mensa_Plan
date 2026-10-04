import { getBerlinTodayDate } from './dates.js';

export const DEFAULT_THROTTLE_MS = 30 * 1000; // 30 seconds
export const MAX_CACHE_AGE_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Evaluates whether the app needs to refresh its active date, UI, or menu data
 * when returning from the background (visibilitychange, pageshow).
 *
 * @param {number|null} lastFetchTime - Timestamp (ms) when data was last fetched/cached
 * @param {number} [now=Date.now()] - Current timestamp (ms)
 * @param {string|null} [lastRenderedDay=null] - ISO date string (YYYY-MM-DD) of the last rendered day
 * @param {number} [lastCheckTime=0] - Timestamp (ms) of the last lifecycle check
 * @param {object} [options={}] - Optional configuration
 * @param {number} [options.minIntervalMs=30000] - Minimum throttle interval between checks (default 30s)
 * @param {number} [options.maxCacheAgeMs=3600000] - Max cache age before background update (default 60m)
 * @param {string} [options.currentBerlinDay] - Override for current Berlin date string (useful for testing)
 * @returns {object} Decision object:
 *   - action: 'none' | 'day_changed' | 'cache_expired' | 'status_update'
 *   - throttled: boolean
 *   - dayChanged: boolean
 *   - shouldUpdateActiveDate: boolean
 *   - shouldFetchBackground: boolean
 *   - shouldRerender: boolean
 *   - currentBerlinDay: string
 */
export function needsRefresh(
  lastFetchTime,
  now = Date.now(),
  lastRenderedDay = null,
  lastCheckTime = 0,
  options = {}
) {
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_THROTTLE_MS;
  const maxCacheAgeMs = options.maxCacheAgeMs ?? MAX_CACHE_AGE_MS;
  const currentBerlinDay = options.currentBerlinDay || getBerlinTodayDate(new Date(now));

  const dayChanged = Boolean(lastRenderedDay && currentBerlinDay && lastRenderedDay !== currentBerlinDay);
  const timeSinceLastCheck = now - (lastCheckTime || 0);

  // If throttled (< minIntervalMs since last check) AND the calendar day did not change:
  if (lastCheckTime > 0 && timeSinceLastCheck < minIntervalMs && !dayChanged) {
    return {
      action: 'none',
      throttled: true,
      dayChanged: false,
      shouldUpdateActiveDate: false,
      shouldFetchBackground: false,
      shouldRerender: false,
      currentBerlinDay
    };
  }

  // 1. Calendar day changed (e.g. overnight or after several days)
  if (dayChanged) {
    return {
      action: 'day_changed',
      throttled: false,
      dayChanged: true,
      shouldUpdateActiveDate: true,
      shouldFetchBackground: true,
      shouldRerender: true,
      currentBerlinDay
    };
  }

  // 2. Cache is expired (older than 60 minutes or never fetched)
  const cacheAge = now - (lastFetchTime || 0);
  const cacheExpired = !lastFetchTime || cacheAge > maxCacheAgeMs;

  if (cacheExpired) {
    return {
      action: 'cache_expired',
      throttled: false,
      dayChanged: false,
      shouldUpdateActiveDate: false,
      shouldFetchBackground: true,
      shouldRerender: true,
      currentBerlinDay
    };
  }

  // 3. Same day, cache fresh, but resumed after interval: re-render to update open/closed status badges
  return {
    action: 'status_update',
    throttled: false,
    dayChanged: false,
    shouldUpdateActiveDate: false,
    shouldFetchBackground: false,
    shouldRerender: true,
    currentBerlinDay
  };
}
