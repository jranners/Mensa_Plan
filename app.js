/**
 * KStW Mensa PWA - Core Application Logic
 * Powered by CloudMensa API (Supabase)
 */

// 1. Canteen Registry & Metadata
const CANTEENS = {
  "unimensa": {
    "name": "Mensa Zülpicher Straße",
    "type": "mensa",
    "strasse": "Zülpicher Straße 70",
    "plz": "50937",
    "ort": "Köln",
    "latitude": 50.927269,
    "longitude": 6.933479,
    "phone": "+49 221 944 053 426",
    "infokurz": "Mo - Fr 11.30 - 21.00 Uhr\nSa 11.30 - 15.00 Uhr",
    "ort_id": "201",
    "screen_locations": [
      "MZS - EG Nord 1", "MZS - EG Nord 2", "MZS - EG Süd 1", "MZS - EG Süd 2",
      "MZS - Foyer EG 1", "MZS - Foyer EG 2", "MZS - MG Nord (Ausgabe 1)",
      "MZS - MG Nord (Ausgabe 2)", "MZS - MG Nord 1, Foyer", "MZS - MG Nord 2, Foyer",
      "MZS - MG Süd 1, Foyer", "MZS - MG Süd 2, Foyer", "MZS - Restaurant 3",
      "Mensa Zülpicher Straße"
    ]
  },
  "iwz-deutz": {
    "name": "Mensa Deutz",
    "type": "mensa",
    "strasse": "Betzdorfer Straße 2",
    "plz": "50679",
    "ort": "Köln",
    "latitude": 50.934014,
    "longitude": 6.988374,
    "phone": "+49 221 829 584 11",
    "infokurz": "Mo - Fr 11.30 - 14.30 Uhr",
    "ort_id": "281",
    "screen_locations": [
      "Mensa Deutz", "Mensa Deutz - Foyer", "Mensa Deutz - Foyer Info-Display",
      "Mensa Deutz - Theke 1", "Mensa Deutz - Theke 2", "Mensa Deutz - Theke 3", "Mensa Deutz - Theke 4"
    ]
  },
  "suedstadt": {
    "name": "Mensa Südstadt",
    "type": "mensa",
    "strasse": "Mainzer Straße 5",
    "plz": "50678",
    "ort": "Köln",
    "latitude": 50.925942,
    "longitude": 6.964058,
    "phone": "+49 221 9320 328",
    "infokurz": "Mo - Fr 11.30 - 14.30 Uhr",
    "ort_id": "241",
    "screen_locations": [
      "Mensa Südstadt", "Mensa Südstadt - Foyer EG",
      "Mensa Südstadt - Theke 1 (links)", "Mensa Südstadt - Theke 2 (Caféteria)"
    ]
  },
  "spoho": {
    "name": "Mensa am Sportpark Müngersdorf",
    "type": "mensa",
    "strasse": "Am Sportpark Müngersdorf 2",
    "plz": "50933",
    "ort": "Köln",
    "latitude": 50.935958,
    "longitude": 6.870339,
    "phone": "+49 221 9472 335",
    "infokurz": "Mo - Do 11.15 - 14.30 Uhr\nFr 11.15 - 14.15 Uhr",
    "ort_id": "271",
    "screen_locations": [
      "Mensa Am Sportpark Müngersdorf", "Mensa SpoHo - Abendmensa",
      "Mensa SpoHo - Ausgabe 1", "Mensa SpoHo - Ausgabe 2", "Mensa SpoHo - Ausgabe 3",
      "Mensa SpoHo - Ausgabe 4", "Mensa SpoHo - Ausgabe 5", "Mensa SpoHo - Ausgabe 6",
      "Mensa SpoHo - Speisekarte"
    ]
  },
  "eraum": {
    "name": "Bistro Uni E-Raum",
    "type": "bistro",
    "strasse": "Albertus-Magnus-Platz",
    "plz": "50931",
    "ort": "Köln",
    "latitude": 50.927952,
    "longitude": 6.927956,
    "phone": "+49 221 9415 573",
    "infokurz": "Mo - Do 07.30 - 18.00 Uhr\nFr 07.30 - 15.00 Uhr",
    "ort_id": null,
    "screen_locations": [
      "Bistro E-Raum", "Bistro Uni-E-Raum - Fenster"
    ]
  },
  "cafe-himmelsblick": {
    "name": "Café Himmelsblick (Claudiusstraße)",
    "type": "bistro",
    "strasse": "Claudiusstraße 1",
    "plz": "50678",
    "ort": "Köln",
    "latitude": 50.92297,
    "longitude": 6.967381,
    "phone": "+49 221 9469 384",
    "infokurz": "Mo - Do 11.30 - 18.00 Uhr\nFr 11.30 - 16.00 Uhr",
    "ort_id": "242",
    "screen_locations": [
      "Mensa Claudiusstrasse", "Mensa Claudiusstraße - Café Himmelsblick"
    ]
  },
  "gummersbach": {
    "name": "Mensa Gummersbach",
    "type": "mensa",
    "strasse": "Steinmüllerallee 1",
    "plz": "51643",
    "ort": "Gummersbach",
    "latitude": 51.028892,
    "longitude": 7.562499,
    "phone": "+49 2261 919 266",
    "infokurz": "Mo - Do 11.30 - 15.00 Uhr\nFr 11.30 - 14.00 Uhr",
    "ort_id": "291",
    "screen_locations": [
      "Mensa Gummersbach", "Mensa Gummersbach - Theke 1 (Mitte)",
      "Mensa Gummersbach - Theke 1 (links)", "Mensa Gummersbach - Theke 1 (rechts)"
    ]
  },
  "kunsthochschule-medien": {
    "name": "Mensa Kunsthochschule Medien",
    "type": "mensa",
    "strasse": "Filzengraben 2-4",
    "plz": "50676",
    "ort": "Köln",
    "latitude": 50.933591,
    "longitude": 6.959581,
    "phone": "+49 221 201 893 81",
    "infokurz": "Mo - Fr 10.00 - 17.00 Uhr",
    "ort_id": null,
    "screen_locations": [
      "Mensa Kunsthochschule"
    ]
  },
  "lindenthal": {
    "name": "Bistro Lindenthal",
    "type": "bistro",
    "strasse": "Gronewaldstraße 2",
    "plz": "50931",
    "ort": "Köln",
    "latitude": 50.9341609,
    "longitude": 6.9195527,
    "phone": "+49 221 9129 486",
    "infokurz": "Mo - Do 07.30 - 18.00 Uhr\nFr 07.30 - 16.00 Uhr",
    "ort_id": null,
    "screen_locations": [
      "Bistro Lindenthal", "Bistro Lindenthal - Warmausgabe"
    ]
  },
  "muho": {
    "name": "Mensa Musikhochschule",
    "type": "mensa",
    "strasse": "Dagobertstraße 38",
    "plz": "50668",
    "ort": "Köln",
    "latitude": 50.948299,
    "longitude": 6.960454,
    "phone": "+49 221 9129 486",
    "infokurz": "Mo - Fr 11.30 - 14.30 Uhr",
    "ort_id": "261",
    "screen_locations": [
      "Mensa MuHo - Theke 1 (links)", "Mensa MuHo - Theke 2 (rechts)", "Mensa Musikhochschule"
    ]
  },
  "robertkoch": {
    "name": "Mensa Lindenthal Robert-Koch-Straße",
    "type": "mensa",
    "strasse": "Robert-Koch-Straße 10",
    "plz": "50931",
    "ort": "Köln",
    "latitude": 50.929517,
    "longitude": 6.923275,
    "phone": "+49 221 941 57 09",
    "infokurz": "Mo - Fr 11.00 - 15.00 Uhr",
    "ort_id": "231",
    "screen_locations": [
      "Mensa Lindenthal", "Mensa Lindenthal - Ausgabe 1 (Suppe/Fleisch, links)",
      "Mensa Lindenthal - Ausgabe 3 (Beilagenbuffet, Mitte-links)",
      "Mensa Lindenthal - Ausgabe 4 (Vegan/Vegetarisch, Mitte-rechts)",
      "Mensa Lindenthal - Ausgabe 5 (Pastatheke, rechts)", "Mensa Lindenthal - Foyer"
    ]
  },
  "leverkusen": {
    "name": "Mensa TH Köln (Leverkusen)",
    "type": "mensa",
    "strasse": "Campusplatz 1",
    "plz": "51379",
    "ort": "Leverkusen",
    "latitude": 51.06218,
    "longitude": 7.01291,
    "phone": "+49 217 136 634 82",
    "infokurz": "Mo - Fr 11.30 - 14.00 Uhr",
    "ort_id": "235",
    "screen_locations": [
      "Mensa Leverkusen", "Mensa Leverkusen - Mensa"
    ]
  },
  "zollstock": {
    "name": "Mensa Zollstock",
    "type": "mensa",
    "strasse": "Sibille-Hartmann-Straße 2-8",
    "plz": "50969",
    "ort": "Köln",
    "latitude": 50.91435,
    "longitude": 6.94303,
    "phone": "+49 221 470 765 72",
    "infokurz": "Mo - Fr 11.30 - 14.30 Uhr",
    "ort_id": null,
    "screen_locations": [
      "Mensa Zollstock - Ausgabe 1 (links)", "Mensa Zollstock - Ausgabe 2 (rechts)"
    ]
  },
  "philcafe": {
    "name": "Bistro PhilCafé",
    "type": "bistro",
    "strasse": "Universitätsstraße 38",
    "plz": "50931",
    "ort": "Köln",
    "latitude": 50.92811,
    "longitude": 6.92776,
    "phone": "+49 221 9415 570",
    "infokurz": "Mo - Do 08.00 - 17.00 Uhr\nFr 08.00 - 15.00 Uhr",
    "ort_id": null,
    "screen_locations": [
      "Bistro PhilCafé", "Bistro PhilCafé - Warmausgabe"
    ]
  }
};

// 2. Translations (Bilingual DE/EN)
const TRANSLATIONS = {
  de: {
    title: "Mensaplan",
    welcome: "Willkommen bei der KStW Mensa",
    selectCanteens: "Mensa-Auswahl",
    selectDiet: "Deine Ernährung",
    showMenu: "Speiseplan anzeigen",
    saveSettings: "Einstellungen speichern",
    vegan: "Vegan",
    vegetarian: "Vegetarisch",
    all: "Alles",
    studentPrice: "Studi-Preis",
    open: "Geöffnet",
    closed: "Geschlossen",
    opensLater: "Noch geschlossen",
    noDishes: "Keine Gerichte für diesen Tag verfügbar.",
    mainCourse: "HAUPTGERICHT",
    sideDish: "BEILAGE",
    dessert: "NACHSPEISE",
    other: "SPEISE",
    settings: "Einstellungen",
    loading: "Lade Speiseplan...",
    errorLoading: "Fehler beim Laden des Speiseplans.",
    language: "Sprache",
    resetBtn: "Voreinstellungen zurücksetzen",
    installTitle: "Mensaplan als App installieren?",
    installDesc: "Möchtest du schneller auf deinen Mensaplan zugreifen und ihn auch offline nutzen? Füge ein Icon zu deinem Homescreen hinzu!",
    installBtn: "Jetzt installieren",
    privacyBadge: "100% DSGVO-konform",
    sizeBadge: "Sehr klein (< 50 KB)",
    permissionsBadge: "Keine Berechtigungen",
    offlineBadge: "Offline-fähig",
    iosInstall: 'Tippe unten in Safari auf das Teilen-Symbol <span class="inline-flex items-center"><span class="material-symbols-outlined text-[16px] align-middle px-0.5">ios_share</span></span> und wähle <span class="font-bold">"Zum Home-Bildschirm"</span>.',
    updateAvailableTitle: "Update verfügbar!",
    updateAvailableDesc: "Neue Version ist bereit.",
    updatePrompt: "Ein neues Update für den Mensaplan ist verfügbar. Möchtest du die App neu starten, um die neuesten Gerichte und Funktionen zu laden?",
    updateRestart: "Neu starten",
    updateLater: "Später",
    updateSuccessToast: "Mensaplan erfolgreich aktualisiert!",
    offlineBannerText: "Offline-Modus: Letztes Update {time}.",
    offlineBannerUpdateBtn: "Aktualisieren",
    offlineBannerUpdating: "Aktualisiere...",
    justNow: "gerade eben",
    minutesAgo: "vor {n} Min.",
    hoursAgo: "vor {n} Std."
  },
  en: {
    title: "Mensaplan",
    welcome: "Welcome to KStW Mensa",
    selectCanteens: "Canteen Selection",
    selectDiet: "Dietary Preference",
    showMenu: "Show Canteen Plan",
    saveSettings: "Save Settings",
    vegan: "Vegan",
    vegetarian: "Vegetarian",
    all: "All Foods",
    studentPrice: "Student Price",
    open: "Open",
    closed: "Closed",
    opensLater: "Still closed",
    noDishes: "No dishes available for this day.",
    mainCourse: "MAIN COURSE",
    sideDish: "SIDE DISH",
    dessert: "DESSERT",
    other: "DISH",
    settings: "Settings",
    loading: "Loading menu...",
    errorLoading: "Error loading canteen plan.",
    language: "Language",
    resetBtn: "Reset Preferences",
    installTitle: "Install Canteen Plan as App?",
    installDesc: "Do you want to access the canteen plan faster and use it offline? Add an icon to your home screen!",
    installBtn: "Install Now",
    privacyBadge: "100% GDPR-compliant",
    sizeBadge: "Very small (< 50 KB)",
    permissionsBadge: "No permissions needed",
    offlineBadge: "Offline capable",
    iosInstall: 'Tap the Share icon <span class="inline-flex items-center"><span class="material-symbols-outlined text-[16px] align-middle px-0.5">ios_share</span></span> in Safari below and select <span class="font-bold">"Add to Home Screen"</span>.',
    updateAvailableTitle: "Update available!",
    updateAvailableDesc: "New version is ready.",
    updatePrompt: "A new update for the canteen plan is available. Do you want to restart the app to load the latest dishes and features?",
    updateRestart: "Restart",
    updateLater: "Later",
    updateSuccessToast: "Canteen plan updated successfully!",
    offlineBannerText: "Offline Mode: Last update {time}.",
    offlineBannerUpdateBtn: "Update",
    offlineBannerUpdating: "Updating...",
    justNow: "just now",
    minutesAgo: "{n} min ago",
    hoursAgo: "{n} hr ago"
  }
};

// 3. Supabase Credentials (CloudMensa backend configuration)
const SUPABASE_CONFIG = {
  url: "https://axxiebkvmfjmiaanviob.supabase.co",
  apiKey: "sb_publishable_G6p4Gfhzcx2AM5ToCWAChA_pY-PKF2a",
  orgId: "4c89c35f-16ac-413f-af04-ec9ffe610f67"
};

// 4. Global State
let state = {
  language: "de",
  selectedCanteens: ["unimensa"],
  diet: "all", // "vegan", "vegetarian", "all"
  activeDate: "", // YYYY-MM-DD
  menuData: [], // parsed days list
  isLoaded: false,
  isSettingsMenu: false,
  isOfflineMode: false,
  isUpdatingBackground: false,
  isManualUpdating: false,
  lastCacheTime: null
};

// 5. Initialize App
window.addEventListener("DOMContentLoaded", async () => {
  if (window.location.search.includes("test=true")) {
    localStorage.setItem("kstw_prefs_saved", "true");
    localStorage.setItem("kstw_canteens", JSON.stringify(["unimensa", "iwz-deutz", "spoho"]));
    localStorage.setItem("kstw_diet", "all");
    localStorage.setItem("kstw_lang", "de");
  }
  loadPreferences();
  applyLanguage();
  initOnboardingUI();
  initInstallPrompt();

  // Register PWA Service Worker & check for updates
  registerSW();
  checkUpdatedToast();

  if (hasPreferences()) {
    hideOnboarding();
    await fetchAndRender();
  } else {
    showOnboarding();
  }

  // Setup Global Event Listeners
  document.getElementById("settings-btn").addEventListener("click", () => {
    showOnboarding(true);
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

// 6. Onboarding & Preferences Management
function hasPreferences() {
  return localStorage.getItem("kstw_prefs_saved") === "true";
}

function loadPreferences() {
  state.language = localStorage.getItem("kstw_lang") || "de";
  state.diet = localStorage.getItem("kstw_diet") || "all";
  
  const savedCanteens = localStorage.getItem("kstw_canteens");
  if (savedCanteens) {
    state.selectedCanteens = JSON.parse(savedCanteens);
  } else {
    state.selectedCanteens = ["unimensa"];
  }

  // Set Supabase URL/Key if previously recovered dynamically
  const recoveredUrl = localStorage.getItem("kstw_supabase_url");
  const recoveredKey = localStorage.getItem("kstw_supabase_key");
  if (recoveredUrl) SUPABASE_CONFIG.url = recoveredUrl;
  if (recoveredKey) SUPABASE_CONFIG.apiKey = recoveredKey;
}

function savePreferences(language, canteens, diet) {
  state.language = language;
  state.selectedCanteens = canteens;
  state.diet = diet;

  localStorage.setItem("kstw_lang", language);
  localStorage.setItem("kstw_canteens", JSON.stringify(canteens));
  localStorage.setItem("kstw_diet", diet);
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
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.saveSettings} <span class="material-symbols-outlined text-[20px]">check</span>`;
  } else {
    document.getElementById("onboarding-title").textContent = t.welcome;
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.showMenu} <span class="material-symbols-outlined text-[20px]">arrow_forward</span>`;
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
    <button id="lang-de" class="px-6 py-2 rounded-full border shadow-sm font-label-md text-label-md transition-all focus:outline-none ${state.language === "de" ? "bg-[#143d59] text-white border-[#143d59] font-bold" : "bg-slate-50 dark:bg-slate-800 text-on-surface-variant dark:text-gray-300 border-black/[0.08] dark:border-white/[0.08]"}" onclick="changeLanguage('de')">Deutsch</button>
    <button id="lang-en" class="px-6 py-2 rounded-full border shadow-sm font-label-md text-label-md transition-all focus:outline-none ${state.language === "en" ? "bg-[#143d59] text-white border-[#143d59] font-bold" : "bg-slate-50 dark:bg-slate-800 text-on-surface-variant dark:text-gray-300 border-black/[0.08] dark:border-white/[0.08]"}" onclick="changeLanguage('en')">English</button>
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
      <label class="flex items-center gap-3 cursor-pointer min-h-[40px] p-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition-colors group">
        <div class="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
          <input type="checkbox" value="${key}" ${isChecked} class="canteen-checkbox checkbox-custom opacity-0 absolute w-full h-full cursor-pointer z-10"/>
          <div class="w-4 h-4 rounded-sm border-2 border-outline-variant bg-surface-container-lowest flex items-center justify-center transition-colors">
            <svg class="hidden w-3 h-3 text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></path>
            </svg>
          </div>
        </div>
        <span class="font-body-md text-body-md text-text-main dark:text-gray-300 group-hover:text-text-heading dark:group-hover:text-white">${canteen.name}</span>
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
    <details class="group border-b border-black/5 dark:border-white/5 pb-2" open>
      <summary class="flex justify-between items-center font-headline text-[15px] font-bold text-text-heading dark:text-white cursor-pointer list-none py-1.5 select-none">
        <span class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">restaurant</span>
          ${canteenLabel}
        </span>
        <span class="material-symbols-outlined text-[20px] transition-transform duration-200 group-open:rotate-180">expand_more</span>
      </summary>
      <div class="flex flex-col gap-0.5 mt-1 pl-1">
        ${canteensHTML.join("")}
      </div>
    </details>

    <details class="group pt-2">
      <summary class="flex justify-between items-center font-headline text-[15px] font-bold text-text-heading dark:text-white cursor-pointer list-none py-1.5 select-none">
        <span class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">local_cafe</span>
          ${bistroLabel}
        </span>
        <span class="material-symbols-outlined text-[20px] transition-transform duration-200 group-open:rotate-180">expand_more</span>
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
      <button class="diet-option-btn flex-1 py-2 font-label-md text-label-md text-center rounded transition-colors focus:outline-none ${isActive ? "bg-price-badge text-primary font-bold shadow-sm" : "text-on-surface-variant dark:text-gray-300 opacity-70 hover:opacity-100"}" onclick="changeDietPreference('${opt.value}')">
        ${opt.label}
      </button>
    `;
  });

  // Setup Submit Button Handler
  document.getElementById("submit-onboarding-btn").onclick = async () => {
    const checkboxes = document.querySelectorAll(".canteen-checkbox:checked");
    const selected = Array.from(checkboxes).map(cb => cb.value);
    
    if (selected.length === 0) {
      alert(state.language === "de" ? "Bitte wähle mindestens eine Mensa aus!" : "Please select at least one canteen!");
      return;
    }

    savePreferences(state.language, selected, state.diet);
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

function showOnboarding(isSettingsMenu = false) {
  state.isSettingsMenu = isSettingsMenu;
  const onboarding = document.getElementById("onboarding");
  onboarding.classList.remove("hidden");
  initInstallPrompt();
  
  const closeBtn = document.getElementById("close-onboarding-btn");
  const t = TRANSLATIONS[state.language];
  
  if (isSettingsMenu) {
    if (closeBtn) closeBtn.classList.remove("hidden");
    document.getElementById("onboarding-title").textContent = t.settings;
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.saveSettings} <span class="material-symbols-outlined text-[20px]">check</span>`;
    
    const resetContainer = document.getElementById("reset-container") || document.createElement("div");
    resetContainer.id = "reset-container";
    resetContainer.className = "mt-4 flex justify-center";
    resetContainer.innerHTML = `
      <button class="px-4 py-2 text-red-600 hover:text-red-800 transition-colors font-label-md text-label-md" onclick="resetApp()">
        ${t.resetBtn}
      </button>
    `;
    document.getElementById("onboarding-content-area").appendChild(resetContainer);
  } else {
    if (closeBtn) closeBtn.classList.add("hidden");
    document.getElementById("onboarding-title").textContent = t.welcome;
    document.getElementById("submit-onboarding-btn").innerHTML = `${t.showMenu} <span class="material-symbols-outlined text-[20px]">arrow_forward</span>`;
    
    const resetContainer = document.getElementById("reset-container");
    if (resetContainer && resetContainer.parentNode) {
      resetContainer.parentNode.removeChild(resetContainer);
    }
  }
}

function hideOnboarding() {
  state.isSettingsMenu = false;
  document.getElementById("onboarding").classList.add("hidden");
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
    <span class="material-symbols-outlined text-primary-container text-[18px]">cell_tower</span>
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
      <div class="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm text-text-heading leading-relaxed flex items-start gap-2">
        <span class="material-symbols-outlined text-[20px] text-primary-fixed-dim mt-0.5">info</span>
        <div>
          ${t.iosInstall}
        </div>
      </div>
    `;
    installCard.classList.remove("hidden");
  } else {
    actionsContainer.innerHTML = `
      <button id="native-install-btn" class="w-full py-2 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary/95 transition-colors flex items-center justify-center gap-1.5 active:scale-98 transition-transform">
        <span class="material-symbols-outlined text-[18px]">download</span>
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
function hasAvailableDishesForDate(dateStr) {
  const dayData = state.menuData.find(d => d.date === dateStr);
  if (!dayData || !dayData.dishes || dayData.dishes.length === 0) return false;

  const todayIso = new Date().toISOString().split("T")[0];
  if (dateStr < todayIso) return false; // Past days are not available
  if (dateStr > todayIso) return true;  // Future days are assumed open

  // For today, check if there's at least one valid dish that has not expired yet
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

    dishes.forEach(dish => {
      const customFields = {};
      (dish.custom_fields || []).forEach(f => {
        if (f) customFields[f.field_id] = f.value;
      });

      let servingTime = "";
      const dishInfo = customFields["dish_info"] || "";
      if (dishInfo) {
        const timeMatch = dishInfo.match(/(\d{2}[.:]\d{2}\s*-\s*\d{2}[.:]\d{2})/);
        if (timeMatch) {
          servingTime = timeMatch[1].replace(".", ":");
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

async function fetchAndRender(forceNetwork = false) {
  const hasCache = loadMenuCache();
  
  if (hasCache && state.menuData && state.menuData.length > 0) {
    // We have cached data, let's determine the active date and render immediately!
    const daysWithDishes = state.menuData.filter(d => (d.dishes || []).length > 0);
    if (daysWithDishes.length > 0) {
      const todayIso = new Date().toISOString().split("T")[0];
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
      state.activeDate = new Date().toISOString().split("T")[0];
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
    // No cache, perform a blocking load
    renderLoading();
    
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    
    const start_date = monday;
    const end_date = new Date(monday.getTime() + 13 * 24 * 60 * 60 * 1000);

    try {
      let rawData;
      try {
        rawData = await fetchWeekMenuData(start_date, end_date);
      } catch (err) {
        console.log("Blocking fetch failed, attempting API key recovery...");
        const recovered = await recoverSupabaseCredentials();
        if (recovered) {
          rawData = await fetchWeekMenuData(start_date, end_date);
        } else {
          throw err;
        }
      }

      if (rawData) {
        state.menuData = rawData;
        saveMenuCache(rawData);
        state.isOfflineMode = false;
        
        const daysWithDishes = rawData.filter(d => (d.dishes || []).length > 0);
        if (daysWithDishes.length > 0) {
          const todayIso = new Date().toISOString().split("T")[0];
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
          state.activeDate = new Date().toISOString().split("T")[0];
        }
        
        renderApp(true);
      }
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
  const monday = new Date(today.setDate(diff));
  
  const start_date = monday;
  const end_date = new Date(monday.getTime() + 13 * 24 * 60 * 60 * 1000);

  try {
    let rawData;
    try {
      rawData = await fetchWeekMenuData(start_date, end_date);
    } catch (err) {
      console.log("Background fetch failed, attempting API key recovery...");
      const recovered = await recoverSupabaseCredentials();
      if (recovered) {
        rawData = await fetchWeekMenuData(start_date, end_date);
      } else {
        throw err;
      }
    }

    if (rawData) {
      state.menuData = rawData;
      saveMenuCache(rawData);
      state.isOfflineMode = false;
      
      const daysWithDishes = rawData.filter(d => (d.dishes || []).length > 0);
      if (daysWithDishes.length > 0) {
        const todayIso = new Date().toISOString().split("T")[0];
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
      
      renderApp(true);
    }
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
        <span class="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400">cloud_off</span>
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
  await updateMenuDataBackground(true);
};

async function fetchWeekMenuData(startDate, endDate) {
  const payload = {
    "p_organization_id": SUPABASE_CONFIG.orgId,
    "p_start_date": startDate.toISOString().split("T")[0],
    "p_end_date": endDate.toISOString().split("T")[0]
  };

  const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/public_get_week_menu`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_CONFIG.apiKey,
      "authorization": `Bearer ${SUPABASE_CONFIG.apiKey}`,
      "content-type": "application/json",
      "x-client-info": "supabase-js-web/2.88.0"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Supabase API responded with status ${response.status}`);
  }

  return await response.json();
}

async function recoverSupabaseCredentials() {
  const kstwCloudMensaUrl = "https://app.cloudmensa.io/menu/kstw";
  const corsProxy = "https://corsproxy.io/?url=";

  try {
    const htmlResponse = await fetch(`${corsProxy}${encodeURIComponent(kstwCloudMensaUrl)}`);
    if (!htmlResponse.ok) return false;
    const html = await htmlResponse.text();

    const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
    let match;
    const scriptUrls = [];
    while ((match = scriptRegex.exec(html)) !== null) {
      scriptUrls.push(match[1]);
    }

    const pattern = /"(https:\/\/[a-zA-Z0-9-]+\.supabase\.co)",\w+="([a-zA-Z0-9\._-]+)"/;
    
    for (const src of scriptUrls) {
      const fullUrl = src.startsWith("http") ? src : `https://app.cloudmensa.io${src}`;
      const jsResponse = await fetch(`${corsProxy}${encodeURIComponent(fullUrl)}`);
      if (!jsResponse.ok) continue;
      const js = await jsResponse.text();
      
      const credentialsMatch = js.match(pattern);
      if (credentialsMatch) {
        const newUrl = credentialsMatch[1];
        const newKey = credentialsMatch[2];
        
        SUPABASE_CONFIG.url = newUrl;
        SUPABASE_CONFIG.apiKey = newKey;
        
        localStorage.setItem("kstw_supabase_url", newUrl);
        localStorage.setItem("kstw_supabase_key", newKey);
        return true;
      }
    }
  } catch (e) {
    console.error("Error recovering API keys:", e);
  }
  return false;
}

// 9. UI Rendering & Interaction
function renderLoading() {
  const t = TRANSLATIONS[state.language];
  const dateContainer = document.getElementById("active-date-container");
  if (dateContainer) dateContainer.innerHTML = "";
  document.getElementById("main-feed").innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-text-main gap-4">
      <span class="material-symbols-outlined text-[48px] animate-spin text-primary-container">sync</span>
      <p class="font-label-lg text-label-lg">${t.loading}</p>
    </div>
  `;
}

function renderError() {
  const t = TRANSLATIONS[state.language];
  const dateContainer = document.getElementById("active-date-container");
  if (dateContainer) dateContainer.innerHTML = "";
  document.getElementById("main-feed").innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-red-600 gap-4">
      <span class="material-symbols-outlined text-[48px]">error</span>
      <p class="font-label-lg text-label-lg">${t.errorLoading}</p>
      <button class="mt-4 px-6 py-2 bg-primary-container text-white rounded-lg font-label-md" onclick="fetchAndRender()">${state.language === "de" ? "Erneut versuchen" : "Retry"}</button>
    </div>
  `;
}

function renderApp(initialLoad = false) {
  renderDateSelector(initialLoad);
  renderDietToggle();
  renderCanteenMenu();
  renderOfflineBanner();
}

function renderDateSelector(forceScroll = false) {
  const selectorContainer = document.getElementById("date-selector-container");
  selectorContainer.innerHTML = "";
  
  const daysWithDishes = state.menuData.filter(d => (d.dishes || []).length > 0);
  
  if (daysWithDishes.length === 0) {
    return;
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
      ? "bg-price-badge text-primary shadow-sm font-bold scale-105" 
      : "text-text-heading hover:bg-white/40";
      
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
      ? "bg-primary-container text-on-primary shadow-sm font-bold" 
      : "text-on-surface-variant hover:bg-white/40";
      
    container.innerHTML += `
      <button class="flex-1 py-2 rounded-lg font-label-md text-label-md text-center transition-colors focus:outline-none ${activeClass}" onclick="setDietFilter('${opt.value}')">
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

// 10. Core Data Parser & Matching
function getCanteenKeyFromDish(dish, canteenKey, canteen) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  const dishOrtId = customFields["ort_id"] || "";
  if (dishOrtId && canteen.ort_id) {
    if (dishOrtId === canteen.ort_id) return true;
  }
  
  const dishLocation = customFields["location"] || "";
  if (dishLocation && canteen.name) {
    if (dishLocation.toLowerCase().includes(canteen.name.toLowerCase()) || 
        canteen.name.toLowerCase().includes(dishLocation.toLowerCase())) {
      return true;
    }
  }

  const dishScreens = (dish.screens || []).map(s => s.location).filter(Boolean);
  const canteenScreens = canteen.screen_locations || [];
  
  const overlap = dishScreens.some(screen => canteenScreens.includes(screen));
  if (overlap) return true;

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

function getBrandAndSubTag(dish) {
  const customFields = {};
  (dish.custom_fields || []).forEach(f => {
    if (f) customFields[f.field_id] = f.value;
  });

  const rawType = customFields["menu_type"] || "";
  const category = dish.category || null;

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
    } else {
      const catNameDe = (category && category.name_de) ? category.name_de.toLowerCase() : "";
      if (catNameDe.includes("beilage") || catNameDe.includes("gemüse") || rawType.toLowerCase().includes("beilage")) {
        brand = "BEILAGE";
      } else if (catNameDe.includes("dessert") || catNameDe.includes("nachspeise") || catNameDe.includes("dessert")) {
        brand = "DESSERT";
      } else {
        brand = rawType.toUpperCase();
      }
    }
  } else {
    const catNameDe = (category && category.name_de) ? category.name_de.toLowerCase() : "";
    if (catNameDe.includes("beilage") || catNameDe.includes("gemüse")) {
      brand = "BEILAGE";
    } else if (catNameDe.includes("dessert") || catNameDe.includes("nachspeise")) {
      brand = "DESSERT";
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
      brandColor = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
      break;
    case "WORLDWIDE":
      brandName = "Worldwide";
      brandIcon = "public";
      brandColor = "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900";
      break;
    case "QUERBEET":
      brandName = "Querbeet";
      brandIcon = "yard";
      brandColor = "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
      break;
    case "MEISTERWERK":
      brandName = "Meisterwerk";
      brandIcon = "workspace_premium";
      brandColor = "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900";
      break;
    case "STREETFOOD":
      brandName = "Streetfood";
      brandIcon = "fastfood";
      brandColor = "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
      break;
    case "SOZIALGERICHT":
      brandName = state.language === "de" ? "Sozialgericht" : "Social Meal";
      brandIcon = "volunteer_activism";
      brandColor = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
      break;
    case "BEILAGE":
      brandName = state.language === "de" ? "Beilage" : "Side";
      brandIcon = "grain";
      brandColor = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
      break;
    case "DESSERT":
      brandName = "Dessert";
      brandIcon = "icecream";
      brandColor = "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-900";
      break;
    default:
      if (category && (category.name_de || category.name_en)) {
        brandName = state.language === "de" ? category.name_de : category.name_en;
      } else {
        brandName = state.language === "de" ? "Gericht" : "Dish";
      }
      brandIcon = "restaurant";
      brandColor = "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
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
      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/60 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
        ${displaySub}
      </span>
    `;
  }

  const brandBadgeHTML = `
    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${brandColor} shadow-sm">
      <span class="material-symbols-outlined text-[13px] font-normal">${brandIcon}</span>
      ${brandName}
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
    <div class="flex items-center gap-3 text-text-heading px-1 py-3 mb-2 mt-2 border-b border-black/5 dark:border-white/5 animate-fade-in">
      <div class="w-9 h-9 rounded-xl bg-white/50 dark:bg-slate-900/30 border border-white/60 dark:border-white/5 shadow-sm flex items-center justify-center">
        <span class="material-symbols-outlined text-[20px] text-primary-container dark:text-[#a6cbed]">calendar_today</span>
      </div>
      <div>
        <span class="text-[10px] font-bold text-on-surface-variant/60 dark:text-gray-400/60 uppercase tracking-widest block leading-none mb-1">${prefix}</span>
        <h2 class="text-base md:text-lg font-headline font-extrabold text-text-heading dark:text-white leading-tight">${formattedDate}</h2>
      </div>
    </div>
  `;
}

function renderCanteenMenu() {
  const feedContainer = document.getElementById("main-feed");
  feedContainer.innerHTML = "";
  
  const t = TRANSLATIONS[state.language];
  const dateHeader = getDateHeaderHTML();

  const dateContainer = document.getElementById("active-date-container");
  if (dateContainer) {
    dateContainer.innerHTML = dateHeader;
  }

  const activeDayData = state.menuData.find(d => d.date === state.activeDate);
  if (!activeDayData || !activeDayData.dishes || activeDayData.dishes.length === 0) {
    feedContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-text-heading gap-2 w-full">
        <span class="material-symbols-outlined text-[48px] opacity-40">calendar_today</span>
        <p class="font-body-lg text-body-lg opacity-60">${t.noDishes}</p>
      </div>
    `;
    return;
  }

  const visibleCanteens = state.selectedCanteens;
  let renderedCanteensCount = 0;

  // Determine number of columns based on width
  const width = window.innerWidth;
  let numCols = 1;
  if (width >= 1024) {
    numCols = 3;
  } else if (width >= 768) {
    numCols = 2;
  }

  // Initialize columns and heights
  const colHeights = Array(numCols).fill(0);
  if (numCols > 1) {
    feedContainer.className = "flex gap-6 w-full items-start";
    for (let i = 0; i < numCols; i++) {
      feedContainer.innerHTML += `<div id="canteen-col-${i}" class="flex-1 flex flex-col gap-6 min-w-0"></div>`;
    }
  } else {
    feedContainer.className = "flex flex-col gap-6 w-full";
  }

  visibleCanteens.forEach(canteenKey => {
    const canteen = CANTEENS[canteenKey];
    if (!canteen) return;

    let dishes = activeDayData.dishes.filter(dish => getCanteenKeyFromDish(dish, canteenKey, canteen));

    if (state.diet === "vegan") {
      dishes = dishes.filter(d => getDishDietType(d) === "vegan");
    } else if (state.diet === "vegetarian") {
      dishes = dishes.filter(d => getDishDietType(d) === "vegan" || getDishDietType(d) === "vegetarian");
    }

    if (dishes.length === 0) return;

    // Determine canteen serving window and opening status dynamically based on dish service times
    let maxEndHour = 0;
    let minStartHour = 24;
    let hasServingTimes = false;

    dishes.forEach(dish => {
      const customFields = {};
      (dish.custom_fields || []).forEach(f => {
        if (f) customFields[f.field_id] = f.value;
      });
      const dishInfo = customFields["dish_info"] || "";
      if (dishInfo) {
        const timeMatch = dishInfo.match(/(\d{2})[.:](\d{2})\s*-\s*(\d{2})[.:](\d{2})/);
        if (timeMatch) {
          const start = parseInt(timeMatch[1]) + parseInt(timeMatch[2])/60;
          const end = parseInt(timeMatch[3]) + parseInt(timeMatch[4])/60;
          if (start < minStartHour) minStartHour = start;
          if (end > maxEndHour) maxEndHour = end;
          hasServingTimes = true;
        }
      }
    });

    // Parse general canteen times
    let generalStartHour = 11.5; // default 11:30
    let generalEndHour = 14.5;   // default 14:30
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const currentDayOfWeek = now.getDay();
    const openingInfo = canteen.infokurz;
    let openingHoursText = state.language === "de" ? "Keine Servicezeit" : "No service hours";

    if (openingInfo) {
      const lines = openingInfo.split("\n");
      const dayNamesMap = {
        1: ["Mo", "Mon"],
        2: ["Di", "Tue"],
        3: ["Mi", "Wed"],
        4: ["Do", "Thu"],
        5: ["Fr", "Fri"],
        6: ["Sa", "Sat"],
        0: ["So", "Sun"]
      };

      const searchTerms = dayNamesMap[currentDayOfWeek] || [];
      for (const line of lines) {
        if (searchTerms.some(term => line.includes(term)) || (currentDayOfWeek >= 1 && currentDayOfWeek <= 5 && line.includes("Mo - Fr"))) {
          openingHoursText = line;
          const hourMatch = line.match(/(\d{2})[.:](\d{2})\s*-\s*(\d{2})[.:](\d{2})/);
          if (hourMatch) {
            generalStartHour = parseInt(hourMatch[1]) + parseInt(hourMatch[2])/60;
            generalEndHour = parseInt(hourMatch[3]) + parseInt(hourMatch[4])/60;
          }
        }
      }
    }

    // Determine effective serving window
    const startHour = hasServingTimes ? Math.min(minStartHour, generalStartHour) : generalStartHour;
    const endHour = hasServingTimes ? Math.max(maxEndHour, generalEndHour) : generalEndHour;

    // HIDE CLOSED CANTEENS ONLY IF THEY HAVE FINISHED FOR THE DAY (VIEWING TODAY)
    const todayIso = new Date().toISOString().split("T")[0];
    const isViewingToday = state.activeDate === todayIso;

    if (isViewingToday && currentHour > endHour) {
      return;
    }

    // Check if currently open for food service or opens later
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

    // Format display text for opening hours
    let serviceWindowText = openingHoursText;
    if (hasServingTimes) {
      const formatTime = (h) => {
        const mins = Math.round((h % 1) * 60);
        return `${Math.floor(h)}:${mins.toString().padStart(2, '0')}`;
      };
      const servingLabel = state.language === "de" ? "Essensausgabe" : "Food Service";
      serviceWindowText = `${servingLabel}: ${formatTime(startHour)} - ${formatTime(endHour)} Uhr`;
    }

    renderedCanteensCount++;

    const statusBadgeClass = isCanteenOpen 
      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" 
      : (opensLater 
        ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" 
        : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800");
    const statusText = isCanteenOpen 
      ? t.open 
      : (opensLater ? t.opensLater : t.closed);

    let canteenSection = `
      <div class="canteen-card w-full bg-white dark:bg-slate-900 rounded-3xl p-6 border border-black/[0.08] dark:border-white/[0.08] shadow-md flex flex-col gap-4 hover:shadow-lg transition-all duration-300">
        <!-- Canteen Header -->
        <header class="flex flex-col gap-2">
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0">
              <h2 class="font-headline text-[18px] text-text-heading dark:text-white font-bold leading-tight">${canteen.name}</h2>
              <p class="font-body-md text-body-md text-on-surface-variant dark:text-gray-300">${canteen.strasse}, ${canteen.plz} ${canteen.ort}</p>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass} flex-shrink-0">
              ${statusText}
            </span>
          </div>
          <div class="flex items-center gap-1 text-on-surface-variant dark:text-gray-300 font-body-sm text-[12px] opacity-85">
            <span class="material-symbols-outlined text-[16px]">schedule</span>
            <span>${serviceWindowText}</span>
          </div>
        </header>

        <!-- Dishes Container -->
        <div class="flex flex-col gap-gutter-card">
    `;

    dishes.forEach(dish => {
      const customFields = {};
      (dish.custom_fields || []).forEach(f => {
        if (f) customFields[f.field_id] = f.value;
      });

      const studentPrice = dish.price 
        ? `${dish.price.toFixed(2).replace(".", ",")} €` 
        : (customFields["price_1"] ? `${parseFloat(customFields["price_1"]).toFixed(2).replace(".", ",")} €` : "—");

      const { brandBadgeHTML, subTagHTML } = getBrandAndSubTag(dish);

      const dishCanteenScreens = (dish.screens || [])
        .filter(s => s && s.location && canteen.screen_locations.includes(s.location))
        .map(s => {
          return s.location.replace("MZS - ", "").replace("Mensa Deutz - ", "").replace("Mensa Südstadt - ", "").trim();
        });
      
      let servingTime = "";
      let dishCounter = "";
      const dishInfo = customFields["dish_info"] || "";
      if (dishInfo) {
        const timeMatch = dishInfo.match(/(\d{2}[.:]\d{2}\s*-\s*\d{2}[.:]\d{2})/);
        if (timeMatch) {
          servingTime = timeMatch[1].replace(".", ":");
        }
        dishCounter = dishInfo.split(/\d{2}[.:]/)[0].trim();
      }

      let locationBadge = "";
      if (dishCounter) {
        locationBadge = dishCounter;
      } else if (dishCanteenScreens.length > 0) {
        locationBadge = dishCanteenScreens[0];
      }

      if (isViewingToday && servingTime) {
        const endStr = servingTime.split("-")[1].trim();
        const endHourMatch = endStr.match(/(\d{2})[.:](\d{2})/);
        if (endHourMatch) {
          const dishEndHour = parseInt(endHourMatch[1]) + parseInt(endHourMatch[2])/60;
          if (currentHour > dishEndHour) {
            return;
          }
        }
      }

      const dietType = getDishDietType(dish);
      let dietBadge = "";
      if (dietType === "vegan") {
        dietBadge = `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 border border-green-200 text-[#2e7d32] font-label-sm text-[11px] dark:bg-green-950/20 dark:text-green-400 dark:border-green-900">
            <span class="material-symbols-outlined text-[14px]">eco</span>
            ${t.vegan}
          </span>
        `;
      } else if (dietType === "vegetarian") {
        dietBadge = `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-[#f57f17] font-label-sm text-[11px] dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900">
            <span class="material-symbols-outlined text-[14px]">nutrition</span>
            ${t.vegetarian}
          </span>
        `;
      }

      const allergensText = customFields["allergens_names"] || "";
      let allergenIcons = "";
      if (allergensText) {
        const codes = (customFields["allergens_numbers"] || "").split(",").map(c => c.trim()).filter(Boolean);
        if (codes.length > 0) {
          const label = state.language === "en" ? "Allergens:" : "Allergene:";
          allergenIcons = `
            <div onclick="showAllergens('${dish.id}')" class="flex flex-wrap gap-1 mt-1 text-[11px] text-on-surface-variant dark:text-gray-300 font-body-sm opacity-75 hover:opacity-100 hover:text-[#143d59] dark:hover:text-white cursor-pointer active:scale-95 transition-all select-none">
              <span class="font-semibold">${label}</span>
              ${codes.slice(0, 6).map(c => `<span class="bg-gray-200/60 dark:bg-slate-700/60 px-1 rounded text-[10px] border border-black/[0.08] dark:border-white/[0.08] dark:text-gray-300">${c}</span>`).join("")}
              ${codes.length > 6 ? `<span class="text-xs font-bold text-[#143d59] dark:text-white">+${codes.length - 6}</span>` : ""}
            </div>
          `;
        }
      }

      let servingMetaHTML = "";
      if (locationBadge || servingTime) {
        servingMetaHTML = `
          <div class="flex flex-wrap items-center gap-2 text-[12px] font-label-sm text-primary-container/80 mt-1">
            ${locationBadge ? `
              <span class="inline-flex items-center gap-1 bg-white/50 border border-white/60 shadow-sm px-2 py-0.5 rounded text-[11px] dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                <span class="material-symbols-outlined text-[14px]">location_on</span>
                ${locationBadge}
              </span>
            ` : ""}
            ${servingTime ? `
              <span class="inline-flex items-center gap-1 bg-white/50 border border-white/60 shadow-sm px-2 py-0.5 rounded text-[11px] dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                <span class="material-symbols-outlined text-[14px]">alarm</span>
                ${servingTime}
              </span>
            ` : ""}
          </div>
        `;
      }

      const mealName = state.language === "en" && dish.name_en ? dish.name_en : dish.name_de;
      const mealDesc = state.language === "en" && dish.description_en ? dish.description_en : dish.description_de;

      let thumbnailHTML = "";
      if (dish.image_url) {
        thumbnailHTML = `
          <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 border border-black/5 shadow-sm">
            <img src="${dish.image_url}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" alt="${mealName}" onerror="this.parentNode.style.display='none'"/>
          </div>
        `;
      }

      const priceBadgeHTML = `
        <div class="bg-price-badge/95 backdrop-blur-md shadow-sm rounded-full px-2.5 py-0.5 border border-white/20 flex-shrink-0 ml-auto">
          <span class="font-label-md text-label-md text-text-heading font-extrabold tracking-wide">${studentPrice}</span>
        </div>
      `;

      canteenSection += `
        <article class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-inset-card flex flex-col gap-2 relative hover:bg-slate-100/50 dark:hover:bg-slate-800/80 transition-colors duration-200 border border-black/[0.04] dark:border-white/[0.04] shadow-sm">
          <!-- Main layout: Content left, optional thumbnail right -->
          <div class="flex justify-between items-start gap-3">
            <div class="flex-1 flex flex-col gap-2.5 min-w-0">
              <!-- Header Row: Brand, Sub-Tag, Price -->
              <div class="flex items-center gap-1.5 flex-wrap w-full">
                ${brandBadgeHTML}
                ${subTagHTML}
                ${priceBadgeHTML}
              </div>

              <!-- Title & Description -->
              <div class="min-w-0">
                <h3 class="font-headline-sm text-headline-sm text-text-heading font-bold leading-snug mb-1 line-clamp-2">${mealName}</h3>
                ${mealDesc ? `<p class="font-body-md text-body-md text-on-surface-variant leading-relaxed line-clamp-2">${mealDesc}</p>` : ""}
              </div>

              <!-- Serving Meta -->
              ${servingMetaHTML}
            </div>

            <!-- Thumbnail image -->
            ${thumbnailHTML}
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between mt-1 pt-2 border-t border-black/5 dark:border-white/5">
            <div class="flex gap-1.5 flex-wrap">
              ${dietBadge}
            </div>
            ${allergenIcons}
          </div>
        </article>
      `;
    });

    canteenSection += `
        </div>
      </div>
    `;

    // Distribute to columns
    if (numCols > 1) {
      // Estimate height: 150px base + 120px per dish + 80px extra if it has images
      let estHeight = 150 + dishes.length * 120;
      dishes.forEach(d => {
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
      <div class="flex flex-col items-center justify-center py-20 text-text-heading gap-2 w-full">
        <span class="material-symbols-outlined text-[48px] opacity-40">notifications_off</span>
        <p class="font-body-lg text-body-lg opacity-60 text-center px-4 leading-relaxed">
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
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => {
          console.log('Service Worker registered successfully!', reg.scope);

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
    });

    // Handle controller change (reloading the page once skipWaiting has activated the new service worker)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        localStorage.setItem("kstw_updated_successfully", "true");
        window.location.reload();
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
    <div class="w-full max-w-sm glass rounded-2xl p-6 shadow-xl flex flex-col gap-4 animate-zoom-in">
      <div class="flex items-center gap-3">
        <div class="h-12 w-12 rounded-xl bg-[#143d59]/10 flex items-center justify-center text-[#143d59] dark:bg-white/10 dark:text-white flex-shrink-0">
          <span class="material-symbols-outlined text-[28px]">update</span>
        </div>
        <div>
          <h3 class="font-headline text-[18px] font-bold text-text-heading dark:text-white leading-snug">${t.updateAvailableTitle}</h3>
          <p class="text-[12px] text-on-surface-variant dark:text-gray-400">${t.updateAvailableDesc}</p>
        </div>
      </div>
      <p class="text-sm text-text-main dark:text-gray-200 leading-relaxed">
        ${t.updatePrompt}
      </p>
      <div class="flex gap-3 mt-2">
        <button id="update-later-btn" class="flex-1 h-11 border border-outline/20 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-transform font-label-md text-label-md rounded-xl text-on-surface-variant dark:text-gray-300 font-semibold">
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
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-32px)] max-w-sm bg-[#143d59] text-white rounded-xl px-4 py-3 shadow-lg flex items-center justify-between gap-3 animate-slide-in';
  
  toast.innerHTML = `
    <div class="flex items-center gap-2.5">
      <span class="material-symbols-outlined text-[20px] text-price-badge">check_circle</span>
      <span class="text-sm font-semibold tracking-wide">${t.updateSuccessToast}</span>
    </div>
    <button id="close-toast-btn" class="material-symbols-outlined text-[18px] text-white/60 hover:text-white transition-colors">close</button>
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
const STANDARD_ALLERGENS = {
  "1": { de: "Mit Farbstoff", en: "Contains colorants" },
  "2": { de: "Mit Konservierungsstoff", en: "Contains preservatives" },
  "3": { de: "Mit Antioxidationsmittel", en: "Contains antioxidants" },
  "4": { de: "Mit Geschmacksverstärker", en: "Contains flavor enhancers" },
  "5": { de: "Geschwefelt", en: "Sulfurated" },
  "6": { de: "Geschwärzt", en: "Blackened" },
  "7": { de: "Gewachst", en: "Waxed" },
  "8": { de: "Mit Phosphat", en: "Contains phosphate" },
  "9": { de: "Mit Süßungsmittel", en: "Contains sweeteners" },
  "10": { de: "Enthält eine Phenylalaninquelle", en: "Contains a source of phenylalanine" },
  "11": { de: "Enthält Gluten", en: "Contains gluten" },
  "11w": { de: "Enthält Weizen Gluten", en: "Contains wheat" },
  "11r": { de: "Enthält Roggen Gluten", en: "Contains rye" },
  "11b": { de: "Enthält Gerste Gluten", en: "Contains barley" },
  "11h": { de: "Enthält Hafer Gluten", en: "Contains oats" },
  "11d": { de: "Enthält Dinkel Gluten", en: "Contains spelt" },
  "12": { de: "Enthält Krebstiere", en: "Contains crustaceans" },
  "13": { de: "Enthält Eier", en: "Contains eggs" },
  "14": { de: "Enthält Fisch", en: "Contains fish" },
  "15": { de: "Enthält Erdnüsse", en: "Contains peanuts" },
  "16": { de: "Enthält Soja", en: "Contains soy" },
  "17": { de: "Enthält Milch", en: "Contains milk" },
  "18": { de: "Enthält Laktose", en: "Contains lactose" },
  "19": { de: "Enthält Schalenfrüchte", en: "Contains nuts" },
  "20": { de: "Enthält Sellerie", en: "Contains celery" },
  "21": { de: "Enthält Senf", en: "Contains mustard" },
  "22": { de: "Enthält Sesamsamen", en: "Contains sesame seeds" },
  "23": { de: "Enthält Schwefeldioxid/Sulfite", en: "Contains sulfur dioxide/sulfites" },
  "24": { de: "Enthält Lupinen", en: "Contains lupins" },
  "25": { de: "Enthält Weichtiere", en: "Contains molluscs" },
  "26": { de: "Mit Rindfleisch", en: "Contains beef" },
  "27": { de: "Mit Gelatine", en: "Contains gelatin" },
  "28": { de: "Mit Schweinefleisch", en: "Contains pork" },
  "29": { de: "Mit Geflügel", en: "Contains poultry" },
  "30": { de: "Mit Lammfleisch", en: "Contains lamb" },
  "31": { de: "Mit Knoblauch", en: "Contains garlic" },
  "32": { de: "Mit Alkohol", en: "Contains alcohol" }
};

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
  const allergensNumbersText = customFields["allergens_numbers"] || "";
  
  const codes = allergensNumbersText.split(",").map(c => c.trim()).filter(Boolean);
  if (codes.length === 0) return;

  const allergenMap = {};
  if (allergensNamesText) {
    const parts = allergensNamesText.split(",").map(p => p.trim()).filter(Boolean);
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
        allergenMap[code] = { de: nameDe, en: nameEn };
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
      <div class="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-black/[0.04] dark:border-white/[0.04]">
        <span class="inline-flex items-center justify-center bg-primary-container text-white text-[11px] font-bold px-2 py-0.5 rounded min-w-[28px] text-center dark:bg-slate-700">
          ${code}
        </span>
        <span class="text-sm text-text-heading dark:text-gray-200 font-medium">
          ${name}
        </span>
      </div>
    `;
  });

  const modal = document.getElementById("allergens-modal");
  modal.classList.remove("hidden");
  
  const modalBox = modal.querySelector(".animate-zoom-in") || modal.firstElementChild;
  modalBox.classList.remove("animate-zoom-out");
  modalBox.classList.add("animate-zoom-in");
};

window.closeAllergensModal = function() {
  const modal = document.getElementById("allergens-modal");
  const modalBox = modal.querySelector(".animate-zoom-in") || modal.firstElementChild;
  modalBox.classList.remove("animate-zoom-in");
  modalBox.classList.add("animate-zoom-out");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 180);
};
