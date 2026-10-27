import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CANTEENS } from '../data/canteens.js';
import {
  getCanteenKeyFromDish,
  findCanteensForDish,
  isSharedLindenthalDish,
  calculateDistanceKm,
  formatDistance,
  sortCanteensByDistance,
  moveCanteenInOrder,
  normalizeCanteenOrder,
  getCanteenRouteUrl,
  computeCanteenDistances
} from '../src/lib/canteen-match.js';

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
    // Mensa Lindenthal (ort_id 231) matches robertkoch ONLY, NEVER unimensa or Bistro Lindenthal
    expect(getCanteenKeyFromDish(dishMensaLindenthal, 'robertkoch', CANTEENS['robertkoch'])).toBe(true);
    expect(getCanteenKeyFromDish(dishMensaLindenthal, 'unimensa', CANTEENS['unimensa'])).toBe(false);
    expect(getCanteenKeyFromDish(dishMensaLindenthal, 'lindenthal', CANTEENS['lindenthal'])).toBe(false);
    expect(isSharedLindenthalDish(dishMensaLindenthal)).toBe(true);

    // Mensa Lindenthal without ort_id matches robertkoch ONLY, NEVER unimensa or Bistro Lindenthal
    const dishMensaLindenthalNoOrt = {
      custom_fields: [
        { field_id: 'ort_id', value: '' },
        { field_id: 'location', value: 'Mensa Lindenthal' }
      ]
    };
    expect(getCanteenKeyFromDish(dishMensaLindenthalNoOrt, 'robertkoch', CANTEENS['robertkoch'])).toBe(true);
    expect(getCanteenKeyFromDish(dishMensaLindenthalNoOrt, 'unimensa', CANTEENS['unimensa'])).toBe(false);
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

    // Multi-canteen shared dish with ort_id=261 (MuHo) and Mensa Lindenthal screens matches both muho and robertkoch
    const dishSharedScreens = {
      name_de: 'Hähnchengeschnetzeltes Süß-Sauer',
      custom_fields: [
        { field_id: 'ort_id', value: '261' },
        { field_id: 'location', value: 'Mensa Musikhochschule' }
      ],
      screens: [
        { location: 'Mensa Lindenthal - Ausgabe 1 (Suppe/Fleisch, links)', screen_group_name: 'Mensa Lindenthal' },
        { location: 'Mensa MuHo - Theke 1 (links)', screen_group_name: 'Mensa Musikhochschule' }
      ]
    };
    expect(getCanteenKeyFromDish(dishSharedScreens, 'robertkoch', CANTEENS['robertkoch'])).toBe(true);
    expect(getCanteenKeyFromDish(dishSharedScreens, 'muho', CANTEENS['muho'])).toBe(true);
    expect(getCanteenKeyFromDish(dishSharedScreens, 'lindenthal', CANTEENS['lindenthal'])).toBe(false);
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
    expect(matchesPerCanteen['unimensa']).toBe(73);
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

  describe('Distance and Ordering Helpers', () => {
    it('calculateDistanceKm calculates distances correctly and handles invalid inputs', () => {
      // Same point
      expect(calculateDistanceKm(50.927269, 6.933479, 50.927269, 6.933479)).toBe(0);

      // Uni-Mensa to Mensa Deutz (~4.0km)
      const dist = calculateDistanceKm(50.927269, 6.933479, 50.934014, 6.988374);
      expect(dist).toBeGreaterThan(3.8);
      expect(dist).toBeLessThan(4.2);

      // Invalid inputs
      expect(calculateDistanceKm(null, 6.9, 50.9, 6.9)).toBeNull();
      expect(calculateDistanceKm(50.9, '6.9', 50.9, 6.9)).toBeNull();
      expect(calculateDistanceKm(NaN, 6.9, 50.9, 6.9)).toBeNull();
      expect(calculateDistanceKm(50.9, 6.9, Infinity, 6.9)).toBeNull();
    });

    it('formatDistance formats meters and kilometers in German and English', () => {
      expect(formatDistance(null)).toBe('');
      expect(formatDistance(undefined)).toBe('');
      expect(formatDistance(NaN)).toBe('');
      expect(formatDistance('abc')).toBe('');

      // Under 1 km -> meters (step of 10m, min 10m)
      expect(formatDistance(0.354, 'de')).toBe('350 m');
      expect(formatDistance(0.005, 'de')).toBe('10 m');
      expect(formatDistance(0.899, 'en')).toBe('900 m');

      // 1 km or more -> decimal with localized comma/dot
      expect(formatDistance(1.23, 'de')).toBe('1,2 km');
      expect(formatDistance(1.23, 'en')).toBe('1.2 km');
      expect(formatDistance(4.56, 'de')).toBe('4,6 km');
    });

    it('sortCanteensByDistance sorts keys by proximity and pushes missing coords to end', () => {
      const mockCanteens = {
        close: { latitude: 50.928, longitude: 6.934 },
        far: { latitude: 51.028, longitude: 7.562 },
        mid: { latitude: 50.934, longitude: 6.988 },
        noCoords: { latitude: null, longitude: null }
      };

      const userLat = 50.927269;
      const userLon = 6.933479;
      const keys = ['far', 'noCoords', 'close', 'mid'];

      const result = sortCanteensByDistance(keys, mockCanteens, userLat, userLon);
      expect(result.sortedKeys).toEqual(['close', 'mid', 'far', 'noCoords']);
      expect(result.distancesKm.close).toBeLessThan(result.distancesKm.mid);
      expect(result.distancesKm.mid).toBeLessThan(result.distancesKm.far);
      expect(result.distancesKm.noCoords).toBeUndefined();
    });

    it('sortCanteensByDistance handles empty/null arguments gracefully', () => {
      expect(sortCanteensByDistance(null, {}, 50, 6)).toEqual({ sortedKeys: [], distancesKm: {} });
      expect(sortCanteensByDistance([], null, 50, 6)).toEqual({ sortedKeys: [], distancesKm: {} });
    });

    it('moveCanteenInOrder moves items up and down properly within bounds', () => {
      const list = ['unimensa', 'iwz-deutz', 'spoho'];

      // Move iwz-deutz up
      expect(moveCanteenInOrder(list, 'iwz-deutz', 'up')).toEqual(['iwz-deutz', 'unimensa', 'spoho']);

      // Move iwz-deutz down
      expect(moveCanteenInOrder(list, 'iwz-deutz', 'down')).toEqual(['unimensa', 'spoho', 'iwz-deutz']);

      // Move top item up (no change)
      expect(moveCanteenInOrder(list, 'unimensa', 'up')).toEqual(['unimensa', 'iwz-deutz', 'spoho']);

      // Move bottom item down (no change)
      expect(moveCanteenInOrder(list, 'spoho', 'down')).toEqual(['unimensa', 'iwz-deutz', 'spoho']);

      // Unknown key (no change)
      expect(moveCanteenInOrder(list, 'unknown', 'up')).toEqual(['unimensa', 'iwz-deutz', 'spoho']);

      // Non-array input
      expect(moveCanteenInOrder(null, 'unimensa', 'up')).toEqual([]);
    });

    it('normalizeCanteenOrder ensures Mensen always precede Bistros', () => {
      const mockDict = {
        m1: { type: 'mensa' },
        b1: { type: 'bistro' },
        m2: { type: 'mensa' },
        b2: { type: 'bistro' }
      };

      expect(normalizeCanteenOrder(['b1', 'm1', 'b2', 'm2'], mockDict)).toEqual(['m1', 'm2', 'b1', 'b2']);
      expect(normalizeCanteenOrder(['m1', 'm2'], mockDict)).toEqual(['m1', 'm2']);
      expect(normalizeCanteenOrder(['b2', 'b1'], mockDict)).toEqual(['b2', 'b1']);
      expect(normalizeCanteenOrder(null, mockDict)).toEqual([]);
      expect(normalizeCanteenOrder(['b1', 'm1'], null)).toEqual(['b1', 'm1']);
    });

    it('moveCanteenInOrder with canteensDict confines movement to Mensa or Bistro group', () => {
      const mockDict = {
        m1: { type: 'mensa' },
        m2: { type: 'mensa' },
        b1: { type: 'bistro' },
        b2: { type: 'bistro' }
      };
      const list = ['m1', 'm2', 'b1', 'b2'];

      // Move m2 down: it is at the bottom of Mensen, so it CANNOT cross over into b1
      expect(moveCanteenInOrder(list, 'm2', 'down', mockDict)).toEqual(['m1', 'm2', 'b1', 'b2']);

      // Move b1 up: it is at the top of Bistros, so it CANNOT cross over into m2
      expect(moveCanteenInOrder(list, 'b1', 'up', mockDict)).toEqual(['m1', 'm2', 'b1', 'b2']);

      // Move m2 up: stays within Mensen
      expect(moveCanteenInOrder(list, 'm2', 'up', mockDict)).toEqual(['m2', 'm1', 'b1', 'b2']);

      // Move b2 up: stays within Bistros
      expect(moveCanteenInOrder(list, 'b2', 'up', mockDict)).toEqual(['m1', 'm2', 'b2', 'b1']);
    });

    it('getCanteenRouteUrl returns google maps walking route url or empty string for invalid coords', () => {
      const canteenWithCoords = { latitude: 50.927269, longitude: 6.933479 };
      expect(getCanteenRouteUrl(canteenWithCoords)).toBe(
        'https://www.google.com/maps/dir/?api=1&destination=50.927269,6.933479&travelmode=walking'
      );

      expect(getCanteenRouteUrl(null)).toBe('');
      expect(getCanteenRouteUrl({})).toBe('');
      expect(getCanteenRouteUrl({ latitude: null, longitude: 6.93 })).toBe('');
      expect(getCanteenRouteUrl({ latitude: NaN, longitude: 6.93 })).toBe('');
    });

    it('computeCanteenDistances preserves order and finds nearest Mensa', () => {
      const mockDict = {
        unimensa: { type: 'mensa', latitude: 50.927, longitude: 6.933 },
        bistroClose: { type: 'bistro', latitude: 50.9271, longitude: 6.9331 },
        spoho: { type: 'mensa', latitude: 50.937, longitude: 6.871 }
      };

      const keys = ['spoho', 'bistroClose', 'unimensa'];
      const result = computeCanteenDistances(keys, mockDict, 50.927, 6.933);

      // Order of distances keys preserved
      expect(Object.keys(result.distancesKm)).toEqual(['spoho', 'bistroClose', 'unimensa']);
      expect(result.distancesKm.unimensa).toBe(0);
      expect(result.distancesKm.bistroClose).toBeLessThan(result.distancesKm.spoho);

      // Nearest Mensa should be unimensa (even though bistroClose is closer than spoho)
      expect(result.nearestMensaKey).toBe('unimensa');
    });
  });
});

