import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Supabase config safely via regex
const configPath = path.join(__dirname, '../data/config.js');
const src = fs.readFileSync(configPath, 'utf8');
const urlMatch = src.match(/url:\s*["']([^"']+)["']/);
const keyMatch = src.match(/apiKey:\s*["']([^"']+)["']/);
const orgMatch = src.match(/orgId:\s*["']([^"']+)["']/);

if (!urlMatch || !keyMatch || !orgMatch) {
  throw new Error('Failed to parse SUPABASE_CONFIG from data/config.js');
}

const cfg = {
  url: urlMatch[1],
  apiKey: keyMatch[1],
  orgId: orgMatch[1]
};

import { CANTEENS } from '../data/canteens.js';
import { findCanteensForDish } from '../src/lib/canteen-match.js';
import { getDishDietType } from '../src/lib/diet.js';
import {
  getCustomFields,
  getDishPrice,
  cleanDishNameForFavorite,
  classifyDish,
  stripAllergenCodes,
  cleanDPName,
  detectIncludedSides,
  SIDE_PRICES_BY_TARIFF
} from '../src/lib/dish.js';

async function fetchInterval(start, end) {
  const res = await fetch(`${cfg.url}/rest/v1/rpc/public_get_week_menu`, {
    method: 'POST',
    headers: {
      apikey: cfg.apiKey,
      authorization: `Bearer ${cfg.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      p_organization_id: cfg.orgId,
      p_start_date: start,
      p_end_date: end
    })
  });
  if (!res.ok) {
    throw new Error(`Error fetching ${start}..${end}: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function generateAllTimeStats() {
  const outputPath = path.join(__dirname, '../data/stats_all_time.json');
  console.log('Fetching historical menus month by month from Supabase...');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const intervals = [];
  for (let year = 2026; year <= currentYear; year++) {
    const endMonth = year === currentYear ? currentMonth : 12;
    for (let month = 1; month <= endMonth; month++) {
      if (year === 2026 && month === 1) {
        // Database starts around 2026-01-20
        intervals.push(['2026-01-20', '2026-01-31']);
      } else {
        const lastDay = new Date(year, month, 0).getDate();
        const mm = String(month).padStart(2, '0');
        const dd = String(lastDay).padStart(2, '0');
        intervals.push([`${year}-${mm}-01`, `${year}-${mm}-${dd}`]);
      }
    }
  }

  const dayMap = new Map();
  for (const [s, e] of intervals) {
    const days = await fetchInterval(s, e);
    if (Array.isArray(days)) {
      for (const day of days) {
        if (day && day.date) {
          dayMap.set(day.date, day);
        }
      }
    }
  }
  const allDays = Array.from(dayMap.values());

  const datesWithMeals = new Set();
  const dishMap = {};
  let totalDishes = 0;

  allDays.forEach(day => {
    if (!day || !Array.isArray(day.dishes) || day.dishes.length === 0) return;
    datesWithMeals.add(day.date);

    day.dishes.forEach(dish => {
      if (!dish) return;
      totalDishes++;
      const cls = classifyDish(dish);
      const clean = cleanDishNameForFavorite(dish);
      if (!clean) return;

      const diet = getDishDietType(dish);

      if (!dishMap[clean]) {
        let name = stripAllergenCodes(dish.name_de || dish.name_en || '');
        name = cleanDPName(name).replace(/\s+/g, ' ').trim();
        if (!name) name = clean;
        name = name.charAt(0).toUpperCase() + name.slice(1);

        dishMap[clean] = {
          name,
          clean,
          category: cls,
          diet,
          priceStudent: getDishPrice(dish, 'student'),
          priceEmployee: getDishPrice(dish, 'employee'),
          priceGuest: getDishPrice(dish, 'guest'),
          totalCount: 0,
          canteens: {},
          firstSeen: day.date,
          lastSeen: day.date
        };
      }

      dishMap[clean].totalCount++;
      dishMap[clean].lastSeen = day.date;
      const studentPrice = getDishPrice(dish, 'student');
      if (studentPrice > 0) {
        dishMap[clean].priceStudent = studentPrice;
      }
      const employeePrice = getDishPrice(dish, 'employee');
      if (employeePrice > 0) {
        dishMap[clean].priceEmployee = employeePrice;
      }
      const guestPrice = getDishPrice(dish, 'guest');
      if (guestPrice > 0) {
        dishMap[clean].priceGuest = guestPrice;
      }

      // Record which canteens it appeared at (without double-counting Lindenthal on unimensa)
      const cf = getCustomFields(dish);
      const dishOrtId = (cf['ort_id'] || '').trim();
      const dishLocation = (cf['location'] || '').trim().toLowerCase();
      let matchedCanteens = findCanteensForDish(dish, CANTEENS);
      if (
        matchedCanteens.includes('unimensa') &&
        matchedCanteens.includes('robertkoch') &&
        (dishOrtId === '231' || dishLocation === 'mensa lindenthal')
      ) {
        matchedCanteens = ['robertkoch'];
      }
      matchedCanteens.forEach(cKey => {
        dishMap[clean].canteens[cKey] = (dishMap[clean].canteens[cKey] || 0) + 1;
      });
    });
  });

  const sortedDates = Array.from(datesWithMeals).sort();
  const startDate = sortedDates[0] || '2026-01-22';
  const endDate = sortedDates[sortedDates.length - 1] || '2026-10-27';

  // Compute monthly price history per diet and tariff (raw vs normalized)
  const monthBuckets = {};

  allDays.forEach(day => {
    if (!day || !Array.isArray(day.dishes) || !day.date) return;
    const monthKey = day.date.slice(0, 7);
    if (!monthBuckets[monthKey]) {
      monthBuckets[monthKey] = {
        month: monthKey,
        student: { vegan: [], veg: [], meat: [], normVegan: [], normVeg: [], normMeat: [] },
        employee: { vegan: [], veg: [], meat: [], normVegan: [], normVeg: [], normMeat: [] },
        guest: { vegan: [], veg: [], meat: [], normVegan: [], normVeg: [], normMeat: [] }
      };
    }

    day.dishes.forEach(dish => {
      const cls = classifyDish(dish);
      if (cls !== 'main' && cls !== 'meisterwerk') return;

      const diet = getDishDietType(dish);
      const dietKey = diet === 'vegan' ? 'vegan' : (diet === 'vegetarian' ? 'veg' : 'meat');
      const normDietKey = diet === 'vegan' ? 'normVegan' : (diet === 'vegetarian' ? 'normVeg' : 'normMeat');
      const incSides = detectIncludedSides(dish, day.date);
      const missingSides = Math.max(0, 2 - incSides);

      ['student', 'employee', 'guest'].forEach(tariff => {
        const rawP = getDishPrice(dish, tariff);
        if (rawP != null && rawP > 0) {
          const sideCost = SIDE_PRICES_BY_TARIFF[tariff] || 0.70;
          const normP = Math.round((rawP + missingSides * sideCost) * 100) / 100;
          monthBuckets[monthKey][tariff][dietKey].push(rawP);
          monthBuckets[monthKey][tariff][normDietKey].push(normP);
        }
      });
    });
  });

  const avg = arr => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;

  const shortMonthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const monthLabels = {};
  Object.keys(monthBuckets).forEach(mKey => {
    const [year, monthStr] = mKey.split('-');
    const baseName = shortMonthNames[parseInt(monthStr, 10) - 1] || mKey;
    monthLabels[mKey] = year !== '2026' ? `${baseName} ${year.slice(2)}` : baseName;
  });

  const monthlyPriceHistory = Object.keys(monthBuckets).sort().map(mKey => {
    const b = monthBuckets[mKey];
    return {
      month: mKey,
      label: monthLabels[mKey] || mKey,
      tariffs: {
        student: {
          raw: {
            vegan: avg(b.student.vegan),
            vegetarian: avg(b.student.veg),
            meat: avg(b.student.meat)
          },
          normalized: {
            vegan: avg(b.student.normVegan),
            vegetarian: avg(b.student.normVeg),
            meat: avg(b.student.normMeat)
          },
          counts: {
            vegan: b.student.vegan.length,
            vegetarian: b.student.veg.length,
            meat: b.student.meat.length
          }
        },
        employee: {
          raw: {
            vegan: avg(b.employee.vegan),
            vegetarian: avg(b.employee.veg),
            meat: avg(b.employee.meat)
          },
          normalized: {
            vegan: avg(b.employee.normVegan),
            vegetarian: avg(b.employee.normVeg),
            meat: avg(b.employee.normMeat)
          },
          counts: {
            vegan: b.employee.vegan.length,
            vegetarian: b.employee.veg.length,
            meat: b.employee.meat.length
          }
        },
        guest: {
          raw: {
            vegan: avg(b.guest.vegan),
            vegetarian: avg(b.guest.veg),
            meat: avg(b.guest.meat)
          },
          normalized: {
            vegan: avg(b.guest.normVegan),
            vegetarian: avg(b.guest.normVeg),
            meat: avg(b.guest.normMeat)
          },
          counts: {
            vegan: b.guest.vegan.length,
            vegetarian: b.guest.veg.length,
            meat: b.guest.meat.length
          }
        }
      }
    };
  });

  const dishesList = Object.values(dishMap)
    .sort((a, b) => b.totalCount - a.totalCount)
    .map(d => ({
      name: d.name,
      clean: d.clean,
      count: d.totalCount,
      diet: d.diet,
      price: d.priceStudent,
      priceEmployee: d.priceEmployee,
      priceGuest: d.priceGuest,
      category: d.category,
      canteens: d.canteens,
      firstSeen: d.firstSeen,
      lastSeen: d.lastSeen
    }));

  const payload = {
    generatedAt: new Date().toISOString(),
    startDate,
    endDate,
    openingDaysCount: datesWithMeals.size,
    totalDishes,
    dishesCount: dishesList.length,
    monthlyPriceHistory,
    dishes: dishesList
  };

  if (fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      const { generatedAt: _a, ...restNew } = payload;
      const { generatedAt: _b, ...restOld } = existing;
      if (JSON.stringify(restNew) === JSON.stringify(restOld)) {
        console.log('All-time stats unchanged, skipping file write to prevent git noise.');
        return existing;
      }
    } catch {
      // Ignore parse errors on existing file and overwrite
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(payload), 'utf8');
  const sizeKb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
  console.log(`Saved ${outputPath} (${sizeKb} KB, ${dishesList.length} unique dishes, ${datesWithMeals.size} opening days, ${monthlyPriceHistory.length} months history).`);
  return payload;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAllTimeStats().catch(err => {
    console.error('Failed to generate all-time stats:', err);
    process.exit(1);
  });
}
