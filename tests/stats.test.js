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
});
