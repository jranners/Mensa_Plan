import { describe, it, expect } from 'vitest';
import {
  resetAppStorage,
  createSettingsDraft,
  PREFERENCE_KEYS,
  CACHE_KEYS,
  PRESERVED_KEYS
} from '../src/lib/storage.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Storage Module & Scoped App Reset', () => {
  it('resets preference and cache keys without wiping preserved or foreign keys', () => {
    const storage = new MockStorage();

    // Populate preferences and caches
    storage.setItem('kstw_prefs_saved', 'true');
    storage.setItem('kstw_lang', 'de');
    storage.setItem('kstw_canteens', '["unimensa"]');
    storage.setItem('kstw_diet', 'vegan');
    storage.setItem('kstw_allergies', '["gluten"]');
    storage.setItem('kstw_allergen_prompt_shown', 'true');
    storage.setItem('kstw_updated_successfully', 'true');
    storage.setItem('kstw_menu_cache', '{"days":[]}');
    storage.setItem('kstw_menu_cache_time', '1760000000');
    storage.setItem('kstw_announcements_cache', '[]');

    // Populate preserved keys
    storage.setItem('kstw_theme', 'dark');
    storage.setItem('kstw_favorites', '["dish_123"]');

    // Populate foreign domain keys
    storage.setItem('unrelated_app_setting', 'keep_me');

    const removedKeys = resetAppStorage(storage);

    expect(removedKeys).toContain('kstw_prefs_saved');
    expect(removedKeys).toContain('kstw_menu_cache');
    expect(removedKeys).toContain('kstw_canteens');

    // Verify preferences and caches are gone
    for (const key of [...PREFERENCE_KEYS, ...CACHE_KEYS]) {
      expect(storage.getItem(key)).toBeNull();
    }

    // Verify preserved keys STILL EXIST
    expect(storage.getItem('kstw_theme')).toBe('dark');
    expect(storage.getItem('kstw_favorites')).toBe('["dish_123"]');

    // Verify foreign keys STILL EXIST
    expect(storage.getItem('unrelated_app_setting')).toBe('keep_me');
  });

  it('safely handles empty or missing storage', () => {
    expect(() => resetAppStorage(null)).not.toThrow();
    const emptyStorage = new MockStorage();
    const removed = resetAppStorage(emptyStorage);
    expect(removed).toEqual([]);
  });

  it('creates an isolated deep copy draft from state', () => {
    const state = {
      language: 'de',
      selectedCanteens: ['unimensa', 'bistro_uni'],
      diet: 'vegetarian',
      allergies: ['11', '13'],
      tariff: 'employee'
    };

    const draft = createSettingsDraft(state);

    expect(draft).toEqual({
      language: 'de',
      selectedCanteens: ['unimensa', 'bistro_uni'],
      diet: 'vegetarian',
      allergies: ['11', '13'],
      tariff: 'employee'
    });

    // Mutating draft should not affect state
    draft.selectedCanteens.push('deutz');
    draft.allergies.push('14');
    draft.diet = 'vegan';
    draft.language = 'en';
    draft.tariff = 'guest';

    expect(state.selectedCanteens).toEqual(['unimensa', 'bistro_uni']);
    expect(state.allergies).toEqual(['11', '13']);
    expect(state.diet).toBe('vegetarian');
    expect(state.language).toBe('de');
    expect(state.tariff).toBe('employee');
  });
});
