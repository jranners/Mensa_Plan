import { CANTEENS } from './data/canteens.js';
import { TRANSLATIONS } from './data/translations.js';
import {
  formatPrice,
  calculateBuffetPrice,
  cleanDishNameForFavorite,
  getDishDisplayName
} from './src/lib/dish.js';
import {
  normalizeCanteenOrder,
  moveCanteenInOrder,
  computeCanteenDistances,
  getCanteenKeyFromDish
} from './src/lib/canteen-match.js';
import {
  getBerlinTodayDate,
  getFetchDateRange,
  getAllowedMenuDates,
  formatDateSelector,
  pickActiveDate
} from './src/lib/dates.js';
import {
  DEFAULT_THROTTLE_MS,
  MAX_CACHE_AGE_MS,
  needsRefresh
} from './src/lib/lifecycle.js';
import {
  migrateStorage,
  compactMenuPayload,
  resetAppStorage,
  getFavoritesV2,
  toggleFavoriteV2,
  getTariff
} from './src/lib/storage.js';
import { validateWeekMenu, validateAnnouncements } from './src/lib/validation.js';
import { setAriaPressed, setAriaExpanded } from './src/lib/a11y.js';
import { escapeHtml } from './src/lib/html.js';
import { logger } from './src/lib/logger.js';

import { getIconHTML } from './src/ui/icons.js';
import { showToast, copyTextToClipboard } from './src/ui/toast.js';
import {
  toggleTrayDish,
  clearTray,
  renderTrayBar,
  shareTraySummary,
  shareCanteenDayPlan,
  exportDishToCalendar
} from './src/ui/tray-calendar.js';
import {
  renderAnnouncements,
  renderOfflineBanner,
  renderSkeletons,
  renderError,
  renderDateSelector,
  renderDietToggle,
  renderQuickFilterBar,
  renderCanteenMenu
} from './src/ui/feed.js';
import {
  showAppMenu,
  hideAppMenu,
  showAllergens,
  closeAllergensModal
} from './src/ui/modals.js';
import {
  loadAllTimeStats,
  renderStatsContent,
  showStatsModal,
  hideStatsModal
} from './src/ui/stats-modal.js';
import {
  initOnboardingUI,
  showOnboarding,
  cancelOnboarding,
  hideOnboarding,
  checkAllergenPrompt,
  initInstallPrompt,
  renderResetButton,
  renderResetConfirm
} from './src/ui/settings.js';
import {
  registerSW,
  checkUpdatedToast,
  initPullToRefresh,
  checkChangelogPrompt
} from './src/ui/sw-update.js';

// Run storage schema migration before reading state
migrateStorage();

// --- STATE MANAGEMENT ---
export const state = {
  lang: localStorage.getItem('kstw_lang') || 'de',
  selectedCanteens: [],
  diet: localStorage.getItem('kstw_diet') || 'all',
  allergies: [],
  tariff: getTariff(),
  excludePork: localStorage.getItem('kstw_exclude_pork') === 'true',
  under250: false,
  favoritesOnly: false,
  searchQuery: '',
  favorites: getFavoritesV2(),
  tray: [],
  trayExpanded: false,
  activeDate: null,
  todayIso: getBerlinTodayDate(),
  menuData: null,
  announcementsData: null,
  isFirstVisit: true,
  isOffline: false,
  cacheTimestamp: null,
  lastFetchAttemptMs: 0,
  settingsDraft: null,
  nearestMensaKey: null,
  canteenDistancesKm: {},
  dishSideCombos: {},
  openComboDrawers: {},
  statsFilterCanteen: 'selected',
  statsFilterTimeframe: 'all',
  statsFilterCategory: 'main',
  statsChartMode: 'normalized',
  statsSelectedPoint: null,
  allTimeStatsData: null,
  allTimeStatsLoading: false,
  allTimeStatsError: false,
  translations: TRANSLATIONS
};

const modalState = {
  cleanupOnboardingTrap: null,
  cleanupAllergensTrap: null,
  cleanupAppMenuTrap: null,
  cleanupStatsTrap: null,
  cleanupUpdateModal: null,
  cleanupAllergenPrompt: null,
  cleanupChangelogModal: null,
  lastAllergensTriggerEl: null
};

// Parse URL Deep-Link Params (?canteen=unimensa&date=2026-04-20)
let deepLinkCanteen = null;
let deepLinkDate = null;
try {
  const urlParams = new URLSearchParams(window.location.search);
  const cParam = urlParams.get('canteen');
  const dParam = urlParams.get('date');
  if (cParam && CANTEENS[cParam]) {
    deepLinkCanteen = cParam;
  }
  if (dParam && /^\d{4}-\d{2}-\d{2}$/.test(dParam)) {
    deepLinkDate = dParam;
  }
} catch {
  // Ignore URL parsing errors
}

try {
  const savedCanteens = JSON.parse(localStorage.getItem('kstw_canteens'));
  if (Array.isArray(savedCanteens) && savedCanteens.length > 0) {
    state.selectedCanteens = normalizeCanteenOrder(savedCanteens, CANTEENS);
    state.isFirstVisit = false;
  } else {
    state.selectedCanteens = normalizeCanteenOrder(['unimensa', 'eraum'], CANTEENS);
  }
  if (deepLinkCanteen && !state.selectedCanteens.includes(deepLinkCanteen)) {
    state.selectedCanteens = normalizeCanteenOrder([deepLinkCanteen, ...state.selectedCanteens], CANTEENS);
  }
} catch {
  state.selectedCanteens = normalizeCanteenOrder(
    deepLinkCanteen ? [deepLinkCanteen, 'unimensa'] : ['unimensa', 'eraum'],
    CANTEENS
  );
}

try {
  const savedAllergies = JSON.parse(localStorage.getItem('kstw_allergies'));
  if (Array.isArray(savedAllergies)) {
    state.allergies = savedAllergies;
  }
} catch {
  state.allergies = [];
}

// --- API & CACHE FUNCTIONS ---

/**
 * Reloads `data/config.js` bypassing browser cache in case the Supabase API key rotated.
 *
 * @returns {Promise<boolean>}
 */
async function reloadSupabaseConfig() {
  try {
    const res = await fetch(`data/config.js?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const text = await res.text();
    const urlMatch = text.match(/url:\s*["']([^"']+)["']/);
    const keyMatch = text.match(/apiKey:\s*["']([^"']+)["']/);
    const orgMatch = text.match(/orgId:\s*["']([^"']+)["']/);
    if (urlMatch && keyMatch && orgMatch) {
      window.SUPABASE_CONFIG = {
        url: urlMatch[1],
        apiKey: keyMatch[1],
        orgId: orgMatch[1]
      };
      return true;
    }
  } catch (err) {
    logger.warn('Failed to reload data/config.js:', err);
  }
  return false;
}

/**
 * Fetches 2-week menu data from the KStW Supabase RPC endpoint.
 * Retries once with a freshly reloaded `data/config.js` if HTTP 401/403 occurs.
 *
 * @param {string} startDateIso
 * @param {string} endDateIso
 * @returns {Promise<Array>}
 */
async function fetchWeekMenuData(startDateIso, endDateIso) {
  const doRequest = async () => {
    const config =
      (typeof window !== 'undefined' && window.SUPABASE_CONFIG) ||
      (typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG : null);
    if (!config || !config.url || !config.apiKey) {
      throw new Error('Missing Supabase configuration.');
    }
    const endpoint = `${config.url}/rest/v1/rpc/public_get_week_menu`;
    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        p_organization_id: config.orgId,
        p_start_date: startDateIso,
        p_end_date: endDateIso
      })
    });
  };

  let response = await doRequest();
  if ((response.status === 401 || response.status === 403) && (await reloadSupabaseConfig())) {
    response = await doRequest();
  }

  if (!response.ok) {
    throw new Error(`API HTTP Error: ${response.status}`);
  }
  return response.json();
}

function saveMenuCache(data) {
  try {
    const now = Date.now();
    const compacted = compactMenuPayload(data);
    localStorage.setItem('kstw_menu_cache', JSON.stringify(compacted));
    localStorage.setItem('kstw_menu_cache_time', now.toString());
    state.cacheTimestamp = now;
  } catch (e) {
    logger.warn('Could not save menu cache to localStorage:', e);
  }
}

function loadMenuCache() {
  try {
    const raw = localStorage.getItem('kstw_menu_cache');
    const time = localStorage.getItem('kstw_menu_cache_time');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const validation = validateWeekMenu(parsed);
    if (!validation.valid) {
      logger.warn('Discarding invalid cached menu payload:', validation.error);
      localStorage.removeItem('kstw_menu_cache');
      localStorage.removeItem('kstw_menu_cache_time');
      return null;
    }
    return {
      data: parsed,
      timestamp: time ? parseInt(time, 10) : null
    };
  } catch {
    return null;
  }
}

async function fetchAnnouncements() {
  try {
    const res = await fetch(`data/announcements.json?t=${Date.now()}`);
    if (!res.ok) return;
    const data = await res.json();
    const validation = validateAnnouncements(data);
    if (!validation.valid) {
      logger.warn('Ignoring invalid announcements payload:', validation.error);
      return;
    }
    state.announcementsData = data;
    renderAnnouncements(data, state);
  } catch (err) {
    logger.debug('Could not load announcements:', err);
  }
}

// --- LANGUAGE & RENDER ORCHESTRATION ---

export function applyLanguage() {
  const activeLang = (state.settingsDraft ? (state.settingsDraft.lang || state.settingsDraft.language) : state.lang) || 'de';
  const t = state.translations[activeLang] || state.translations[state.lang] || state.translations.de;
  document.documentElement.lang = activeLang;

  const setElText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setElText('app-title', t.title);
  setElText('today-btn-text', t.todayBtn);
  const todayBtn = document.getElementById('today-btn');
  if (todayBtn) {
    todayBtn.setAttribute('aria-label', t.todayBtnAria);
    todayBtn.setAttribute('title', t.todayBtnAria);
  }

  setElText('onboarding-title', state.isFirstVisit ? t.onboardingTitle : t.settingsTitle);
  setElText('onboarding-canteen-title', t.onboardingCanteenTitle);
  setElText('onboarding-diet-title', t.onboardingDietTitle);
  setElText('onboarding-tariff-title', t.onboardingTariffTitle);
  setElText('onboarding-allergen-title', t.onboardingAllergenTitle);
  setElText('onboarding-allergen-desc', t.onboardingAllergenDesc);
  setElText('onboarding-allergen-warning', t.onboardingAllergenWarning);

  setElText('app-menu-title', t.menuTitle);
  setElText('menu-item-settings-title', t.menuSettings);
  setElText('menu-item-settings-desc', t.menuSettingsDesc);
  setElText('menu-item-stats-title', t.menuStats);
  setElText('menu-item-stats-desc', t.menuStatsDesc);

  setElText('stats-modal-title', t.statsTitle);
  setElText('stats-modal-subheading', t.statsSubtitle);
  setElText('stats-storage-badge', t.statsStorageBadge);
  setElText('stats-close-footer-btn-text', t.closeBtn);

  const installTitle = document.getElementById('install-title');
  if (installTitle) {
    installTitle.innerHTML = `${getIconHTML('add_to_home_screen', 'text-primary-container dark:text-price-badge text-lg')} ${escapeHtml(t.installTitle)}`;
  }
  setElText('install-desc', t.installDesc);
  setElText('badge-privacy', t.badgePrivacy);
  setElText('badge-size', t.badgeSize);
  setElText('badge-perms', t.badgePerms);
  setElText('badge-offline', t.badgeOffline);

  const submitBtn = document.getElementById('submit-onboarding-btn');
  if (submitBtn) {
    submitBtn.innerHTML = `${escapeHtml(t.submitBtn)} ${getIconHTML('arrow_forward', 'text-xl')}`;
  }
}

export function renderFullApp() {
  renderDateSelector(state);
  renderDietToggle(state);
  renderQuickFilterBar(state);
  renderOfflineBanner(state);
  renderTrayBar(state);

  if (state.announcementsData) {
    renderAnnouncements(state.announcementsData, state);
  }

  if (state.menuData && state.activeDate) {
    const dayObj = state.menuData.find((d) => d.date === state.activeDate);
    renderCanteenMenu(dayObj, state);
  } else {
    renderCanteenMenu(null, state);
  }
}

function selectTargetDate(days) {
  const validDays = getAllowedMenuDates(days, state.todayIso);

  if (deepLinkDate && validDays.some((d) => d.date === deepLinkDate)) {
    state.activeDate = deepLinkDate;
    deepLinkDate = null;
    return;
  }

  const validDates = validDays.map((d) => d.date);
  const allDates = Array.isArray(days) ? days.map((d) => d.date) : validDates;

  state.activeDate = pickActiveDate({
    datesWithMeals: validDates,
    allAvailableDates: allDates,
    todayIso: state.todayIso,
    previousActiveDate: state.activeDate
  });
}

async function fetchAndRenderMenu({ showLoadingSkeleton = true, silent = false } = {}) {
  const cached = loadMenuCache();
  const hadCachedMenu = Boolean(cached && cached.data && cached.data.length > 0);
  const previousMenuJson = state.menuData ? JSON.stringify(state.menuData) : null;

  if (hadCachedMenu && !state.menuData) {
    state.menuData = cached.data;
    state.cacheTimestamp = cached.timestamp;
    selectTargetDate(state.menuData);
    renderFullApp();
  } else if (showLoadingSkeleton && !state.menuData) {
    renderSkeletons();
  }

  state.lastFetchAttemptMs = Date.now();
  const { startIso, endIso } = getFetchDateRange();

  try {
    const freshMenu = await fetchWeekMenuData(startIso, endIso);
    const validation = validateWeekMenu(freshMenu);
    if (!validation.valid) {
      throw new Error(`Invalid RPC menu payload: ${validation.error}`);
    }

    const wasOffline = state.isOffline;
    state.isOffline = false;
    state.favorites = getFavoritesV2();
    saveMenuCache(freshMenu);

    const freshJson = JSON.stringify(freshMenu);
    state.menuData = freshMenu;
    selectTargetDate(state.menuData);

    if (!hadCachedMenu || wasOffline || freshJson !== previousMenuJson) {
      renderFullApp();
    } else {
      renderOfflineBanner(state);
    }
  } catch (err) {
    logger.warn('Network fetch failed, using cache fallback if available:', err);
    if (state.menuData && state.menuData.length > 0) {
      state.isOffline = true;
      renderOfflineBanner(state);
    } else if (!silent) {
      const t = state.translations[state.lang];
      renderError(t.errorLoad, state);
    }
  }
}

async function handleShareDish(dishName, dishPrice, canteenKey) {
  const canteenName = CANTEENS[canteenKey]?.name || 'KStW Mensa';
  const dObj = formatDateSelector(state.activeDate, state.todayIso, state.lang);
  const dateLabel = `${dObj.dayName}, ${dObj.dayNum}`;

  const shareUrl = new URL(window.location.origin + window.location.pathname);
  if (canteenKey) shareUrl.searchParams.set('canteen', canteenKey);
  if (state.activeDate) shareUrl.searchParams.set('date', state.activeDate);

  const shareText = `🍽️ ${dishName} (${dishPrice})\n📍 ${canteenName} · ${dateLabel}\n🔗 ${shareUrl.toString()}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${dishName} – ${canteenName}`,
        text: shareText
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  await copyTextToClipboard(shareText, state);
}

function findDishByKey(dishKey) {
  if (!state.menuData) return null;
  const activeDay = state.menuData.find((d) => d.date === state.activeDate);
  const days = activeDay ? [activeDay, ...state.menuData] : state.menuData;
  for (const day of days) {
    if (!day.dishes) continue;
    for (const d of day.dishes) {
      const key = `${d.id}::${cleanDishNameForFavorite(d)}`;
      if (key === dishKey || String(d.id) === dishKey) {
        return d;
      }
    }
  }
  return null;
}

export function updateUserLocationDistances({ silent = false } = {}) {
  const t = state.translations[state.lang] || TRANSLATIONS.de;
  if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) {
    if (!silent) {
      showToast(t.geoErrorToast || 'Standortzugriff nicht verfügbar', 'warning', { closeLabel: t.closeBtn });
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      try {
        sessionStorage.setItem('kstw_user_coords', JSON.stringify({ lat, lon }));
      } catch {
        // ignore sessionStorage errors
      }

      const { distancesKm, nearestMensaKey } = computeCanteenDistances(
        Object.keys(CANTEENS),
        CANTEENS,
        lat,
        lon
      );
      state.canteenDistancesKm = distancesKm;

      const selectedMensaKeys = (state.selectedCanteens || []).filter(
        (k) => CANTEENS[k]?.type === 'mensa'
      );
      let minMensaDist = Infinity;
      let userNearestMensaKey = null;
      for (const k of selectedMensaKeys) {
        const d = distancesKm[k];
        if (d != null && d < minMensaDist) {
          minMensaDist = d;
          userNearestMensaKey = k;
        }
      }
      state.nearestMensaKey = userNearestMensaKey || nearestMensaKey;

      if (!silent) {
        showToast(t.sortedByDistanceToast || 'Entfernungen berechnet', 'check_circle', { closeLabel: t.closeBtn });
      }

      const dayObj = state.menuData
        ? state.menuData.find((x) => x.date === state.activeDate)
        : null;
      renderCanteenMenu(dayObj, state);
    },
    (_err) => {
      if (!silent) {
        showToast(t.geoErrorToast || 'Standort konnte nicht ermittelt werden', 'warning', { closeLabel: t.closeBtn });
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

// --- EVENT LISTENERS ---

function setupEventListeners() {
  document.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');

    switch (action) {
      case 'jump-today': {
        if (state.menuData && state.menuData.some((d) => d.date === state.todayIso)) {
          state.activeDate = state.todayIso;
          renderFullApp();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        break;
      }
      case 'select-date': {
        const d = actionBtn.getAttribute('data-date');
        if (d && d !== state.activeDate) {
          state.activeDate = d;
          renderDateSelector(state);
          const dayObj = state.menuData ? state.menuData.find((x) => x.date === d) : null;
          renderCanteenMenu(dayObj, state);
          renderTrayBar(state);
        }
        break;
      }
      case 'select-diet': {
        const diet = actionBtn.getAttribute('data-diet');
        if (diet && diet !== state.diet) {
          state.diet = diet;
          localStorage.setItem('kstw_diet', diet);
          renderDietToggle(state);
          renderDateSelector(state);
          const dayObj = state.menuData
            ? state.menuData.find((x) => x.date === state.activeDate)
            : null;
          renderCanteenMenu(dayObj, state);
        }
        break;
      }
      case 'quick-filter-toggle': {
        const filterKey = actionBtn.getAttribute('data-filter');
        if (filterKey === 'favoritesOnly') {
          state.favoritesOnly = !state.favoritesOnly;
        } else if (filterKey === 'under250') {
          state.under250 = !state.under250;
        } else if (filterKey === 'excludePork') {
          state.excludePork = !state.excludePork;
          localStorage.setItem('kstw_exclude_pork', state.excludePork ? 'true' : 'false');
        }
        renderQuickFilterBar(state);
        renderDateSelector(state);
        const dayObj = state.menuData
          ? state.menuData.find((x) => x.date === state.activeDate)
          : null;
        renderCanteenMenu(dayObj, state);
        break;
      }
      case 'clear-search': {
        state.searchQuery = '';
        renderQuickFilterBar(state);
        renderDateSelector(state);
        const dayObj = state.menuData
          ? state.menuData.find((x) => x.date === state.activeDate)
          : null;
        renderCanteenMenu(dayObj, state);
        document.getElementById('dish-search-input')?.focus();
        break;
      }
      case 'buffet-preset': {
        const grams = parseInt(actionBtn.getAttribute('data-grams'), 10);
        const calcContainer = actionBtn.closest('[data-buffet-calc]');
        if (calcContainer && !isNaN(grams)) {
          const rate = parseFloat(calcContainer.getAttribute('data-rate'));
          const resultEl = calcContainer.querySelector('[data-buffet-result]');
          if (resultEl && !isNaN(rate)) {
            const total = formatPrice(calculateBuffetPrice(rate, grams));
            resultEl.textContent = `${grams}g ≈ ${total}`;
          }
          calcContainer.querySelectorAll('[data-action="buffet-preset"]').forEach((btn) => {
            const isSelected = parseInt(btn.getAttribute('data-grams'), 10) === grams;
            setAriaPressed(btn, isSelected);
            btn.className = `px-2 py-1 min-h-[28px] rounded-md text-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${
              isSelected
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-700 font-medium'
            }`;
          });
        }
        break;
      }
      case 'favorite-toggle': {
        const dishName = actionBtn.getAttribute('data-dish-name');
        if (dishName) {
          const isAdded = toggleFavoriteV2(dishName);
          state.favorites = getFavoritesV2();
          const t = state.translations[state.lang];
          showToast(isAdded ? t.favoriteAddedToast : t.favoriteRemovedToast, isAdded ? 'favorite' : 'favorite_border', {
            closeLabel: t.closeBtn
          });
          renderDateSelector(state);
          const dayObj = state.menuData
            ? state.menuData.find((x) => x.date === state.activeDate)
            : null;
          renderCanteenMenu(dayObj, state);
        }
        break;
      }
      case 'share-dish': {
        const dishName = actionBtn.getAttribute('data-dish-name');
        const dishPrice = actionBtn.getAttribute('data-dish-price');
        const canteenKey = actionBtn.getAttribute('data-canteen-key');
        if (dishName) {
          handleShareDish(dishName, dishPrice, canteenKey);
        }
        break;
      }
      case 'share-day-plan': {
        const canteenKey = actionBtn.getAttribute('data-canteen-key');
        if (canteenKey) {
          shareCanteenDayPlan(state, canteenKey);
        }
        break;
      }
      case 'tray-toggle': {
        const dishKey = actionBtn.getAttribute('data-dish-key');
        const canteenKey = actionBtn.getAttribute('data-canteen-key') || '';
        const mealName = actionBtn.getAttribute('data-meal-name') || '';
        const dish = findDishByKey(dishKey);
        if (dish) {
          const wasOnTray = Array.isArray(state.tray) && state.tray.some((item) => item.key === dishKey);
          toggleTrayDish(state, dishKey, dish, canteenKey, mealName);
          if (!wasOnTray && state.dishSideCombos && Array.isArray(state.dishSideCombos[dishKey])) {
            const sideCleanNames = state.dishSideCombos[dishKey];
            const activeDay = state.menuData
              ? state.menuData.find((d) => d.date === state.activeDate)
              : null;
            if (activeDay && Array.isArray(activeDay.dishes)) {
              for (const sName of sideCleanNames) {
                const sideDish =
                  activeDay.dishes.find(
                    (d) =>
                      cleanDishNameForFavorite(d) === sName &&
                      (!canteenKey || getCanteenKeyFromDish(d, canteenKey, CANTEENS[canteenKey]))
                  ) ||
                  activeDay.dishes.find((d) => cleanDishNameForFavorite(d) === sName);

                if (sideDish) {
                  const sKey = `${sideDish.id}::${cleanDishNameForFavorite(sideDish)}`;
                  const alreadyOnTray = state.tray.some((item) => item.key === sKey);
                  if (!alreadyOnTray) {
                    toggleTrayDish(
                      state,
                      sKey,
                      sideDish,
                      canteenKey,
                      getDishDisplayName(sideDish, state.lang)
                    );
                  }
                }
              }
            }
          }
          const dayObj = state.menuData
            ? state.menuData.find((x) => x.date === state.activeDate)
            : null;
          renderCanteenMenu(dayObj, state);
        }
        break;
      }
      case 'tray-remove-item': {
        const dishKey = actionBtn.getAttribute('data-dish-key');
        if (dishKey && Array.isArray(state.tray)) {
          state.tray = state.tray.filter((item) => item.key !== dishKey);
          renderTrayBar(state);
          const dayObj = state.menuData
            ? state.menuData.find((x) => x.date === state.activeDate)
            : null;
          renderCanteenMenu(dayObj, state);
        }
        break;
      }
      case 'tray-expand-toggle': {
        state.trayExpanded = !state.trayExpanded;
        renderTrayBar(state);
        break;
      }
      case 'tray-clear': {
        clearTray(state);
        const dayObj = state.menuData
          ? state.menuData.find((x) => x.date === state.activeDate)
          : null;
        renderCanteenMenu(dayObj, state);
        break;
      }
      case 'tray-share': {
        shareTraySummary(state);
        break;
      }
      case 'export-calendar': {
        const dishKey = actionBtn.getAttribute('data-dish-key');
        const canteenKey = actionBtn.getAttribute('data-canteen-key') || '';
        const dish = findDishByKey(dishKey);
        if (dish) {
          exportDishToCalendar(dish, state.activeDate, canteenKey, state);
        }
        break;
      }
      case 'open-menu': {
        showAppMenu(modalState);
        break;
      }
      case 'close-menu': {
        hideAppMenu(modalState);
        break;
      }
      case 'menu-open-settings': {
        hideAppMenu(modalState, false);
        showOnboarding(false, state, modalState, applyLanguage);
        break;
      }
      case 'menu-open-stats': {
        hideAppMenu(modalState, false);
        showStatsModal(state, modalState);
        break;
      }
      case 'close-stats-modal': {
        hideStatsModal(modalState);
        break;
      }
      case 'stats-timeframe': {
        const tf = actionBtn.getAttribute('data-timeframe');
        if (tf && tf !== state.statsFilterTimeframe) {
          state.statsFilterTimeframe = tf;
          state.statsSelectedPoint = null;
          if (tf === 'all-time' && !state.allTimeStatsData) {
            loadAllTimeStats(state);
          } else {
            renderStatsContent(state);
          }
        }
        break;
      }
      case 'stats-category': {
        const cat = actionBtn.getAttribute('data-category');
        if (cat && cat !== state.statsFilterCategory) {
          state.statsFilterCategory = cat;
          renderStatsContent(state);
        }
        break;
      }
      case 'stats-canteen-scope': {
        const sc = actionBtn.getAttribute('data-scope');
        if (sc && sc !== state.statsFilterCanteen) {
          state.statsFilterCanteen = sc;
          state.statsSelectedPoint = null;
          renderStatsContent(state);
        }
        break;
      }
      case 'stats-chart-mode': {
        const m = actionBtn.getAttribute('data-mode');
        if (m && m !== state.statsChartMode) {
          state.statsChartMode = m;
          renderStatsContent(state);
        }
        break;
      }
      case 'stats-chart-point': {
        const month = actionBtn.getAttribute('data-month');
        const diet = actionBtn.getAttribute('data-diet');
        if (month && diet) {
          const cur = state.statsSelectedPoint;
          if (cur && cur.month === month && cur.diet === diet) {
            state.statsSelectedPoint = null;
          } else {
            state.statsSelectedPoint = { month, diet };
          }
          renderStatsContent(state);
        }
        break;
      }
      case 'stats-retry-alltime': {
        state.allTimeStatsData = null;
        loadAllTimeStats(state);
        break;
      }
      case 'radar-jump': {
        const targetDate = actionBtn.getAttribute('data-date');
        if (targetDate) {
          hideStatsModal(modalState);
          state.activeDate = targetDate;
          renderFullApp();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        break;
      }
      case 'select-lang': {
        const l = actionBtn.getAttribute('data-lang');
        if (l) {
          if (state.settingsDraft) {
            state.settingsDraft.lang = l;
          } else {
            state.lang = l;
          }
          initOnboardingUI(state, applyLanguage);
        }
        break;
      }
      case 'onboarding-diet': {
        const d = actionBtn.getAttribute('data-diet');
        if (d) {
          if (state.settingsDraft) {
            state.settingsDraft.diet = d;
          } else {
            state.diet = d;
          }
          initOnboardingUI(state, applyLanguage);
        }
        break;
      }
      case 'onboarding-tariff': {
        const tariff = actionBtn.getAttribute('data-tariff');
        if (tariff) {
          if (state.settingsDraft) {
            state.settingsDraft.tariff = tariff;
          } else {
            state.tariff = tariff;
          }
          initOnboardingUI(state, applyLanguage);
        }
        break;
      }
      case 'onboarding-exclude-pork': {
        if (state.settingsDraft) {
          state.settingsDraft.excludePork = !state.settingsDraft.excludePork;
        } else {
          state.excludePork = !state.excludePork;
        }
        initOnboardingUI(state, applyLanguage);
        break;
      }
      case 'reset-app-prompt': {
        renderResetConfirm(state);
        break;
      }
      case 'reset-app-cancel': {
        renderResetButton(state);
        break;
      }
      case 'reset-app-confirm': {
        const t = state.translations[state.lang];
        resetAppStorage();
        state.selectedCanteens = ['unimensa', 'eraum'];
        state.diet = 'all';
        state.allergies = [];
        state.tariff = 'student';
        state.excludePork = false;
        state.favorites = [];
        state.isFirstVisit = true;
        state.settingsDraft = null;
        showToast(t.resetAppDoneToast, 'check_circle', { closeLabel: t.closeBtn });
        showOnboarding(true, state, modalState, applyLanguage);
        break;
      }
      case 'show-allergens': {
        const dishKey =
          actionBtn.getAttribute('data-dish-key') || actionBtn.getAttribute('data-dish-id');
        if (dishKey) {
          modalState.lastAllergensTriggerEl = actionBtn;
          showAllergens(dishKey, state, modalState);
        }
        break;
      }
      case 'close-allergens-modal': {
        closeAllergensModal(modalState);
        break;
      }
      case 'dismiss-announcement': {
        const id = actionBtn.getAttribute('data-id');
        if (id) {
          let dismissed = [];
          try {
            dismissed = JSON.parse(localStorage.getItem('kstw_dismissed_announcements') || '[]');
          } catch {
            dismissed = [];
          }
          if (!dismissed.includes(id)) {
            dismissed.push(id);
            localStorage.setItem('kstw_dismissed_announcements', JSON.stringify(dismissed));
          }
          if (state.announcementsData) {
            renderAnnouncements(state.announcementsData, state);
          }
        }
        break;
      }
      case 'retry-fetch': {
        fetchAndRenderMenu({ showLoadingSkeleton: false, silent: false });
        break;
      }
      case 'toggle-extra': {
        const target = actionBtn.getAttribute('data-target');
        const count = actionBtn.getAttribute('data-count');
        const isExpanded = actionBtn.getAttribute('data-expanded') === 'true';
        const items = document.querySelectorAll(`[data-extra-item="${target}"]`);
        const t = state.translations[state.lang];

        items.forEach((el) => {
          el.classList.toggle('hidden', isExpanded);
        });

        const nextExpanded = !isExpanded;
        actionBtn.setAttribute('data-expanded', nextExpanded ? 'true' : 'false');
        setAriaExpanded(actionBtn, nextExpanded);

        const textSpan = actionBtn.querySelector('.toggle-extra-text');
        const iconSpan = actionBtn.querySelector('.toggle-extra-icon');
        if (textSpan) {
          textSpan.textContent = nextExpanded ? t.showLess : `+ ${count} ${t.showMore}`;
        }
        if (iconSpan) {
          iconSpan.innerHTML = getIconHTML(nextExpanded ? 'expand_less' : 'expand_more');
        }
        break;
      }
      case 'request-user-location': {
        updateUserLocationDistances({ silent: false });
        break;
      }
      case 'move-canteen-order': {
        const canteenKey = actionBtn.getAttribute('data-canteen-key');
        const direction = actionBtn.getAttribute('data-dir');
        if (canteenKey && direction) {
          const draft = state.settingsDraft || state;
          const currentOrder = Array.isArray(draft.selectedCanteens) ? [...draft.selectedCanteens] : [];
          const nextOrder = moveCanteenInOrder(currentOrder, canteenKey, direction, CANTEENS);
          if (state.settingsDraft) {
            state.settingsDraft.selectedCanteens = nextOrder;
          } else {
            state.selectedCanteens = nextOrder;
            localStorage.setItem('kstw_canteens', JSON.stringify(state.selectedCanteens));
          }
          initOnboardingUI(state, applyLanguage);
          const dayObj = state.menuData
            ? state.menuData.find((x) => x.date === state.activeDate)
            : null;
          renderCanteenMenu(dayObj, state);
        }
        break;
      }
      case 'toggle-combo-drawer': {
        const dishKey = actionBtn.getAttribute('data-dish-key');
        if (dishKey) {
          if (!state.openComboDrawers) state.openComboDrawers = {};
          state.openComboDrawers[dishKey] = !state.openComboDrawers[dishKey];
          const dayObj = state.menuData
            ? state.menuData.find((x) => x.date === state.activeDate)
            : null;
          renderCanteenMenu(dayObj, state);
        }
        break;
      }
      case 'toggle-dish-side-combo': {
        const dishKey = actionBtn.getAttribute('data-dish-key');
        const sideClean = actionBtn.getAttribute('data-side-clean');
        if (dishKey && sideClean) {
          if (!state.dishSideCombos) state.dishSideCombos = {};
          const current = state.dishSideCombos[dishKey] || [];
          if (current.includes(sideClean)) {
            state.dishSideCombos[dishKey] = current.filter((x) => x !== sideClean);
          } else {
            state.dishSideCombos[dishKey] = [...current, sideClean];
          }
          const dayObj = state.menuData
            ? state.menuData.find((x) => x.date === state.activeDate)
            : null;
          renderCanteenMenu(dayObj, state);
        }
        break;
      }
    }
  });

  // Search input live filtering
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'dish-search-input') {
      state.searchQuery = e.target.value || '';
      renderDateSelector(state);
      const dayObj = state.menuData
        ? state.menuData.find((x) => x.date === state.activeDate)
        : null;
      renderCanteenMenu(dayObj, state);
    }
  });

  // Canteen scope select inside #stats-modal and draft checkboxes inside #onboarding
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'stats-canteen-select') {
      state.statsFilterCanteen = e.target.value;
      state.statsSelectedPoint = null;
      renderStatsContent(state);
    } else if (e.target && e.target.classList.contains('canteen-cb')) {
      const val = e.target.value;
      const targetObj = state.settingsDraft || state;
      const currentList = Array.isArray(targetObj.selectedCanteens)
        ? [...targetObj.selectedCanteens]
        : [];
      if (e.target.checked) {
        if (!currentList.includes(val)) {
          currentList.push(val);
        }
      } else {
        const idx = currentList.indexOf(val);
        if (idx !== -1) {
          currentList.splice(idx, 1);
        }
      }
      targetObj.selectedCanteens = normalizeCanteenOrder(currentList, CANTEENS);
      initOnboardingUI(state, applyLanguage);
    } else if (e.target && e.target.classList.contains('allergen-cb') && state.settingsDraft) {
      state.settingsDraft.allergies = Array.from(
        document.querySelectorAll('.allergen-cb:checked')
      ).map((cb) => cb.value);
    }
  });

  // Theme Toggle
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      document.documentElement.classList.toggle('light', !isDark);
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', isDark ? '#0b1926' : '#00273e');
    });
  }

  // Onboarding / Settings Buttons
  document.getElementById('close-onboarding-btn')?.addEventListener('click', () => {
    cancelOnboarding(state, modalState, applyLanguage);
  });
  document.getElementById('submit-onboarding-btn')?.addEventListener('click', () => {
    hideOnboarding(state, modalState, () => {
      applyLanguage();
      if (state.menuData) {
        selectTargetDate(state.menuData);
      }
      renderFullApp();
      checkChangelogPrompt(state, modalState, () => showStatsModal(state, modalState));
    });
  });

  // Backdrop click dismissals
  document.getElementById('allergens-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'allergens-modal') closeAllergensModal(modalState);
  });
  document.getElementById('app-menu-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'app-menu-modal') hideAppMenu(modalState);
  });
  document.getElementById('stats-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'stats-modal') hideStatsModal(modalState);
  });

  // Keyboard navigation: Escape for all modals + Enter/Space for SVG chart points
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target?.getAttribute?.('data-action') === 'stats-chart-point') {
      e.preventDefault();
      e.target.click();
      return;
    }

    if (e.key === 'Escape') {
      if (modalState.cleanupChangelogModal) {
        localStorage.setItem('kstw_changelog_seen', CHANGELOG_VERSION);
        modalState.cleanupChangelogModal();
        return;
      }
      if (modalState.cleanupAllergenPrompt) {
        localStorage.setItem('kstw_allergen_prompt_v1', 'true');
        modalState.cleanupAllergenPrompt();
        return;
      }
      if (modalState.cleanupUpdateModal) {
        modalState.cleanupUpdateModal();
        return;
      }
      const allergensModal = document.getElementById('allergens-modal');
      if (allergensModal && !allergensModal.classList.contains('hidden')) {
        closeAllergensModal(modalState);
        return;
      }
      const statsModal = document.getElementById('stats-modal');
      if (statsModal && !statsModal.classList.contains('hidden')) {
        hideStatsModal(modalState);
        return;
      }
      const appMenuModal = document.getElementById('app-menu-modal');
      if (appMenuModal && !appMenuModal.classList.contains('hidden')) {
        hideAppMenu(modalState);
        return;
      }
      const onboardingEl = document.getElementById('onboarding');
      if (onboardingEl && !onboardingEl.classList.contains('hidden') && !state.isFirstVisit) {
        cancelOnboarding(state, modalState, applyLanguage);
      }
    }
  });

  // Image fallback error handler (CSP-compliant)
  document.addEventListener(
    'error',
    (e) => {
      if (
        e.target &&
        e.target.tagName === 'IMG' &&
        e.target.getAttribute('data-hide-parent-on-error') === 'true'
      ) {
        if (e.target.parentElement) {
          e.target.parentElement.style.display = 'none';
        }
      }
    },
    true
  );

  // Foreground resume & online recovery
  const handleResumeCheck = () => {
    const newTodayIso = getBerlinTodayDate();
    const dayRolledOver = newTodayIso !== state.todayIso;
    if (dayRolledOver) {
      state.todayIso = newTodayIso;
    }

    const shouldFetch = needsRefresh({
      lastFetchAttemptMs: state.lastFetchAttemptMs,
      cacheTimestampMs: state.cacheTimestamp,
      nowMs: Date.now(),
      isOffline: state.isOffline,
      currentTodayIso: newTodayIso,
      stateTodayIso: state.todayIso,
      throttleMs: DEFAULT_THROTTLE_MS,
      maxCacheAgeMs: MAX_CACHE_AGE_MS
    });

    if (dayRolledOver || shouldFetch) {
      fetchAndRenderMenu({ showLoadingSkeleton: false, silent: true });
      fetchAnnouncements();
    } else if (state.menuData && state.activeDate === state.todayIso) {
      const dayObj = state.menuData.find((d) => d.date === state.activeDate);
      renderCanteenMenu(dayObj, state);
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleResumeCheck();
    }
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      handleResumeCheck();
    }
  });

  window.addEventListener('online', () => {
    if (state.isOffline) {
      fetchAndRenderMenu({ showLoadingSkeleton: false, silent: true });
      fetchAnnouncements();
    }
  });
}

// --- INITIALIZATION ---

export async function init() {
  applyLanguage();
  initOnboardingUI(state, applyLanguage);
  initInstallPrompt(state);
  setupEventListeners();

  // Load cached user coords from sessionStorage if available
  try {
    if (typeof sessionStorage !== 'undefined') {
      const cachedCoordsRaw = sessionStorage.getItem('kstw_user_coords');
      if (cachedCoordsRaw) {
        const coords = JSON.parse(cachedCoordsRaw);
        if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
          const { distancesKm, nearestMensaKey } = computeCanteenDistances(
            Object.keys(CANTEENS),
            CANTEENS,
            coords.lat,
            coords.lon
          );
          state.canteenDistancesKm = distancesKm;
          const selectedMensaKeys = (state.selectedCanteens || []).filter(
            (k) => CANTEENS[k]?.type === 'mensa'
          );
          let minMensaDist = Infinity;
          let userNearestMensaKey = null;
          for (const k of selectedMensaKeys) {
            const d = distancesKm[k];
            if (d != null && d < minMensaDist) {
              minMensaDist = d;
              userNearestMensaKey = k;
            }
          }
          state.nearestMensaKey = userNearestMensaKey || nearestMensaKey;
        }
      }
    }
  } catch {
    // ignore sessionStorage errors
  }

  // Check geolocation permission state and update in background if already granted
  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        if (result && result.state === 'granted') {
          updateUserLocationDistances({ silent: true });
        }
      })
      .catch(() => {});
  }

  registerSW(state, modalState);
  initPullToRefresh(async () => {
    await Promise.all([
      fetchAndRenderMenu({ showLoadingSkeleton: false, silent: false }),
      fetchAnnouncements()
    ]);
  });

  if (state.isFirstVisit) {
    showOnboarding(true, state, modalState, applyLanguage);
  } else {
    checkChangelogPrompt(state, modalState, () => showStatsModal(state, modalState));
    checkAllergenPrompt(state, modalState, () => {
      showOnboarding(false, state, modalState, applyLanguage);
      const detailsEl = document.getElementById('allergen-details-accordion');
      if (detailsEl) {
        detailsEl.open = true;
        setTimeout(() => detailsEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
      }
    });
  }

  checkUpdatedToast(state);
  fetchAnnouncements();
  try {
    await fetchAndRenderMenu({ showLoadingSkeleton: true, silent: false });
  } catch (err) {
    logger.error('Startup menu fetch error:', err);
  } finally {
    const splash = document.getElementById('app-splash');
    if (splash) {
      setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 500);
      }, 300);
    }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('app-container')) init();
    });
  } else if (document.getElementById('app-container')) {
    init();
  }
}
