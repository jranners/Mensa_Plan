

function getLocalIsoDate(date = new Date()) {
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
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
  allergies: []
};

let onboardingInitialized = false;

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
    const msg = state.language === "en" ? "Copied to clipboard!" : "In die Zwischenablage kopiert!";
    showToast(msg);
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

  loadPreferences();
  applyLanguage();
  initInstallPrompt();

  // Register PWA Service Worker & check for updates
  registerSW();
  checkUpdatedToast();

  if (hasPreferences()) {
    hideOnboarding();
    await fetchAndRender();
    checkAllergenPrompt();

    // URL-Parameter beim Start auswerten
    const urlParams = new URLSearchParams(window.location.search);
    const startView = urlParams.get('view');
    if (startView === 'today') {
      const todayIso = getLocalIsoDate();
      setActiveDate(todayIso);
    } else if (startView === 'settings') {
      showOnboarding(true);
    }
  } else {
    showOnboarding();
  }

  // Setup Global Event Listeners
  document.getElementById("settings-btn").addEventListener("click", () => {
    showOnboarding(true);
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
    const shareUrl = window.location.href;

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

  // Favorites Event Delegation
  document.addEventListener('click', e => {
    const btn = e.target.closest('.fav-btn');
    if (!btn) return;
    const dishId = btn.dataset.dishId;
    const added = toggleFavorite(dishId);
    const icon = btn.querySelector('.fav-icon');
    if (icon) {
      icon.setAttribute('fill', added ? '#ffd600' : 'none');
      icon.setAttribute('stroke', added ? '#ffd600' : 'currentColor');
    }
    if ('vibrate' in navigator) navigator.vibrate(added ? [10] : [5]); // Haptic
  });

  const closeOnboardingBtn = document.getElementById("close-onboarding-btn");
  if (closeOnboardingBtn) {
    closeOnboardingBtn.addEventListener("click", () => {
      hideOnboarding();
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
    <span class="text-sm font-medium text-text-heading dark:text-slate-200">Aktualisieren...</span>
  `;
  document.body.prepend(indicator);

  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) startY = e.touches[0].clientY;
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

  document.addEventListener('touchend', () => {
    if (!isPulling) return;
    const indicatorY = parseFloat(indicator.style.transform.match(/translateY\((.+)%\)/)?.[1] || 0);
    if (indicatorY >= 100) {
      triggerManualReload();
    }
    indicator.style.transform = 'translateX(-50%) translateY(-100%)';
    startY = 0;
    isPulling = false;
  });
})();

// 6. Onboarding & Preferences Management
const ALLERGEN_GROUPS = {
  "gluten": {
    de: "Gluten",
    en: "Gluten",
    codes: ["11", "11w", "11a", "11r", "11b", "11g", "11c", "11h", "11d", "11k"]
  },
  "crustaceans": {
    de: "Krebstiere",
    en: "Crustaceans",
    codes: ["12"]
  },
  "eggs": {
    de: "Eier",
    en: "Eggs",
    codes: ["13"]
  },
  "fish": {
    de: "Fisch",
    en: "Fish",
    codes: ["14"]
  },
  "peanuts": {
    de: "Erdnüsse",
    en: "Peanuts",
    codes: ["15"]
  },
  "soy": {
    de: "Soja",
    en: "Soy",
    codes: ["16"]
  },
  "milk": {
    de: "Milch & Laktose",
    en: "Milk & Lactose",
    codes: ["17", "18"]
  },
  "nuts": {
    de: "Schalenfrüchte (Nüsse)",
    en: "Nuts (Tree nuts)",
    codes: ["19", "19a", "19m", "19b", "19h", "19c", "19d", "19w", "19e", "19p", "19pe", "19f", "19g", "19pi", "19mac"]
  },
  "celery": {
    de: "Sellerie",
    en: "Celery",
    codes: ["20"]
  },
  "mustard": {
    de: "Senf",
    en: "Mustard",
    codes: ["21"]
  },
  "sesame": {
    de: "Sesamsamen",
    en: "Sesame",
    codes: ["22"]
  },
  "sulfites": {
    de: "Sulfite / Schwefeldioxid",
    en: "Sulfites / Sulfur dioxide",
    codes: ["23", "5"]
  },
  "lupins": {
    de: "Lupinen",
    en: "Lupins",
    codes: ["24"]
  },
  "molluscs": {
    de: "Weichtiere",
    en: "Molluscs",
    codes: ["25"]
  },
  "gelatin": {
    de: "Gelatine",
    en: "Gelatin",
    codes: ["27"]
  },
  "alcohol": {
    de: "Alkohol",
    en: "Alcohol",
    codes: ["26", "32"]
  }
};

const ALLERGEN_CODE_REGEX = /^(?:[1-9]|[12][0-9]|3[0-2])(?:[a-z]{1,3})?$/i;

function isValidAllergenCode(code) {
  if (!code || typeof code !== "string") return false;
  const cleaned = code.trim();
  if (!ALLERGEN_CODE_REGEX.test(cleaned)) return false;
  const lower = cleaned.toLowerCase();
  // Exclude weight unit grams like 3g, 5g, 10g, 15g, 20g, 25g (only 11g and 19g are valid allergen subcodes ending in g)
  if (lower.endsWith("g") && lower !== "11g" && lower !== "19g") return false;
  return true;
}

function getDishAllergens(dish) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  // 1) Extrahiere Codes aus custom_fields["allergens_numbers"]
  const officialCodes = (customFields["allergens_numbers"] || "")
    .split(",")
    .map(c => c.trim())
    .filter(Boolean);

  const mergedCodesSet = new Set();

  officialCodes.forEach(code => {
    if (isValidAllergenCode(code)) {
      mergedCodesSet.add(code.toLowerCase());
    }
  });

  // Prüfe, ob das Gericht selbst ein reines Dessert ist
  const category = dish.category || null;
  const catNameDe = (category && category.name_de) ? category.name_de.toLowerCase() : "";
  const rawType = (customFields["menu_type"] || "").toLowerCase();
  const dishNameDe = (dish.name_de || "").toLowerCase();
  const isPureDessert = catNameDe.includes("dessert") || 
                        catNameDe.includes("nachspeise") || 
                        rawType.includes("dessert") || 
                        /^(?:dessert|nachspeise)\b/i.test(dishNameDe.trim());

  // 2) Extrahiere Codes aus dish.name_de, dish.name_en und dish_ger_1 bis dish_ger_5
  [dish.name_de, dish.name_en].forEach(nameStr => {
    if (nameStr) {
      const matches = nameStr.matchAll(/\(([^)]+)\)/g);
      for (const m of matches) {
        m[1].split(",").forEach(c => {
          const cleaned = c.trim();
          if (isValidAllergenCode(cleaned)) {
            mergedCodesSet.add(cleaned.toLowerCase());
          }
        });
      }
    }
  });

  for (let i = 1; i <= 5; i++) {
    const partText = customFields[`dish_ger_${i}`] || "";
    if (partText) {
      // 5) Wenn Komponente ein generisches Dessert ist und Gericht selbst KEIN reines Dessert ist:
      const isGenericDessertComponent = !isPureDessert && (/^dessert\b/i.test(partText.trim()) || /(?:nachspeise|dessert)/i.test(partText));
      if (!isGenericDessertComponent) {
        const matches = partText.matchAll(/\(([^)]+)\)/g);
        for (const m of matches) {
          m[1].split(",").forEach(c => {
            const cleaned = c.trim();
            if (isValidAllergenCode(cleaned)) {
              mergedCodesSet.add(cleaned.toLowerCase());
            }
          });
        }
      }
    }
  }

  // Diet-Erkennung
  const foodIcon = (customFields["food_icon"] || "").toUpperCase();
  const isVegan = foodIcon.includes("VGN") || 
                  getDishDietType(dish) === "vegan" || 
                  dishNameDe.includes("vegan");
  const isVegetarian = isVegan || 
                       foodIcon.includes("VGT") || 
                       foodIcon.includes("VG") || 
                       getDishDietType(dish) === "vegetarian" || 
                       dishNameDe.includes("vegetarisch");

  // 3) Wenn ein Gericht VEGAN ist:
  // Entferne ALLE nicht-veganen Codes: 12, 13, 14, 17, 18, 25, 27, 28, 29, 30
  if (isVegan) {
    const NON_VEGAN_CODES = ["12", "13", "14", "17", "18", "25", "27", "28", "29", "30"];
    NON_VEGAN_CODES.forEach(code => mergedCodesSet.delete(code));
  } else if (isVegetarian) {
    // 4) Wenn ein Gericht VEGETARISCH ist:
    // Entferne ALLE Fleisch-/Fisch-/Gelatine-Codes: 12, 14, 25, 27, 28, 29, 30
    const NON_VEG_CODES = ["12", "14", "25", "27", "28", "29", "30"];
    NON_VEG_CODES.forEach(code => mergedCodesSet.delete(code));
  }

  // 5) Wenn eine Komponente ein generisches Dessert ist und das Gericht selbst KEIN reines Dessert ist:
  // Dessen Dessert-Allergene (1, 3, 11h, 11w, 17, 18, 27) dürfen das Hauptgericht nicht kontaminieren
  let hasGenericDessertComp = false;
  for (let i = 1; i <= 5; i++) {
    const pText = customFields[`dish_ger_${i}`] || "";
    if (!isPureDessert && (/^dessert\b/i.test(pText.trim()) || /(?:nachspeise|dessert)/i.test(pText))) {
      hasGenericDessertComp = true;
      break;
    }
  }

  if (hasGenericDessertComp && !isPureDessert) {
    const mainComponentsCodes = new Set();
    [dish.name_de, dish.name_en].forEach(nameStr => {
      if (nameStr) {
        const matches = nameStr.matchAll(/\(([^)]+)\)/g);
        for (const m of matches) {
          m[1].split(",").forEach(c => {
            if (isValidAllergenCode(c.trim())) mainComponentsCodes.add(c.trim().toLowerCase());
          });
        }
      }
    });
    for (let i = 1; i <= 5; i++) {
      const partText = customFields[`dish_ger_${i}`] || "";
      if (partText && !(/^dessert\b/i.test(partText.trim()) || /(?:nachspeise|dessert)/i.test(partText))) {
        const matches = partText.matchAll(/\(([^)]+)\)/g);
        for (const m of matches) {
          m[1].split(",").forEach(c => {
            if (isValidAllergenCode(c.trim())) mainComponentsCodes.add(c.trim().toLowerCase());
          });
        }
      }
    }
    if (mainComponentsCodes.size > 0) {
      const DESSERT_CODES = ["1", "3", "11h", "11w", "17", "18", "27"];
      DESSERT_CODES.forEach(dCode => {
        if (!mainComponentsCodes.has(dCode)) {
          mergedCodesSet.delete(dCode);
        }
      });
    }
  }

  return [...mergedCodesSet];
}

function shouldExcludeDish(dish, selectedAllergyGroups) {
  if (!selectedAllergyGroups || selectedAllergyGroups.length === 0) return false;
  
  const dishAllergens = getDishAllergens(dish);
  
  // If the dish has absolutely no allergen declarations, we do NOT exclude it.
  // We keep it visible but display a warning badge (the user requested this).
  if (dishAllergens.length === 0) return false;
  
  // Get all codes that are excluded
  const excludedCodes = new Set();
  selectedAllergyGroups.forEach(groupKey => {
    const group = ALLERGEN_GROUPS[groupKey];
    if (group) {
      group.codes.forEach(code => excludedCodes.add(code.toLowerCase()));
    }
  });
  
  // Check if the dish contains any excluded codes
  return dishAllergens.some(code => excludedCodes.has(code.toLowerCase()));
}

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
}

function savePreferences(language, canteens, diet, allergies = []) {
  state.language = language;
  state.selectedCanteens = canteens;
  state.diet = diet;
  state.allergies = allergies;

  localStorage.setItem("kstw_lang", language);
  localStorage.setItem("kstw_canteens", JSON.stringify(canteens));
  localStorage.setItem("kstw_diet", diet);
  localStorage.setItem("kstw_allergies", JSON.stringify(allergies));
  localStorage.setItem("kstw_prefs_saved", "true");
}

function saveMenuCache(data) {
  try {
    const time = Date.now();
    localStorage.setItem("kstw_menu_cache", JSON.stringify(data));
    localStorage.setItem("kstw_menu_cache_time", time.toString());
    state.lastCacheTime = time;
  } catch (err) {
    console.error("Failed to save menu cache:", err);
  }
}

function loadMenuCache() {
  try {
    const cachedData = localStorage.getItem("kstw_menu_cache");
    const cachedTime = localStorage.getItem("kstw_menu_cache_time");
    if (cachedData && cachedTime) {
      state.menuData = JSON.parse(cachedData);
      state.lastCacheTime = parseInt(cachedTime);
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
      state.announcements = JSON.parse(cached);
      return true;
    }
  } catch (err) {
    console.error("Failed to load announcements cache:", err);
  }
  return false;
}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
}

// 7. Onboarding UI Rendering
function initOnboardingUI() {
  const t = TRANSLATIONS[state.language];

  // Render Language Buttons
  const langContainer = document.getElementById("lang-selector");
  langContainer.innerHTML = `
    <button id="lang-de" class="px-6 py-2 rounded-full border shadow-sm font-label-md text-label-md transition-all focus:outline-none ${state.language === "de" ? "bg-[#143d59] dark:bg-price-badge text-white dark:text-primary border-[#143d59] dark:border-price-badge font-bold" : "bg-slate-50 dark:bg-[#0b1926] text-on-surface-variant dark:text-slate-300 border-black/[0.08] dark:border-white/[0.08]"}" onclick="changeLanguage('de')">Deutsch</button>
    <button id="lang-en" class="px-6 py-2 rounded-full border shadow-sm font-label-md text-label-md transition-all focus:outline-none ${state.language === "en" ? "bg-[#143d59] dark:bg-price-badge text-white dark:text-primary border-[#143d59] dark:border-price-badge font-bold" : "bg-slate-50 dark:bg-[#0b1926] text-on-surface-variant dark:text-slate-300 border-black/[0.08] dark:border-white/[0.08]"}" onclick="changeLanguage('en')">English</button>
  `;

  // Render Canteen Checkbox List (Clustered into Canteens and Bistros)
  const canteenListContainer = document.getElementById("canteen-checkbox-list");
  canteenListContainer.innerHTML = "";
  
  const canteensHTML = [];
  const bistrosHTML = [];

  Object.keys(CANTEENS).forEach(key => {
    const canteen = CANTEENS[key];
    const isChecked = state.selectedCanteens.includes(key) ? "checked" : "";
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

  const canteenLabel = state.language === "de" ? "Mensen" : "Canteens";
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
      
      // Update state in real-time to preserve selection across re-renders
      const checkedBoxes = document.querySelectorAll(".canteen-checkbox:checked");
      state.selectedCanteens = Array.from(checkedBoxes).map(cb => cb.value);
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
    const isActive = state.diet === opt.value;
    dietContainer.innerHTML += `
      <button class="diet-option-btn flex-1 py-2 font-label-md text-label-md text-center rounded transition-colors focus:outline-none ${isActive ? "bg-price-badge text-primary font-bold shadow-sm" : "text-on-surface-variant dark:text-slate-300 opacity-70 hover:opacity-100"}" onclick="changeDietPreference('${opt.value}')">
        ${opt.label}
      </button>
    `;
  });

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
    const isChecked = state.allergies.includes(key) ? "checked" : "";
    const name = state.language === "en" ? group.en : group.de;
    
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
      state.allergies = Array.from(checkedBoxes).map(cb => cb.value);
    };
    updateBox();
    chk.addEventListener("change", updateBox);
  });

  // Setup Submit Button Handler
  document.getElementById("submit-onboarding-btn").onclick = async () => {
    const checkboxes = document.querySelectorAll(".canteen-checkbox:checked");
    const selected = Array.from(checkboxes).map(cb => cb.value);
    
    if (selected.length === 0) {
      alert(state.language === "de" ? "Bitte wähle mindestens eine Mensa aus!" : "Please select at least one canteen!");
      return;
    }

    const allergyCbs = document.querySelectorAll(".allergy-checkbox:checked");
    const selectedAllergies = Array.from(allergyCbs).map(cb => cb.value);

    savePreferences(state.language, selected, state.diet, selectedAllergies);
    localStorage.setItem("kstw_allergen_prompt_shown", "true");
    hideOnboarding();
    await fetchAndRender();
  };
}

window.changeLanguage = function(lang) {
  state.language = lang;
  applyLanguage();
  initOnboardingUI();
  initInstallPrompt();
};

window.changeDietPreference = function(diet) {
  state.diet = diet;
  initOnboardingUI();
};

function showOnboarding(isSettingsMenu = false, expandAllergens = false) {
  state.isSettingsMenu = isSettingsMenu;
  const onboarding = document.getElementById("onboarding");
  onboarding.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  
  if (!onboardingInitialized) {
    initOnboardingUI();
    onboardingInitialized = true;
  }
  
  // Expand or collapse the allergen accordion based on flag
  const accordion = document.getElementById("allergen-details-accordion");
  if (accordion) {
    if (expandAllergens) {
      accordion.open = true;
      // Scroll it into view after a short delay so the container has rendered
      setTimeout(() => {
        accordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    } else {
      accordion.open = false;
    }
  }
  
  initInstallPrompt();
  
  const closeBtn = document.getElementById("close-onboarding-btn");
  const t = TRANSLATIONS[state.language];
  
  if (isSettingsMenu) {
    if (closeBtn) closeBtn.classList.remove("hidden");
    document.getElementById("onboarding-title").textContent = t.settings;
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.saveSettings} ${getIconHTML('check', 'text-[20px]')}`;
    
    const resetContainer = document.getElementById("reset-container") || document.createElement("div");
    resetContainer.id = "reset-container";
    resetContainer.className = "mt-4 flex justify-center";
    resetContainer.innerHTML = `
      <button class="px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors font-label-md text-label-md" onclick="resetApp()">
        ${t.resetBtn}
      </button>
    `;
    document.getElementById("onboarding-content-area").appendChild(resetContainer);
  } else {
    if (closeBtn) closeBtn.classList.add("hidden");
    document.getElementById("onboarding-title").textContent = t.welcome;
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.showMenu} ${getIconHTML('arrow_forward', 'text-[20px]')}`;
    
    const resetContainer = document.getElementById("reset-container");
    if (resetContainer && resetContainer.parentNode) {
      resetContainer.parentNode.removeChild(resetContainer);
    }
  }
  removeSplash();
}

function hideOnboarding() {
  state.isSettingsMenu = false;
  document.getElementById("onboarding").classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

window.resetApp = function() {
  localStorage.clear();
  location.reload();
};

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
          alert(state.language === "de" 
            ? "Nutze das Browsermenü (Dreipunkt-Menü oben rechts -> 'App installieren' oder 'Zum Startbildschirm hinzufügen'), um den Mensaplan hinzuzufügen." 
            : "Use your browser's menu (three dots in top right -> 'Install app' or 'Add to Home screen') to install the app.");
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

    dishes.forEach(dish => {
      const customFields = {};
      (dish.custom_fields || []).forEach(f => {
        if (f) customFields[f.field_id] = f.value;
      });

      let servingTime = "";
      const dishInfo = customFields["dish_info"] || "";
      if (dishInfo && !/^\s*\d?\s*$/.test(dishInfo)) {
        const timeMatch = dishInfo.match(/(\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2})/);
        if (timeMatch) {
          servingTime = timeMatch[1].replace(/\./g, ":");
        }
      }

      let expired = false;
      if (servingTime) {
        const endStr = servingTime.split("-")[1].trim();
        const endHourMatch = endStr.match(/(\d{2})[.:](\d{2})/);
        if (endHourMatch) {
          const dishEndHour = parseInt(endHourMatch[1]) + parseInt(endHourMatch[2])/60;
          if (currentHour > dishEndHour) {
            expired = true;
          }
        }
      } else {
        // Fallback to canteen general closing time
        let generalEndHour = 14.5;
        const openingInfo = canteen.infokurz;
        if (openingInfo) {
          const currentDayOfWeek = now.getDay();
          const lines = openingInfo.split("\n");
          const dayNamesMap = {
            1: ["Mo", "Mon"], 2: ["Di", "Tue"], 3: ["Mi", "Wed"], 4: ["Do", "Thu"], 5: ["Fr", "Fri"], 6: ["Sa", "Sat"], 0: ["So", "Sun"]
          };
          const searchTerms = dayNamesMap[currentDayOfWeek] || [];
          for (const line of lines) {
            if (searchTerms.some(term => line.includes(term)) || (currentDayOfWeek >= 1 && currentDayOfWeek <= 5 && line.includes("Mo - Fr"))) {
              const hourMatch = line.match(/-\s*(\d{2})[.:](\d{2})/);
              if (hourMatch) {
                generalEndHour = parseInt(hourMatch[1]) + parseInt(hourMatch[2])/60;
              }
            }
          }
        }
        if (currentHour > generalEndHour) {
          expired = true;
        }
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
  const todayIso = getLocalIsoDate();
  return state.menuData.some(d => d.date >= todayIso && d.dishes && d.dishes.length > 0);
}

async function fetchAndRender(forceNetwork = false) {
  const hasCache = loadMenuCache();
  loadAnnouncementsCache();
  
  if (hasCache && hasValidCurrentOrFutureMenuData()) {
    // We have valid current/future cached data, let's determine the active date and render immediately!
    const daysWithDishes = state.menuData.filter(d => hasDishesForSelectedCanteensAndDiet(d.date));
    if (daysWithDishes.length > 0) {
      const todayIso = getLocalIsoDate();
      const hasTodayWithMeals = daysWithDishes.some(d => d.date === todayIso) && hasAvailableDishesForDate(todayIso);
      
      if (hasTodayWithMeals) {
        state.activeDate = todayIso;
      } else {
        const sortedDays = [...daysWithDishes].sort((a, b) => a.date.localeCompare(b.date));
        const nextAvailableDay = sortedDays.find(d => d.date >= todayIso && hasAvailableDishesForDate(d.date));
        if (nextAvailableDay) {
          state.activeDate = nextAvailableDay.date;
        } else {
          const futureDays = sortedDays.filter(d => d.date >= todayIso);
          state.activeDate = futureDays.length > 0 ? futureDays[0].date : sortedDays[0].date;
        }
      }
    } else {
      state.activeDate = getLocalIsoDate();
    }
    
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
    
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.getTime());
    monday.setDate(diff);
    
    const start_date = monday;
    const end_date = new Date(monday.getTime() + 13 * 24 * 60 * 60 * 1000);

    try {
      const [rawData, rawAnnouncements] = await Promise.all([
        fetchWeekMenuData(start_date, end_date),
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
      
      const daysWithDishes = state.menuData ? state.menuData.filter(d => hasDishesForSelectedCanteensAndDiet(d.date)) : [];
      if (daysWithDishes.length > 0) {
        const todayIso = getLocalIsoDate();
        const hasTodayWithMeals = daysWithDishes.some(d => d.date === todayIso) && hasAvailableDishesForDate(todayIso);
        
        if (hasTodayWithMeals) {
          state.activeDate = todayIso;
        } else {
          const sortedDays = [...daysWithDishes].sort((a, b) => a.date.localeCompare(b.date));
          const nextAvailableDay = sortedDays.find(d => d.date >= todayIso && hasAvailableDishesForDate(d.date));
          if (nextAvailableDay) {
            state.activeDate = nextAvailableDay.date;
          } else {
            const futureDays = sortedDays.filter(d => d.date >= todayIso);
            state.activeDate = futureDays.length > 0 ? futureDays[0].date : sortedDays[0].date;
          }
        }
      } else {
        state.activeDate = getLocalIsoDate();
      }
      
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

  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.getTime());
  monday.setDate(diff);
  
  const start_date = monday;
  const end_date = new Date(monday.getTime() + 13 * 24 * 60 * 60 * 1000);

  try {
    const [rawData, rawAnnouncements] = await Promise.all([
      fetchWeekMenuData(start_date, end_date),
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
    
    // Preserve previously selected active date if available in updated data
    const previousActiveDate = state.activeDate;
    const hasPreviousDateInNewData = state.menuData && state.menuData.some(d => d.date === previousActiveDate);

    if (!previousActiveDate || !hasPreviousDateInNewData) {
      const daysWithDishes = state.menuData ? state.menuData.filter(d => hasDishesForSelectedCanteensAndDiet(d.date)) : [];
      if (daysWithDishes.length > 0) {
        const todayIso = getLocalIsoDate();
        const hasTodayWithMeals = daysWithDishes.some(d => d.date === todayIso) && hasAvailableDishesForDate(todayIso);
        
        if (hasTodayWithMeals) {
          state.activeDate = todayIso;
        } else {
          const sortedDays = [...daysWithDishes].sort((a, b) => a.date.localeCompare(b.date));
          const nextAvailableDay = sortedDays.find(d => d.date >= todayIso && hasAvailableDishesForDate(d.date));
          if (nextAvailableDay) {
            state.activeDate = nextAvailableDay.date;
          } else {
            const futureDays = sortedDays.filter(d => d.date >= todayIso);
            state.activeDate = futureDays.length > 0 ? futureDays[0].date : sortedDays[0].date;
          }
        }
      }
    } else {
      state.activeDate = previousActiveDate;
    }
    
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
      <button id="offline-refresh-btn" ${btnDisabled} class="h-9 px-4 bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:pointer-events-none font-bold" onclick="triggerManualReload()">
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

window.triggerManualReload = async function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update().catch(() => {});
    });
  }
  await updateMenuDataBackground(true);
};

async function fetchWeekMenuData(startDate, endDate) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const payload = {
    "p_organization_id": SUPABASE_CONFIG.orgId,
    "p_start_date": getLocalIsoDate(startDate),
    "p_end_date": getLocalIsoDate(endDate)
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

    return await response.json();
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
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Failed to fetch announcements:", error);
    return null;
  }
}

// 9. UI Rendering & Interaction
function renderLoading() {
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

const FAVORITES_KEY = 'kstw_favorites';

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; }
  catch { return []; }
}

function toggleFavorite(dishId) {
  const favs = getFavorites();
  const idx = favs.indexOf(dishId);
  if (idx === -1) favs.push(dishId);
  else favs.splice(idx, 1);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  return idx === -1; // true = wurde hinzugefügt
}

function isFavorite(dishId) {
  return getFavorites().includes(dishId);
}

function renderError() {
  const t = TRANSLATIONS[state.language];
  const dateContainer = document.getElementById("active-date-container");
  if (dateContainer) dateContainer.innerHTML = "";
  document.getElementById("main-feed").innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-red-600 dark:text-red-400 gap-4">
      ${getIconHTML('error', 'text-[48px]')}
      <p class="font-label-lg text-label-lg">${t.errorLoading}</p>
      <button class="mt-4 px-6 py-2 bg-primary-container dark:bg-price-badge text-white dark:text-primary font-bold rounded-lg font-label-md shadow-sm" onclick="fetchAndRender()">${state.language === "de" ? "Erneut versuchen" : "Retry"}</button>
    </div>
  `;
  removeSplash();
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
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
          <h4 class="font-bold mb-1">${escapeHTML(announce.topic)}</h4>
          <p class="leading-relaxed">${escapeHTML(announce.content)}</p>
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

  const todayStr = getLocalIsoDate();

  daysWithDishes.forEach(day => {
    const date = new Date(day.date);
    const dayNames = {
      de: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
      en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    };
    
    const dayStr = dayNames[state.language][date.getDay()];
    const dateNum = date.getDate();
    
    const isToday = day.date === todayStr;
    const formatted = isToday 
      ? (state.language === "de" ? "Heute" : "Today") 
      : `${dayStr} ${dateNum}`;
      
    const isActive = day.date === state.activeDate;
    
    const btnClass = isActive 
      ? "bg-price-badge text-primary shadow-sm font-bold scale-[1.02]" 
      : "text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:text-primary dark:hover:text-white hover:shadow-sm font-medium";
      
    selectorContainer.innerHTML += `
      <button class="flex-shrink-0 px-4 py-2 rounded-lg font-label-md text-label-md transition-all duration-200 ${btnClass}" onclick="setActiveDate('${day.date}')">
        ${formatted}
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

window.setActiveDate = function(dateStr) {
  state.activeDate = dateStr;
  renderDateSelector(false);
  renderCanteenMenu();
};

function renderDietToggle() {
  const container = document.getElementById("diet-toggle-container");
  const t = TRANSLATIONS[state.language];
  container.innerHTML = "";
  
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
      <button class="flex-1 py-2 rounded-lg font-label-md text-label-md text-center transition-all duration-200 focus:outline-none ${activeClass}" onclick="setDietFilter('${opt.value}')">
        ${opt.label}
      </button>
    `;
  });
}

window.setDietFilter = function(dietVal) {
  state.diet = dietVal;
  localStorage.setItem("kstw_diet", dietVal);
  renderDietToggle();
  renderCanteenMenu();
};

function getCanteenKeyFromDish(dish, canteenKey, canteen) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  const dishOrtId = customFields["ort_id"] || "";
  if (dishOrtId && canteen.ort_id) {
    if (dishOrtId === canteen.ort_id) return true;
  }
  
  const dishLocation = (customFields["location"] || "").toLowerCase();
  if (dishLocation && canteen.name) {
    if (dishLocation.includes(canteen.name.toLowerCase()) || 
        canteen.name.toLowerCase().includes(dishLocation)) {
      return true;
    }
  }

  const dishScreens = (dish.screens || []).map(s => (s.location || "").toLowerCase()).filter(Boolean);
  const canteenScreens = (canteen.screen_locations || []).map(s => s.toLowerCase());
  
  const overlap = dishScreens.some(screen => canteenScreens.some(cs => cs.includes(screen) || screen.includes(cs)));
  if (overlap) return true;

  // Uni-Mensa Zülpicher Straße (ort_id 201) and Mensa Lindenthal (ort_id 231) share the central kitchen production
  if (canteenKey === "unimensa" && (dishOrtId === "231" || dishLocation.includes("lindenthal"))) {
    return true;
  }

  // Fallback for central production dishes (Gemeinkostenstelle HSG / ort_id 9999)
  // which KStW cataloged centrally for the main Mensen (Zülpicher Straße / Lindenthal)
  if ((dishOrtId === "9999" || dishLocation.includes("gemeinkostenstelle")) && 
      (canteenKey === "unimensa" || canteenKey === "robertkoch")) {
    return true;
  }

  return false;
}

function getDishDietType(dish) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });
  
  const icon = customFields["food_icon"] || "";
  if (icon.includes("VGN")) return "vegan";
  if (icon.includes("VGT") || icon.includes("VGN")) return "vegetarian";
  
  const name = (dish.name_de || "").toLowerCase();
  if (name.includes("(vegan)") || name.includes(" vegan")) return "vegan";
  if (name.includes("(vegetarisch)") || name.includes(" vegetarisch")) return "vegetarian";
  
  return "all";
}

function classifyDish(dish) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  const rawType = (customFields["menu_type"] || "").trim();
  const typeLower = rawType.toLowerCase();
  const catNameDe = (dish.category && dish.category.name_de) ? dish.category.name_de.toLowerCase() : "";
  const name = (dish.name_de || "").toLowerCase();
  const dpName = (customFields["CUSTOM_DPNAME"] || "").toLowerCase();
  const location = (customFields["location"] || "").toLowerCase();
  const screenLocs = (dish.screens || []).map(s => (s.location || "").toLowerCase()).join(" ");
  const price = typeof dish.price === "number" ? dish.price : parseFloat(customFields["price_1"] || "0");

  // Buffet / Selbstbedienung (pay by weight / buffet counter)
  const isBuffet = !!customFields["preis_gramm"] ||
                   name.includes("salatbuffet") || dpName.includes("salatbuffet") ||
                   name.includes("selbstbedienung") || dpName.includes("selbstbedienung") ||
                   location.includes("bistro") || screenLocs.includes("warmausgabe");

  if (isBuffet) {
    return "buffet";
  }

  // Soups & Stews are main dishes / social meals (e.g. Eintöpfe, Cremesuppen)
  const isSoup = name.includes("suppe") || dpName.includes("suppe") ||
                 name.includes("eintopf") || dpName.includes("eintopf");

  // Desserts & Fruit & Sweet dishes (Milchreis, Grütze, Pudding, etc.)
  const dessertKeywords = ["dessert", "pudding", "quark", "joghurt", "grütze", "creme", "mousse", "apfel", "banane", "nektarine", "obst", "wassermelone", "kirschen", "kompott", "pfirsich", "milchreis"];
  if (!isSoup && (catNameDe.includes("dessert") || catNameDe.includes("nachspeise") || dessertKeywords.some(k => name.includes(k) || dpName.includes(k)))) {
    return "dessert";
  }

  // Explicit side dish categorization
  if (typeLower === "beilagen" || typeLower === "xbeilagen" || typeLower === "beilage" || catNameDe.includes("beilage") || catNameDe.includes("gemüse")) {
    if (price < 2.5) {
      return "side";
    }
  }

  // Side dish keywords (if price is low: <= 1.20€)
  const sideKeywords = ["pommes", "kartoffel", "reis", "spätzle", "schupfnudeln", "gemüse", "blumenkohl", "brokkoli", "broccoli", "erbsen", "möhren", "karotten", "bohnen", "röstitaler", "leipzigerallerlei", "balkangemüse", "kaisergemüse", "sommergemüse", "beilagensalat", "salat", "sauce"];
  const hasSideKeyword = sideKeywords.some(k => name.includes(k) || dpName.includes(k));

  if (hasSideKeyword && price <= 1.20) {
    return "side";
  }

  // Main dish lines
  const mainLines = ["heimspiel", "worldwide", "querbeet", "meisterwerk", "streetfood", "sozialgericht", "aktion", "fleisch", "fisch"];
  const isMainLine = mainLines.some(l => typeLower.includes(l));

  if (isMainLine && !hasSideKeyword) {
    return "main";
  }

  if (isSoup) {
    return "main";
  }

  if (price >= 1.4) {
    return "main";
  }

  return "side";
}

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
    } else if (firstWord === "SOZIALGERICHT") {
      brand = "SOZIALGERICHT";
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
    if (classification === "buffet") {
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
      brandColor = "bg-purple-50 text-purple-900 border-purple-200/90 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900";
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
  const dateObj = new Date(state.activeDate);
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  const formattedDate = dateObj.toLocaleDateString(state.language === "de" ? "de-DE" : "en-US", options);
  const prefix = state.language === "de" ? "Speiseplan für" : "Menu for";
  return `
    <div class="flex items-center gap-3 text-text-heading px-1 py-3 mb-2 mt-2 border-b border-slate-200/70 dark:border-white/5 animate-fade-in">
      <div class="w-9 h-9 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/5 shadow-sm flex items-center justify-center">
        ${getIconHTML('calendar_today', 'text-[20px] text-primary-container dark:text-[#a6cbed]')}
      </div>
      <div>
        <span class="text-[10px] font-bold text-slate-500 dark:text-gray-400/60 uppercase tracking-widest block leading-none mb-1">${prefix}</span>
        <h2 class="text-base md:text-lg font-headline font-extrabold text-text-heading dark:text-white leading-tight">${formattedDate}</h2>
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

function renderMainDishCard(dish, canteen, isViewingToday, currentHour, t, isBuffet = false) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  let studentPrice = dish.price 
    ? `${dish.price.toFixed(2).replace(".", ",")} €` 
    : (customFields["price_1"] ? `${parseFloat(customFields["price_1"]).toFixed(2).replace(".", ",")} €` : "—");

  if (isBuffet || customFields["preis_gramm"]) {
    const grammUnit = t.per100g || "je 100g";
    studentPrice = `${studentPrice} / ${grammUnit}`;
  }

  const { brandBadgeHTML, subTagHTML } = getBrandAndSubTag(dish);

  const dishCanteenScreens = (dish.screens || [])
    .filter(s => s && s.location && canteen.screen_locations.includes(s.location))
    .map(s => {
      return s.location.replace("MZS - ", "").replace("Mensa Deutz - ", "").replace("Mensa Südstadt - ", "").trim();
    });
  
  let servingTime = "";
  let dishCounter = "";
  const dishInfo = customFields["dish_info"] || "";
  if (dishInfo && !/^\s*\d?\s*$/.test(dishInfo)) {
    const timeMatch = dishInfo.match(/(\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2})/);
    if (timeMatch) {
      servingTime = timeMatch[1].replace(/\./g, ":");
    }
    let counterPart = dishInfo;
    if (timeMatch) {
      counterPart = dishInfo.substring(0, dishInfo.indexOf(timeMatch[0]));
    }
    counterPart = counterPart.replace(/\s*-\s*$/, "").replace(/Uhr.*$/i, "").trim();
    if (counterPart && !/^\d+$/.test(counterPart) && counterPart.length > 1) {
      dishCounter = counterPart;
    }
  }

  let locationBadge = "";
  if (dishCounter) {
    locationBadge = dishCounter;
  } else if (dishCanteenScreens.length > 0) {
    locationBadge = dishCanteenScreens[0];
  }

  const dietType = getDishDietType(dish);
  let dietBadge = "";
  if (dietType === "vegan") {
    dietBadge = `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-label-sm text-[11px] dark:bg-green-950/20 dark:text-green-400 dark:border-green-900 font-medium">
        ${getIconHTML('eco', 'text-[14px]')}
        ${t.vegan}
      </span>
    `;
  } else if (dietType === "vegetarian") {
    dietBadge = `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-label-sm text-[11px] dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900 font-medium">
        ${getIconHTML('nutrition', 'text-[14px]')}
        ${t.vegetarian}
      </span>
    `;
  }

  let undeclaredBadge = "";
  if (state.allergies && state.allergies.length > 0) {
    const dishAllergens = getDishAllergens(dish);
    if (dishAllergens.length === 0) {
      const label = state.language === "en" ? "No allergen info – please ask staff" : "Keine Allergen-Info – bitte Personal fragen";
      undeclaredBadge = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-label-sm text-[11px] dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 font-medium">
          ${getIconHTML('warning', 'text-[14px]')}
          ${label}
        </span>
      `;
    }
  }

  const allCodes = getDishAllergens(dish);
  let allergenIcons = "";
  if (allCodes.length > 0) {
    const label = state.language === "en" ? "Allergens:" : "Allergene:";
    allergenIcons = `
      <div onclick="showAllergens('${dish.id}')" class="flex flex-wrap items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-body-sm opacity-85 hover:opacity-100 hover:text-[#00273e] dark:hover:text-white cursor-pointer active:scale-95 transition-all select-none ml-auto pl-2">
        <span class="font-semibold text-slate-700 dark:text-slate-300">${label}</span>
        ${allCodes.slice(0, 3).map(c => `<span class="bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded text-[10px] border border-slate-300/60 dark:border-white/[0.1] font-medium">${escapeHtml(c)}</span>`).join("")}
        ${allCodes.length > 3 ? `<span class="text-xs font-bold text-primary dark:text-price-badge">+${allCodes.length - 3}</span>` : ""}
      </div>
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

  const stripAllergenCodes = (text) => text.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const dpNameSuffixes = /\s+(Abendessen|TK|Eigenproduktion|Eigenprodukt|Neu|trocken|Vegan|vegan)\s*$/gi;
  const cleanDPName = (raw) => {
    let cleaned = raw;
    let prev = "";
    while (cleaned !== prev) {
      prev = cleaned;
      cleaned = cleaned.replace(dpNameSuffixes, "").trim();
    }
    return cleaned;
  };

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
  const escapedStudentPrice = escapeHtml(studentPrice);

  const shareBtn = `
    <button 
      class="share-btn p-1.5 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors flex items-center justify-center active:scale-95"
      data-dish-name="${escapeHtml(mealName)}"
      data-dish-price="${studentPrice || ''}"
      data-canteen-name="${escapeHtml(canteen.name)}"
      aria-label="Teilen"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    </button>
  `;

  let rightColumnHTML = "";
  if (dish.image_url) {
    const escapedImageUrl = escapeHtml(dish.image_url);
    rightColumnHTML = `
      <div class="flex flex-col items-center gap-1.5 flex-shrink-0">
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-sm">
          <img src="${escapedImageUrl}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" alt="${escapedMealName}" onerror="this.closest('.dish-right-col').style.display='none'"/>
        </div>
        <div class="bg-price-badge shadow-sm rounded-full px-2.5 py-0.5 border border-amber-300/40 dark:border-white/20">
          <span class="font-label-md text-label-md text-primary font-extrabold tracking-wide">${escapedStudentPrice}</span>
        </div>
      </div>
    `;
  }

  const priceBadgeInline = !dish.image_url ? `
    <div class="bg-price-badge shadow-sm rounded-full px-2.5 py-0.5 border border-amber-300/40 dark:border-white/20 flex-shrink-0 ml-auto">
      <span class="font-label-md text-label-md text-primary font-extrabold tracking-wide">${escapedStudentPrice}</span>
    </div>
  ` : "";

  return `
    <article class="bg-slate-50/90 dark:bg-[#182c44] rounded-2xl p-inset-card flex flex-col gap-2 relative hover:bg-white dark:hover:bg-[#1f3754] transition-all duration-200 border border-slate-200/70 dark:border-white/[0.08] shadow-sm hover:shadow-md">
      <div class="flex justify-between items-start gap-3">
        <div class="flex-1 flex flex-col gap-2.5 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap w-full">
            ${brandBadgeHTML}
            ${subTagHTML}
            ${priceBadgeInline}
          </div>
          <div class="min-w-0">
            <h3 class="font-headline-sm text-headline-sm text-text-heading dark:text-white font-bold leading-snug mb-0.5 line-clamp-2">${escapedMealName}</h3>
            ${escapedComponentsText ? `<p class="font-body-sm text-[13px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2 mt-0.5 cursor-pointer" onclick="this.classList.toggle('line-clamp-2')">${escapedComponentsText}</p>` : ""}
            ${escapedMealDesc ? `<p class="font-body-md text-body-md text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 mt-1">${escapedMealDesc}</p>` : ""}
          </div>
          ${servingMetaHTML}
        </div>
        ${rightColumnHTML ? `<div class="dish-right-col">${rightColumnHTML}</div>` : ""}
      </div>
      <div class="flex items-center justify-between mt-1 pt-2 border-t border-slate-200/70 dark:border-white/5">
        <div class="flex gap-1.5 flex-wrap">
          ${dietBadge}
          ${undeclaredBadge}
        </div>
        <div class="flex items-center gap-1.5 ml-auto">
          ${shareBtn}
          ${allergenIcons}
        </div>
      </div>
    </article>
  `;
}

function renderCompactDishCard(dish, canteen, isViewingToday, currentHour, t, isBuffet = false) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  let rawPrice = dish.price 
    ? `${dish.price.toFixed(2).replace(".", ",")} €` 
    : (customFields["price_1"] ? `${parseFloat(customFields["price_1"]).toFixed(2).replace(".", ",")} €` : "—");

  if (isBuffet || customFields["preis_gramm"]) {
    const grammUnit = t.per100g || "je 100g";
    rawPrice = `${rawPrice} / ${grammUnit}`;
  }

  const dpNameSuffixes = /\s+(Abendessen|TK|Eigenproduktion|Eigenprodukt|Neu|trocken|Vegan|vegan)\s*$/gi;
  const cleanDPName = (raw) => {
    let cleaned = raw;
    let prev = "";
    while (cleaned !== prev) {
      prev = cleaned;
      cleaned = cleaned.replace(dpNameSuffixes, "").trim();
    }
    return cleaned;
  };

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

  const dietType = getDishDietType(dish);
  let dietBadge = "";
  if (dietType === "vegan") {
    dietBadge = `
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] dark:bg-green-950/20 dark:text-green-400 dark:border-green-900 font-medium">
        ${getIconHTML('eco', 'text-[12px]')}
        ${t.vegan}
      </span>
    `;
  } else if (dietType === "vegetarian") {
    dietBadge = `
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900 font-medium">
        ${getIconHTML('nutrition', 'text-[12px]')}
        ${t.vegetarian}
      </span>
    `;
  }

  let undeclaredBadge = "";
  if (state.allergies && state.allergies.length > 0) {
    const dishAllergens = getDishAllergens(dish);
    if (dishAllergens.length === 0) {
      const label = state.language === "en" ? "No allergen info" : "Keine Allergen-Info";
      undeclaredBadge = `
        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 font-medium">
          ${getIconHTML('warning', 'text-[12px]')}
          ${label}
        </span>
      `;
    }
  }

  const allCodes = getDishAllergens(dish);
  let allergenIcons = "";
  if (allCodes.length > 0) {
    allergenIcons = `
      <div onclick="showAllergens('${dish.id}')" class="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 opacity-85 hover:opacity-100 hover:text-[#00273e] dark:hover:text-white cursor-pointer active:scale-95 transition-all select-none ml-auto" title="Allergene anzeigen">
        <span class="font-medium">${state.language === "en" ? "Allergens:" : "Allergene:"}</span>
        ${allCodes.slice(0, 2).map(c => `<span class="bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 px-1 py-0.2 rounded text-[9px] border border-slate-300/60 dark:border-white/[0.1] font-medium">${escapeHtml(c)}</span>`).join("")}
        ${allCodes.length > 2 ? `<span class="font-bold text-primary dark:text-price-badge text-[10px]">+${allCodes.length - 2}</span>` : ""}
      </div>
    `;
  }

  const escapedMealName = escapeHtml(mealName);
  const escapedPrice = escapeHtml(rawPrice);

  return `
    <div class="bg-slate-50/90 dark:bg-[#182c44] rounded-2xl p-3 border border-slate-200/70 dark:border-white/[0.08] flex flex-col justify-between gap-2 hover:bg-white dark:hover:bg-[#1f3754] transition-all duration-200 shadow-sm hover:shadow-md">
      <div class="flex justify-between items-start gap-2">
        <h4 class="font-headline text-[13px] sm:text-[14px] text-text-heading dark:text-white font-bold leading-snug line-clamp-2">${escapedMealName}</h4>
        <div class="bg-price-badge shadow-sm rounded-full px-2 py-0.5 border border-amber-300/40 dark:border-white/20 flex-shrink-0">
          <span class="font-label-sm text-[11px] text-primary font-extrabold tracking-wide">${escapedPrice}</span>
        </div>
      </div>
      <div class="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-white/5 text-[11px]">
        <div class="flex gap-1 flex-wrap items-center">
          ${dietBadge}
          ${undeclaredBadge}
        </div>
        ${allergenIcons}
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
        ${getIconHTML('event_busy', 'text-[48px] text-slate-400 mb-2')}
        <p class="font-label-lg text-label-lg">${t.noMenuForDate}</p>
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
    if (state.diet !== "all") {
      dishes = dishes.filter(dish => {
        const dType = getDishDietType(dish);
        if (state.diet === "vegan") return dType === "vegan";
        if (state.diet === "vegetarian") return dType === "vegan" || dType === "vegetarian";
        return true;
      });
    }

    // Apply Allergy Filter
    if (state.allergies && state.allergies.length > 0) {
      dishes = dishes.filter(dish => !shouldExcludeDish(dish, state.allergies));
    }

    if (dishes.length === 0) return;

    // Determine opening hours and status
    const dayOfWeek = new Date(state.activeDate).getDay(); // 0 is Sunday, 6 is Saturday
    let openingHoursText = canteen.infokurz ? canteen.infokurz.replace(/\n/g, " · ") : "11:30 - 14:30 Uhr";
    let startHour = 11.0;
    let endHour = 14.5;

    if (canteen.opening_hours) {
      openingHoursText = canteen.opening_hours.weekdays || openingHoursText;
      if (dayOfWeek === 6) {
        openingHoursText = canteen.opening_hours.saturday || openingHoursText;
        startHour = 11.5;
        endHour = 14.0;
      } else if (dayOfWeek === 0) {
        openingHoursText = canteen.opening_hours.sunday || openingHoursText;
        startHour = 0;
        endHour = 0;
      }
    } else if (canteen.infokurz) {
      const lines = canteen.infokurz.split("\n");
      const dayNamesMap = { 1: ["Mo"], 2: ["Di"], 3: ["Mi"], 4: ["Do"], 5: ["Fr"], 6: ["Sa"], 0: ["So"] };
      const searchTerms = dayNamesMap[dayOfWeek] || [];
      for (const line of lines) {
        if (searchTerms.some(term => line.includes(term)) || (dayOfWeek >= 1 && dayOfWeek <= 5 && (line.includes("Mo - Fr") || line.includes("Mo - Do")))) {
          const match = line.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
          if (match) {
            startHour = parseInt(match[1]) + parseInt(match[2])/60;
            endHour = parseInt(match[3]) + parseInt(match[4])/60;
            openingHoursText = `${match[1]}:${match[2]} - ${match[3]}:${match[4]} ${state.language === "de" ? "Uhr" : ""}`.trim();
            break;
          }
        }
      }
    }

    // Check if there are explicit serving times in the dishes
    let minDishStart = 24;
    let maxDishEnd = 0;
    let hasServingTimes = false;

    dishes.forEach(d => {
      const customFields = {};
      (d.custom_fields || []).forEach(f => {
        if (f) customFields[f.field_id] = f.value;
      });
      const dishInfo = customFields["dish_info"] || "";
      if (dishInfo) {
        const timeMatch = dishInfo.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
        if (timeMatch) {
          hasServingTimes = true;
          const sH = parseInt(timeMatch[1]) + parseInt(timeMatch[2])/60;
          const eH = parseInt(timeMatch[3]) + parseInt(timeMatch[4])/60;
          if (sH < minDishStart) minDishStart = sH;
          if (eH > maxDishEnd) maxDishEnd = eH;
        }
      }
    });

    if (hasServingTimes) {
      startHour = minDishStart;
      endHour = maxDishEnd;
    }

    let isCanteenOpen = false;
    let opensLater = false;
    if (isViewingToday) {
      if (currentHour >= startHour && currentHour <= endHour) {
        isCanteenOpen = true;
      } else if (currentHour < startHour) {
        opensLater = true;
      }
    } else {
      isCanteenOpen = true;
    }

    let serviceWindowText = openingHoursText;
    if (hasServingTimes) {
      const format = (h) => `${Math.floor(h)}:${Math.round((h % 1) * 60).toString().padStart(2, '0')}`;
      serviceWindowText = `${format(startHour)} - ${format(endHour)} ${state.language === "de" ? "Uhr" : ""}`;
    }

    // Filter dishes by serving time if viewing today
    const availableDishes = dishes.filter(dish => {
      const customFields = {};
      (dish.custom_fields || []).forEach(f => {
        if (f) customFields[f.field_id] = f.value;
      });
      const dishInfo = customFields["dish_info"] || "";
      if (isViewingToday && dishInfo && !/^\s*\d?\s*$/.test(dishInfo)) {
        const timeMatch = dishInfo.match(/(\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2})/);
        if (timeMatch) {
          const servingTime = timeMatch[1].replace(/\./g, ":");
          const endStr = servingTime.split("-")[1].trim();
          const endHourMatch = endStr.match(/(\d{2})[.:](\d{2})/);
          if (endHourMatch) {
            const dishEndHour = parseInt(endHourMatch[1]) + parseInt(endHourMatch[2])/60;
            if (currentHour > dishEndHour) return false;
          }
        }
      }
      return true;
    });

    if (availableDishes.length === 0) return;

    // Group into Baukasten modules
    const mains = [];
    const buffets = [];
    const sides = [];
    const desserts = [];

    availableDishes.forEach(dish => {
      const cat = classifyDish(dish);
      if (cat === "main") mains.push(dish);
      else if (cat === "buffet") buffets.push(dish);
      else if (cat === "side") sides.push(dish);
      else if (cat === "dessert") desserts.push(dish);
    });

    renderedCanteensCount++;

    const statusBadgeClass = isCanteenOpen 
      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" 
      : (opensLater 
        ? "bg-sky-50 text-sky-800 border-sky-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" 
        : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800");
    const statusText = isCanteenOpen 
      ? t.open 
      : (opensLater ? t.opensLater : t.closed);

    let dishesHTML = "";

    // 1. Hauptgerichte
    if (mains.length > 0) {
      dishesHTML += `
        <div class="flex flex-col gap-2.5">
          ${renderSectionHeader(t.sectionMain || "Hauptgerichte", mains.length, "dinner_dining")}
          <div class="flex flex-col gap-gutter-card">
            ${mains.map(dish => renderMainDishCard(dish, canteen, isViewingToday, currentHour, t, false)).join("")}
          </div>
        </div>
      `;
    }

    // 2. Buffet & Selbstbedienung
    if (buffets.length > 0) {
      dishesHTML += `
        <div class="flex flex-col gap-2.5 mt-2">
          ${renderSectionHeader(t.sectionBuffet || "Buffet & Selbstbedienung", buffets.length, "scale")}
          <div class="flex flex-col gap-gutter-card">
            ${buffets.map(dish => renderMainDishCard(dish, canteen, isViewingToday, currentHour, t, true)).join("")}
          </div>
        </div>
      `;
    }

    // 3. Beilagen & Gemüse
    if (sides.length > 0) {
      dishesHTML += `
        <div class="flex flex-col gap-2.5 mt-2">
          ${renderSectionHeader(t.sectionSides || "Beilagen & Gemüse", sides.length, "grain")}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            ${sides.map(dish => renderCompactDishCard(dish, canteen, isViewingToday, currentHour, t, false)).join("")}
          </div>
        </div>
      `;
    }

    // 4. Dessert & Obst
    if (desserts.length > 0) {
      dishesHTML += `
        <div class="flex flex-col gap-2.5 mt-2">
          ${renderSectionHeader(t.sectionDessert || "Dessert & Obst", desserts.length, "icecream")}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            ${desserts.map(dish => renderCompactDishCard(dish, canteen, isViewingToday, currentHour, t, false)).join("")}
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
              <h2 class="font-headline text-[18px] text-text-heading dark:text-white font-bold leading-tight">${canteen.name}</h2>
              <p class="font-body-md text-body-md text-slate-600 dark:text-slate-300">${canteen.strasse}, ${canteen.plz} ${canteen.ort}</p>
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
          ${dishesHTML}
        </div>
      </div>
    `;

    // Distribute to columns
    if (numCols > 1) {
      let estHeight = 150 + mains.length * 140 + buffets.length * 140 + sides.length * 60 + desserts.length * 60;
      mains.forEach(d => {
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
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing && wasControlled) {
        refreshing = true;
        localStorage.setItem("kstw_updated_successfully", "true");
        // Force the browser to bypass memory and HTTP cache by reloading with a cache-busting query param
        const cleanUrl = window.location.origin + window.location.pathname + '?u=' + Date.now();
        window.location.replace(cleanUrl);
      }
    });
  }
}

function showUpdateDialog(worker) {
  if (document.getElementById('update-modal')) return;

  const t = TRANSLATIONS[state.language] || TRANSLATIONS.de;
  const modal = document.createElement('div');
  modal.id = 'update-modal';
  // Use z-[100] to sit above everything (safe area, header, etc.)
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-fade-in';
  
  modal.innerHTML = `
    <div class="w-full max-w-sm bg-white dark:bg-[#0b1926] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-zoom-in">
      <div class="flex items-center gap-3">
        <div class="h-12 w-12 rounded-xl bg-[#143d59]/10 dark:bg-price-badge/10 flex items-center justify-center text-[#143d59] dark:text-price-badge flex-shrink-0">
          ${getIconHTML('update', 'text-[28px]')}
        </div>
        <div>
          <h3 class="font-headline text-[18px] font-bold text-text-heading dark:text-white leading-snug">${t.updateAvailableTitle}</h3>
          <p class="text-[12px] text-on-surface-variant dark:text-slate-400">${t.updateAvailableDesc}</p>
        </div>
      </div>
      <p class="text-sm text-text-main dark:text-slate-200 leading-relaxed">
        ${t.updatePrompt}
      </p>
      <div class="flex gap-3 mt-2">
        <button id="update-later-btn" class="flex-1 h-11 border border-outline/20 dark:border-white/[0.08] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-transform font-label-md text-label-md rounded-xl text-on-surface-variant dark:text-slate-300 font-semibold">
          ${t.updateLater}
        </button>
        <button id="update-now-btn" class="flex-1 h-11 bg-price-badge text-primary hover:opacity-90 active:scale-95 transition-transform font-label-md text-label-md rounded-xl font-bold shadow-sm">
          ${t.updateRestart}
        </button>
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

  // Dismiss listeners
  document.getElementById('update-later-btn').addEventListener('click', () => {
    modal.classList.remove('animate-fade-in');
    modal.classList.add('animate-fade-out');
    const innerDiv = modal.querySelector('div');
    if (innerDiv) {
      innerDiv.classList.remove('animate-zoom-in');
      innerDiv.classList.add('animate-zoom-out');
    }
    setTimeout(() => modal.remove(), 200);
  });

  document.getElementById('update-now-btn').addEventListener('click', () => {
    worker.postMessage({ action: 'skipWaiting' });
  });
}

function checkUpdatedToast() {
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


function findDishById(dishId) {
  for (const day of state.menuData) {
    const dish = (day.dishes || []).find(d => d.id === dishId);
    if (dish) return dish;
  }
  return null;
}

window.showAllergens = function(dishId) {
  const dish = findDishById(dishId);
  if (!dish) return;

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
          allergenMap[code] = { de: nameDe, en: nameEn };
        }
      }
    });
  }

  const title = state.language === "en" ? "Allergens & Additives" : "Allergene & Zusatzstoffe";
  document.getElementById("allergens-modal-title").textContent = title;
  
  const listContainer = document.getElementById("allergens-modal-list");
  listContainer.innerHTML = "";
  
  codes.forEach(code => {
    const info = allergenMap[code] || STANDARD_ALLERGENS[code] || { de: code, en: code };
    const name = state.language === "en" ? info.en : info.de;
    
    listContainer.innerHTML += `
      <div class="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#182c44] border border-black/[0.04] dark:border-white/[0.08]">
        <span class="inline-flex items-center justify-center bg-primary-container dark:bg-price-badge text-white dark:text-primary text-[11px] font-bold px-2 py-0.5 rounded min-w-[28px] text-center">
          ${escapeHtml(code)}
        </span>
        <span class="text-sm text-text-heading dark:text-slate-100 font-medium">
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
};

window.closeAllergensModal = function() {
  const modal = document.getElementById("allergens-modal");
  const modalBox = modal.querySelector(".animate-zoom-in") || modal.firstElementChild;
  modalBox.classList.remove("animate-zoom-in");
  modalBox.classList.add("animate-zoom-out");
  document.body.classList.remove("overflow-hidden");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 180);
};
