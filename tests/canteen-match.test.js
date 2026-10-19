import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CANTEENS } from '../data/canteens.js';
import { getCanteenKeyFromDish, findCanteensForDish, isSharedLindenthalDish } from '../src/lib/canteen-match.js';

describe('Canteen Match Module', () => {
  it('matches canteen by exact ort_id and rejects mismatched ort_id', () => {
    const dish = {
      custom_fields: [
        { field_id: 'ort_id', value: '201' },
        { field_id: 'location', value: 'Mensa Lindenthal' }
      ]
    };
    expect(getCanteenKeyFromDish(dish, 'unimensa', CANTEENS['unimensa'])).toBe(true);
    expect(getCanteenKeyFromDish(dish, 'robertkoch', CANTEENS['robertkoch'])).toBe(false);
    expect(getCanteenKeyFromDish(dish, 'lindenthal', CANTEENS['lindenthal'])).toBe(false);
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

  it('matches canteen by screen location and menu_group_name', () => {
    const dish = {
      screens: [
        { location: 'Mensa SpoHo - Speisekarte' }
      ]
    };
    expect(getCanteenKeyFromDish(dish, 'spoho', CANTEENS['spoho'])).toBe(true);
    expect(getCanteenKeyFromDish(dish, 'unimensa', CANTEENS['unimensa'])).toBe(false);

    const dishWithMenuGroup = {
      menu_group_name: 'Bistro E-Raum'
    };
    expect(getCanteenKeyFromDish(dishWithMenuGroup, 'eraum', CANTEENS['eraum'])).toBe(true);
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

  it('prevents 3-way collision between unimensa, robertkoch, and lindenthal (Bug D-01)', () => {
    const dishMensaLindenthal = {
      custom_fields: [
        { field_id: 'ort_id', value: '231' },
        { field_id: 'location', value: 'Mensa Lindenthal' }
      ]
    };
    // Mensa Lindenthal (ort_id 231) matches robertkoch and unimensa (shared kitchen), NEVER Bistro Lindenthal
    expect(getCanteenKeyFromDish(dishMensaLindenthal, 'robertkoch', CANTEENS['robertkoch'])).toBe(true);
    expect(getCanteenKeyFromDish(dishMensaLindenthal, 'unimensa', CANTEENS['unimensa'])).toBe(true);
    expect(getCanteenKeyFromDish(dishMensaLindenthal, 'lindenthal', CANTEENS['lindenthal'])).toBe(false);
    expect(isSharedLindenthalDish(dishMensaLindenthal)).toBe(true);

    // Mensa Lindenthal without ort_id still must NOT match Bistro Lindenthal
    const dishMensaLindenthalNoOrt = {
      custom_fields: [
        { field_id: 'ort_id', value: '' },
        { field_id: 'location', value: 'Mensa Lindenthal' }
      ]
    };
    expect(getCanteenKeyFromDish(dishMensaLindenthalNoOrt, 'robertkoch', CANTEENS['robertkoch'])).toBe(true);
    expect(getCanteenKeyFromDish(dishMensaLindenthalNoOrt, 'unimensa', CANTEENS['unimensa'])).toBe(true);
    expect(getCanteenKeyFromDish(dishMensaLindenthalNoOrt, 'lindenthal', CANTEENS['lindenthal'])).toBe(false);
    expect(isSharedLindenthalDish(dishMensaLindenthalNoOrt)).toBe(true);

    // Bistro Lindenthal (no ort_id) matches ONLY lindenthal, NEVER unimensa or robertkoch
    const dishBistroLindenthal = {
      custom_fields: [
        { field_id: 'ort_id', value: '' },
        { field_id: 'location', value: 'Bistro Lindenthal' }
      ]
    };
    expect(getCanteenKeyFromDish(dishBistroLindenthal, 'lindenthal', CANTEENS['lindenthal'])).toBe(true);
    expect(getCanteenKeyFromDish(dishBistroLindenthal, 'robertkoch', CANTEENS['robertkoch'])).toBe(false);
    expect(getCanteenKeyFromDish(dishBistroLindenthal, 'unimensa', CANTEENS['unimensa'])).toBe(false);
    expect(isSharedLindenthalDish(dishBistroLindenthal)).toBe(false);
  });

  it('safely handles missing, null or empty arguments', () => {
    expect(getCanteenKeyFromDish(null, 'unimensa', CANTEENS['unimensa'])).toBe(false);
    expect(getCanteenKeyFromDish({}, 'unimensa', null)).toBe(false);
    expect(findCanteensForDish(null, CANTEENS)).toEqual([]);
    expect(isSharedLindenthalDish(null)).toBe(false);
  });

  it('matches all 232 dishes from the real RPC sample to valid canteens without false Bistro Lindenthal leaks', () => {
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
    expect(matchesPerCanteen['lindenthal']).toBe(0);
  });
});

