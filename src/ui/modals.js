import { STANDARD_ALLERGENS } from '../../data/allergens.js';
import { getCustomFields, cleanDishNameForFavorite } from '../lib/dish.js';
import { getDishAllergens, parseAllergensNamesMap } from '../lib/allergens.js';
import { trapFocus } from '../lib/a11y.js';
import { escapeHtml } from '../lib/html.js';

/**
 * Synchronizes the `inert` and `aria-hidden` attributes on `#app-container`
 * and body scroll lock whenever any modal overlay opens or closes.
 */
export function syncAppInertState() {
  if (typeof document === 'undefined') return;
  const appContainer = document.getElementById('app-container');
  const trayContainer = document.getElementById('tray-bar-container');

  const modalIds = [
    'onboarding',
    'allergens-modal',
    'app-menu-modal',
    'stats-modal',
    'update-modal',
    'allergen-prompt-overlay'
  ];

  const anyModalOpen = modalIds.some((id) => {
    const el = document.getElementById(id);
    return Boolean(el && !el.classList.contains('hidden'));
  });

  if (appContainer) {
    appContainer.inert = anyModalOpen;
    if (anyModalOpen) {
      appContainer.setAttribute('aria-hidden', 'true');
    } else {
      appContainer.removeAttribute('aria-hidden');
    }
  }

  if (trayContainer) {
    trayContainer.inert = anyModalOpen;
  }

  document.body.style.overflow = anyModalOpen ? 'hidden' : '';
}

/**
 * Opens the Hamburger Menu modal (`#app-menu-modal`).
 *
 * @param {object} modalState
 */
export function showAppMenu(modalState) {
  const modal = document.getElementById('app-menu-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  syncAppInertState();
  if (modalState.cleanupAppMenuTrap) modalState.cleanupAppMenuTrap();
  modalState.cleanupAppMenuTrap = trapFocus(modal);
}

/**
 * Closes the Hamburger Menu modal (`#app-menu-modal`).
 *
 * @param {object} modalState
 * @param {boolean} [restoreTriggerFocus=true]
 */
export function hideAppMenu(modalState, restoreTriggerFocus = true) {
  const modal = document.getElementById('app-menu-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  if (modalState.cleanupAppMenuTrap) {
    modalState.cleanupAppMenuTrap();
    modalState.cleanupAppMenuTrap = null;
  }
  syncAppInertState();
  if (restoreTriggerFocus) {
    document.getElementById('menu-btn')?.focus();
  }
}

/**
 * Opens the Allergens detail modal for a given dish key (`id::cleanName`) or dish ID.
 *
 * @param {string} dishKeyOrId
 * @param {object} state
 * @param {object} modalState
 */
export function showAllergens(dishKeyOrId, state, modalState) {
  const modal = document.getElementById('allergens-modal');
  const listEl = document.getElementById('allergens-modal-list');
  const titleEl = document.getElementById('allergens-modal-title');
  const disclaimerEl = document.getElementById('allergens-modal-disclaimer');
  if (!modal || !listEl || !state.menuData) return;

  let targetDish = null;
  const activeDay = state.menuData.find((d) => d.date === state.activeDate);
  const daysToSearch = activeDay ? [activeDay, ...state.menuData] : state.menuData;

  for (const day of daysToSearch) {
    if (!day.dishes) continue;
    const found = day.dishes.find((d) => {
      const compositeKey = `${d.id}::${cleanDishNameForFavorite(d)}`;
      return compositeKey === String(dishKeyOrId) || String(d.id) === String(dishKeyOrId);
    });
    if (found) {
      targetDish = found;
      break;
    }
  }

  if (!targetDish) return;

  const t = state.translations[state.lang];
  if (titleEl) titleEl.textContent = t.allergensModalTitle;
  if (disclaimerEl) disclaimerEl.textContent = t.onboardingAllergenWarning;

  const codes = getDishAllergens(targetDish);
  const customFields = getCustomFields(targetDish);
  const customNamesMap = parseAllergensNamesMap(customFields['allergens_names'] || '', state.lang);

  listEl.innerHTML = codes
    .map((code) => {
      const lowerCode = code.toLowerCase();
      const dictEntry = STANDARD_ALLERGENS[lowerCode];
      let desc = '';
      if (dictEntry) {
        desc = dictEntry[state.lang] || dictEntry.de;
      } else if (customNamesMap[lowerCode]) {
        desc = customNamesMap[lowerCode];
      } else {
        desc = state.lang === 'de' ? `Allergen / Zusatzstoff (${code})` : `Allergen / Additive (${code})`;
      }

      return `
        <div class="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#122338] border border-black/[0.04] dark:border-white/[0.06]">
          <span class="px-2 py-1 rounded-md bg-primary/10 dark:bg-price-badge/15 text-primary dark:text-price-badge font-bold text-xs min-w-[32px] text-center flex-shrink-0">
            ${escapeHtml(code)}
          </span>
          <span class="font-body-md text-xs text-text-heading dark:text-slate-200 leading-snug">
            ${escapeHtml(desc)}
          </span>
        </div>
      `;
    })
    .join('');

  modal.classList.remove('hidden');
  syncAppInertState();
  if (modalState.cleanupAllergensTrap) modalState.cleanupAllergensTrap();
  modalState.cleanupAllergensTrap = trapFocus(modal);
}

/**
 * Closes the Allergens detail modal (`#allergens-modal`).
 *
 * @param {object} modalState
 */
export function closeAllergensModal(modalState) {
  const modal = document.getElementById('allergens-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  if (modalState.cleanupAllergensTrap) {
    modalState.cleanupAllergensTrap();
    modalState.cleanupAllergensTrap = null;
  }
  syncAppInertState();
  if (modalState.lastAllergensTriggerEl && typeof modalState.lastAllergensTriggerEl.focus === 'function') {
    modalState.lastAllergensTriggerEl.focus();
    modalState.lastAllergensTriggerEl = null;
  }
}
