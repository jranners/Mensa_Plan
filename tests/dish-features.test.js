import { describe, it, expect } from 'vitest';
import {
  cleanDishNameForFavorite,
  parsePrice,
  getDishPrice,
  formatPrice,
  isBuffetDish,
  getBuffetPricePer100g,
  calculateBuffetPrice
} from '../src/lib/dish.js';
import {
  getFavoritesV2,
  toggleFavoriteV2,
  isFavoriteV2,
  getTariff,
  setTariff,
  resetAppStorage,
  FAVORITES_V2_KEY
} from '../src/lib/storage.js';

describe('Dish Features (Favorites, Tariffs, Buffet)', () => {
  describe('cleanDishNameForFavorite', () => {
    it('normalizes dish names by stripping allergens, markers and lowercasing', () => {
      expect(cleanDishNameForFavorite({ name_de: 'Spaghetti Bolognese (13, 20)' })).toBe('spaghetti bolognese');
      expect(cleanDishNameForFavorite({ name_de: 'Pommes Frites [TK]' })).toBe('pommes frites');
      expect(cleanDishNameForFavorite({ name_de: 'Veganes Chili (Eigenproduktion) [Vegan]' })).toBe('veganes chili');
      expect(cleanDishNameForFavorite('  Gemüsepfanne   (17, 18)  ')).toBe('gemüsepfanne');
    });

    it('returns empty string for falsy input', () => {
      expect(cleanDishNameForFavorite(null)).toBe('');
      expect(cleanDishNameForFavorite(undefined)).toBe('');
      expect(cleanDishNameForFavorite({})).toBe('');
    });
  });

  describe('parsePrice and formatPrice', () => {
    it('parses comma and dot decimal strings and numbers', () => {
      expect(parsePrice('1,10')).toBe(1.10);
      expect(parsePrice('1.07')).toBe(1.07);
      expect(parsePrice(2.5)).toBe(2.5);
      expect(parsePrice('invalid')).toBeNull();
      expect(parsePrice(null)).toBeNull();
    });

    it('formats price as localized Euro string', () => {
      expect(formatPrice(1.1)).toBe('1,10 €');
      expect(formatPrice(0.55)).toBe('0,55 €');
      expect(formatPrice(null)).toBe('');
    });
  });

  describe('Tariff Pricing (Student, Employee, Guest, External)', () => {
    const mockDish = {
      price: 2.80,
      custom_fields: [
        { field_id: 'price_2', value: '3,50' },
        { field_id: 'price_3', value: '4.20' },
        { field_id: 'price_4', value: '0,00' }
      ]
    };

    it('returns student price by default', () => {
      expect(getDishPrice(mockDish, 'student')).toBe(2.80);
      expect(formatPrice(getDishPrice(mockDish, 'student'))).toBe('2,80 €');
    });

    it('returns employee price for employee tariff', () => {
      expect(getDishPrice(mockDish, 'employee')).toBe(3.50);
      expect(formatPrice(getDishPrice(mockDish, 'employee'))).toBe('3,50 €');
    });

    it('returns guest price for guest tariff', () => {
      expect(getDishPrice(mockDish, 'guest')).toBe(4.20);
      expect(formatPrice(getDishPrice(mockDish, 'guest'))).toBe('4,20 €');
    });

    it('falls back to guest price when price_4 is 0,00 (not offered for external)', () => {
      expect(getDishPrice(mockDish, 'external')).toBe(4.20);
    });

    it('uses price_4 when positive external price exists', () => {
      const dishWithExt = {
        price: 2.80,
        custom_fields: [
          { field_id: 'price_3', value: '4.20' },
          { field_id: 'price_4', value: '5,00' }
        ]
      };
      expect(getDishPrice(dishWithExt, 'external')).toBe(5.00);
    });
  });

  describe('Buffet Price Calculator', () => {
    const buffetDish = {
      name_de: 'Salatbuffet',
      price: 1.10,
      custom_fields: [{ field_id: 'preis_gramm', value: '100' }]
    };

    it('detects buffet dish correctly', () => {
      expect(isBuffetDish(buffetDish)).toBe(true);
      expect(isBuffetDish({ name_de: 'Schnitzel Wiener Art' })).toBe(false);
    });

    it('calculates buffet price based on weight in grams', () => {
      const p100 = getBuffetPricePer100g(buffetDish);
      expect(p100).toBe(1.10);
      expect(calculateBuffetPrice(p100, 100)).toBe(1.10);
      expect(calculateBuffetPrice(p100, 250)).toBe(2.75);
      expect(calculateBuffetPrice(p100, 333)).toBe(3.66);
      expect(calculateBuffetPrice(p100, 0)).toBe(0);
    });
  });

  describe('Storage Favorites V2 and Tariff', () => {
    function createMockStorage() {
      const store = {};
      return {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
      };
    }

    it('manages favorites by clean name', () => {
      const storage = createMockStorage();
      expect(getFavoritesV2(storage)).toEqual([]);
      expect(isFavoriteV2('pasta pesto', storage)).toBe(false);

      const added = toggleFavoriteV2('pasta pesto', storage);
      expect(added).toBe(true);
      expect(isFavoriteV2('pasta pesto', storage)).toBe(true);
      expect(getFavoritesV2(storage)).toEqual(['pasta pesto']);

      const removed = toggleFavoriteV2('pasta pesto', storage);
      expect(removed).toBe(false);
      expect(isFavoriteV2('pasta pesto', storage)).toBe(false);
      expect(getFavoritesV2(storage)).toEqual([]);
    });

    it('preserves favorites when resetAppStorage is executed', () => {
      const storage = createMockStorage();
      storage.setItem(FAVORITES_V2_KEY, JSON.stringify(['chili sin carne']));
      storage.setItem('kstw_diet', 'vegan');

      resetAppStorage(storage);
      expect(storage.getItem('kstw_diet')).toBeNull();
      expect(storage.getItem(FAVORITES_V2_KEY)).toBe(JSON.stringify(['chili sin carne']));
    });

    it('persists and validates tariff selection', () => {
      const storage = createMockStorage();
      expect(getTariff(storage)).toBe('student');

      setTariff('employee', storage);
      expect(getTariff(storage)).toBe('employee');

      setTariff('invalid_tariff', storage);
      expect(getTariff(storage)).toBe('student');
    });
  });
});
