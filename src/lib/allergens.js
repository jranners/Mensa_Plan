import { getCustomFields, isPureDessert, isGenericDessertComponent } from './dish.js';
import { getDishDietType } from './diet.js';

export const ALLERGEN_GROUPS = {
  gluten: {
    de: "Gluten",
    en: "Gluten",
    codes: ["11", "11w", "11a", "11r", "11b", "11g", "11c", "11h", "11d", "11k"]
  },
  crustaceans: {
    de: "Krebstiere",
    en: "Crustaceans",
    codes: ["12"]
  },
  eggs: {
    de: "Eier",
    en: "Eggs",
    codes: ["13"]
  },
  fish: {
    de: "Fisch",
    en: "Fish",
    codes: ["14"]
  },
  peanuts: {
    de: "Erdnüsse",
    en: "Peanuts",
    codes: ["15"]
  },
  soy: {
    de: "Soja",
    en: "Soy",
    codes: ["16"]
  },
  milk: {
    de: "Milch & Laktose",
    en: "Milk & Lactose",
    codes: ["17", "18"]
  },
  nuts: {
    de: "Schalenfrüchte (Nüsse)",
    en: "Nuts (Tree nuts)",
    codes: ["19", "19a", "19m", "19b", "19h", "19c", "19d", "19w", "19e", "19p", "19pe", "19f", "19g", "19pi", "19mac"]
  },
  celery: {
    de: "Sellerie",
    en: "Celery",
    codes: ["20"]
  },
  mustard: {
    de: "Senf",
    en: "Mustard",
    codes: ["21"]
  },
  sesame: {
    de: "Sesamsamen",
    en: "Sesame",
    codes: ["22"]
  },
  sulfites: {
    de: "Sulfite / Schwefeldioxid",
    en: "Sulfites / Sulfur dioxide",
    codes: ["23", "5"]
  },
  lupins: {
    de: "Lupinen",
    en: "Lupins",
    codes: ["24"]
  },
  molluscs: {
    de: "Weichtiere",
    en: "Molluscs",
    codes: ["25"]
  },
  gelatin: {
    de: "Gelatine",
    en: "Gelatin",
    codes: ["27"]
  },
  alcohol: {
    de: "Alkohol",
    en: "Alcohol",
    codes: ["26", "32"]
  }
};

export const NON_VEGAN_CODES = ["12", "13", "14", "17", "18", "25", "27", "28", "29", "30"];
export const NON_VEG_CODES = ["12", "14", "25", "27", "28", "29", "30"];

const ALLERGEN_CODE_REGEX = /^(?:[1-9]|[12][0-9]|3[0-2])(?:[a-z]{1,3})?$/i;

/**
 * Validates whether a token is a legal allergen / additive code.
 * Rejects weight expressions like 3g, 5g, 10g, 20g (while accepting valid codes 11g, 19g).
 * @param {string} code
 * @returns {boolean}
 */
export function isValidAllergenCode(code) {
  if (!code || typeof code !== 'string') return false;
  const cleaned = code.trim();
  if (!ALLERGEN_CODE_REGEX.test(cleaned)) return false;
  const lower = cleaned.toLowerCase();
  if (lower.endsWith('g') && lower !== '11g' && lower !== '19g') return false;
  return true;
}

/**
 * Extracts allergen codes inside parentheses, e.g. "Blumenkohl (17, 18)" -> ["17", "18"]
 * @param {string} text
 * @returns {string[]}
 */
function extractCodesFromParentheses(text) {
  if (!text || typeof text !== 'string') return [];
  const codes = [];
  const matches = text.matchAll(/\(([^)]+)\)/g);
  for (const m of matches) {
    const parts = m[1].split(',');
    for (const p of parts) {
      const trimmed = p.trim();
      if (isValidAllergenCode(trimmed)) {
        codes.push(trimmed.toLowerCase());
      }
    }
  }
  return codes;
}

// WeakMap cache for parsed allergen data per dish instance
const dishAllergenCache = new WeakMap();

/**
 * Parses all allergen data from a dish into main codes, dessert-only codes,
 * and diet contradiction flags.
 *
 * @param {object} dish
 * @returns {{
 *   declaredCodes: string[],
 *   mainCodes: string[],
 *   dessertOnlyCodes: string[],
 *   hasAllergenInfo: boolean,
 *   dietConflict: { type: string, codes: string[] } | null
 * }}
 */
export function parseDishAllergens(dish) {
  if (!dish || typeof dish !== 'object') {
    return {
      declaredCodes: [],
      mainCodes: [],
      dessertOnlyCodes: [],
      hasAllergenInfo: false,
      dietConflict: null
    };
  }

  const cached = dishAllergenCache.get(dish);
  if (cached) return cached;

  const cf = getCustomFields(dish);
  const pureDessert = isPureDessert(dish);

  // 1) Official codes from allergens_numbers
  const officialCodesRaw = (cf.allergens_numbers || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
    .filter(isValidAllergenCode)
    .map(c => c.toLowerCase());

  // 2) Codes from dish names
  const nameCodes = [
    ...extractCodesFromParentheses(dish.name_de),
    ...extractCodesFromParentheses(dish.name_en)
  ];

  // 3) Codes from dish components (dish_ger_1 .. dish_ger_5)
  const mainCompCodes = [];
  const dessertCompCodes = [];
  let hasGenericDessertSide = false;

  for (let i = 1; i <= 5; i++) {
    const partDe = cf[`dish_ger_${i}`] || '';
    const partEn = cf[`dish_${i}_eng`] || '';
    const partText = partDe || partEn;
    if (!partText) continue;

    const isDessertComp = isGenericDessertComponent(partText, pureDessert);
    const codesInPart = [
      ...extractCodesFromParentheses(partDe),
      ...extractCodesFromParentheses(partEn)
    ];

    if (isDessertComp) {
      hasGenericDessertSide = true;
      dessertCompCodes.push(...codesInPart);
    } else {
      mainCompCodes.push(...codesInPart);
    }
  }

  // Set of all codes definitively in the main dish
  const mainCodesSet = new Set([...nameCodes, ...mainCompCodes]);

  // If there's a generic dessert component on a combo meal:
  // Identify codes that belong strictly to the dessert component
  const dessertOnlySet = new Set();
  if (hasGenericDessertSide && !pureDessert) {
    const DESSERT_POOL_CODES = ["1", "3", "11h", "11w", "17", "18", "27"];
    for (const dCode of dessertCompCodes) {
      if (!mainCodesSet.has(dCode)) {
        dessertOnlySet.add(dCode);
      }
    }
    // Also check official codes: if an official code is in the dessert pool
    // and was NOT found in main components, it originated from the dessert pool
    for (const offCode of officialCodesRaw) {
      if (DESSERT_POOL_CODES.includes(offCode) && !mainCodesSet.has(offCode) && dessertCompCodes.includes(offCode)) {
        dessertOnlySet.add(offCode);
      }
    }
  }

  // Now assemble mainCodes:
  // Include officialCodesRaw unless they are strictly dessert-only
  for (const offCode of officialCodesRaw) {
    if (!dessertOnlySet.has(offCode)) {
      mainCodesSet.add(offCode);
    }
  }

  // declaredCodes: all valid codes known for this dish (union)
  const declaredCodesSet = new Set([...officialCodesRaw, ...nameCodes, ...mainCompCodes, ...dessertCompCodes]);
  const declaredCodes = [...declaredCodesSet];

  // Determine if dish has any allergen information declared at all
  // Note: if declaredCodes is empty and allergens_numbers was omitted or empty, there is no info.
  const hasAllergenInfo = declaredCodes.length > 0;

  // Diet conflict check:
  // We NEVER discard official codes, but we flag contradictions as warnings
  const dietType = getDishDietType(dish);
  let dietConflict = null;
  if (dietType === 'vegan') {
    const badCodes = [...mainCodesSet].filter(c => NON_VEGAN_CODES.includes(c));
    if (badCodes.length > 0) {
      dietConflict = { type: 'vegan_with_non_vegan_allergen', codes: badCodes };
    }
  } else if (dietType === 'vegetarian') {
    const badCodes = [...mainCodesSet].filter(c => NON_VEG_CODES.includes(c));
    if (badCodes.length > 0) {
      dietConflict = { type: 'vegetarian_with_non_veg_allergen', codes: badCodes };
    }
  }

  const result = {
    declaredCodes,
    mainCodes: [...mainCodesSet],
    dessertOnlyCodes: [...dessertOnlySet],
    hasAllergenInfo,
    dietConflict
  };

  dishAllergenCache.set(dish, result);
  return result;
}

/**
 * Returns all declared allergen codes for a dish (used for modal details and badges).
 * @param {object} dish
 * @returns {string[]}
 */
export function getDishAllergens(dish) {
  return parseDishAllergens(dish).declaredCodes;
}

/**
 * Evaluates a dish against a list of selected allergy groups.
 *
 * @param {object} dish
 * @param {string[]} selectedAllergyGroups - e.g. ['milk', 'eggs']
 * @returns {{
 *   shouldExclude: boolean,
 *   excludedBy: string[],
 *   uncertainBy: string[],
 *   hasNoInfo: boolean,
 *   dietConflict: { type: string, codes: string[] } | null
 * }}
 */
export function evaluateDishAllergies(dish, selectedAllergyGroups = []) {
  if (!selectedAllergyGroups || selectedAllergyGroups.length === 0) {
    const parsed = parseDishAllergens(dish);
    return {
      shouldExclude: false,
      excludedBy: [],
      uncertainBy: [],
      hasNoInfo: !parsed.hasAllergenInfo,
      dietConflict: parsed.dietConflict
    };
  }

  const parsed = parseDishAllergens(dish);

  // If dish has NO allergen info declared at all:
  // Rule (CRITICAL): Dishes without allergen declarations must never be hidden/excluded.
  if (!parsed.hasAllergenInfo) {
    return {
      shouldExclude: false,
      excludedBy: [],
      uncertainBy: [],
      hasNoInfo: true,
      dietConflict: null
    };
  }

  const excludedBy = [];
  const uncertainBy = [];

  for (const groupKey of selectedAllergyGroups) {
    const group = ALLERGEN_GROUPS[groupKey];
    if (!group) continue;

    const groupCodes = group.codes.map(c => c.toLowerCase());
    const containsInMain = groupCodes.some(c => parsed.mainCodes.includes(c));

    if (containsInMain) {
      excludedBy.push(groupKey);
    } else {
      const containsInDessert = groupCodes.some(c => parsed.dessertOnlyCodes.includes(c));
      if (containsInDessert) {
        uncertainBy.push(groupKey);
      }
    }
  }

  return {
    shouldExclude: excludedBy.length > 0,
    excludedBy,
    uncertainBy,
    hasNoInfo: false,
    dietConflict: parsed.dietConflict
  };
}

/**
 * Determines whether a dish should be excluded from view based on active allergen filters.
 * - Positively contained in main dish -> excluded (true).
 * - Uncertain (dessert pool only) -> NOT excluded, warned (false).
 * - No allergen declarations -> NEVER excluded, warned (false).
 *
 * @param {object} dish
 * @param {string[]} selectedAllergyGroups
 * @returns {boolean}
 */
export function shouldExcludeDish(dish, selectedAllergyGroups) {
  return evaluateDishAllergies(dish, selectedAllergyGroups).shouldExclude;
}
