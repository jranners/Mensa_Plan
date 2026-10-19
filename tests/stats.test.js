import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  STATS_KEY,
  getInitialStats,
  loadSavedStats,
  saveStats,
  aggregateMenuStats,
  computeLiveMenuStats,
  computeLivePriceHistory,
  generatePriceChartSvg,
  computeFavoritesRadar
} from '../src/lib/stats.js';
import { detectIncludedSides } from '../src/lib/dish.js';

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

    it('correctly detects included sides before and after September 2026 transition', () => {
      // 1. Explicit in title
      expect(detectIncludedSides({ name_de: 'Bratwurst + 1 Beilage' }, '2026-10-05')).toBe(1);
      expect(detectIncludedSides({ name_de: 'Butter Chicken mit 2 Beilagen' }, '2026-10-05')).toBe(2);
      expect(detectIncludedSides({ name_de: 'Curry inkl. 2 Beilagen' }, '2026-03-01')).toBe(2);

      // 2. Pre-September 2026 (old system with bundled meals)
      expect(detectIncludedSides({ name_de: 'Blumenkohlschnitzel' }, '2026-04-15')).toBe(2);
      expect(detectIncludedSides({ name_de: 'Kartoffel-Gemüseeintopf' }, '2026-04-15')).toBe(0); // Soups/stews had 0

      // 3. Post-September 2026 (modular system)
      expect(detectIncludedSides({ name_de: 'Blumenkohlschnitzel' }, '2026-10-05')).toBe(0);
      expect(detectIncludedSides({ name_de: 'Kartoffel-Gemüseeintopf' }, '2026-10-05')).toBe(0);
    });

    it('computes live price history with normalized and raw values', () => {
      const history = computeLivePriceHistory(complexMenuData, 'student');
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      const firstPoint = history[0];
      expect(firstPoint.tariffs.student).toBeDefined();
      expect(firstPoint.tariffs.student.raw).toBeDefined();
      expect(firstPoint.tariffs.student.normalized).toBeDefined();

      // On 2026-10-05: Kichererbseneintopf is a soup (0 sides) at 2.10€
      // Normalized price (+2 sides * 0.70€) should be 3.50€
      expect(firstPoint.tariffs.student.raw.vegan).toBe(2.1);
      expect(firstPoint.tariffs.student.normalized.vegan).toBe(3.5);
    });

    it('generates accessible, valid SVG price chart markup', () => {
      const sampleHistory = [
        {
          month: '2026-01',
          label: 'Jan',
          tariffs: {
            student: {
              raw: { vegan: 2.44, vegetarian: 3.24, meat: 3.86 },
              normalized: { vegan: 3.19, vegetarian: 3.56, meat: 3.86 },
              counts: { vegan: 83, vegetarian: 16, meat: 30 }
            }
          }
        },
        {
          month: '2026-09',
          label: 'Sep',
          tariffs: {
            student: {
              raw: { vegan: 2.19, vegetarian: 2.77, meat: 2.67 },
              normalized: { vegan: 3.59, vegetarian: 4.17, meat: 4.07 },
              counts: { vegan: 340, vegetarian: 64, meat: 139 }
            }
          }
        },
        {
          month: '2026-10',
          label: 'Okt',
          tariffs: {
            student: {
              raw: { vegan: 1.89, vegetarian: 2.78, meat: 2.70 },
              normalized: { vegan: 3.27, vegetarian: 4.18, meat: 4.10 },
              counts: { vegan: 218, vegetarian: 70, meat: 102 }
            }
          }
        }
      ];

      // Normalized mode SVG
      const svgNorm = generatePriceChartSvg(sampleHistory, {
        tariff: 'student',
        mode: 'normalized',
        activeMonth: '2026-10'
      });
      expect(svgNorm).toContain('<svg');
      expect(svgNorm).toContain('</svg>');
      expect(svgNorm).toContain('⚡ Sep: Umstellung'); // System transition marker
      expect(svgNorm).toContain('#10b981'); // Vegan line/dots
      expect(svgNorm).toContain('#f59e0b'); // Vegetarian line/dots
      expect(svgNorm).toContain('#f43f5e'); // Meat line/dots
      expect(svgNorm).toContain('data-month="2026-10"');

      // Raw mode SVG
      const svgRaw = generatePriceChartSvg(sampleHistory, {
        tariff: 'student',
        mode: 'raw',
        lang: 'en'
      });
      expect(svgRaw).toContain('<svg');
      expect(svgRaw).toContain('role="group"');
      expect(svgRaw).toContain('r="4.5"');

      // Returns empty string for empty input
      expect(generatePriceChartSvg([])).toBe('');
    });

    it('scales all-time prices by tariff and computes live priceHistory for week/all timeframes', () => {
      const mockAllTimeData = {
        startDate: '2026-01-22',
        endDate: '2026-10-27',
        openingDaysCount: 100,
        priceHistory: [{ month: '2026-01', label: 'Jan', tariffs: {} }],
        dishes: [
          {
            name: 'Currywurst',
            clean: 'currywurst',
            count: 50,
            diet: 'all',
            price: 3.00,
            category: 'main',
            canteens: { unimensa: 50 }
          }
        ]
      };

      const empAllTime = computeLiveMenuStats([], {
        timeframe: 'all-time',
        allTimeData: mockAllTimeData,
        tariff: 'employee'
      });
      expect(empAllTime.avgPrice).toBe(4.26); // 3.00 * 1.42

      // When timeframe is 'week', priceHistory should be computed from live menuData, not allTimeData
      const weekWithAllTimeLoaded = computeLiveMenuStats(complexMenuData, {
        timeframe: 'week',
        todayIso: '2026-10-05',
        allTimeData: mockAllTimeData
      });
      expect(weekWithAllTimeLoaded.priceHistory.length).toBeGreaterThan(0);
      expect(weekWithAllTimeLoaded.priceHistory[0].month).toBe('2026-10-05');
    });

    it('computes non-zero main dish stats for eraum and unimensa from real docs/rpc-sample.json (Bug B-01)', () => {
      const samplePath = resolve(process.cwd(), 'docs/rpc-sample.json');
      const rpcDays = JSON.parse(readFileSync(samplePath, 'utf8'));

      const eraumStats = computeLiveMenuStats(rpcDays, {
        category: 'main',
        timeframe: 'all',
        canteenScope: 'selected',
        selectedCanteens: ['eraum']
      });
      expect(eraumStats.totalDishes).toBeGreaterThan(0);

      const unimensaStats = computeLiveMenuStats(rpcDays, {
        category: 'main',
        timeframe: 'all',
        canteenScope: 'selected',
        selectedCanteens: ['unimensa']
      });
      expect(unimensaStats.totalDishes).toBeGreaterThan(30);
    });

    it('computes Favorites Radar for upcoming hits and recurrence insights', () => {
      const mockAllTimeData = {
        openingDaysCount: 100,
        dishes: [
          {
            name: 'Currywurst',
            clean: 'currywurst',
            count: 25,
            diet: 'all',
            price: 3.25
          },
          {
            name: 'No Butter Chicken',
            clean: 'no butter chicken',
            count: 20,
            diet: 'vegan',
            price: 2.45
          }
        ]
      };

      const radar = computeFavoritesRadar(complexMenuData, mockAllTimeData, {
        favorites: ['no butter chicken', 'currywurst'],
        todayIso: '2026-10-05',
        tariff: 'student'
      });

      expect(radar.upcomingHits.length).toBe(1);
      expect(radar.upcomingHits[0].dishName).toBe('No Butter Chicken');
      expect(radar.upcomingHits[0].date).toBe('2026-10-06');

      expect(radar.recurrenceInsights.length).toBe(2);
      expect(radar.recurrenceInsights[0].dishName).toBe('Currywurst');
      expect(radar.recurrenceInsights[0].avgIntervalDays).toBe(4); // Math.round(100 / 25)
    });

    it('computes speciesCounts accurately for meat, fish, and welfare dishes', () => {
      const meatMenuData = [
        {
          date: '2026-10-05',
          dishes: [
            { name_de: 'Hähnchenschnitzel', price: 3.50, custom_fields: [{ field_id: 'food_icon', value: 'G' }] },
            { name_de: 'Rindergulasch', price: 4.20, custom_fields: [{ field_id: 'food_icon', value: 'R' }] },
            { name_de: 'Seelachsfilet', price: 3.80, custom_fields: [{ field_id: 'food_icon', value: 'F' }] },
            { name_de: 'Currywurst vom Schwein', price: 2.90, custom_fields: [{ field_id: 'food_icon', value: 'S' }] },
            { name_de: 'Bratwurst Artgerecht', price: 3.10, custom_fields: [{ field_id: 'food_icon', value: 'NL' }] }
          ]
        }
      ];
      const stats = computeLiveMenuStats(meatMenuData);
      expect(stats.speciesCounts.poultry).toBe(1);
      expect(stats.speciesCounts.beef).toBe(1);
      expect(stats.speciesCounts.fish).toBe(1);
      expect(stats.speciesCounts.pork).toBe(1);
      expect(stats.speciesCounts.neuland).toBe(1);
    });

    it('computes priceBuckets, cheapestDishes, and mostExpensiveDishes accurately', () => {
      const priceMenuData = [
        {
          date: '2026-10-05',
          dishes: [
            { name_de: 'Suppe', price: 1.50 },
            { name_de: 'Falafel-Bowl', price: 2.60 },
            { name_de: 'Pasta Pesto', price: 3.40 },
            { name_de: 'Steak', price: 4.90 }
          ]
        }
      ];
      const stats = computeLiveMenuStats(priceMenuData);
      expect(stats.priceBuckets.under2).toBe(1);
      expect(stats.priceBuckets.from2to3).toBe(1);
      expect(stats.priceBuckets.from3to4).toBe(1);
      expect(stats.priceBuckets.over4).toBe(1);
      expect(stats.cheapestDishes[0].name).toBe('Suppe');
      expect(stats.cheapestDishes[0].price).toBe(1.50);
      expect(stats.mostExpensiveDishes[0].name).toBe('Steak');
      expect(stats.mostExpensiveDishes[0].price).toBe(4.90);
    });

    it('computes personalMatch according to user diet and pork exclusion', () => {
      const mixedData = [
        {
          date: '2026-10-05',
          dishes: [
            { name_de: 'Vegane Suppe', price: 2.00, custom_fields: [{ field_id: 'food_icon', value: 'VGN' }] },
            { name_de: 'Käsebrot', price: 2.50, custom_fields: [{ field_id: 'food_icon', value: 'V' }] },
            { name_de: 'Currywurst Schwein', price: 3.50, custom_fields: [{ field_id: 'food_icon', value: 'S' }] }
          ]
        }
      ];
      const veganStats = computeLiveMenuStats(mixedData, { userDiet: 'vegan' });
      expect(veganStats.personalMatch.compatibleCount).toBe(1);
      expect(veganStats.personalMatch.compatiblePct).toBe(33);
      expect(veganStats.personalMatch.personalAvgPrice).toBe(2.00);

      const porkExcludeStats = computeLiveMenuStats(mixedData, { userDiet: 'all', excludePork: true });
      expect(porkExcludeStats.personalMatch.compatibleCount).toBe(2);
      expect(porkExcludeStats.personalMatch.compatiblePct).toBe(67);
    });

    it('computes weekdayBreakdown and canteenComparison metrics', () => {
      const stats = computeLiveMenuStats(complexMenuData, {
        canteenScope: 'all',
        category: 'main'
      });
      expect(stats.weekdayBreakdown).toHaveLength(5);
      const monday = stats.weekdayBreakdown.find(w => w.dow === 1);
      expect(monday.count).toBe(2); // 2026-10-05 and 2026-10-12
      expect(monday.avgPrice).toBe(2.65); // (2.10 + 3.20) / 2
      expect(monday.veganPct).toBe(50); // 1 vegan out of 2

      expect(stats.canteenComparison.length).toBeGreaterThan(0);
      const unimensa = stats.canteenComparison.find(c => c.key === 'unimensa');
      expect(unimensa).toBeDefined();
      expect(unimensa.totalDishes).toBeGreaterThan(0);
    });

    it('correctly filters for a specific canteen key in canteenScope', () => {
      const unimensaOnly = computeLiveMenuStats(complexMenuData, {
        canteenScope: 'unimensa',
        category: 'main'
      });
      expect(unimensaOnly.totalDishes).toBe(3);
      expect(unimensaOnly.topDishes.some(d => d.name === 'No Butter Chicken')).toBe(false);

      const deutzOnly = computeLiveMenuStats(complexMenuData, {
        canteenScope: 'iwz-deutz',
        category: 'main'
      });
      expect(deutzOnly.totalDishes).toBe(1);
      expect(deutzOnly.topDishes[0].name).toBe('No Butter Chicken');
    });

    it('renders interactive chart dots with data-action, data-month, data-diet, and highlights active points', () => {
      const samplePriceHistory = [
        {
          month: '2026-05',
          label: 'Mai',
          tariffs: {
            student: {
              raw: { vegan: 2.50, vegetarian: 2.80, meat: 3.50 },
              normalized: { vegan: 3.20, vegetarian: 3.50, meat: 4.20 }
            }
          }
        },
        {
          month: '2026-06',
          label: 'Jun',
          tariffs: {
            student: {
              raw: { vegan: 2.60, vegetarian: 2.90, meat: 3.60 },
              normalized: { vegan: 3.30, vegetarian: 3.60, meat: 4.30 }
            }
          }
        }
      ];

      const svgNormal = generatePriceChartSvg(samplePriceHistory, {
        mode: 'normalized',
        tariff: 'student'
      });
      expect(svgNormal).toContain('data-action="stats-chart-point"');
      expect(svgNormal).toContain('data-month="2026-05"');
      expect(svgNormal).toContain('data-diet="vegan"');
      expect(svgNormal).toContain('r="4.5"');

      const svgSelected = generatePriceChartSvg(samplePriceHistory, {
        mode: 'normalized',
        tariff: 'student',
        selectedPoint: { month: '2026-05', diet: 'vegan' }
      });
      expect(svgSelected).toContain('r="6.5"');
      expect(svgSelected).toContain('stroke-width="2.5"');
    });
  });
});

