import { trapFocus } from '../lib/a11y.js';
import { escapeHtml } from '../lib/html.js';
import { logger } from '../lib/logger.js';
import { getIconHTML } from './icons.js';
import { showToast } from './toast.js';
import { syncAppInertState } from './modals.js';

let isRefreshingSW = false;

/**
 * Registers `sw.js`, manages update checks, and binds `controllerchange`.
 *
 * @param {object} state
 * @param {object} modalState
 */
export function registerSW(state, modalState) {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        logger.debug('SW registered:', reg);

        setInterval(() => {
          reg.update();
        }, 60 * 1000);

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update();
          }
        });

        if (reg.waiting) {
          showUpdateDialog(reg, state, modalState);
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateDialog(reg, state, modalState);
            }
          });
        });
      })
      .catch((err) => logger.warn('SW Error:', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isRefreshingSW) {
        isRefreshingSW = true;
        sessionStorage.setItem('kstw_just_updated', '1');
        reloadWithCacheBust();
      }
    });
  });
}

/**
 * Reloads the page with a `_v` cache-busting query parameter.
 */
export function reloadWithCacheBust() {
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString());
  window.location.replace(url.toString());
}

/**
 * Displays the Service Worker update prompt dialog (`#update-modal`) with focus trap and Escape support.
 *
 * @param {ServiceWorkerRegistration} registration
 * @param {object} state
 * @param {object} modalState
 */
export function showUpdateDialog(registration, state, modalState) {
  if (document.getElementById('update-modal')) return;

  const t = state.translations[state.lang];
  const modal = document.createElement('div');
  modal.id = 'update-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'update-modal-title');
  modal.className = 'fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fade-in';
  modal.innerHTML = `
    <div class="bg-white dark:bg-[#122338] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center animate-zoom-in">
      <div class="w-12 h-12 bg-price-badge/20 text-yellow-700 dark:text-price-badge rounded-full flex items-center justify-center mb-4">
        <span class="text-2xl flex items-center">${getIconHTML('system_update')}</span>
      </div>
      <h3 id="update-modal-title" class="font-headline font-bold text-lg text-text-heading dark:text-white mb-2">${escapeHtml(t.updateTitle)}</h3>
      <p class="font-body-md text-xs text-on-surface-variant dark:text-slate-300 mb-6 leading-relaxed">
        ${escapeHtml(t.updateDesc)}
      </p>
      <div class="flex gap-3 w-full">
        <button type="button" id="update-later-btn" class="flex-1 py-2.5 px-4 rounded-xl font-label-md text-xs border border-black/[0.1] dark:border-white/[0.1] text-on-surface-variant dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
          ${escapeHtml(t.updateLaterBtn)}
        </button>
        <button type="button" id="update-now-btn" class="flex-1 py-2.5 px-4 rounded-xl font-label-md text-xs bg-price-badge text-primary font-bold shadow-md hover:brightness-105 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          ${escapeHtml(t.updateNowBtn)}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  syncAppInertState();
  const cleanupTrap = trapFocus(modal);
  modalState.cleanupUpdateModal = () => {
    cleanupTrap();
    modal.remove();
    modalState.cleanupUpdateModal = null;
    syncAppInertState();
  };

  document.getElementById('update-later-btn')?.addEventListener('click', () => {
    if (modalState.cleanupUpdateModal) modalState.cleanupUpdateModal();
  });

  document.getElementById('update-now-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('update-now-btn');
    if (btn) {
      btn.textContent = t.updatingBtn;
      btn.disabled = true;
    }

    if (registration.waiting) {
      registration.waiting.postMessage({ action: 'skipWaiting' });
      setTimeout(() => {
        if (!isRefreshingSW) {
          isRefreshingSW = true;
          sessionStorage.setItem('kstw_just_updated', '1');
          reloadWithCacheBust();
        }
      }, 1500);
    } else {
      sessionStorage.setItem('kstw_just_updated', '1');
      reloadWithCacheBust();
    }
  });
}

/**
 * Checks if the app just reloaded from a Service Worker update and shows a confirmation toast.
 *
 * @param {object} state
 */
export function checkUpdatedToast(state) {
  const url = new URL(window.location.href);
  if (url.searchParams.has('_v')) {
    url.searchParams.delete('_v');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  if (sessionStorage.getItem('kstw_just_updated') === '1') {
    sessionStorage.removeItem('kstw_just_updated');
    const t = state.translations[state.lang];
    showToast(t.updatedToast, 'check_circle', { closeLabel: t.closeBtn });
  }
}

/**
 * Initializes the mobile pull-to-refresh gesture on `#app-container`.
 * Exported as an explicit initializer (no top-level side effects on import).
 *
 * @param {() => Promise<void>} onPullRefresh
 */
export function initPullToRefresh(onPullRefresh) {
  if (typeof document === 'undefined') return;
  let startY = 0;
  let pulling = false;
  const threshold = 90;

  const indicator = document.createElement('div');
  indicator.id = 'ptr-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.className =
    'fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-primary dark:bg-price-badge text-white dark:text-primary px-4 py-1.5 rounded-b-xl shadow-md text-xs font-bold transition-transform duration-200 -translate-y-full flex items-center gap-1.5 pointer-events-none';
  indicator.innerHTML = `<span class="animate-spin text-[14px] flex items-center">${getIconHTML('refresh')}</span><span>Aktualisiere…</span>`;
  document.body.appendChild(indicator);

  window.addEventListener(
    'touchstart',
    (e) => {
      if (window.scrollY <= 0 && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'touchmove',
    (e) => {
      if (!pulling) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 30 && window.scrollY <= 0) {
        const progress = Math.min(diff / threshold, 1);
        indicator.style.transform = `translate(-50%, ${(progress - 1) * 100}%)`;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'touchend',
    async (e) => {
      if (!pulling) return;
      pulling = false;
      const diff = (e.changedTouches[0]?.clientY || 0) - startY;
      if (diff >= threshold && window.scrollY <= 0) {
        indicator.style.transform = 'translate(-50%, 0)';
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
          }
          if (typeof onPullRefresh === 'function') {
            await onPullRefresh();
          }
        } finally {
          setTimeout(() => {
            indicator.style.transform = 'translate(-50%, -100%)';
          }, 500);
        }
      } else {
        indicator.style.transform = 'translate(-50%, -100%)';
      }
    },
    { passive: true }
  );
}

export const CHANGELOG_VERSION = 'v63';

/**
 * Displays the "What's New?" Changelog modal (`#changelog-modal`) upon first start of a major release.
 *
 * @param {object} state
 * @param {object} modalState
 * @param {(() => void) | null} onOpenStats
 */
export function showChangelogModal(state, modalState, onOpenStats = null) {
  if (typeof document === 'undefined') return;
  if (document.getElementById('changelog-modal')) return;

  const t = state.translations[state.lang] || state.translations.de;
  const modal = document.createElement('div');
  modal.id = 'changelog-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'changelog-modal-title');
  modal.className =
    'fixed inset-0 z-[65] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in';

  modal.innerHTML = `
    <div class="bg-white dark:bg-[#0b1926] border border-black/[0.08] dark:border-white/[0.08] rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[88vh] overflow-y-auto hide-scrollbar animate-zoom-in">
      <div class="flex items-center justify-between">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-price-badge/20 text-yellow-800 dark:text-price-badge border border-price-badge/30">
          ${escapeHtml(t.changelogBadge)}
        </span>
        <button type="button" id="changelog-x-btn" aria-label="${escapeHtml(t.closeBtn)}" class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
          ${getIconHTML('close', 'text-lg')}
        </button>
      </div>

      <div class="flex flex-col gap-1">
        <h3 id="changelog-modal-title" class="text-xl font-bold font-headline text-text-heading dark:text-white leading-tight">
          ${escapeHtml(t.changelogTitle)}
        </h3>
        <p class="text-xs text-on-surface-variant dark:text-slate-400 leading-relaxed">
          ${escapeHtml(t.changelogSubtitle)}
        </p>
      </div>

      <div class="flex flex-col gap-2.5">
        <div class="bg-slate-50 dark:bg-[#122338] p-3.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] flex flex-col gap-1">
          <div class="text-xs font-bold text-text-heading dark:text-white flex items-center gap-1.5">
            ${escapeHtml(t.changelogFeat1Title)}
          </div>
          <p class="text-[11px] text-on-surface-variant dark:text-slate-400 leading-relaxed">
            ${escapeHtml(t.changelogFeat1Desc)}
          </p>
        </div>

        <div class="bg-slate-50 dark:bg-[#122338] p-3.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] flex flex-col gap-1">
          <div class="text-xs font-bold text-text-heading dark:text-white flex items-center gap-1.5">
            ${escapeHtml(t.changelogFeat2Title)}
          </div>
          <p class="text-[11px] text-on-surface-variant dark:text-slate-400 leading-relaxed">
            ${escapeHtml(t.changelogFeat2Desc)}
          </p>
        </div>

        <div class="bg-slate-50 dark:bg-[#122338] p-3.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] flex flex-col gap-1">
          <div class="text-xs font-bold text-text-heading dark:text-white flex items-center gap-1.5">
            ${escapeHtml(t.changelogFeat3Title)}
          </div>
          <p class="text-[11px] text-on-surface-variant dark:text-slate-400 leading-relaxed">
            ${escapeHtml(t.changelogFeat3Desc)}
          </p>
        </div>

        <div class="bg-slate-50 dark:bg-[#122338] p-3.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] flex flex-col gap-1">
          <div class="text-xs font-bold text-text-heading dark:text-white flex items-center gap-1.5">
            ${escapeHtml(t.changelogFeat4Title)}
          </div>
          <p class="text-[11px] text-on-surface-variant dark:text-slate-400 leading-relaxed">
            ${escapeHtml(t.changelogFeat4Desc)}
          </p>
        </div>
      </div>

      <div class="flex gap-2.5 pt-1">
        <button type="button" id="changelog-stats-btn" class="flex-1 py-3 px-3 rounded-xl border border-black/[0.1] dark:border-white/[0.1] text-xs font-bold text-on-surface-variant dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
          ${escapeHtml(t.changelogStatsBtn)}
        </button>
        <button type="button" id="changelog-close-btn" class="flex-1 py-3 px-3 rounded-xl bg-price-badge text-primary text-xs font-extrabold shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          ${escapeHtml(t.changelogCloseBtn)}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  syncAppInertState();
  const cleanupTrap = trapFocus(modal);

  const dismiss = () => {
    localStorage.setItem('kstw_changelog_seen', CHANGELOG_VERSION);
    if (modalState.cleanupChangelogModal) {
      modalState.cleanupChangelogModal();
    }
  };

  modalState.cleanupChangelogModal = () => {
    cleanupTrap();
    modal.remove();
    modalState.cleanupChangelogModal = null;
    syncAppInertState();
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      dismiss();
    }
  });

  document.getElementById('changelog-x-btn')?.addEventListener('click', dismiss);
  document.getElementById('changelog-close-btn')?.addEventListener('click', dismiss);

  document.getElementById('changelog-stats-btn')?.addEventListener('click', () => {
    dismiss();
    if (typeof onOpenStats === 'function') {
      onOpenStats();
    }
  });
}

/**
 * Checks if the changelog for the current release has been seen.
 * If not, displays the changelog modal after a short delay (post splash screen).
 *
 * @param {object} state
 * @param {object} modalState
 * @param {(() => void) | null} onOpenStats
 */
export function checkChangelogPrompt(state, modalState, onOpenStats = null) {
  if (state.isFirstVisit) return;
  if (localStorage.getItem('kstw_changelog_seen') === CHANGELOG_VERSION) return;
  if (document.getElementById('changelog-modal')) return;

  setTimeout(() => {
    if (state.isFirstVisit) return;
    if (localStorage.getItem('kstw_changelog_seen') === CHANGELOG_VERSION) return;
    if (document.getElementById('changelog-modal')) return;
    showChangelogModal(state, modalState, onOpenStats);
  }, 600);
}

