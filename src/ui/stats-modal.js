import { CANTEENS } from '../../data/canteens.js';
import { formatPrice } from '../lib/dish.js';
import {
  computeLiveMenuStats,
  generatePriceChartSvg,
  computeFavoritesRadar
} from '../lib/stats.js';
import { getFavoritesV2, isFavoriteV2 } from '../lib/storage.js';
import { formatDateRange, formatDateSelector } from '../lib/dates.js';
import { trapFocus } from '../lib/a11y.js';
import { escapeHtml } from '../lib/html.js';
import { logger } from '../lib/logger.js';
import { getIconHTML } from './icons.js';
import { syncAppInertState } from './modals.js';

/**
 * Lazily fetches `data/stats_all_time.json` when the user selects the All-Time timeframe
 * or opens the statistics modal with favorites.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
export async function loadAllTimeStats(state) {
  if (state.allTimeStatsData || state.allTimeStatsLoading) return;
  state.allTimeStatsLoading = true;
  state.allTimeStatsError = false;
  renderStatsContent(state);

  try {
    const res = await fetch(`data/stats_all_time.json?v=1`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.allTimeStatsData = await res.json();
  } catch (err) {
    logger.warn('Failed to load all-time stats:', err);
    state.allTimeStatsError = true;
  } finally {
    state.allTimeStatsLoading = false;
    renderStatsContent(state);
  }
}

/**
 * Renders the contents of `#stats-modal-content`, including Stage 3 Feature 3:
 * 14-Day Favorites Radar & Recurrence Predictor.
 * Preserves keyboard focus on filter controls across re-renders.
 *
 * @param {object} state
 */
export function renderStatsContent(state) {
  const contentEl = document.getElementById('stats-modal-content');
  if (!contentEl) return;

  // Capture currently focused element inside #stats-modal-content to restore after re-render
  let focusedSelector = null;
  const activeEl = document.activeElement;
  if (activeEl && contentEl.contains(activeEl)) {
    const action = activeEl.getAttribute('data-action');
    if (action === 'stats-timeframe') {
      focusedSelector = `[data-action="stats-timeframe"][data-timeframe="${activeEl.getAttribute('data-timeframe')}"]`;
    } else if (action === 'stats-canteen-scope') {
      focusedSelector = `[data-action="stats-canteen-scope"][data-scope="${activeEl.getAttribute('data-scope')}"]`;
    } else if (action === 'stats-chart-mode') {
      focusedSelector = `[data-action="stats-chart-mode"][data-mode="${activeEl.getAttribute('data-mode')}"]`;
    } else if (action === 'stats-chart-point') {
      focusedSelector = `[data-action="stats-chart-point"][data-month="${activeEl.getAttribute('data-month')}"][data-diet="${activeEl.getAttribute('data-diet')}"]`;
    }
  }

  const t = state.translations[state.lang];
  const favorites = getFavoritesV2();
  const timeframe = state.statsFilterTimeframe || 'all';
  const canteenScope = state.statsFilterCanteen || 'selected';

  const tfBtnClass = (tf) =>
    timeframe === tf
      ? 'bg-primary text-on-primary dark:bg-price-badge dark:text-primary font-bold shadow-xs'
      : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 font-medium';

  const canteenOptions = [
    { key: 'selected', label: t.statsCanteenSelected },
    { key: 'all', label: t.statsCanteenAll },
    ...Object.entries(CANTEENS).map(([key, c]) => ({ key, label: c.name }))
  ];

  const filterBarHTML = `
    <div class="flex flex-col gap-2 bg-slate-50 dark:bg-[#122338] p-3 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsFilterTimeframe)}</span>
        <div class="flex bg-white dark:bg-[#0b1926] p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
          <button type="button" data-action="stats-timeframe" data-timeframe="week" aria-pressed="${timeframe === 'week' ? 'true' : 'false'}" class="px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${tfBtnClass('week')}">${escapeHtml(t.statsTimeframeWeek)}</button>
          <button type="button" data-action="stats-timeframe" data-timeframe="all" aria-pressed="${timeframe === 'all' ? 'true' : 'false'}" class="px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${tfBtnClass('all')}">${escapeHtml(t.statsTimeframe2Weeks)}</button>
          <button type="button" data-action="stats-timeframe" data-timeframe="all-time" aria-pressed="${timeframe === 'all-time' ? 'true' : 'false'}" class="px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${tfBtnClass('all-time')}">${escapeHtml(t.statsTimeframeAllTime)}</button>
        </div>
      </div>
      <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-black/[0.04] dark:border-white/[0.05]">
        <label for="stats-canteen-select" class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex-shrink-0">${escapeHtml(t.statsFilterCanteen)}</label>
        <select id="stats-canteen-select" class="bg-white dark:bg-[#0b1926] text-xs font-bold text-text-heading dark:text-white px-2.5 py-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] max-w-[210px] truncate cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-price-badge">
          ${canteenOptions.map((opt) => `<option value="${escapeHtml(opt.key)}" ${canteenScope === opt.key ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
        </select>
      </div>
    </div>
  `;

  if (timeframe === 'all-time' && state.allTimeStatsLoading) {
    contentEl.innerHTML = `
      ${filterBarHTML}
      <div class="py-10 text-center flex flex-col items-center gap-2">
        <div class="w-6 h-6 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs text-slate-500 dark:text-slate-400">Lade historische Speisepläne seit Jan. 2026…</p>
      </div>
    `;
    return;
  }

  if (timeframe === 'all-time' && state.allTimeStatsError) {
    contentEl.innerHTML = `
      ${filterBarHTML}
      <div class="py-6 text-center text-xs text-red-500 flex flex-col items-center gap-2">
        <p>${escapeHtml(t.statsLoadError)}</p>
        <button type="button" data-action="stats-retry-alltime" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">${escapeHtml(t.retryBtn)}</button>
      </div>
    `;
    return;
  }

  const liveStats = computeLiveMenuStats(state.menuData || [], {
    tariff: state.tariff,
    selectedCanteens: state.selectedCanteens,
    canteensMap: CANTEENS,
    canteenScope,
    timeframe,
    language: state.lang,
    allTimeData: state.allTimeStatsData
  });

  if (liveStats.totalDishes === 0 && favorites.length === 0) {
    contentEl.innerHTML = `
      ${filterBarHTML}
      <div class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        ${escapeHtml(t.statsEmpty)}
      </div>
    `;
    return;
  }

  const rangeStr = formatDateRange(liveStats.dateRange.start, liveStats.dateRange.end);
  const daysWord = liveStats.daysCount === 1 ? t.statsDaySingular : t.statsDaysPlural;
  const periodLabel = rangeStr
    ? `${escapeHtml(t.statsCurrentPlan)} · ${escapeHtml(rangeStr)} (${liveStats.daysCount} ${escapeHtml(daysWord)})`
    : '';

  const avgFormatted = liveStats.avgPrice > 0 ? formatPrice(liveStats.avgPrice) : '–';
  const minMaxFormatted =
    liveStats.minPrice !== null && liveStats.maxPrice !== null
      ? `${formatPrice(liveStats.minPrice)} – ${formatPrice(liveStats.maxPrice)}`
      : '–';

  // Stage 3 Feature 3: 14-Day Favorites Radar & Recurrence Predictor
  let favoritesRadarHTML = '';
  if (favorites.length > 0) {
    const radar = computeFavoritesRadar(state.menuData || [], state.allTimeStatsData, {
      favorites,
      isFavoriteFn: isFavoriteV2,
      selectedCanteens: state.selectedCanteens,
      canteensMap: CANTEENS,
      tariff: state.tariff,
      language: state.lang,
      todayIso: state.todayIso
    });

    const upcomingItemsHTML =
      radar.upcomingHits.length > 0
        ? radar.upcomingHits
            .slice(0, 6)
            .map((hit) => {
              const dObj = formatDateSelector(hit.date, state.todayIso, state.lang);
              const priceBadge =
                hit.price != null
                  ? `<span class="bg-price-badge text-primary font-extrabold text-[10px] px-1.5 py-0.5 rounded">${formatPrice(hit.price)}</span>`
                  : '';
              return `
                <button
                  type="button"
                  data-action="radar-jump"
                  data-date="${escapeHtml(hit.date)}"
                  class="w-full flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-[#0b1926] hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
                >
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold text-text-heading dark:text-white truncate">${escapeHtml(hit.dishName)}</p>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      ${escapeHtml(dObj.dayName)}, ${escapeHtml(dObj.dayNum)} · ${escapeHtml(hit.canteenName)}${hit.counter ? ` (${escapeHtml(hit.counter)})` : ''}
                    </p>
                  </div>
                  ${priceBadge}
                </button>
              `;
            })
            .join('')
        : `<p class="text-[11px] text-slate-500 dark:text-slate-400 italic">${escapeHtml(t.favoritesRadarNoneUpcoming)}</p>`;

    const recurrenceHTML =
      radar.recurrenceInsights.length > 0
        ? `
          <div class="mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-800/40 flex flex-col gap-1">
            ${radar.recurrenceInsights
              .slice(0, 4)
              .map((ins) => {
                const cycleText = (t.favoritesRadarCycleAvg || 'Ø alle {days} Öffnungstage').replace(
                  '{days}',
                  String(ins.avgIntervalDays)
                );
                const lastSeenShort = ins.lastSeen
                  ? ins.lastSeen.split('-').reverse().slice(0, 2).join('.')
                  : '';
                const lastSeenText = lastSeenShort
                  ? ` · ${(t.favoritesRadarLastSeen || 'Zuletzt am {date}').replace('{date}', lastSeenShort)}`
                  : '';
                return `
                  <div class="flex items-center justify-between gap-2 text-[11px]">
                    <span class="font-semibold text-slate-700 dark:text-slate-200 truncate">${escapeHtml(ins.dishName)}</span>
                    <span class="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium whitespace-nowrap">${escapeHtml(cycleText)}${escapeHtml(lastSeenText)}</span>
                  </div>
                `;
              })
              .join('')}
          </div>
        `
        : '';

    favoritesRadarHTML = `
      <div class="bg-emerald-50/70 dark:bg-emerald-950/25 p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
            <span class="text-[14px] flex items-center">${getIconHTML('auto_awesome')}</span>
            ${escapeHtml(t.favoritesRadarTitle)}
          </h4>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
            ${radar.upcomingHits.length} ${escapeHtml(t.favoritesRadarUpcoming)}
          </span>
        </div>
        <div class="flex flex-col gap-1.5">
          ${upcomingItemsHTML}
        </div>
        ${recurrenceHTML}
      </div>
    `;
  }

  let topDishesHTML = '';
  if (liveStats.topDishes.length > 0) {
    const subtitle = timeframe === 'all-time' ? t.statsTopDishesAllTimeSub : t.statsTopDishesSubtitle;
    topDishesHTML = `
      <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <div class="flex items-baseline justify-between gap-2 mb-2.5">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsTopDishesTitle)}</h4>
          <span class="text-[10px] text-slate-400 dark:text-slate-400">${escapeHtml(subtitle)}</span>
        </div>
        <div class="flex flex-col gap-2">
          ${liveStats.topDishes
            .map((d, idx) => {
              const dietDot =
                d.diet === 'vegan'
                  ? '<span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Vegan"></span>'
                  : d.diet === 'vegetarian'
                    ? '<span class="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" title="Vegetarisch"></span>'
                    : '<span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Fleisch/Fisch"></span>';
              const priceBadge =
                d.price !== null
                  ? `<span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">${formatPrice(d.price)}</span>`
                  : '';
              const lastSeenInfo =
                timeframe === 'all-time' && d.lastSeen
                  ? `<span class="text-[10px] text-slate-400 dark:text-slate-400 whitespace-nowrap">${escapeHtml(t.statsLastSeen)}: ${escapeHtml(d.lastSeen.split('-').reverse().slice(0, 2).join('.'))}.</span>`
                  : '';
              return `
              <div class="flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-5 h-5 rounded-md bg-primary/10 dark:bg-price-badge/15 text-primary dark:text-price-badge font-bold text-[11px] flex items-center justify-center flex-shrink-0">${idx + 1}</span>
                  ${dietDot}
                  <span class="font-medium text-text-heading dark:text-slate-200 truncate">${escapeHtml(d.name)}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  ${lastSeenInfo}
                  ${priceBadge}
                  <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">${d.count}×</span>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  let priceChartSectionHTML = '';
  if (liveStats.priceHistory && liveStats.priceHistory.length > 0) {
    const chartMode = state.statsChartMode || 'normalized';
    const selectedPoint = state.statsSelectedPoint || null;
    const svgHTML = generatePriceChartSvg(liveStats.priceHistory, {
      mode: chartMode,
      tariff: state.tariff,
      selectedPoint,
      t
    });

    const modeBtnClass = (m) =>
      chartMode === m
        ? 'bg-primary text-on-primary dark:bg-price-badge dark:text-primary font-bold shadow-xs'
        : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 font-medium';

    let pointDetailsHTML = '';
    if (selectedPoint) {
      const pItem = liveStats.priceHistory.find((h) => h.month === selectedPoint.month);
      if (pItem) {
        const isPostReform = pItem.month >= '2026-09';
        const sideAddon =
          chartMode === 'normalized' && isPostReform
            ? state.tariff === 'employee'
              ? 1.15
              : state.tariff === 'guest' || state.tariff === 'external'
                ? 1.55
                : 0.9
            : 0;
        const dietMap = {
          vegan: {
            label: t.statsVegan,
            color: 'text-emerald-600 dark:text-emerald-400',
            val: pItem.veganAvg !== null ? pItem.veganAvg + sideAddon : null,
            count: pItem.veganCount
          },
          vegetarian: {
            label: t.statsVegetarian,
            color: 'text-teal-600 dark:text-teal-400',
            val: pItem.vegetarianAvg !== null ? pItem.vegetarianAvg + sideAddon : null,
            count: pItem.vegetarianCount
          },
          meat: {
            label: t.statsMeat,
            color: 'text-amber-600 dark:text-amber-400',
            val: pItem.meatAvg !== null ? pItem.meatAvg + sideAddon : null,
            count: pItem.meatCount
          }
        };
        const dInfo = dietMap[selectedPoint.diet] || dietMap.vegan;
        const priceStr = dInfo.val !== null ? formatPrice(dInfo.val) : '–';
        pointDetailsHTML = `
          <div class="mt-2 px-3 py-2 rounded-xl bg-white dark:bg-[#0b1926] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs animate-fade-in">
            <div class="flex items-center gap-2">
              <span class="font-bold text-text-heading dark:text-white">${escapeHtml(pItem.label)}:</span>
              <span class="font-bold ${dInfo.color}">${escapeHtml(dInfo.label)}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-text-heading dark:text-white">Ø ${priceStr}</span>
              ${dInfo.count ? `<span class="text-[10px] text-slate-400">(${dInfo.count} ${escapeHtml(t.statsDishesCount)})</span>` : ''}
            </div>
          </div>
        `;
      }
    } else {
      pointDetailsHTML = `
        <div class="mt-1.5 text-[10px] text-slate-400 dark:text-slate-400 text-center">
          ${escapeHtml(t.statsChartSelectHint)}
        </div>
      `;
    }

    priceChartSectionHTML = `
      <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsPriceChartTitle)}</h4>
            <p class="text-[10px] text-slate-400 dark:text-slate-400">${escapeHtml(timeframe === 'all-time' ? t.statsPriceChartSubtitle : t.statsChartSelection)}</p>
          </div>
          <div class="flex bg-white dark:bg-[#0b1926] p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
            <button type="button" data-action="stats-chart-mode" data-mode="normalized" aria-pressed="${chartMode === 'normalized' ? 'true' : 'false'}" class="px-2 py-1 rounded-lg text-[10px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${modeBtnClass('normalized')}">${escapeHtml(t.statsChartModeNormalized)}</button>
            <button type="button" data-action="stats-chart-mode" data-mode="raw" aria-pressed="${chartMode === 'raw' ? 'true' : 'false'}" class="px-2 py-1 rounded-lg text-[10px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${modeBtnClass('raw')}">${escapeHtml(t.statsChartModeRaw)}</button>
          </div>
        </div>
        <div class="w-full overflow-hidden">
          ${svgHTML}
        </div>
        ${pointDetailsHTML}
        <div class="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.05] text-[10px] text-slate-500 dark:text-slate-400">
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>${escapeHtml(t.statsVegan)}</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-teal-400"></span>${escapeHtml(t.statsVegetarian)}</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>${escapeHtml(t.statsMeat)}</span>
          </div>
          <span class="text-[10px] text-slate-400 dark:text-slate-400 italic">${escapeHtml(chartMode === 'normalized' ? t.statsChartNoteReform : t.statsChartExplainRaw)}</span>
        </div>
      </div>
    `;
  }

  let favsHTML = '';
  if (favorites.length > 0) {
    favsHTML = `
      <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsFavoritesTitle)} (${favorites.length})</h4>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${favorites
            .slice(0, 15)
            .map(
              (f) => `
            <span class="text-xs bg-white dark:bg-[#0b1926] text-text-heading dark:text-slate-200 px-2.5 py-1 rounded-lg border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1">
              <span class="text-rose-500 text-[12px]">♥</span>
              <span class="truncate max-w-[200px] capitalize">${escapeHtml(f)}</span>
            </span>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  const vegCombinedPct = liveStats.veganPct + liveStats.vegetarianPct;

  contentEl.innerHTML = `
    ${filterBarHTML}

    ${periodLabel ? `<div class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-3 py-1.5 rounded-xl text-center">${periodLabel}</div>` : ''}

    <!-- Diet Breakdown Bar -->
    <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsDietBreakdown)}</h4>
        <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">${vegCombinedPct}% Veggie / Vegan</span>
      </div>
      <div class="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex mb-3">
        <div style="width: ${liveStats.veganPct}%" class="bg-emerald-500 h-full" title="${escapeHtml(t.statsVegan)}: ${liveStats.veganPct}%"></div>
        <div style="width: ${liveStats.vegetarianPct}%" class="bg-teal-400 h-full" title="${escapeHtml(t.statsVegetarian)}: ${liveStats.vegetarianPct}%"></div>
        <div style="width: ${liveStats.meatPct}%" class="bg-amber-400 h-full" title="${escapeHtml(t.statsMeat)}: ${liveStats.meatPct}%"></div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center text-xs">
        <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">${liveStats.veganPct}%</div>
          <div class="text-[10px] text-slate-500 dark:text-slate-400">${escapeHtml(t.statsVegan)} (${liveStats.veganDishes})</div>
        </div>
        <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="font-extrabold text-teal-600 dark:text-teal-400 text-sm">${liveStats.vegetarianPct}%</div>
          <div class="text-[10px] text-slate-500 dark:text-slate-400">${escapeHtml(t.statsVegetarian)} (${liveStats.vegetarianDishes})</div>
        </div>
        <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="font-extrabold text-amber-600 dark:text-amber-400 text-sm">${liveStats.meatPct}%</div>
          <div class="text-[10px] text-slate-500 dark:text-slate-400">${escapeHtml(t.statsMeat)} (${liveStats.meatDishes})</div>
        </div>
      </div>
    </div>

    <!-- Price & Total Summary Grid -->
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-slate-50 dark:bg-[#122338] p-3.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">${escapeHtml(t.statsAvgPrice)}</div>
        <div class="font-headline font-extrabold text-lg text-text-heading dark:text-white">${avgFormatted}</div>
        <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(t.statsPriceRange)}: ${minMaxFormatted}</div>
      </div>
      <div class="bg-slate-50 dark:bg-[#122338] p-3.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">${escapeHtml(t.statsTotalDishes)}</div>
        <div class="font-headline font-extrabold text-lg text-text-heading dark:text-white">${liveStats.totalDishes}</div>
        <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${liveStats.daysCount} ${escapeHtml(daysWord)}</div>
      </div>
    </div>

    ${favoritesRadarHTML}
    ${priceChartSectionHTML}
    ${topDishesHTML}
    ${favsHTML}
  `;

  if (focusedSelector) {
    const nextFocusEl = contentEl.querySelector(focusedSelector);
    if (nextFocusEl && typeof nextFocusEl.focus === 'function') {
      nextFocusEl.focus();
    }
  }
}

/**
 * Opens the Statistics modal (`#stats-modal`).
 *
 * @param {object} state
 * @param {object} modalState
 */
export function showStatsModal(state, modalState) {
  const modal = document.getElementById('stats-modal');
  if (!modal) return;
  if (!state.statsFilterCanteen) state.statsFilterCanteen = 'selected';
  if (!state.statsFilterTimeframe) state.statsFilterTimeframe = 'all';

  renderStatsContent(state);

  // If user has favorites and allTimeStatsData isn't loaded yet, fetch it in the background
  // so the Favorites Radar recurrence insights populate automatically
  if (getFavoritesV2().length > 0 && !state.allTimeStatsData && !state.allTimeStatsLoading) {
    loadAllTimeStats(state);
  }

  modal.classList.remove('hidden');
  syncAppInertState();
  if (modalState.cleanupStatsTrap) modalState.cleanupStatsTrap();
  modalState.cleanupStatsTrap = trapFocus(modal);
}

/**
 * Closes the Statistics modal (`#stats-modal`).
 *
 * @param {object} modalState
 */
export function hideStatsModal(modalState) {
  const modal = document.getElementById('stats-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  if (modalState.cleanupStatsTrap) {
    modalState.cleanupStatsTrap();
    modalState.cleanupStatsTrap = null;
  }
  syncAppInertState();
  document.getElementById('menu-btn')?.focus();
}
