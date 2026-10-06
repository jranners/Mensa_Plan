import { describe, it, expect, beforeEach } from 'vitest';
import {
  STATS_KEY,
  getInitialStats,
  loadSavedStats,
  saveStats,
  aggregateMenuStats,
  computeLiveMenuStats
} from '../src/lib/stats.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Statistics Module (Ultra-lightweight)', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  const mockMenuData = [
    {
      date: '2026-10-05',
      dishes: [
        {
          name_de: 'Vegane Meatballs (11, 21)',
          price: 3.25,
          custom_fields: [{ field_id: 'food_icon', value: 'VGN' }]
        },
        {
          name_de: 'Käsespätzle (11, 13, 17)',
          price: 2.80,
          custom_fields: [{ field_id: 'food_icon', value: 'V' }]
        },
        {
          name_de: 'Currywurst mit Pommes',
          price: 4.10,
          custom_fields: [{ field_id: 'food_icon', value: 'S' }]
        }
      ]
    },
    {
      date: '2026-10-06',
      dishes: [
        {
          name_de: 'Vegane Meatballs',
          price: 3.25,
          custom_fields: [{ field_id: 'food_icon', value: 'VGN' }]
        },
        {
          name_de: 'Gemüsecurry mit Reis',
          price: 2.50,
          custom_fields: [{ field_id: 'food_icon', value: 'VGN' }]
        }
      ]
    }
  ];

  it('provides default initial stats', () => {
    const stats = getInitialStats();
    expect(stats.totalDishes).toBe(0);
    expect(stats.veganCount).toBe(0);
    expect(stats.vegetarianCount).toBe(0);
    expect(stats.otherCount).toBe(0);
    expect(stats.recordedDates).toEqual([]);
  });

  it('aggregates menu data and calculates metrics accurately', () => {
    const stats = aggregateMenuStats(mockMenuData);

    expect(stats.totalDishes).toBe(5);
    expect(stats.veganCount).toBe(3); // 2x Vegane Meatballs, 1x Gemüsecurry
    expect(stats.vegetarianCount).toBe(1); // Käsespätzle
    expect(stats.otherCount).toBe(1); // Currywurst
    expect(stats.minPrice).toBe(2.50);
    expect(stats.maxPrice).toBe(4.10);
    expect(stats.priceCount).toBe(5);
    expect(stats.dishCounts['vegane meatballs']).toBe(2);
    expect(stats.recordedDates).toEqual(['2026-10-05', '2026-10-06']);
  });

  it('is idempotent and ignores already recorded dates on repeated aggregation', () => {
    const firstRun = aggregateMenuStats(mockMenuData);
    expect(firstRun.totalDishes).toBe(5);

    // Run again with identical dates
    const secondRun = aggregateMenuStats(mockMenuData, firstRun);
    expect(secondRun.totalDishes).toBe(5); // Not 10!
    expect(secondRun.recordedDates.length).toBe(2);
  });

  it('computes live stats on the fly without writing to localStorage', () => {
    const live = computeLiveMenuStats(mockMenuData);
    expect(live.totalDishes).toBe(5);
    expect(live.veganCount).toBe(3);
    expect(localStorage.getItem(STATS_KEY)).toBeNull();
  });

  it('strictly limits storage size to less than 4 KB under heavy accumulation', () => {
    const hugeStats = getInitialStats();
    // Simulate 200 different dish names
    for (let i = 0; i < 200; i++) {
      hugeStats.dishCounts[`very long and detailed special meal name number ${i}`] = i;
    }
    // Simulate 100 dates
    for (let i = 0; i < 100; i++) {
      hugeStats.recordedDates.push(`2026-0${(i % 9) + 1}-${(i % 28) + 1}`);
    }

    const saved = saveStats(hugeStats);
    const storedString = localStorage.getItem(STATS_KEY);

    expect(Object.keys(saved.dishCounts).length).toBeLessThanOrEqual(50);
    expect(saved.recordedDates.length).toBeLessThanOrEqual(30);

    const sizeInBytes = new TextEncoder().encode(storedString).length;
    expect(sizeInBytes).toBeLessThan(4096); // < 4 KB
  });

  describe('Rich Live Stats & Filter Scenarios', () => {
    const complexMenuData = [
      {
        date: '2026-10-05', // Monday of week 1
        dishes: [
          {
            name_de: 'Marokkanischer Kichererbseneintopf',
            price: 2.10,
            custom_fields: [{ field_id: 'food_icon', value: 'VGN' }, { field_id: 'menu_type', value: 'HEIMSPEIL' }],
            screens: [{ location: 'MZS - MG Nord (Ausgabe 1)', screen_group_name: 'Mensa Zülpicher Straße' }]
          },
          {
            name_de: 'Dessert (11, 18)',
            price: 0.80,
            category: { name_de: 'Dessert' },
            custom_fields: [{ field_id: 'menu_type', value: 'dessert' }],
            screens: [{ location: 'MZS - EG Nord 1', screen_group_name: 'Mensa Zülpicher Straße' }]
          },
          {
            name_de: 'Pommes frites',
            price: 1.10,
            custom_fields: [{ field_id: 'menu_type', value: 'beilage' }],
            screens: [{ location: 'MZS - EG Nord 1', screen_group_name: 'Mensa Zülpicher Straße' }]
          },
          {
            name_de: 'Salatbuffet in Selbstbedienung, je 100g',
            price: 1.10,
            custom_fields: [{ field_id: 'preis_gramm', value: '100' }],
            screens: [{ location: 'MZS - MG Süd 1', screen_group_name: 'Mensa Zülpicher Straße' }]
          }
        ]
      },
      {
        date: '2026-10-06', // Tuesday of week 1
        dishes: [
          {
            name_de: 'Marokkanischer Kichererbseneintopf',
            price: 2.10,
            custom_fields: [{ field_id: 'food_icon', value: 'VGN' }, { field_id: 'menu_type', value: 'HEIMSPEIL' }],
            screens: [{ location: 'MZS - MG Nord (Ausgabe 1)', screen_group_name: 'Mensa Zülpicher Straße' }]
          },
          {
            name_de: 'No Butter Chicken',
            price: 2.45,
            custom_fields: [{ field_id: 'food_icon', value: 'VGN' }, { field_id: 'menu_type', value: 'WORLDWIDE' }],
            screens: [{ location: 'Deutz - Ausgabe 1', screen_group_name: 'Mensa Deutz' }]
          },
          {
            name_de: 'Dessert vegan',
            price: 0.80,
            category: { name_de: 'Dessert' },
            custom_fields: [{ field_id: 'menu_type', value: 'dessert' }],
            screens: [{ location: 'Deutz - Ausgabe 1', screen_group_name: 'Mensa Deutz' }]
          }
        ]
      },
      {
        date: '2026-10-12', // Monday of week 2
        dishes: [
          {
            name_de: 'Penne Rigate mit Tomatensauce',
            price: 3.20,
            custom_fields: [{ field_id: 'food_icon', value: 'V' }, { field_id: 'menu_type', value: 'MEISTERWERK' }],
            screens: [{ location: 'MZS - MG Nord (Ausgabe 1)', screen_group_name: 'Mensa Zülpicher Straße' }]
          }
        ]
      }
    ];

    it('filters out desserts, side dishes, and buffets by default when category is main', () => {
      const stats = computeLiveMenuStats(complexMenuData, { category: 'main' });
      // Only 3 mains across the dataset: 2x Kichererbseneintopf, 1x No Butter Chicken, 1x Penne = 4 mains total
      expect(stats.totalDishes).toBe(4);
      expect(stats.topDishes.map(d => d.name)).toEqual([
        'Marokkanischer Kichererbseneintopf',
        'No Butter Chicken',
        'Penne Rigate mit Tomatensauce'
      ]);
      // Confirm Dessert and Pommes are NOT present
      expect(stats.topDishes.find(d => d.name.toLowerCase().includes('dessert'))).toBeUndefined();
      expect(stats.topDishes.find(d => d.name.toLowerCase().includes('pommes'))).toBeUndefined();
      expect(stats.topDishes.find(d => d.name.toLowerCase().includes('salatbuffet'))).toBeUndefined();
    });

    it('correctly filters for desserts when category is dessert', () => {
      const stats = computeLiveMenuStats(complexMenuData, { category: 'dessert' });
      expect(stats.totalDishes).toBe(2);
      expect(stats.topDishes[0].clean).toBe('dessert');
      expect(stats.topDishes[0].count).toBe(2);
    });

    it('filters by timeframe (this week vs all)', () => {
      const weekStats = computeLiveMenuStats(complexMenuData, {
        category: 'main',
        timeframe: 'week',
        todayIso: '2026-10-05'
      });
      // Week 1 has only the 2026-10-05 and 2026-10-06 entries (3 mains)
      expect(weekStats.totalDishes).toBe(3);
      expect(weekStats.timeframe.activeDaysCount).toBe(2);
      expect(weekStats.timeframe.formattedRange).toBe('05.10. – 06.10.2026');

      const allStats = computeLiveMenuStats(complexMenuData, {
        category: 'main',
        timeframe: 'all',
        todayIso: '2026-10-05'
      });
      // All loaded days include week 2 (4 mains)
      expect(allStats.totalDishes).toBe(4);
      expect(allStats.timeframe.activeDaysCount).toBe(3);
      expect(allStats.timeframe.formattedRange).toBe('05.10. – 12.10.2026');
    });

    it('matches user favorites and marks active counts', () => {
      const stats = computeLiveMenuStats(complexMenuData, {
        category: 'main',
        favorites: ['no butter chicken']
      });
      expect(stats.activeFavoritesCount).toBe(1);
      expect(stats.matchedFavorites[0].clean).toBe('no butter chicken');
      expect(stats.matchedFavorites[0].dates).toEqual(['2026-10-06']);
    });

    it('provides expandable allDishes array with ranks and date occurrences', () => {
      const stats = computeLiveMenuStats(complexMenuData, { category: 'main' });
      expect(stats.allDishes.length).toBe(3);
      expect(stats.allDishes[0].rank).toBe(1);
      expect(stats.allDishes[0].count).toBe(2);
      expect(stats.allDishes[0].dates).toEqual(['2026-10-05', '2026-10-06']);
    });

    it('computes All-Time statistics accurately from pre-aggregated dataset with scoping', () => {
      const mockAllTimeData = {
        startDate: '2026-01-22',
        endDate: '2026-10-27',
        openingDaysCount: 204,
        dishes: [
          {
            name: 'Currywurst',
            clean: 'currywurst',
            count: 133,
            diet: 'all',
            price: 3.25,
            category: 'main',
            canteens: { unimensa: 38, 'iwz-deutz': 25 }
          },
          {
            name: 'Schnitzel',
            clean: 'schnitzel',
            count: 110,
            diet: 'vegan',
            price: 3.05,
            category: 'main',
            canteens: { unimensa: 50, 'iwz-deutz': 20 }
          },
          {
            name: 'Pommes frites',
            clean: 'pommes frites',
            count: 250,
            diet: 'vegan',
            price: 1.10,
            category: 'side',
            canteens: { unimensa: 100 }
          }
        ]
      };

      // 1. All-Time across all canteens for main dishes
      const allMains = computeLiveMenuStats([], {
        timeframe: 'all-time',
        allTimeData: mockAllTimeData,
        category: 'main',
        canteenScope: 'all'
      });
      expect(allMains.timeframe.mode).toBe('all-time');
      expect(allMains.timeframe.activeDaysCount).toBe(204);
      expect(allMains.totalDishes).toBe(243); // 133 + 110 (Pommes excluded)
      expect(allMains.topDishes[0].name).toBe('Currywurst');
      expect(allMains.topDishes[0].count).toBe(133);
      expect(allMains.topDishes[1].name).toBe('Schnitzel');
      expect(allMains.topDishes[1].count).toBe(110);

      // 2. All-Time scoped to UniMensa only
      const uniMensaMains = computeLiveMenuStats([], {
        timeframe: 'all-time',
        allTimeData: mockAllTimeData,
        category: 'main',
        canteenScope: 'selected',
        selectedCanteens: ['unimensa']
      });
      expect(uniMensaMains.totalDishes).toBe(88); // 38 Currywurst + 50 Schnitzel
      expect(uniMensaMains.topDishes[0].name).toBe('Schnitzel'); // 50 in UniMensa > 38
      expect(uniMensaMains.topDishes[0].count).toBe(50);
      expect(uniMensaMains.topDishes[1].name).toBe('Currywurst');
      expect(uniMensaMains.topDishes[1].count).toBe(38);
    });
  });
});
