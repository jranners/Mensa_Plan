import { getDishDietType } from './diet.js';
import {
  getDishPrice,
  cleanDishNameForFavorite,
  classifyDish,
  stripAllergenCodes,
  cleanDPName,
  detectIncludedSides,
  SIDE_PRICES_BY_TARIFF
} from './dish.js';
import { escapeHtml } from './html.js';
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
    priceHistory: [],
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
    allTimeData = null,
    canteenScope = 'all',
    selectedCanteens = [],
    canteensMap = null,
    category = 'main',
    tariff = 'student',
    favorites = [],
    todayIso = getBerlinTodayDate()
  } = options;

  const live = getInitialStats();

  // Special branch: All-Time mode with pre-aggregated historical database
  if (timeframe === 'all-time' && allTimeData && Array.isArray(allTimeData.dishes)) {
    const startDate = allTimeData.startDate || '2026-01-22';
    const endDate = allTimeData.endDate || todayIso;
    const activeDaysCount = allTimeData.openingDaysCount || 0;
    const formattedRange = formatDateRange(startDate, endDate);

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
      if (canteenScope === 'selected' && Array.isArray(selectedCanteens) && selectedCanteens.length > 0) {
        effectiveCount = 0;
        selectedCanteens.forEach(cKey => {
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

      const price = dish.price;
      if (price != null && price > 0) {
        priceSum += price * effectiveCount;
        priceCount += effectiveCount;
        if (live.minPrice == null || price < live.minPrice) live.minPrice = price;
        if (live.maxPrice == null || price > live.maxPrice) live.maxPrice = price;
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
        dates: item.dates
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
        mode: 'all-time',
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
      recordedDates: [startDate, endDate],
      priceHistory: (allTimeData && Array.isArray(allTimeData.monthlyPriceHistory)) ? allTimeData.monthlyPriceHistory : []
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
    recordedDates: datesWithMeals,
    priceHistory: (allTimeData && Array.isArray(allTimeData.monthlyPriceHistory))
      ? allTimeData.monthlyPriceHistory
      : computeLivePriceHistory(filteredDays, tariff, selectedCanteens, canteensMap, canteenScope)
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

      if (canteenScope === 'selected' && Array.isArray(selectedCanteens) && selectedCanteens.length > 0 && canteensMap) {
        const matches = selectedCanteens.some(cKey => getCanteenKeyFromDish(dish, cKey, canteensMap[cKey]));
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
      <text x="${(padLeft - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" font-size="8.5" fill="currentColor" opacity="0.6" text-anchor="end" font-weight="600">${p.toFixed(2).replace('.', ',')}€</text>
    `;
  }).join('');

  const xLabels = priceHistory.map((d, i) => {
    const x = getX(i);
    const isCurrentActive = activeMonth && (d.month === activeMonth || d.label === activeMonth);
    const fillClass = isCurrentActive ? 'font-bold fill-primary-container dark:fill-price-badge opacity-100' : 'fill-currentColor opacity-65';
    return `<text x="${x.toFixed(1)}" y="${(height - 8).toFixed(1)}" font-size="9" class="${fillClass}" text-anchor="middle">${escapeHtml(d.label || d.month)}</text>`;
  }).join('');

  let transitionMarker = '';
  const sepIdx = priceHistory.findIndex(d => d.month === '2026-09');
  if (sepIdx !== -1) {
    const sepX = getX(sepIdx);
    const transNote = t.statsChartTransitionNote || "⚡ Sep: Umstellung";
    transitionMarker = `
      <line x1="${sepX.toFixed(1)}" y1="${padTop}" x2="${sepX.toFixed(1)}" y2="${(padTop + chartH).toFixed(1)}" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.75" />
      <text x="${sepX.toFixed(1)}" y="${(padTop - 5).toFixed(1)}" font-size="7.5" fill="#f59e0b" text-anchor="middle" font-weight="700">${escapeHtml(transNote)}</text>
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

  function buildDots(points, color, dietLabel) {
    return points.map(p => {
      const isCurrent = activeMonth && (p.item.month === activeMonth || p.item.label === activeMonth);
      const r = isCurrent ? 5 : 3.5;
      const sw = isCurrent ? 2.5 : 1.5;
      const formattedPrice = p.val.toFixed(2).replace('.', ',');
      return `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${color}" stroke="#ffffff" stroke-width="${sw}"
          class="cursor-pointer transition-transform hover:scale-125"
          data-action="select-chart-month" data-month="${p.item.month || p.item.label}"
          role="button"
          tabindex="0"
          aria-label="${dietLabel}: ${formattedPrice} € (${p.item.label})"
        >
          <title>${dietLabel} (${p.item.label}): ${formattedPrice} €</title>
        </circle>
      `;
    }).join('');
  }

  const veganPoints = getLineData('vegan');
  const vegPoints = getLineData('vegetarian');
  const meatPoints = getLineData('meat');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto text-slate-700 dark:text-slate-300 select-none overflow-visible" role="img" aria-label="Preisentwicklung">
      ${gridLines}
      ${transitionMarker}
      <!-- Lines -->
      ${veganPoints.length > 1 ? `<path d="${buildPath(veganPoints)}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      ${vegPoints.length > 1 ? `<path d="${buildPath(vegPoints)}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      ${meatPoints.length > 1 ? `<path d="${buildPath(meatPoints)}" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      <!-- Interactive Dots -->
      ${buildDots(veganPoints, '#10b981', 'Vegan')}
      ${buildDots(vegPoints, '#f59e0b', 'Vegetarisch')}
      ${buildDots(meatPoints, '#f43f5e', 'Fleisch & Fisch')}
      <!-- X-Labels -->
      ${xLabels}
    </svg>
  `;
}

