/**
 * Pure dish filtering functions for search queries, quick filters, and favorite stars.
 */
import { getCustomFields, getDishPrice, cleanDishNameForFavorite } from './dish.js';
import { getDishDietType, dishContainsPork } from './diet.js';
import { shouldExcludeDish } from './allergens.js';
import { getCanteenKeyFromDish } from './canteen-match.js';

/**
 * Checks if a dish matches active search query and quick filters
 * (pork exclusion, price cap < 2,50 €, favorites-only, diet, allergies).
 *
 * @param {object} dish
 * @param {object} [filters={}]
 * @returns {boolean}
 */
export function dishMatchesSearchAndQuickFilters(dish, filters = {}) {
  if (!dish || typeof dish !== 'object') return false;
  if (!filters || typeof filters !== 'object') return true;

  const {
    searchQuery = '',
    search = '',
    query = '',
    excludePork = false,
    noPork = false,
    maxPrice = null,
    under250 = false,
    cheapOnly = false,
    favoritesOnly = false,
    onlyFavorites = false,
    favorites = [],
    isFavoriteFn = null,
    tariff = 'student',
    diet = 'all',
    allergies = []
  } = filters;

  // 1. Diet filter (if passed)
  if (diet && diet !== 'all') {
    const dType = getDishDietType(dish);
    if (diet === 'vegan' && dType !== 'vegan') return false;
    if (diet === 'vegetarian' && dType !== 'vegan' && dType !== 'vegetarian') return false;
  }

  // 2. Allergen exclusion filter (if passed)
  if (Array.isArray(allergies) && allergies.length > 0) {
    if (shouldExcludeDish(dish, allergies)) return false;
  }

  // 3. Pork exclusion quick-filter
  if (excludePork || noPork) {
    if (dishContainsPork(dish)) return false;
  }

  // 4. Price cap quick-filter (e.g. < 2,50 €)
  const effectiveMaxPrice = maxPrice != null ? maxPrice : ((under250 || cheapOnly) ? 2.50 : null);
  if (typeof effectiveMaxPrice === 'number' && effectiveMaxPrice > 0) {
    const price = getDishPrice(dish, tariff);
    if (price == null || price > effectiveMaxPrice) return false;
  }

  // 5. Favorites-only quick-filter
  if (favoritesOnly || onlyFavorites) {
    const cleanName = cleanDishNameForFavorite(dish);
    if (!cleanName) return false;
    if (typeof isFavoriteFn === 'function') {
      if (!isFavoriteFn(cleanName)) return false;
    } else if (Array.isArray(favorites)) {
      const favSet = new Set(favorites.map(f => cleanDishNameForFavorite(f)));
      if (!favSet.has(cleanName)) return false;
    }
  }

  // 6. Search query matching
  const rawSearch = String(searchQuery || search || query || '').trim().toLowerCase();
  if (rawSearch) {
    const cf = getCustomFields(dish);
    const searchable = [
      dish.name_de || '',
      dish.name_en || '',
      dish.description_de || '',
      dish.description_en || '',
      cf.CUSTOM_DPNAME || '',
      cf.dish_ger_1 || '',
      cf.dish_ger_2 || '',
      cf.dish_ger_3 || '',
      cf.dish_ger_4 || '',
      cf.dish_ger_5 || '',
      cf.dish_1_eng || '',
      cf.dish_2_eng || '',
      cf.dish_3_eng || '',
      cf.dish_4_eng || '',
      cf.dish_5_eng || '',
      cf.menu_type || ''
    ].join(' ').toLowerCase();

    const tokens = rawSearch.split(/\s+/).filter(Boolean);
    if (!tokens.every(token => searchable.includes(token))) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether a menu day has at least one favorite dish that matches the user's
 * selected canteens, diet preference, allergen filters, and active quick filters.
 * Used for rendering the favorite star (★) on the date selector bar.
 *
 * @param {{ date?: string, dishes?: Array<object> }} day
 * @param {object} [state={}]
 * @param {Record<string, object>|null} [canteensMap=null]
 * @param {((cleanName: string) => boolean)|null} [isFavoriteFn=null]
 * @returns {boolean}
 */
export function hasMatchingFavoriteOnDay(day, state = {}, canteensMap = null, isFavoriteFn = null) {
  if (!day || !Array.isArray(day.dishes) || day.dishes.length === 0) return false;

  const favList = Array.isArray(state?.favorites) ? state.favorites : [];
  const favSet = new Set(favList.map(f => cleanDishNameForFavorite(f)).filter(Boolean));
  const checkFav = typeof isFavoriteFn === 'function'
    ? (cleanName) => Boolean(cleanName && isFavoriteFn(cleanName))
    : (cleanName) => Boolean(cleanName && favSet.has(cleanName));

  const selectedCanteens = Array.isArray(state?.selectedCanteens) ? state.selectedCanteens : [];
  const hasCanteenFilter = Boolean(canteensMap && selectedCanteens.length > 0);

  return day.dishes.some(dish => {
    if (!dish) return false;

    const cleanName = cleanDishNameForFavorite(dish);
    if (!checkFav(cleanName)) return false;

    if (hasCanteenFilter) {
      const inSelectedCanteen = selectedCanteens.some(cKey => {
        const canteen = canteensMap[cKey];
        return canteen && getCanteenKeyFromDish(dish, cKey, canteen);
      });
      if (!inSelectedCanteen) return false;
    }

    return dishMatchesSearchAndQuickFilters(dish, {
      diet: state?.diet || 'all',
      allergies: state?.allergies || [],
      excludePork: Boolean(state?.excludePork || state?.noPork),
      maxPrice: state?.maxPrice ?? (state?.under250 || state?.cheapOnly ? 2.50 : null),
      tariff: state?.tariff || 'student',
      searchQuery: state?.searchQuery || ''
    });
  });
}
