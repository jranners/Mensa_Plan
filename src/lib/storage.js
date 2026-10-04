/**
 * Storage Keys & Scoped Reset Management for Mensa Plan PWA
 */

export const PREFERENCE_KEYS = [
  'kstw_prefs_saved',
  'kstw_lang',
  'kstw_canteens',
  'kstw_diet',
  'kstw_allergies',
  'kstw_allergen_prompt_shown',
  'kstw_updated_successfully'
];

export const CACHE_KEYS = [
  'kstw_menu_cache',
  'kstw_menu_cache_time',
  'kstw_announcements_cache'
];

export const PRESERVED_KEYS = [
  'kstw_theme',
  'kstw_favorites'
];

/**
 * Resets application preferences and cached menus while preserving
 * user theme and favorite dishes.
 *
 * @param {Storage} [storage] - Storage object (defaults to window.localStorage)
 * @returns {string[]} List of keys that were removed
 */
export function resetAppStorage(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return [];
  const keysToRemove = [...PREFERENCE_KEYS, ...CACHE_KEYS];
  const removed = [];
  for (const key of keysToRemove) {
    try {
      if (storage.getItem(key) !== null) {
        storage.removeItem(key);
        removed.push(key);
      }
    } catch {
      // ignore storage access errors
    }
  }
  return removed;
}

/**
 * Creates an isolated settings draft object from current application state.
 *
 * @param {object} state
 * @returns {object}
 */
export function createSettingsDraft(state) {
  return {
    language: state.language || 'de',
    selectedCanteens: Array.isArray(state.selectedCanteens) ? [...state.selectedCanteens] : ['unimensa'],
    diet: state.diet || 'all',
    allergies: Array.isArray(state.allergies) ? [...state.allergies] : []
  };
}
