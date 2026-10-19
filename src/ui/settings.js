import { CANTEENS } from '../../data/canteens.js';
import { ALLERGEN_GROUPS } from '../lib/allergens.js';
import { normalizeCanteenOrder } from '../lib/canteen-match.js';
import { createSettingsDraft, setTariff } from '../lib/storage.js';
import { trapFocus } from '../lib/a11y.js';
import { escapeHtml } from '../lib/html.js';
import { getIconHTML } from './icons.js';
import { showToast } from './toast.js';
import { syncAppInertState } from './modals.js';

let deferredInstallPrompt = null;

/**
 * Renders the language, canteen, diet, tariff, pork-exclusion, allergen, and reset controls
 * inside `#onboarding`. Preserves focus when draft controls are toggled.
 *
 * @param {object} state
 * @param {() => void} onApplyLanguage
 */
export function initOnboardingUI(state, onApplyLanguage) {
  const onboardingEl = document.getElementById('onboarding');
  let focusedSelector = null;
  const activeEl = document.activeElement;
  if (activeEl && onboardingEl && onboardingEl.contains(activeEl)) {
    const action = activeEl.getAttribute('data-action');
    if (action === 'select-lang') {
      focusedSelector = `[data-action="select-lang"][data-lang="${activeEl.getAttribute('data-lang')}"]`;
    } else if (action === 'onboarding-diet') {
      focusedSelector = `[data-action="onboarding-diet"][data-diet="${activeEl.getAttribute('data-diet')}"]`;
    } else if (action === 'onboarding-tariff') {
      focusedSelector = `[data-action="onboarding-tariff"][data-tariff="${activeEl.getAttribute('data-tariff')}"]`;
    } else if (action === 'onboarding-exclude-pork') {
      focusedSelector = `[data-action="onboarding-exclude-pork"]`;
    } else if (action === 'move-canteen-order') {
      focusedSelector = `[data-action="move-canteen-order"][data-canteen-key="${activeEl.getAttribute('data-canteen-key')}"][data-dir="${activeEl.getAttribute('data-dir')}"]`;
    } else if (activeEl.classList && activeEl.classList.contains('canteen-cb')) {
      focusedSelector = `.canteen-cb[value="${activeEl.value}"]`;
    }
  }

  const draft = state.settingsDraft || state;
  draft.selectedCanteens = normalizeCanteenOrder(draft.selectedCanteens || [], CANTEENS);
  const activeLang = draft.lang || draft.language || state.lang || 'de';
  const t = state.translations[activeLang] || state.translations.de;

  // 0. Language Selector
  const langContainer = document.getElementById('lang-selector');
  if (langContainer) {
    const langs = [
      { key: 'de', label: 'Deutsch', flag: '🇩🇪' },
      { key: 'en', label: 'English', flag: '🇬🇧' }
    ];
    langContainer.innerHTML = langs
      .map((l) => {
        const isSel = activeLang === l.key;
        const base =
          'px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 border transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge';
        const active = isSel
          ? 'bg-primary text-on-primary border-primary dark:bg-price-badge dark:text-primary dark:border-price-badge shadow-sm scale-105'
          : 'bg-slate-50 text-on-surface-variant border-black/[0.08] dark:bg-[#122338] dark:text-slate-300 dark:border-white/[0.08] hover:bg-black/5';
        return `
          <button type="button" data-action="select-lang" data-lang="${escapeHtml(l.key)}" aria-pressed="${isSel ? 'true' : 'false'}" class="${base} ${active}">
            <span class="text-base">${l.flag}</span>
            <span>${escapeHtml(l.label)}</span>
          </button>
        `;
      })
      .join('');
  }

  // 1. Canteens Checklist
  const listContainer = document.getElementById('canteen-checkbox-list');
  if (listContainer) {
    const mensen = Object.entries(CANTEENS).filter(([, c]) => c.type === 'mensa');
    const bistros = Object.entries(CANTEENS).filter(([, c]) => c.type === 'bistro');

    const selectedMensen = (draft.selectedCanteens || []).filter((k) => CANTEENS[k]?.type === 'mensa');
    const selectedBistros = (draft.selectedCanteens || []).filter((k) => CANTEENS[k]?.type === 'bistro');

    const renderOrderBox = (title, items) => {
      if (!items || items.length === 0) return '';
      const orderItemsHTML = items
        .map((key, idx) => {
          const c = CANTEENS[key] || { name: key };
          const isFirst = idx === 0;
          const isLast = idx === items.length - 1;

          return `
            <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50/70 dark:bg-[#122338]/60 border border-black/[0.03] dark:border-white/[0.03]">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span class="w-6 h-6 rounded-lg bg-primary text-on-primary dark:bg-price-badge dark:text-primary font-extrabold text-xs flex items-center justify-center flex-shrink-0">#${idx + 1}</span>
                <span class="font-bold text-xs text-text-heading dark:text-white truncate">${escapeHtml(c.name)}</span>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  data-action="move-canteen-order"
                  data-canteen-key="${escapeHtml(key)}"
                  data-dir="up"
                  aria-label="${escapeHtml(t.moveUpAria)}: ${escapeHtml(c.name)}"
                  ${isFirst ? 'disabled' : ''}
                  class="w-7 h-7 rounded-lg flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#182c44] text-text-heading dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
                >
                  <span class="text-xs flex items-center">${getIconHTML('arrow_upward')}</span>
                </button>
                <button
                  type="button"
                  data-action="move-canteen-order"
                  data-canteen-key="${escapeHtml(key)}"
                  data-dir="down"
                  aria-label="${escapeHtml(t.moveDownAria)}: ${escapeHtml(c.name)}"
                  ${isLast ? 'disabled' : ''}
                  class="w-7 h-7 rounded-lg flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#182c44] text-text-heading dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge"
                >
                  <span class="text-xs flex items-center">${getIconHTML('arrow_downward')}</span>
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <div class="mb-2.5 p-3 bg-white dark:bg-[#182c44] rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-xs">
          <div class="font-headline font-bold text-xs text-text-heading dark:text-white leading-tight mb-2.5">
            ${escapeHtml(title)}
          </div>
          <div class="flex flex-col gap-1.5">
            ${orderItemsHTML}
          </div>
        </div>
      `;
    };

    const renderCheckboxes = (items, selectedGroupKeys) => {
      return items
        .map(([key, c]) => {
          const selectedIndex = selectedGroupKeys.indexOf(key);
          const isChecked = selectedIndex !== -1 ? 'checked' : '';
          const rankPill = isChecked
            ? `<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-primary text-on-primary dark:bg-price-badge dark:text-primary flex-shrink-0">#${selectedIndex + 1}</span>`
            : '';
          return `
            <label class="flex items-center justify-between p-2.5 bg-white dark:bg-[#182c44] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1f3856] transition-colors border border-black/[0.03] dark:border-white/[0.04]">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-primary-container dark:text-price-badge text-lg flex items-center flex-shrink-0">${getIconHTML('restaurant')}</span>
                <span class="font-headline-sm text-headline-sm text-text-heading dark:text-white text-sm truncate">${escapeHtml(c.name)}</span>
                ${rankPill}
              </div>
              <input type="checkbox" value="${escapeHtml(key)}" ${isChecked} class="canteen-cb custom-checkbox flex-shrink-0"/>
            </label>
          `;
        })
        .join('');
    };

    const mensaBlockHTML = `
      <div class="text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-400 mt-2 mb-1 px-1">${escapeHtml(t.canteenGroupMensen)}</div>
      ${renderOrderBox(t.canteenOrderMensenTitle, selectedMensen)}
      ${renderCheckboxes(mensen, selectedMensen)}
    `;

    const bistroBlockHTML = `
      <div class="text-xs font-bold uppercase tracking-wider text-on-surface-variant dark:text-slate-400 mt-4 mb-1 px-1">${escapeHtml(t.canteenGroupBistros)}</div>
      ${renderOrderBox(t.canteenOrderBistrosTitle, selectedBistros)}
      ${renderCheckboxes(bistros, selectedBistros)}
    `;

    listContainer.innerHTML = mensaBlockHTML + bistroBlockHTML;
  }

  // 2. Diet Selector + Pork Exclusion Toggle
  const dietContainer = document.getElementById('diet-selector');
  if (dietContainer) {
    const options = [
      { key: 'all', label: t.all, icon: '' },
      { key: 'vegetarian', label: t.vegetarian, icon: '🧀' },
      { key: 'vegan', label: t.vegan, icon: '🌱' }
    ];

    dietContainer.innerHTML = options
      .map((opt) => {
        const isSelected = draft.diet === opt.key;
        const base =
          'flex-1 py-2.5 px-2 rounded-lg font-label-md text-label-md transition-all text-center flex items-center justify-center gap-1 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge';
        const active = isSelected
          ? 'bg-primary text-on-primary shadow-sm dark:bg-price-badge dark:text-primary font-bold'
          : 'text-on-surface-variant dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 font-medium';

        return `
          <button type="button" data-action="onboarding-diet" data-diet="${escapeHtml(opt.key)}" aria-pressed="${isSelected ? 'true' : 'false'}" class="${base} ${active}">
            ${opt.icon ? `<span>${opt.icon}</span>` : ''}
            <span>${escapeHtml(opt.label)}</span>
          </button>
        `;
      })
      .join('');

    // Ensure or update the No-Pork toggle row right below #diet-selector
    let porkContainer = document.getElementById('pork-exclude-container');
    if (!porkContainer && dietContainer.parentElement) {
      porkContainer = document.createElement('div');
      porkContainer.id = 'pork-exclude-container';
      porkContainer.className = 'mt-1.5';
      dietContainer.parentElement.appendChild(porkContainer);
    }
    if (porkContainer) {
      const isPorkExcluded = Boolean(draft.excludePork);
      porkContainer.innerHTML = `
        <button
          type="button"
          data-action="onboarding-exclude-pork"
          aria-pressed="${isPorkExcluded ? 'true' : 'false'}"
          class="w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge ${
            isPorkExcluded
              ? 'bg-primary/10 dark:bg-price-badge/15 border-primary/30 dark:border-price-badge/40'
              : 'bg-slate-50 dark:bg-[#122338] border-black/[0.04] dark:border-white/[0.08]'
          }"
        >
          <div class="flex items-center gap-2.5 text-left min-w-0">
            <span class="text-base" aria-hidden="true">🚫🐖</span>
            <div class="min-w-0">
              <div class="font-headline font-bold text-xs text-text-heading dark:text-white">${escapeHtml(t.excludePorkLabel)}</div>
              <div class="text-[11px] text-on-surface-variant dark:text-slate-400 truncate">${escapeHtml(t.excludePorkDesc)}</div>
            </div>
          </div>
          <span class="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
            isPorkExcluded
              ? 'bg-primary dark:bg-price-badge border-primary dark:border-price-badge text-white dark:text-primary'
              : 'border-slate-300 dark:border-slate-600'
          }">
            ${isPorkExcluded ? '✓' : ''}
          </span>
        </button>
      `;
    }
  }

  // 2b. Tariff Selector
  const tariffContainer = document.getElementById('tariff-selector');
  if (tariffContainer) {
    const activeTariff = draft.tariff || state.tariff || 'student';
    const tariffOptions = [
      { key: 'student', label: t.tariffStudent },
      { key: 'employee', label: t.tariffEmployee },
      { key: 'guest', label: t.tariffGuest },
      { key: 'external', label: t.tariffExternal }
    ];

    tariffContainer.innerHTML = tariffOptions
      .map((opt) => {
        const isSelected = activeTariff === opt.key;
        const base =
          'py-2 px-2 rounded-lg font-label-md text-xs transition-all text-center flex items-center justify-center select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge';
        const active = isSelected
          ? 'bg-primary text-on-primary shadow-sm dark:bg-price-badge dark:text-primary font-bold'
          : 'text-on-surface-variant dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 font-medium';

        return `
          <button type="button" data-action="onboarding-tariff" data-tariff="${escapeHtml(opt.key)}" aria-pressed="${isSelected ? 'true' : 'false'}" class="${base} ${active}">
            <span class="truncate">${escapeHtml(opt.label)}</span>
          </button>
        `;
      })
      .join('');
  }

  // 3. Allergens Checklist
  const allergenList = document.getElementById('allergen-checkbox-list');
  if (allergenList) {
    const iconSpan = document.getElementById('onboarding-allergen-icon');
    const arrowSpan = document.getElementById('onboarding-allergen-arrow');
    const warnIconSpan = document.getElementById('allergen-warning-icon');
    if (iconSpan) {
      iconSpan.innerHTML = getIconHTML('medical_information', 'text-primary-container dark:text-price-badge text-lg');
    }
    if (arrowSpan) {
      arrowSpan.innerHTML = getIconHTML('expand_more', 'transition-transform duration-200 group-open:rotate-180');
    }
    if (warnIconSpan) {
      warnIconSpan.innerHTML = getIconHTML('warning', 'text-amber-600 dark:text-amber-500 text-sm');
    }

    allergenList.innerHTML = Object.entries(ALLERGEN_GROUPS)
      .map(([key, group]) => {
        const isChecked = draft.allergies && draft.allergies.includes(key) ? 'checked' : '';
        const name = group[activeLang];
        return `
          <label class="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <span class="font-body-md text-xs text-text-heading dark:text-slate-200 leading-tight pr-2">${escapeHtml(name)}</span>
            <input type="checkbox" value="${escapeHtml(key)}" ${isChecked} class="allergen-cb custom-checkbox flex-shrink-0" style="width: 18px; height: 18px;"/>
          </label>
        `;
      })
      .join('');
  }

  // 4. Reset Section (only shown when returning to settings, not first-time onboarding)
  const contentArea = document.getElementById('onboarding-content-area');
  let resetSection = document.getElementById('reset-app-section');
  if (!state.isFirstVisit && contentArea) {
    if (!resetSection) {
      resetSection = document.createElement('section');
      resetSection.id = 'reset-app-section';
      resetSection.className = 'pt-2 border-t border-black/[0.06] dark:border-white/[0.08]';
      contentArea.appendChild(resetSection);
    }
    renderResetButton(state);
  } else if (resetSection) {
    resetSection.remove();
  }

  if (typeof onApplyLanguage === 'function') {
    onApplyLanguage();
  }

  if (focusedSelector && onboardingEl) {
    let nextFocusEl = onboardingEl.querySelector(focusedSelector);
    if (nextFocusEl && nextFocusEl.disabled) {
      const key = nextFocusEl.getAttribute('data-canteen-key');
      if (key) {
        nextFocusEl = onboardingEl.querySelector(
          `[data-action="move-canteen-order"][data-canteen-key="${key}"]:not([disabled])`
        );
      }
    }
    if (nextFocusEl && typeof nextFocusEl.focus === 'function' && !nextFocusEl.disabled) {
      nextFocusEl.focus();
    }
  }
}

/**
 * Renders the Reset Settings button inside `#reset-app-section`.
 *
 * @param {object} state
 */
export function renderResetButton(state) {
  const resetSection = document.getElementById('reset-app-section');
  if (!resetSection) return;
  const activeLang = (state.settingsDraft ? (state.settingsDraft.lang || state.settingsDraft.language) : state.lang) || 'de';
  const t = state.translations[activeLang] || state.translations.de;
  resetSection.innerHTML = `
    <button type="button" data-action="reset-app-prompt" class="w-full py-2.5 px-4 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
      <span class="text-[16px] flex items-center">${getIconHTML('close')}</span>
      <span>${escapeHtml(t.resetAppBtn)}</span>
    </button>
  `;
}

/**
 * Renders the Reset Settings confirmation box inside `#reset-app-section`.
 *
 * @param {object} state
 */
export function renderResetConfirm(state) {
  const resetSection = document.getElementById('reset-app-section');
  if (!resetSection) return;
  const activeLang = (state.settingsDraft ? (state.settingsDraft.lang || state.settingsDraft.language) : state.lang) || 'de';
  const t = state.translations[activeLang] || state.translations.de;
  resetSection.innerHTML = `
    <div class="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex flex-col gap-3">
      <p class="text-xs text-red-800 dark:text-red-300 font-medium leading-relaxed text-center">
        ${escapeHtml(t.resetAppConfirmText)}
      </p>
      <div class="flex gap-2">
        <button type="button" data-action="reset-app-cancel" class="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-black/[0.08] dark:border-white/[0.08] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
          ${escapeHtml(t.resetAppCancelBtn)}
        </button>
        <button type="button" data-action="reset-app-confirm" class="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
          ${escapeHtml(t.resetAppConfirmBtn)}
        </button>
      </div>
    </div>
  `;
}

/**
 * Opens the Onboarding / Settings modal (`#onboarding`).
 *
 * @param {boolean} isInitial
 * @param {object} state
 * @param {object} modalState
 * @param {() => void} onApplyLanguage
 */
export function showOnboarding(isInitial, state, modalState, onApplyLanguage) {
  const el = document.getElementById('onboarding');
  const closeBtn = document.getElementById('close-onboarding-btn');
  if (!el) return;

  state.settingsDraft = {
    ...createSettingsDraft(state),
    excludePork: Boolean(state.excludePork)
  };
  initOnboardingUI(state, onApplyLanguage);

  if (isInitial) {
    closeBtn?.classList.add('hidden');
  } else {
    closeBtn?.classList.remove('hidden');
  }

  el.classList.remove('hidden');
  syncAppInertState();

  if (modalState.cleanupOnboardingTrap) modalState.cleanupOnboardingTrap();
  modalState.cleanupOnboardingTrap = trapFocus(el);
}

/**
 * Cancels the Onboarding / Settings modal without saving draft changes.
 *
 * @param {object} state
 * @param {object} modalState
 * @param {() => void} onApplyLanguage
 */
export function cancelOnboarding(state, modalState, onApplyLanguage) {
  const el = document.getElementById('onboarding');
  if (!el) return;
  state.settingsDraft = null;
  if (typeof onApplyLanguage === 'function') onApplyLanguage();
  el.classList.add('hidden');
  if (modalState.cleanupOnboardingTrap) {
    modalState.cleanupOnboardingTrap();
    modalState.cleanupOnboardingTrap = null;
  }
  syncAppInertState();
  document.getElementById('menu-btn')?.focus();
}

/**
 * Validates and commits the user's Settings draft from `#onboarding` to `state` and `localStorage`.
 *
 * @param {object} state
 * @param {object} modalState
 * @param {() => void} onSettingsSaved
 */
export function hideOnboarding(state, modalState, onSettingsSaved) {
  const el = document.getElementById('onboarding');
  if (!el) return;

  const activeLang = (state.settingsDraft ? (state.settingsDraft.lang || state.settingsDraft.language) : state.lang) || 'de';
  const t = state.translations[activeLang] || state.translations.de;

  const checkedCanteens = Array.from(document.querySelectorAll('.canteen-cb:checked')).map(
    (cb) => cb.value
  );
  if (checkedCanteens.length === 0) {
    showToast(t.minOneCanteenError, 'warning', { closeLabel: t.closeBtn });
    return;
  }

  const checkedAllergens = Array.from(document.querySelectorAll('.allergen-cb:checked')).map(
    (cb) => cb.value
  );

  let finalSelectedCanteens = checkedCanteens;
  if (state.settingsDraft && Array.isArray(state.settingsDraft.selectedCanteens)) {
    const draftOrder = state.settingsDraft.selectedCanteens.filter((k) => checkedCanteens.includes(k));
    const extra = checkedCanteens.filter((k) => !draftOrder.includes(k));
    finalSelectedCanteens = [...draftOrder, ...extra];
  }

  if (state.settingsDraft) {
    state.lang = state.settingsDraft.lang || state.settingsDraft.language || state.lang || 'de';
    state.diet = state.settingsDraft.diet;
    state.tariff = state.settingsDraft.tariff || 'student';
    state.excludePork = Boolean(state.settingsDraft.excludePork);
    state.settingsDraft = null;
  }

  state.selectedCanteens = normalizeCanteenOrder(finalSelectedCanteens, CANTEENS);
  state.allergies = checkedAllergens;
  state.isFirstVisit = false;

  localStorage.setItem('kstw_lang', state.lang);
  localStorage.setItem('kstw_canteens', JSON.stringify(state.selectedCanteens));
  localStorage.setItem('kstw_diet', state.diet);
  localStorage.setItem('kstw_allergies', JSON.stringify(state.allergies));
  localStorage.setItem('kstw_exclude_pork', state.excludePork ? 'true' : 'false');
  setTariff(state.tariff);

  el.classList.add('hidden');
  if (modalState.cleanupOnboardingTrap) {
    modalState.cleanupOnboardingTrap();
    modalState.cleanupOnboardingTrap = null;
  }
  syncAppInertState();
  document.getElementById('menu-btn')?.focus();

  if (typeof onSettingsSaved === 'function') {
    onSettingsSaved();
  }
}

/**
 * Checks whether to display the one-time Allergen Feature Promo modal (`#allergen-prompt-overlay`).
 * Includes full dialog ARIA semantics, focus trap, and Escape dismissal.
 *
 * @param {object} state
 * @param {object} modalState
 * @param {() => void} onOpenAllergenSettings
 */
export function checkAllergenPrompt(state, modalState, onOpenAllergenSettings) {
  if (state.isFirstVisit) return;
  if (localStorage.getItem('kstw_allergen_prompt_v1')) return;
  if (document.getElementById('changelog-modal')) return;

  if (state.allergies && state.allergies.length > 0) {
    localStorage.setItem('kstw_allergen_prompt_v1', 'true');
    return;
  }

  setTimeout(() => {
    if (document.getElementById('changelog-modal')) return;
    const t = state.translations[state.lang];
    const promptOverlay = document.createElement('div');
    promptOverlay.id = 'allergen-prompt-overlay';
    promptOverlay.setAttribute('role', 'dialog');
    promptOverlay.setAttribute('aria-modal', 'true');
    promptOverlay.setAttribute('aria-labelledby', 'allergen-prompt-title');
    promptOverlay.className =
      'fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in';

    promptOverlay.innerHTML = `
      <div class="bg-white dark:bg-[#122338] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-black/[0.08] dark:border-white/[0.08] flex flex-col items-center text-center animate-zoom-in">
        <div class="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-4 text-2xl shadow-inner">
          ${getIconHTML('medical_information')}
        </div>
        <h3 id="allergen-prompt-title" class="font-headline font-bold text-lg text-text-heading dark:text-white mb-2">
          ${escapeHtml(t.allergenPromptTitle)}
        </h3>
        <p class="font-body-md text-xs text-on-surface-variant dark:text-slate-300 leading-relaxed mb-6">
          ${escapeHtml(t.allergenPromptDesc)}
        </p>
        <div class="flex flex-col w-full gap-2">
          <button type="button" id="prompt-yes-btn" class="w-full py-3 bg-price-badge text-primary font-bold rounded-xl text-xs shadow-sm active:scale-95 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            ${escapeHtml(t.allergenPromptYes)}
          </button>
          <button type="button" id="prompt-no-btn" class="w-full py-2.5 text-on-surface-variant dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 font-semibold rounded-xl text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
            ${escapeHtml(t.allergenPromptNo)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(promptOverlay);
    syncAppInertState();
    const cleanupPromptTrap = trapFocus(promptOverlay);
    modalState.cleanupAllergenPrompt = () => {
      cleanupPromptTrap();
      promptOverlay.remove();
      modalState.cleanupAllergenPrompt = null;
      syncAppInertState();
    };

    document.getElementById('prompt-yes-btn')?.addEventListener('click', () => {
      localStorage.setItem('kstw_allergen_prompt_v1', 'true');
      if (modalState.cleanupAllergenPrompt) modalState.cleanupAllergenPrompt();
      if (typeof onOpenAllergenSettings === 'function') {
        onOpenAllergenSettings();
      }
    });

    document.getElementById('prompt-no-btn')?.addEventListener('click', () => {
      localStorage.setItem('kstw_allergen_prompt_v1', 'true');
      if (modalState.cleanupAllergenPrompt) modalState.cleanupAllergenPrompt();
    });
  }, 1500);
}

/**
 * Initializes the PWA Install Promo Card inside `#onboarding`.
 *
 * @param {object} state
 */
export function initInstallPrompt(state) {
  const promoCard = document.getElementById('install-promo-card');
  const actionsContainer = document.getElementById('install-actions');
  if (!promoCard || !actionsContainer) return;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const activeLang = (state.settingsDraft ? (state.settingsDraft.lang || state.settingsDraft.language) : state.lang) || 'de';
  const t = state.translations[activeLang] || state.translations.de;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const curLang = (state.settingsDraft ? (state.settingsDraft.lang || state.settingsDraft.language) : state.lang) || 'de';
    const curT = state.translations[curLang] || state.translations.de;
    promoCard.classList.remove('hidden');
    actionsContainer.innerHTML = `
      <button type="button" id="pwa-install-btn" class="w-full py-2.5 px-4 bg-primary dark:bg-price-badge text-on-primary dark:text-primary font-label-md rounded-xl flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
        ${getIconHTML('download', 'text-base')}
        ${escapeHtml(curT.installBtn)}
      </button>
    `;

    document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          promoCard.classList.add('hidden');
        }
        deferredInstallPrompt = null;
      }
    });
  });

  if (isIOS) {
    promoCard.classList.remove('hidden');
    actionsContainer.innerHTML = `
      <div class="bg-blue-50/50 dark:bg-[#0b1926] p-3 rounded-xl border border-blue-100 dark:border-slate-800 text-xs text-text-main dark:text-slate-300 flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="bg-white dark:bg-[#122338] p-1 rounded shadow-xs text-blue-600 flex items-center">${getIconHTML('ios_share', 'text-base')}</span>
          <span>${t.iosStep1}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="bg-white dark:bg-[#122338] p-1 rounded shadow-xs text-slate-700 dark:text-slate-300 flex items-center">${getIconHTML('add_box', 'text-base')}</span>
          <span>${t.iosStep2}</span>
        </div>
      </div>
    `;
  }
}
