import { getDishDietType } from './diet.js';
import { getDishPrice, cleanDishNameForFavorite } from './dish.js';

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
    priceSum: 0,
    priceCount: 0,
    minPrice: null,
    maxPrice: null,
    dishCounts: {},
    recordedDates: []
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
 * Computes live instant stats for currently loaded days.
 * Used for instant display and when historical data is fresh.
 *
 * @param {Array<{ date: string, dishes: Array }>} menuData
 * @returns {object}
 */
export function computeLiveMenuStats(menuData) {
  const live = getInitialStats();
  if (!Array.isArray(menuData)) return live;

  menuData.forEach(day => {
    if (!day || !Array.isArray(day.dishes)) return;
    day.dishes.forEach(dish => {
      if (!dish) return;
      live.totalDishes++;

      const diet = getDishDietType(dish);
      if (diet === 'vegan') live.veganCount++;
      else if (diet === 'vegetarian') live.vegetarianCount++;
      else live.otherCount++;

      const price = getDishPrice(dish, 'student');
      if (price != null && price > 0) {
        live.priceSum += price;
        live.priceCount++;
        if (live.minPrice == null || price < live.minPrice) live.minPrice = price;
        if (live.maxPrice == null || price > live.maxPrice) live.maxPrice = price;
      }

      const cleanName = cleanDishNameForFavorite(dish);
      if (cleanName) {
        live.dishCounts[cleanName] = (live.dishCounts[cleanName] || 0) + 1;
      }
    });
  });

  const topDishes = Object.entries(live.dishCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const avgPrice = live.priceCount > 0 ? live.priceSum / live.priceCount : null;

  return {
    ...live,
    meatCount: live.otherCount,
    avgPrice,
    topDishes
  };
}
