import { SVG_ICONS } from './data/icons.js';
import { CANTEENS } from './data/canteens.js';
import { TRANSLATIONS } from './data/translations.js';
import { STANDARD_ALLERGENS } from './data/allergens.js';
import {
  ALLERGEN_GROUPS,
  isValidAllergenCode,
  getDishAllergens,
  evaluateDishAllergies,
  shouldExcludeDish
} from './src/lib/allergens.js';
import { getDishDietType } from './src/lib/diet.js';
import {
  stripAllergenCodes,
  cleanDPName,
  parseDishServingTime,
  isDishExpired,
  getDishesServiceWindow,
  extractDishCounter,
  cleanDishNameForFavorite,
  getDishPrice,
  formatPrice,
  isBuffetDish,
  getBuffetPricePer100g,
  calculateBuffetPrice,
  classifyDish,
  isSoupOrStew
} from './src/lib/dish.js';
import { getCanteenKeyFromDish } from './src/lib/canteen-match.js';
import { getCanteenHoursForDay, getCanteenOpenStatus } from './src/lib/hours.js';
import { escapeHtml } from './src/lib/html.js';
import {
  getBerlinTodayDate,
  getDayOfWeekFromIso,
  getFetchDateRange,
  formatDateSelector,
  formatDateHeader,
  pickActiveDate
} from './src/lib/dates.js';
import { needsRefresh } from './src/lib/lifecycle.js';
import {
  resetAppStorage,
  createSettingsDraft,
  migrateStorage,
  getFavoritesV2,
  toggleFavoriteV2,
  isFavoriteV2,
  getTariff,
  setTariff
} from './src/lib/storage.js';
import { validateWeekMenu, validateAnnouncements } from './src/lib/validation.js';
import { trapFocus } from './src/lib/a11y.js';
import {
  aggregateMenuStats,
  computeLiveMenuStats
} from './src/lib/stats.js';
// SUPABASE_CONFIG wird von data/config.js (klassisches Skript, von der GitHub Action verwaltet) global bereitgestellt.

let onboardingFocusRelease = null;
let allergensFocusRelease = null;
let menuFocusRelease = null;
let statsFocusRelease = null;

function getLocalIsoDate(date = new Date()) {
  return getBerlinTodayDate(date);
}

function getIconHTML(name, classes = "") {
  const iconSvg = SVG_ICONS[name] || "";
  return `<span class="inline-flex items-center justify-center ${classes}" style="width: 1.2em; height: 1.2em; vertical-align: middle; line-height: 1;">${iconSvg}</span>`;
}

// 1. Canteen Registry & Metadata


// 2. Translations (Bilingual DE/EN)


// 3. Supabase Credentials (CloudMensa backend configuration)
// Loaded dynamically from data/config.js

// 4. Global State
let state = {
  language: "de",
  selectedCanteens: ["unimensa"],
  diet: "all", // "vegan", "vegetarian", "all"
  activeDate: "", // YYYY-MM-DD
  menuData: [], // parsed days list
  announcements: [], // active announcements from KStW website
  isLoaded: false,
  isSettingsMenu: false,
  isOfflineMode: false,
  isUpdatingBackground: false,
  isManualUpdating: false,
  lastCacheTime: null,
  allergies: [],
  tariff: "student",
  favorites: [],
  hiddenAllergenRevealedCanteens: new Set(),
  lastRenderedDay: null,
  lastLifecycleCheckTime: 0,
  statsOptions: {
    timeframe: "all",
    canteenScope: "selected",
    category: "main",
    isExpanded: false
  }
};

let settingsDraft = null;

function removeSplash() {
  const splash = document.getElementById("app-splash");
  if (splash) {
    splash.classList.add("fade-out");
    setTimeout(() => {
      if (splash.parentNode) {
        splash.parentNode.removeChild(splash);
      }
    }, 500);
  }
}

function checkAllergenPrompt() {
  if (localStorage.getItem("kstw_allergen_prompt_shown") === "true") return;

  const t = TRANSLATIONS[state.language] || TRANSLATIONS.de;
  const modal = document.createElement("div");
  modal.id = "allergen-prompt-modal";
  modal.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in";
  
  modal.innerHTML = `
    <div class="w-full max-w-sm bg-white dark:bg-[#0b1926] rounded-3xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-2xl flex flex-col gap-4 animate-zoom-in">
      <div class="flex items-center gap-3">
        <div class="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex-shrink-0">
          ${getIconHTML('warning', 'text-[28px]')}
        </div>
        <div>
          <h3 class="font-headline text-[18px] font-bold text-text-heading dark:text-white leading-snug">${t.allergenPromptTitle}</h3>
        </div>
      </div>
      <p class="text-sm text-text-main dark:text-slate-200 leading-relaxed">
        ${t.allergenPromptDesc}
      </p>
      <div class="flex gap-3 mt-2">
        <button id="allergen-prompt-no-btn" class="flex-1 h-11 border border-black/[0.08] dark:border-white/[0.08] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform font-label-md text-label-md rounded-xl text-on-surface-variant dark:text-slate-300 font-semibold">
          ${t.allergenPromptNo}
        </button>
        <button id="allergen-prompt-yes-btn" class="flex-1 h-11 bg-price-badge text-primary hover:opacity-90 active:scale-95 transition-transform font-label-md text-label-md rounded-xl font-bold shadow-sm">
          ${t.allergenPromptYes}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add('overflow-hidden');

  // Dismiss listeners
  document.getElementById('allergen-prompt-no-btn').addEventListener('click', () => {
    localStorage.setItem("kstw_allergen_prompt_shown", "true");
    closeModal();
  });

  document.getElementById('allergen-prompt-yes-btn').addEventListener('click', () => {
    localStorage.setItem("kstw_allergen_prompt_shown", "true");
    closeModal();
    // Open settings and expand allergen section
    showOnboarding(true, true);
  });

  function closeModal() {
    document.body.classList.remove('overflow-hidden');
    modal.classList.remove('animate-fade-in');
    modal.classList.add('animate-fade-out');
    const innerDiv = modal.querySelector('div');
    if (innerDiv) {
      innerDiv.classList.remove('animate-zoom-in');
      innerDiv.classList.add('animate-zoom-out');
    }
    setTimeout(() => modal.remove(), 200);
  }
}

function showToast(message, iconName = 'check_circle') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-32px)] max-w-sm bg-[#143d59] dark:bg-[#0b1926] text-white rounded-xl px-4 py-3 shadow-lg flex items-center justify-between gap-3 animate-slide-in border border-black/10 dark:border-white/10';
  
  toast.innerHTML = `
    <div class="flex items-center gap-2.5">
      ${getIconHTML(iconName, 'text-[20px] text-price-badge flex-shrink-0')}
      <span class="text-sm font-semibold tracking-wide">${escapeHtml(message)}</span>
    </div>
    <button id="close-toast-btn" class="text-white/60 hover:text-white transition-colors flex items-center justify-center">${getIconHTML('close', 'text-[18px]')}</button>
  `;

  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    appContainer.appendChild(toast);
  } else {
    document.body.appendChild(toast);
  }

  const dismiss = () => {
    toast.classList.remove('animate-slide-in');
    toast.classList.add('animate-slide-out');
    setTimeout(() => toast.remove(), 300);
  };

  document.getElementById('close-toast-btn')?.addEventListener('click', dismiss);
  setTimeout(() => {
    if (toast.parentNode) dismiss();
  }, 3000);
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    const trans = TRANSLATIONS[state.language] || TRANSLATIONS.de;
    showToast(trans.copiedToClipboard);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}

// 5. Initialize App
window.addEventListener("DOMContentLoaded", async () => {
  // Failsafe: dismiss splash screen after max 3.5 seconds under any network condition
  setTimeout(() => {
    removeSplash();
  }, 3500);

  // Run storage schema migration (v1 -> v2)
  migrateStorage();

  loadPreferences();
  applyLanguage();
  initInstallPrompt();

  // Register PWA Service Worker & check for updates
  registerSW();
  checkUpdatedToast();

  // URL-Parameter und Deep-Links (F6) beim Start auswerten
  const urlParams = new URLSearchParams(window.location.search);
  const paramDate = urlParams.get('date');
  const paramCanteen = urlParams.get('canteen');
  const paramDish = urlParams.get('dish');
  const startView = urlParams.get('view');

  const hasDeepLink = !!(paramDate || paramCanteen || paramDish);

  if (paramCanteen && CANTEENS[paramCanteen]) {
    if (!state.selectedCanteens.includes(paramCanteen)) {
      state.selectedCanteens.push(paramCanteen);
    }
  }

  if (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) {
    state.activeDate = paramDate;
  } else if (startView === 'today') {
    state.activeDate = getLocalIsoDate();
  }

  if (hasPreferences() || hasDeepLink) {
    hideOnboarding();
    await fetchAndRender();
    checkAllergenPrompt();

    if (startView === 'settings') {
      showOnboarding(true);
    }

    if (paramDish) {
      setTimeout(() => {
        const selector = `[data-dish-clean-name="${CSS.escape(paramDish)}"]`;
        const targetEl = document.querySelector(selector);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.classList.add('ring-4', 'ring-primary-container', 'dark:ring-price-badge', 'animate-pulse');
          setTimeout(() => {
            targetEl.classList.remove('ring-4', 'ring-primary-container', 'dark:ring-price-badge', 'animate-pulse');
          }, 3500);
        }
      }, 400);
    }
  } else {
    showOnboarding();
  }

  // Setup Global Event Listeners
  document.getElementById("settings-btn")?.addEventListener("click", () => {
    showOnboarding(true);
  });
  document.getElementById("menu-btn")?.addEventListener("click", () => {
    showAppMenu();
  });
  document.getElementById("app-menu-modal")?.addEventListener("click", e => {
    if (e.target.id === "app-menu-modal") {
      hideAppMenu();
    }
  });
  document.getElementById("stats-modal")?.addEventListener("click", e => {
    if (e.target.id === "stats-modal") {
      hideStatsModal();
    }
  });

  // Theme-Toggle Event Listener
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    document.documentElement.classList.toggle('light', !isDark);
    localStorage.setItem('kstw_theme', isDark ? 'dark' : 'light');
  });

  // System-Preference-Änderungen live verfolgen
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('kstw_theme')) {
      document.documentElement.classList.toggle('dark', e.matches);
      document.documentElement.classList.toggle('light', !e.matches);
    }
  });

  // Share Event Delegation
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.share-btn');
    if (!btn) return;
    const shareTitle = btn.dataset.dishName || 'Mensaplan';
    const shareText = `${btn.dataset.dishName} – ${btn.dataset.dishPrice} | ${btn.dataset.canteenName}`;
    const shareUrl = btn.dataset.shareUrl || window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          await copyTextToClipboard(`${shareText}\n${shareUrl}`);
        }
      }
    } else {
      await copyTextToClipboard(`${shareText}\n${shareUrl}`);
    }
  });

  // Favorites Event Delegation (Normalized Dish Name)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.fav-btn');
    if (!btn) return;
    const cleanName = btn.dataset.dishCleanName;
    if (!cleanName) return;
    const added = toggleFavoriteV2(cleanName);
    state.favorites = getFavoritesV2();
    renderCanteenMenu();
    renderDateSelector(false);
    if ('vibrate' in navigator) navigator.vibrate(added ? [10] : [5]);
  });

  // Buffet Live Calculator Input Delegation
  document.addEventListener('input', e => {
    const input = e.target.closest('[data-action="buffet-calc-input"]');
    if (!input) return;
    const container = input.closest('.buffet-calc-container');
    if (!container) return;
    const resultEl = container.querySelector('.buffet-calc-result');
    if (!resultEl) return;
    const pricePer100g = parseFloat(input.dataset.pricePer100g) || 1.10;
    const grams = parseFloat(input.value) || 0;
    const total = calculateBuffetPrice(pricePer100g, grams);
    resultEl.textContent = formatPrice(total);
  });

  // Unified Data-Action Event Delegation
  document.addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'change-language') {
      changeLanguage(actionEl.dataset.lang);
    } else if (action === 'change-diet-preference') {
      changeDietPreference(actionEl.dataset.diet);
    } else if (action === 'change-tariff-preference') {
      changeTariffPreference(actionEl.dataset.tariff);
    } else if (action === 'toggle-revealed-allergens') {
      const canteen = actionEl.dataset.canteen;
      if (state.hiddenAllergenRevealedCanteens.has(canteen)) {
        state.hiddenAllergenRevealedCanteens.delete(canteen);
      } else {
        state.hiddenAllergenRevealedCanteens.add(canteen);
      }
      renderCanteenMenu();
    } else if (action === 'buffet-quick') {
      const container = actionEl.closest('.buffet-calc-container');
      if (container) {
        const input = container.querySelector('.buffet-grams-input');
        const grams = parseInt(actionEl.dataset.grams, 10);
        if (input && !isNaN(grams)) {
          input.value = grams;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    } else if (action === 'reset-app-prompt' || action === 'reset-app') {
      renderResetConfirm();
    } else if (action === 'reset-app-cancel') {
      renderResetButton();
    } else if (action === 'reset-app-confirm') {
      resetApp();
    } else if (action === 'trigger-manual-reload') {
      triggerManualReload();
    } else if (action === 'set-active-date') {
      setActiveDate(actionEl.dataset.date);
    } else if (action === 'set-diet-filter') {
      setDietFilter(actionEl.dataset.diet);
    } else if (action === 'show-allergens') {
      showAllergens(actionEl.dataset.dishId);
    } else if (action === 'close-allergens-modal') {
      closeAllergensModal();
    } else if (action === 'open-menu') {
      showAppMenu();
    } else if (action === 'close-menu') {
      hideAppMenu();
    } else if (action === 'jump-today') {
      setActiveDate(getLocalIsoDate(), true);
    } else if (action === 'menu-open-settings') {
      hideAppMenu();
      showOnboarding(true);
    } else if (action === 'menu-open-stats') {
      hideAppMenu();
      showStatsModal();
    } else if (action === 'close-stats-modal') {
      hideStatsModal();
    } else if (action === 'stats-set-timeframe') {
      state.statsOptions.timeframe = actionEl.dataset.timeframe;
      renderStatsContent();
    } else if (action === 'stats-set-scope') {
      state.statsOptions.canteenScope = actionEl.dataset.scope;
      renderStatsContent();
    } else if (action === 'stats-set-category') {
      state.statsOptions.category = actionEl.dataset.category;
      renderStatsContent();
    } else if (action === 'stats-toggle-expand') {
      state.statsOptions.isExpanded = !state.statsOptions.isExpanded;
      renderStatsContent();
    } else if (action === 'menu-jump-today') {
      hideAppMenu();
      setActiveDate(getLocalIsoDate(), true);
    } else if (action === 'menu-refresh') {
      hideAppMenu();
      triggerManualReload();
    } else if (action === 'toggle-clamp') {
      const isClamped = actionEl.classList.toggle('line-clamp-2');
      actionEl.setAttribute('aria-expanded', isClamped ? 'false' : 'true');
    } else if (action === 'fetch-and-render') {
      fetchAndRender();
    }
  });

  // Keyboard accessibility: Enter or Space on toggle-clamp role="button"
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const actionEl = e.target.closest('[data-action="toggle-clamp"]');
      if (actionEl) {
        e.preventDefault();
        const isClamped = actionEl.classList.toggle('line-clamp-2');
        actionEl.setAttribute('aria-expanded', isClamped ? 'false' : 'true');
      }
    }
  });

  // Capture image load failures gracefully without inline onerror
  document.addEventListener('error', e => {
    if (e.target && e.target.classList && e.target.classList.contains('dish-image-el')) {
      const col = e.target.closest('.dish-right-col');
      if (col) col.style.display = 'none';
    }
  }, true);

  // Keyboard navigation: Escape key closes active modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const statsModal = document.getElementById('stats-modal');
      if (statsModal && !statsModal.classList.contains('hidden')) {
        hideStatsModal();
        return;
      }
      const menuModal = document.getElementById('app-menu-modal');
      if (menuModal && !menuModal.classList.contains('hidden')) {
        hideAppMenu();
        return;
      }
      const allergensModal = document.getElementById('allergens-modal');
      if (allergensModal && !allergensModal.classList.contains('hidden')) {
        closeAllergensModal();
        return;
      }
      const onboardingModal = document.getElementById('onboarding');
      if (onboardingModal && !onboardingModal.classList.contains('hidden') && state.isSettingsMenu) {
        cancelOnboarding();
        return;
      }
    }
  });

  const closeOnboardingBtn = document.getElementById("close-onboarding-btn");
  if (closeOnboardingBtn) {
    closeOnboardingBtn.addEventListener("click", () => {
      cancelOnboarding();
    });
  }

  const onboardingModal = document.getElementById("onboarding");
  if (onboardingModal) {
    onboardingModal.addEventListener("click", (e) => {
      if (e.target === e.currentTarget && state.isSettingsMenu) {
        cancelOnboarding();
      }
    });
  }

  const allergensModal = document.getElementById("allergens-modal");
  if (allergensModal) {
    allergensModal.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        closeAllergensModal();
      }
    });
  }

  // Debounced Window Resize Layout Listener
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Re-render only if the layout column count changes to avoid thrashing
      const width = window.innerWidth;
      const currentCols = document.getElementById("canteen-col-0")
        ? (document.getElementById("canteen-col-2") ? 3 : 2)
        : 1;
      let targetCols = 1;
      if (width >= 1024) targetCols = 3;
      else if (width >= 768) targetCols = 2;

      if (currentCols !== targetCols) {
        renderCanteenMenu();
      }
    }, 150);
  });

  // App Lifecycle Listeners (tab visibility resume, back/forward cache restore)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      handleAppResume();
    }
  });

  window.addEventListener("pageshow", () => {
    handleAppResume();
  });
});

(function initPullToRefresh() {
  let startY = 0;
  let isPulling = false;
  const threshold = 80; // px

  // Pull-Indicator-Element ins DOM
  const indicator = document.createElement('div');
  indicator.id = 'ptr-indicator';
  indicator.className = 'fixed top-0 left-1/2 -translate-x-1/2 -translate-y-full transition-transform z-50 bg-white dark:bg-[#122338] shadow-md rounded-full p-3 text-primary dark:text-price-badge border border-black/5 dark:border-white/10 flex items-center gap-2';
  indicator.innerHTML = `
    <svg class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
    <span id="ptr-indicator-text" class="text-sm font-medium text-text-heading dark:text-slate-200">Aktualisieren...</span>
  `;
  document.body.prepend(indicator);

  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0 && e.touches && e.touches.length > 0) {
      startY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (startY === 0) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0 && window.scrollY === 0) {
      isPulling = true;
      const progress = Math.min(diff / threshold, 1);
      indicator.style.transform = `translateX(-50%) translateY(${progress * 100}%)`;
    }
  }, { passive: true });

  const resetPull = () => {
    indicator.style.transform = 'translateX(-50%) translateY(-100%)';
    startY = 0;
    isPulling = false;
  };

  document.addEventListener('touchend', () => {
    if (!isPulling) {
      startY = 0;
      return;
    }
    const indicatorY = parseFloat(indicator.style.transform.match(/translateY\((.+)%\)/)?.[1] || 0);
    if (indicatorY >= 100) {
      triggerManualReload();
    }
    resetPull();
  });

  document.addEventListener('touchcancel', () => {
    resetPull();
  });
})();

// 6. Onboarding & Preferences Management


function hasPreferences() {
  return localStorage.getItem("kstw_prefs_saved") === "true";
}

function loadPreferences() {
  state.language = localStorage.getItem("kstw_lang") || "de";
  state.diet = localStorage.getItem("kstw_diet") || "all";
  
  const savedCanteens = localStorage.getItem("kstw_canteens");
  if (savedCanteens) {
    try {
      state.selectedCanteens = JSON.parse(savedCanteens);
      if (!Array.isArray(state.selectedCanteens)) {
        state.selectedCanteens = ["unimensa"];
      }
    } catch (e) {
      console.error("Failed to parse saved canteens:", e);
      state.selectedCanteens = ["unimensa"];
    }
  } else {
    state.selectedCanteens = ["unimensa"];
  }

  const savedAllergies = localStorage.getItem("kstw_allergies");
  if (savedAllergies) {
    try {
      state.allergies = JSON.parse(savedAllergies);
      if (!Array.isArray(state.allergies)) {
        state.allergies = [];
      }
    } catch (e) {
      console.error("Failed to parse saved allergies:", e);
      state.allergies = [];
    }
  } else {
    state.allergies = [];
  }

  state.tariff = getTariff();
  state.favorites = getFavoritesV2();
}

function savePreferences(language, canteens, diet, allergies = [], tariff = 'student') {
  state.language = language;
  state.selectedCanteens = canteens;
  state.diet = diet;
  state.allergies = allergies;
  state.tariff = tariff;

  localStorage.setItem("kstw_lang", language);
  localStorage.setItem("kstw_canteens", JSON.stringify(canteens));
  localStorage.setItem("kstw_diet", diet);
  localStorage.setItem("kstw_allergies", JSON.stringify(allergies));
  setTariff(tariff);
  localStorage.setItem("kstw_prefs_saved", "true");
}

function saveMenuCache(data) {
  try {
    const time = Date.now();
    localStorage.setItem("kstw_menu_cache", JSON.stringify(data));
    localStorage.setItem("kstw_menu_cache_time", time.toString());
    state.lastCacheTime = time;
    if (Array.isArray(data)) {
      aggregateMenuStats(data);
    }
  } catch (err) {
    console.error("Failed to save menu cache:", err);
  }
}

function loadMenuCache() {
  try {
    const cachedData = localStorage.getItem("kstw_menu_cache");
    const cachedTime = localStorage.getItem("kstw_menu_cache_time");
    if (cachedData && cachedTime) {
      const parsed = JSON.parse(cachedData);
      const validation = validateWeekMenu(parsed);
      if (!validation.valid) {
        console.warn("Invalid cached menu schema:", validation.error);
        localStorage.removeItem("kstw_menu_cache");
        localStorage.removeItem("kstw_menu_cache_time");
        return false;
      }
      state.menuData = parsed;
      state.lastCacheTime = parseInt(cachedTime, 10);
      aggregateMenuStats(parsed);
      return true;
    }
  } catch (err) {
    console.error("Failed to load menu cache:", err);
  }
  return false;
}

function saveAnnouncementsCache(data) {
  try {
    localStorage.setItem("kstw_announcements_cache", JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save announcements cache:", err);
  }
}

function loadAnnouncementsCache() {
  try {
    const cached = localStorage.getItem("kstw_announcements_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      const validation = validateAnnouncements(parsed);
      if (validation.valid) {
        state.announcements = parsed;
        return true;
      } else {
        localStorage.removeItem("kstw_announcements_cache");
      }
    }
  } catch (err) {
    console.error("Failed to load announcements cache:", err);
  }
  return false;
}

function formatCacheTime(timestamp) {
  if (!timestamp) return "";
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const t = TRANSLATIONS[state.language];
  if (diffMins < 1) {
    return t.justNow;
  } else if (diffMins < 60) {
    return t.minutesAgo.replace("{n}", diffMins);
  } else {
    const diffHrs = Math.floor(diffMins / 60);
    return t.hoursAgo.replace("{n}", diffHrs);
  }
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  const t = TRANSLATIONS[state.language];
  
  // Update static UI elements
  document.getElementById("app-title").textContent = t.title;
  if (state.isSettingsMenu) {
    document.getElementById("onboarding-title").textContent = t.settings;
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.saveSettings} ${getIconHTML('check', 'text-[20px]')}`;
  } else {
    document.getElementById("onboarding-title").textContent = t.welcome;
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.showMenu} ${getIconHTML('arrow_forward', 'text-[20px]')}`;
  }
  document.getElementById("onboarding-canteen-title").textContent = t.selectCanteens;
  document.getElementById("onboarding-diet-title").textContent = t.selectDiet;

  const ptrTextEl = document.getElementById("ptr-indicator-text");
  if (ptrTextEl) {
    ptrTextEl.textContent = t.pullToRefresh || (state.language === "en" ? "Updating..." : "Aktualisieren...");
  }
  const settingsBtn = document.getElementById("settings-btn");
  if (settingsBtn) {
    settingsBtn.setAttribute("aria-label", t.settingsAria || "Einstellungen öffnen");
  }
  const menuBtn = document.getElementById("menu-btn");
  if (menuBtn) {
    menuBtn.setAttribute("aria-label", t.menuAria || "Hauptmenü öffnen");
  }
  const appMenuTitle = document.getElementById("app-menu-title");
  if (appMenuTitle) {
    appMenuTitle.textContent = t.menuTitle;
  }
  const menuItemSettingsTitle = document.getElementById("menu-item-settings-title");
  if (menuItemSettingsTitle) {
    menuItemSettingsTitle.textContent = t.menuSettings;
  }
  const menuItemStatsTitle = document.getElementById("menu-item-stats-title");
  if (menuItemStatsTitle) {
    menuItemStatsTitle.textContent = t.statsTitle || "Statistiken";
  }
  const menuItemTodayTitle = document.getElementById("menu-item-today-title");
  if (menuItemTodayTitle) {
    menuItemTodayTitle.textContent = t.menuToday;
  }
  const menuItemRefreshTitle = document.getElementById("menu-item-refresh-title");
  if (menuItemRefreshTitle) {
    menuItemRefreshTitle.textContent = t.menuRefresh;
  }
  const menuAboutText = document.getElementById("menu-about-text");
  if (menuAboutText) {
    menuAboutText.textContent = t.menuAboutText;
  }
  const todayBtn = document.getElementById("today-btn");
  if (todayBtn) {
    todayBtn.setAttribute("aria-label", t.todayButtonAria || "Zu heute springen");
    todayBtn.setAttribute("title", t.todayButtonAria || "Zu heute springen");
  }
  const todayBtnText = document.getElementById("today-btn-text");
  if (todayBtnText) {
    todayBtnText.textContent = t.todayButton || "Heute";
  }
  const statsModalTitle = document.getElementById("stats-modal-title");
  if (statsModalTitle) {
    statsModalTitle.textContent = t.statsTitle || "Mensa-Statistiken";
  }
  const statsModalSub = document.getElementById("stats-modal-subheading");
  if (statsModalSub) {
    statsModalSub.textContent = t.statsSubheading || "Auswertung der Angebote & Trends";
  }
  const statsStorageBadge = document.getElementById("stats-storage-badge");
  if (statsStorageBadge) {
    statsStorageBadge.textContent = t.statsStorageBadge || "🌱 Extrem speicherplatzsparend (< 2 KB lokal)";
  }
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.setAttribute("aria-label", t.themeToggleAria || "Farbschema wechseln");
  }
  const closeOnboarding = document.getElementById("close-onboarding-btn");
  if (closeOnboarding) {
    closeOnboarding.setAttribute("aria-label", t.close || "Schließen");
  }
  const closeMenuBtn = document.getElementById("close-menu-btn");
  if (closeMenuBtn) {
    closeMenuBtn.setAttribute("aria-label", t.close || "Schließen");
  }
  const closeStatsBtn = document.getElementById("close-stats-modal-btn");
  if (closeStatsBtn) {
    closeStatsBtn.setAttribute("aria-label", t.close || "Schließen");
  }
  const closeAllergens = document.getElementById("close-allergens-modal-btn");
  if (closeAllergens) {
    closeAllergens.setAttribute("aria-label", t.close || "Schließen");
  }
}

// 7. Onboarding & Settings UI Rendering
function initOnboardingUI() {
  if (!settingsDraft) {
    settingsDraft = createSettingsDraft(state);
  }
  const currentLang = settingsDraft.language || state.language;
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.de;

  // Render Language Buttons
  const langContainer = document.getElementById("lang-selector");
  langContainer.innerHTML = `
    <button id="lang-de" data-action="change-language" data-lang="de" class="px-6 py-2 rounded-full border shadow-sm font-label-md text-label-md transition-all focus:outline-none ${currentLang === "de" ? "bg-[#143d59] dark:bg-price-badge text-white dark:text-primary border-[#143d59] dark:border-price-badge font-bold" : "bg-slate-50 dark:bg-[#0b1926] text-on-surface-variant dark:text-slate-300 border-black/[0.08] dark:border-white/[0.08]"}">Deutsch</button>
    <button id="lang-en" data-action="change-language" data-lang="en" class="px-6 py-2 rounded-full border shadow-sm font-label-md text-label-md transition-all focus:outline-none ${currentLang === "en" ? "bg-[#143d59] dark:bg-price-badge text-white dark:text-primary border-[#143d59] dark:border-price-badge font-bold" : "bg-slate-50 dark:bg-[#0b1926] text-on-surface-variant dark:text-slate-300 border-black/[0.08] dark:border-white/[0.08]"}">English</button>
  `;

  // Render Canteen Checkbox List (Clustered into Canteens and Bistros)
  const canteenListContainer = document.getElementById("canteen-checkbox-list");
  canteenListContainer.innerHTML = "";
  
  const canteensHTML = [];
  const bistrosHTML = [];

  Object.keys(CANTEENS).forEach(key => {
    const canteen = CANTEENS[key];
    const isChecked = settingsDraft.selectedCanteens.includes(key) ? "checked" : "";
    const isBistro = canteen.type === "bistro";
    
    const itemHTML = `
      <label class="flex items-center gap-3 cursor-pointer min-h-[40px] p-2 hover:bg-slate-100 dark:hover:bg-[#182c44]/80 rounded-lg transition-colors group">
        <div class="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
          <input type="checkbox" value="${key}" ${isChecked} class="canteen-checkbox checkbox-custom opacity-0 absolute w-full h-full cursor-pointer z-10"/>
          <div class="w-4 h-4 rounded-sm border-2 border-outline-variant dark:border-slate-600 bg-surface-container-lowest dark:bg-[#0b1926] flex items-center justify-center transition-colors">
            <svg class="hidden w-3 h-3 text-white dark:text-primary pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></path>
            </svg>
          </div>
        </div>
        <span class="font-body-md text-body-md text-text-main dark:text-slate-300 group-hover:text-text-heading dark:group-hover:text-white">${canteen.name}</span>
      </label>
    `;

    if (isBistro) {
      bistrosHTML.push(itemHTML);
    } else {
      canteensHTML.push(itemHTML);
    }
  });

  const canteenLabel = currentLang === "de" ? "Mensen" : "Canteens";
  const bistroLabel = "Bistros & Cafés";

  canteenListContainer.innerHTML = `
    <details class="group border-b border-black/5 dark:border-white/[0.08] pb-2" open>
      <summary class="flex justify-between items-center font-headline text-[15px] font-bold text-text-heading dark:text-white cursor-pointer list-none py-1.5 select-none">
        <span class="flex items-center gap-2">
          ${getIconHTML('restaurant', 'text-[18px]')}
          ${canteenLabel}
        </span>
        ${getIconHTML('expand_more', 'text-[20px] transition-transform duration-200 group-open:rotate-180')}
      </summary>
      <div class="flex flex-col gap-0.5 mt-1 pl-1">
        ${canteensHTML.join("")}
      </div>
    </details>

    <details class="group pt-2">
      <summary class="flex justify-between items-center font-headline text-[15px] font-bold text-text-heading dark:text-white cursor-pointer list-none py-1.5 select-none">
        <span class="flex items-center gap-2">
          ${getIconHTML('local_cafe', 'text-[18px]')}
          ${bistroLabel}
        </span>
        ${getIconHTML('expand_more', 'text-[20px] transition-transform duration-200 group-open:rotate-180')}
      </summary>
      <div class="flex flex-col gap-0.5 mt-1 pl-1">
        ${bistrosHTML.join("")}
      </div>
    </details>
  `;

  // Setup Custom Checkbox Visual States
  document.querySelectorAll(".canteen-checkbox").forEach(chk => {
    const box = chk.nextElementSibling;
    const updateBox = () => {
      if (chk.checked) {
        box.classList.add("bg-primary-container", "border-primary-container");
        box.querySelector("svg").classList.remove("hidden");
      } else {
        box.classList.remove("bg-primary-container", "border-primary-container");
        box.querySelector("svg").classList.add("hidden");
      }
      
      const checkedBoxes = document.querySelectorAll(".canteen-checkbox:checked");
      if (settingsDraft) {
        settingsDraft.selectedCanteens = Array.from(checkedBoxes).map(cb => cb.value);
      }
    };
    updateBox();
    chk.addEventListener("change", updateBox);
  });

  // Render Diet Preferences Selector
  const dietContainer = document.getElementById("diet-selector");
  const options = [
    { value: "vegan", label: "Vegan 🌱" },
    { value: "vegetarian", label: `${t.vegetarian} 🥕` },
    { value: "all", label: `${t.all} 🥩` }
  ];
  dietContainer.innerHTML = "";
  options.forEach(opt => {
    const isActive = settingsDraft.diet === opt.value;
    dietContainer.innerHTML += `
      <button data-action="change-diet-preference" data-diet="${opt.value}" class="diet-option-btn flex-1 py-2 font-label-md text-label-md text-center rounded transition-colors focus:outline-none ${isActive ? "bg-price-badge text-primary font-bold shadow-sm" : "text-on-surface-variant dark:text-slate-300 opacity-70 hover:opacity-100"}">
        ${opt.label}
      </button>
    `;
  });

  // Render Tariff Preferences Selector
  const tariffContainer = document.getElementById("tariff-selector");
  if (tariffContainer) {
    const tariffTitle = document.getElementById("onboarding-tariff-title");
    if (tariffTitle) tariffTitle.textContent = t.tariffLabel;
    const tariffOptions = [
      { value: "student", label: t.tariffStudents },
      { value: "employee", label: t.tariffEmployees },
      { value: "guest", label: t.tariffGuests },
      { value: "external", label: t.tariffExternal }
    ];
    tariffContainer.innerHTML = "";
    tariffOptions.forEach(opt => {
      const currentTariff = settingsDraft ? (settingsDraft.tariff || state.tariff) : state.tariff;
      const isActive = currentTariff === opt.value;
      tariffContainer.innerHTML += `
        <button data-action="change-tariff-preference" data-tariff="${opt.value}" class="tariff-option-btn py-2 px-1 text-xs font-semibold text-center rounded transition-colors focus:outline-none ${isActive ? "bg-price-badge text-primary font-bold shadow-sm" : "text-on-surface-variant dark:text-slate-300 opacity-70 hover:opacity-100"}">
          ${opt.label}
        </button>
      `;
    });
  }

  // Render Allergen Accordion labels & checkboxes
  document.getElementById("onboarding-allergen-icon").innerHTML = getIconHTML('warning', 'text-[18px]');
  document.getElementById("onboarding-allergen-title").textContent = t.allergenTitle;
  document.getElementById("onboarding-allergen-arrow").innerHTML = getIconHTML('expand_more', 'text-[20px] transition-transform duration-200 group-open:rotate-180');
  document.getElementById("onboarding-allergen-desc").textContent = t.allergenDesc;
  document.getElementById("allergen-warning-icon").innerHTML = getIconHTML('info', 'text-[14px]');
  document.getElementById("onboarding-allergen-warning").textContent = t.allergenWarning;

  const allergenListContainer = document.getElementById("allergen-checkbox-list");
  allergenListContainer.innerHTML = "";
  
  Object.keys(ALLERGEN_GROUPS).forEach(key => {
    const group = ALLERGEN_GROUPS[key];
    const isChecked = settingsDraft.allergies.includes(key) ? "checked" : "";
    const name = currentLang === "en" ? group.en : group.de;
    
    allergenListContainer.innerHTML += `
      <label class="flex items-center gap-3 cursor-pointer min-h-[40px] p-2 hover:bg-slate-100 dark:hover:bg-[#182c44]/80 rounded-lg transition-colors group">
        <div class="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
          <input type="checkbox" value="${key}" ${isChecked} class="allergy-checkbox checkbox-custom opacity-0 absolute w-full h-full cursor-pointer z-10"/>
          <div class="w-4 h-4 rounded-sm border-2 border-outline-variant dark:border-slate-600 bg-surface-container-lowest dark:bg-[#0b1926] flex items-center justify-center transition-colors">
            <svg class="hidden w-3 h-3 text-white dark:text-primary pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></path>
            </svg>
          </div>
        </div>
        <span class="font-body-md text-body-md text-text-main dark:text-slate-300 group-hover:text-text-heading dark:group-hover:text-white">${name}</span>
      </label>
    `;
  });

  // Setup Custom Checkbox Visual States for Allergies
  document.querySelectorAll(".allergy-checkbox").forEach(chk => {
    const box = chk.nextElementSibling;
    const updateBox = () => {
      if (chk.checked) {
        box.classList.add("bg-primary-container", "border-primary-container");
        box.querySelector("svg").classList.remove("hidden");
      } else {
        box.classList.remove("bg-primary-container", "border-primary-container");
        box.querySelector("svg").classList.add("hidden");
      }
      
      const checkedBoxes = document.querySelectorAll(".allergy-checkbox:checked");
      if (settingsDraft) {
        settingsDraft.allergies = Array.from(checkedBoxes).map(cb => cb.value);
      }
    };
    updateBox();
    chk.addEventListener("change", updateBox);
  });

  // Setup Submit Button Handler
  document.getElementById("submit-onboarding-btn").onclick = async () => {
    const draft = settingsDraft || createSettingsDraft(state);
    
    if (draft.selectedCanteens.length === 0) {
      const trans = TRANSLATIONS[draft.language] || TRANSLATIONS.de;
      showToast(trans.selectAtLeastOneCanteen, 'warning');
      return;
    }

    savePreferences(draft.language, draft.selectedCanteens, draft.diet, draft.allergies, draft.tariff);
    localStorage.setItem("kstw_allergen_prompt_shown", "true");
    applyLanguage();
    settingsDraft = null;
    hideOnboarding();
    await fetchAndRender();
  };
}

function updateOnboardingHeaderAndButtons() {
  const currentLang = settingsDraft ? settingsDraft.language : state.language;
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.de;
  const closeBtn = document.getElementById("close-onboarding-btn");
  
  if (state.isSettingsMenu) {
    if (closeBtn) closeBtn.classList.remove("hidden");
    document.getElementById("onboarding-title").textContent = t.settings;
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.saveSettings} ${getIconHTML('check', 'text-[20px]')}`;
    renderResetButton(t);
  } else {
    if (closeBtn) closeBtn.classList.add("hidden");
    document.getElementById("onboarding-title").textContent = t.welcome;
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.showMenu} ${getIconHTML('arrow_forward', 'text-[20px]')}`;
    const resetContainer = document.getElementById("reset-container");
    if (resetContainer && resetContainer.parentNode) {
      resetContainer.parentNode.removeChild(resetContainer);
    }
  }
}

function changeLanguage(lang) {
  if (settingsDraft) {
    settingsDraft.language = lang;
    initOnboardingUI();
    initInstallPrompt();
    updateOnboardingHeaderAndButtons();
  } else {
    state.language = lang;
    applyLanguage();
  }
}
window.changeLanguage = changeLanguage;

function changeDietPreference(diet) {
  if (settingsDraft) {
    settingsDraft.diet = diet;
    initOnboardingUI();
  }
}
window.changeDietPreference = changeDietPreference;

function changeTariffPreference(tariff) {
  if (settingsDraft) {
    settingsDraft.tariff = tariff;
    initOnboardingUI();
  } else {
    state.tariff = tariff;
    setTariff(tariff);
    renderCanteenMenu();
  }
}
window.changeTariffPreference = changeTariffPreference;

function showOnboarding(isSettingsMenu = false, expandAllergens = false) {
  state.isSettingsMenu = isSettingsMenu;
  settingsDraft = createSettingsDraft(state);
  
  const onboarding = document.getElementById("onboarding");
  onboarding.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  
  initOnboardingUI();
  updateOnboardingHeaderAndButtons();
  
  // Expand or collapse the allergen accordion based on flag
  const accordion = document.getElementById("allergen-details-accordion");
  if (accordion) {
    if (expandAllergens) {
      accordion.open = true;
      setTimeout(() => {
        accordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    } else {
      accordion.open = false;
    }
  }
  
  initInstallPrompt();
  removeSplash();
  onboardingFocusRelease = trapFocus(onboarding);
}

function cancelOnboarding() {
  if (state.isSettingsMenu) {
    settingsDraft = null;
    applyLanguage(); // Revert any language previewed in draft
    hideOnboarding();
  }
}

function hideOnboarding() {
  state.isSettingsMenu = false;
  settingsDraft = null;
  document.getElementById("onboarding").classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
  if (onboardingFocusRelease) {
    onboardingFocusRelease();
    onboardingFocusRelease = null;
  }
}

function showAppMenu() {
  const modal = document.getElementById("app-menu-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  menuFocusRelease = trapFocus(modal);
}

function hideAppMenu() {
  const modal = document.getElementById("app-menu-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
  if (menuFocusRelease) {
    menuFocusRelease();
    menuFocusRelease = null;
  }
}

function renderStatsContent() {
  const content = document.getElementById("stats-modal-content");
  if (!content) return;

  const t = TRANSLATIONS[state.language] || TRANSLATIONS.de;
  const currentTariff = state.tariff || 'student';
  const stats = computeLiveMenuStats(state.menuData || [], {
    timeframe: state.statsOptions.timeframe,
    canteenScope: state.statsOptions.canteenScope,
    selectedCanteens: state.selectedCanteens,
    canteensMap: CANTEENS,
    category: state.statsOptions.category,
    tariff: currentTariff,
    favorites: state.favorites || [],
    todayIso: getBerlinTodayDate()
  });

  if (!state.menuData || state.menuData.length === 0) {
    content.innerHTML = `
      <div class="text-center py-8 text-slate-500 dark:text-slate-400">
        <p class="text-sm font-medium">${escapeHtml(t.statsNoData || "Noch keine Menüdaten vorhanden.")}</p>
      </div>
    `;
    return;
  }

  const { timeframe, canteenScope, category, isExpanded } = state.statsOptions;

  // Selected canteens text for banner
  let scopeInfoText = "";
  if (canteenScope === 'selected') {
    const selectedNames = (state.selectedCanteens || [])
      .map(k => CANTEENS[k] ? CANTEENS[k].name : k)
      .filter(Boolean);
    scopeInfoText = selectedNames.length > 0 ? selectedNames.join(", ") : (t.statsScopeAll || "Alle Mensen");
  } else {
    scopeInfoText = t.statsScopeAll || "Alle Kölner Mensen";
  }

  // Dietary percentages
  const veganPct = stats.veganPct || 0;
  const vegPct = stats.vegetarianPct || 0;
  const meatPct = stats.meatPct || 0;

  // Top dishes list
  const displayDishes = isExpanded ? stats.allDishes : stats.topDishes;
  const hasMore = stats.allDishes.length > 5;

  const getRankBadge = (rank) => {
    if (rank === 1) return `<span class="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-extrabold flex items-center justify-center text-xs">🥇</span>`;
    if (rank === 2) return `<span class="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold flex items-center justify-center text-xs">🥈</span>`;
    if (rank === 3) return `<span class="w-5 h-5 rounded-full bg-amber-200/70 dark:bg-amber-800/40 text-amber-800 dark:text-amber-400 font-extrabold flex items-center justify-center text-xs">🥉</span>`;
    return `<span class="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center text-[10px]">${rank}.</span>`;
  };

  const getDietIcon = (diet) => {
    if (diet === 'vegan') return `<span class="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold" title="${escapeHtml(t.statsVegan)}">🌱 ${escapeHtml(t.statsVegan)}</span>`;
    if (diet === 'vegetarian') return `<span class="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold" title="${escapeHtml(t.statsVegetarian)}">🧀 ${escapeHtml(t.statsVegetarian)}</span>`;
    return `<span class="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-100/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold" title="${escapeHtml(t.statsMeat)}">🥩 ${escapeHtml(t.statsMeat)}</span>`;
  };

  const topDishesHTML = displayDishes.length > 0 ? displayDishes.map(item => `
    <li class="flex items-start justify-between gap-2.5 py-2.5 border-b border-slate-100 dark:border-white/5 last:border-0">
      <div class="flex items-start gap-2.5 min-w-0">
        <div class="flex-shrink-0 mt-0.5">
          ${getRankBadge(item.rank)}
        </div>
        <div class="flex flex-col min-w-0">
          <span class="text-xs font-bold text-slate-800 dark:text-slate-100 break-words leading-tight">${escapeHtml(item.name)}</span>
          <div class="flex items-center gap-1.5 mt-1 flex-wrap">
            ${getDietIcon(item.diet)}
            ${item.price != null && item.price > 0 ? `<span class="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-md">${formatPrice(item.price)}</span>` : ""}
            ${item.dates && item.dates.length > 1 ? `<span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">${escapeHtml(t.statsServedOnDays.replace('{count}', String(item.dates.length)))}</span>` : ""}
          </div>
        </div>
      </div>
      <span class="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#182c44] text-xs font-black text-slate-800 dark:text-slate-100 flex-shrink-0 border border-slate-200/50 dark:border-white/5">
        ${item.count}×
      </span>
    </li>
  `).join("") : `
    <li class="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
      ${escapeHtml(t.statsNoDishesFound)}
    </li>
  `;

  // Matched favorites section
  const favHTML = stats.activeFavoritesCount > 0 ? `
    <div class="flex flex-col gap-1.5 p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <span class="text-amber-500 font-extrabold text-sm">★</span>
          <span class="font-bold text-amber-900 dark:text-amber-200">${escapeHtml(t.statsFavoritesFound)}</span>
        </div>
        <span class="font-black text-amber-700 dark:text-amber-300 text-xs px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/50">${stats.activeFavoritesCount}</span>
      </div>
      <div class="flex flex-wrap gap-1.5 mt-1">
        ${stats.matchedFavorites.map(f => `
          <span class="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-amber-900/30 text-[11px] font-bold text-amber-900 dark:text-amber-200 border border-amber-200/50 dark:border-amber-800/40">
            ${escapeHtml(f.name)} (${f.count}×)
          </span>
        `).join("")}
      </div>
    </div>
  ` : "";

  // Category title label
  const catLabel = category === 'main' ? t.statsCatMain : (category === 'side' ? t.statsCatSide : (category === 'dessert' ? t.statsCatDessert : t.statsCatAll));

  content.innerHTML = `
    <!-- 1. Timeframe & Scope Card -->
    <div class="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-[#182c44]/80 border border-slate-200/70 dark:border-white/[0.08] text-xs">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <span class="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
          📅 ${escapeHtml(t.statsTimeframe)}: <span class="font-extrabold text-primary-container dark:text-price-badge">${escapeHtml(stats.timeframe.formattedRange || "—")}</span>
        </span>
        <span class="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
          ${stats.timeframe.activeDaysCount} ${escapeHtml(t.statsOpenDays)}
        </span>
      </div>
      <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate" title="${escapeHtml(scopeInfoText)}">
        🏛️ ${escapeHtml(scopeInfoText)}
      </div>

      <!-- Controls Row: Timeframe & Scope -->
      <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-white/5 flex-wrap">
        <!-- Timeframe Toggle -->
        <div class="inline-flex rounded-xl bg-slate-200/60 dark:bg-slate-800 p-0.5 text-[11px]">
          <button type="button" data-action="stats-set-timeframe" data-timeframe="all" class="px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${timeframe === 'all' ? 'bg-white dark:bg-[#122338] text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}">
            ${escapeHtml(t.statsAllWeeks)}
          </button>
          <button type="button" data-action="stats-set-timeframe" data-timeframe="week" class="px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${timeframe === 'week' ? 'bg-white dark:bg-[#122338] text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}">
            ${escapeHtml(t.statsThisWeek)}
          </button>
        </div>

        <!-- Scope Toggle -->
        <div class="inline-flex rounded-xl bg-slate-200/60 dark:bg-slate-800 p-0.5 text-[11px]">
          <button type="button" data-action="stats-set-scope" data-scope="selected" class="px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${canteenScope === 'selected' ? 'bg-white dark:bg-[#122338] text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}">
            ${escapeHtml(t.statsScopeMy)}
          </button>
          <button type="button" data-action="stats-set-scope" data-scope="all" class="px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${canteenScope === 'all' ? 'bg-white dark:bg-[#122338] text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}">
            ${escapeHtml(t.statsScopeAll)}
          </button>
        </div>
      </div>
    </div>

    <!-- 2. Category Filter Pills -->
    <div class="flex items-center gap-1.5 overflow-x-auto hide-scrollbar text-xs">
      <button type="button" data-action="stats-set-category" data-category="main" class="px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${category === 'main' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs' : 'bg-slate-100 dark:bg-[#182c44] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60'}">
        🍲 ${escapeHtml(t.statsCatMain)}
      </button>
      <button type="button" data-action="stats-set-category" data-category="side" class="px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${category === 'side' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs' : 'bg-slate-100 dark:bg-[#182c44] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60'}">
        🥗 ${escapeHtml(t.statsCatSide)}
      </button>
      <button type="button" data-action="stats-set-category" data-category="dessert" class="px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer ${category === 'dessert' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs' : 'bg-slate-100 dark:bg-[#182c44] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60'}">
        🍮 ${escapeHtml(t.statsCatDessert)}
      </button>
    </div>

    <!-- 3. Diet Distribution -->
    <div class="flex flex-col gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#182c44]/80 border border-slate-200/70 dark:border-white/[0.08]">
      <div class="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-white">
        <span>${escapeHtml(t.statsDietDist)} (${escapeHtml(catLabel)})</span>
        <span class="text-slate-500 dark:text-slate-400 font-normal text-[11px]">${stats.totalDishes} ${escapeHtml(t.statsDishesTotal)}</span>
      </div>

      <!-- Segmented Bar -->
      <div class="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex shadow-inner">
        <div style="width: ${veganPct}%" class="bg-emerald-500 transition-all duration-500" title="${escapeHtml(t.statsVegan)}: ${veganPct}%"></div>
        <div style="width: ${vegPct}%" class="bg-amber-400 transition-all duration-500" title="${escapeHtml(t.statsVegetarian)}: ${vegPct}%"></div>
        <div style="width: ${meatPct}%" class="bg-rose-400 transition-all duration-500" title="${escapeHtml(t.statsMeat)}: ${meatPct}%"></div>
      </div>

      <!-- Badges -->
      <div class="grid grid-cols-3 gap-2 pt-1 text-center">
        <div class="flex flex-col items-center p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/30">
          <span class="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">${escapeHtml(t.statsVegan)}</span>
          <span class="text-xs font-extrabold text-emerald-800 dark:text-emerald-200">${veganPct}% <span class="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">(${stats.veganCount})</span></span>
        </div>
        <div class="flex flex-col items-center p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/30">
          <span class="text-[10px] font-medium text-amber-700 dark:text-amber-300">${escapeHtml(t.statsVegetarian)}</span>
          <span class="text-xs font-extrabold text-amber-800 dark:text-amber-200">${vegPct}% <span class="text-[10px] font-normal text-amber-600 dark:text-amber-400">(${stats.vegetarianCount})</span></span>
        </div>
        <div class="flex flex-col items-center p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/30">
          <span class="text-[10px] font-medium text-rose-700 dark:text-rose-300">${escapeHtml(t.statsMeat)}</span>
          <span class="text-xs font-extrabold text-rose-800 dark:text-rose-200">${meatPct}% <span class="text-[10px] font-normal text-rose-600 dark:text-rose-400">(${stats.meatCount})</span></span>
        </div>
      </div>
    </div>

    <!-- 4. Prices -->
    <div class="flex flex-col gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#182c44]/80 border border-slate-200/70 dark:border-white/[0.08]">
      <span class="text-xs font-bold text-slate-800 dark:text-white">${escapeHtml(t.statsPricesTitle)}</span>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="flex flex-col items-center justify-center min-w-0 p-2 rounded-xl bg-white dark:bg-[#122338] border border-slate-200/60 dark:border-white/5">
          <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight break-words">${escapeHtml(t.statsAvgPrice)}</span>
          <span class="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">${stats.avgPrice != null ? formatPrice(stats.avgPrice) : "—"}</span>
        </div>
        <div class="flex flex-col items-center justify-center min-w-0 p-2 rounded-xl bg-white dark:bg-[#122338] border border-slate-200/60 dark:border-white/5">
          <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight break-words">${escapeHtml(t.statsMinPrice)}</span>
          <span class="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">${stats.minPrice != null ? formatPrice(stats.minPrice) : "—"}</span>
        </div>
        <div class="flex flex-col items-center justify-center min-w-0 p-2 rounded-xl bg-white dark:bg-[#122338] border border-slate-200/60 dark:border-white/5">
          <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight break-words">${escapeHtml(t.statsMaxPrice)}</span>
          <span class="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">${stats.maxPrice != null ? formatPrice(stats.maxPrice) : "—"}</span>
        </div>
      </div>
    </div>

    <!-- 5. Favorites Match (if present) -->
    ${favHTML}

    <!-- 6. Dish Frequency Ranking (Expandable) -->
    <div class="flex flex-col gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#182c44]/80 border border-slate-200/70 dark:border-white/[0.08]">
      <div class="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-white">
        <span>${escapeHtml(t.statsTopDishes)}: ${escapeHtml(catLabel)}</span>
        <span class="text-slate-500 dark:text-slate-400 font-normal text-[11px]">${displayDishes.length} / ${stats.allDishes.length}</span>
      </div>
      <ul class="flex flex-col divide-y divide-slate-100 dark:divide-white/5">
        ${topDishesHTML}
      </ul>

      ${hasMore ? `
        <button type="button" data-action="stats-toggle-expand" class="w-full mt-1.5 py-2 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#122338] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200/60 dark:border-white/5 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98">
          ${isExpanded ? `⌃ ${escapeHtml(t.statsShowLess)}` : `⌄ ${escapeHtml(t.statsShowMore.replace('{count}', String(stats.allDishes.length)))}`}
        </button>
      ` : ""}
    </div>
  `;
}

function showStatsModal() {
  const modal = document.getElementById("stats-modal");
  if (!modal) return;
  state.statsOptions.isExpanded = false;
  renderStatsContent();
  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  statsFocusRelease = trapFocus(modal);
}

function hideStatsModal() {
  const modal = document.getElementById("stats-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
  if (statsFocusRelease) {
    statsFocusRelease();
    statsFocusRelease = null;
  }
}

function renderResetButton(t = null) {
  const currentLang = settingsDraft ? settingsDraft.language : state.language;
  const trans = t || TRANSLATIONS[currentLang] || TRANSLATIONS.de;
  let resetContainer = document.getElementById("reset-container");
  if (!resetContainer) {
    resetContainer = document.createElement("div");
    resetContainer.id = "reset-container";
    resetContainer.className = "mt-4 flex justify-center";
    const contentArea = document.getElementById("onboarding-content-area");
    if (contentArea) contentArea.appendChild(resetContainer);
  }
  resetContainer.innerHTML = `
    <button data-action="reset-app-prompt" class="px-4 py-2 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-colors font-label-md text-label-md">
      ${trans.resetBtn}
    </button>
  `;
}

function renderResetConfirm(t = null) {
  const currentLang = settingsDraft ? settingsDraft.language : state.language;
  const trans = t || TRANSLATIONS[currentLang] || TRANSLATIONS.de;
  let resetContainer = document.getElementById("reset-container");
  if (!resetContainer) return;
  resetContainer.innerHTML = `
    <div class="flex items-center gap-3 animate-fade-in">
      <button data-action="reset-app-confirm" class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl text-label-md shadow-sm transition-all">
        ${trans.resetConfirmBtn || "Wirklich zurücksetzen?"}
      </button>
      <button data-action="reset-app-cancel" class="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium rounded-xl text-label-md transition-all">
        ${trans.resetCancelBtn || "Abbrechen"}
      </button>
    </div>
  `;
}

function resetApp() {
  resetAppStorage();
  location.reload();
}
window.resetApp = resetApp;

// PWA Onboarding Installation Helper
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  initInstallPrompt();
});

function isAppStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function initInstallPrompt() {
  const isStandalone = isAppStandalone();
  const installCard = document.getElementById("install-promo-card");
  if (!installCard) return;

  if (isStandalone) {
    installCard.classList.add("hidden");
    return;
  }

  const t = TRANSLATIONS[state.language];

  // Update text values
  document.getElementById("install-title").innerHTML = `
    ${getIconHTML('cell_tower', 'text-primary-container dark:text-price-badge text-[18px]')}
    ${t.installTitle}
  `;
  document.getElementById("install-desc").textContent = t.installDesc;
  document.getElementById("badge-privacy").textContent = t.privacyBadge;
  document.getElementById("badge-size").textContent = t.sizeBadge;
  document.getElementById("badge-perms").textContent = t.permissionsBadge;
  document.getElementById("badge-offline").textContent = t.offlineBadge;

  const actionsContainer = document.getElementById("install-actions");
  if (!actionsContainer) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS) {
    actionsContainer.innerHTML = `
      <div class="bg-primary/5 dark:bg-[#0b1926] border border-primary/20 dark:border-white/[0.08] rounded-xl p-3 text-sm text-text-heading dark:text-slate-200 leading-relaxed flex items-start gap-2">
        ${getIconHTML('info', 'text-[20px] text-primary-fixed-dim dark:text-price-badge mt-0.5')}
        <div>
          ${t.iosInstall}
        </div>
      </div>
    `;
    installCard.classList.remove("hidden");
  } else {
    actionsContainer.innerHTML = `
      <button id="native-install-btn" class="w-full py-2 bg-primary dark:bg-price-badge text-white dark:text-primary font-bold rounded-xl shadow-md hover:bg-primary/95 dark:hover:bg-price-badge/90 transition-colors flex items-center justify-center gap-1.5 active:scale-98 transition-transform">
        ${getIconHTML('download', 'text-[18px]')}
        ${t.installBtn}
      </button>
    `;

    installCard.classList.remove("hidden");
    
    const btn = document.getElementById("native-install-btn");
    if (btn) {
      btn.onclick = () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              installCard.classList.add("hidden");
            }
            deferredPrompt = null;
          });
        } else {
          const trans = TRANSLATIONS[state.language] || TRANSLATIONS.de;
          showToast(trans.installGuideToast, 'cell_tower');
        }
      };
    }
  }
}

// 8. API Fetching & Recovery (Supreme CORS-Proxy Fallback)
function hasDishesForSelectedCanteensAndDiet(dateStr) {
  const dayData = state.menuData.find(d => d.date === dateStr);
  if (!dayData || !dayData.dishes || dayData.dishes.length === 0) return false;

  let validDishesCount = 0;

  state.selectedCanteens.forEach(canteenKey => {
    const canteen = CANTEENS[canteenKey];
    if (!canteen) return;

    let dishes = dayData.dishes.filter(dish => getCanteenKeyFromDish(dish, canteenKey, canteen));
    
    // Filter by diet
    if (state.diet === "vegan") {
      dishes = dishes.filter(d => getDishDietType(d) === "vegan");
    } else if (state.diet === "vegetarian") {
      dishes = dishes.filter(d => getDishDietType(d) === "vegan" || getDishDietType(d) === "vegetarian");
    }

    // Filter by allergies
    if (state.allergies && state.allergies.length > 0) {
      dishes = dishes.filter(d => !shouldExcludeDish(d, state.allergies));
    }

    validDishesCount += dishes.length;
  });

  return validDishesCount > 0;
}

function hasAvailableDishesForDate(dateStr) {
  if (!hasDishesForSelectedCanteensAndDiet(dateStr)) return false;

  const todayIso = getLocalIsoDate();
  if (dateStr < todayIso) return false; // Past days are not available
  if (dateStr > todayIso) return true;  // Future days are assumed open

  // For today, check if there's at least one valid dish that has not expired yet
  const dayData = state.menuData.find(d => d.date === dateStr);
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  
  let validDishesCount = 0;

  state.selectedCanteens.forEach(canteenKey => {
    const canteen = CANTEENS[canteenKey];
    if (!canteen) return;

    let dishes = dayData.dishes.filter(dish => getCanteenKeyFromDish(dish, canteenKey, canteen));
    
    // Filter by diet
    if (state.diet === "vegan") {
      dishes = dishes.filter(d => getDishDietType(d) === "vegan");
    } else if (state.diet === "vegetarian") {
      dishes = dishes.filter(d => getDishDietType(d) === "vegan" || getDishDietType(d) === "vegetarian");
    }

    // Filter by allergies
    if (state.allergies && state.allergies.length > 0) {
      dishes = dishes.filter(d => !shouldExcludeDish(d, state.allergies));
    }

    const dayHours = getCanteenHoursForDay(canteenKey, now.getDay(), canteen, state.language);
    dishes.forEach(dish => {
      const hasExplicitTime = parseDishServingTime(dish);
      let expired = false;
      if (hasExplicitTime) {
        expired = isDishExpired(dish, currentHour);
      } else {
        expired = dayHours.isOpenToday && currentHour > dayHours.endHour;
      }

      if (!expired) {
        validDishesCount++;
      }
    });
  });

  return validDishesCount > 0;
}

function hasValidCurrentOrFutureMenuData() {
  if (!state.menuData || !Array.isArray(state.menuData) || state.menuData.length === 0) return false;
  const todayIso = getBerlinTodayDate();
  return state.menuData.some(d => d.date >= todayIso && d.dishes && d.dishes.length > 0);
}

function updateActiveDate(previousActiveDate = null) {
  const daysWithDishes = state.menuData
    ? state.menuData
        .filter(d => hasDishesForSelectedCanteensAndDiet(d.date) && hasAvailableDishesForDate(d.date))
        .map(d => d.date)
    : [];
  const allAvailableDates = (state.menuData || []).map(d => d.date);
  const todayIso = getBerlinTodayDate();

  state.activeDate = pickActiveDate({
    datesWithMeals: daysWithDishes,
    allAvailableDates,
    todayIso,
    previousActiveDate
  });
}

async function fetchAndRender(forceNetwork = false) {
  const hasCache = loadMenuCache();
  loadAnnouncementsCache();
  
  if (hasCache && hasValidCurrentOrFutureMenuData()) {
    // We have valid current/future cached data, let's determine the active date and render immediately!
    updateActiveDate();
    state.lastRenderedDay = getBerlinTodayDate();
    state.lastLifecycleCheckTime = Date.now();
    
    // Render from cache
    renderApp(true);
    
    // Check if the cache is older than 60 minutes or forced
    const cacheAgeMs = Date.now() - state.lastCacheTime;
    if (cacheAgeMs > 60 * 60000 || forceNetwork) {
      updateMenuDataBackground();
    } else {
      state.isOfflineMode = false;
      renderOfflineBanner();
    }
  } else {
    // No valid current cache: render skeleton and dismiss splash immediately so user sees loading animation
    renderSkeletons();
    removeSplash();
    
    const { startDate, endDate } = getFetchDateRange();

    try {
      const [rawData, rawAnnouncements] = await Promise.all([
        fetchWeekMenuData(startDate, endDate),
        fetchAnnouncements()
      ]);

      if (rawData) {
        state.menuData = rawData;
        saveMenuCache(rawData);
      }
      if (rawAnnouncements) {
        state.announcements = rawAnnouncements;
        saveAnnouncementsCache(rawAnnouncements);
      }
      state.isOfflineMode = false;
      
      updateActiveDate();
      state.lastRenderedDay = getBerlinTodayDate();
      state.lastLifecycleCheckTime = Date.now();
      renderApp(true);
    } catch (err) {
      console.error("Blocking fetch completely failed:", err);
      state.isOfflineMode = true;
      renderError();
    }
  }
}

async function updateMenuDataBackground(isManual = false) {
  if (state.isUpdatingBackground) return;
  state.isUpdatingBackground = true;
  if (isManual) {
    state.isManualUpdating = true;
    renderOfflineBanner();
  }

  const { startDate, endDate } = getFetchDateRange();

  try {
    const [rawData, rawAnnouncements] = await Promise.all([
      fetchWeekMenuData(startDate, endDate),
      fetchAnnouncements()
    ]);

    if (rawData) {
      state.menuData = rawData;
      saveMenuCache(rawData);
    }
    if (rawAnnouncements) {
      state.announcements = rawAnnouncements;
      saveAnnouncementsCache(rawAnnouncements);
    }
    state.isOfflineMode = false;
    
    updateActiveDate(state.activeDate);
    state.lastRenderedDay = getBerlinTodayDate();
    state.lastLifecycleCheckTime = Date.now();
    renderApp(false);
  } catch (err) {
    console.error("Background fetch failed:", err);
    state.isOfflineMode = true;
  } finally {
    state.isUpdatingBackground = false;
    state.isManualUpdating = false;
    renderOfflineBanner();
  }
}

function handleAppResume() {
  if (!hasPreferences()) return;

  const now = Date.now();
  const decision = needsRefresh(
    state.lastCacheTime,
    now,
    state.lastRenderedDay,
    state.lastLifecycleCheckTime
  );

  if (decision.throttled) return;

  state.lastLifecycleCheckTime = now;
  state.lastRenderedDay = decision.currentBerlinDay;

  if (decision.shouldUpdateActiveDate) {
    updateActiveDate();
  }

  if (decision.shouldRerender) {
    renderApp(false);
  }

  if (decision.shouldFetchBackground) {
    updateMenuDataBackground();
  }
}

function renderOfflineBanner() {
  const container = document.getElementById("offline-banner-container");
  if (!container) return;

  if (!state.isOfflineMode) {
    container.innerHTML = "";
    return;
  }

  const t = TRANSLATIONS[state.language];
  const timeFormatted = formatCacheTime(state.lastCacheTime);
  const bannerText = t.offlineBannerText.replace("{time}", timeFormatted);
  const btnText = state.isManualUpdating ? t.offlineBannerUpdating : t.offlineBannerUpdateBtn;
  const btnDisabled = state.isManualUpdating ? "disabled" : "";

  container.innerHTML = `
    <div class="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-800 dark:text-amber-300 text-sm animate-fade-in shadow-sm mb-4">
      <div class="flex items-center gap-2.5">
        ${getIconHTML('cloud_off', 'text-[20px] text-amber-600 dark:text-amber-400')}
        <span class="font-medium">${bannerText}</span>
      </div>
      <button id="offline-refresh-btn" ${btnDisabled} data-action="trigger-manual-reload" class="h-9 px-4 bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:pointer-events-none font-bold">
        ${state.isManualUpdating ? `
          <svg class="animate-spin -ml-1 mr-1.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ` : ""}
        <span>${btnText}</span>
      </button>
    </div>
  `;
}

async function triggerManualReload() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update().catch(() => {});
    });
  }
  await updateMenuDataBackground(true);
}
window.triggerManualReload = triggerManualReload;

async function fetchWeekMenuData(startDate, endDate) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const payload = {
    "p_organization_id": SUPABASE_CONFIG.orgId,
    "p_start_date": typeof startDate === "string" ? startDate : getBerlinTodayDate(startDate),
    "p_end_date": typeof endDate === "string" ? endDate : getBerlinTodayDate(endDate)
  };

  try {
    const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/public_get_week_menu`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_CONFIG.apiKey,
        "authorization": `Bearer ${SUPABASE_CONFIG.apiKey}`,
        "content-type": "application/json",
        "x-client-info": "supabase-js-web/2.88.0"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Supabase API responded with status ${response.status}`);
    }

    const json = await response.json();
    const validation = validateWeekMenu(json);
    if (!validation.valid) {
      throw new Error(`Invalid week menu schema from API: ${validation.error}`);
    }
    return json;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchAnnouncements() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("data/announcements.json?t=" + Date.now(), {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Failed to fetch announcements: ${response.status}`);
    }
    const json = await response.json();
    const validation = validateAnnouncements(json);
    if (!validation.valid) {
      console.warn("Invalid announcements schema:", validation.error);
      return [];
    }
    return json;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Failed to fetch announcements:", error);
    return null;
  }
}

// 9. UI Rendering & Interaction
function _renderLoading() {
  const t = TRANSLATIONS[state.language];
  const dateContainer = document.getElementById("active-date-container");
  if (dateContainer) dateContainer.innerHTML = "";
  document.getElementById("main-feed").innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-text-main dark:text-slate-300 gap-4">
      ${getIconHTML('sync', 'text-[48px] animate-spin text-primary-container dark:text-price-badge')}
      <p class="font-label-lg text-label-lg">${t.loading}</p>
    </div>
  `;
}

function renderSkeletons(count = 3) {
  const container = document.getElementById('main-feed');
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="bg-surface-card dark:bg-[#122338] border border-black/[0.04] dark:border-white/[0.08] rounded-xl p-4 space-y-3 shadow-sm">
      <div class="skeleton h-4 w-3/4"></div>
      <div class="skeleton h-3 w-1/2"></div>
      <div class="flex gap-2 mt-2">
        <div class="skeleton h-6 w-16 rounded-full"></div>
        <div class="skeleton h-6 w-12 rounded-full"></div>
      </div>
      <div class="skeleton h-5 w-20 mt-1"></div>
    </div>
  `).join('');
}

function renderError() {
  const t = TRANSLATIONS[state.language];
  const dateContainer = document.getElementById("active-date-container");
  if (dateContainer) dateContainer.innerHTML = "";
  document.getElementById("main-feed").innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-red-600 dark:text-red-400 gap-4">
      ${getIconHTML('error', 'text-[48px]')}
      <p class="font-label-lg text-label-lg">${t.errorLoading}</p>
      <button data-action="fetch-and-render" class="mt-4 px-6 py-2 bg-primary-container dark:bg-price-badge text-white dark:text-primary font-bold rounded-lg font-label-md shadow-sm">${state.language === "de" ? "Erneut versuchen" : "Retry"}</button>
    </div>
  `;
  removeSplash();
}

function renderAnnouncements() {
  const container = document.getElementById("announcement-banner-container");
  if (!container) return;

  const announcements = state.announcements || [];
  const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 Stunden
  const freshAnnouncements = announcements.filter(a => {
    if (!a.dateFetched) return false;
    return (Date.now() - new Date(a.dateFetched).getTime()) < MAX_AGE_MS;
  });

  if (freshAnnouncements.length === 0) {
    container.innerHTML = "";
    return;
  }

  let html = "";
  
  freshAnnouncements.forEach((announce) => {
    const cardClass = "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300";
    const iconColor = "text-red-600 dark:text-red-400";
    const iconName = "error";

    let dateStr = "";
    if (announce.dateFetched) {
      const date = new Date(announce.dateFetched);
      if (!isNaN(date.getTime())) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        const prefix = state.language === "de" ? "Stand:" : "As of:";
        const timeSuffix = state.language === "de" ? " Uhr" : "";
        
        dateStr = `<p class="text-[11px] opacity-60 mt-2 font-medium">${prefix} ${day}.${month}. ${hours}:${minutes}${timeSuffix}</p>`;
      }
    }

    html += `
      <div class="w-full border rounded-2xl p-4 flex gap-3 text-sm animate-fade-in shadow-sm mb-4 ${cardClass}">
        <div class="flex-shrink-0 mt-0.5">
          ${getIconHTML(iconName, `text-[20px] ${iconColor}`)}
        </div>
        <div class="flex-1">
          <h4 class="font-bold mb-1">${escapeHtml(announce.topic)}</h4>
          <p class="leading-relaxed">${escapeHtml(announce.content)}</p>
          ${dateStr}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderApp(initialLoad = false) {
  try {
    renderAnnouncements();
    renderDateSelector(initialLoad);
    renderDietToggle();
    renderCanteenMenu();
    renderOfflineBanner();
  } catch (err) {
    console.error("Error during renderApp:", err);
  } finally {
    removeSplash();
  }
}

function renderDateSelector(forceScroll = false) {
  const selectorContainer = document.getElementById("date-selector-container");
  selectorContainer.innerHTML = "";
  
  const daysWithDishes = state.menuData.filter(d => hasDishesForSelectedCanteensAndDiet(d.date));
  
  if (daysWithDishes.length === 0) {
    return;
  }

  const todayStr = getBerlinTodayDate();

  daysWithDishes.forEach(day => {
    const formatted = formatDateSelector(day.date, todayStr, state.language);
    const isActive = day.date === state.activeDate;
    const hasFav = (day.dishes || []).some(d => isFavoriteV2(cleanDishNameForFavorite(d)));
    const starHTML = hasFav ? ' <span class="text-amber-500 dark:text-amber-300 font-extrabold text-sm align-middle">★</span>' : '';
    
    const btnClass = isActive 
      ? "bg-price-badge text-primary shadow-sm font-bold scale-[1.02]" 
      : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:text-primary dark:hover:text-white hover:shadow-sm font-medium";
      
    selectorContainer.innerHTML += `
      <button data-action="set-active-date" data-date="${escapeHtml(day.date)}" aria-pressed="${isActive ? 'true' : 'false'}" class="flex-shrink-0 px-4 py-2 rounded-lg font-label-md text-label-md transition-all duration-200 ${btnClass}">
        ${escapeHtml(formatted)}${starHTML}
      </button>
    `;
  });
  
  if (forceScroll) {
    setTimeout(() => {
      const activeBtn = selectorContainer.querySelector(".bg-price-badge");
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: "auto", block: "nearest", inline: "start" });
      }
    }, 50);
  }
}

function setActiveDate(dateStr, forceScroll = false) {
  state.activeDate = dateStr;
  renderDateSelector(forceScroll);
  renderCanteenMenu();
}
window.setActiveDate = setActiveDate;

function renderDietToggle() {
  const container = document.getElementById("diet-toggle-container");
  const t = TRANSLATIONS[state.language];
  container.innerHTML = "";
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", t.selectDiet);
  
  const options = [
    { value: "all", label: t.all },
    { value: "vegetarian", label: t.vegetarian },
    { value: "vegan", label: t.vegan }
  ];

  options.forEach(opt => {
    const isActive = state.diet === opt.value;
    const activeClass = isActive 
      ? "bg-primary-container dark:bg-price-badge text-white dark:text-primary shadow-sm font-bold" 
      : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:text-primary dark:hover:text-white hover:shadow-sm font-medium";
      
    container.innerHTML += `
      <button data-action="set-diet-filter" data-diet="${opt.value}" aria-pressed="${isActive ? 'true' : 'false'}" class="flex-1 py-2 rounded-lg font-label-md text-label-md text-center transition-all duration-200 focus:outline-none ${activeClass}">
        ${opt.label}
      </button>
    `;
  });
}

function setDietFilter(dietVal) {
  state.diet = dietVal;
  localStorage.setItem("kstw_diet", dietVal);
  renderDietToggle();
  renderCanteenMenu();
}
window.setDietFilter = setDietFilter;


function getBrandAndSubTag(dish) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  const rawType = customFields["menu_type"] || "";
  const category = dish.category || null;
  const classification = classifyDish(dish);

  // Split rawType into brand and suffix
  let brand = "";
  let subTagText = "";
  
  if (rawType) {
    const parts = rawType.trim().split(/\s+/);
    const firstWord = parts[0].toUpperCase();
    
    if (["HEIMSPIEL", "WORLDWIDE", "QUERBEET", "MEISTERWERK", "STREETFOOD", "STREET"].includes(firstWord)) {
      brand = firstWord === "STREET" ? "STREETFOOD" : firstWord;
      const remaining = parts.slice(1).join(" ");
      subTagText = remaining
        .replace(/\bVEGAN\b/gi, "")
        .replace(/\bST\.?\b/gi, "")
        .trim();
    } else if (firstWord === "AKTION") {
      brand = "MEISTERWERK";
      const remaining = parts.slice(1).join(" ");
      subTagText = remaining
        .replace(/\bVEGAN\b/gi, "")
        .replace(/\bST\.?\b/gi, "")
        .trim();
    } else if (firstWord === "SOZIALGERICHT") {
      brand = "SOZIALGERICHT";
    } else if (classification === "meisterwerk") {
      brand = "MEISTERWERK";
    } else if (classification === "buffet") {
      brand = "BUFFET";
    } else if (classification === "side" || firstWord.includes("BEILAGE")) {
      brand = "BEILAGE";
    } else if (classification === "dessert") {
      brand = "DESSERT";
    } else {
      brand = rawType.toUpperCase();
    }
  } else {
    if (classification === "meisterwerk") {
      brand = "MEISTERWERK";
    } else if (classification === "buffet") {
      brand = "BUFFET";
    } else if (classification === "dessert") {
      brand = "DESSERT";
    } else if (classification === "side") {
      brand = "BEILAGE";
    } else {
      brand = "GERICHT";
    }
  }

  let brandName = "";
  let brandIcon = "";
  let brandColor = "";

  switch (brand) {
    case "HEIMSPIEL":
      brandName = "Heimspiel";
      brandIcon = "home";
      brandColor = "bg-amber-50 text-amber-900 border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
      break;
    case "WORLDWIDE":
      brandName = "Worldwide";
      brandIcon = "public";
      brandColor = "bg-cyan-50 text-cyan-900 border-cyan-200/90 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900";
      break;
    case "QUERBEET":
      brandName = "Querbeet";
      brandIcon = "yard";
      brandColor = "bg-emerald-50 text-emerald-900 border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
      break;
    case "MEISTERWERK":
      brandName = "Meisterwerk";
      brandIcon = "workspace_premium";
      brandColor = "bg-amber-50 text-amber-900 border-amber-300/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60";
      break;
    case "STREETFOOD":
      brandName = "Streetfood";
      brandIcon = "fastfood";
      brandColor = "bg-rose-50 text-rose-900 border-rose-200/90 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
      break;
    case "SOZIALGERICHT":
      brandName = state.language === "de" ? "Sozialgericht" : "Social Meal";
      brandIcon = "volunteer_activism";
      brandColor = "bg-blue-50 text-blue-900 border-blue-200/90 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
      break;
    case "BUFFET":
      brandName = state.language === "de" ? "Buffet" : "Buffet";
      brandIcon = "scale";
      brandColor = "bg-amber-50 text-amber-900 border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
      break;
    case "BEILAGE":
      brandName = state.language === "de" ? "Beilage" : "Side";
      brandIcon = "grain";
      brandColor = "bg-slate-100 text-slate-800 border-slate-200/90 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
      break;
    case "DESSERT":
      brandName = state.language === "de" ? "Dessert & Obst" : "Dessert & Fruit";
      brandIcon = "icecream";
      brandColor = "bg-pink-50 text-pink-900 border-pink-200/90 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-900";
      break;
    default:
      if (category && (category.name_de || category.name_en)) {
        brandName = state.language === "de" ? category.name_de : category.name_en;
      } else {
        brandName = state.language === "de" ? "Gericht" : "Dish";
      }
      brandIcon = "restaurant";
      brandColor = "bg-slate-100 text-slate-800 border-slate-200/90 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }

  let subTagHTML = "";
  if (subTagText) {
    let displaySub = subTagText;
    if (state.language === "en") {
      if (displaySub.toUpperCase() === "SOZIAL") displaySub = "Social";
      if (displaySub.toUpperCase() === "ABENDESSEN") displaySub = "Dinner";
      if (displaySub.toUpperCase() === "AKTION") displaySub = "Promo";
    }
    displaySub = displaySub.charAt(0).toUpperCase() + displaySub.slice(1).toLowerCase();
    
    subTagHTML = `
      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
        ${escapeHtml(displaySub)}
      </span>
    `;
  }

  const brandBadgeHTML = `
    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${brandColor} shadow-sm">
      ${getIconHTML(brandIcon, 'text-[13px] font-normal')}
      ${escapeHtml(brandName)}
    </span>
  `;

  return { brandBadgeHTML, subTagHTML };
}

function getDateHeaderHTML() {
  if (!state.activeDate) return "";
  const formattedDate = formatDateHeader(state.activeDate, state.language);
  const prefix = state.language === "de" ? "Speiseplan für" : "Menu for";
  return `
    <div class="flex items-center gap-3 text-text-heading px-1 py-3 mb-2 mt-2 border-b border-slate-200/70 dark:border-white/5 animate-fade-in">
      <div class="w-9 h-9 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 shadow-sm flex items-center justify-center">
        ${getIconHTML('calendar_today', 'text-[20px] text-primary-container dark:text-[#a6cbed]')}
      </div>
      <div>
        <span class="text-[10px] font-bold text-slate-500 dark:text-gray-400/60 uppercase tracking-widest block leading-none mb-1">${prefix}</span>
        <h2 class="text-base md:text-lg font-headline font-extrabold text-text-heading dark:text-white leading-tight">${escapeHtml(formattedDate)}</h2>
      </div>
    </div>
  `;
}

function renderSectionHeader(title, count, iconName) {
  return `
    <div class="flex items-center justify-between gap-2 pt-3 pb-1.5 border-b border-slate-200/80 dark:border-white/10 mt-1 mb-2">
      <div class="flex items-center gap-2">
        <span class="text-primary-container dark:text-[#a6cbed] flex items-center justify-center">${getIconHTML(iconName, 'text-[18px]')}</span>
        <h3 class="font-headline text-[15px] font-bold text-text-heading dark:text-slate-100 tracking-tight">${escapeHtml(title)}</h3>
      </div>
      <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-white/10">${count}</span>
    </div>
  `;
}

function getDishServingMeta(dish, canteen, canteenKey, _customFields) {
  const serving = parseDishServingTime(dish);
  const dishCounter = extractDishCounter(dish, canteenKey);
  return {
    dishCounter,
    servingTime: serving ? serving.servingTime : ''
  };
}

function renderMainDishCard(dish, canteen, isViewingToday, currentHour, t, isBuffet = false, canteenKey = "", isMeisterwerk = false) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  const isBuffetMeal = isBuffet || isBuffetDish(dish);
  const tariffPrice = getDishPrice(dish, state.tariff);
  let displayPrice = tariffPrice != null ? formatPrice(tariffPrice) : "—";
  if (isBuffetMeal) {
    const grammUnit = t.per100g || "je 100g";
    displayPrice = `${displayPrice} / ${grammUnit}`;
  }

  const cleanName = cleanDishNameForFavorite(dish);
  const isFav = isFavoriteV2(cleanName);

  const { brandBadgeHTML, subTagHTML } = getBrandAndSubTag(dish);

  const { dishCounter, servingTime } = getDishServingMeta(dish, canteen, canteenKey, customFields);
  const locationBadge = dishCounter;

  const dietType = getDishDietType(dish);
  let dietBadge = "";
  if (dietType === "vegan") {
    dietBadge = `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-label-sm text-[11px] dark:bg-green-950/20 dark:text-green-400 dark:border-green-900 font-medium whitespace-nowrap">
        ${getIconHTML('eco', 'text-[14px]')}
        ${t.vegan}
      </span>
    `;
  } else if (dietType === "vegetarian") {
    dietBadge = `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-label-sm text-[11px] dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900 font-medium whitespace-nowrap">
        ${getIconHTML('nutrition', 'text-[14px]')}
        ${t.vegetarian}
      </span>
    `;
  }

  const allergyEval = evaluateDishAllergies(dish, state.allergies || []);

  let undeclaredBadge = "";
  if (state.allergies && state.allergies.length > 0) {
    if (allergyEval.hasNoInfo) {
      undeclaredBadge = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-label-sm text-[11px] dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 font-medium max-w-full leading-tight">
          ${getIconHTML('warning', 'text-[14px]')}
          ${t.noAllergenInfoBadge}
        </span>
      `;
    } else if (allergyEval.uncertainBy.length > 0) {
      undeclaredBadge = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-label-sm text-[11px] dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 font-medium max-w-full leading-tight">
          ${getIconHTML('warning', 'text-[14px]')}
          ${t.uncertainDessertBadge}
        </span>
      `;
    }
  }

  let conflictBadge = "";
  if (allergyEval.dietConflict) {
    conflictBadge = `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 font-label-sm text-[11px] dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900 font-medium max-w-full leading-tight">
        ${getIconHTML('warning', 'text-[14px]')}
        ${t.conflictBadge}
      </span>
    `;
  }

  const allCodes = getDishAllergens(dish);
  let allergenIcons = "";
  if (allCodes.length > 0) {
    const label = state.language === "en" ? "Allergens:" : "Allergene:";
    allergenIcons = `
      <button type="button" data-action="show-allergens" data-dish-id="${escapeHtml(dish.id)}" class="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-body-sm opacity-85 hover:opacity-100 hover:text-[#00273e] dark:hover:text-white cursor-pointer active:scale-95 transition-all select-none ml-auto pl-2 bg-transparent border-0 p-0 text-left">
        <span class="font-semibold text-slate-700 dark:text-slate-300">${label}</span>
        ${allCodes.slice(0, 3).map(c => `<span class="bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded text-[10px] border border-slate-300/60 dark:border-white/[0.1] font-medium">${escapeHtml(c)}</span>`).join("")}
        ${allCodes.length > 3 ? `<span class="text-xs font-bold text-primary dark:text-price-badge">+${allCodes.length - 3}</span>` : ""}
      </button>
    `;
  }

  let servingMetaHTML = "";
  if (locationBadge || servingTime) {
    servingMetaHTML = `
      <div class="flex flex-wrap items-center gap-2 text-[12px] font-label-sm text-primary-container/80 dark:text-slate-300 mt-1">
        ${locationBadge ? `
          <span class="inline-flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/[0.08] shadow-sm px-2 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-200 font-medium">
            ${getIconHTML('location_on', 'text-[14px]')}
            ${escapeHtml(locationBadge)}
          </span>
        ` : ""}
        ${servingTime ? `
          <span class="inline-flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/[0.08] shadow-sm px-2 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-200 font-medium">
            ${getIconHTML('alarm', 'text-[14px]')}
            ${escapeHtml(servingTime)}
          </span>
        ` : ""}
      </div>
    `;
  }

  const rawDPName = customFields["CUSTOM_DPNAME"] || "";
  const cleanedDPName = cleanDPName(rawDPName);
  const baseName = state.language === "en" && dish.name_en ? dish.name_en : dish.name_de;

  let mealName = baseName;
  if (cleanedDPName && cleanedDPName.toLowerCase() !== (dish.name_de || "").toLowerCase()) {
    const dpLower = cleanedDPName.toLowerCase();
    const nameLower = (dish.name_de || "").toLowerCase();
    if (!nameLower.includes(dpLower)) {
      mealName = state.language === "en" && dish.name_en ? dish.name_en : cleanedDPName;
    }
  }

  let dishComponents = [];
  for (let i = 1; i <= 5; i++) {
    const fieldDe = customFields[`dish_ger_${i}`] || "";
    const fieldEn = customFields[`dish_${i}_eng`] || "";
    const raw = state.language === "en" && fieldEn ? fieldEn : fieldDe;
    if (raw) {
      dishComponents.push(stripAllergenCodes(raw));
    }
  }
  if (dishComponents.length > 0) {
    const firstClean = dishComponents[0].toLowerCase();
    const titleClean = mealName.toLowerCase().replace(/\s*\([^)]*\)/g, "").trim();
    if (firstClean === titleClean || titleClean.includes(firstClean) || firstClean.includes(titleClean)) {
      dishComponents.shift();
    }
  }
  const componentsText = dishComponents.join(" · ");
  const mealDesc = state.language === "en" && dish.description_en ? dish.description_en : dish.description_de;

  const escapedMealName = escapeHtml(mealName);
  const escapedComponentsText = escapeHtml(componentsText);
  const escapedMealDesc = escapeHtml(mealDesc);
  const escapedDisplayPrice = escapeHtml(displayPrice);

  const shareUrl = `${window.location.origin}${window.location.pathname}?date=${state.activeDate}&canteen=${canteenKey}&dish=${encodeURIComponent(cleanName)}`;
  const shareBtn = `
    <button 
      class="share-btn p-1.5 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors flex items-center justify-center active:scale-95"
      data-dish-name="${escapedMealName}"
      data-dish-price="${escapedDisplayPrice}"
      data-canteen-name="${escapeHtml(canteen.name)}"
      data-share-url="${escapeHtml(shareUrl)}"
      aria-label="${escapeHtml(t.shareDishAria)}"
      title="${escapeHtml(t.shareDishAria)}"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    </button>
  `;

  const favBtn = `
    <button 
      type="button" 
      class="fav-btn p-1.5 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors flex items-center justify-center active:scale-95"
      data-dish-clean-name="${escapeHtml(cleanName)}"
      aria-label="${isFav ? escapeHtml(t.favoriteAriaAdded) : escapeHtml(t.favoriteAriaNotAdded)}"
      title="${isFav ? escapeHtml(t.favoriteAriaAdded) : escapeHtml(t.favoriteAriaNotAdded)}"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="fav-icon w-4 h-4" fill="${isFav ? '#ffd600' : 'none'}" stroke="${isFav ? '#ffd600' : 'currentColor'}" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
      </svg>
    </button>
  `;

  let rightColumnHTML = "";
  if (dish.image_url) {
    const escapedImageUrl = escapeHtml(dish.image_url);
    rightColumnHTML = `
      <div class="flex flex-col items-center gap-1.5 flex-shrink-0">
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-sm">
          <img src="${escapedImageUrl}" class="dish-image-el w-full h-full object-cover transition-transform duration-500 hover:scale-105" alt="${escapedMealName}"/>
        </div>
        <div class="bg-price-badge shadow-sm rounded-full px-2.5 py-0.5 border border-amber-300/40 dark:border-white/20">
          <span class="font-label-md text-label-md text-primary font-extrabold tracking-wide">${escapedDisplayPrice}</span>
        </div>
      </div>
    `;
  }

  const priceBadgeInline = !dish.image_url ? `
    <div class="bg-price-badge shadow-sm rounded-full px-2.5 py-0.5 border border-amber-300/40 dark:border-white/20 flex-shrink-0 ml-auto">
      <span class="font-label-md text-label-md text-primary font-extrabold tracking-wide">${escapedDisplayPrice}</span>
    </div>
  ` : "";

  let buffetCalcHTML = "";
  if (isBuffetMeal) {
    const p100 = getBuffetPricePer100g(dish, state.tariff);
    buffetCalcHTML = `
      <div class="buffet-calc-container mt-2 pt-2 border-t border-slate-200/60 dark:border-white/10 flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300 bg-amber-50/50 dark:bg-[#122338]/60 p-2.5 rounded-xl">
        <span class="font-bold flex items-center gap-1 text-primary-container dark:text-price-badge">
          ${getIconHTML('calculate', 'text-sm')}
          ${escapeHtml(t.buffetCalculator)}:
        </span>
        <div class="flex items-center gap-1.5">
          <input 
            type="number" 
            min="0" 
            max="2000" 
            step="50" 
            value="250" 
            data-action="buffet-calc-input" 
            data-price-per-100g="${p100}" 
            class="buffet-grams-input w-16 px-1.5 py-0.5 rounded text-center border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-xs focus:ring-1 focus:ring-primary-container"
            aria-label="${escapeHtml(t.weightInGrams)}"
          />
          <span class="font-medium text-slate-500">g =</span>
          <span class="buffet-calc-result font-extrabold text-primary-container dark:text-price-badge text-sm">
            ${formatPrice(calculateBuffetPrice(p100, 250))}
          </span>
        </div>
        <div class="flex items-center gap-1 ml-auto">
          <button data-action="buffet-quick" data-grams="150" class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 text-[10px] font-semibold">150g</button>
          <button data-action="buffet-quick" data-grams="250" class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 text-[10px] font-semibold">250g</button>
          <button data-action="buffet-quick" data-grams="400" class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 hover:bg-slate-300 text-[10px] font-semibold">400g</button>
        </div>
      </div>
    `;
  }

  let favoriteBannerHTML = "";
  if (isFav) {
    favoriteBannerHTML = `
      <div class="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800/60 mb-1 w-fit shadow-xs">
        <span class="text-amber-500 font-extrabold text-sm">★</span>
        <span>${escapeHtml(t.favoriteBadge)}</span>
      </div>
    `;
  }

  let allergenExcludedBannerHTML = "";
  if (dish._isAllergenExcluded) {
    allergenExcludedBannerHTML = `
      <div class="flex items-center gap-1 text-xs font-semibold text-rose-800 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-900/60 mb-1 w-fit">
        ${getIconHTML('warning', 'text-xs')}
        <span>${escapeHtml(t.hiddenByAllergenFilter)}</span>
      </div>
    `;
  }

  let cardBorderClass = isMeisterwerk 
    ? "border-amber-300/90 dark:border-amber-500/40 shadow-[0_2px_14px_-2px_rgba(232,185,35,0.18)]" 
    : "border-slate-200/70 dark:border-white/[0.08] shadow-sm hover:shadow-md";

  if (isFav) {
    cardBorderClass += " ring-2 ring-amber-400 dark:ring-amber-500 shadow-md";
  }
  if (dish._isAllergenExcluded) {
    cardBorderClass += " opacity-75 border-dashed border-rose-300 dark:border-rose-900/60";
  }

  return `
    <article class="bg-slate-50/90 dark:bg-[#182c44] rounded-2xl p-inset-card flex flex-col gap-2 relative hover:bg-white dark:hover:bg-[#1f3754] transition-all duration-200 border overflow-hidden break-words min-w-0 ${cardBorderClass}" data-dish-clean-name="${escapeHtml(cleanName)}">
      ${favoriteBannerHTML}
      ${allergenExcludedBannerHTML}
      <div class="flex justify-between items-start gap-3 min-w-0">
        <div class="flex-1 flex flex-col gap-2.5 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap w-full">
            ${brandBadgeHTML}
            ${subTagHTML}
            ${priceBadgeInline}
          </div>
          <div class="min-w-0">
            <h3 class="font-headline-sm text-headline-sm text-text-heading dark:text-white font-bold leading-snug mb-0.5 min-w-0 break-words">${escapedMealName}</h3>
            ${escapedComponentsText ? `<p class="font-body-sm text-[13px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2 mt-0.5 cursor-pointer break-words" data-action="toggle-clamp" role="button" tabindex="0" aria-expanded="false">${escapedComponentsText}</p>` : ""}
            ${escapedMealDesc ? `<p class="font-body-md text-body-md text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 mt-1 break-words">${escapedMealDesc}</p>` : ""}
            ${buffetCalcHTML}
          </div>
          ${servingMetaHTML}
        </div>
        ${rightColumnHTML ? `<div class="dish-right-col flex-shrink-0">${rightColumnHTML}</div>` : ""}
      </div>
      <div class="flex items-center justify-between mt-1 pt-2 border-t border-slate-200/70 dark:border-white/5 flex-wrap min-w-0 gap-2">
        <div class="flex gap-1.5 flex-wrap items-center min-w-0">
          ${dietBadge}
          ${undeclaredBadge}
          ${conflictBadge}
        </div>
        <div class="flex items-center gap-1.5 ml-auto flex-shrink-0">
          ${favBtn}
          ${shareBtn}
          ${allergenIcons}
        </div>
      </div>
    </article>
  `;
}

function renderCompactDishCard(dish, canteen, isViewingToday, currentHour, t, isBuffet = false, canteenKey = "") {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  const isBuffetMeal = isBuffet || isBuffetDish(dish);
  const tariffPrice = getDishPrice(dish, state.tariff);
  let rawPrice = tariffPrice != null ? formatPrice(tariffPrice) : "—";

  if (isBuffetMeal) {
    const grammUnit = t.per100g || "je 100g";
    rawPrice = `${rawPrice} / ${grammUnit}`;
  }

  const cleanName = cleanDishNameForFavorite(dish);
  const isFav = isFavoriteV2(cleanName);

  const rawDPName = customFields["CUSTOM_DPNAME"] || "";
  const cleanedDPName = cleanDPName(rawDPName);
  const baseName = state.language === "en" && dish.name_en ? dish.name_en : dish.name_de;

  let mealName = baseName;
  if (cleanedDPName && cleanedDPName.toLowerCase() !== (dish.name_de || "").toLowerCase()) {
    const dpLower = cleanedDPName.toLowerCase();
    const nameLower = (dish.name_de || "").toLowerCase();
    if (!nameLower.includes(dpLower)) {
      mealName = state.language === "en" && dish.name_en ? dish.name_en : cleanedDPName;
    }
  }

  const { dishCounter } = getDishServingMeta(dish, canteen, canteenKey, customFields);

  const dietType = getDishDietType(dish);
  let dietBadge = "";
  if (dietType === "vegan") {
    dietBadge = `
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] dark:bg-green-950/20 dark:text-green-400 dark:border-green-900 font-medium whitespace-nowrap">
        ${getIconHTML('eco', 'text-[12px]')}
        ${t.vegan}
      </span>
    `;
  } else if (dietType === "vegetarian") {
    dietBadge = `
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900 font-medium whitespace-nowrap">
        ${getIconHTML('nutrition', 'text-[12px]')}
        ${t.vegetarian}
      </span>
    `;
  }

  const allergyEval = evaluateDishAllergies(dish, state.allergies || []);

  let undeclaredBadge = "";
  if (state.allergies && state.allergies.length > 0) {
    if (allergyEval.hasNoInfo) {
      undeclaredBadge = `
        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 font-medium max-w-full leading-tight">
          ${getIconHTML('warning', 'text-[12px]')}
          ${t.noAllergenInfoBadge}
        </span>
      `;
    } else if (allergyEval.uncertainBy.length > 0) {
      undeclaredBadge = `
        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 font-medium max-w-full leading-tight">
          ${getIconHTML('warning', 'text-[12px]')}
          ${t.uncertainDessertBadge}
        </span>
      `;
    }
  }

  let conflictBadge = "";
  if (allergyEval.dietConflict) {
    conflictBadge = `
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[10px] dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900 font-medium max-w-full leading-tight">
        ${getIconHTML('warning', 'text-[12px]')}
        ${t.conflictBadge}
      </span>
    `;
  }

  const allCodes = getDishAllergens(dish);
  let allergenIcons = "";
  if (allCodes.length > 0) {
    allergenIcons = `
      <button type="button" data-action="show-allergens" data-dish-id="${escapeHtml(dish.id)}" class="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 opacity-85 hover:opacity-100 hover:text-[#00273e] dark:hover:text-white cursor-pointer active:scale-95 transition-all select-none ml-auto bg-transparent border-0 p-0 text-left whitespace-nowrap" title="${state.language === 'en' ? 'Show allergens' : 'Allergene anzeigen'}">
        <span class="sr-only">${state.language === "en" ? "Allergens:" : "Allergene:"}</span>
        ${allCodes.slice(0, 2).map(c => `<span class="bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 px-1 py-0.2 rounded text-[9px] border border-slate-300/60 dark:border-white/[0.1] font-medium">${escapeHtml(c)}</span>`).join("")}
        ${allCodes.length > 2 ? `<span class="font-bold text-primary dark:text-price-badge text-[10px]">+${allCodes.length - 2}</span>` : ""}
      </button>
    `;
  }

  const favBtn = `
    <button 
      type="button" 
      class="fav-btn p-1 rounded-full text-slate-400 hover:text-amber-500 transition-colors active:scale-95" 
      data-dish-clean-name="${escapeHtml(cleanName)}"
      aria-label="${isFav ? escapeHtml(t.favoriteAriaAdded) : escapeHtml(t.favoriteAriaNotAdded)}"
      title="${isFav ? escapeHtml(t.favoriteAriaAdded) : escapeHtml(t.favoriteAriaNotAdded)}"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="fav-icon w-3.5 h-3.5" fill="${isFav ? '#ffd600' : 'none'}" stroke="${isFav ? '#ffd600' : 'currentColor'}" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
      </svg>
    </button>
  `;

  const escapedMealName = escapeHtml(mealName);
  const escapedPrice = escapeHtml(rawPrice);

  let cardClass = "bg-slate-50/90 dark:bg-[#182c44] rounded-2xl p-3 border border-slate-200/70 dark:border-white/[0.08] flex flex-col justify-between gap-2 hover:bg-white dark:hover:bg-[#1f3754] transition-all duration-200 shadow-sm hover:shadow-md";
  if (isFav) {
    cardClass += " ring-2 ring-amber-400 dark:ring-amber-500 shadow-md";
  }
  if (dish._isAllergenExcluded) {
    cardClass += " opacity-75 border-dashed border-rose-300 dark:border-rose-900/60";
  }

  return `
    <div class="${cardClass} overflow-hidden break-words min-w-0" data-dish-clean-name="${escapeHtml(cleanName)}">
      <div class="flex justify-between items-start gap-2 min-w-0">
        <h4 class="font-headline text-[13px] sm:text-[14px] text-text-heading dark:text-white font-bold leading-snug min-w-0 flex-1 break-words">
          ${isFav ? '<span class="text-amber-500 font-extrabold mr-1">★</span>' : ''}${escapedMealName}
        </h4>
        <div class="bg-price-badge shadow-sm rounded-full px-2 py-0.5 border border-amber-300/40 dark:border-white/20 flex-shrink-0 self-start whitespace-nowrap">
          <span class="font-label-sm text-[11px] text-primary font-extrabold tracking-wide">${escapedPrice}</span>
        </div>
      </div>
      <div class="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-white/5 text-[11px] flex-wrap min-w-0">
        <div class="flex gap-1 flex-wrap items-center min-w-0">
          ${dishCounter ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 border border-slate-300/50 dark:border-white/10 text-[10px] text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">${escapeHtml(dishCounter)}</span>` : ""}
          ${dietBadge}
          ${undeclaredBadge}
          ${conflictBadge}
        </div>
        <div class="flex items-center gap-1 ml-auto flex-shrink-0">
          ${favBtn}
          ${allergenIcons}
        </div>
      </div>
    </div>
  `;
}

function renderCanteenMenu() {
  const feedContainer = document.getElementById("main-feed");
  feedContainer.innerHTML = "";
  
  const t = TRANSLATIONS[state.language];

  if (!state.menuData || state.menuData.length === 0) {
    feedContainer.innerHTML = `
      <div class="text-center py-20 text-on-surface-variant dark:text-slate-300">
        ${getIconHTML('restaurant', 'text-[48px] text-slate-400 mb-2')}
        <p class="font-label-lg text-label-lg">${t.noDataAvailable}</p>
      </div>
    `;
    removeSplash();
    return;
  }

  // Determine current active date
  const currentDayData = state.menuData.find(d => d.date === state.activeDate);

  if (!currentDayData) {
    feedContainer.innerHTML = `
      <div class="text-center py-20 text-on-surface-variant dark:text-slate-300">
        ${getIconHTML('calendar_today', 'text-[48px] text-slate-400 mb-2')}
        <p class="font-label-lg text-label-lg">${t.noDataForSelectedDay}</p>
      </div>
    `;
    removeSplash();
    return;
  }

  // Set the Date Header
  const dateContainer = document.getElementById("active-date-container");
  if (dateContainer) {
    dateContainer.innerHTML = getDateHeaderHTML();
  }

  // Determine layout columns based on viewport width
  const width = window.innerWidth;
  let numCols = 1;
  if (width >= 1024) numCols = 3;
  else if (width >= 768) numCols = 2;

  // Create column elements if multi-column
  const colHeights = Array(numCols).fill(0);
  if (numCols > 1) {
    feedContainer.className = "w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start";
    for (let c = 0; c < numCols; c++) {
      const colDiv = document.createElement("div");
      colDiv.id = `canteen-col-${c}`;
      colDiv.className = "flex flex-col gap-6";
      feedContainer.appendChild(colDiv);
    }
  } else {
    feedContainer.className = "w-full flex flex-col gap-6";
  }

  let renderedCanteensCount = 0;
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const todayIso = getLocalIsoDate(now);
  const isViewingToday = state.activeDate === todayIso;

  state.selectedCanteens.forEach(canteenKey => {
    const canteen = CANTEENS[canteenKey];
    if (!canteen) return;

    let dishes = (currentDayData.dishes || []).filter(dish => {
      return getCanteenKeyFromDish(dish, canteenKey, canteen);
    });

    // Deduplicate dishes by lowercase name to prevent duplicates from shared kitchen lines
    const seenNames = new Set();
    dishes = dishes.filter(dish => {
      const nameKey = (dish.name_de || "").trim().toLowerCase();
      if (!nameKey) return true;
      if (seenNames.has(nameKey)) return false;
      seenNames.add(nameKey);
      return true;
    });

    // Apply Diet Filter
    // Apply Diet Filter
    if (state.diet !== "all") {
      dishes = dishes.filter(dish => {
        const dType = getDishDietType(dish);
        if (state.diet === "vegan") return dType === "vegan";
        if (state.diet === "vegetarian") return dType === "vegan" || dType === "vegetarian";
        return true;
      });
    }

    // Evaluate Allergy Filter & Transparency (F1)
    let allergenExcludedCount = 0;
    const isRevealed = state.hiddenAllergenRevealedCanteens.has(canteenKey);

    if (state.allergies && state.allergies.length > 0) {
      const excludedDishes = [];
      const allowedDishes = [];
      dishes.forEach(dish => {
        if (shouldExcludeDish(dish, state.allergies)) {
          excludedDishes.push({ ...dish, _isAllergenExcluded: true });
        } else {
          allowedDishes.push(dish);
        }
      });
      allergenExcludedCount = excludedDishes.length;

      if (isRevealed) {
        dishes = [...allowedDishes, ...excludedDishes];
      } else {
        dishes = allowedDishes;
      }
    }

    // Determine opening hours and status (F5)
    const dayOfWeek = getDayOfWeekFromIso(state.activeDate);
    const dayHours = getCanteenHoursForDay(canteenKey, dayOfWeek, canteen, state.language);
    let startHour = dayHours.startHour;
    let endHour = dayHours.endHour;
    let openingHoursText = dayHours.formatted;

    // Check if dishes have explicit serving times
    const serviceWindow = getDishesServiceWindow(dishes, state.language);
    if (serviceWindow) {
      startHour = serviceWindow.startHour;
      endHour = serviceWindow.endHour;
    }

    const openStatus = getCanteenOpenStatus({ isOpenToday: dayHours.isOpenToday, startHour, endHour }, currentHour);
    const serviceWindowText = serviceWindow ? serviceWindow.formatted : openingHoursText;

    let statusBadgeClass = "bg-rose-50 text-rose-800 border-rose-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    let statusText = t.closed;

    if (!dayHours.isOpenToday) {
      statusText = t.closedToday || "Heute geschlossen";
    } else if (openStatus.isOpen) {
      if (openStatus.minutesUntilClose !== null && openStatus.minutesUntilClose <= 45 && openStatus.minutesUntilClose > 0) {
        statusBadgeClass = "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
        statusText = `${t.nowOpen} · ${t.closesIn.replace('{m}', openStatus.minutesUntilClose)}`;
      } else {
        statusBadgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
        statusText = t.nowOpen;
      }
    } else if (openStatus.opensLater) {
      statusBadgeClass = "bg-sky-50 text-sky-800 border-sky-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
      if (startHour != null && !isNaN(startHour)) {
        const h = Math.floor(startHour).toString().padStart(2, "0");
        const m = Math.round((startHour % 1) * 60).toString().padStart(2, "0");
        statusText = t.opensAt.replace('{time}', `${h}:${m}`);
      } else {
        statusText = t.opensLater;
      }
    }

    if (dishes.length === 0) {
      // If all dishes were excluded by allergen filter, show canteen card with notification (F1)
      if (allergenExcludedCount > 0) {
        renderedCanteensCount++;
        const canteenSection = `
          <div class="canteen-card w-full bg-white dark:bg-[#122338] rounded-3xl p-6 border border-slate-200/80 dark:border-white/[0.08] shadow-[0_4px_20px_-4px_rgba(0,39,62,0.06)] flex flex-col gap-4">
            <header class="flex flex-col gap-2">
              <div class="flex justify-between items-start gap-2">
                <div class="min-w-0">
                  <h2 class="font-headline text-[18px] text-text-heading dark:text-white font-bold leading-tight">${escapeHtml(canteen.name)}</h2>
                  <p class="font-body-md text-body-md text-slate-600 dark:text-slate-300">${escapeHtml(canteen.strasse)}, ${escapeHtml(canteen.plz)} ${escapeHtml(canteen.ort)}</p>
                </div>
                ${isViewingToday ? `
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeClass} flex-shrink-0">
                  ${statusText}
                </span>
                ` : ""}
              </div>
              <div class="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-body-sm text-[12px] opacity-90">
                ${getIconHTML('schedule', 'text-[16px]')}
                <span>${serviceWindowText}</span>
              </div>
            </header>
            <div class="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-center text-center gap-3">
              <div class="text-amber-500">${getIconHTML('warning', 'text-2xl')}</div>
              <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
                ${escapeHtml(t.allDishesHiddenByAllergens)}
              </p>
              <button type="button" data-action="toggle-revealed-allergens" data-canteen="${escapeHtml(canteenKey)}" class="px-4 py-2 rounded-xl bg-primary-container text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm">
                ${escapeHtml(t.showHiddenDishes)}
              </button>
            </div>
          </div>
        `;

        if (numCols > 1) {
          let minColIdx = 0;
          let minColHeight = colHeights[0];
          for (let i = 1; i < numCols; i++) {
            if (colHeights[i] < minColHeight) {
              minColHeight = colHeights[i];
              minColIdx = i;
            }
          }
          const colContainer = document.getElementById(`canteen-col-${minColIdx}`);
          if (colContainer) {
            colContainer.innerHTML += canteenSection;
            colHeights[minColIdx] += 180;
          }
        } else {
          feedContainer.innerHTML += canteenSection;
        }
      }
      return;
    }

    // Filter dishes by serving time if viewing today
    const availableDishes = dishes.filter(dish => {
      if (!isViewingToday) return true;
      return !isDishExpired(dish, currentHour);
    });

    if (availableDishes.length === 0) return;

    // Group into Baukasten modules
    const mains = [];
    const meisterwerke = [];
    const buffets = [];
    const sides = [];
    const desserts = [];

    availableDishes.forEach(dish => {
      const cat = classifyDish(dish);
      if (cat === "main") mains.push(dish);
      else if (cat === "meisterwerk") meisterwerke.push(dish);
      else if (cat === "buffet") buffets.push(dish);
      else if (cat === "side") sides.push(dish);
      else if (cat === "dessert") desserts.push(dish);
    });

    // Sort mains: Proper main courses first, soups & stews below
    mains.sort((a, b) => {
      const aSoup = isSoupOrStew(a) ? 1 : 0;
      const bSoup = isSoupOrStew(b) ? 1 : 0;
      if (aSoup !== bSoup) return aSoup - bSoup;
      return 0;
    });

    renderedCanteensCount++;

    let transparencyBannerHTML = "";
    if (allergenExcludedCount > 0) {
      transparencyBannerHTML = `
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 mb-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-amber-600 dark:text-amber-400 font-bold">ℹ</span>
            <span class="truncate">${escapeHtml(t.allergensHiddenBanner.replace('{count}', allergenExcludedCount))}</span>
          </div>
          <button type="button" data-action="toggle-revealed-allergens" data-canteen="${escapeHtml(canteenKey)}" class="font-bold underline text-xs text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 flex-shrink-0 cursor-pointer">
            ${escapeHtml(isRevealed ? t.hideHiddenDishes : t.showHiddenDishes)}
          </button>
        </div>
      `;
    }

    let dishesHTML = "";

    // 1. Hauptgerichte (klassisches Mensa-Essen)
    if (mains.length > 0) {
      dishesHTML += `
        <div class="flex flex-col gap-2.5">
          ${renderSectionHeader(t.sectionMain || "Hauptgerichte", mains.length, "dinner_dining")}
          <div class="flex flex-col gap-gutter-card">
            ${mains.map(dish => renderMainDishCard(dish, canteen, isViewingToday, currentHour, t, false, canteenKey, false)).join("")}
          </div>
        </div>
      `;
    }

    // 2. Meisterwerk (Aktionen, Pizza, Grill, Pasta Mista)
    if (meisterwerke.length > 0) {
      dishesHTML += `
        <div class="flex flex-col gap-2.5 mt-2">
          ${renderSectionHeader(t.sectionMeisterwerk || "Meisterwerk", meisterwerke.length, "workspace_premium")}
          <div class="flex flex-col gap-gutter-card">
            ${meisterwerke.map(dish => renderMainDishCard(dish, canteen, isViewingToday, currentHour, t, false, canteenKey, true)).join("")}
          </div>
        </div>
      `;
    }

    // 3. Buffet & Selbstbedienung
    if (buffets.length > 0) {
      dishesHTML += `
        <div class="flex flex-col gap-2.5 mt-2">
          ${renderSectionHeader(t.sectionBuffet || "Buffet & Selbstbedienung", buffets.length, "scale")}
          <div class="flex flex-col gap-gutter-card">
            ${buffets.map(dish => renderMainDishCard(dish, canteen, isViewingToday, currentHour, t, true, canteenKey, false)).join("")}
          </div>
        </div>
      `;
    }

    // 3. Beilagen & Gemüse
    if (sides.length > 0) {
      dishesHTML += `
        <div class="flex flex-col gap-2.5 mt-2">
          ${renderSectionHeader(t.sectionSides || "Beilagen & Gemüse", sides.length, "grain")}
          <div class="flex flex-col gap-2.5">
            ${sides.map(dish => renderCompactDishCard(dish, canteen, isViewingToday, currentHour, t, false, canteenKey)).join("")}
          </div>
        </div>
      `;
    }

    // 4. Dessert & Obst
    if (desserts.length > 0) {
      dishesHTML += `
        <div class="flex flex-col gap-2.5 mt-2">
          ${renderSectionHeader(t.sectionDessert || "Dessert & Obst", desserts.length, "icecream")}
          <div class="flex flex-col gap-2.5">
            ${desserts.map(dish => renderCompactDishCard(dish, canteen, isViewingToday, currentHour, t, false, canteenKey)).join("")}
          </div>
        </div>
      `;
    }

    let canteenSection = `
      <div class="canteen-card w-full bg-white dark:bg-[#122338] rounded-3xl p-6 border border-slate-200/80 dark:border-white/[0.08] shadow-[0_4px_20px_-4px_rgba(0,39,62,0.06)] hover:shadow-[0_8px_30px_-4px_rgba(0,39,62,0.1)] flex flex-col gap-4 transition-all duration-300">
        <!-- Canteen Header -->
        <header class="flex flex-col gap-2">
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0">
              <h2 class="font-headline text-[18px] text-text-heading dark:text-white font-bold leading-tight">${escapeHtml(canteen.name)}</h2>
              <p class="font-body-md text-body-md text-slate-600 dark:text-slate-300">${escapeHtml(canteen.strasse)}, ${escapeHtml(canteen.plz)} ${escapeHtml(canteen.ort)}</p>
            </div>
            ${isViewingToday ? `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeClass} flex-shrink-0">
              ${statusText}
            </span>
            ` : ""}
          </div>
          <div class="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-body-sm text-[12px] opacity-90">
            ${getIconHTML('schedule', 'text-[16px]')}
            <span>${serviceWindowText}</span>
          </div>
        </header>

        <!-- Modular Dishes Sections -->
        <div class="flex flex-col gap-3">
          ${transparencyBannerHTML}
          ${dishesHTML}
        </div>
      </div>
    `;

    // Distribute to columns
    if (numCols > 1) {
      let estHeight = 150 + mains.length * 140 + meisterwerke.length * 140 + buffets.length * 140 + sides.length * 60 + desserts.length * 60;
      [...mains, ...meisterwerke].forEach(d => {
        if (d.image_url) estHeight += 80;
      });

      // Find the column with the minimum height
      let minColIdx = 0;
      let minColHeight = colHeights[0];
      for (let i = 1; i < numCols; i++) {
        if (colHeights[i] < minColHeight) {
          minColHeight = colHeights[i];
          minColIdx = i;
        }
      }

      const colContainer = document.getElementById(`canteen-col-${minColIdx}`);
      if (colContainer) {
        colContainer.innerHTML += canteenSection;
        colHeights[minColIdx] += estHeight;
      }
    } else {
      feedContainer.innerHTML += canteenSection;
    }
  });

  if (renderedCanteensCount === 0) {
    feedContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-text-heading dark:text-white gap-2 w-full">
        ${getIconHTML('notifications_off', 'text-[48px] opacity-40')}
        <p class="font-body-lg text-body-lg opacity-60 dark:text-slate-300 text-center px-4 leading-relaxed">
          ${state.language === "de" 
            ? "Alle ausgewählten Mensen haben für heute den Service beendet oder sind geschlossen." 
            : "All selected canteens are closed or have finished food service for today."}
        </p>
      </div>
    `;
  }
}

// 12. PWA Update & Service Worker Lifecycle Management
function registerSW() {
  if ('serviceWorker' in navigator) {
    // Check if the page was already controlled by a service worker on load
    const wasControlled = !!navigator.serviceWorker.controller;

    const initRegistration = () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then(reg => {
          console.log('Service Worker registered successfully!', reg.scope);

          // Force check for updates on page load
          reg.update().catch(err => console.warn('SW update check failed:', err));

          // If a new service worker is already waiting (e.g. user dismissed prompt earlier and re-opened)
          if (reg.waiting) {
            showUpdateDialog(reg.waiting);
          }

          // Listen for new service worker updates being installed
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  // Only prompt if there is an active controller (meaning this is a dynamic update, not first install)
                  if (navigator.serviceWorker.controller) {
                    showUpdateDialog(newWorker);
                  }
                }
              });
            }
          });
        })
        .catch(err => {
          console.error('Service Worker registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
      initRegistration();
    } else {
      window.addEventListener('load', initRegistration);
    }

    // Handle controller change (reloading the page once skipWaiting has activated the new service worker)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (wasControlled) {
        reloadWithCacheBust();
      }
    });
  }
}

let appReloading = false;

function reloadWithCacheBust() {
  if (appReloading) return;
  appReloading = true;
  localStorage.setItem("kstw_updated_successfully", "true");
  const cleanUrl = window.location.origin + window.location.pathname + '?u=' + Date.now();
  window.location.replace(cleanUrl);
}

function showUpdateDialog(worker) {
  if (document.getElementById('update-modal')) return;

  const t = TRANSLATIONS[state.language] || TRANSLATIONS.de;
  const modal = document.createElement('div');
  modal.id = 'update-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'update-dialog-title');
  // Use z-[100] to sit above everything (safe area, header, etc.)
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm';
  
  let countdown = 5;
  let hasTriggeredRestart = false;
  let fallbackTimer = null;

  modal.innerHTML = `
    <div class="w-full max-w-sm bg-white dark:bg-[#0b1926] border border-black/[0.08] dark:border-white/[0.08] rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-zoom-in">
      <div class="flex items-center gap-3">
        <div class="h-12 w-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-400 flex items-center justify-center flex-shrink-0 shadow-inner">
          ${getIconHTML('update', 'text-[28px]')}
        </div>
        <div class="min-w-0">
          <h3 id="update-dialog-title" class="font-headline text-[18px] font-bold text-text-heading dark:text-white leading-snug">${t.updateAvailableTitle || "Update verfügbar!"}</h3>
          <p class="text-[12px] text-slate-500 dark:text-slate-400 font-medium">${t.updateAvailableDesc || "Neue Version ist bereit."}</p>
        </div>
      </div>
      <p class="text-sm text-text-main dark:text-slate-200 leading-relaxed">
        ${t.updatePrompt || "Ein neues Update für den Mensaplan ist verfügbar. Die App wird aktualisiert, um die neuesten Gerichte und Funktionen zu laden."}
      </p>
      <div class="flex flex-col gap-2.5 mt-1">
        <button id="update-now-btn" class="w-full h-12 bg-price-badge text-primary hover:opacity-95 active:scale-[0.98] transition-all font-label-md text-label-md rounded-2xl font-bold shadow-md flex items-center justify-center gap-2 select-none cursor-pointer">
          <span id="update-btn-label">${t.updateRestart || "App neu starten"}</span>
          <span id="update-countdown-badge" class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">5s</span>
        </button>
        <button id="update-later-btn" class="w-full h-10 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium text-sm rounded-xl transition-colors select-none cursor-pointer">
          ${t.updateLater || "Später"}
        </button>
        <p id="update-auto-text" class="text-[11px] text-center text-slate-500 dark:text-slate-400">
          ${(t.updateAutoRestart || "Automatischer Neustart in {n}s").replace("{n}", "5")}
        </p>
      </div>
    </div>
  `;

  // Append to app-container to stay within borders on desktop
  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    appContainer.appendChild(modal);
  } else {
    document.body.appendChild(modal);
  }

  const releaseFocus = trapFocus(modal);

  function triggerRestart() {
    if (hasTriggeredRestart) return;
    hasTriggeredRestart = true;
    releaseFocus();
    clearInterval(timerInterval);
    clearTimeout(autoTimer);

    const btn = document.getElementById('update-now-btn');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('opacity-80', 'pointer-events-none');
      btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-primary inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>${t.offlineBannerUpdating || "Wird aktualisiert..."}`;
    }

    const laterBtn = document.getElementById('update-later-btn');
    if (laterBtn) {
      laterBtn.remove();
    }

    if (worker) {
      worker.postMessage({ action: 'skipWaiting' });
    }

    // Safety fallback: if controllerchange doesn't fire within 2500ms, force reload
    fallbackTimer = setTimeout(() => {
      reloadWithCacheBust();
    }, 2500);
  }

  // Countdown handler
  const timerInterval = setInterval(() => {
    countdown--;
    const badge = document.getElementById('update-countdown-badge');
    const autoText = document.getElementById('update-auto-text');
    if (badge) badge.textContent = `${countdown}s`;
    if (autoText) autoText.textContent = (t.updateAutoRestart || "Automatischer Neustart in {n}s").replace("{n}", countdown);

    if (countdown <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);

  // Auto-restart after 5 seconds
  const autoTimer = setTimeout(() => {
    triggerRestart();
  }, 5000);

  // Click handler for manual immediate restart
  const restartBtn = document.getElementById('update-now-btn');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      triggerRestart();
    });
  }

  // Click handler for "Später" dismissal
  const laterBtn = document.getElementById('update-later-btn');
  if (laterBtn) {
    laterBtn.addEventListener('click', () => {
      releaseFocus();
      clearInterval(timerInterval);
      clearTimeout(autoTimer);
      clearTimeout(fallbackTimer);
      modal.remove();
    });
  }
}

function cleanUpdateUrlParam() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('u')) {
      url.searchParams.delete('u');
      const cleanUrl = url.pathname + (url.search ? url.search : '') + url.hash;
      window.history.replaceState(null, '', cleanUrl);
    }
  } catch (_e) {
    // ignore
  }
}

function checkUpdatedToast() {
  cleanUpdateUrlParam();
  if (localStorage.getItem("kstw_updated_successfully") === "true") {
    localStorage.removeItem("kstw_updated_successfully");
    // Wait for the app to finish rendering and load before showing the toast
    setTimeout(() => {
      showSuccessToast();
    }, 1200);
  }
}

function showSuccessToast() {
  if (document.getElementById('update-toast')) return;

  const t = TRANSLATIONS[state.language] || TRANSLATIONS.de;
  const toast = document.createElement('div');
  toast.id = 'update-toast';
  // Slide in from bottom, aligned to app-container if possible, or centered
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-32px)] max-w-sm bg-[#143d59] dark:bg-[#122338] dark:border dark:border-white/[0.08] text-white rounded-xl px-4 py-3 shadow-lg flex items-center justify-between gap-3 animate-slide-in';
  
  toast.innerHTML = `
    <div class="flex items-center gap-2.5">
      ${getIconHTML('check_circle', 'text-[20px] text-price-badge')}
      <span class="text-sm font-semibold tracking-wide">${t.updateSuccessToast}</span>
    </div>
    <button id="close-toast-btn" class="text-white/60 hover:text-white transition-colors flex items-center justify-center">${getIconHTML('close', 'text-[18px]')}</button>
  `;

  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    appContainer.appendChild(toast);
  } else {
    document.body.appendChild(toast);
  }

  const dismiss = () => {
    toast.classList.remove('animate-slide-in');
    toast.classList.add('animate-slide-out');
    setTimeout(() => toast.remove(), 300);
  };

  document.getElementById('close-toast-btn').addEventListener('click', dismiss);
  
  // Auto dismiss after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      dismiss();
    }
  }, 4000);
}

// 12. Standard Allergens Fallback Map


function findDishById(dishId, preferredDate = state.activeDate) {
  if (preferredDate) {
    const day = state.menuData.find(d => d.date === preferredDate);
    if (day) {
      const dish = (day.dishes || []).find(d => String(d.id) === String(dishId));
      if (dish) return dish;
    }
  }
  for (const day of state.menuData) {
    const dish = (day.dishes || []).find(d => String(d.id) === String(dishId));
    if (dish) return dish;
  }
  return null;
}

function showAllergens(dishId) {
  const dish = findDishById(dishId, state.activeDate);
  if (!dish) return;

  const t = TRANSLATIONS[state.language] || TRANSLATIONS.de;
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  const allergensNamesText = customFields["allergens_names"] || "";
  const codes = getDishAllergens(dish);
  if (codes.length === 0) return;

  const allergenMap = {};
  if (allergensNamesText) {
    const parts = allergensNamesText.split(/,\s*(?=[0-9]{1,2}[a-z]{0,3}\s*=)/i).map(p => p.trim()).filter(Boolean);
    parts.forEach(part => {
      const eqIdx = part.indexOf("=");
      if (eqIdx !== -1) {
        const code = part.substring(0, eqIdx).trim();
        const val = part.substring(eqIdx + 1).trim();
        
        const pipeIdx = val.indexOf("|");
        let nameDe = val;
        let nameEn = val;
        if (pipeIdx !== -1) {
          nameDe = val.substring(0, pipeIdx).trim();
          nameEn = val.substring(pipeIdx + 1).trim();
        }
        if (isValidAllergenCode(code)) {
          allergenMap[code.toLowerCase()] = { de: nameDe, en: nameEn };
        }
      }
    });
  }

  const title = state.language === "en" ? "Allergens & Additives" : "Allergene & Zusatzstoffe";
  const titleEl = document.getElementById("allergens-modal-title");
  if (titleEl) titleEl.textContent = title;
  
  const disclaimerEl = document.getElementById("allergens-modal-disclaimer");
  if (disclaimerEl) disclaimerEl.textContent = t.allergenDisclaimer;

  const listContainer = document.getElementById("allergens-modal-list");
  listContainer.innerHTML = "";

  const evalResult = evaluateDishAllergies(dish, state.allergies || []);
  if (evalResult.dietConflict) {
    const conflictTemplate = evalResult.dietConflict.type === "vegetarian_with_non_veg_allergen"
      ? t.conflictVegetarianText
      : t.conflictVeganText;
    const conflictText = conflictTemplate.replace("{codes}", evalResult.dietConflict.codes.join(", "));
    listContainer.innerHTML += `
      <div class="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs font-medium mb-1">
        ${getIconHTML('warning', 'text-sm flex-shrink-0 mt-0.5')}
        <span class="min-w-0 break-words">${escapeHtml(conflictText)}</span>
      </div>
    `;
  }
  
  codes.forEach(code => {
    const lowerCode = code.toLowerCase();
    const info = allergenMap[lowerCode] || allergenMap[code] || STANDARD_ALLERGENS[code] || STANDARD_ALLERGENS[lowerCode] || { de: code, en: code };
    const name = state.language === "en" ? info.en : info.de;
    
    listContainer.innerHTML += `
      <div class="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#182c44] border border-black/[0.04] dark:border-white/[0.08]">
        <span class="inline-flex items-center justify-center flex-shrink-0 bg-primary-container dark:bg-price-badge text-white dark:text-primary text-[11px] font-bold px-2 py-0.5 rounded w-11 text-center">
          ${escapeHtml(code)}
        </span>
        <span class="text-sm text-text-heading dark:text-slate-100 font-medium min-w-0 break-words">
          ${escapeHtml(name)}
        </span>
      </div>
    `;
  });

  const modal = document.getElementById("allergens-modal");
  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  
  const modalBox = modal.querySelector(".animate-zoom-in") || modal.firstElementChild;
  modalBox.classList.remove("animate-zoom-out");
  modalBox.classList.add("animate-zoom-in");

  allergensFocusRelease = trapFocus(modal);
}
window.showAllergens = showAllergens;

function closeAllergensModal() {
  const modal = document.getElementById("allergens-modal");
  const modalBox = modal.querySelector(".animate-zoom-in") || modal.firstElementChild;
  modalBox.classList.remove("animate-zoom-in");
  modalBox.classList.add("animate-zoom-out");
  document.body.classList.remove("overflow-hidden");
  if (allergensFocusRelease) {
    allergensFocusRelease();
    allergensFocusRelease = null;
  }
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 180);
}
window.closeAllergensModal = closeAllergensModal;
