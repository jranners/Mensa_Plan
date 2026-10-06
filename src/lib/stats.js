import { getDishDietType } from './diet.js';
import {
  getDishPrice,
  cleanDishNameForFavorite,
  classifyDish,
  stripAllergenCodes,
  cleanDPName
} from './dish.js';
import { getCanteenKeyFromDish } from './canteen-match.js';
import {
  getBerlinTodayDate,
  parseIsoParts,
  formatDateRange
} from './dates.js';

export const STATS_KEY = 'kstw_stats_v1';

/**
 * Returns empty/default stats schema.
 */
export function getInitialStats() {
  return {
    version: 1,
    lastUpdated: '',
    totalDishes: 0,
    veganCount: 0,
    vegetarianCount: 0,
    otherCount: 0,
    meatCount: 0,
    priceSum: 0,
    priceCount: 0,
    minPrice: null,
    maxPrice: null,
    avgPrice: null,
    dishCounts: {},
    recordedDates: [],
    topDishes: [],
    allDishes: [],
    matchedFavorites: [],
    activeFavoritesCount: 0,
    timeframe: {
      mode: 'all',
      startDate: '',
      endDate: '',
      formattedRange: '',
      activeDaysCount: 0
    }
  };
}

/**
 * Loads aggregated stats from localStorage, safely falling back to defaults.
 * @returns {object}
 */
export function loadSavedStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return getInitialStats();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return getInitialStats();
    }
    return {
      ...getInitialStats(),
      ...parsed,
      dishCounts: parsed.dishCounts && typeof parsed.dishCounts === 'object' ? parsed.dishCounts : {},
      recordedDates: Array.isArray(parsed.recordedDates) ? parsed.recordedDates : []
    };
  } catch {
    return getInitialStats();
  }
}

/**
 * Saves stats object to localStorage ensuring strict lightweight storage limits (< 4 KB).
 * @param {object} stats
 */
export function saveStats(stats) {
  try {
    // Keep only top 50 most frequent dishes to prevent unbounded growth
    const sortedDishes = Object.entries(stats.dishCounts || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);
    const compactDishCounts = Object.fromEntries(sortedDishes);

    // Keep last 30 recorded dates
    const compactDates = (stats.recordedDates || []).slice(-30);

    const compactStats = {
      version: 1,
      lastUpdated: stats.lastUpdated || '',
      totalDishes: stats.totalDishes || 0,
      veganCount: stats.veganCount || 0,
      vegetarianCount: stats.vegetarianCount || 0,
      otherCount: stats.otherCount || 0,
      priceSum: Math.round((stats.priceSum || 0) * 100) / 100,
      priceCount: stats.priceCount || 0,
      minPrice: stats.minPrice != null ? Math.round(stats.minPrice * 100) / 100 : null,
      maxPrice: stats.maxPrice != null ? Math.round(stats.maxPrice * 100) / 100 : null,
      dishCounts: compactDishCounts,
      recordedDates: compactDates
    };

    localStorage.setItem(STATS_KEY, JSON.stringify(compactStats));
    return compactStats;
  } catch (err) {
    console.error('Failed to save stats:', err);
    return stats;
  }
}

/**
 * Aggregates a week/days menu payload into persisted statistics idempotently.
 *
 * @param {Array<{ date: string, dishes: Array }>} menuData
 * @param {object} [existingStats]
 * @returns {object} Updated stats
 */
export function aggregateMenuStats(menuData, existingStats = null) {
  if (!Array.isArray(menuData) || menuData.length === 0) {
    return existingStats || loadSavedStats();
  }

  const stats = existingStats ? { ...existingStats } : loadSavedStats();
  const recordedSet = new Set(stats.recordedDates || []);
  let hasNewData = false;

  menuData.forEach(day => {
    if (!day || !day.date || !Array.isArray(day.dishes) || day.dishes.length === 0) return;
    if (recordedSet.has(day.date)) return; // Avoid double counting already recorded days

    recordedSet.add(day.date);
    hasNewData = true;

    day.dishes.forEach(dish => {
      if (!dish) return;
      stats.totalDishes++;

      const diet = getDishDietType(dish);
      if (diet === 'vegan') stats.veganCount++;
      else if (diet === 'vegetarian') stats.vegetarianCount++;
      else stats.otherCount++;

      const price = getDishPrice(dish, 'student');
      if (price != null && price > 0) {
        stats.priceSum += price;
        stats.priceCount++;
        if (stats.minPrice == null || price < stats.minPrice) stats.minPrice = price;
        if (stats.maxPrice == null || price > stats.maxPrice) stats.maxPrice = price;
      }

      const cleanName = cleanDishNameForFavorite(dish);
      if (cleanName) {
        stats.dishCounts[cleanName] = (stats.dishCounts[cleanName] || 0) + 1;
      }
    });
  });

  if (hasNewData) {
    stats.recordedDates = Array.from(recordedSet);
    stats.lastUpdated = new Date().toISOString().split('T')[0];
    return saveStats(stats);
  }

  return stats;
}

/**
 * Computes live instant stats for loaded menu days with rich filtering options:
 * - timeframe ('all' | 'week')
 * - category ('main' | 'side' | 'dessert' | 'all')
 * - canteenScope ('all' | 'selected')
 *
 * Zero extra storage footprint (< 2 KB local guarantee).
 *
 * @param {Array<{ date: string, dishes: Array }>} menuData
 * @param {object} [options={}]
 * @returns {object}
 */
export function computeLiveMenuStats(menuData, options = {}) {
  const {
    timeframe = 'all',
    canteenScope = 'all',
    selectedCanteens = [],
    canteensMap = null,
    category = 'main',
    tariff = 'student',
    favorites = [],
    todayIso = getBerlinTodayDate()
  } = options;

  const live = getInitialStats();
  if (!Array.isArray(menuData) || menuData.length === 0) {
    return live;
  }

  // Calculate current week bounds based on todayIso
  const todayParts = parseIsoParts(todayIso);
  let weekStartIso = todayIso;
  let weekEndIso = todayIso;
  if (todayParts) {
    const d = new Date(todayParts.year, todayParts.month - 1, todayParts.day, 12, 0, 0);
    const dayOfWeek = d.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : (dayOfWeek - 1);
    const monday = new Date(todayParts.year, todayParts.month - 1, todayParts.day - daysSinceMonday, 12, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 12, 0, 0);
    weekStartIso = getBerlinTodayDate(monday);
    weekEndIso = getBerlinTodayDate(sunday);
  }

  // Filter days by timeframe
  const filteredDays = menuData.filter(day => {
    if (!day || !day.date) return false;
    if (timeframe === 'week') {
      return day.date >= weekStartIso && day.date <= weekEndIso;
    }
    return true;
  });

  // Collect dates that actually have meal entries
  const datesWithMeals = filteredDays
    .filter(d => Array.isArray(d.dishes) && d.dishes.length > 0)
    .map(d => d.date)
    .sort();

  const startDate = datesWithMeals.length > 0 ? datesWithMeals[0] : (timeframe === 'week' ? weekStartIso : todayIso);
  const endDate = datesWithMeals.length > 0 ? datesWithMeals[datesWithMeals.length - 1] : (timeframe === 'week' ? weekEndIso : todayIso);
  const activeDaysCount = datesWithMeals.length;
  const formattedRange = formatDateRange(startDate, endDate);

  const dishMap = {};
  let priceSum = 0;
  let priceCount = 0;

  filteredDays.forEach(day => {
    if (!day || !Array.isArray(day.dishes)) return;
    day.dishes.forEach(dish => {
      if (!dish) return;

      // Canteen scope filter
      if (canteenScope === 'selected' && Array.isArray(selectedCanteens) && selectedCanteens.length > 0 && canteensMap) {
        const matches = selectedCanteens.some(cKey => getCanteenKeyFromDish(dish, cKey, canteensMap[cKey]));
        if (!matches) return;
      }

      // Category filter (default: 'main' includes mains & meisterwerk action meals)
      const cls = classifyDish(dish);
      if (category === 'main') {
        if (cls !== 'main' && cls !== 'meisterwerk') return;
      } else if (category === 'side') {
        if (cls !== 'side') return;
      } else if (category === 'dessert') {
        if (cls !== 'dessert') return;
      }
      // 'all' includes everything

      live.totalDishes++;

      const diet = getDishDietType(dish);
      if (diet === 'vegan') live.veganCount++;
      else if (diet === 'vegetarian') live.vegetarianCount++;
      else live.otherCount++;

      const price = getDishPrice(dish, tariff);
      if (price != null && price > 0) {
        priceSum += price;
        priceCount++;
        if (live.minPrice == null || price < live.minPrice) live.minPrice = price;
        if (live.maxPrice == null || price > live.maxPrice) live.maxPrice = price;
      }

      const clean = cleanDishNameForFavorite(dish);
      if (!clean) return;

      if (!dishMap[clean]) {
        const rawName = dish.name_de || dish.name_en || '';
        let displayName = stripAllergenCodes(rawName);
        displayName = cleanDPName(displayName);
        displayName = displayName.replace(/\s+/g, ' ').trim();
        if (!displayName) displayName = clean;
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

        dishMap[clean] = {
          clean,
          name: displayName,
          count: 0,
          diet,
          price,
          category: cls,
          dates: new Set()
        };
      }

      dishMap[clean].count++;
      if (day.date) dishMap[clean].dates.add(day.date);
      if (dishMap[clean].price == null && price != null && price > 0) {
        dishMap[clean].price = price;
      }
    });
  });

  const sortedDishes = Object.values(dishMap)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((item, idx) => ({
      rank: idx + 1,
      clean: item.clean,
      name: item.name,
      count: item.count,
      diet: item.diet,
      price: item.price,
      category: item.category,
      dates: Array.from(item.dates).sort()
    }));

  const dishCounts = {};
  sortedDishes.forEach(d => {
    dishCounts[d.clean] = d.count;
  });

  const favSet = new Set(Array.isArray(favorites) ? favorites.map(f => cleanDishNameForFavorite(f)) : []);
  const matchedFavorites = sortedDishes.filter(d => favSet.has(d.clean));

  const veganPct = live.totalDishes > 0 ? Math.round((live.veganCount / live.totalDishes) * 100) : 0;
  const vegPct = live.totalDishes > 0 ? Math.round((live.vegetarianCount / live.totalDishes) * 100) : 0;
  const meatPct = Math.max(0, 100 - veganPct - vegPct);
  const avgPrice = priceCount > 0 ? Math.round((priceSum / priceCount) * 100) / 100 : null;

  return {
    version: 1,
    timeframe: {
      mode: timeframe,
      startDate,
      endDate,
      formattedRange,
      activeDaysCount
    },
    canteenScope,
    category,
    tariff,
    totalDishes: live.totalDishes,
    veganCount: live.veganCount,
    vegetarianCount: live.vegetarianCount,
    otherCount: live.otherCount,
    meatCount: live.otherCount,
    veganPct,
    vegetarianPct: vegPct,
    meatPct,
    priceSum: Math.round(priceSum * 100) / 100,
    priceCount,
    avgPrice,
    minPrice: live.minPrice,
    maxPrice: live.maxPrice,
    topDishes: sortedDishes.slice(0, 5),
    allDishes: sortedDishes,
    matchedFavorites,
    activeFavoritesCount: matchedFavorites.length,
    dishCounts,
    recordedDates: datesWithMeals
  };
}
