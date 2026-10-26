import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SVG_ICONS } from '../data/icons.js';
import { CANTEENS } from '../data/canteens.js';
import { TRANSLATIONS } from '../data/translations.js';
import { STANDARD_ALLERGENS } from '../data/allergens.js';
import { needsRefresh } from '../src/lib/lifecycle.js';
import { resetAppStorage, createSettingsDraft, migrateStorage } from '../src/lib/storage.js';
import { validateWeekMenu, validateAnnouncements } from '../src/lib/validation.js';
import { getCanteenKeyFromDish } from '../src/lib/canteen-match.js';
import { getCanteenHoursForDay, getCanteenOpenStatus } from '../src/lib/hours.js';
import { trapFocus, setAriaPressed, setAriaExpanded } from '../src/lib/a11y.js';
import {
  computeTraySummary,
  generateDishIcsContent
} from '../src/ui/tray-calendar.js';
import {
  renderMainDishCard,
  renderCompactDishCard
} from '../src/ui/cards.js';
import {
  renderAnnouncements,
  renderDateSelector,
  renderQuickFilterBar,
  renderCanteenMenu
} from '../src/ui/feed.js';
import { showAllergens } from '../src/ui/modals.js';
import { cleanDishNameForFavorite } from '../src/lib/dish.js';

describe('ES Module & UI Component Smoke Test', () => {
  it('loads SVG_ICONS properly with aria-hidden and new Stage 3 icons', () => {
    expect(SVG_ICONS).toBeDefined();
    expect(typeof SVG_ICONS.settings).toBe('string');
    expect(SVG_ICONS.settings).toContain('aria-hidden="true"');
    expect(typeof SVG_ICONS.calculate).toBe('string');
    expect(typeof SVG_ICONS.tray).toBe('string');
    expect(typeof SVG_ICONS.calendar_add).toBe('string');
    expect(typeof SVG_ICONS.search).toBe('string');
  });

  it('loads CANTEENS properly', () => {
    expect(CANTEENS).toBeDefined();
    expect(CANTEENS.unimensa).toBeDefined();
    expect(CANTEENS.unimensa.name).toBe('Mensa Zülpicher Straße');
  });

  it('loads TRANSLATIONS properly with both languages', () => {
    expect(TRANSLATIONS).toBeDefined();
    expect(TRANSLATIONS.de).toBeDefined();
    expect(TRANSLATIONS.en).toBeDefined();
    expect(TRANSLATIONS.de.title).toBe('Mensaplan');
    expect(TRANSLATIONS.en.title).toBe('Mensaplan');
  });

  it('loads STANDARD_ALLERGENS properly', () => {
    expect(STANDARD_ALLERGENS).toBeDefined();
    expect(STANDARD_ALLERGENS['11']).toEqual({ de: 'Enthält Gluten', en: 'Contains gluten' });
    expect(STANDARD_ALLERGENS['13']).toEqual({ de: 'Enthält Eier', en: 'Contains eggs' });
  });

  it('loads core library modules properly', async () => {
    expect(typeof needsRefresh).toBe('function');
    expect(typeof resetAppStorage).toBe('function');
    expect(typeof createSettingsDraft).toBe('function');
    expect(typeof migrateStorage).toBe('function');
    expect(typeof validateWeekMenu).toBe('function');
    expect(typeof validateAnnouncements).toBe('function');
    expect(typeof getCanteenKeyFromDish).toBe('function');
    expect(typeof getCanteenHoursForDay).toBe('function');
    expect(typeof getCanteenOpenStatus).toBe('function');
    expect(typeof trapFocus).toBe('function');
    expect(typeof setAriaPressed).toBe('function');
    expect(typeof setAriaExpanded).toBe('function');

    const statsModule = await import('../src/lib/stats.js');
    expect(typeof statsModule.computeLiveMenuStats).toBe('function');
    expect(typeof statsModule.computeFavoritesRadar).toBe('function');
  });

  describe('Stage 3: Mein Tablett (computeTraySummary) & .ics Calendar Export', () => {
    it('computes total price and discounts included sides when main dish includes free sides', () => {
      const mainDish = {
        id: '101',
        name_de: 'Schnitzel Wiener Art',
        price_student: 3.5,
        price_employee: 4.9,
        price_guest: 6.2,
        custom_fields: [
          { field_id: 'menu_type', value: 'HEIMSPIEL' },
          { field_id: 'allergens_numbers', value: '11a, 13, 28' }
        ]
      };
      const sideDish = {
        id: '102',
        name_de: 'Pommes frites',
        price_student: 0.9,
        price_employee: 1.15,
        price_guest: 1.55,
        custom_fields: [
          { field_id: 'menu_type', value: 'BEILAGE' },
          { field_id: 'allergens_numbers', value: '20' }
        ]
      };

      const tray = [
        { key: '101::schnitzel wiener art', dish: mainDish, canteenKey: 'unimensa', mealName: 'Schnitzel Wiener Art' },
        { key: '102::pommes frites', dish: sideDish, canteenKey: 'unimensa', mealName: 'Pommes frites' }
      ];

      // Pre-September 2026: standard main dish includes 2 sides free
      const preReform = computeTraySummary(tray, 'student', '2026-04-20');
      expect(preReform.freeSidesAvailable).toBe(2);
      expect(preReform.freeSidesUsed).toBe(1);
      expect(preReform.totalPrice).toBe(3.5);
      expect(preReform.unionAllergens).toEqual(['11a', '13', '20', '28']);

      // Post-September 2026: sides priced separately unless explicitly stated
      const postReform = computeTraySummary(tray, 'student', '2026-10-19');
      expect(postReform.freeSidesAvailable).toBe(0);
      expect(postReform.totalPrice).toBe(4.4);
    });

    it('generates valid RFC 5545 .ics calendar content for a dish', () => {
      const dish = {
        id: '555',
        name_de: 'Marokkanischer Kichererbseneintopf',
        price: 1.4,
        custom_fields: [
          { field_id: 'dish_ger_1', value: 'Kichererbseneintopf' },
          { field_id: 'dish_ger_2', value: 'Fladenbrot' },
          { field_id: 'dish_info', value: 'MG Nord - 11:30 - 14:30 Uhr' }
        ]
      };
      const ics = generateDishIcsContent(dish, '2026-04-20', 'unimensa', {
        lang: 'de',
        tariff: 'student'
      });
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('DTSTART;TZID=Europe/Berlin:20260420T113000');
      expect(ics).toContain('SUMMARY:🍽️ Marokkanischer Kichererbseneintopf (Mensa Zülpicher Straße)');
      expect(ics).toContain('LOCATION:Mensa Zülpicher Straße – MG Nord');
      expect(ics).toContain('END:VCALENDAR');
    });
  });

  describe('Stage 2 & 3 UI Modules (Cards, Feed, Modals)', () => {
    const mockState = {
      lang: 'de',
      tariff: 'student',
      diet: 'all',
      allergies: [],
      selectedCanteens: ['unimensa'],
      activeDate: '2026-04-20',
      todayIso: '2026-04-20',
      favorites: ['kichererbseneintopf'],
      tray: [],
      translations: TRANSLATIONS
    };

    let elementsMap = {};

    const createMockElement = (id, initialHidden = false) => {
      const classes = new Set(initialHidden ? ['hidden'] : []);
      const attrs = {};
      return {
        id,
        innerHTML: '',
        textContent: '',
        inert: false,
        style: {},
        classList: {
          add: (...c) => c.forEach((x) => classes.add(x)),
          remove: (...c) => c.forEach((x) => classes.delete(x)),
          contains: (c) => classes.has(c),
          toggle: (c, force) => {
            const shouldHave = force !== undefined ? force : !classes.has(c);
            if (shouldHave) classes.add(c);
            else classes.delete(c);
            return shouldHave;
          }
        },
        setAttribute: (k, v) => {
          attrs[k] = v;
        },
        removeAttribute: (k) => {
          delete attrs[k];
        },
        getAttribute: (k) => attrs[k],
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        contains: () => false
      };
    };

    beforeEach(() => {
      elementsMap = {
        'app-container': createMockElement('app-container'),
        'main-feed': createMockElement('main-feed'),
        'active-date-container': createMockElement('active-date-container'),
        'tray-bar-container': createMockElement('tray-bar-container'),
        'date-selector-container': createMockElement('date-selector-container'),
        'quick-filter-container': createMockElement('quick-filter-container'),
        'announcement-banner-container': createMockElement('announcement-banner-container'),
        'allergens-modal': createMockElement('allergens-modal', true),
        'allergens-modal-title': createMockElement('allergens-modal-title'),
        'allergens-modal-list': createMockElement('allergens-modal-list'),
        'allergens-modal-disclaimer': createMockElement('allergens-modal-disclaimer')
      };

      globalThis.document = {
        body: { style: {} },
        activeElement: null,
        getElementById: (id) => elementsMap[id] || null
      };

      const store = new Map();
      globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
      };
      globalThis.window = { localStorage: globalThis.localStorage };
    });

    afterEach(() => {
      delete globalThis.document;
      delete globalThis.localStorage;
      delete globalThis.window;
    });

    it('renders main dish card with species badges and tray/calendar buttons without Lindenthal merging badge', () => {
      const dish = {
        id: '900',
        name_de: 'Hähnchenbrust (11a, 20)',
        price: 3.4,
        custom_fields: [
          { field_id: 'menu_type', value: 'HEIMSPIEL' },
          { field_id: 'food_icon', value: 'G,NL' },
          { field_id: 'ort_id', value: '201' },
          { field_id: 'allergens_numbers', value: '11a, 20' }
        ]
      };
      const html = renderMainDishCard(dish, false, mockState, 'unimensa');
      expect(html).toContain('Hähnchenbrust');
      expect(html).not.toContain('(11a, 20)');
      expect(html).toContain('Geflügel');
      expect(html).toContain('Artgerecht (NL)');
      expect(html).not.toContain('Auch in Mensa Lindenthal');
      expect(html).toContain('data-action="tray-toggle"');
      expect(html).toContain('data-action="export-calendar"');
    });

    it('renders side combo drawer and updates price badge when dishSideCombos has selections', () => {
      const mainDish = {
        id: '900',
        name_de: 'Hähnchenbrust',
        price_student: 3.5,
        custom_fields: [
          { field_id: 'menu_type', value: 'HEIMSPIEL' },
          { field_id: 'ort_id', value: '201' }
        ]
      };
      const side1 = {
        id: '910',
        name_de: 'Pommes frites',
        price_student: 0.9,
        custom_fields: [{ field_id: 'menu_type', value: 'BEILAGE' }]
      };
      const side2 = {
        id: '911',
        name_de: 'Beilagensalat',
        price_student: 0.8,
        custom_fields: [{ field_id: 'menu_type', value: 'BEILAGE' }]
      };

      const availableSides = [side1, side2];
      const dishKey = `${mainDish.id}::${cleanDishNameForFavorite(mainDish)}`;

      // 1. Without sides selected
      const stateWithoutSides = {
        ...mockState,
        dishSideCombos: {},
        openComboDrawers: {}
      };
      const htmlInitial = renderMainDishCard(mainDish, false, stateWithoutSides, 'unimensa', availableSides);
      expect(htmlInitial).toContain('data-action="toggle-combo-drawer"');
      expect(htmlInitial).toContain('Beilagen kombinieren');
      expect(htmlInitial).toContain('Pommes frites');
      expect(htmlInitial).toContain('Beilagensalat');
      expect(htmlInitial).toContain('3,50 €');
      expect(htmlInitial).not.toContain('Basis 3,50 €');

      // 2. Post-Sept 2026 (no included sides): 1 side added -> 3.50 + 0.90 = 4.40 €
      const statePostSept = {
        ...mockState,
        activeDate: '2026-10-19',
        dishSideCombos: {
          [dishKey]: [cleanDishNameForFavorite(side1)]
        },
        openComboDrawers: {
          [dishKey]: true
        }
      };
      const htmlPostSept = renderMainDishCard(mainDish, false, statePostSept, 'unimensa', availableSides);
      expect(htmlPostSept).toContain('4,40 €'); // 3.50 + 0.90
      expect(htmlPostSept).toContain('Basis 3,50 € + 1 Beil.');
      expect(htmlPostSept).toContain('1 Beilage(n) gewählt');
      expect(htmlPostSept).toContain('aria-pressed="true"');

      // 3. Pre-Sept 2026 (2 included sides in old system): 2 sides added -> both free -> 3.50 €
      const statePreSeptTwoSides = {
        ...mockState,
        activeDate: '2026-04-20',
        dishSideCombos: {
          [dishKey]: [cleanDishNameForFavorite(side1), cleanDishNameForFavorite(side2)]
        },
        openComboDrawers: {
          [dishKey]: true
        }
      };
      const htmlPreSept = renderMainDishCard(mainDish, false, statePreSeptTwoSides, 'unimensa', availableSides);
      expect(htmlPreSept).toContain('3,50 €');
      expect(htmlPreSept).toContain('Basis 3,50 € + 2 Beil.');
      expect(htmlPreSept).toContain('2 Beilage(n) gewählt (+0,00 €)');
    });

    it('renders compact dish card cleanly', () => {
      const side = {
        id: '901',
        name_de: 'Süßkartoffelpommes',
        price: 0.9,
        custom_fields: [
          { field_id: 'menu_type', value: 'BEILAGE VEGAN' },
          { field_id: 'food_icon', value: 'Vgn' }
        ]
      };
      const html = renderCompactDishCard(side, false, mockState, 'unimensa');
      expect(html).toContain('Süßkartoffelpommes');
      expect(html).toContain('0,90 €');
      expect(html).toContain('data-action="tray-toggle"');
    });

    it('renders announcements up to 14 days old and resolves custom allergens in showAllergens', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      renderAnnouncements(
        [{ topic: 'Öffnungszeiten', content: 'Geänderte Zeiten', dateFetched: twoDaysAgo }],
        mockState
      );
      expect(elementsMap['announcement-banner-container'].innerHTML).toContain('Öffnungszeiten');

      renderQuickFilterBar(mockState);
      expect(elementsMap['quick-filter-container'].innerHTML).toContain('id="dish-search-input"');

      const stateWithMenu = {
        ...mockState,
        menuData: [
          {
            date: '2026-04-20',
            dishes: [
              {
                id: '777',
                name_de: 'Testgericht',
                custom_fields: [
                  { field_id: 'allergens_numbers', value: '19, 32a' },
                  { field_id: 'allergens_names', value: '32a=Spezialzutat | Special ingredient' }
                ]
              }
            ]
          }
        ]
      };
      renderDateSelector(stateWithMenu);
      const modalState = {};
      showAllergens('777::testgericht', stateWithMenu, modalState);
      expect(elementsMap['allergens-modal-list'].innerHTML).toContain('Enthält Schalenfrüchte');
      expect(elementsMap['allergens-modal-list'].innerHTML).toContain('Spezialzutat');
      expect(elementsMap['app-container'].inert).toBe(true);
    });

    it('renders canteen feed with walking route overview bar, direct route links, and normalized mensa-bistro order without collapse', () => {
      const dayData = {
        date: '2026-04-20',
        dishes: [
          {
            id: '1',
            name_de: 'Pasta Bolognese',
            price_student: 2.8,
            custom_fields: [{ field_id: 'ort_id', value: '201' }, { field_id: 'menu_type', value: 'HEIMSPIEL' }]
          },
          {
            id: '2',
            name_de: 'Bistro Sandwich',
            price_student: 2.2,
            menu_group_name: 'Bistro E-Raum',
            custom_fields: [{ field_id: 'menu_type', value: 'BISTRO' }]
          }
        ]
      };

      // 1. Without GPS distances computed yet
      const stateWithoutDist = {
        ...mockState,
        selectedCanteens: ['eraum', 'unimensa'], // Intentionally bistro first to verify normalization
        canteenDistancesKm: {},
        nearestMensaKey: null
      };
      renderCanteenMenu(dayData, stateWithoutDist);
      const html1 = elementsMap['main-feed'].innerHTML;
      expect(html1).toContain('data-action="request-user-location"');
      expect(html1).toContain('Route anzeigen');
      expect(html1).toContain('https://www.google.com/maps/dir/?api=1');
      expect(html1).toContain('travelmode=walking');
      expect(html1).not.toContain('toggle-collapse-canteen');
      expect(html1).not.toContain('focus-canteen');

      // Check that unimensa (Mensa) is rendered before eraum (Bistro) despite selectedCanteens input
      const unimensaIdx = html1.indexOf('Mensa Zülpicher Straße');
      const eraumIdx = html1.indexOf('Bistro Uni E-Raum');
      expect(unimensaIdx).toBeGreaterThan(-1);
      expect(eraumIdx).toBeGreaterThan(-1);
      expect(unimensaIdx).toBeLessThan(eraumIdx);

      // 2. With GPS distances computed
      const stateWithDist = {
        ...mockState,
        selectedCanteens: ['unimensa', 'eraum'],
        canteenDistancesKm: {
          unimensa: 0.35,
          eraum: 1.2
        },
        nearestMensaKey: 'unimensa'
      };
      renderCanteenMenu(dayData, stateWithDist);
      const html2 = elementsMap['main-feed'].innerHTML;
      expect(html2).not.toContain('data-action="request-user-location"');
      expect(html2).toContain('350 m · Route ↗');
      expect(html2).toContain('1,2 km · Route ↗');
      expect(html2).toContain('Nächste Mensa');

      // 3. Keeps all selected Bistros visible in the feed even when filtered out or when no dishes are registered
      const stateWithAllBistros = {
        ...mockState,
        diet: 'vegan', // Filters out non-vegan Bistro Sandwich in eraum
        selectedCanteens: ['unimensa', 'eraum', 'philcafe'],
        canteenDistancesKm: {},
        nearestMensaKey: null
      };
      renderCanteenMenu(dayData, stateWithAllBistros);
      const html3 = elementsMap['main-feed'].innerHTML;
      expect(html3).toContain('Mensa Zülpicher Straße');
      expect(html3).toContain('Bistro Uni E-Raum');
      expect(html3).toContain('Bistro PhilCafé');
      expect(html3).toContain('Keine passenden Gerichte für deine aktiven Filter (1 ausgeblendet).');
      expect(html3).toContain('Für dieses Bistro sind an diesem Tag (noch) keine Gerichte im Speiseplan eingetragen.');
    });
  });
});
