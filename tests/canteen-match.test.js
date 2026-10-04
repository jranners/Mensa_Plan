import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CANTEENS } from '../data/canteens.js';
import { getCanteenKeyFromDish, findCanteensForDish } from '../src/lib/canteen-match.js';

describe('Canteen Match Module', () => {
  it('matches canteen by exact ort_id', () => {
    const dish = {
      custom_fields: [
        { field_id: 'ort_id', value: '201' },
        { field_id: 'location', value: 'Any String' }
      ]
    };
    expect(getCanteenKeyFromDish(dish, 'unimensa', CANTEENS['unimensa'])).toBe(true);
    expect(getCanteenKeyFromDish(dish, 'iwz-deutz', CANTEENS['iwz-deutz'])).toBe(false);
  });

  it('matches canteen by normalized location when ort_id is empty', () => {
    const dish = {
      custom_fields: [
        { field_id: 'ort_id', value: '' },
        { field_id: 'location', value: 'Mensa Zollstock' }
      ]
    };
    expect(getCanteenKeyFromDish(dish, 'zollstock', CANTEENS['zollstock'])).toBe(true);
    expect(getCanteenKeyFromDish(dish, 'unimensa', CANTEENS['unimensa'])).toBe(false);
  });

  it('matches canteen by screen location', () => {
    const dish = {
      screens: [
        { location: 'Mensa SpoHo - Speisekarte' }
      ]
    };
    expect(getCanteenKeyFromDish(dish, 'spoho', CANTEENS['spoho'])).toBe(true);
    expect(getCanteenKeyFromDish(dish, 'unimensa', CANTEENS['unimensa'])).toBe(false);
  });

  it('matches canteen by screen group name', () => {
    const dish = {
      screens: [
        { screen_group_name: 'Bistro E-Raum' }
      ]
    };
    expect(getCanteenKeyFromDish(dish, 'eraum', CANTEENS['eraum'])).toBe(true);
    expect(getCanteenKeyFromDish(dish, 'unimensa', CANTEENS['unimensa'])).toBe(false);
  });

  it('supports central kitchen production sharing (unimensa and lindenthal)', () => {
    const dishLindenthal = {
      custom_fields: [
        { field_id: 'ort_id', value: '231' },
        { field_id: 'location', value: 'Mensa Lindenthal' }
      ]
    };
    // Lindenthal matches both robertkoch and unimensa (shared kitchen)
    expect(getCanteenKeyFromDish(dishLindenthal, 'robertkoch', CANTEENS['robertkoch'])).toBe(true);
    expect(getCanteenKeyFromDish(dishLindenthal, 'unimensa', CANTEENS['unimensa'])).toBe(true);
    expect(getCanteenKeyFromDish(dishLindenthal, 'iwz-deutz', CANTEENS['iwz-deutz'])).toBe(false);
  });

  it('safely handles missing, null or empty arguments', () => {
    expect(getCanteenKeyFromDish(null, 'unimensa', CANTEENS['unimensa'])).toBe(false);
    expect(getCanteenKeyFromDish({}, 'unimensa', null)).toBe(false);
    expect(findCanteensForDish(null, CANTEENS)).toEqual([]);
  });

  it('matches all 232 dishes from the real RPC sample to valid canteens', () => {
    const samplePath = resolve(process.cwd(), 'docs/rpc-sample.json');
    const days = JSON.parse(readFileSync(samplePath, 'utf8'));

    let dishCount = 0;
    const matchesPerCanteen = {};
    Object.keys(CANTEENS).forEach(k => { matchesPerCanteen[k] = 0; });

    for (const day of days) {
      for (const dish of (day.dishes || [])) {
        dishCount++;
        const matched = findCanteensForDish(dish, CANTEENS);
        expect(matched.length).toBeGreaterThan(0);
        matched.forEach(k => { matchesPerCanteen[k]++; });
      }
    }

    expect(dishCount).toBe(232);
    expect(matchesPerCanteen['unimensa']).toBe(92);
    expect(matchesPerCanteen['iwz-deutz']).toBe(20);
    expect(matchesPerCanteen['spoho']).toBe(37);
    expect(matchesPerCanteen['eraum']).toBe(28);
    expect(matchesPerCanteen['cafe-himmelsblick']).toBe(5);
    expect(matchesPerCanteen['gummersbach']).toBe(27);
    expect(matchesPerCanteen['muho']).toBe(8);
    expect(matchesPerCanteen['robertkoch']).toBe(19);
    expect(matchesPerCanteen['zollstock']).toBe(15);
  });
});
