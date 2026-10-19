import { describe, it, expect, vi } from 'vitest';
import {
  cleanDPName,
  stripAllergenCodes,
  stripInlineAllergenCodes,
  parseDishServingTime,
  isDishExpired,
  getDishesServiceWindow,
  extractDishCounter,
  isPureDessert,
  isGenericDessertComponent,
  classifyDish,
  getDishDisplayName,
  getDishComponentsList,
  getBrandAndSubTag
} from '../src/lib/dish.js';
import { logger, isDebugEnabled } from '../src/lib/logger.js';

describe('Dish Module', () => {
  it('cleans DPName suffixes properly', () => {
    expect(cleanDPName('Veganes Schnitzel TK')).toBe('Veganes Schnitzel');
    expect(cleanDPName('Chili sin Carne Neu Abendessen')).toBe('Chili sin Carne');
    expect(cleanDPName('Gulasch Eigenproduktion')).toBe('Gulasch');
  });

  it('strips allergen codes from text and inline strings', () => {
    expect(stripAllergenCodes('Salat (13, 20)')).toBe('Salat');
    expect(stripAllergenCodes('Pasta ohne Allergene')).toBe('Pasta ohne Allergene');
    expect(stripInlineAllergenCodes('Hirtenkäse (17) mit Oliven (3)')).toBe('Hirtenkäse mit Oliven');
    expect(stripInlineAllergenCodes('Currywurst (2, 3, 20, 21)')).toBe('Currywurst');
  });

  it('parses dish serving times from dish_info', () => {
    const dishWithTime = {
      custom_fields: [
        { field_id: 'dish_info', value: 'EG Nord 11.30 - 14.30 Uhr' }
      ]
    };
    const parsed = parseDishServingTime(dishWithTime);
    expect(parsed).not.toBeNull();
    expect(parsed.startHour).toBe(11.5);
    expect(parsed.endHour).toBe(14.5);
    expect(parsed.servingTime).toBe('11:30 - 14:30');

    // Missing or invalid dish_info
    expect(parseDishServingTime(null)).toBeNull();
    expect(parseDishServingTime({})).toBeNull();
    expect(parseDishServingTime({ custom_fields: [{ field_id: 'dish_info', value: '1' }] })).toBeNull();
  });

  it('checks if a dish is expired based on decimal hour', () => {
    const dish = {
      custom_fields: [
        { field_id: 'dish_info', value: '11:30 - 14:00' }
      ]
    };
    // 13:30 (13.5) -> not expired
    expect(isDishExpired(dish, 13.5)).toBe(false);
    // 14:05 (14.08) -> expired
    expect(isDishExpired(dish, 14.08)).toBe(true);

    // Dish without time info is not marked expired
    expect(isDishExpired({}, 15.0)).toBe(false);
  });

  it('calculates the combined service window for multiple dishes', () => {
    const dishes = [
      { custom_fields: [{ field_id: 'dish_info', value: '11:15 - 14:00' }] },
      { custom_fields: [{ field_id: 'dish_info', value: '11:30 - 14:30' }] }
    ];
    const window = getDishesServiceWindow(dishes);
    expect(window).not.toBeNull();
    expect(window.startHour).toBe(11.25);
    expect(window.endHour).toBe(14.5);
    expect(window.formatted).toBe('11:15 - 14:30 Uhr');

    expect(getDishesServiceWindow([])).toBeNull();
  });

  it('extracts dish counter from dish_info or screens and rejects mismatched canteen screens', () => {
    const dishWithInfo = {
      custom_fields: [
        { field_id: 'dish_info', value: 'EG Nord 11:30 - 14:30 Uhr' }
      ]
    };
    expect(extractDishCounter(dishWithInfo, 'unimensa')).toBe('EG Nord');

    const dishWithScreen = {
      screens: [
        { location: 'MZS - MG Nord (Ausgabe 1)' }
      ]
    };
    expect(extractDishCounter(dishWithScreen, 'unimensa')).toBe('MG Nord (Ausgabe 1)');

    const deutzScreen = {
      screens: [
        { location: 'Deutz - Ausgabe 1' }
      ]
    };
    expect(extractDishCounter(deutzScreen, 'iwz-deutz')).toBe('Ausgabe 1');

    // Mismatched canteen prefix in screens must not leak onto unimensa
    const lindenthalScreenOnUnimensa = {
      screens: [
        { location: 'Mensa Lindenthal - Ausgabe 1' }
      ]
    };
    expect(extractDishCounter(lindenthalScreenOnUnimensa, 'unimensa')).toBe('');
  });

  it('identifies desserts and generic dessert components including food_icon D', () => {
    expect(isPureDessert({ category: { name_de: 'Dessert' } })).toBe(true);
    expect(isPureDessert({ name_de: 'Schokopudding', custom_fields: [{ field_id: 'food_icon', value: 'D' }] })).toBe(true);
    expect(isPureDessert({ name_de: 'Schokopudding' })).toBe(false);
    expect(isGenericDessertComponent('Dessert (11, 17)', false)).toBe(true);
    expect(isGenericDessertComponent('Dessert', true)).toBe(false); // Pure dessert dish
  });

  it('classifies dishes accurately without false-positive Bistro buffet classification (Bug B-01)', () => {
    // Bistro E-Raum per-piece main dish with location="Bistro" and screen="Warmausgabe" (no preis_gramm)
    const bistroSausage = {
      name_de: 'Grillbratwurst',
      price: 0.97,
      custom_fields: [
        { field_id: 'location', value: 'Bistro E-Raum' },
        { field_id: 'food_icon', value: 'S' }
      ],
      screens: [{ location: 'Bistro E-Raum - Warmausgabe' }]
    };
    expect(classifyDish(bistroSausage)).toBe('main');

    const bistroVeganSchnitzel = {
      name_de: 'Schnitzel vegan',
      price: 0.97,
      custom_fields: [
        { field_id: 'location', value: 'Bistro E-Raum' },
        { field_id: 'food_icon', value: 'VGN' }
      ]
    };
    expect(classifyDish(bistroVeganSchnitzel)).toBe('main');

    // Bistro side dish without preis_gramm
    const bistroFries = {
      name_de: 'Pommes Frites 8 mm frisch Vegan',
      price: 0.70,
      custom_fields: [
        { field_id: 'location', value: 'Bistro E-Raum' }
      ],
      screens: [{ location: 'Bistro E-Raum - Warmausgabe' }]
    };
    expect(classifyDish(bistroFries)).toBe('side');

    // Genuine buffet dish with preis_gramm="100"
    const genuineBuffet = {
      name_de: 'Gebackene Kartoffelspalten',
      price: 1.07,
      custom_fields: [
        { field_id: 'preis_gramm', value: '100' },
        { field_id: 'location', value: 'Bistro E-Raum' }
      ]
    };
    expect(classifyDish(genuineBuffet)).toBe('buffet');

    // Tagesrestproduktion (artikel_id 10069) is always main
    const restproduktion = {
      name_de: 'Tagesrestproduktion',
      price: 1.15,
      custom_fields: [{ field_id: 'artikel_id', value: '10069' }]
    };
    expect(classifyDish(restproduktion)).toBe('main');

    // Soup at low price is main, not side
    const cheapSoup = {
      name_de: 'Tomatensuppe mit Reis',
      price: 1.10,
      custom_fields: []
    };
    expect(classifyDish(cheapSoup)).toBe('main');
  });

  it('builds localized dish display name and component list', () => {
    const dish = {
      name_de: 'Spaghetti Bolognese (20, 21)',
      name_en: 'Spaghetti Bolognese (20, 21)',
      custom_fields: [
        { field_id: 'CUSTOM_DPNAME', value: 'Spaghetti Bolognese Eigenproduktion' },
        { field_id: 'dish_ger_1', value: 'Spaghetti Bolognese (11w, 20, 21)' },
        { field_id: 'dish_ger_2', value: 'Beilagensalat (13)' },
        { field_id: 'dish_1_eng', value: 'Spaghetti Bolognese (11w, 20, 21)' },
        { field_id: 'dish_2_eng', value: 'Side salad (13)' }
      ]
    };

    expect(getDishDisplayName(dish, 'de')).toBe('Spaghetti Bolognese');
    expect(getDishDisplayName(dish, 'en')).toBe('Spaghetti Bolognese');

    const compsDe = getDishComponentsList(dish, 'Spaghetti Bolognese', 'de');
    expect(compsDe).toEqual(['Beilagensalat']);

    const compsEn = getDishComponentsList(dish, 'Spaghetti Bolognese', 'en');
    expect(compsEn).toEqual(['Side salad']);
  });

  it('extracts brand and subTag for menu lines and special items', () => {
    const dishMenu = {
      name_de: 'Pasta Pesto',
      custom_fields: [{ field_id: 'menu_type', value: 'QUERBEET VEGAN ST' }]
    };
    const brandInfo = getBrandAndSubTag(dishMenu, {});
    expect(brandInfo.brandKey).toBe('QUERBEET');
    expect(brandInfo.brandName).toBe('Querbeet');

    const dishDinner = {
      name_de: 'Burger',
      custom_fields: [{ field_id: 'menu_type', value: 'STREETFOOD ABENDESSEN' }]
    };
    const dinnerInfo = getBrandAndSubTag(dishDinner, {});
    expect(dinnerInfo.brandKey).toBe('STREETFOOD');
    expect(dinnerInfo.subTag).toBe('Abendessen');
  });

  it('logger gates debug/info/warn on debug flag and always outputs error', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(isDebugEnabled()).toBe(false);
    logger.warn('test warning');
    logger.error('test error');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('test error');

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

