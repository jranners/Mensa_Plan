import { describe, it, expect, vi } from 'vitest';
import { trapFocus, setAriaPressed, setAriaExpanded } from '../src/lib/a11y.js';

describe('Accessibility (a11y) Helpers', () => {
  it('safely handles missing container for trapFocus', () => {
    const release = trapFocus(null);
    expect(typeof release).toBe('function');
    expect(() => release()).not.toThrow();
  });

  it('sets aria-pressed and aria-expanded correctly', () => {
    const el = {
      setAttribute: vi.fn()
    };

    setAriaPressed(el, true);
    expect(el.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');

    setAriaPressed(el, false);
    expect(el.setAttribute).toHaveBeenCalledWith('aria-pressed', 'false');

    setAriaExpanded(el, true);
    expect(el.setAttribute).toHaveBeenCalledWith('aria-expanded', 'true');

    setAriaExpanded(el, false);
    expect(el.setAttribute).toHaveBeenCalledWith('aria-expanded', 'false');
  });

  it('traps focus inside container and cycles on Tab', () => {
    const btn1 = { id: 'btn-1', offsetWidth: 10, offsetHeight: 10, focus: vi.fn() };
    const btn2 = { id: 'btn-2', offsetWidth: 10, offsetHeight: 10, focus: vi.fn() };
    let listener = null;

    const container = {
      querySelectorAll: vi.fn().mockReturnValue([btn1, btn2]),
      addEventListener: vi.fn((event, fn) => { listener = fn; }),
      removeEventListener: vi.fn(),
      contains: vi.fn().mockReturnValue(true)
    };

    const release = trapFocus(container);
    expect(container.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(typeof listener).toBe('function');

    // Mock document.activeElement
    globalThis.document = { activeElement: btn2 };

    // Tab on last element wraps to first
    const tabEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn()
    };
    listener(tabEvent);
    expect(tabEvent.preventDefault).toHaveBeenCalled();
    expect(btn1.focus).toHaveBeenCalled();

    // Shift+Tab on first element wraps to last
    globalThis.document.activeElement = btn1;
    const shiftTabEvent = {
      key: 'Tab',
      shiftKey: true,
      preventDefault: vi.fn()
    };
    listener(shiftTabEvent);
    expect(shiftTabEvent.preventDefault).toHaveBeenCalled();
    expect(btn2.focus).toHaveBeenCalled();

    delete globalThis.document;
    release();
    expect(container.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
