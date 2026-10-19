import { escapeHtml } from '../lib/html.js';
import { getIconHTML } from './icons.js';

/**
 * Displays an accessible status toast notification at the bottom of the viewport.
 * Uses role="status" and aria-live="polite" and appends to document.body to avoid
 * clipping inside #app-container's overflow-hidden.
 *
 * @param {string} message
 * @param {string} [iconName='check_circle']
 * @param {{ durationMs?: number, closeLabel?: string }} [options={}]
 */
export function showToast(message, iconName = 'check_circle', options = {}) {
  if (typeof document === 'undefined') return;
  const { durationMs = 4000, closeLabel = 'Schließen' } = options;

  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-primary dark:bg-[#182c44] text-white px-4 py-3 rounded-2xl shadow-xl border border-white/10 flex items-center gap-2.5 text-xs font-bold whitespace-nowrap transition-all duration-300 opacity-0 translate-y-2 max-w-[92vw]';

  toast.innerHTML = `
    <span class="text-emerald-400 text-[16px] flex items-center shrink-0">${getIconHTML(iconName)}</span>
    <span class="truncate">${escapeHtml(message)}</span>
    <button type="button" id="close-toast-btn" aria-label="${escapeHtml(closeLabel)}" class="ml-1 p-1 hover:bg-white/10 rounded-full text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-price-badge">
      <span class="text-[14px] flex items-center">${getIconHTML('close')}</span>
    </button>
  `;

  document.body.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('#close-toast-btn')?.addEventListener('click', dismiss);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.remove('opacity-0', 'translate-y-2');
    });
  });

  if (durationMs > 0) {
    setTimeout(() => {
      if (toast.isConnected) dismiss();
    }, durationMs);
  }
}

/**
 * Copies text to clipboard with fallback and displays a localized confirmation toast.
 *
 * @param {string} text
 * @param {object} state
 * @param {string} [customToastMsg]
 */
export async function copyTextToClipboard(text, state, customToastMsg = '') {
  const t = state.translations[state.lang];
  const msg = customToastMsg || t.shareToast;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('Clipboard API unavailable');
    }
    showToast(msg, 'check_circle', { closeLabel: t.closeBtn });
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(msg, 'check_circle', { closeLabel: t.closeBtn });
    } catch {
      // Ignore fallback error
    }
    document.body.removeChild(textArea);
  }
}
