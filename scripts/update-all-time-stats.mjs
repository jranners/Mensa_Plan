import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Supabase config
const configPath = path.join(__dirname, '../data/config.js');
const src = fs.readFileSync(configPath, 'utf8');
const cfg = new Function(src + '; return SUPABASE_CONFIG;')();

import { CANTEENS } from '../data/canteens.js';
import { getCanteenKeyFromDish } from '../src/lib/canteen-match.js';
import { getDishDietType } from '../src/lib/diet.js';
import {
  getDishPrice,
  cleanDishNameForFavorite,
  classifyDish,
  stripAllergenCodes,
  cleanDPName
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
    console.error(`Error fetching ${start}..${end}: HTTP ${res.status}`);
    return [];
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
  // Database starts around 2026-01-20
  intervals.push(['2026-01-20', '2026-01-31']);

  for (let m = 2; m <= currentMonth; m++) {
    const startStr = `${currentYear}-${String(m).padStart(2, '0')}-01`;
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? currentYear + 1 : currentYear;
    // For current month, query up to end of next week (or month end)
    const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    intervals.push([startStr, endStr]);
  }

  const allDays = [];
  for (const [s, e] of intervals) {
    const days = await fetchInterval(s, e);
    allDays.push(...days);
  }

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
          totalCount: 0,
          canteens: {},
          firstSeen: day.date,
          lastSeen: day.date
        };
      }

      dishMap[clean].totalCount++;
      dishMap[clean].lastSeen = day.date;
      const studentPrice = getDishPrice(dish, 'student');
      if (!dishMap[clean].priceStudent && studentPrice) {
        dishMap[clean].priceStudent = studentPrice;
      }

      // Record which canteens it appeared at
      Object.keys(CANTEENS).forEach(cKey => {
        if (getCanteenKeyFromDish(dish, cKey, CANTEENS[cKey])) {
          dishMap[clean].canteens[cKey] = (dishMap[clean].canteens[cKey] || 0) + 1;
        }
      });
    });
  });

  const sortedDates = Array.from(datesWithMeals).sort();
  const startDate = sortedDates[0] || '2026-01-22';
  const endDate = sortedDates[sortedDates.length - 1] || '2026-10-27';

  const dishesList = Object.values(dishMap)
    .sort((a, b) => b.totalCount - a.totalCount)
    .map(d => ({
      name: d.name,
      clean: d.clean,
      count: d.totalCount,
      diet: d.diet,
      price: d.priceStudent,
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
    dishes: dishesList
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload), 'utf8');
  const sizeKb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1);
  console.log(`Saved ${outputPath} (${sizeKb} KB, ${dishesList.length} unique dishes, ${datesWithMeals.size} opening days).`);
  return payload;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAllTimeStats().catch(err => {
    console.error('Failed to generate all-time stats:', err);
    process.exit(1);
  });
}
