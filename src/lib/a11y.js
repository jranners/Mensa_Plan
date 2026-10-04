/**
 * Accessibility (a11y) utilities: Focus trap, focus restoration, and ARIA attributes
 */

/**
 * Traps keyboard focus within the specified container element.
 * Returns a release function that removes listeners and restores focus to the previously active element.
 *
 * @param {HTMLElement} container - Modal or dialog element
 * @returns {() => void} Function to release focus trap and restore focus
 */
export function trapFocus(container) {
  if (!container || typeof container.querySelectorAll !== 'function') {
    return () => {};
  }

  const previousFocusedElement = (typeof document !== 'undefined') ? document.activeElement : null;

  const getFocusableElements = () => {
    const activeEl = (typeof document !== 'undefined') ? document.activeElement : null;
    return Array.from(container.querySelectorAll(
      'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    )).filter(el => {
      // Element is visible
      return el.offsetWidth > 0 || el.offsetHeight > 0 || (activeEl && el === activeEl);
    });
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;

    const focusables = getFocusableElements();
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = (typeof document !== 'undefined') ? document.activeElement : null;

    if (e.shiftKey) {
      if (activeEl === first || (activeEl && !container.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (activeEl === last || (activeEl && !container.contains(activeEl))) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus initial element inside container
  const focusables = getFocusableElements();
  if (focusables.length > 0) {
    const preferred = focusables.find(el => el.id && (el.id.includes('close') || el.id.includes('submit'))) || focusables[0];
    if (preferred && typeof preferred.focus === 'function') {
      try {
        preferred.focus();
      } catch {
        // Ignore in environments without full focus support
      }
    }
  }

  return function releaseFocus() {
    container.removeEventListener('keydown', handleKeyDown);
    if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
      try {
        previousFocusedElement.focus();
      } catch {
        // Safe no-op
      }
    }
  };
}

/**
 * Sets aria-pressed attribute on an element.
 * @param {HTMLElement} element
 * @param {boolean} isPressed
 */
export function setAriaPressed(element, isPressed) {
  if (element && typeof element.setAttribute === 'function') {
    element.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
  }
}

/**
 * Sets aria-expanded attribute on an element.
 * @param {HTMLElement} element
 * @param {boolean} isExpanded
 */
export function setAriaExpanded(element, isExpanded) {
  if (element && typeof element.setAttribute === 'function') {
    element.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  }
}
