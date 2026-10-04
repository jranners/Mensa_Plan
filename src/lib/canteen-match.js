/**
 * Canteen matching and dish assignment logic
 */
import { getCustomFields } from './dish.js';

/**
 * Checks if a dish belongs to a specific canteen.
 *
 * @param {object} dish - Dish object from RPC
 * @param {string} canteenKey - Key in CANTEENS dictionary (e.g. 'unimensa', 'iwz-deutz')
 * @param {object} canteen - Canteen metadata object from CANTEENS[canteenKey]
 * @returns {boolean}
 */
export function getCanteenKeyFromDish(dish, canteenKey, canteen) {
  if (!dish || !canteen) return false;

  const customFields = getCustomFields(dish);
  const dishOrtId = (customFields['ort_id'] || '').trim();
  const canteenOrtId = (canteen.ort_id || '').trim();

  // 1. Exact match on ort_id if both provide non-empty values
  if (dishOrtId && canteenOrtId) {
    if (dishOrtId === canteenOrtId) return true;
  }

  const dishLocation = (customFields['location'] || '').trim().toLowerCase();
  const canteenName = (canteen.name || '').trim().toLowerCase();

  // 2. Exact match on normalized location name
  if (dishLocation) {
    if (canteenName && dishLocation === canteenName) {
      return true;
    }

    // Check canteen keywords with exact comparison
    if (Array.isArray(canteen.keywords)) {
      for (const kw of canteen.keywords) {
        const kwLower = kw.toLowerCase();
        if (dishLocation === kwLower || dishLocation === `mensa ${kwLower}` || dishLocation === `bistro ${kwLower}`) {
          return true;
        }
      }
    }
  }

  // 3. Match via dish screens
  const dishScreens = (dish.screens || []).map(s => (s.location || '').toLowerCase()).filter(Boolean);
  const dishScreenGroups = (dish.screens || []).map(s => (s.screen_group_name || '').toLowerCase()).filter(Boolean);
  const canteenScreens = (canteen.screen_locations || []).map(s => s.toLowerCase());

  // Check screen locations
  if (dishScreens.length > 0 && canteenScreens.length > 0) {
    for (const screen of dishScreens) {
      if (canteenScreens.includes(screen)) {
        return true;
      }
      // Check prefix/contained screen match (e.g. screen starts with canteen abbreviation like "MZS - ")
      for (const cs of canteenScreens) {
        if (cs === screen || (screen.length > 4 && cs.startsWith(screen))) {
          return true;
        }
      }
    }
  }

  // Check screen group name (e.g. 'Mensa Zollstock', 'Bistro E-Raum')
  if (dishScreenGroups.length > 0) {
    for (const group of dishScreenGroups) {
      if (canteenName && group === canteenName) return true;
      if (Array.isArray(canteen.keywords)) {
        for (const kw of canteen.keywords) {
          const kwLower = kw.toLowerCase();
          if (group === kwLower || group === `mensa ${kwLower}` || group === `bistro ${kwLower}`) {
            return true;
          }
        }
      }
    }
  }

  // 4. Shared kitchen production rules:
  // Uni-Mensa Zülpicher Straße (ort_id 201) and Mensa Lindenthal (ort_id 231) share the central kitchen production
  if (canteenKey === 'unimensa' && (dishOrtId === '231' || dishLocation === 'mensa lindenthal' || dishLocation.includes('lindenthal'))) {
    return true;
  }

  // Fallback for central production dishes (Gemeinkostenstelle HSG / ort_id 9999)
  if ((dishOrtId === '9999' || dishLocation.includes('gemeinkostenstelle')) &&
      (canteenKey === 'unimensa' || canteenKey === 'robertkoch')) {
    return true;
  }

  return false;
}

/**
 * Finds all canteens that match a dish.
 *
 * @param {object} dish
 * @param {Record<string, object>} canteensDict
 * @returns {string[]} Array of canteen keys
 */
export function findCanteensForDish(dish, canteensDict) {
  if (!dish || !canteensDict) return [];
  const matched = [];
  for (const [key, canteen] of Object.entries(canteensDict)) {
    if (getCanteenKeyFromDish(dish, key, canteen)) {
      matched.push(key);
    }
  }
  return matched;
}
