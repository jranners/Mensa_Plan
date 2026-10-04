import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validateWeekMenu, validateAnnouncements } from '../src/lib/validation.js';
import { migrateStorage, CURRENT_SCHEMA_VERSION, SCHEMA_VERSION_KEY } from '../src/lib/storage.js';

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

describe('Schema Validation (validateWeekMenu)', () => {
  it('validates the real Supabase RPC sample response successfully', () => {
    const samplePath = path.resolve(__dirname, '../docs/rpc-sample.json');
    const sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

    const result = validateWeekMenu(sampleData);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects non-array responses (error JSON, objects, primitives)', () => {
    expect(validateWeekMenu(null).valid).toBe(false);
    expect(validateWeekMenu({ code: 'PGRST116', message: 'Not found' }).valid).toBe(false);
    expect(validateWeekMenu('<html>error</html>').valid).toBe(false);
    expect(validateWeekMenu(42).valid).toBe(false);
  });

  it('rejects days with invalid or missing date format', () => {
    const badDate1 = [{ date: '2026/10/05', dishes: [] }];
    expect(validateWeekMenu(badDate1).valid).toBe(false);

    const badDate2 = [{ date: 'today', dishes: [] }];
    expect(validateWeekMenu(badDate2).valid).toBe(false);

    const missingDate = [{ dishes: [] }];
    expect(validateWeekMenu(missingDate).valid).toBe(false);
  });

  it('rejects days where dishes is not an array', () => {
    const badDishes = [{ date: '2026-10-05', dishes: 'none' }];
    expect(validateWeekMenu(badDishes).valid).toBe(false);
  });

  it('rejects dishes with missing id or name_de', () => {
    const missingId = [
      {
        date: '2026-10-05',
        dishes: [{ name_de: 'Pasta' }]
      }
    ];
    expect(validateWeekMenu(missingId).valid).toBe(false);

    const missingName = [
      {
        date: '2026-10-05',
        dishes: [{ id: '123' }]
      }
    ];
    expect(validateWeekMenu(missingName).valid).toBe(false);
  });

  it('rejects dishes where custom_fields is not an array', () => {
    const badCustomFields = [
      {
        date: '2026-10-05',
        dishes: [{ id: '123', name_de: 'Pasta', custom_fields: 'invalid' }]
      }
    ];
    expect(validateWeekMenu(badCustomFields).valid).toBe(false);
  });

  it('validates announcements array', () => {
    expect(validateAnnouncements([]).valid).toBe(true);
    expect(validateAnnouncements([{ title: 'Info' }]).valid).toBe(true);
    expect(validateAnnouncements(null).valid).toBe(false);
    expect(validateAnnouncements('text').valid).toBe(false);
  });
});

describe('Storage Migration & Schema Versioning (migrateStorage)', () => {
  it('migrates an unversioned storage to version 2 and sets schema version key', () => {
    const storage = new MockStorage();
    storage.setItem('kstw_diet', 'carnivore_invalid');
    storage.setItem('kstw_lang', 'fr_invalid');
    storage.setItem('kstw_canteens', 'corrupted_json');
    storage.setItem('kstw_menu_cache', '{"invalid": "schema"}');
    storage.setItem('kstw_menu_cache_time', '1760000000');

    const version = migrateStorage(storage);

    expect(version).toBe(CURRENT_SCHEMA_VERSION);
    expect(storage.getItem(SCHEMA_VERSION_KEY)).toBe(String(CURRENT_SCHEMA_VERSION));

    // Sanitized preferences
    expect(storage.getItem('kstw_diet')).toBe('all');
    expect(storage.getItem('kstw_lang')).toBe('de');
    expect(storage.getItem('kstw_canteens')).toBe(JSON.stringify(['unimensa']));

    // Corrupted cache should be purged
    expect(storage.getItem('kstw_menu_cache')).toBeNull();
    expect(storage.getItem('kstw_menu_cache_time')).toBeNull();
  });

  it('preserves valid preferences and cache during migration', () => {
    const storage = new MockStorage();
    storage.setItem('kstw_diet', 'vegan');
    storage.setItem('kstw_lang', 'en');
    storage.setItem('kstw_canteens', JSON.stringify(['deutz', 'zollstock']));
    const validCache = JSON.stringify([{ date: '2026-10-05', dishes: [{ id: '1', name_de: 'Salat' }] }]);
    storage.setItem('kstw_menu_cache', validCache);
    storage.setItem('kstw_menu_cache_time', '1760000000');

    migrateStorage(storage);

    expect(storage.getItem('kstw_diet')).toBe('vegan');
    expect(storage.getItem('kstw_lang')).toBe('en');
    expect(storage.getItem('kstw_canteens')).toBe(JSON.stringify(['deutz', 'zollstock']));
    expect(storage.getItem('kstw_menu_cache')).toBe(validCache);
    expect(storage.getItem('kstw_menu_cache_time')).toBe('1760000000');
  });

  it('is idempotent when run repeatedly', () => {
    const storage = new MockStorage();
    storage.setItem('kstw_diet', 'vegan');

    migrateStorage(storage);
    expect(storage.getItem(SCHEMA_VERSION_KEY)).toBe('2');

    // Second run
    migrateStorage(storage);
    expect(storage.getItem(SCHEMA_VERSION_KEY)).toBe('2');
    expect(storage.getItem('kstw_diet')).toBe('vegan');
  });
});
