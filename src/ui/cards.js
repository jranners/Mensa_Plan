import {
  getCustomFields,
  getDishDisplayName,
  getDishComponentsList,
  getBrandAndSubTag,
  getDishPrice,
  formatPrice,
  isBuffetDish,
  getBuffetPricePer100g,
  calculateBuffetPrice,
  detectIncludedSides,
  parseDishServingTime,
  extractDishCounter,
  cleanDishNameForFavorite
} from '../lib/dish.js';
import { getDishDietType, getDishMeatIcons } from '../lib/diet.js';
import { getDishAllergens, evaluateDishAllergies } from '../lib/allergens.js';
import { isFavoriteV2 } from '../lib/storage.js';
import { formatDateHeader } from '../lib/dates.js';
import { escapeHtml } from '../lib/html.js';
import { getIconHTML } from './icons.js';

/**
 * Renders the active date header banner.
 *
 * @param {string} isoDate
 * @param {object} state
 * @returns {string}
 */
export function getDateHeaderHTML(isoDate, state) {
  if (!isoDate) return '';
  const t = state.translations[state.lang];
  const formattedDate = formatDateHeader(isoDate, state.lang);

  return `
    <div class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/85 dark:bg-[#122338]/90 backdrop-blur-md border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
      <div class="w-8 h-8 rounded-xl bg-primary-container/10 dark:bg-price-badge/15 flex items-center justify-center text-primary-container dark:text-price-badge flex-shrink-0">
        <span class="text-[18px] flex items-center">${getIconHTML('calendar_today')}</span>
      </div>
      <div class="flex flex-col min-w-0">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-none mb-0.5">
          ${escapeHtml(t.menuForPrefix)}
        </span>
        <h2 class="font-headline font-extrabold text-sm sm:text-base text-text-heading dark:text-white truncate leading-tight">
          ${escapeHtml(formattedDate)}
        </h2>
      </div>
    </div>
  `;
}

/**
 * Renders a category section header (e.g. Hauptgerichte, Meisterwerk, Beilagen).
 *
 * @param {string} sectionKey
 * @param {number} count
 * @param {object} state
 * @returns {string}
 */
export function renderSectionHeader(sectionKey, count, state) {
  const t = state.translations[state.lang];
  const sectionConfig = {
    main: { label: t.sectionMain, icon: 'restaurant' },
    meisterwerk: { label: t.sectionMeisterwerk, icon: 'workspace_premium' },
    buffet: { label: t.sectionBuffet, icon: 'scale' },
    side: { label: t.sectionSide, icon: 'grain' },
    dessert: { label: t.sectionDessert, icon: 'icecream' }
  };

  const config = sectionConfig[sectionKey] || { label: sectionKey, icon: 'restaurant' };
  const isMeisterwerk = sectionKey === 'meisterwerk';

  const pillClasses = isMeisterwerk
    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300/80 dark:border-amber-700/60 text-amber-800 dark:text-amber-300'
    : 'bg-white/90 dark:bg-[#182c44] border-slate-200/90 dark:border-white/10 text-primary dark:text-slate-200';
  const iconClasses = isMeisterwerk
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-primary-container dark:text-price-badge';
  const countClasses = isMeisterwerk
    ? 'bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
  const lineClasses = isMeisterwerk
    ? 'from-amber-300/70 dark:from-amber-700/50'
    : 'from-slate-300/80 dark:from-slate-700/80';

  return `
    <div class="col-span-full flex items-center gap-3 mt-4 mb-1">
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${pillClasses} border shadow-xs">
        <span class="${iconClasses} flex items-center text-[15px]">${getIconHTML(config.icon)}</span>
        <h3 class="font-headline font-extrabold text-[11px] uppercase tracking-wider">
          ${escapeHtml(config.label)}
        </h3>
        <span class="px-1.5 py-0.5 rounded-md ${countClasses} text-[10px] font-bold leading-none">
          ${count}
        </span>
      </div>
      <div class="h-px flex-1 bg-gradient-to-r ${lineClasses} to-transparent"></div>
    </div>
  `;
}

/**
 * Extracts serving time window and counter badge for a dish at a given canteen.
 *
 * @param {object} dish
 * @param {string} canteenKey
 * @param {object} state
 * @returns {{ timeLabel: string|null, counterLabel: string|null }}
 */
function getDishServingMeta(dish, canteenKey, state) {
  const t = state.translations[state.lang];
  const parsedTime = parseDishServingTime(dish);
  let timeLabel = null;
  if (parsedTime && parsedTime.servingTime) {
    timeLabel = `${parsedTime.servingTime}${t.hoursSuffix}`;
  }
  const counterLabel = extractDishCounter(dish, canteenKey) || null;
  return { timeLabel, counterLabel };
}

/**
 * Renders the species & animal-welfare badges (G, S, R, F, NL) for a dish.
 *
 * @param {object} dish
 * @param {Record<string, string>} t
 * @returns {string}
 */
function renderSpeciesBadges(dish, t) {
  const icons = getDishMeatIcons(dish);
  if (!icons || icons.length === 0) return '';

  return icons
    .map((item) => {
      const label = t[item.key] || item.labelDe;
      const isNeuland = item.code === 'NL';
      const colorClass = isNeuland
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
        : 'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
      return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-md border ${colorClass} inline-flex items-center gap-1" title="${escapeHtml(t.speciesDisclaimer)}"><span aria-hidden="true">${item.emoji}</span><span>${escapeHtml(label)}</span></span>`;
    })
    .join('');
}

/**
 * Renders a full-sized card for a Main dish, Meisterwerk, or Buffet dish.
 *
 * @param {object} dish
 * @param {boolean} isUnavailable
 * @param {object} state
 * @param {string} [canteenKey='']
 * @returns {string}
 */
export function renderMainDishCard(dish, isUnavailable = false, state, canteenKey = '', availableSides = []) {
  const t = state.translations[state.lang];
  const customFields = getCustomFields(dish);

  const mealName = getDishDisplayName(dish, state.lang);
  const dishComponents = getDishComponentsList(dish, mealName, state.lang);

  const rawPrice = getDishPrice(dish, state.tariff);
  const isBuffet = isBuffetDish(dish);
  const buffetRate = isBuffet ? (getBuffetPricePer100g(dish, state.tariff) ?? rawPrice) : null;
  const priceFormatted = rawPrice !== null ? formatPrice(rawPrice) : '0,00 €';
  const unitLabel = isBuffet ? `<span class="text-[10px] font-normal ml-0.5">${escapeHtml(t.per100g)}</span>` : '';

  const cleanName = cleanDishNameForFavorite(dish);
  const dishKey = `${dish.id}::${cleanName}`;

  // Side combo calculation
  let sideComboSectionHTML = '';
  let displayedPriceFormatted = priceFormatted;
  let comboBasisBadgeHTML = '';

  if (!isBuffet && rawPrice !== null && Array.isArray(availableSides) && availableSides.length > 0) {
    const selectedSideNames = (state.dishSideCombos && state.dishSideCombos[dishKey]) || [];
    const rawSideItems = availableSides
      .map((s) => ({
        dish: s,
        clean: cleanDishNameForFavorite(s),
        name: getDishDisplayName(s, state.lang),
        price: getDishPrice(s, state.tariff) ?? 0
      }))
      .filter((s) => s.clean && s.price > 0);

    const seenCleans = new Set();
    const sideItems = [];
    for (const s of rawSideItems) {
      if (!seenCleans.has(s.clean)) {
        seenCleans.add(s.clean);
        sideItems.push(s);
      }
    }

    if (sideItems.length > 0) {
      const chosenSides = sideItems.filter((s) => selectedSideNames.includes(s.clean));
      const freeSidesCount = detectIncludedSides(dish, state.activeDate);
      const sortedChosenSides = [...chosenSides].sort((a, b) => a.price - b.price);
      const extraSidesCost = sortedChosenSides.slice(freeSidesCount).reduce((sum, s) => sum + s.price, 0);
      const totalComboPrice = Math.round((rawPrice + extraSidesCost) * 100) / 100;

      if (chosenSides.length > 0) {
        displayedPriceFormatted = formatPrice(totalComboPrice);
        const basisLabel = (t.comboBasisBadge || 'Basis {price} + {count} Beil.')
          .replace('{price}', priceFormatted)
          .replace('{count}', String(chosenSides.length));
        comboBasisBadgeHTML = `<div class="text-[9px] font-bold text-slate-500 dark:text-slate-400 text-right mt-0.5 whitespace-nowrap">${escapeHtml(basisLabel)}</div>`;
      }

      const isDrawerOpen = Boolean((state.openComboDrawers && state.openComboDrawers[dishKey]) || chosenSides.length > 0);
      const drawerButtonText =
        chosenSides.length === 0
          ? `➕ ${escapeHtml(t.sideComboBtn || 'Beilagen kombinieren')}`
          : `🍟 ${escapeHtml((t.sideComboSelected || '{count} Beilage(n) gewählt').replace('{count}', String(chosenSides.length)))} (+${formatPrice(extraSidesCost)})`;

      sideComboSectionHTML = `
        <div class="mt-3 pt-2.5 border-t border-black/[0.04] dark:border-white/[0.05]">
          <button
            type="button"
            data-action="toggle-combo-drawer"
            data-dish-key="${escapeHtml(dishKey)}"
            class="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-price-badge transition-colors cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
          >
            <span>${drawerButtonText}</span>
          </button>
          <div class="mt-2 flex flex-wrap gap-1.5 ${isDrawerOpen ? '' : 'hidden'}">
            ${sideItems
              .map((s) => {
                const isSideSelected = selectedSideNames.includes(s.clean);
                return `
                <button
                  type="button"
                  data-action="toggle-dish-side-combo"
                  data-dish-key="${escapeHtml(dishKey)}"
                  data-side-clean="${escapeHtml(s.clean)}"
                  aria-pressed="${isSideSelected ? 'true' : 'false'}"
                  class="px-2 py-1 rounded-lg text-[11px] border transition-all cursor-pointer flex items-center gap-1 ${
                    isSideSelected
                      ? 'bg-primary text-on-primary dark:bg-price-badge dark:text-primary border-primary dark:border-price-badge font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-[#0b1926] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100'
                  }"
                >
                  <span>${isSideSelected ? '✓' : '+'}</span>
                  <span class="truncate max-w-[130px]">${escapeHtml(s.name)}</span>
                  <span class="opacity-80 font-semibold">${formatPrice(s.price)}</span>
                </button>
              `;
              })
              .join('')}
          </div>
        </div>
      `;
    }
  }

  const includedSidesCount = detectIncludedSides(dish, state.activeDate);
  let includedSidesBadgeHTML = '';
  if (includedSidesCount > 0 && !isBuffet) {
    const badgeLabel = includedSidesCount === 2 ? t.includedTwoSides : t.includedOneSide;
    includedSidesBadgeHTML = `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60 flex items-center gap-1">${getIconHTML('check_circle', 'text-[11px]')} ${escapeHtml(badgeLabel)}</span>`;
  }

  let buffetCalcHTML = '';
  if (isBuffet && buffetRate !== null) {
    const defaultGrams = 250;
    const defaultTotal = formatPrice(calculateBuffetPrice(buffetRate, defaultGrams));
    const presets = [150, 250, 350, 500];
    const presetButtons = presets
      .map((g) => {
        const isDefault = g === defaultGrams;
        const activeClasses = isDefault
          ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
          : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-700 font-medium';
        return `<button type="button" data-action="buffet-preset" data-grams="${g}" aria-pressed="${isDefault ? 'true' : 'false'}" class="px-2 py-1 min-h-[28px] rounded-md text-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${activeClasses}">${g}g</button>`;
      })
      .join('');

    buffetCalcHTML = `
      <div class="mt-2.5 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/40 flex flex-col gap-1.5" data-buffet-calc data-rate="${buffetRate}">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span class="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
            ${getIconHTML('calculate', 'text-[13px]')}
            ${escapeHtml(t.buffetCalcTitle)}:
          </span>
          <span class="text-xs font-extrabold text-amber-950 dark:text-amber-200" data-buffet-result>
            ${defaultGrams}g ≈ ${defaultTotal}
          </span>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          ${presetButtons}
        </div>
      </div>
    `;
  }

  const dType = getDishDietType(dish);
  let dietPill = '';
  if (dType === 'vegan') {
    dietPill = `<span class="bg-diet-vegan text-white font-label-sm text-label-sm px-2.5 py-1 rounded-md tracking-wider uppercase font-bold inline-block">${escapeHtml(t.veganLabel)}</span>`;
  } else if (dType === 'vegetarian') {
    dietPill = `<span class="bg-diet-vegetarian text-white font-label-sm text-label-sm px-2.5 py-1 rounded-md tracking-wider uppercase font-bold inline-block">${escapeHtml(t.vegetarianLabel)}</span>`;
  }

  const speciesBadgesHTML = renderSpeciesBadges(dish, t);

  const brandMeta = getBrandAndSubTag(dish, t);
  const brandBadgeHTML = `
    <span class="text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 shadow-xs ${brandMeta.brandColor}">
      ${getIconHTML(brandMeta.brandIcon, 'text-[14px]')}
      <span>${escapeHtml(brandMeta.brandName)}</span>
    </span>
  `;
  const subTagHTML = brandMeta.subTag
    ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 flex items-center">${escapeHtml(brandMeta.subTag)}</span>`
    : '';

  const allergyEval = evaluateDishAllergies(dish, state.allergies);
  let warningBadge = '';
  if (state.allergies && state.allergies.length > 0 && allergyEval.status === 'unknown') {
    warningBadge = `<div class="mt-2 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">${getIconHTML('warning', 'text-[16px] text-amber-600 dark:text-amber-500')} ${escapeHtml(t.missingAllergensWarning)}</div>`;
  }

  const dishAllergens = getDishAllergens(dish);
  const isFav = isFavoriteV2(cleanName);
  const isOnTray = Array.isArray(state.tray) && state.tray.some((item) => item.key === dishKey);

  const allergensDisplay =
    dishAllergens.length > 0
      ? `<button type="button" data-action="show-allergens" data-dish-id="${escapeHtml(String(dish.id))}" data-dish-key="${escapeHtml(dishKey)}" class="min-h-[28px] text-[10px] text-on-surface-variant dark:text-slate-400 font-medium tracking-wide bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 px-2 py-1 rounded transition-colors cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs border border-black/[0.04] dark:border-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">${escapeHtml(t.allergensLabel)} ${escapeHtml(dishAllergens.join(', '))} ${getIconHTML('info', 'text-[11px] opacity-70')}</button>`
      : '';

  const imgUrl = dish.image_thumbnail_url || dish.image_url;
  const imageHTML = imgUrl
    ? `
    <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800 border border-black/[0.04] dark:border-white/[0.08] ml-3 shadow-inner self-center">
      <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(mealName)}" loading="lazy" class="w-full h-full object-cover transition-transform hover:scale-105 duration-300" data-hide-parent-on-error="true"/>
    </div>
  `
    : '';

  const isMeisterwerk =
    (customFields['menu_type'] || '').toUpperCase().includes('MEISTERWERK') ||
    (customFields['menu_type'] || '').toUpperCase().includes('AKTION');
  const cardBorderClasses = isMeisterwerk
    ? 'border-amber-300/90 dark:border-amber-600/50 ring-1 ring-amber-400/20'
    : isFav
      ? 'border-rose-200/90 dark:border-rose-900/40'
      : 'border-slate-200/90 dark:border-white/[0.08]';

  const servingMeta = getDishServingMeta(dish, canteenKey, state);
  const isSoldOut = dish.is_available === false;
  const effectivelyUnavailable = isUnavailable || isSoldOut;
  const unavailableClasses = effectivelyUnavailable ? 'opacity-80' : '';

  const timeBadgeHTML = servingMeta.timeLabel
    ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-md ${effectivelyUnavailable ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60' : 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60'} border flex items-center gap-1">${getIconHTML('schedule', 'text-[12px]')} ${escapeHtml(servingMeta.timeLabel)}${effectivelyUnavailable ? ` · ${escapeHtml(t.dishTimeEnded)}` : ''}</span>`
    : '';

  const counterBadgeHTML = servingMeta.counterLabel
    ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60 flex items-center gap-1">${getIconHTML('location_on', 'text-[12px]')} ${escapeHtml(servingMeta.counterLabel)}</span>`
    : '';

  const trayBtnClasses = isOnTray
    ? 'bg-emerald-500 text-white shadow-xs'
    : 'text-slate-400 hover:text-primary dark:text-slate-400 dark:hover:text-price-badge hover:bg-slate-100 dark:hover:bg-white/10';

  return `
    <article class="bg-white dark:bg-[#122338] rounded-2xl p-inset-card border ${cardBorderClasses} shadow-md hover:shadow-lg transition-all flex flex-col justify-between relative overflow-hidden ${unavailableClasses}" data-dish-name="${escapeHtml(cleanName)}" data-dish-key="${escapeHtml(dishKey)}" data-canteen-key="${escapeHtml(canteenKey)}">
      ${isMeisterwerk ? '<div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500"></div>' : ''}
      <div>
        <!-- Card Top Row: Badges & Price -->
        <div class="flex justify-between items-start gap-2 mb-stack-sm">
          <div class="flex flex-wrap items-center gap-1.5">
            ${brandBadgeHTML}
            ${subTagHTML}
            ${dietPill}
            ${speciesBadgesHTML}
            ${includedSidesBadgeHTML}
            ${timeBadgeHTML}
            ${counterBadgeHTML}
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              data-action="tray-toggle"
              data-dish-key="${escapeHtml(dishKey)}"
              data-canteen-key="${escapeHtml(canteenKey)}"
              data-meal-name="${escapeHtml(mealName)}"
              aria-label="${escapeHtml(isOnTray ? t.trayRemoveAria : t.trayAddAria)}"
              aria-pressed="${isOnTray ? 'true' : 'false'}"
              title="${escapeHtml(isOnTray ? t.trayRemoveAria : t.trayAddAria)}"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${trayBtnClasses}"
            >
              <span class="text-[15px] flex items-center">${getIconHTML(isOnTray ? 'check_circle' : 'tray')}</span>
            </button>
            <button
              type="button"
              data-action="export-calendar"
              data-dish-key="${escapeHtml(dishKey)}"
              data-canteen-key="${escapeHtml(canteenKey)}"
              aria-label="${escapeHtml(t.exportCalendarAria)}"
              title="${escapeHtml(t.exportCalendarAria)}"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 text-slate-400 hover:text-primary dark:text-slate-400 dark:hover:text-price-badge hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
            >
              <span class="text-[15px] flex items-center">${getIconHTML('calendar_add')}</span>
            </button>
            <button
              type="button"
              data-action="share-dish"
              data-dish-name="${escapeHtml(mealName)}"
              data-dish-price="${escapeHtml(priceFormatted)}"
              data-canteen-key="${escapeHtml(canteenKey)}"
              aria-label="${escapeHtml(t.shareAria)}"
              title="${escapeHtml(t.shareAria)}"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 text-slate-400 hover:text-primary dark:text-slate-400 dark:hover:text-price-badge hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
            >
              <span class="text-[15px] flex items-center">${getIconHTML('share')}</span>
            </button>
            <button
              type="button"
              data-action="favorite-toggle"
              data-dish-name="${escapeHtml(cleanName)}"
              aria-label="${escapeHtml(isFav ? t.favoriteRemoveAria : t.favoriteAddAria)}"
              aria-pressed="${isFav ? 'true' : 'false'}"
              title="${escapeHtml(isFav ? t.favoriteRemoveAria : t.favoriteAddAria)}"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 ${isFav ? 'text-rose-500 dark:text-rose-400' : 'text-slate-300 hover:text-rose-400 dark:text-slate-600 dark:hover:text-rose-400'} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
            >
              <span class="text-[17px] flex items-center">${getIconHTML(isFav ? 'favorite' : 'favorite_border')}</span>
            </button>
            <div class="flex flex-col items-end flex-shrink-0">
              <div class="bg-price-badge text-primary font-label-md text-label-md px-2.5 py-1 rounded-md shadow-xs font-extrabold whitespace-nowrap">
                ${displayedPriceFormatted}${unitLabel}
              </div>
              ${comboBasisBadgeHTML}
            </div>
          </div>
        </div>

        <!-- Card Body (Title, Components & Optional Image) -->
        <div class="flex justify-between items-start mt-2">
          <div class="flex-1 min-w-0">
            <h3 class="font-headline-lg text-headline-lg text-text-heading dark:text-white leading-snug mb-1.5 font-bold">
              ${escapeHtml(mealName)}
            </h3>
            ${dishComponents.length > 0 ? `<p class="font-body-md text-body-md text-on-surface-variant dark:text-slate-300 leading-relaxed">${dishComponents.map((c) => escapeHtml(c)).join(' · ')}</p>` : ''}
            ${warningBadge}
          </div>
          ${imageHTML}
        </div>
        ${buffetCalcHTML}
        ${sideComboSectionHTML}
      </div>

      <!-- Card Footer -->
      <div class="mt-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.08] flex justify-between items-center min-h-[20px]">
        <div></div>
        ${allergensDisplay}
      </div>
    </article>
  `;
}

/**
 * Renders a compact card for a Side dish or Dessert.
 *
 * @param {object} dish
 * @param {boolean} isUnavailable
 * @param {object} state
 * @param {string} [canteenKey='']
 * @returns {string}
 */
export function renderCompactDishCard(dish, isUnavailable = false, state, canteenKey = '') {
  const t = state.translations[state.lang];
  const mealName = getDishDisplayName(dish, state.lang);
  const dishComponents = getDishComponentsList(dish, mealName, state.lang);

  const rawPrice = getDishPrice(dish, state.tariff);
  const priceFormatted = rawPrice !== null ? formatPrice(rawPrice) : '0,00 €';

  const dType = getDishDietType(dish);
  let dietDot = '';
  if (dType === 'vegan') {
    dietDot = `<span class="bg-diet-vegan text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">${escapeHtml(t.veganLabel)}</span>`;
  } else if (dType === 'vegetarian') {
    dietDot = `<span class="bg-diet-vegetarian text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">${escapeHtml(t.vegetarianLabel)}</span>`;
  }

  const speciesBadgesHTML = renderSpeciesBadges(dish, t);

  const allergyEval = evaluateDishAllergies(dish, state.allergies);
  const hasAllergyWarning = state.allergies && state.allergies.length > 0 && allergyEval.status === 'unknown';

  const dishAllergens = getDishAllergens(dish);
  const cleanName = cleanDishNameForFavorite(dish);
  const dishKey = `${dish.id}::${cleanName}`;
  const isFav = isFavoriteV2(cleanName);
  const isOnTray = Array.isArray(state.tray) && state.tray.some((item) => item.key === dishKey);

  const allergensBtn =
    dishAllergens.length > 0
      ? `<button type="button" data-action="show-allergens" data-dish-id="${escapeHtml(String(dish.id))}" data-dish-key="${escapeHtml(dishKey)}" class="min-h-[24px] text-[10px] text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 px-1.5 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-0.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">${escapeHtml(dishAllergens.join(','))} ${getIconHTML('info', 'text-[10px] opacity-70')}</button>`
      : '';

  const servingMeta = getDishServingMeta(dish, canteenKey, state);
  const isSoldOut = dish.is_available === false;
  const effectivelyUnavailable = isUnavailable || isSoldOut;
  const unavailableClasses = effectivelyUnavailable ? 'opacity-80' : '';
  const compactMetaBadges = [];
  if (servingMeta.timeLabel) {
    compactMetaBadges.push(
      `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded ${effectivelyUnavailable ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'} inline-flex items-center gap-0.5">${getIconHTML('schedule', 'text-[10px]')} ${escapeHtml(servingMeta.timeLabel)}</span>`
    );
  }
  if (servingMeta.counterLabel) {
    compactMetaBadges.push(
      `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 inline-flex items-center gap-0.5">${getIconHTML('location_on', 'text-[10px]')} ${escapeHtml(servingMeta.counterLabel)}</span>`
    );
  }

  const trayBtnClasses = isOnTray
    ? 'bg-emerald-500 text-white'
    : 'text-slate-400 hover:text-primary dark:text-slate-400 dark:hover:text-price-badge hover:bg-slate-100 dark:hover:bg-white/10';

  return `
    <article class="bg-white/90 dark:bg-[#122338]/90 rounded-xl p-3 border ${isFav ? 'border-rose-200/90 dark:border-rose-900/40' : 'border-slate-200/80 dark:border-white/[0.07]'} shadow-xs hover:shadow-sm transition-all flex flex-col justify-between gap-1.5 ${unavailableClasses}" data-dish-name="${escapeHtml(cleanName)}" data-dish-key="${escapeHtml(dishKey)}" data-canteen-key="${escapeHtml(canteenKey)}">
      <div class="flex justify-between items-start gap-2">
        <div class="min-w-0 flex-1">
          <h4 class="font-headline font-bold text-sm text-text-heading dark:text-white leading-snug break-words">
            ${escapeHtml(mealName)}
          </h4>
          ${dishComponents.length > 0 ? `<p class="text-xs text-on-surface-variant dark:text-slate-300 leading-snug mt-0.5">${dishComponents.map((c) => escapeHtml(c)).join(' · ')}</p>` : ''}
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            data-action="tray-toggle"
            data-dish-key="${escapeHtml(dishKey)}"
            data-canteen-key="${escapeHtml(canteenKey)}"
            data-meal-name="${escapeHtml(mealName)}"
            aria-label="${escapeHtml(isOnTray ? t.trayRemoveAria : t.trayAddAria)}"
            aria-pressed="${isOnTray ? 'true' : 'false'}"
            title="${escapeHtml(isOnTray ? t.trayRemoveAria : t.trayAddAria)}"
            class="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${trayBtnClasses}"
          >
            <span class="text-[14px] flex items-center">${getIconHTML(isOnTray ? 'check_circle' : 'tray')}</span>
          </button>
          <button
            type="button"
            data-action="favorite-toggle"
            data-dish-name="${escapeHtml(cleanName)}"
            aria-label="${escapeHtml(isFav ? t.favoriteRemoveAria : t.favoriteAddAria)}"
            aria-pressed="${isFav ? 'true' : 'false'}"
            title="${escapeHtml(isFav ? t.favoriteRemoveAria : t.favoriteAddAria)}"
            class="w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 ${isFav ? 'text-rose-500 dark:text-rose-400' : 'text-slate-300 hover:text-rose-400 dark:text-slate-600 dark:hover:text-rose-400'} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
          >
            <span class="text-[15px] flex items-center">${getIconHTML(isFav ? 'favorite' : 'favorite_border')}</span>
          </button>
          <span class="bg-price-badge/90 text-primary text-xs font-extrabold px-2 py-0.5 rounded-md shadow-xs whitespace-nowrap">
            ${priceFormatted}
          </span>
        </div>
      </div>
      <div class="flex items-center justify-between gap-2 pt-1 border-t border-black/[0.03] dark:border-white/[0.05]">
        <div class="flex items-center gap-1.5 flex-wrap">
          ${dietDot}
          ${speciesBadgesHTML}
          ${compactMetaBadges.join('')}
          ${hasAllergyWarning ? `<span class="text-[10px] text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-0.5" title="${escapeHtml(t.missingAllergensWarning)}">${getIconHTML('warning', 'text-[12px]')}</span>` : ''}
        </div>
        ${allergensBtn}
      </div>
    </article>
  `;
}
