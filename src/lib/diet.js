import { getCustomFields } from './dish.js';

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
    const tokens = rawIcon.split(',').map(t => t.trim().toUpperCase());
    if (tokens.some(t => t === 'VGN')) {
      return 'vegan';
    }
    if (tokens.some(t => t === 'VGT' || t === 'V')) {
      return 'vegetarian';
    }
  }

  // Check menu_type
  const rawMenuType = (cf.menu_type || '').toLowerCase();
  if (rawMenuType.includes('vegan')) {
    return 'vegan';
  }
  if (rawMenuType.includes('vegetarisch')) {
    return 'vegetarian';
  }

  // Check dish names (DE and EN)
  const names = [dish.name_de || '', dish.name_en || '', cf.CUSTOM_DPNAME || '']
    .map(n => n.toLowerCase());

  for (const name of names) {
    if (name.includes('(vegan)') || /\bvegan\b/i.test(name)) {
      return 'vegan';
    }
    if (name.includes('(vegetarisch)') || /\bvegetarisch\b/i.test(name)) {
      return 'vegetarian';
    }
  }

  return 'all';
}
