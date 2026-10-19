import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TRANSLATIONS } from '../data/translations.js';
import {
  CHANGELOG_VERSION,
  showChangelogModal,
  checkChangelogPrompt
} from '../src/ui/sw-update.js';

describe('What is New? Changelog Modal (v63)', () => {
  let store;
  let listeners;
  let modalState;
  let mockState;
  let childElementsMap;
  let createdElements;

  const createMockElement = (tag, id = '') => {
    const el = {
      tagName: tag.toUpperCase(),
      id,
      className: '',
      attributes: {},
      style: {},
      _html: '',
      set innerHTML(html) {
        this._html = html;
        const matches = [...html.matchAll(/id="([^"]+)"/g)];
        for (const match of matches) {
          const childId = match[1];
          if (!childElementsMap[childId]) {
            childElementsMap[childId] = createMockElement('div', childId);
          }
        }
      },
      get innerHTML() {
        return this._html || '';
      },
      setAttribute(name, val) {
        this.attributes[name] = String(val);
      },
      getAttribute(name) {
        return this.attributes[name] || null;
      },
      addEventListener(event, fn) {
        const key = this.id || tag;
        if (!listeners[key]) listeners[key] = {};
        if (!listeners[key][event]) listeners[key][event] = [];
        listeners[key][event].push(fn);
      },
      removeEventListener(event, fn) {
        const key = this.id || tag;
        if (listeners[key]?.[event]) {
          listeners[key][event] = listeners[key][event].filter((f) => f !== fn);
        }
      },
      dispatchEvent(event) {
        const key = this.id || tag;
        const fns = listeners[key]?.[event.type] || [];
        fns.forEach((fn) => fn(event));
      },
      click() {
        this.dispatchEvent({ type: 'click', target: this });
      },
      querySelectorAll() {
        return [];
      },
      remove() {
        if (this.id && childElementsMap[this.id]) {
          delete childElementsMap[this.id];
        }
        const idx = createdElements.indexOf(this);
        if (idx > -1) createdElements.splice(idx, 1);
      }
    };
    return el;
  };

  beforeEach(() => {
    store = new Map();
    listeners = {};
    childElementsMap = {};
    modalState = {
      cleanupChangelogModal: null
    };
    mockState = {
      lang: 'de',
      isFirstVisit: false,
      translations: TRANSLATIONS
    };

    const documentListeners = {};
    createdElements = [];

    globalThis.document = {
      body: {
        appendChild: vi.fn((el) => {
          createdElements.push(el);
          if (el.id) childElementsMap[el.id] = el;
          return el;
        }),
        style: {}
      },
      getElementById: vi.fn((id) => {
        return childElementsMap[id] || createdElements.find((el) => el.id === id) || null;
      }),
      createElement: vi.fn((tag) => createMockElement(tag)),
      addEventListener(event, fn) {
        if (!documentListeners[event]) documentListeners[event] = [];
        documentListeners[event].push(fn);
      }
    };

    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };
  });

  afterEach(() => {
    delete globalThis.document;
    delete globalThis.localStorage;
    vi.restoreAllMocks();
  });

  it('exports CHANGELOG_VERSION as v63', () => {
    expect(CHANGELOG_VERSION).toBe('v63');
  });

  it('renders modal with correct accessible dialog attributes and feature tiles', () => {
    showChangelogModal(mockState, modalState);

    const modal = document.getElementById('changelog-modal');
    expect(modal).not.toBeNull();
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('aria-labelledby')).toBe('changelog-modal-title');
    expect(modal.innerHTML).toContain('changelog-modal-title');
    expect(modal.innerHTML).toContain('Statistik-Dashboard');
    expect(modal.innerHTML).toContain('Beilagen-Kombinierer');
    expect(modal.innerHTML).toContain('Reihenfolge');
    expect(modal.innerHTML).toContain('Schnellfilter');
    expect(typeof modalState.cleanupChangelogModal).toBe('function');
  });

  it('does not re-open modal if changelog-modal element already exists', () => {
    showChangelogModal(mockState, modalState);
    const initialCallCount = document.body.appendChild.mock.calls.length;
    showChangelogModal(mockState, modalState);
    expect(document.body.appendChild.mock.calls.length).toBe(initialCallCount);
  });

  it('sets kstw_changelog_seen and invokes onOpenStats when clicking stats button', () => {
    const onOpenStats = vi.fn();
    showChangelogModal(mockState, modalState, onOpenStats);

    const statsBtnListeners = listeners['changelog-stats-btn']?.['click'] || [];
    expect(statsBtnListeners.length).toBeGreaterThan(0);
    statsBtnListeners[0]();

    expect(localStorage.getItem('kstw_changelog_seen')).toBe('v63');
    expect(onOpenStats).toHaveBeenCalledTimes(1);
    expect(modalState.cleanupChangelogModal).toBeNull();
    expect(document.getElementById('changelog-modal')).toBeNull();
  });

  it('sets kstw_changelog_seen and cleans up when clicking close button or X button', () => {
    showChangelogModal(mockState, modalState);
    const closeBtnListeners = listeners['changelog-close-btn']?.['click'] || [];
    expect(closeBtnListeners.length).toBeGreaterThan(0);
    closeBtnListeners[0]();

    expect(localStorage.getItem('kstw_changelog_seen')).toBe('v63');
    expect(modalState.cleanupChangelogModal).toBeNull();
    expect(document.getElementById('changelog-modal')).toBeNull();
  });

  it('checkChangelogPrompt ignores first visit or already seen versions', () => {
    vi.useFakeTimers();

    // 1. isFirstVisit = true -> should not trigger
    const firstVisitState = { ...mockState, isFirstVisit: true };
    checkChangelogPrompt(firstVisitState, modalState);
    vi.runAllTimers();
    expect(document.getElementById('changelog-modal')).toBeNull();

    // 2. already seen v63 -> should not trigger
    localStorage.setItem('kstw_changelog_seen', 'v63');
    checkChangelogPrompt(mockState, modalState);
    vi.runAllTimers();
    expect(document.getElementById('changelog-modal')).toBeNull();

    // 3. not seen and not first visit -> triggers after timer
    localStorage.removeItem('kstw_changelog_seen');
    checkChangelogPrompt(mockState, modalState);
    vi.advanceTimersByTime(600);
    expect(document.getElementById('changelog-modal')).not.toBeNull();

    vi.useRealTimers();
  });
});
