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
