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

  // 1. Direct match on ort_id when dish provides a non-9999 ort_id
  if (dishOrtId && dishOrtId !== '9999') {
    if (canteenOrtId && dishOrtId === canteenOrtId) return true;
  }

  const dishLocation = (customFields['location'] || '').trim().toLowerCase();
  const canteenName = (canteen.name || '').trim().toLowerCase();

  // 2. Match via dish screens and menu_group_name
  // When KStW groups/shares dishes across multiple canteens, all participating
  // canteens are listed in `dish.screens` even if `ort_id` only names one of them.
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

  // Check screen group name (e.g. 'Mensa Zollstock', 'Bistro E-Raum', 'Mensa Lindenthal')
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

  // 3. Authoritative rejection on mismatched ort_id when not matched via screens
  if (dishOrtId && dishOrtId !== '9999') {
    if (canteenOrtId && dishOrtId !== canteenOrtId) return false;
    if (!canteenOrtId && canteen.type === 'bistro') return false;
  }

  // 4. Exact match on normalized location name
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

  // 5. Mensa Lindenthal (Robert-Koch-Straße / ort_id 231)
  if (canteenKey === 'robertkoch' && (dishOrtId === '231' || dishLocation === 'mensa lindenthal')) {
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

/**
 * Calculates great-circle distance between two geographic coordinates using the Haversine formula.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number|null} Distance in kilometers rounded to 3 decimal places, or null if invalid
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' || !Number.isFinite(lat1) ||
    typeof lon1 !== 'number' || !Number.isFinite(lon1) ||
    typeof lat2 !== 'number' || !Number.isFinite(lat2) ||
    typeof lon2 !== 'number' || !Number.isFinite(lon2)
  ) {
    return null;
  }

  const R = 6371; // Earth's mean radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 1000) / 1000;
}

/**
 * Formats a distance in kilometers for display.
 *
 * @param {number|null|undefined} km
 * @param {string} [lang='de']
 * @returns {string}
 */
export function formatDistance(km, lang = 'de') {
  if (km == null || typeof km !== 'number' || !Number.isFinite(km)) {
    return '';
  }
  if (km < 1) {
    return `${Math.max(10, Math.round(km * 100) * 10)} m`;
  }
  return `${km.toFixed(1).replace('.', lang === 'de' ? ',' : '.')} km`;
}

/**
 * Sorts canteen keys by geographical distance to a user coordinate.
 *
 * @param {string[]} canteenKeys
 * @param {Record<string, object>} canteensDict
 * @param {number} userLat
 * @param {number} userLon
 * @returns {{ sortedKeys: string[], distancesKm: Record<string, number> }}
 */
export function sortCanteensByDistance(canteenKeys, canteensDict, userLat, userLon) {
  if (!Array.isArray(canteenKeys)) {
    return { sortedKeys: [], distancesKm: {} };
  }
  const dict = canteensDict || {};
  const distancesKm = {};

  for (const key of canteenKeys) {
    const c = dict[key];
    if (c && typeof c.latitude === 'number' && typeof c.longitude === 'number') {
      const d = calculateDistanceKm(userLat, userLon, c.latitude, c.longitude);
      if (d != null) {
        distancesKm[key] = d;
      }
    }
  }

  const sortedKeys = [...canteenKeys].sort((a, b) => {
    const distA = distancesKm[a];
    const distB = distancesKm[b];
    if (distA != null && distB != null) return distA - distB;
    if (distA != null) return -1;
    if (distB != null) return 1;
    return 0;
  });

  return { sortedKeys, distancesKm };
}

/**
 * Moves a canteen key up or down by one position in an array of canteen keys.
 * If canteensDict is provided, movement is restricted to within the key's group (Mensen or Bistros).
 *
 * @param {string[]} canteenKeys
 * @param {string} key
 * @param {'up'|'down'} direction
 * @param {Record<string, object>} [canteensDict=null]
 * @returns {string[]} New copy of canteen keys
 */
export function moveCanteenInOrder(canteenKeys, key, direction, canteensDict = null) {
  if (!Array.isArray(canteenKeys)) return [];
  if (!canteensDict) {
    const copy = [...canteenKeys];
    const idx = copy.indexOf(key);
    if (idx === -1) return copy;

    if (direction === 'up' && idx > 0) {
      const temp = copy[idx];
      copy[idx] = copy[idx - 1];
      copy[idx - 1] = temp;
    } else if (direction === 'down' && idx < copy.length - 1) {
      const temp = copy[idx];
      copy[idx] = copy[idx + 1];
      copy[idx + 1] = temp;
    }

    return copy;
  }

  const mensaKeys = canteenKeys.filter((k) => canteensDict[k]?.type !== 'bistro');
  const bistroKeys = canteenKeys.filter((k) => canteensDict[k]?.type === 'bistro');

  if (mensaKeys.includes(key)) {
    const nextMensaKeys = moveCanteenInOrder(mensaKeys, key, direction, null);
    return [...nextMensaKeys, ...bistroKeys];
  } else if (bistroKeys.includes(key)) {
    const nextBistroKeys = moveCanteenInOrder(bistroKeys, key, direction, null);
    return [...mensaKeys, ...nextBistroKeys];
  }

  return [...canteenKeys];
}

/**
 * Normalizes canteen order such that Mensen always precede Bistros.
 *
 * @param {string[]} canteenKeys
 * @param {Record<string, object>} [canteensDict]
 * @returns {string[]}
 */
export function normalizeCanteenOrder(canteenKeys, canteensDict) {
  if (!Array.isArray(canteenKeys)) return [];
  if (!canteensDict) return [...canteenKeys];

  const mensaKeys = canteenKeys.filter((k) => canteensDict[k]?.type !== 'bistro');
  const bistroKeys = canteenKeys.filter((k) => canteensDict[k]?.type === 'bistro');
  return [...mensaKeys, ...bistroKeys];
}

/**
 * Generates a cross-platform walking route URL for a canteen.
 *
 * @param {object} canteen
 * @returns {string}
 */
export function getCanteenRouteUrl(canteen) {
  if (
    !canteen ||
    typeof canteen.latitude !== 'number' ||
    !Number.isFinite(canteen.latitude) ||
    typeof canteen.longitude !== 'number' ||
    !Number.isFinite(canteen.longitude)
  ) {
    return '';
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${canteen.latitude},${canteen.longitude}&travelmode=walking`;
}

/**
 * Computes distances in km from user coordinates to canteens without altering the input array order.
 * Also identifies the nearest Mensa (type === 'mensa').
 *
 * @param {string[]} canteenKeys
 * @param {Record<string, object>} canteensDict
 * @param {number} userLat
 * @param {number} userLon
 * @returns {{ distancesKm: Record<string, number>, nearestMensaKey: string|null }}
 */
export function computeCanteenDistances(canteenKeys, canteensDict, userLat, userLon) {
  const dict = canteensDict || {};
  const keys = Array.isArray(canteenKeys) ? canteenKeys : Object.keys(dict);
  const distancesKm = {};

  let nearestMensaKey = null;
  let minMensaDist = Infinity;

  for (const key of keys) {
    const c = dict[key];
    if (c && typeof c.latitude === 'number' && typeof c.longitude === 'number') {
      const d = calculateDistanceKm(userLat, userLon, c.latitude, c.longitude);
      if (d != null) {
        distancesKm[key] = d;
        if (c.type === 'mensa' && d < minMensaDist) {
          minMensaDist = d;
          nearestMensaKey = key;
        }
      }
    }
  }

  return { distancesKm, nearestMensaKey };
}
