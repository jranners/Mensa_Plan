import { describe, it, expect } from 'vitest';
import {
  cleanDPName,
  stripAllergenCodes,
  parseDishServingTime,
  isDishExpired,
  getDishesServiceWindow,
  extractDishCounter,
  isPureDessert,
  isGenericDessertComponent
} from '../src/lib/dish.js';

describe('Dish Module', () => {
  it('cleans DPName suffixes properly', () => {
    expect(cleanDPName('Veganes Schnitzel TK')).toBe('Veganes Schnitzel');
    expect(cleanDPName('Chili sin Carne Neu Abendessen')).toBe('Chili sin Carne');
    expect(cleanDPName('Gulasch Eigenproduktion')).toBe('Gulasch');
  });

  it('strips allergen codes from text', () => {
    expect(stripAllergenCodes('Salat (13, 20)')).toBe('Salat');
    expect(stripAllergenCodes('Pasta ohne Allergene')).toBe('Pasta ohne Allergene');
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

  it('extracts dish counter from dish_info or screens', () => {
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
    expect(extractDishCounter(dishWithScreen, 'unimensa')).toBe('MG Nord');
  });

  it('identifies desserts and generic dessert components', () => {
    expect(isPureDessert({ category: { name_de: 'Dessert' } })).toBe(true);
    expect(isPureDessert({ name_de: 'Schokopudding' })).toBe(false);
    expect(isGenericDessertComponent('Dessert (11, 17)', false)).toBe(true);
    expect(isGenericDessertComponent('Dessert', true)).toBe(false); // Pure dessert dish
  });
});
