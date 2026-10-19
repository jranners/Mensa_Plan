import { getCustomFields } from './dish.js';

const MEAT_SPECIES_MAP = {
  G: { code: 'G', key: 'speciesPoultry', emoji: '🐓', labelDe: 'Geflügel', labelEn: 'Poultry' },
  S: { code: 'S', key: 'speciesPork', emoji: '🐖', labelDe: 'Schwein', labelEn: 'Pork' },
  R: { code: 'R', key: 'speciesBeef', emoji: '🐄', labelDe: 'Rind', labelEn: 'Beef' },
  F: { code: 'F', key: 'speciesFish', emoji: '🐟', labelDe: 'Fisch', labelEn: 'Fish' },
  NL: { code: 'NL', key: 'speciesNeuland', emoji: '🌾', labelDe: 'Artgerecht (NL)', labelEn: 'Animal Welfare (NL)' }
};

/**
 * Determines the dietary type of a dish: "vegan", "vegetarian", or "all".
 * Robust against casing (e.g. "vgn", "VGN"), comma-separated icon lists,
 * and handles "V" for vegetarian.
 *
 * @param {object} dish
 * @returns {'vegan'|'vegetarian'|'all'}
 */
export function getDishDietType(dish) {
  if (!dish) return 'all';

  const cf = getCustomFields(dish);
  const rawIcon = (cf.food_icon || '').trim();

  // Check food_icon tokens
  if (rawIcon) {
    const tokens = rawIcon.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (tokens.some(t => t === 'VGT' || t === 'V')) {
      return 'vegetarian';
    }
    const hasNonVegan = tokens.some(t => t !== 'VGN' && t !== 'D');
    if (tokens.includes('VGN') && !hasNonVegan) {
      return 'vegan';
    }
  }

  // Check dish names (DE and EN) for explicit markers before generic menu_type line
  const names = [dish.name_de || '', dish.name_en || '', cf.CUSTOM_DPNAME || '']
    .map(n => n.toLowerCase());

  for (const name of names) {
    if (name.includes('(vegetarisch)') || /\bvegetarisch\b/i.test(name)) {
      return 'vegetarian';
    }
    if (name.includes('(vegan)') || /\bvegan\b/i.test(name)) {
      return 'vegan';
    }
  }

  // Check menu_type (check 'vegetarisch' before 'vegan' so 'vegan/vegetarisch' resolves to 'vegetarian')
  const rawMenuType = (cf.menu_type || '').toLowerCase();
  if (rawMenuType.includes('vegetarisch')) {
    return 'vegetarian';
  }
  if (rawMenuType.includes('vegan')) {
    return 'vegan';
  }

  return 'all';
}

/**
 * Parses custom_fields.food_icon tokens and returns matched meat/fish/welfare species descriptors.
 *
 * @param {object} dish
 * @returns {Array<{ code: string, key: string, emoji: string, labelDe: string, labelEn: string }>}
 */
export function getDishMeatIcons(dish) {
  if (!dish || typeof dish !== 'object') return [];
  const cf = getCustomFields(dish);
  const rawIcon = (cf.food_icon || '').trim();
  if (!rawIcon) return [];

  const tokens = rawIcon.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  const seen = new Set();
  const icons = [];

  for (const token of tokens) {
    if (MEAT_SPECIES_MAP[token] && !seen.has(token)) {
      seen.add(token);
      icons.push({ ...MEAT_SPECIES_MAP[token] });
    }
  }

  return icons;
}

/**
 * Checks whether a dish contains pork based on food_icon ('S'), allergen code ('28'),
 * or name/component keywords (unless negated like 'ohne schwein' or 'vegan').
 *
 * @param {object} dish
 * @returns {boolean}
 */
export function dishContainsPork(dish) {
  if (!dish || typeof dish !== 'object') return false;

  if (getDishMeatIcons(dish).some(m => m.code === 'S')) {
    return true;
  }

  const cf = getCustomFields(dish);
  const allergenTokens = (cf.allergens_numbers || '')
    .split(',')
    .map(c => c.trim().toLowerCase())
    .filter(Boolean);
  if (allergenTokens.includes('28')) {
    return true;
  }

  if (getDishDietType(dish) === 'vegan') {
    return false;
  }

  const textParts = [
    dish.name_de || '',
    dish.name_en || '',
    cf.CUSTOM_DPNAME || '',
    dish.description_de || '',
    dish.description_en || '',
    cf.dish_ger_1 || '',
    cf.dish_ger_2 || '',
    cf.dish_ger_3 || '',
    cf.dish_ger_4 || '',
    cf.dish_ger_5 || ''
  ].join(' ');

  if (/\b(?:ohne\s+(?:schwein\w*|speck\w*|schinken\w*|bacon)|vegan\w*)\b/i.test(textParts)) {
    return false;
  }

  return /\b(?:schwein\w*|speck\w*|schinken\w*|bacon|chorizo)\b/i.test(textParts);
}
