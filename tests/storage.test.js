import { describe, it, expect } from 'vitest';
import {
  resetAppStorage,
  createSettingsDraft,
  migrateStorage,
  compactMenuPayload,
  FAVORITES_V2_KEY,
  STATS_KEY,
  PREFERENCE_KEYS,
  CACHE_KEYS
} from '../src/lib/storage.js';
import { validateWeekMenu } from '../src/lib/validation.js';

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
      lang: 'de',
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

  it('migrates or removes legacy kstw_favorites and deletes kstw_stats_v1 in migrateStorage', () => {
    const storage1 = new MockStorage();
    storage1.setItem('kstw_favorites', JSON.stringify(['pasta bolognese', 'linseneintopf']));
    storage1.setItem(STATS_KEY, JSON.stringify({ days: 10 }));

    migrateStorage(storage1);

    expect(storage1.getItem('kstw_favorites')).toBeNull();
    expect(storage1.getItem(FAVORITES_V2_KEY)).toBe(JSON.stringify(['pasta bolognese', 'linseneintopf']));
    expect(storage1.getItem(STATS_KEY)).toBeNull();

    // When kstw_favorites_v2 already exists, legacy kstw_favorites is removed without overwriting v2
    const storage2 = new MockStorage();
    storage2.setItem('kstw_favorites', JSON.stringify(['old_dish']));
    storage2.setItem(FAVORITES_V2_KEY, JSON.stringify(['new_dish']));
    storage2.setItem(STATS_KEY, '{"obsolete":true}');

    migrateStorage(storage2);

    expect(storage2.getItem('kstw_favorites')).toBeNull();
    expect(storage2.getItem(FAVORITES_V2_KEY)).toBe(JSON.stringify(['new_dish']));
    expect(storage2.getItem(STATS_KEY)).toBeNull();
  });

  it('compacts menu payload by stripping empty custom_fields, EDIT_INFO, and dispo_id while remaining valid', () => {
    const rawPayload = [
      {
        date: '2026-10-05',
        dishes: [
          {
            id: 'dish-1',
            name_de: 'Blumenkohl-Kichererbsencurry',
            price: 1.5,
            screens: [{ id: 's1', location: 'Mensa Zollstock' }],
            category: { id: 'c1', name_de: 'Hauptgericht' },
            custom_fields: [
              { field_id: 'dispo_id', value: '413792' },
              { field_id: 'ort_id', value: '201' },
              { field_id: 'location', value: 'Mensa Zülpicher Straße' },
              { field_id: 'food_icon', value: 'VGN' },
              { field_id: 'dish_ger_2', value: '' },
              { field_id: 'dish_ger_3', value: '' },
              { field_id: 'EDIT_INFO', value: 'internal' },
              { field_id: 'price_2', value: '2,55' }
            ]
          }
        ]
      }
    ];

    const compacted = compactMenuPayload(rawPayload);

    expect(validateWeekMenu(compacted, { requireNonEmptyDays: true }).valid).toBe(true);
    const fields = compacted[0].dishes[0].custom_fields;
    expect(fields.map(f => f.field_id)).toEqual(['ort_id', 'location', 'food_icon', 'price_2']);

    // Ensure deep clone (mutating compacted does not mutate input)
    fields[0].value = '999';
    expect(rawPayload[0].dishes[0].custom_fields[1].value).toBe('201');
  });
});
