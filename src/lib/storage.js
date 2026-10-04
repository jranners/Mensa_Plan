/**
 * Storage Keys & Scoped Reset Management for Mensa Plan PWA
 */
import { validateWeekMenu } from './validation.js';

export const CURRENT_SCHEMA_VERSION = 2;
export const SCHEMA_VERSION_KEY = 'kstw_schema_version';
export const FAVORITES_V2_KEY = 'kstw_favorites_v2';
export const TARIFF_KEY = 'kstw_tariff';

export const PREFERENCE_KEYS = [
  'kstw_prefs_saved',
  'kstw_lang',
  'kstw_canteens',
  'kstw_diet',
  'kstw_allergies',
  'kstw_allergen_prompt_shown',
  'kstw_updated_successfully',
  TARIFF_KEY
];

export const CACHE_KEYS = [
  'kstw_menu_cache',
  'kstw_menu_cache_time',
  'kstw_announcements_cache'
];

export const PRESERVED_KEYS = [
  'kstw_theme',
  'kstw_favorites',
  FAVORITES_V2_KEY,
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

    const tariff = storage.getItem(TARIFF_KEY);
    if (tariff !== null && !['student', 'employee', 'guest', 'external'].includes(tariff)) {
      storage.setItem(TARIFF_KEY, 'student');
    }

    try {
      const favsRaw = storage.getItem(FAVORITES_V2_KEY);
      if (favsRaw !== null && !Array.isArray(JSON.parse(favsRaw))) {
        storage.setItem(FAVORITES_V2_KEY, JSON.stringify([]));
      }
    } catch {
      storage.setItem(FAVORITES_V2_KEY, JSON.stringify([]));
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
    allergies: Array.isArray(state.allergies) ? [...state.allergies] : [],
    tariff: state.tariff || 'student'
  };
}

/**
 * Retrieves the list of favorite dish names from storage.
 * @param {Storage} [storage]
 * @returns {string[]}
 */
export function getFavoritesV2(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(FAVORITES_V2_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Toggles a normalized dish name in favorites storage.
 * @param {string} cleanName
 * @param {Storage} [storage]
 * @returns {boolean} true if added, false if removed
 */
export function toggleFavoriteV2(cleanName, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage || !cleanName) return false;
  const favs = getFavoritesV2(storage);
  const idx = favs.indexOf(cleanName);
  let added = false;
  if (idx === -1) {
    favs.push(cleanName);
    added = true;
  } else {
    favs.splice(idx, 1);
    added = false;
  }
  try {
    storage.setItem(FAVORITES_V2_KEY, JSON.stringify(favs));
  } catch {
    // ignore
  }
  return added;
}

/**
 * Checks whether a normalized dish name is favorited.
 * @param {string} cleanName
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function isFavoriteV2(cleanName, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage || !cleanName) return false;
  return getFavoritesV2(storage).includes(cleanName);
}

/**
 * Retrieves selected pricing tariff ('student', 'employee', 'guest', 'external').
 * @param {Storage} [storage]
 * @returns {'student'|'employee'|'guest'|'external'}
 */
export function getTariff(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return 'student';
  const t = storage.getItem(TARIFF_KEY);
  return ['student', 'employee', 'guest', 'external'].includes(t) ? t : 'student';
}

/**
 * Persists selected pricing tariff.
 * @param {string} tariff
 * @param {Storage} [storage]
 */
export function setTariff(tariff, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return;
  const valid = ['student', 'employee', 'guest', 'external'].includes(tariff) ? tariff : 'student';
  try {
    storage.setItem(TARIFF_KEY, valid);
  } catch {
    // ignore
  }
}
