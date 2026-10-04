/**
 * Storage Keys & Scoped Reset Management for Mensa Plan PWA
 */
import { validateWeekMenu } from './validation.js';

export const CURRENT_SCHEMA_VERSION = 2;
export const SCHEMA_VERSION_KEY = 'kstw_schema_version';

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
  'kstw_favorites',
  SCHEMA_VERSION_KEY
];

/**
 * Migrates localStorage schema and sanitizes corrupted entries.
 * Idempotent: running repeatedly on the current schema is a safe no-op.
 *
 * @param {Storage} [storage] - Storage object (defaults to window.localStorage)
 * @returns {number} The current schema version after migration
 */
export function migrateStorage(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return CURRENT_SCHEMA_VERSION;

  const rawVersion = storage.getItem(SCHEMA_VERSION_KEY);
  const currentVersion = rawVersion ? parseInt(rawVersion, 10) : 1;

  if (currentVersion < 2) {
    // Migration v1 -> v2:
    // 1. Sanitize preferences
    try {
      const canteensRaw = storage.getItem('kstw_canteens');
      if (canteensRaw !== null) {
        const parsed = JSON.parse(canteensRaw);
        if (!Array.isArray(parsed)) {
          storage.setItem('kstw_canteens', JSON.stringify(['unimensa']));
        }
      }
    } catch {
      storage.setItem('kstw_canteens', JSON.stringify(['unimensa']));
    }

    try {
      const allergiesRaw = storage.getItem('kstw_allergies');
      if (allergiesRaw !== null) {
        const parsed = JSON.parse(allergiesRaw);
        if (!Array.isArray(parsed)) {
          storage.setItem('kstw_allergies', JSON.stringify([]));
        }
      }
    } catch {
      storage.setItem('kstw_allergies', JSON.stringify([]));
    }

    const diet = storage.getItem('kstw_diet');
    if (diet !== null && !['vegan', 'vegetarian', 'all'].includes(diet)) {
      storage.setItem('kstw_diet', 'all');
    }

    const lang = storage.getItem('kstw_lang');
    if (lang !== null && !['de', 'en'].includes(lang)) {
      storage.setItem('kstw_lang', 'de');
    }

    // 2. Validate menu cache; purge if corrupted
    try {
      const cachedMenu = storage.getItem('kstw_menu_cache');
      if (cachedMenu !== null) {
        const parsed = JSON.parse(cachedMenu);
        const validation = validateWeekMenu(parsed);
        if (!validation.valid) {
          storage.removeItem('kstw_menu_cache');
          storage.removeItem('kstw_menu_cache_time');
        }
      }
    } catch {
      storage.removeItem('kstw_menu_cache');
      storage.removeItem('kstw_menu_cache_time');
    }

    // Mark as migrated to version 2
    storage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
  }

  return CURRENT_SCHEMA_VERSION;
}

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
