import { CANTEENS } from '../../data/canteens.js';
import {
  classifyDish,
  getDishPrice,
  formatPrice,
  detectIncludedSides,
  parseDishServingTime,
  extractDishCounter,
  getDishDisplayName,
  getDishComponentsList,
  cleanDishNameForFavorite
} from '../lib/dish.js';
import { getDishDietType } from '../lib/diet.js';
import { getDishAllergens, shouldExcludeDish } from '../lib/allergens.js';
import { getCanteenKeyFromDish } from '../lib/canteen-match.js';
import { formatDateSelector } from '../lib/dates.js';
import { escapeHtml } from '../lib/html.js';
import { getIconHTML } from './icons.js';
import { showToast, copyTextToClipboard } from './toast.js';

/**
 * Pure calculation for "Mein Tablett" (Baukasten-Kombinator):
 * Computes total price for active tariff, automatically discounts included side dishes
 * when a main dish includes free sides (e.g. pre-Sept 2026 or explicit "inkl. Beilage"),
 * and aggregates the union of all allergen codes across the tray.
 *
 * @param {Array<{ key: string, dish: object, canteenKey: string, mealName: string }>} trayItems
 * @param {string} [tariff='student']
 * @param {string} [activeDate='']
 * @returns {{
 *   items: Array<{ key: string, dish: object, canteenKey: string, mealName: string, rawPrice: number, effectivePrice: number, isDiscountedSide: boolean, category: string }>,
 *   totalPrice: number,
 *   rawTotal: number,
 *   freeSidesAvailable: number,
 *   freeSidesUsed: number,
 *   unionAllergens: string[]
 * }}
 */
export function computeTraySummary(trayItems = [], tariff = 'student', activeDate = '') {
  if (!Array.isArray(trayItems) || trayItems.length === 0) {
    return {
      items: [],
      totalPrice: 0,
      rawTotal: 0,
      freeSidesAvailable: 0,
      freeSidesUsed: 0,
      unionAllergens: []
    };
  }

  let freeSidesAvailable = 0;
  const allergenSet = new Set();

  const annotated = trayItems.map((entry) => {
    const dish = entry.dish || {};
    const category = classifyDish(dish);
    const rawPrice = getDishPrice(dish, tariff) ?? 0;

    if (category === 'main' || category === 'meisterwerk') {
      const incCount = detectIncludedSides(dish, activeDate);
      if (incCount > 0) {
        freeSidesAvailable += incCount;
      }
    }

    const codes = getDishAllergens(dish);
    for (const code of codes) {
      allergenSet.add(code);
    }

    return {
      ...entry,
      category,
      rawPrice,
      effectivePrice: rawPrice,
      isDiscountedSide: false
    };
  });

  // Discount up to `freeSidesAvailable` side dishes (highest-priced sides first)
  let freeSidesUsed = 0;
  if (freeSidesAvailable > 0) {
    const sideIndices = annotated
      .map((item, idx) => ({ idx, category: item.category, rawPrice: item.rawPrice }))
      .filter((x) => x.category === 'side')
      .sort((a, b) => b.rawPrice - a.rawPrice);

    for (const s of sideIndices) {
      if (freeSidesUsed < freeSidesAvailable) {
        annotated[s.idx].effectivePrice = 0;
        annotated[s.idx].isDiscountedSide = true;
        freeSidesUsed++;
      }
    }
  }

  const rawTotal = annotated.reduce((acc, item) => acc + item.rawPrice, 0);
  const totalPrice = annotated.reduce((acc, item) => acc + item.effectivePrice, 0);
  const unionAllergens = Array.from(allergenSet).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  return {
    items: annotated,
    totalPrice: Math.round(totalPrice * 100) / 100,
    rawTotal: Math.round(rawTotal * 100) / 100,
    freeSidesAvailable,
    freeSidesUsed,
    unionAllergens
  };
}

/**
 * Toggles a dish on the user's tray (`state.tray`) and re-renders the floating tray bar.
 *
 * @param {object} state
 * @param {string} dishKey
 * @param {object} dish
 * @param {string} canteenKey
 * @param {string} mealName
 */
export function toggleTrayDish(state, dishKey, dish, canteenKey, mealName) {
  if (!Array.isArray(state.tray)) state.tray = [];
  const existingIdx = state.tray.findIndex((item) => item.key === dishKey);
  if (existingIdx >= 0) {
    state.tray.splice(existingIdx, 1);
  } else {
    state.tray.push({
      key: dishKey,
      dish,
      canteenKey,
      mealName: mealName || getDishDisplayName(dish, state.lang)
    });
  }
  renderTrayBar(state);
}

/**
 * Clears all items from `state.tray` and hides the tray bar.
 *
 * @param {object} state
 */
export function clearTray(state) {
  state.tray = [];
  state.trayExpanded = false;
  renderTrayBar(state);
}

/**
 * Renders the floating "Mein Tablett" combinator bar at the bottom of the viewport.
 *
 * @param {object} state
 */
export function renderTrayBar(state) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('tray-bar-container');
  if (!container) return;

  const trayItems = Array.isArray(state.tray) ? state.tray : [];
  if (trayItems.length === 0) {
    container.innerHTML = '';
    return;
  }

  const t = state.translations[state.lang];
  const summary = computeTraySummary(trayItems, state.tariff, state.activeDate);
  const isExpanded = Boolean(state.trayExpanded);

  const itemsListHTML = summary.items
    .map((item) => {
      const priceStr = item.isDiscountedSide
        ? `<span class="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">${escapeHtml(t.trayIncludedSide)}</span>`
        : `<span class="font-bold text-xs text-text-heading dark:text-white">${formatPrice(item.effectivePrice)}</span>`;
      return `
        <div class="flex items-center justify-between gap-2 py-1.5 border-b border-black/[0.05] dark:border-white/[0.06] last:border-0">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-text-heading dark:text-slate-100 truncate">${escapeHtml(item.mealName)}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${priceStr}
            <button
              type="button"
              data-action="tray-remove-item"
              data-dish-key="${escapeHtml(item.key)}"
              aria-label="${escapeHtml(t.trayRemoveAria)}: ${escapeHtml(item.mealName)}"
              class="w-7 h-7 rounded-full hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
            >
              <span class="text-[14px] flex items-center">${getIconHTML('close')}</span>
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  const allergensLineHTML =
    summary.unionAllergens.length > 0
      ? `<div class="mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span>${escapeHtml(t.allergensLabel)} <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(summary.unionAllergens.join(', '))}</strong></span>
        </div>`
      : '';

  container.innerHTML = `
    <aside
      id="tray-bar"
      aria-label="${escapeHtml(t.trayTitle)}"
      class="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md md:max-w-lg bg-white/95 dark:bg-[#122338]/95 backdrop-blur-md rounded-2xl border border-primary/15 dark:border-price-badge/30 shadow-2xl px-4 py-3 transition-all"
    >
      ${
        isExpanded
          ? `
        <div class="mb-2.5 max-h-48 overflow-y-auto pr-1 hide-scrollbar">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-extrabold uppercase tracking-wider text-primary dark:text-price-badge flex items-center gap-1.5">
              <span class="text-[15px] flex items-center">${getIconHTML('tray')}</span>
              ${escapeHtml(t.trayTitle)} (${summary.items.length})
            </span>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                data-action="tray-share"
                class="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 dark:bg-white/10 dark:hover:bg-white/15 text-[11px] font-bold text-primary dark:text-white flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
              >
                <span class="text-[13px] flex items-center">${getIconHTML('share')}</span>
                ${escapeHtml(t.trayShareBtn)}
              </button>
              <button
                type="button"
                data-action="tray-clear"
                class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[11px] font-bold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
              >
                ${escapeHtml(t.trayClearBtn)}
              </button>
            </div>
          </div>
          ${itemsListHTML}
          ${allergensLineHTML}
        </div>
      `
          : ''
      }
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          data-action="tray-expand-toggle"
          aria-expanded="${isExpanded ? 'true' : 'false'}"
          class="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge rounded-lg"
        >
          <span class="w-8 h-8 rounded-xl bg-primary text-price-badge dark:bg-price-badge dark:text-primary font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
            ${summary.items.length}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="font-headline font-bold text-sm text-text-heading dark:text-white truncate">${escapeHtml(t.trayTitle)}</span>
              <span class="text-slate-400 dark:text-slate-400 text-[14px] flex items-center transition-transform ${isExpanded ? 'rotate-180' : ''}">${getIconHTML('expand_more')}</span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              ${summary.items.map((i) => i.mealName).join(' + ')}
            </p>
          </div>
        </button>
        <div class="flex items-center gap-2 shrink-0">
          <span class="bg-price-badge text-primary font-extrabold text-sm px-3 py-1.5 rounded-xl shadow-xs">
            ${formatPrice(summary.totalPrice)}
          </span>
          ${
            !isExpanded
              ? `
            <button
              type="button"
              data-action="tray-clear"
              aria-label="${escapeHtml(t.trayClearBtn)}"
              title="${escapeHtml(t.trayClearBtn)}"
              class="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
            >
              <span class="text-[16px] flex items-center">${getIconHTML('close')}</span>
            </button>
          `
              : ''
          }
        </div>
      </div>
    </aside>
  `;
}

/**
 * Shares or copies the user's current tray summary.
 *
 * @param {object} state
 */
export async function shareTraySummary(state) {
  const trayItems = Array.isArray(state.tray) ? state.tray : [];
  if (trayItems.length === 0) return;
  const t = state.translations[state.lang];
  const summary = computeTraySummary(trayItems, state.tariff, state.activeDate);
  const dateObj = formatDateSelector(state.activeDate, state.todayIso, state.lang);
  const lines = summary.items.map((item) => {
    const p = item.isDiscountedSide ? t.trayIncludedSide : formatPrice(item.effectivePrice);
    return `• ${item.mealName} (${p})`;
  });
  const text = `🍽️ ${t.trayTitle} (${dateObj.dayName}, ${dateObj.dayNum}):\n${lines.join('\n')}\n∑ ${formatPrice(summary.totalPrice)}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: t.trayTitle, text });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  await copyTextToClipboard(text, state);
}

/**
 * Formats and shares a canteen's daily menu plan ("Mensa-Treff" Day-Plan Share).
 *
 * @param {object} state
 * @param {string} canteenKey
 */
export async function shareCanteenDayPlan(state, canteenKey) {
  const canteen = CANTEENS[canteenKey];
  if (!canteen || !Array.isArray(state.menuData)) return;

  const dayData = state.menuData.find((d) => d.date === state.activeDate);
  if (!dayData || !Array.isArray(dayData.dishes)) return;

  const matchingDishes = dayData.dishes.filter((dish) => {
    if (!getCanteenKeyFromDish(dish, canteenKey, canteen)) return false;
    const cat = classifyDish(dish);
    if (cat !== 'main' && cat !== 'meisterwerk') return false;
    if (state.diet !== 'all') {
      const dType = getDishDietType(dish);
      if (state.diet === 'vegan' && dType !== 'vegan') return false;
      if (state.diet === 'vegetarian' && dType !== 'vegan' && dType !== 'vegetarian') return false;
    }
    if (shouldExcludeDish(dish, state.allergies)) return false;
    return true;
  });

  if (matchingDishes.length === 0) return;

  const seenNames = new Set();
  const bulletLines = [];
  for (const dish of matchingDishes) {
    const cleanName = cleanDishNameForFavorite(dish);
    if (seenNames.has(cleanName)) continue;
    seenNames.add(cleanName);

    const name = getDishDisplayName(dish, state.lang);
    const dType = getDishDietType(dish);
    const emoji = dType === 'vegan' ? '🌱' : dType === 'vegetarian' ? '🧀' : '🍖';
    const price = getDishPrice(dish, state.tariff);
    const priceStr = price != null ? ` (${formatPrice(price)})` : '';
    bulletLines.push(`• ${emoji} ${name}${priceStr}`);
  }

  const dateObj = formatDateSelector(state.activeDate, state.todayIso, state.lang);
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('canteen', canteenKey);
  url.searchParams.set('date', state.activeDate);

  const shareText = `🍽️ ${canteen.name} – ${dateObj.dayName}, ${dateObj.dayNum}:\n${bulletLines.join('\n')}\n🔗 ${url.toString()}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `${canteen.name} (${dateObj.dayNum})`, text: shareText });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  await copyTextToClipboard(shareText, state);
}

/**
 * Pure helper generating RFC 5545 `.ics` calendar file content for a dish on a given ISO date.
 *
 * @param {object} dish
 * @param {string} isoDate
 * @param {string} canteenKey
 * @param {object} state
 * @returns {string}
 */
export function generateDishIcsContent(dish, isoDate, canteenKey, state) {
  const lang = state?.lang || 'de';
  const tariff = state?.tariff || 'student';
  const canteen = CANTEENS[canteenKey] || { name: canteenKey || 'KStW Mensa' };
  const mealName = getDishDisplayName(dish, lang);
  const components = getDishComponentsList(dish, mealName, lang);
  const counter = extractDishCounter(dish, canteenKey);
  const price = getDishPrice(dish, tariff);
  const priceStr = price != null ? formatPrice(price) : '';

  const servingTime = parseDishServingTime(dish);
  const startHour = servingTime ? Math.floor(servingTime.startHour) : 12;
  const startMin = servingTime ? Math.round((servingTime.startHour % 1) * 60) : 0;
  const endHour = servingTime ? Math.min(Math.floor(servingTime.endHour), startHour + 1) : 13;
  const endMin = servingTime ? Math.round((servingTime.endHour % 1) * 60) : 0;

  const dateCompact = String(isoDate || '').replace(/-/g, '');
  const pad2 = (n) => String(n).padStart(2, '0');
  const dtStart = `${dateCompact}T${pad2(startHour)}${pad2(startMin)}00`;
  const dtEnd = `${dateCompact}T${pad2(endHour)}${pad2(endMin)}00`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const locationParts = [canteen.name];
  if (counter) locationParts.push(counter);
  const location = locationParts.join(' – ');

  const descParts = [];
  if (components.length > 0) descParts.push(components.join(', '));
  if (priceStr) descParts.push(`Preis: ${priceStr}`);
  const description = descParts.join(' | ').replace(/\r?\n/g, '\\n');

  const escapeIcs = (str) => String(str || '').replace(/([,;\\])/g, '\\$1');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KStW Mensaplan PWA//DE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:kstw-${dateCompact}-${dish.id || 'dish'}@mensaplan.local`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Europe/Berlin:${dtStart}`,
    `DTEND;TZID=Europe/Berlin:${dtEnd}`,
    `SUMMARY:${escapeIcs(`🍽️ ${mealName} (${canteen.name})`)}`,
    `LOCATION:${escapeIcs(location)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Triggers a client-side `.ics` download for a dish so users can add a Mensa lunch reminder.
 *
 * @param {object} dish
 * @param {string} isoDate
 * @param {string} canteenKey
 * @param {object} state
 */
export function exportDishToCalendar(dish, isoDate, canteenKey, state) {
  if (typeof document === 'undefined') return;
  const icsContent = generateDishIcsContent(dish, isoDate, canteenKey, state);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mensa-${isoDate || 'termin'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const t = state.translations[state.lang];
  showToast(t.exportCalendarAria, 'calendar_add', { closeLabel: t.closeBtn });
}
