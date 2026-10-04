/**
 * Dish metadata utilities and field extraction
 */

/**
 * Extracts custom_fields from a dish object into a key-value dictionary.
 * @param {object} dish
 * @returns {Record<string, string>}
 */
export function getCustomFields(dish) {
  if (!dish || !Array.isArray(dish.custom_fields)) return {};
  const map = {};
  for (const field of dish.custom_fields) {
    if (field && field.field_id) {
      map[field.field_id] = field.value != null ? String(field.value) : '';
    }
  }
  return map;
}

/**
 * Strips allergen/additive codes in parentheses, e.g. "Salat (13, 20)" -> "Salat"
 * @param {string} text
 * @returns {string}
 */
export function stripAllergenCodes(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

const DP_NAME_SUFFIXES = /\s+(Abendessen|TK|Eigenproduktion|Eigenprodukt|Neu|trocken|Vegan|vegan)\s*$/gi;

/**
 * Cleans internal suffixes from CUSTOM_DPNAME
 * @param {string} raw
 * @returns {string}
 */
export function cleanDPName(raw) {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(DP_NAME_SUFFIXES, '').trim();
  }
  return cleaned;
}

/**
 * Determines whether a dish is a standalone dessert (not a combo meal with dessert side).
 * @param {object} dish
 * @returns {boolean}
 */
export function isPureDessert(dish) {
  if (!dish) return false;
  const cf = getCustomFields(dish);
  const catNameDe = (dish.category && dish.category.name_de) ? dish.category.name_de.toLowerCase() : '';
  const rawType = (cf.menu_type || '').toLowerCase();
  const dishNameDe = (dish.name_de || '').toLowerCase();

  return catNameDe.includes('dessert') ||
         catNameDe.includes('nachspeise') ||
         rawType.includes('dessert') ||
         /^(?:dessert|nachspeise)\b/i.test(dishNameDe.trim());
}

/**
 * Checks if a component string represents a generic dessert pool side (e.g. "Dessert (11h,11w,17,18,27)")
 * @param {string} partText
 * @param {boolean} isPureDessertDish
 * @returns {boolean}
 */
export function isGenericDessertComponent(partText, isPureDessertDish = false) {
  if (isPureDessertDish || typeof partText !== 'string') return false;
  const trimmed = partText.trim();
  return /^dessert\b/i.test(trimmed) || /(?:nachspeise|dessert)/i.test(trimmed);
}

/**
 * Extracts and parses dish serving times from custom_fields['dish_info'].
 * Returns { startHour, endHour, servingTime, raw } or null if absent/invalid.
 *
 * @param {object} dish
 * @returns {{ startHour: number, endHour: number, servingTime: string, raw: string } | null}
 */
export function parseDishServingTime(dish) {
  if (!dish) return null;
  const cf = getCustomFields(dish);
  const dishInfo = cf['dish_info'] || '';
  if (!dishInfo || /^\s*\d?\s*$/.test(dishInfo)) return null;

  const match = dishInfo.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
  if (!match) return null;

  const sH = parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
  const eH = parseInt(match[3], 10) + parseInt(match[4], 10) / 60;
  const sStr = `${match[1].padStart(2, '0')}:${match[2]}`;
  const eStr = `${match[3].padStart(2, '0')}:${match[4]}`;

  return {
    startHour: sH,
    endHour: eH,
    servingTime: `${sStr} - ${eStr}`,
    raw: dishInfo
  };
}

/**
 * Determines whether a dish has already expired for the current day.
 *
 * @param {object} dish
 * @param {number} currentHour - Current decimal hour (e.g. 14.75)
 * @returns {boolean}
 */
export function isDishExpired(dish, currentHour) {
  const serving = parseDishServingTime(dish);
  if (!serving) return false;
  return currentHour > serving.endHour;
}

/**
 * Calculates the combined service window for an array of dishes.
 * Returns { startHour, endHour, formatted } or null if no explicit dish times.
 *
 * @param {object[]} dishes
 * @param {string} [lang='de']
 * @returns {{ startHour: number, endHour: number, formatted: string } | null}
 */
export function getDishesServiceWindow(dishes, lang = 'de') {
  if (!Array.isArray(dishes) || dishes.length === 0) return null;

  let minStart = 24;
  let maxEnd = 0;
  let hasTimes = false;

  for (const d of dishes) {
    const serving = parseDishServingTime(d);
    if (serving) {
      hasTimes = true;
      if (serving.startHour < minStart) minStart = serving.startHour;
      if (serving.endHour > maxEnd) maxEnd = serving.endHour;
    }
  }

  if (!hasTimes) return null;

  const format = (h) => `${Math.floor(h)}:${Math.round((h % 1) * 60).toString().padStart(2, '0')}`;
  const suffix = lang === 'de' ? ' Uhr' : '';
  return {
    startHour: minStart,
    endHour: maxEnd,
    formatted: `${format(minStart)} - ${format(maxEnd)}${suffix}`
  };
}

/**
 * Extracts serving counter name from dish_info or screens.
 *
 * @param {object} dish
 * @param {string} canteenKey
 * @returns {string}
 */
export function extractDishCounter(dish, canteenKey = '') {
  if (!dish) return '';
  const cf = getCustomFields(dish);
  const dishInfo = cf['dish_info'] || '';
  let dishCounter = '';

  if (dishInfo && !/^\s*\d?\s*$/.test(dishInfo)) {
    const timeMatch = dishInfo.match(/(\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2})/);
    let counterPart = dishInfo;
    if (timeMatch) {
      counterPart = dishInfo.substring(0, dishInfo.indexOf(timeMatch[0]));
    }
    counterPart = counterPart.replace(/\s*-\s*$/, '').replace(/Uhr.*$/i, '').trim();
    if (counterPart && !/^\d+$/.test(counterPart) && counterPart.length > 1) {
      dishCounter = counterPart;
    }
  }

  if (!dishCounter) {
    const screens = dish.screens || [];
    for (const s of screens) {
      const sLoc = s.location || '';
      if (canteenKey === 'unimensa') {
        if (sLoc.includes('Ausgabe 4') || sLoc.toLowerCase().includes('vegan')) {
          dishCounter = 'EG Nord';
          break;
        } else if (sLoc.includes('Ausgabe 1') || sLoc.includes('Ausgabe 5') || sLoc.toLowerCase().includes('pasta')) {
          dishCounter = 'MG Nord';
          break;
        } else if (sLoc.includes('Ausgabe 2') || sLoc.toLowerCase().includes('süd')) {
          dishCounter = 'MG Süd';
          break;
        }
      }
    }
  }

  return dishCounter;
}
