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
 * or opens the statistics modal.
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
 * Renders the contents of `#stats-modal-content`, including:
 * - Timeframe, Category, and Canteen filters
 * - Personal Mensa-Check (4 KPI cards)
 * - 14-Day Favorites Radar & Recurrence Insights
 * - Dietary Mix & Protein Source Breakdown
 * - Price History SVG Trend & Price Brackets
 * - Budget vs Premium Highlights
 * - Weekday Check (Mo-Fr) & Canteen Comparison
 * - Top Classics Ranking
 *
 * Preserves keyboard focus on active filter buttons across re-renders.
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
    } else if (action === 'stats-category') {
      focusedSelector = `[data-action="stats-category"][data-category="${activeEl.getAttribute('data-category')}"]`;
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
  const category = state.statsFilterCategory || 'main';

  const tfBtnClass = (tf) =>
    timeframe === tf
      ? 'bg-primary text-on-primary dark:bg-price-badge dark:text-primary font-bold shadow-xs'
      : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 font-medium';

  const catBtnClass = (c) =>
    category === c
      ? 'bg-primary text-on-primary dark:bg-price-badge dark:text-primary font-bold shadow-xs'
      : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 font-medium';

  const categoryOptions = [
    { key: 'main', label: t.statsCatMain || 'Hauptgerichte' },
    { key: 'side', label: t.statsCatSide || 'Beilagen' },
    { key: 'dessert', label: t.statsCatDessert || 'Desserts' },
    { key: 'all', label: t.statsCatAll || 'Alle' }
  ];

  const canteenOptions = [
    { key: 'selected', label: t.statsCanteenSelected || 'Meine Mensen' },
    { key: 'all', label: t.statsCanteenAll || 'Alle Mensen' },
    ...Object.entries(CANTEENS).map(([key, c]) => ({ key, label: c.name }))
  ];

  const filterBarHTML = `
    <div class="flex flex-col gap-2 bg-slate-50 dark:bg-[#122338] p-3 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsFilterTimeframe || 'Zeitraum')}</span>
        <div class="flex bg-white dark:bg-[#0b1926] p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
          <button type="button" data-action="stats-timeframe" data-timeframe="week" aria-pressed="${timeframe === 'week' ? 'true' : 'false'}" class="px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${tfBtnClass('week')}">${escapeHtml(t.statsTimeframeWeek || 'Diese Woche')}</button>
          <button type="button" data-action="stats-timeframe" data-timeframe="all" aria-pressed="${timeframe === 'all' ? 'true' : 'false'}" class="px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${tfBtnClass('all')}">${escapeHtml(t.statsTimeframe2Weeks || '2 Wochen')}</button>
          <button type="button" data-action="stats-timeframe" data-timeframe="all-time" aria-pressed="${timeframe === 'all-time' ? 'true' : 'false'}" class="px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${tfBtnClass('all-time')}">${escapeHtml(t.statsTimeframeAllTime || 'Seit Jan. 2026')}</button>
        </div>
      </div>
      <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-black/[0.04] dark:border-white/[0.05]">
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex-shrink-0">${escapeHtml(t.statsFilterCategory || 'Kategorie')}</span>
        <div class="flex bg-white dark:bg-[#0b1926] p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] overflow-x-auto">
          ${categoryOptions.map((opt) => `
            <button type="button" data-action="stats-category" data-category="${opt.key}" aria-pressed="${category === opt.key ? 'true' : 'false'}" class="px-2 py-1 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${catBtnClass(opt.key)}">${escapeHtml(opt.label)}</button>
          `).join('')}
        </div>
      </div>
      <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-black/[0.04] dark:border-white/[0.05]">
        <label for="stats-canteen-select" class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex-shrink-0">${escapeHtml(t.statsFilterCanteen || 'Mensa-Auswahl')}</label>
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
        <p>${escapeHtml(t.statsLoadError || 'Fehler beim Laden der historischen Daten.')}</p>
        <button type="button" data-action="stats-retry-alltime" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">${escapeHtml(t.retryBtn || 'Erneut versuchen')}</button>
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
    category,
    language: state.lang,
    allTimeData: state.allTimeStatsData,
    userDiet: state.diet,
    userAllergies: state.allergies,
    excludePork: state.excludePork,
    favorites,
    isFavoriteFn: isFavoriteV2,
    todayIso: state.todayIso
  });

  if (liveStats.totalDishes === 0 && favorites.length === 0) {
    contentEl.innerHTML = `
      ${filterBarHTML}
      <div class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        ${escapeHtml(t.statsNoDishesFound || t.statsEmpty || 'Keine Gerichte für die gewählten Filter.')}
      </div>
    `;
    return;
  }

  // Data timestamp banner
  let timestampHTML = '';
  const rawTimestamp = state.allTimeStatsData?.generatedAt || liveStats.dataTimestamp;
  if (rawTimestamp) {
    try {
      const dt = new Date(rawTimestamp);
      const formattedDate = dt.toLocaleString(state.lang === 'en' ? 'en-GB' : 'de-DE', {
        timeZone: 'Europe/Berlin',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const bannerText = (t.statsDataTimestamp || '📊 Datenstand: {time} · Automatisch aktualisiert').replace('{time}', formattedDate);
      timestampHTML = `
        <div class="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl text-center border border-black/[0.04] dark:border-white/[0.06]">
          ${escapeHtml(bannerText)}
        </div>
      `;
    } catch {
      // ignore date formatting errors
    }
  }

  const rangeStr = liveStats.timeframe?.formattedRange || formatDateRange(liveStats.timeframe?.startDate, liveStats.timeframe?.endDate);
  const activeDays = liveStats.timeframe?.activeDaysCount || liveStats.daysCount || 0;
  const daysWord = activeDays === 1 ? t.statsDaySingular : (t.statsDaysPlural || t.statsDaysWord || 'Öffnungstage');
  const periodLabel = rangeStr
    ? `${escapeHtml(t.statsCurrentPlan || 'Auswertung')} · ${escapeHtml(rangeStr)} (${activeDays} ${escapeHtml(daysWord)})`
    : '';

  // Section A: Personal Mensa-Check (4 KPI cards)
  const personalCompatPct = liveStats.personalMatch?.compatiblePct ?? 100;
  const personalCompatCount = liveStats.personalMatch?.compatibleCount ?? liveStats.totalDishes;
  const compatSubtext = (t.statsCompatibleOfTotal || '{count} von {total} Gerichten')
    .replace('{count}', String(personalCompatCount))
    .replace('{total}', String(liveStats.totalDishes));

  const personalPriceVal = liveStats.personalMatch?.personalAvgPrice != null
    ? formatPrice(liveStats.personalMatch.personalAvgPrice)
    : (liveStats.avgPrice != null ? formatPrice(liveStats.avgPrice) : '–');
  const personalPriceSubtext = liveStats.avgPrice != null
    ? (state.lang === 'en' ? `All dishes: ${formatPrice(liveStats.avgPrice)}` : `Gesamt-Ø: ${formatPrice(liveStats.avgPrice)}`)
    : '';

  const minPriceFormatted = liveStats.minPrice !== null ? formatPrice(liveStats.minPrice) : '–';
  const minPriceDish = liveStats.cheapestDishes && liveStats.cheapestDishes[0] ? liveStats.cheapestDishes[0].name : '';

  const personalKpiHTML = `
    <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
      <div class="flex items-center justify-between mb-2.5">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
          <span class="text-[14px] flex items-center">${getIconHTML('person')}</span>
          ${escapeHtml(t.statsPersonalCheckTitle || 'Dein persönlicher Mensa-Check')}
        </h4>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 dark:bg-price-badge/15 text-primary dark:text-price-badge">
          ${escapeHtml(t[`tariff${state.tariff.charAt(0).toUpperCase() + state.tariff.slice(1)}`] || state.tariff)}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-left">
        <div class="bg-white dark:bg-[#0b1926] p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">${escapeHtml(t.statsPersonalCompatible || 'Passt zu dir')}</div>
          <div class="font-headline font-extrabold text-base text-emerald-600 dark:text-emerald-400 mt-0.5">${personalCompatPct}%</div>
          <div class="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 truncate">${escapeHtml(compatSubtext)}</div>
        </div>
        <div class="bg-white dark:bg-[#0b1926] p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">${escapeHtml(t.statsPersonalAvgPrice || 'Dein Ø Preis')}</div>
          <div class="font-headline font-extrabold text-base text-text-heading dark:text-white mt-0.5">${personalPriceVal}</div>
          <div class="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 truncate">${escapeHtml(personalPriceSubtext)}</div>
        </div>
        <div class="bg-white dark:bg-[#0b1926] p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">${escapeHtml(t.statsMinPrice || 'Günstigstes')}</div>
          <div class="font-headline font-extrabold text-base text-text-heading dark:text-white mt-0.5">${minPriceFormatted}</div>
          <div class="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 truncate" title="${escapeHtml(minPriceDish)}">${escapeHtml(minPriceDish || '–')}</div>
        </div>
        <div class="bg-white dark:bg-[#0b1926] p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">${escapeHtml(t.statsTotalDishes || 'Gerichte gesamt')}</div>
          <div class="font-headline font-extrabold text-base text-text-heading dark:text-white mt-0.5">${liveStats.totalDishes}</div>
          <div class="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 truncate">${activeDays} ${escapeHtml(daysWord)}</div>
        </div>
      </div>
    </div>
  `;

  // Section B: 14-Day Favorites Radar & Recurrence Predictor
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
        : `<p class="text-[11px] text-slate-500 dark:text-slate-400 italic">${escapeHtml(t.favoritesRadarNoneUpcoming || 'Keine Favoriten in den nächsten 14 Tagen geplant.')}</p>`;

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
            ${escapeHtml(t.favoritesRadarTitle || '14-Tage Favoriten-Radar')}
          </h4>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
            ${radar.upcomingHits.length} ${escapeHtml(t.favoritesRadarUpcoming || 'Treffer')}
          </span>
        </div>
        <div class="flex flex-col gap-1.5">
          ${upcomingItemsHTML}
        </div>
        ${recurrenceHTML}
      </div>
    `;
  } else {
    favoritesRadarHTML = `
      <div class="bg-amber-50/70 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
        <span class="text-rose-500 text-sm flex-shrink-0">♥</span>
        <span>${escapeHtml(t.statsFavoritesEmptyHint || 'Tipp: Markiere Gerichte mit ♥, um hier deinen persönlichen 14-Tage-Radar & Wiederkehr-Prognosen zu sehen.')}</span>
      </div>
    `;
  }

  // Section C: Diet breakdown bar + Protein Breakdown chips
  const vegCombinedPct = liveStats.veganPct + liveStats.vegetarianPct;
  const species = liveStats.speciesCounts || { poultry: 0, beef: 0, fish: 0, pork: 0, neuland: 0 };
  const speciesList = [
    { label: state.lang === 'en' ? 'Poultry' : 'Geflügel', count: species.poultry, icon: '🍗' },
    { label: state.lang === 'en' ? 'Beef' : 'Rind', count: species.beef, icon: '🥩' },
    { label: state.lang === 'en' ? 'Fish' : 'Fisch', count: species.fish, icon: '🐟' },
    { label: state.lang === 'en' ? 'Pork' : 'Schwein', count: species.pork, icon: '🥓' },
    { label: state.lang === 'en' ? 'Neuland (Welfare)' : 'Artgerecht (NL)', count: species.neuland, icon: '🌱' }
  ].filter(s => s.count > 0);

  const proteinSectionHTML = speciesList.length > 0 ? `
    <div class="mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.05]">
      <h5 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-2">${escapeHtml(t.statsProteinBreakdownTitle || 'Fleisch- & Proteinquellen')}</h5>
      <div class="flex flex-wrap gap-1.5">
        ${speciesList.map(s => `
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-[#0b1926] border border-black/[0.06] dark:border-white/[0.08] text-slate-700 dark:text-slate-200">
            <span>${s.icon}</span>
            <span class="font-medium">${escapeHtml(s.label)}:</span>
            <span class="font-bold text-primary dark:text-price-badge">${s.count}×</span>
          </span>
        `).join('')}
      </div>
    </div>
  ` : '';

  const dietSectionHTML = `
    <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsDietBreakdown || 'Ernährungsweise')}</h4>
        <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">${vegCombinedPct}% Veggie / Vegan</span>
      </div>
      <div class="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex mb-3">
        <div style="width: ${liveStats.veganPct}%" class="bg-emerald-500 h-full" title="${escapeHtml(t.statsVegan || 'Vegan')}: ${liveStats.veganPct}%"></div>
        <div style="width: ${liveStats.vegetarianPct}%" class="bg-teal-400 h-full" title="${escapeHtml(t.statsVegetarian || 'Vegetarisch')}: ${liveStats.vegetarianPct}%"></div>
        <div style="width: ${liveStats.meatPct}%" class="bg-amber-400 h-full" title="${escapeHtml(t.statsMeat || 'Fleisch & Fisch')}: ${liveStats.meatPct}%"></div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center text-xs">
        <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">${liveStats.veganPct}%</div>
          <div class="text-[10px] text-slate-500 dark:text-slate-400">${escapeHtml(t.statsVegan || 'Vegan')} (${liveStats.veganCount})</div>
        </div>
        <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="font-extrabold text-teal-600 dark:text-teal-400 text-sm">${liveStats.vegetarianPct}%</div>
          <div class="text-[10px] text-slate-500 dark:text-slate-400">${escapeHtml(t.statsVegetarian || 'Vegetarisch')} (${liveStats.vegetarianCount})</div>
        </div>
        <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
          <div class="font-extrabold text-amber-600 dark:text-amber-400 text-sm">${liveStats.meatPct}%</div>
          <div class="text-[10px] text-slate-500 dark:text-slate-400">${escapeHtml(t.statsMeat || 'Fleisch & Fisch')} (${liveStats.meatCount})</div>
        </div>
      </div>
      ${proteinSectionHTML}
    </div>
  `;

  // Section D: Price Chart + Price Buckets + Top 3 Budget & Premium
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
      const pItem = liveStats.priceHistory.find((h) => h.month === selectedPoint.month || h.label === selectedPoint.month);
      if (pItem) {
        const effectiveTariff = (state.tariff === 'employee' || state.tariff === 'guest' || state.tariff === 'external') ? state.tariff : 'student';
        const tData = (pItem.tariffs && pItem.tariffs[effectiveTariff]) ? pItem.tariffs[effectiveTariff] : (pItem.tariffs?.student || pItem);
        const priceObj = (chartMode === 'raw' ? tData.raw : (tData.normalized || tData.raw)) || {};
        const countsObj = tData.counts || {};

        const dietMap = {
          vegan: {
            label: t.statsVegan || 'Vegan',
            color: 'text-emerald-600 dark:text-emerald-400',
            val: priceObj.vegan != null ? priceObj.vegan : null,
            count: countsObj.vegan
          },
          vegetarian: {
            label: t.statsVegetarian || 'Vegetarisch',
            color: 'text-teal-600 dark:text-teal-400',
            val: priceObj.vegetarian != null ? priceObj.vegetarian : null,
            count: countsObj.vegetarian
          },
          meat: {
            label: t.statsMeat || 'Fleisch & Fisch',
            color: 'text-amber-600 dark:text-amber-400',
            val: priceObj.meat != null ? priceObj.meat : null,
            count: countsObj.meat
          }
        };
        const dInfo = dietMap[selectedPoint.diet] || dietMap.vegan;
        const priceStr = dInfo.val !== null ? formatPrice(dInfo.val) : '–';
        pointDetailsHTML = `
          <div class="mt-2 px-3 py-2 rounded-xl bg-white dark:bg-[#0b1926] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs animate-fade-in">
            <div class="flex items-center gap-2">
              <span class="font-bold text-text-heading dark:text-white">${escapeHtml(pItem.label || pItem.month)}:</span>
              <span class="font-bold ${dInfo.color}">${escapeHtml(dInfo.label)}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-text-heading dark:text-white">Ø ${priceStr}</span>
              ${dInfo.count ? `<span class="text-[10px] text-slate-400">(${dInfo.count} ${escapeHtml(t.statsDishesCount || 'Gerichte')})</span>` : ''}
            </div>
          </div>
        `;
      }
    } else {
      pointDetailsHTML = `
        <div class="mt-1.5 text-[10px] text-slate-400 dark:text-slate-400 text-center">
          ${escapeHtml(t.statsChartSelectHint || 'Tippe auf einen Punkt für Details')}
        </div>
      `;
    }

    // Price Brackets
    const buckets = liveStats.priceBuckets || { under2: 0, from2to3: 0, from3to4: 0, over4: 0 };
    const priceBucketsHTML = `
      <div class="mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.05]">
        <h5 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-2">${escapeHtml(t.statsPriceBucketsTitle || 'Preiskategorien')}</h5>
        <div class="grid grid-cols-4 gap-1.5 text-center">
          <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
            <div class="text-[10px] text-slate-400 dark:text-slate-400 font-medium">&lt; 2 €</div>
            <div class="text-xs font-extrabold text-text-heading dark:text-white mt-0.5">${buckets.under2}</div>
          </div>
          <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
            <div class="text-[10px] text-slate-400 dark:text-slate-400 font-medium">2 – 3 €</div>
            <div class="text-xs font-extrabold text-text-heading dark:text-white mt-0.5">${buckets.from2to3}</div>
          </div>
          <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
            <div class="text-[10px] text-slate-400 dark:text-slate-400 font-medium">3 – 4 €</div>
            <div class="text-xs font-extrabold text-text-heading dark:text-white mt-0.5">${buckets.from3to4}</div>
          </div>
          <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
            <div class="text-[10px] text-slate-400 dark:text-slate-400 font-medium">&ge; 4 €</div>
            <div class="text-xs font-extrabold text-text-heading dark:text-white mt-0.5">${buckets.over4}</div>
          </div>
        </div>
      </div>
    `;

    priceChartSectionHTML = `
      <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsPriceChartTitle || 'Preisentwicklung')}</h4>
            <p class="text-[10px] text-slate-400 dark:text-slate-400">${escapeHtml(timeframe === 'all-time' ? (t.statsPriceChartSubtitle || 'Monatlicher Durchschnitt') : (t.statsChartSelection || 'Verlauf im Zeitraum'))}</p>
          </div>
          <div class="flex bg-white dark:bg-[#0b1926] p-0.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
            <button type="button" data-action="stats-chart-mode" data-mode="normalized" aria-pressed="${chartMode === 'normalized' ? 'true' : 'false'}" class="px-2 py-1 rounded-lg text-[10px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${modeBtnClass('normalized')}">${escapeHtml(t.statsChartModeNormalized || 'Bereinigt (+2 Beilagen)')}</button>
            <button type="button" data-action="stats-chart-mode" data-mode="raw" aria-pressed="${chartMode === 'raw' ? 'true' : 'false'}" class="px-2 py-1 rounded-lg text-[10px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${modeBtnClass('raw')}">${escapeHtml(t.statsChartModeRaw || 'Kassenpreis')}</button>
          </div>
        </div>
        <div class="w-full overflow-hidden">
          ${svgHTML}
        </div>
        ${pointDetailsHTML}
        <div class="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.05] text-[10px] text-slate-500 dark:text-slate-400">
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>${escapeHtml(t.statsVegan || 'Vegan')}</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>${escapeHtml(t.statsVegetarian || 'Vegetarisch')}</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>${escapeHtml(t.statsMeat || 'Fleisch & Fisch')}</span>
          </div>
          <span class="text-[10px] text-slate-400 dark:text-slate-400 italic">${escapeHtml(chartMode === 'normalized' ? (t.statsChartNoteReform || 'Ab Sept. 2026 inkl. 2 Beilagen für fairen Vergleich') : (t.statsChartExplainRaw || 'Reiner Rechnungsbetrag'))}</span>
        </div>
        ${priceBucketsHTML}
      </div>
    `;
  }

  // Budget vs Premium Highlights
  let budgetPremiumHTML = '';
  if (liveStats.cheapestDishes.length > 0 || liveStats.mostExpensiveDishes.length > 0) {
    budgetPremiumHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <!-- Budget -->
        <div class="bg-slate-50 dark:bg-[#122338] p-3.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] flex flex-col justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">${escapeHtml(t.statsCheapestTitle || '💸 Top 3 Sparfüchse')}</h4>
          <div class="flex flex-col gap-1.5">
            ${liveStats.cheapestDishes.map((d, i) => `
              <div class="flex items-center justify-between gap-2 text-xs bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-4 h-4 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0">${i + 1}</span>
                  <span class="font-medium text-text-heading dark:text-slate-200 truncate" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                </div>
                <span class="font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">${formatPrice(d.price)}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <!-- Premium -->
        <div class="bg-slate-50 dark:bg-[#122338] p-3.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] flex flex-col justify-between">
          <h4 class="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">${escapeHtml(t.statsMostExpensiveTitle || '✨ Top 3 Premium-Gerichte')}</h4>
          <div class="flex flex-col gap-1.5">
            ${liveStats.mostExpensiveDishes.map((d, i) => `
              <div class="flex items-center justify-between gap-2 text-xs bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-4 h-4 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0">${i + 1}</span>
                  <span class="font-medium text-text-heading dark:text-slate-200 truncate" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                </div>
                <span class="font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">${formatPrice(d.price)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Section E: Weekday Check (Mo-Fr) + Canteen Comparison
  let weekdayHTML = '';
  if (Array.isArray(liveStats.weekdayBreakdown) && liveStats.weekdayBreakdown.some(w => w.count > 0)) {
    weekdayHTML = `
      <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-2.5">${escapeHtml(t.statsWeekdayTitle || 'Wochentag-Check (Mo–Fr)')}</h4>
        <div class="grid grid-cols-5 gap-1.5 text-center">
          ${liveStats.weekdayBreakdown.map(wb => {
            const label = state.lang === 'en' ? wb.labelEn : wb.labelDe;
            const priceStr = wb.avgPrice != null ? formatPrice(wb.avgPrice) : '–';
            return `
              <div class="bg-white dark:bg-[#0b1926] p-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06] flex flex-col justify-between min-h-[64px]">
                <div class="text-[11px] font-bold text-text-heading dark:text-white">${escapeHtml(label)}</div>
                <div class="text-[10px] font-extrabold text-primary dark:text-price-badge my-0.5">${priceStr}</div>
                <div class="text-[9px] text-slate-400 dark:text-slate-400">${wb.count} G. · ${wb.veganPct}% V</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  let canteenComparisonHTML = '';
  if (Array.isArray(liveStats.canteenComparison) && liveStats.canteenComparison.length > 1) {
    canteenComparisonHTML = `
      <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-2.5">${escapeHtml(t.statsCanteenComparisonTitle || 'Mensen im Vergleich')}</h4>
        <div class="flex flex-col gap-2">
          ${liveStats.canteenComparison.map(c => `
            <div class="p-2.5 rounded-xl bg-white dark:bg-[#0b1926] border border-black/[0.04] dark:border-white/[0.06] flex flex-col gap-1">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="text-text-heading dark:text-white truncate">${escapeHtml(c.name)}</span>
                <span class="text-primary dark:text-price-badge whitespace-nowrap font-extrabold">${c.avgPrice != null ? `Ø ${formatPrice(c.avgPrice)}` : '–'}</span>
              </div>
              <div class="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span>${c.totalDishes} ${escapeHtml(t.statsDishesTotal || 'Gerichte')} · ${c.veganPct}% Vegan</span>
                ${c.topDish ? `<span class="truncate max-w-[160px] text-right italic" title="${escapeHtml(c.topDish)}">${escapeHtml(t.statsSignatureDish || 'Top')}: ${escapeHtml(c.topDish)}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Section F: Top 8 Dishes ranking
  let topDishesHTML = '';
  if (liveStats.topDishes.length > 0) {
    const subtitle = timeframe === 'all-time' ? (t.statsTopDishesAllTimeSub || 'Hauptgerichte seit Jan. 2026') : (t.statsTopDishesSubtitle || 'im gewählten Zeitraum');
    topDishesHTML = `
      <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <div class="flex items-baseline justify-between gap-2 mb-2.5">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsTopDishesTitle || 'Top Klassiker & Favoriten')}</h4>
          <span class="text-[10px] text-slate-400 dark:text-slate-400">${escapeHtml(subtitle)}</span>
        </div>
        <div class="flex flex-col gap-2">
          ${liveStats.topDishes.slice(0, 8).map((d, idx) => {
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
                ? `<span class="text-[10px] text-slate-400 dark:text-slate-400 whitespace-nowrap">${escapeHtml(t.statsLastSeen || 'Zuletzt')}: ${escapeHtml(d.lastSeen.split('-').reverse().slice(0, 2).join('.'))}.</span>`
                : '';
            return `
              <div class="flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-5 h-5 rounded-md bg-primary/10 dark:bg-price-badge/15 text-primary dark:text-price-badge font-bold text-[11px] flex items-center justify-center flex-shrink-0">${idx + 1}</span>
                  ${dietDot}
                  <span class="font-medium text-text-heading dark:text-slate-200 truncate" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  ${lastSeenInfo}
                  ${priceBadge}
                  <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">${d.count}×</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  let favsHTML = '';
  if (favorites.length > 0) {
    favsHTML = `
      <div class="bg-slate-50 dark:bg-[#122338] p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">${escapeHtml(t.statsFavoritesTitle || 'Deine Favoriten')} (${favorites.length})</h4>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${favorites.slice(0, 15).map((f) => `
            <span class="text-xs bg-white dark:bg-[#0b1926] text-text-heading dark:text-slate-200 px-2.5 py-1 rounded-lg border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-1">
              <span class="text-rose-500 text-[12px]">♥</span>
              <span class="truncate max-w-[200px] capitalize">${escapeHtml(f)}</span>
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  contentEl.innerHTML = `
    ${filterBarHTML}
    ${timestampHTML}
    ${periodLabel ? `<div class="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-3 py-1.5 rounded-xl text-center">${periodLabel}</div>` : ''}
    ${personalKpiHTML}
    ${favoritesRadarHTML}
    ${dietSectionHTML}
    ${priceChartSectionHTML}
    ${budgetPremiumHTML}
    ${weekdayHTML}
    ${canteenComparisonHTML}
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
  if (!state.statsFilterCategory) state.statsFilterCategory = 'main';

  modal.classList.remove('hidden');
  syncAppInertState();
  if (modalState.cleanupStatsTrap) modalState.cleanupStatsTrap();
  modalState.cleanupStatsTrap = trapFocus(modal);

  renderStatsContent(state);

  // Auto-trigger background loading of historical data if not yet loaded
  if (!state.allTimeStatsData && !state.allTimeStatsLoading) {
    loadAllTimeStats(state);
  }
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
