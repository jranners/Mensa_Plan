import { describe, it, expect } from 'vitest';
import { SVG_ICONS } from '../data/icons.js';
import { CANTEENS } from '../data/canteens.js';
import { TRANSLATIONS } from '../data/translations.js';
import { STANDARD_ALLERGENS } from '../data/allergens.js';
import { needsRefresh } from '../src/lib/lifecycle.js';
import { resetAppStorage, createSettingsDraft, migrateStorage } from '../src/lib/storage.js';
import { validateWeekMenu, validateAnnouncements } from '../src/lib/validation.js';

describe('ES Module Smoke Test', () => {
  it('loads SVG_ICONS properly', () => {
    expect(SVG_ICONS).toBeDefined();
    expect(typeof SVG_ICONS.settings).toBe('string');
  });

  it('loads CANTEENS properly', () => {
    expect(CANTEENS).toBeDefined();
    expect(CANTEENS.unimensa).toBeDefined();
    expect(CANTEENS.unimensa.name).toBe('Mensa Zülpicher Straße');
  });

  it('loads TRANSLATIONS properly with both languages', () => {
    expect(TRANSLATIONS).toBeDefined();
    expect(TRANSLATIONS.de).toBeDefined();
    expect(TRANSLATIONS.en).toBeDefined();
    expect(TRANSLATIONS.de.title).toBe('Mensaplan');
    expect(TRANSLATIONS.en.title).toBe('Mensaplan');
  });

  it('loads STANDARD_ALLERGENS properly', () => {
    expect(STANDARD_ALLERGENS).toBeDefined();
    expect(STANDARD_ALLERGENS['11']).toEqual({ de: 'Enthält Gluten', en: 'Contains gluten' });
    expect(STANDARD_ALLERGENS['13']).toEqual({ de: 'Enthält Eier', en: 'Contains eggs' });
  });

  it('loads lifecycle module properly', () => {
    expect(typeof needsRefresh).toBe('function');
  });

  it('loads storage module properly', () => {
    expect(typeof resetAppStorage).toBe('function');
    expect(typeof createSettingsDraft).toBe('function');
    expect(typeof migrateStorage).toBe('function');
  });

  it('loads validation module properly', () => {
    expect(typeof validateWeekMenu).toBe('function');
    expect(typeof validateAnnouncements).toBe('function');
  });
});

