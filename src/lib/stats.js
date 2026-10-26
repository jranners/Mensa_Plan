import { CANTEENS } from '../../data/canteens.js';
import { getDishDietType, getDishMeatIcons, dishContainsPork } from './diet.js';
import { evaluateDishAllergies } from './allergens.js';
import {
  getDishPrice,
  cleanDishNameForFavorite,
  classifyDish,
  stripAllergenCodes,
  cleanDPName,
  detectIncludedSides,
  extractDishCounter,
  getDishDisplayName,
  SIDE_PRICES_BY_TARIFF
} from './dish.js';
import { escapeHtml } from './html.js';
import { getCanteenKeyFromDish } from './canteen-match.js';
import {
  getBerlinTodayDate,
  parseIsoParts,
  formatDateRange,
  getDayOfWeekFromIso
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
    veganPct: 0,
    vegetarianPct: 0,
    meatPct: 0,
    priceSum: 0,
    priceCount: 0,
    minPrice: null,
    maxPrice: null,
    avgPrice: null,
    speciesCounts: { poultry: 0, beef: 0, fish: 0, pork: 0, neuland: 0 },
    priceBuckets: { under2: 0, from2to3: 0, from3to4: 0, over4: 0 },
    cheapestDishes: [],
    mostExpensiveDishes: [],
    personalMatch: { compatibleCount: 0, compatiblePct: 0, personalAvgPrice: null },
    weekdayBreakdown: [],
    canteenComparison: [],
    dishCounts: {},
    recordedDates: [],
    priceHistory: [],
    topDishes: [],
    allDishes: [],
    matchedFavorites: [],
    activeFavoritesCount: 0,
    dataTimestamp: null,
    timeframe: {
      mode: 'all',
      startDate: '',
      endDate: '',
      formattedRange: '',
      activeDaysCount: 0
    },
    dateRange: { start: '', end: '' },
    daysCount: 0,
    veganDishes: 0,
    vegetarianDishes: 0,
    meatDishes: 0
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
    stats.lastUpdated = getBerlinTodayDate();
    return saveStats(stats);
  }

  return stats;
}

function getAllTimeTariffRatio(monthlyPriceHistory, tariff) {
  if (!tariff || tariff === 'student') return 1;
  const targetKey = (tariff === 'guest' || tariff === 'external') ? 'guest' : 'employee';
  const fallbackRatio = targetKey === 'employee' ? 1.42 : 1.88;

  if (!Array.isArray(monthlyPriceHistory) || monthlyPriceHistory.length === 0) {
    return fallbackRatio;
  }

  const ratios = [];
  for (const m of monthlyPriceHistory) {
    const sRaw = m?.tariffs?.student?.raw;
    const tRaw = m?.tariffs?.[targetKey]?.raw;
    if (!sRaw || !tRaw) continue;
    for (const dietKey of ['vegan', 'vegetarian', 'meat']) {
      const sVal = sRaw[dietKey];
      const tVal = tRaw[dietKey];
      if (typeof sVal === 'number' && sVal > 0 && typeof tVal === 'number' && tVal > 0) {
        ratios.push(tVal / sVal);
      }
    }
  }

  if (ratios.length === 0) return fallbackRatio;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

/**
 * Computes live instant stats for loaded menu days with rich filtering options:
 * - timeframe ('all' | 'week' | 'all-time')
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
    allTimeData = null,
    canteenScope = 'all',
    selectedCanteens = [],
    canteensMap = null,
    category = 'main',
    tariff = 'student',
    favorites = [],
    todayIso = getBerlinTodayDate(),
    userDiet = 'all',
    userAllergies = [],
    excludePork = false,
    isFavoriteFn = null
  } = options;

  const live = getInitialStats();
  const effectiveCanteensMap = canteensMap || CANTEENS;

  const effectiveCanteens =
    canteenScope === 'all'
      ? null
      : canteenScope === 'selected'
        ? (Array.isArray(selectedCanteens) && selectedCanteens.length > 0 ? selectedCanteens : null)
        : [canteenScope];

  const speciesCounts = { poultry: 0, beef: 0, fish: 0, pork: 0, neuland: 0 };
  const priceBuckets = { under2: 0, from2to3: 0, from3to4: 0, over4: 0 };
  let personalCompatibleCount = 0;
  let personalPriceSum = 0;
  let personalPriceCount = 0;

  // Special branch: All-Time mode with pre-aggregated historical database
  if (timeframe === 'all-time' && allTimeData && Array.isArray(allTimeData.dishes)) {
    const startDate = allTimeData.startDate || '2026-01-22';
    const endDate = allTimeData.endDate || todayIso;
    const activeDaysCount = allTimeData.openingDaysCount || 0;
    const formattedRange = formatDateRange(startDate, endDate);
    const tariffRatio = getAllTimeTariffRatio(allTimeData.monthlyPriceHistory, tariff);

    const dishMap = {};
    let priceSum = 0;
    let priceCount = 0;

    allTimeData.dishes.forEach(dish => {
      if (!dish) return;

      // Category filter
      const cls = dish.category || 'main';
      if (category === 'main') {
        if (cls !== 'main' && cls !== 'meisterwerk') return;
      } else if (category === 'side') {
        if (cls !== 'side') return;
      } else if (category === 'dessert') {
        if (cls !== 'dessert') return;
      }

      // Canteen scope filter
      let effectiveCount = dish.count || 0;
      if (effectiveCanteens) {
        effectiveCount = 0;
        effectiveCanteens.forEach(cKey => {
          if (dish.canteens && dish.canteens[cKey]) {
            effectiveCount += dish.canteens[cKey];
          }
        });
        if (effectiveCount === 0) return;
      }

      live.totalDishes += effectiveCount;
      const diet = dish.diet || 'all';
      if (diet === 'vegan') live.veganCount += effectiveCount;
      else if (diet === 'vegetarian') live.vegetarianCount += effectiveCount;
      else live.otherCount += effectiveCount;

      let price = dish.price;
      if (tariff === 'employee') {
        if (dish.priceEmployee != null && dish.priceEmployee > 0) {
          price = dish.priceEmployee;
        } else if (price != null && price > 0) {
          price = Math.round(price * tariffRatio * 100) / 100;
        }
      } else if (tariff === 'guest' || tariff === 'external') {
        if (dish.priceGuest != null && dish.priceGuest > 0) {
          price = dish.priceGuest;
        } else if (price != null && price > 0) {
          price = Math.round(price * tariffRatio * 100) / 100;
        }
      }

      if (price != null && price > 0) {
        priceSum += price * effectiveCount;
        priceCount += effectiveCount;
        if (live.minPrice == null || price < live.minPrice) live.minPrice = price;
        if (live.maxPrice == null || price > live.maxPrice) live.maxPrice = price;

        if (price < 2.0) priceBuckets.under2 += effectiveCount;
        else if (price < 3.0) priceBuckets.from2to3 += effectiveCount;
        else if (price < 4.0) priceBuckets.from3to4 += effectiveCount;
        else priceBuckets.over4 += effectiveCount;
      }

      // Species count
      if (Array.isArray(dish.species) && dish.species.length > 0) {
        dish.species.forEach(code => {
          if (code === 'G') speciesCounts.poultry += effectiveCount;
          else if (code === 'R') speciesCounts.beef += effectiveCount;
          else if (code === 'F') speciesCounts.fish += effectiveCount;
          else if (code === 'S') speciesCounts.pork += effectiveCount;
          else if (code === 'NL') speciesCounts.neuland += effectiveCount;
        });
      } else if (diet === 'all') {
        const dName = (dish.name || '').toLowerCase();
        if (/hähnchen|huhn|hühner|puten|geflügel|chicken|turkey/.test(dName)) speciesCounts.poultry += effectiveCount;
        else if (/rind|beef|kalb|rinder/.test(dName)) speciesCounts.beef += effectiveCount;
        else if (/fisch|lachs|forelle|seelachs|kabeljau|thunfisch|garnelen/.test(dName)) speciesCounts.fish += effectiveCount;
        else if (/schwein|pork|bacon|speck|bratwurst|currywurst|schinken/.test(dName)) speciesCounts.pork += effectiveCount;
      }

      // Personal match
      let isCompatible = true;
      if (userDiet === 'vegan' && diet !== 'vegan') {
        isCompatible = false;
      } else if (userDiet === 'vegetarian' && diet !== 'vegan' && diet !== 'vegetarian') {
        isCompatible = false;
      }
      if (isCompatible && excludePork) {
        const isPork = (Array.isArray(dish.species) && dish.species.includes('S')) ||
          /schwein|pork|bacon|speck|bratwurst|currywurst|schinken/i.test(dish.name || '');
        if (isPork) isCompatible = false;
      }
      if (isCompatible) {
        personalCompatibleCount += effectiveCount;
        if (price != null && price > 0) {
          personalPriceSum += price * effectiveCount;
          personalPriceCount += effectiveCount;
        }
      }

      dishMap[dish.clean] = {
        clean: dish.clean,
        name: dish.name,
        count: effectiveCount,
        diet,
        price,
        category: cls,
        dates: dish.lastSeen ? [dish.lastSeen] : []
      };
    });

    if (allTimeData.speciesBreakdown && speciesCounts.poultry === 0 && speciesCounts.beef === 0 && speciesCounts.fish === 0 && speciesCounts.pork === 0) {
      speciesCounts.poultry = allTimeData.speciesBreakdown.G || 0;
      speciesCounts.beef = allTimeData.speciesBreakdown.R || 0;
      speciesCounts.fish = allTimeData.speciesBreakdown.F || 0;
      speciesCounts.pork = allTimeData.speciesBreakdown.S || 0;
      speciesCounts.neuland = allTimeData.speciesBreakdown.NL || 0;
    }

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
        dates: item.dates,
        lastSeen: item.dates[item.dates.length - 1] || null
      }));

    const dishCounts = {};
    sortedDishes.forEach(d => {
      dishCounts[d.clean] = d.count;
    });

    const favSet = new Set(Array.isArray(favorites) ? favorites.map(f => cleanDishNameForFavorite(f)) : []);
    const checkFav = typeof isFavoriteFn === 'function'
      ? (cleanName) => Boolean(cleanName && isFavoriteFn(cleanName))
      : (cleanName) => Boolean(cleanName && favSet.has(cleanName));
    const matchedFavorites = sortedDishes.filter(d => checkFav(d.clean));

    const veganPct = live.totalDishes > 0 ? Math.round((live.veganCount / live.totalDishes) * 100) : 0;
    const vegPct = live.totalDishes > 0 ? Math.round((live.vegetarianCount / live.totalDishes) * 100) : 0;
    const meatPct = Math.max(0, 100 - veganPct - vegPct);
    const avgPrice = priceCount > 0 ? Math.round((priceSum / priceCount) * 100) / 100 : null;

    const pricedDishes = sortedDishes.filter(d => d.price != null && d.price > 0);
    const cheapestDishes = [...pricedDishes]
      .sort((a, b) => a.price - b.price || b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 3);
    const mostExpensiveDishes = [...pricedDishes]
      .sort((a, b) => b.price - a.price || b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 3);

    const personalMatch = {
      compatibleCount: personalCompatibleCount,
      compatiblePct: live.totalDishes > 0 ? Math.round((personalCompatibleCount / live.totalDishes) * 100) : 0,
      personalAvgPrice: personalPriceCount > 0 ? Math.round((personalPriceSum / personalPriceCount) * 100) / 100 : avgPrice
    };

    const dowLabels = {
      1: { de: 'Mo', en: 'Mon' },
      2: { de: 'Di', en: 'Tue' },
      3: { de: 'Mi', en: 'Wed' },
      4: { de: 'Do', en: 'Thu' },
      5: { de: 'Fr', en: 'Fri' }
    };
    const weekdayBreakdown = Array.isArray(allTimeData.weekdayStats)
      ? allTimeData.weekdayStats.map(ws => {
          let p = ws.avgPriceStudent;
          if (tariff === 'employee') {
            p = ws.avgPriceEmployee != null ? ws.avgPriceEmployee : (ws.avgPriceStudent ? Math.round(ws.avgPriceStudent * tariffRatio * 100) / 100 : null);
          } else if (tariff === 'guest' || tariff === 'external') {
            p = ws.avgPriceGuest != null ? ws.avgPriceGuest : (ws.avgPriceStudent ? Math.round(ws.avgPriceStudent * tariffRatio * 100) / 100 : null);
          }
          return {
            dow: ws.dow,
            labelDe: dowLabels[ws.dow]?.de || String(ws.dow),
            labelEn: dowLabels[ws.dow]?.en || String(ws.dow),
            count: ws.count,
            veganPct: ws.veganPct != null ? ws.veganPct : (ws.count > 0 ? Math.round(((ws.veganCount || 0) / ws.count) * 100) : 0),
            avgPrice: p
          };
        })
      : [1, 2, 3, 4, 5].map(d => ({ dow: d, labelDe: dowLabels[d].de, labelEn: dowLabels[d].en, count: 0, veganPct: 0, avgPrice: null }));

    let canteenComparison = Array.isArray(allTimeData.canteenStats)
      ? allTimeData.canteenStats.map(cs => {
          let p = cs.avgPriceStudent;
          if (tariff === 'employee') {
            p = cs.avgPriceEmployee != null ? cs.avgPriceEmployee : (cs.avgPriceStudent ? Math.round(cs.avgPriceStudent * tariffRatio * 100) / 100 : null);
          } else if (tariff === 'guest' || tariff === 'external') {
            p = cs.avgPriceGuest != null ? cs.avgPriceGuest : (cs.avgPriceStudent ? Math.round(cs.avgPriceStudent * tariffRatio * 100) / 100 : null);
          }
          return {
            key: cs.key,
            name: cs.name || (canteensMap?.[cs.key]?.name) || cs.key,
            totalDishes: cs.totalDishes || cs.mainDishes || 0,
            veganPct: cs.veganPct || 0,
            vegetarianPct: cs.vegetarianPct || 0,
            avgPrice: p,
            topDish: cs.topDish || ''
          };
        })
      : [];
    if (effectiveCanteens && effectiveCanteens.length > 0) {
      const effSet = new Set(effectiveCanteens);
      canteenComparison = canteenComparison.filter(c => effSet.has(c.key));
    }

    return {
      version: 1,
      timeframe: {
        mode: 'all-time',
        startDate,
        endDate,
        formattedRange,
        activeDaysCount
      },
      dateRange: { start: startDate, end: endDate },
      daysCount: activeDaysCount,
      veganDishes: live.veganCount,
      vegetarianDishes: live.vegetarianCount,
      meatDishes: live.otherCount,
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
      speciesCounts,
      priceBuckets,
      cheapestDishes,
      mostExpensiveDishes,
      personalMatch,
      weekdayBreakdown,
      canteenComparison,
      topDishes: sortedDishes.slice(0, 8),
      allDishes: sortedDishes,
      matchedFavorites,
      activeFavoritesCount: matchedFavorites.length,
      dishCounts,
      recordedDates: [startDate, endDate],
      priceHistory: (allTimeData && Array.isArray(allTimeData.monthlyPriceHistory)) ? allTimeData.monthlyPriceHistory : [],
      dataTimestamp: allTimeData?.generatedAt || null
    };
  }

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

  const weekdayBuckets = {
    1: { dow: 1, labelDe: 'Mo', labelEn: 'Mon', count: 0, veganCount: 0, priceSum: 0, priceCount: 0 },
    2: { dow: 2, labelDe: 'Di', labelEn: 'Tue', count: 0, veganCount: 0, priceSum: 0, priceCount: 0 },
    3: { dow: 3, labelDe: 'Mi', labelEn: 'Wed', count: 0, veganCount: 0, priceSum: 0, priceCount: 0 },
    4: { dow: 4, labelDe: 'Do', labelEn: 'Thu', count: 0, veganCount: 0, priceSum: 0, priceCount: 0 },
    5: { dow: 5, labelDe: 'Fr', labelEn: 'Fri', count: 0, veganCount: 0, priceSum: 0, priceCount: 0 }
  };

  const canteenStatsMap = {};
  if (effectiveCanteensMap) {
    const cKeysToTrack = effectiveCanteens || Object.keys(effectiveCanteensMap);
    cKeysToTrack.forEach(cKey => {
      canteenStatsMap[cKey] = {
        key: cKey,
        name: effectiveCanteensMap[cKey]?.name || cKey,
        totalDishes: 0,
        veganCount: 0,
        vegetarianCount: 0,
        priceSum: 0,
        priceCount: 0,
        dishCounts: {}
      };
    });
  }

  filteredDays.forEach(day => {
    if (!day || !Array.isArray(day.dishes)) return;
    const dow = getDayOfWeekFromIso(day.date);

    day.dishes.forEach(dish => {
      if (!dish) return;

      // Canteen scope filter
      if (effectiveCanteens) {
        if (!effectiveCanteensMap) return;
        const matches = effectiveCanteens.some(cKey => getCanteenKeyFromDish(dish, cKey, effectiveCanteensMap[cKey]));
        if (!matches) return;
      }

      // Category filter (default: 'main' includes mains & meisterwerk action meals)
      const cls = classifyDish(dish);
      if (category === 'main') {
        if (cls !== 'main' && cls !== 'meisterwerk') {
          // Warm Bistro dishes (sold per 100g, so classified as 'buffet') should still
          // populate `canteenStatsMap` for selected Bistros so they appear in `canteenComparison`.
          if (cls === 'buffet' && effectiveCanteensMap && !/buffet|salat/i.test(dish.name_de || '')) {
            const cKeysToTrack = effectiveCanteens || Object.keys(effectiveCanteensMap);
            const diet = getDishDietType(dish);
            const price = getDishPrice(dish, tariff);
            const cName = cleanDishNameForFavorite(dish);
            for (const cKey of cKeysToTrack) {
              const cObj = effectiveCanteensMap[cKey];
              if (cObj?.type === 'bistro' && getCanteenKeyFromDish(dish, cKey, cObj)) {
                const cs = canteenStatsMap[cKey];
                if (cs) {
                  cs.totalDishes++;
                  if (diet === 'vegan') cs.veganCount++;
                  else if (diet === 'vegetarian') cs.vegetarianCount++;
                  if (price != null && price > 0) {
                    cs.priceSum += price;
                    cs.priceCount++;
                  }
                  if (cName) {
                    cs.dishCounts[cName] = (cs.dishCounts[cName] || 0) + 1;
                  }
                }
              }
            }
          }
          return;
        }
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

        if (price < 2.0) priceBuckets.under2++;
        else if (price < 3.0) priceBuckets.from2to3++;
        else if (price < 4.0) priceBuckets.from3to4++;
        else priceBuckets.over4++;
      }

      // Species counts
      const meatIcons = getDishMeatIcons(dish);
      meatIcons.forEach(icon => {
        if (icon.code === 'G') speciesCounts.poultry++;
        else if (icon.code === 'R') speciesCounts.beef++;
        else if (icon.code === 'F') speciesCounts.fish++;
        else if (icon.code === 'S') speciesCounts.pork++;
        else if (icon.code === 'NL') speciesCounts.neuland++;
      });

      // Personal match
      let isCompatible = true;
      if (userDiet === 'vegan' && diet !== 'vegan') {
        isCompatible = false;
      } else if (userDiet === 'vegetarian' && diet !== 'vegan' && diet !== 'vegetarian') {
        isCompatible = false;
      }
      if (isCompatible && excludePork && dishContainsPork(dish)) {
        isCompatible = false;
      }
      if (isCompatible && Array.isArray(userAllergies) && userAllergies.length > 0) {
        const allergyEval = evaluateDishAllergies(dish, userAllergies);
        if (allergyEval.shouldExclude) {
          isCompatible = false;
        }
      }
      if (isCompatible) {
        personalCompatibleCount++;
        if (price != null && price > 0) {
          personalPriceSum += price;
          personalPriceCount++;
        }
      }

      // Weekday breakdown bucket
      if (weekdayBuckets[dow]) {
        weekdayBuckets[dow].count++;
        if (diet === 'vegan') weekdayBuckets[dow].veganCount++;
        if (price != null && price > 0) {
          weekdayBuckets[dow].priceSum += price;
          weekdayBuckets[dow].priceCount++;
        }
      }

      // Canteen comparison tracking
      if (effectiveCanteensMap) {
        const cKeysToTrack = effectiveCanteens || Object.keys(effectiveCanteensMap);
        for (const cKey of cKeysToTrack) {
          if (getCanteenKeyFromDish(dish, cKey, effectiveCanteensMap[cKey])) {
            const cs = canteenStatsMap[cKey];
            if (cs) {
              cs.totalDishes++;
              if (diet === 'vegan') cs.veganCount++;
              else if (diet === 'vegetarian') cs.vegetarianCount++;
              if (price != null && price > 0) {
                cs.priceSum += price;
                cs.priceCount++;
              }
              const cName = cleanDishNameForFavorite(dish);
              if (cName) {
                cs.dishCounts[cName] = (cs.dishCounts[cName] || 0) + 1;
              }
            }
          }
        }
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
    .map((item, idx) => {
      const datesArr = Array.from(item.dates).sort();
      return {
        rank: idx + 1,
        clean: item.clean,
        name: item.name,
        count: item.count,
        diet: item.diet,
        price: item.price,
        category: item.category,
        dates: datesArr,
        lastSeen: datesArr.length > 0 ? datesArr[datesArr.length - 1] : null
      };
    });

  const dishCounts = {};
  sortedDishes.forEach(d => {
    dishCounts[d.clean] = d.count;
  });

  const favSet = new Set(Array.isArray(favorites) ? favorites.map(f => cleanDishNameForFavorite(f)) : []);
  const checkFav = typeof isFavoriteFn === 'function'
    ? (cleanName) => Boolean(cleanName && isFavoriteFn(cleanName))
    : (cleanName) => Boolean(cleanName && favSet.has(cleanName));
  const matchedFavorites = sortedDishes.filter(d => checkFav(d.clean));

  const veganPct = live.totalDishes > 0 ? Math.round((live.veganCount / live.totalDishes) * 100) : 0;
  const vegPct = live.totalDishes > 0 ? Math.round((live.vegetarianCount / live.totalDishes) * 100) : 0;
  const meatPct = Math.max(0, 100 - veganPct - vegPct);
  const avgPrice = priceCount > 0 ? Math.round((priceSum / priceCount) * 100) / 100 : null;

  const pricedDishes = sortedDishes.filter(d => d.price != null && d.price > 0);
  const cheapestDishes = [...pricedDishes]
    .sort((a, b) => a.price - b.price || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3);
  const mostExpensiveDishes = [...pricedDishes]
    .sort((a, b) => b.price - a.price || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3);

  const personalMatch = {
    compatibleCount: personalCompatibleCount,
    compatiblePct: live.totalDishes > 0 ? Math.round((personalCompatibleCount / live.totalDishes) * 100) : 0,
    personalAvgPrice: personalPriceCount > 0 ? Math.round((personalPriceSum / personalPriceCount) * 100) / 100 : avgPrice
  };

  const weekdayBreakdown = [1, 2, 3, 4, 5].map(d => {
    const b = weekdayBuckets[d];
    return {
      dow: b.dow,
      labelDe: b.labelDe,
      labelEn: b.labelEn,
      count: b.count,
      veganPct: b.count > 0 ? Math.round((b.veganCount / b.count) * 100) : 0,
      avgPrice: b.priceCount > 0 ? Math.round((b.priceSum / b.priceCount) * 100) / 100 : null
    };
  });

  const canteenComparison = Object.values(canteenStatsMap)
    .filter(cs => cs.totalDishes > 0)
    .map(cs => {
      let topDish = '';
      let maxCount = 0;
      for (const [dClean, cnt] of Object.entries(cs.dishCounts)) {
        if (cnt > maxCount) {
          maxCount = cnt;
          topDish = dClean;
        }
      }
      if (topDish && dishMap[topDish]) {
        topDish = dishMap[topDish].name || topDish;
      }
      return {
        key: cs.key,
        name: cs.name,
        totalDishes: cs.totalDishes,
        veganPct: Math.round((cs.veganCount / cs.totalDishes) * 100),
        vegetarianPct: Math.round((cs.vegetarianCount / cs.totalDishes) * 100),
        avgPrice: cs.priceCount > 0 ? Math.round((cs.priceSum / cs.priceCount) * 100) / 100 : null,
        topDish
      };
    })
    .sort((a, b) => b.totalDishes - a.totalDishes);

  return {
    version: 1,
    timeframe: {
      mode: timeframe,
      startDate,
      endDate,
      formattedRange,
      activeDaysCount
    },
    dateRange: { start: startDate, end: endDate },
    daysCount: activeDaysCount,
    veganDishes: live.veganCount,
    vegetarianDishes: live.vegetarianCount,
    meatDishes: live.otherCount,
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
    speciesCounts,
    priceBuckets,
    cheapestDishes,
    mostExpensiveDishes,
    personalMatch,
    weekdayBreakdown,
    canteenComparison,
    topDishes: sortedDishes.slice(0, 8),
    allDishes: sortedDishes,
    matchedFavorites,
    activeFavoritesCount: matchedFavorites.length,
    dishCounts,
    recordedDates: datesWithMeals,
    priceHistory: computeLivePriceHistory(filteredDays, tariff, selectedCanteens, effectiveCanteensMap, canteenScope),
    dataTimestamp: allTimeData?.generatedAt || null
  };
}

/**
 * Computes price history from live loaded menu data.
 *
 * @param {Array<{ date: string, dishes: Array }>} menuData
 * @param {'student'|'employee'|'guest'|'external'} [tariff='student']
 * @param {string[]} [selectedCanteens=[]]
 * @param {object|null} [canteensMap=null]
 * @param {'all'|'selected'} [canteenScope='all']
 * @returns {Array<object>}
 */
export function computeLivePriceHistory(menuData, tariff = 'student', selectedCanteens = [], canteensMap = null, canteenScope = 'all') {
  if (!Array.isArray(menuData) || menuData.length === 0) return [];

  const effectiveCanteensMap = canteensMap || CANTEENS;
  const effectiveCanteens =
    canteenScope === 'all'
      ? null
      : canteenScope === 'selected'
        ? (Array.isArray(selectedCanteens) && selectedCanteens.length > 0 ? selectedCanteens : null)
        : [canteenScope];

  const dateBuckets = {};
  const sideCost = SIDE_PRICES_BY_TARIFF[tariff] || 0.70;

  menuData.forEach(day => {
    if (!day || !day.date || !Array.isArray(day.dishes)) return;
    const dateKey = day.date;
    if (!dateBuckets[dateKey]) {
      dateBuckets[dateKey] = {
        date: dateKey,
        vegan: [], veg: [], meat: [],
        normVegan: [], normVeg: [], normMeat: []
      };
    }

    day.dishes.forEach(dish => {
      const cls = classifyDish(dish);
      if (cls !== 'main' && cls !== 'meisterwerk') return;

      if (effectiveCanteens) {
        if (!effectiveCanteensMap) return;
        const matches = effectiveCanteens.some(cKey => getCanteenKeyFromDish(dish, cKey, effectiveCanteensMap[cKey]));
        if (!matches) return;
      }

      const p = getDishPrice(dish, tariff);
      if (p == null || p <= 0) return;

      const diet = getDishDietType(dish);
      const incSides = detectIncludedSides(dish, day.date);
      const missingSides = Math.max(0, 2 - incSides);
      const normP = Math.round((p + missingSides * sideCost) * 100) / 100;

      if (diet === 'vegan') {
        dateBuckets[dateKey].vegan.push(p);
        dateBuckets[dateKey].normVegan.push(normP);
      } else if (diet === 'vegetarian') {
        dateBuckets[dateKey].veg.push(p);
        dateBuckets[dateKey].normVeg.push(normP);
      } else {
        dateBuckets[dateKey].meat.push(p);
        dateBuckets[dateKey].normMeat.push(normP);
      }
    });
  });

  const avg = arr => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;

  return Object.keys(dateBuckets).sort().filter(k => {
    const b = dateBuckets[k];
    return b.vegan.length > 0 || b.veg.length > 0 || b.meat.length > 0;
  }).map(k => {
    const b = dateBuckets[k];
    const parts = k.split('-');
    const label = parts.length === 3 ? `${parts[2]}.${parts[1]}.` : k;
    return {
      month: k,
      label,
      tariffs: {
        [tariff]: {
          raw: {
            vegan: avg(b.vegan),
            vegetarian: avg(b.veg),
            meat: avg(b.meat)
          },
          normalized: {
            vegan: avg(b.normVegan),
            vegetarian: avg(b.normVeg),
            meat: avg(b.normMeat)
          },
          counts: {
            vegan: b.vegan.length,
            vegetarian: b.veg.length,
            meat: b.meat.length
          }
        }
      }
    };
  });
}

/**
 * Generates responsive SVG price trend chart markup.
 *
 * @param {Array<object>} priceHistory
 * @param {object} [options={}]
 * @returns {string}
 */
export function generatePriceChartSvg(priceHistory, options = {}) {
  const {
    tariff = 'student',
    mode = 'normalized',
    activeMonth = null,
    selectedPoint = null,
    t = {}
  } = options;

  if (!Array.isArray(priceHistory) || priceHistory.length === 0) {
    return '';
  }

  const width = 360;
  const height = 180;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 22;
  const padBottom = 26;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const effectiveTariff = (tariff === 'external') ? 'guest' : (tariff || 'student');
  const allValues = [];

  priceHistory.forEach(item => {
    const tData = (item.tariffs && item.tariffs[effectiveTariff]) ? item.tariffs[effectiveTariff] : (item.tariffs?.student || item);
    const priceObj = mode === 'raw' ? tData.raw : (tData.normalized || tData.raw);
    if (priceObj) {
      if (typeof priceObj.vegan === 'number' && priceObj.vegan > 0) allValues.push(priceObj.vegan);
      if (typeof priceObj.vegetarian === 'number' && priceObj.vegetarian > 0) allValues.push(priceObj.vegetarian);
      if (typeof priceObj.meat === 'number' && priceObj.meat > 0) allValues.push(priceObj.meat);
    }
  });

  let minVal = allValues.length ? Math.floor(Math.min(...allValues) * 2) / 2 : 1.5;
  let maxVal = allValues.length ? Math.ceil(Math.max(...allValues) * 2) / 2 : 4.5;
  if (maxVal - minVal < 1.0) {
    minVal = Math.max(0, minVal - 0.5);
    maxVal = maxVal + 0.5;
  }
  const priceRange = maxVal - minVal;

  const getX = index => padLeft + (priceHistory.length > 1 ? (index / (priceHistory.length - 1)) * chartW : chartW / 2);
  const getY = val => padTop + chartH - ((val - minVal) / priceRange) * chartH;

  const step = priceRange > 3.5 ? 1.0 : 0.5;
  const gridPrices = [];
  for (let p = Math.ceil(minVal / step) * step; p <= maxVal; p += step) {
    gridPrices.push(Math.round(p * 100) / 100);
  }

  const gridLines = gridPrices.map(p => {
    const y = getY(p);
    return `
      <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${(width - padRight).toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="3 3" />
      <text x="${(padLeft - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" font-size="9.5" fill="currentColor" opacity="0.6" text-anchor="end" font-weight="600">${p.toFixed(2).replace('.', ',')}€</text>
    `;
  }).join('');

  const xLabels = priceHistory.map((d, i) => {
    const x = getX(i);
    const isCurrentActive = activeMonth && (d.month === activeMonth || d.label === activeMonth);
    const fillClass = isCurrentActive ? 'font-bold fill-primary-container dark:fill-price-badge opacity-100' : 'fill-currentColor opacity-65';
    return `<text x="${x.toFixed(1)}" y="${(height - 8).toFixed(1)}" font-size="10" class="${fillClass}" text-anchor="middle">${escapeHtml(d.label || d.month)}</text>`;
  }).join('');

  let transitionMarker = '';
  const sepIdx = priceHistory.findIndex(d => d.month === '2026-09');
  if (sepIdx !== -1) {
    const sepX = getX(sepIdx);
    const transNote = t.statsChartTransitionNote || "⚡ Sep: Umstellung";
    transitionMarker = `
      <line x1="${sepX.toFixed(1)}" y1="${padTop}" x2="${sepX.toFixed(1)}" y2="${(padTop + chartH).toFixed(1)}" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.75" />
      <text x="${sepX.toFixed(1)}" y="${(padTop - 5).toFixed(1)}" font-size="9.5" fill="#f59e0b" text-anchor="middle" font-weight="700">${escapeHtml(transNote)}</text>
    `;
  }

  function getLineData(dietKey) {
    return priceHistory.map((d, i) => {
      const tData = (d.tariffs && d.tariffs[effectiveTariff]) ? d.tariffs[effectiveTariff] : (d.tariffs?.student || d);
      const priceObj = mode === 'raw' ? tData.raw : (tData.normalized || tData.raw);
      const val = priceObj ? priceObj[dietKey] : null;
      return { x: getX(i), y: val != null ? getY(val) : null, val, item: d };
    }).filter(p => p.val != null);
  }

  function buildPath(points) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  function buildDots(points, color, dietLabel, dietKey) {
    const escapedDietLabel = escapeHtml(dietLabel);
    return points.map(p => {
      const isCurrent = Boolean(
        (selectedPoint && selectedPoint.month === p.item.month && selectedPoint.diet === dietKey) ||
        (activeMonth && (p.item.month === activeMonth || p.item.label === activeMonth))
      );
      const r = isCurrent ? 6.5 : 4.5;
      const sw = isCurrent ? 2.5 : 1.5;
      const formattedPrice = p.val.toFixed(2).replace('.', ',');
      const escapedMonth = escapeHtml(p.item.month || p.item.label || '');
      const escapedLabel = escapeHtml(p.item.label || p.item.month || '');
      return `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${color}" stroke="#ffffff" stroke-width="${sw}"
          class="cursor-pointer transition-transform hover:scale-125"
          data-action="stats-chart-point" data-month="${escapedMonth}" data-diet="${escapeHtml(dietKey)}"
          role="button"
          tabindex="0"
          aria-label="${escapedDietLabel}: ${formattedPrice} € (${escapedLabel})"
        >
          <title>${escapedDietLabel} (${escapedLabel}): ${formattedPrice} €</title>
        </circle>
      `;
    }).join('');
  }

  const veganPoints = getLineData('vegan');
  const vegPoints = getLineData('vegetarian');
  const meatPoints = getLineData('meat');
  const chartTitle = escapeHtml(t.statsPriceChartTitle || t.statsChartTitle || 'Preisentwicklung');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto text-slate-700 dark:text-slate-300 select-none overflow-visible" role="group" aria-label="${chartTitle}">
      ${gridLines}
      ${transitionMarker}
      <!-- Lines -->
      ${veganPoints.length > 1 ? `<path d="${buildPath(veganPoints)}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      ${vegPoints.length > 1 ? `<path d="${buildPath(vegPoints)}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      ${meatPoints.length > 1 ? `<path d="${buildPath(meatPoints)}" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      <!-- Interactive Dots -->
      ${buildDots(veganPoints, '#10b981', t.statsVegan || 'Vegan', 'vegan')}
      ${buildDots(vegPoints, '#f59e0b', t.statsVegetarian || 'Vegetarisch', 'vegetarian')}
      ${buildDots(meatPoints, '#f43f5e', t.statsMeat || 'Fleisch & Fisch', 'meat')}
      <!-- X-Labels -->
      ${xLabels}
    </svg>
  `;
}

/**
 * Scans upcoming menuData across selectedCanteens for favorite dishes and computes
 * historical recurrence insights from allTimeData.
 *
 * @param {Array<{ date: string, dishes: Array }>} menuData
 * @param {object|null} allTimeData
 * @param {object} [options={}]
 * @returns {{
 *   upcomingHits: Array<{ date: string, dishName: string, price: number|null, canteenKey: string, canteenName: string, counter: string, diet: string }>,
 *   recurrenceInsights: Array<{ dishName: string, count: number, avgIntervalDays: number, lastSeen: string, diet: string }>
 * }}
 */
export function computeFavoritesRadar(menuData, allTimeData = null, options = {}) {
  const {
    favorites = [],
    isFavoriteFn = null,
    selectedCanteens = [],
    canteensMap = null,
    tariff = 'student',
    language = 'de',
    todayIso = null
  } = options;

  const favSet = new Set(Array.isArray(favorites) ? favorites.map(f => cleanDishNameForFavorite(f)).filter(Boolean) : []);
  const checkFav = typeof isFavoriteFn === 'function'
    ? (cleanName) => Boolean(cleanName && isFavoriteFn(cleanName))
    : (cleanName) => Boolean(cleanName && favSet.has(cleanName));

  const upcomingHits = [];
  if (Array.isArray(menuData) && menuData.length > 0) {
    const sortedDays = [...menuData]
      .filter(d => d && d.date && Array.isArray(d.dishes) && (!todayIso || d.date >= todayIso))
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const day of sortedDays) {
      if (canteensMap && typeof canteensMap === 'object') {
        const canteenKeys = (Array.isArray(selectedCanteens) && selectedCanteens.length > 0)
          ? selectedCanteens
          : Object.keys(canteensMap);

        for (const cKey of canteenKeys) {
          const canteen = canteensMap[cKey];
          if (!canteen) continue;
          const seenClean = new Set();

          for (const dish of day.dishes) {
            if (!dish) continue;
            if (!getCanteenKeyFromDish(dish, cKey, canteen)) continue;
            const cleanName = cleanDishNameForFavorite(dish);
            if (!cleanName || seenClean.has(cleanName)) continue;
            if (checkFav(cleanName)) {
              seenClean.add(cleanName);
              upcomingHits.push({
                date: day.date,
                dishName: getDishDisplayName(dish, language) || dish.name_de || cleanName,
                price: getDishPrice(dish, tariff),
                canteenKey: cKey,
                canteenName: canteen.name || cKey,
                counter: extractDishCounter(dish, cKey),
                diet: getDishDietType(dish)
              });
            }
          }
        }
      } else {
        const seenClean = new Set();
        const fallbackCanteenKey = (Array.isArray(selectedCanteens) && selectedCanteens[0]) || '';
        for (const dish of day.dishes) {
          if (!dish) continue;
          const cleanName = cleanDishNameForFavorite(dish);
          if (!cleanName || seenClean.has(cleanName)) continue;
          if (checkFav(cleanName)) {
            seenClean.add(cleanName);
            upcomingHits.push({
              date: day.date,
              dishName: getDishDisplayName(dish, language) || dish.name_de || cleanName,
              price: getDishPrice(dish, tariff),
              canteenKey: fallbackCanteenKey,
              canteenName: fallbackCanteenKey,
              counter: extractDishCounter(dish, fallbackCanteenKey),
              diet: getDishDietType(dish)
            });
          }
        }
      }
    }
  }

  const recurrenceInsights = [];
  if (allTimeData && Array.isArray(allTimeData.dishes)) {
    const openingDays = allTimeData.openingDaysCount || 200;
    for (const d of allTimeData.dishes) {
      if (!d || !d.count || d.count <= 0) continue;
      const cleanName = d.clean || cleanDishNameForFavorite(d.name || '');
      if (checkFav(cleanName)) {
        recurrenceInsights.push({
          dishName: d.name || cleanName,
          count: d.count,
          avgIntervalDays: Math.max(1, Math.round(openingDays / d.count)),
          lastSeen: d.lastSeen || '',
          diet: d.diet || 'all'
        });
      }
    }
  }

  return { upcomingHits, recurrenceInsights };
}

