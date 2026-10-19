/**
 * Canteen matching and dish assignment logic
 */
import { getCustomFields } from './dish.js';

/**
 * Checks if a dish is produced by the shared Mensa Lindenthal kitchen (ort_id 231).
 *
 * @param {object} dish
 * @returns {boolean}
 */
export function isSharedLindenthalDish(dish) {
  if (!dish) return false;
  const cf = getCustomFields(dish);
  return String(cf.ort_id || '').trim() === '231' || (cf.location || '').toLowerCase().trim() === 'mensa lindenthal';
}

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

  // 1. Authoritative check on ort_id when dish provides a non-9999 ort_id
  if (dishOrtId && dishOrtId !== '9999') {
    if (canteenOrtId && dishOrtId === canteenOrtId) return true;
    if (canteenKey === 'unimensa' && dishOrtId === '231') return true;
    if (canteenOrtId && dishOrtId !== canteenOrtId) return false;
    if (!canteenOrtId && canteen.type === 'bistro') return false;
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
        if (canteen.type === 'bistro') {
          if (dishLocation === kwLower || dishLocation === `bistro ${kwLower}`) {
            return true;
          }
        } else if (dishLocation === kwLower || dishLocation === `mensa ${kwLower}` || dishLocation === `bistro ${kwLower}`) {
          return true;
        }
      }
    }
  }

  // 3. Match via dish screens and menu_group_name
  const dishScreens = (dish.screens || []).map(s => (s.location || '').toLowerCase()).filter(Boolean);
  const dishScreenGroups = [
    ...(dish.screens || []).map(s => (s.screen_group_name || '').toLowerCase().trim()),
    (dish.menu_group_name || '').toLowerCase().trim()
  ].filter(Boolean);
  const canteenScreens = (canteen.screen_locations || []).map(s => s.toLowerCase());
  const canteenScreenGroups = (canteen.screen_groups || []).map(s => s.toLowerCase());

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
      if (canteenScreenGroups.includes(group)) return true;
      if (canteenName && group === canteenName) return true;
      if (Array.isArray(canteen.keywords)) {
        for (const kw of canteen.keywords) {
          const kwLower = kw.toLowerCase();
          if (canteen.type === 'bistro') {
            if (group === kwLower || group === `bistro ${kwLower}`) {
              return true;
            }
          } else if (group === kwLower || group === `mensa ${kwLower}` || group === `bistro ${kwLower}`) {
            return true;
          }
        }
      }
    }
  }

  // 4. Shared kitchen production rules:
  // Uni-Mensa Zülpicher Straße (ort_id 201) and Mensa Lindenthal (ort_id 231) share the central kitchen production
  if ((canteenKey === 'unimensa' || canteenKey === 'robertkoch') && (dishOrtId === '231' || dishLocation === 'mensa lindenthal')) {
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
