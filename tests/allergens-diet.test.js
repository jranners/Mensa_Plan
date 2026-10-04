import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ALLERGEN_GROUPS,
  isValidAllergenCode,
  parseDishAllergens,
  getDishAllergens,
  evaluateDishAllergies,
  shouldExcludeDish
} from '../src/lib/allergens.js';
import { getDishDietType } from '../src/lib/diet.js';
import { getCustomFields, stripAllergenCodes, cleanDPName, isPureDessert } from '../src/lib/dish.js';

describe('isValidAllergenCode', () => {
  it('accepts valid allergen codes and subcodes', () => {
    expect(isValidAllergenCode('11')).toBe(true);
    expect(isValidAllergenCode('11w')).toBe(true);
    expect(isValidAllergenCode('11a')).toBe(true);
    expect(isValidAllergenCode('11g')).toBe(true);
    expect(isValidAllergenCode('13')).toBe(true);
    expect(isValidAllergenCode('19pi')).toBe(true);
    expect(isValidAllergenCode('19mac')).toBe(true);
    expect(isValidAllergenCode('27')).toBe(true);
    expect(isValidAllergenCode('32')).toBe(true);
  });

  it('rejects gram units and invalid codes', () => {
    expect(isValidAllergenCode('3g')).toBe(false);
    expect(isValidAllergenCode('5g')).toBe(false);
    expect(isValidAllergenCode('10g')).toBe(false);
    expect(isValidAllergenCode('15g')).toBe(false);
    expect(isValidAllergenCode('20g')).toBe(false);
    expect(isValidAllergenCode('25g')).toBe(false);
    expect(isValidAllergenCode('')).toBe(false);
    expect(isValidAllergenCode(null)).toBe(false);
    expect(isValidAllergenCode('abc')).toBe(false);
    expect(isValidAllergenCode('99')).toBe(false);
  });
});

describe('getDishDietType', () => {
  it('correctly detects vegan from uppercase, lowercase and mixed tokens', () => {
    expect(getDishDietType({ custom_fields: [{ field_id: 'food_icon', value: 'VGN' }] })).toBe('vegan');
    expect(getDishDietType({ custom_fields: [{ field_id: 'food_icon', value: 'vgn' }] })).toBe('vegan');
    expect(getDishDietType({ custom_fields: [{ field_id: 'food_icon', value: 'vgt,Vgn' }] })).toBe('vegan');
  });

  it('correctly detects vegetarian from VGT and V', () => {
    expect(getDishDietType({ custom_fields: [{ field_id: 'food_icon', value: 'VGT' }] })).toBe('vegetarian');
    expect(getDishDietType({ custom_fields: [{ field_id: 'food_icon', value: 'vgt' }] })).toBe('vegetarian');
    expect(getDishDietType({ custom_fields: [{ field_id: 'food_icon', value: 'V' }] })).toBe('vegetarian');
  });

  it('detects diet from menu_type and dish name fallbacks', () => {
    expect(getDishDietType({ name_de: 'Falafel (vegan)', custom_fields: [] })).toBe('vegan');
    expect(getDishDietType({ name_de: 'Käsespätzle (vegetarisch)', custom_fields: [] })).toBe('vegetarian');
    expect(getDishDietType({ custom_fields: [{ field_id: 'menu_type', value: 'QUERBEET VEGAN ST' }] })).toBe('vegan');
    expect(getDishDietType({ name_de: 'Rindergulasch', custom_fields: [] })).toBe('all');
  });
});

describe('Dish Helper Utilities', () => {
  it('getCustomFields extracts all fields properly', () => {
    const dish = {
      custom_fields: [
        { field_id: 'food_icon', value: 'VGN' },
        { field_id: 'price_2', value: '1,10' }
      ]
    };
    const cf = getCustomFields(dish);
    expect(cf.food_icon).toBe('VGN');
    expect(cf.price_2).toBe('1,10');
    expect(cf.non_existent).toBeUndefined();
  });

  it('stripAllergenCodes removes parenthesis codes', () => {
    expect(stripAllergenCodes('Beilagensalat (13, 20, 21)')).toBe('Beilagensalat');
    expect(stripAllergenCodes('Pommes frites')).toBe('Pommes frites');
  });

  it('cleanDPName cleans suffixes', () => {
    expect(cleanDPName('Salzkartoffeln frisch Vegan')).toBe('Salzkartoffeln frisch');
    expect(cleanDPName('Currywurst TK Abendessen')).toBe('Currywurst');
  });

  it('isPureDessert identifies standalone dessert dishes', () => {
    expect(isPureDessert({ name_de: 'Dessert vegan', custom_fields: [] })).toBe(true);
    expect(isPureDessert({ name_de: 'Schokoladenpudding', category: { name_de: 'Dessert' } })).toBe(true);
    expect(isPureDessert({ name_de: 'Veganes Jambalaya', custom_fields: [] })).toBe(false);
  });
});

describe('Allergen Parsing and Safety Model', () => {
  it('NEVER excludes dishes without allergen declarations (AGENTS.md rule)', () => {
    const dishNoInfo = {
      id: 'dish-no-info',
      name_de: 'Frisches Obst',
      custom_fields: [
        { field_id: 'allergens_numbers', value: '' }
      ]
    };

    const evaluation = evaluateDishAllergies(dishNoInfo, ['gluten', 'eggs', 'milk']);
    expect(evaluation.hasNoInfo).toBe(true);
    expect(evaluation.shouldExclude).toBe(false);
    expect(shouldExcludeDish(dishNoInfo, ['gluten', 'eggs', 'milk'])).toBe(false);
  });

  it('detects diet contradictions and protects allergic users (e.g. egg in vegan dish)', () => {
    // Like Beilagensalat in RPC sample: food_icon=VGN, but allergens_numbers contains 13 (egg)
    const veganDishWithEgg = {
      id: 'dish-salad',
      name_de: 'Beilagensalat',
      custom_fields: [
        { field_id: 'food_icon', value: 'VGN' },
        { field_id: 'allergens_numbers', value: '13, 20, 21' },
        { field_id: 'dish_ger_1', value: 'Beilagensalat (13, 20, 21)' }
      ]
    };

    const parsed = parseDishAllergens(veganDishWithEgg);
    expect(parsed.dietConflict).not.toBeNull();
    expect(parsed.dietConflict.type).toBe('vegan_with_non_vegan_allergen');
    expect(parsed.dietConflict.codes).toContain('13');

    // CRITICAL: An egg-allergic user MUST have this dish excluded!
    expect(shouldExcludeDish(veganDishWithEgg, ['eggs'])).toBe(true);

    // A milk-allergic user does not have it excluded
    expect(shouldExcludeDish(veganDishWithEgg, ['milk'])).toBe(false);
  });

  it('handles combo dishes with generic dessert pool components correctly', () => {
    // Combo meal: Main dish is vegan jambalaya with soy (16).
    // It comes with a generic dessert side that has milk (17, 18), gluten (11h, 11w) and gelatin (27).
    const comboDish = {
      id: 'dish-combo',
      name_de: 'Veganes Jambalaya',
      custom_fields: [
        { field_id: 'food_icon', value: 'VGN' },
        { field_id: 'allergens_numbers', value: '1, 3, 11h, 11w, 16, 17, 18, 20, 27' },
        { field_id: 'dish_ger_1', value: 'Veganes Jambalaya (16)' },
        { field_id: 'dish_ger_2', value: 'Salat' },
        { field_id: 'dish_ger_3', value: 'Dessert (1,3,11h,11w,17,18,27)' }
      ]
    };

    const parsed = parseDishAllergens(comboDish);
    expect(parsed.mainCodes).toContain('16');
    expect(parsed.dessertOnlyCodes).toContain('17');
    expect(parsed.dessertOnlyCodes).toContain('18');
    expect(parsed.dessertOnlyCodes).toContain('27');

    // Soy filter: directly in main dish -> MUST exclude
    const evalSoy = evaluateDishAllergies(comboDish, ['soy']);
    expect(evalSoy.shouldExclude).toBe(true);
    expect(evalSoy.excludedBy).toContain('soy');

    // Milk filter: only in dessert side -> do NOT exclude main meal, but mark as uncertainBy
    const evalMilk = evaluateDishAllergies(comboDish, ['milk']);
    expect(evalMilk.shouldExclude).toBe(false);
    expect(evalMilk.uncertainBy).toContain('milk');
  });

  it('uses WeakMap cache for consecutive evaluations', () => {
    const dish = {
      id: 'cache-test',
      name_de: 'Pommes frites (11)',
      custom_fields: [{ field_id: 'allergens_numbers', value: '11' }]
    };
    const res1 = parseDishAllergens(dish);
    const res2 = parseDishAllergens(dish);
    expect(res1).toBe(res2); // Same object reference from cache
  });
});

describe('Integration with real RPC sample data (docs/rpc-sample.json)', () => {
  const rawSample = readFileSync(resolve(__dirname, '../docs/rpc-sample.json'), 'utf8');
  const weekData = JSON.parse(rawSample);
  const allDishes = weekData.flatMap(day => day.dishes);

  it('sample contains 232 dishes across 6 days', () => {
    expect(allDishes.length).toBe(232);
  });

  it('reliably excludes all 25 dishes officially containing eggs when eggs filter is active', () => {
    const eggDishes = allDishes.filter(d => {
      const cf = getCustomFields(d);
      const nums = (cf.allergens_numbers || '').split(',').map(s => s.trim().toLowerCase());
      return nums.includes('13');
    });

    expect(eggDishes.length).toBe(25);

    // Every single dish officially containing eggs must be excluded for an egg-allergic person!
    eggDishes.forEach(dish => {
      const evaluation = evaluateDishAllergies(dish, ['eggs']);
      expect(evaluation.shouldExclude).toBe(true);
    });
  });

  it('never excludes dishes with missing allergen information', () => {
    const noInfoDishes = allDishes.filter(d => !parseDishAllergens(d).hasAllergenInfo);

    expect(noInfoDishes.length).toBeGreaterThan(50);

    noInfoDishes.forEach(dish => {
      const evaluation = evaluateDishAllergies(dish, ['gluten', 'milk', 'eggs', 'nuts', 'soy']);
      expect(evaluation.hasNoInfo).toBe(true);
      expect(evaluation.shouldExclude).toBe(false);
    });
  });
});
