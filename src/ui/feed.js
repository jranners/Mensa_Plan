import { CANTEENS } from '../../data/canteens.js';
import {
  classifyDish,
  isDishExpired,
  getDishesServiceWindow,
  cleanDishNameForFavorite
} from '../lib/dish.js';
import {
  getCanteenKeyFromDish,
  formatDistance,
  normalizeCanteenOrder,
  getCanteenRouteUrl
} from '../lib/canteen-match.js';
import { getCanteenHoursForDay, getCanteenOpenStatus } from '../lib/hours.js';
import {
  getDayOfWeekFromIso,
  formatDateSelector,
  getBerlinHourDecimal,
  getAllowedMenuDates
} from '../lib/dates.js';
import {
  dishMatchesSearchAndQuickFilters,
  hasMatchingFavoriteOnDay
} from '../lib/filters.js';
import { isFavoriteV2 } from '../lib/storage.js';
import { escapeHtml } from '../lib/html.js';
import { getIconHTML } from './icons.js';
import {
  getDateHeaderHTML,
  renderSectionHeader,
  renderMainDishCard,
  renderCompactDishCard
} from './cards.js';

/**
 * Renders the announcement banner from `data/announcements.json`.
 * Keeps announcements visible for up to 14 days (or until `item.validUntil`).
 *
 * @param {Array} announcements
 * @param {object} state
 */
export function renderAnnouncements(announcements, state) {
  const container = document.getElementById('announcement-banner-container');
  if (!container) return;

  if (!Array.isArray(announcements) || announcements.length === 0) {
    container.innerHTML = '';
    return;
  }

  let dismissed = [];
  try {
    dismissed = JSON.parse(localStorage.getItem('kstw_dismissed_announcements') || '[]');
  } catch {
    dismissed = [];
  }

  const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
  const now = Date.now();
  const todayIso = state.todayIso || '';

  const visibleAnnouncements = announcements.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const id = `${item.topic}_${item.content}`.substring(0, 60);
    if (dismissed.includes(id)) return false;

    if (item.validUntil && todayIso && item.validUntil < todayIso) {
      return false;
    }

    if (item.dateFetched) {
      const fetchedTime = new Date(item.dateFetched).getTime();
      if (!isNaN(fetchedTime) && now - fetchedTime > MAX_AGE_MS) {
        return false;
      }
    }
    return true;
  });

  if (visibleAnnouncements.length === 0) {
    container.innerHTML = '';
    return;
  }

  const t = state.translations[state.lang];
  const locale = state.lang === 'en' ? 'en-GB' : 'de-DE';

  const html = visibleAnnouncements
    .map((item) => {
      const id = `${item.topic}_${item.content}`.substring(0, 60);
      let dateStr = '';
      if (item.dateFetched) {
        const d = new Date(item.dateFetched);
        if (!isNaN(d.getTime())) {
          const dayMonth = new Intl.DateTimeFormat(locale, {
            timeZone: 'Europe/Berlin',
            day: '2-digit',
            month: '2-digit'
          }).format(d);
          const time = new Intl.DateTimeFormat(locale, {
            timeZone: 'Europe/Berlin',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).format(d);
          dateStr = `${t.announcementAsOf} ${dayMonth}, ${time}${t.announcementTimeSuffix}`;
        }
      }

      return `
        <div class="bg-amber-50 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl p-4 shadow-sm flex items-start gap-3.5 mb-2 relative transition-all">
          <div class="p-2 bg-amber-500/10 dark:bg-amber-400/10 rounded-xl text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
            <span class="text-[20px] flex items-center">${getIconHTML('campaign')}</span>
          </div>
          <div class="flex-1 min-w-0 pr-6">
            <div class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mb-1">
              <h4 class="font-headline font-bold text-sm text-amber-950 dark:text-amber-200 leading-snug">
                ${escapeHtml(item.topic)}
              </h4>
              ${dateStr ? `<span class="text-[10px] text-amber-700/70 dark:text-amber-400/60 font-medium whitespace-nowrap">${escapeHtml(dateStr)}</span>` : ''}
            </div>
            <p class="font-body-md text-xs text-amber-900/90 dark:text-amber-200/80 leading-relaxed whitespace-pre-line">
              ${escapeHtml(item.content)}
            </p>
          </div>
          <button type="button" data-action="dismiss-announcement" data-id="${escapeHtml(id)}" aria-label="${escapeHtml(t.closeBtn)}" class="absolute top-3 right-3 p-1.5 text-amber-700/60 hover:text-amber-950 dark:text-amber-400/60 dark:hover:text-amber-200 rounded-full hover:bg-amber-500/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
            <span class="text-[16px] flex items-center">${getIconHTML('close')}</span>
          </button>
        </div>
      `;
    })
    .join('');

  container.innerHTML = html;
}

/**
 * Renders the offline / stale cache warning banner.
 *
 * @param {object} state
 */
export function renderOfflineBanner(state) {
  const container = document.getElementById('offline-banner-container');
  if (!container) return;

  if (!state.isOffline) {
    container.innerHTML = '';
    return;
  }

  const t = state.translations[state.lang];
  let subtitle = t.offlineCachedHint;
  if (state.cacheTimestamp) {
    const d = new Date(state.cacheTimestamp);
    if (!isNaN(d.getTime())) {
      const locale = state.lang === 'en' ? 'en-GB' : 'de-DE';
      const timeStr = new Intl.DateTimeFormat(locale, {
        timeZone: 'Europe/Berlin',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(d);
      subtitle = `${t.offlineCachedAt} ${timeStr}${t.hoursSuffix}`;
    }
  }

  container.innerHTML = `
    <div role="status" aria-live="polite" class="bg-slate-800/95 dark:bg-slate-900/95 text-white border border-white/10 rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <span class="text-amber-400 text-[18px] flex-shrink-0 flex items-center">${getIconHTML('cloud_off')}</span>
        <div class="min-w-0">
          <p class="font-headline font-bold text-xs text-white truncate">${escapeHtml(t.offlineBannerTitle)}</p>
          <p class="text-[11px] text-slate-300 truncate">${escapeHtml(subtitle)}</p>
        </div>
      </div>
      <button type="button" data-action="retry-fetch" class="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white whitespace-nowrap transition-colors cursor-pointer flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
        ${escapeHtml(t.offlineRetryBtn)}
      </button>
    </div>
  `;
}

/**
 * Renders loading skeleton cards in `#main-feed`.
 */
export function renderSkeletons() {
  const feed = document.getElementById('main-feed');
  if (!feed) return;
  let html = '';
  for (let i = 0; i < 4; i++) {
    html += `
      <div class="bg-white dark:bg-[#122338] rounded-2xl p-inset-card shadow-sm border border-black/[0.04] dark:border-white/[0.08] flex flex-col gap-3 mb-4">
        <div class="flex justify-between">
          <div class="w-24 h-5 skeleton"></div>
          <div class="w-16 h-6 skeleton"></div>
        </div>
        <div class="w-3/4 h-6 skeleton mt-1"></div>
        <div class="w-1/2 h-4 skeleton"></div>
        <div class="w-full h-px bg-black/[0.04] dark:bg-white/[0.08] my-1"></div>
        <div class="flex justify-between items-center">
          <div class="w-20 h-4 skeleton"></div>
          <div class="w-16 h-3 skeleton"></div>
        </div>
      </div>
    `;
  }
  feed.innerHTML = html;
}

/**
 * Renders an error state in `#main-feed`.
 *
 * @param {string} msg
 * @param {object} state
 */
export function renderError(msg, state) {
  const feed = document.getElementById('main-feed');
  if (!feed) return;
  const t = state.translations[state.lang];
  feed.innerHTML = `
    <div role="alert" class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 text-center my-4">
      <span class="text-red-500 text-4xl mb-2 flex justify-center">${getIconHTML('error_outline')}</span>
      <p class="font-headline font-bold text-red-900 dark:text-red-400 text-lg mb-1">${escapeHtml(t.oops)}</p>
      <p class="font-body-md text-red-700 dark:text-red-300 text-sm">${escapeHtml(msg)}</p>
    </div>
  `;
}

/**
 * Renders the horizontal segmented date selector bar.
 * Only displays the favorite star (`★`) on days where a favorite dish matches
 * the user's selected canteens and active filters (`hasMatchingFavoriteOnDay`).
 *
 * @param {object} state
 */
export function renderDateSelector(state) {
  const container = document.getElementById('date-selector-container');
  if (!container) return;

  if (!state.menuData || state.menuData.length === 0) {
    container.innerHTML = '';
    return;
  }

  const validDays = getAllowedMenuDates(state.menuData, state.todayIso);

  container.innerHTML = validDays
    .map((day) => {
      const isSelected = day.date === state.activeDate;
      const dObj = formatDateSelector(day.date, state.todayIso, state.lang);
      const hasFav = hasMatchingFavoriteOnDay(day, state, CANTEENS, isFavoriteV2);

      const baseClasses =
        'flex-1 min-w-[65px] py-2 px-2 rounded-lg text-center transition-all flex flex-col items-center justify-center relative select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge';
      const stateClasses = isSelected
        ? 'bg-primary dark:bg-price-badge text-on-primary dark:text-primary font-label-md shadow-xs font-bold scale-[1.02]'
        : 'text-on-surface-variant dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 font-body-sm';

      const favStar = hasFav
        ? `<span class="text-[9px] leading-none ${isSelected ? 'text-amber-300 dark:text-rose-600' : 'text-rose-500 dark:text-rose-400'}" title="Favorit verfügbar">★</span>`
        : '';

      return `
        <button type="button" data-action="select-date" data-date="${escapeHtml(day.date)}" aria-pressed="${isSelected ? 'true' : 'false'}" class="${baseClasses} ${stateClasses}">
          <span class="text-[11px] uppercase tracking-wider opacity-80 flex items-center gap-0.5">${escapeHtml(dObj.dayName)}${favStar}</span>
          <span class="text-xs font-bold mt-0.5 whitespace-nowrap">${escapeHtml(dObj.dayNum)}</span>
        </button>
      `;
    })
    .join('');

  const todayBtn = document.getElementById('today-btn');
  if (todayBtn) {
    const todayHasMenu = validDays.some((d) => d.date === state.todayIso);
    const shouldShowTodayBtn = todayHasMenu && state.activeDate !== state.todayIso;
    todayBtn.classList.toggle('hidden', !shouldShowTodayBtn);
  }
}

/**
 * Renders the 3-way dietary filter segmented control (`Alle`, `Vegetarisch`, `Vegan`).
 *
 * @param {object} state
 */
export function renderDietToggle(state) {
  const container = document.getElementById('diet-toggle-container');
  if (!container) return;
  const t = state.translations[state.lang];

  const options = [
    { key: 'all', label: t.all, icon: '' },
    { key: 'vegetarian', label: t.vegetarian, icon: '🧀' },
    { key: 'vegan', label: t.vegan, icon: '🌱' }
  ];

  container.innerHTML = options
    .map((opt) => {
      const isSelected = state.diet === opt.key;
      const base =
        'flex-1 py-1.5 px-2 rounded-lg font-label-md text-label-md transition-all text-center flex items-center justify-center gap-1 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge';
      const active = isSelected
        ? 'bg-primary dark:bg-price-badge text-on-primary dark:text-primary shadow-xs font-bold'
        : 'text-on-surface-variant dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 font-medium';

      return `
        <button type="button" data-action="select-diet" data-diet="${escapeHtml(opt.key)}" aria-pressed="${isSelected ? 'true' : 'false'}" class="${base} ${active}">
          ${opt.icon ? `<span>${opt.icon}</span>` : ''}
          <span class="truncate">${escapeHtml(opt.label)}</span>
        </button>
      `;
    })
    .join('');
}

/**
 * Renders Stage 3 Quick-Filter Chips (`★ Favoriten`, `💸 < 2,50 €`, `🚫🐖 Kein Schwein`)
 * and the instant dish search input.
 * Preserves input focus and cursor position when typing in `#dish-search-input`.
 *
 * @param {object} state
 */
export function renderQuickFilterBar(state) {
  const container = document.getElementById('quick-filter-container');
  if (!container) return;

  const t = state.translations[state.lang];
  const existingInput = document.getElementById('dish-search-input');
  const wasFocused = existingInput && document.activeElement === existingInput;
  const selectionStart = wasFocused ? existingInput.selectionStart : null;
  const selectionEnd = wasFocused ? existingInput.selectionEnd : null;

  const chipClass = (active) =>
    active
      ? 'bg-primary text-on-primary dark:bg-price-badge dark:text-primary border-primary dark:border-price-badge font-bold shadow-xs'
      : 'bg-white/85 dark:bg-[#122338]/90 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/10 font-semibold';

  container.innerHTML = `
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
      <div class="relative flex-1 min-w-0">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400 text-[15px] flex items-center pointer-events-none">
          ${getIconHTML('search')}
        </span>
        <input
          id="dish-search-input"
          type="search"
          value="${escapeHtml(state.searchQuery || '')}"
          placeholder="${escapeHtml(t.searchPlaceholder)}"
          aria-label="${escapeHtml(t.searchPlaceholder)}"
          class="w-full pl-9 pr-8 py-2 rounded-xl bg-white/85 dark:bg-[#122338]/90 border border-slate-200/80 dark:border-white/[0.08] text-base sm:text-xs font-medium text-text-heading dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-price-badge"
        />
        ${
          state.searchQuery
            ? `<button type="button" data-action="clear-search" aria-label="${escapeHtml(t.closeBtn)}" class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center cursor-pointer">
                <span class="text-[13px] flex items-center">${getIconHTML('close')}</span>
              </button>`
            : ''
        }
      </div>
      <div class="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
        <button
          type="button"
          data-action="quick-filter-toggle"
          data-filter="favoritesOnly"
          aria-pressed="${state.favoritesOnly ? 'true' : 'false'}"
          class="px-3 py-1.5 min-h-[32px] rounded-xl border text-xs whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${chipClass(Boolean(state.favoritesOnly))}"
        >
          ${escapeHtml(t.quickFilterFavorites)}
        </button>
        <button
          type="button"
          data-action="quick-filter-toggle"
          data-filter="under250"
          aria-pressed="${state.under250 ? 'true' : 'false'}"
          class="px-3 py-1.5 min-h-[32px] rounded-xl border text-xs whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${chipClass(Boolean(state.under250))}"
        >
          ${escapeHtml(t.quickFilterBudget)}
        </button>
        <button
          type="button"
          data-action="quick-filter-toggle"
          data-filter="excludePork"
          aria-pressed="${state.excludePork ? 'true' : 'false'}"
          class="px-3 py-1.5 min-h-[32px] rounded-xl border text-xs whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${chipClass(Boolean(state.excludePork))}"
        >
          ${escapeHtml(t.quickFilterNoPork)}
        </button>
      </div>
    </div>
  `;

  if (wasFocused) {
    const newInput = document.getElementById('dish-search-input');
    if (newInput) {
      newInput.focus();
      if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
        try {
          newInput.setSelectionRange(selectionStart, selectionEnd);
        } catch {
          // Ignore on unsupported input types
        }
      }
    }
  }
}

/**
 * Renders the main feed of canteens and categorized dishes for `dayData`.
 *
 * @param {object} dayData
 * @param {object} state
 */
export function renderCanteenMenu(dayData, state) {
  const feed = document.getElementById('main-feed');
  const activeDateContainer = document.getElementById('active-date-container');
  if (!feed) return;

  const t = state.translations[state.lang];

  if (activeDateContainer) {
    activeDateContainer.innerHTML = getDateHeaderHTML(state.activeDate, state);
  }

  if (!dayData || !dayData.dishes || dayData.dishes.length === 0) {
    feed.innerHTML = `
      <div class="bg-slate-50 dark:bg-[#122338] rounded-2xl p-8 text-center my-4 border border-black/[0.04] dark:border-white/[0.08]">
        <span class="text-on-surface-variant dark:text-slate-500 text-4xl mb-2 flex justify-center">${getIconHTML('restaurant_menu')}</span>
        <p class="font-headline font-bold text-text-heading dark:text-white text-base">${escapeHtml(t.noDishesTitle)}</p>
        <p class="font-body-md text-on-surface-variant dark:text-slate-400 text-sm mt-1">${escapeHtml(t.noDishesDesc)}</p>
      </div>
    `;
    return;
  }

  let htmlContent = '';
  let totalVisibleDishes = 0;

  const isViewingToday = state.activeDate === state.todayIso;
  const isPastDay = Boolean(state.activeDate && state.todayIso && state.activeDate < state.todayIso);
  const currentDecimalHour = getBerlinHourDecimal();
  const activeDayOfWeek = getDayOfWeekFromIso(state.activeDate);

  // Ordered Canteens (Mensen always before Bistros) & Route Overview Bar
  const orderedCanteens = normalizeCanteenOrder(state.selectedCanteens, CANTEENS);

  let routeOverviewBarHTML = '';
  if (orderedCanteens.length > 0) {
    const hasDistances = Object.keys(state.canteenDistancesKm || {}).length > 0;
    const locationBtnHTML = !hasDistances
      ? `
        <button
          type="button"
          data-action="request-user-location"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-primary text-on-primary dark:bg-price-badge dark:text-primary shadow-xs cursor-pointer flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
        >
          <span class="text-[13px] flex items-center">${getIconHTML('near_me')}</span>
          <span>${escapeHtml(t.enableDistanceBtn || '📍 Entfernungen berechnen')}</span>
        </button>
      `
      : '';

    const routeChipsHTML = orderedCanteens
      .map((cKey) => {
        const c = CANTEENS[cKey];
        if (!c) return '';
        const distKm = state.canteenDistancesKm?.[cKey];
        const distStr = distKm != null ? formatDistance(distKm, state.lang) : '';
        const shortName = c.name.replace(/^Mensa\s+/i, '');
        const isNearestMensa = cKey === state.nearestMensaKey && c.type === 'mensa';
        const routeUrl = getCanteenRouteUrl(c);
        if (!routeUrl) return '';

        const chipClass = isNearestMensa
          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700 font-bold shadow-xs'
          : 'bg-white/80 dark:bg-[#122338] text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#182c44] border border-black/[0.06] dark:border-white/[0.08] font-medium';

        return `
          <a
            href="${escapeHtml(routeUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            title="${escapeHtml(t.routeWalkingLabel || 'Route zu Fuß')} (${escapeHtml(c.name)})"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition-all flex-shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${chipClass}"
          >
            <span>📍 ${escapeHtml(shortName)}${distStr ? ` · ${escapeHtml(distStr)}` : ''}${isNearestMensa ? ` (${escapeHtml(t.nearestMensaBadge || 'Nächste')})` : ''} ↗</span>
          </a>
        `;
      })
      .join('');

    routeOverviewBarHTML = `
      <div class="mb-4 p-2 rounded-2xl bg-slate-100/80 dark:bg-[#0b1926]/90 border border-black/[0.04] dark:border-white/[0.06]">
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          ${locationBtnHTML}
          ${routeChipsHTML}
        </div>
      </div>
    `;
  }

  orderedCanteens.forEach((canteenKey) => {
    const canteen = CANTEENS[canteenKey];
    if (!canteen) return;
    const canteenRank = orderedCanteens.indexOf(canteenKey) + 1;

    const allCanteenDishes = dayData.dishes.filter((dish) =>
      getCanteenKeyFromDish(dish, canteenKey, canteen)
    );

    const serviceWindow = getDishesServiceWindow(allCanteenDishes, state.lang);
    const dayHours = getCanteenHoursForDay(canteenKey, activeDayOfWeek, canteen, state.lang);

    let cDishes = allCanteenDishes.filter((dish) =>
      dishMatchesSearchAndQuickFilters(dish, {
        diet: state.diet,
        allergies: state.allergies,
        excludePork: state.excludePork,
        under250: state.under250,
        favoritesOnly: state.favoritesOnly,
        isFavoriteFn: isFavoriteV2,
        tariff: state.tariff,
        searchQuery: state.searchQuery
      })
    );

    const seenNames = new Set();
    cDishes = cDishes.filter((dish) => {
      const cleanName = cleanDishNameForFavorite(dish);
      if (seenNames.has(cleanName)) return false;
      seenNames.add(cleanName);
      return true;
    });

    let hoursBadgeHTML = '';
    const displayHours = dayHours || serviceWindow;
    if (displayHours && displayHours.isOpenToday !== false) {
      const hoursText = displayHours.formatted || `${displayHours.label || ''}${t.hoursSuffix}`;
      if (isViewingToday) {
        const status = getCanteenOpenStatus(displayHours, currentDecimalHour);
        const effectiveEndHour = Math.max(
          displayHours.endHour || 0,
          serviceWindow ? serviceWindow.endHour : 0
        );
        if (status === 'open') {
          hoursBadgeHTML = `
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>${escapeHtml(t.statusOpen)} · ${escapeHtml(hoursText)}</span>
            </span>
          `;
        } else if (status === 'closing-soon') {
          hoursBadgeHTML = `
            <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 shadow-xs">
              <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>${escapeHtml(t.statusClosingSoon)} · ${escapeHtml(hoursText)}</span>
            </span>
          `;
        } else {
          const isEnded = currentDecimalHour >= effectiveEndHour;
          const endedSuffix = isEnded
            ? ` · ${escapeHtml(t.dishTimeEnded || (state.lang === 'de' ? 'Beendet' : 'Ended'))}`
            : '';
          hoursBadgeHTML = `
            <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              ${getIconHTML('schedule', 'text-[13px] opacity-75')}
              <span>${escapeHtml(hoursText)}${endedSuffix}</span>
            </span>
          `;
        }
      } else {
        hoursBadgeHTML = `
          <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 text-slate-600 border border-slate-200/80 dark:bg-[#122338] dark:text-slate-300 dark:border-white/10 shadow-xs">
            ${getIconHTML('schedule', 'text-[13px] text-primary-container dark:text-price-badge')}
            <span>${escapeHtml(hoursText)}</span>
          </span>
        `;
      }
    }

    const distKm = state.canteenDistancesKm?.[canteenKey];
    const distStr = distKm != null ? formatDistance(distKm, state.lang) : '';
    const routeUrl = getCanteenRouteUrl(canteen);

    let routeBadgeHTML = '';
    if (routeUrl) {
      if (distStr) {
        routeBadgeHTML = `
          <a
            href="${escapeHtml(routeUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            title="${escapeHtml(t.routeWalkingLabel || 'Route zu Fuß')}"
            class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 dark:text-blue-300 dark:border-blue-800/60 shadow-xs transition-colors"
          >
            <span class="text-[13px] flex items-center">${getIconHTML('location_on')}</span>
            <span>${escapeHtml(distStr)} · Route ↗</span>
          </a>
        `;
      } else {
        routeBadgeHTML = `
          <a
            href="${escapeHtml(routeUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            title="${escapeHtml(t.routeWalkingLabel || 'Route zu Fuß')}"
            class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 shadow-xs transition-colors"
          >
            <span class="text-[13px] flex items-center">${getIconHTML('location_on')}</span>
            <span>Route ↗</span>
          </a>
        `;
      }
    }

    let sectionBodyHTML = '';
    let sharePlanBtnHTML = '';

    if (cDishes.length > 0) {
      totalVisibleDishes += cDishes.length;

      const sections = {
        main: [],
        meisterwerk: [],
        buffet: [],
        side: [],
        dessert: []
      };

      cDishes.forEach((dish) => {
        const cat = classifyDish(dish);
        if (sections[cat]) {
          sections[cat].push(dish);
        } else {
          sections.main.push(dish);
        }
      });

      const sortFavoritesFirst = (arr) => {
        arr.sort((a, b) => {
          const aFav = isFavoriteV2(cleanDishNameForFavorite(a)) ? 1 : 0;
          const bFav = isFavoriteV2(cleanDishNameForFavorite(b)) ? 1 : 0;
          return bFav - aFav;
        });
      };
      Object.values(sections).forEach(sortFavoritesFirst);

      let canteenGridHTML = '';

      if (sections.main.length > 0) {
        canteenGridHTML += renderSectionHeader('main', sections.main.length, state);
        canteenGridHTML += sections.main
          .map((d) =>
            renderMainDishCard(
              d,
              !isPastDay && isViewingToday && isDishExpired(d, currentDecimalHour),
              state,
              canteenKey,
              sections.side
            )
          )
          .join('');
      }

      if (sections.meisterwerk.length > 0) {
        canteenGridHTML += renderSectionHeader('meisterwerk', sections.meisterwerk.length, state);
        canteenGridHTML += sections.meisterwerk
          .map((d) =>
            renderMainDishCard(
              d,
              !isPastDay && isViewingToday && isDishExpired(d, currentDecimalHour),
              state,
              canteenKey,
              sections.side
            )
          )
          .join('');
      }

      if (sections.buffet.length > 0) {
        canteenGridHTML += renderSectionHeader('buffet', sections.buffet.length, state);
        canteenGridHTML += sections.buffet
          .map((d) =>
            renderMainDishCard(
              d,
              !isPastDay && isViewingToday && isDishExpired(d, currentDecimalHour),
              state,
              canteenKey,
              sections.side
            )
          )
          .join('');
      }

      const renderExpandableCompactSection = (sectionKey, dishesArr) => {
        if (dishesArr.length === 0) return '';
        let out = renderSectionHeader(sectionKey, dishesArr.length, state);
        out += `<div class="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">`;
        out += dishesArr
          .map((d, idx) => {
            const isUnavail = !isPastDay && isViewingToday && isDishExpired(d, currentDecimalHour);
            const card = renderCompactDishCard(d, isUnavail, state, canteenKey);
            if (idx < 3) return card;
            return `<div class="hidden" data-extra-item="${escapeHtml(canteenKey)}-${escapeHtml(sectionKey)}">${card}</div>`;
          })
          .join('');
        out += `</div>`;

        if (dishesArr.length > 3) {
          const extraCount = dishesArr.length - 3;
          out += `
            <div class="col-span-full flex justify-center mt-1">
              <button
                type="button"
                data-action="toggle-extra"
                data-target="${escapeHtml(canteenKey)}-${escapeHtml(sectionKey)}"
                data-count="${extraCount}"
                data-expanded="false"
                aria-expanded="false"
                class="text-xs font-bold text-primary dark:text-price-badge bg-white/80 dark:bg-[#182c44] hover:bg-white dark:hover:bg-[#1f3856] px-4 py-1.5 rounded-full border border-slate-200/80 dark:border-white/10 shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
              >
                <span class="toggle-extra-text">+ ${extraCount} ${escapeHtml(t.showMore)}</span>
                <span class="toggle-extra-icon flex items-center text-[14px]">${getIconHTML('expand_more')}</span>
              </button>
            </div>
          `;
        }
        return out;
      };

      canteenGridHTML += renderExpandableCompactSection('side', sections.side);
      canteenGridHTML += renderExpandableCompactSection('dessert', sections.dessert);

      sharePlanBtnHTML = `
        <button
          type="button"
          data-action="share-day-plan"
          data-canteen-key="${escapeHtml(canteenKey)}"
          aria-label="${escapeHtml(t.shareDayPlanBtn)} (${escapeHtml(canteen.name)})"
          title="${escapeHtml(t.shareDayPlanBtn)}"
          class="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 min-h-[28px] rounded-full bg-white/85 hover:bg-white text-primary border border-slate-200/80 dark:bg-[#122338] dark:hover:bg-[#182c44] dark:text-price-badge dark:border-white/10 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
        >
          <span class="text-[13px] flex items-center">${getIconHTML('share')}</span>
          <span class="hidden sm:inline">${escapeHtml(t.shareDayPlanBtn)}</span>
        </button>
      `;

      sectionBodyHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          ${canteenGridHTML}
        </div>
      `;
    } else {
      const isFilteredOut = allCanteenDishes.length > 0;
      const emptyIcon = isFilteredOut ? 'filter_alt_off' : 'info';
      const emptyMessage = isFilteredOut
        ? t.canteenNoFilterMatches.replace('{count}', String(allCanteenDishes.length))
        : canteen.type === 'bistro'
          ? t.canteenNoDishesBistro
          : t.canteenNoDishesMensa;

      sectionBodyHTML = `
        <div class="bg-slate-50/90 dark:bg-[#122338]/75 rounded-2xl px-4 py-3.5 border border-black/[0.04] dark:border-white/[0.06] flex items-center gap-2.5 text-xs text-on-surface-variant dark:text-slate-400">
          <span class="text-base flex items-center text-slate-400 dark:text-slate-500 flex-shrink-0">${getIconHTML(emptyIcon)}</span>
          <span>${escapeHtml(emptyMessage)}</span>
        </div>
      `;
    }

    htmlContent += `
      <section class="mb-8" data-canteen-section="${escapeHtml(canteenKey)}">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
          <div class="flex items-center gap-2 flex-wrap">
            ${orderedCanteens.length > 1 ? `<span class="w-5 h-5 rounded-md bg-primary/10 dark:bg-price-badge/15 text-primary dark:text-price-badge font-bold text-[11px] flex items-center justify-center flex-shrink-0">#${canteenRank}</span>` : ''}
            <h2 class="font-headline text-lg font-bold text-text-heading dark:text-white tracking-tight">${escapeHtml(canteen.name)}</h2>
            ${routeBadgeHTML}
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            ${hoursBadgeHTML}
            ${sharePlanBtnHTML}
          </div>
        </div>
        ${sectionBodyHTML}
      </section>
    `;
  });

  if (totalVisibleDishes === 0 && orderedCanteens.length === 0) {
    const emptyDesc = isViewingToday ? t.allCanteensClosedToday : t.noMatchesDesc;
    const emptyIcon = isViewingToday ? 'schedule' : 'filter_alt_off';
    feed.innerHTML = `
      ${routeOverviewBarHTML}
      <div class="bg-slate-50 dark:bg-[#122338] rounded-2xl p-8 text-center my-4 border border-black/[0.04] dark:border-white/[0.08]">
        <span class="text-on-surface-variant dark:text-slate-500 text-4xl mb-2 flex justify-center">${getIconHTML(emptyIcon)}</span>
        <p class="font-headline font-bold text-text-heading dark:text-white text-base">${escapeHtml(t.noMatchesTitle)}</p>
        <p class="font-body-md text-on-surface-variant dark:text-slate-400 text-sm mt-1">${escapeHtml(emptyDesc)}</p>
      </div>
    `;
  } else {
    feed.innerHTML = routeOverviewBarHTML + htmlContent;
  }
}
