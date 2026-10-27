/**
 * Dish metadata utilities and field extraction
 */

/**
 * Extracts custom_fields from a dish object into a key-value dictionary.
 * @param {object} dish
 * @returns {Record<string, string>}
 */
export function getCustomFields(dish) {
  if (!dish || !Array.isArray(dish.custom_fields)) return {};
  const map = {};
  for (const field of dish.custom_fields) {
    const key = field && (field.field_id || field.name);
    if (key) {
      map[key] = field.value != null ? String(field.value) : '';
    }
  }
  return map;
}

/**
 * Strips allergen/additive codes in parentheses, e.g. "Salat (13, 20)" -> "Salat"
 * @param {string} text
 * @returns {string}
 */
export function stripAllergenCodes(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

const DP_NAME_SUFFIXES = /\s+(Abendessen|TK|Eigenproduktion|Eigenprodukt|Neu|trocken|Vegan|vegan)\s*$/gi;

/**
 * Cleans internal suffixes from CUSTOM_DPNAME
 * @param {string} raw
 * @returns {string}
 */
export function cleanDPName(raw) {
  if (typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(DP_NAME_SUFFIXES, '').trim();
  }
  return cleaned;
}

/**
 * Strips inline numeric allergen/additive codes in parentheses from dish names,
 * e.g. "Marokkanischer Kichererbseneintopf (1,2,3)" -> "Marokkanischer Kichererbseneintopf"
 * while preserving descriptive text in parentheses.
 * @param {string} text
 * @returns {string}
 */
export function stripInlineAllergenCodes(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\s*\(\s*\d+[a-z]{0,3}(?:\s*,\s*\d+[a-z]{0,3})*\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determines whether a dish is a standalone dessert (not a combo meal with dessert side).
 * @param {object} dish
 * @returns {boolean}
 */
export function isPureDessert(dish) {
  if (!dish) return false;
  const cf = getCustomFields(dish);
  if ((cf.food_icon || '').trim().toUpperCase() === 'D') return true;
  const catNameDe = (dish.category && dish.category.name_de) ? dish.category.name_de.toLowerCase() : '';
  const rawType = (cf.menu_type || '').toLowerCase();
  const dishNameDe = (dish.name_de || '').toLowerCase();

  return catNameDe.includes('dessert') ||
         catNameDe.includes('nachspeise') ||
         rawType.includes('dessert') ||
         /^(?:dessert|nachspeise)\b/i.test(dishNameDe.trim());
}

/**
 * Checks if a component string represents a generic dessert pool side (e.g. "Dessert (11h,11w,17,18,27)")
 * @param {string} partText
 * @param {boolean} isPureDessertDish
 * @returns {boolean}
 */
export function isGenericDessertComponent(partText, isPureDessertDish = false) {
  if (isPureDessertDish || typeof partText !== 'string') return false;
  const trimmed = partText.trim();
  return /^dessert\b/i.test(trimmed) || /(?:nachspeise|dessert)/i.test(trimmed);
}

/**
 * Checks if a dish is a soup, stew, or chili meal.
 * @param {object} dish
 * @returns {boolean}
 */
export function isSoupOrStew(dish) {
  if (!dish) return false;
  const customFields = getCustomFields(dish);
  const name = (dish.name_de || '').toLowerCase();
  const nameEn = (dish.name_en || '').toLowerCase();
  const dpName = (customFields['CUSTOM_DPNAME'] || '').toLowerCase();

  const soupKeywords = ['suppe', 'soup', 'eintopf', 'stew', 'brühe', 'bouillon', 'minestrone', 'feuertopf'];
  return soupKeywords.some(k => name.includes(k) || nameEn.includes(k) || dpName.includes(k));
}

/**
 * Classifies a dish into 'main', 'meisterwerk', 'side', 'dessert', or 'buffet'.
 * @param {object} dish
 * @returns {'main'|'meisterwerk'|'side'|'dessert'|'buffet'}
 */
export function classifyDish(dish) {
  if (!dish) return 'side';
  const customFields = getCustomFields(dish);

  const rawType = (customFields['menu_type'] || '').trim();
  const typeLower = rawType.toLowerCase();
  const catNameDe = (dish.category && dish.category.name_de) ? dish.category.name_de.toLowerCase() : '';
  const name = (dish.name_de || '').toLowerCase();
  const dpName = (customFields['CUSTOM_DPNAME'] || '').toLowerCase();
  const price = getDishPrice(dish, 'student') ?? 0;

  const hinweise = (customFields['hinweise'] || '').toLowerCase();

  // Buffet / Selbstbedienung (pay by weight / buffet counter / Pastatheke / Nudelbuffet)
  const isBuffet = !!customFields['preis_gramm'] ||
                   name.includes('salatbuffet') || dpName.includes('salatbuffet') ||
                   name.includes('beilagenbuffet') || dpName.includes('beilagenbuffet') ||
                   name.includes('nudelbuffet') || dpName.includes('nudelbuffet') || hinweise.includes('nudelbuffet') ||
                   name.includes('pasta theke') || name.includes('pastatheke') ||
                   name.includes('selbstbedienung') || dpName.includes('selbstbedienung');

  if (isBuffet) {
    return 'buffet';
  }

  // Soups & Stews are main dishes / social meals (e.g. Eintöpfe, Cremesuppen)
  const isSoup = isSoupOrStew(dish);

  // Desserts & Fruit & Sweet dishes (Milchreis, Grütze, Pudding, etc.)
  const dessertKeywords = ['dessert', 'pudding', 'quark', 'joghurt', 'grütze', 'creme', 'mousse', 'apfel', 'banane', 'nektarine', 'obst', 'wassermelone', 'kirschen', 'kompott', 'pfirsich', 'milchreis'];
  if (!isSoup && (isPureDessert(dish) || dessertKeywords.some(k => name.includes(k) || dpName.includes(k)))) {
    return 'dessert';
  }

  // Explicit side dish categorization
  if (typeLower === 'beilagen' || typeLower === 'xbeilagen' || typeLower === 'beilage' || catNameDe.includes('beilage') || catNameDe.includes('gemüse')) {
    if (price < 2.5) {
      return 'side';
    }
  }

  // Side dish keywords (if price is low: <= 1.20€)
  const sideKeywords = ['pommes', 'kartoffel', 'reis', 'spätzle', 'schupfnudeln', 'gemüse', 'blumenkohl', 'brokkoli', 'broccoli', 'erbsen', 'möhren', 'karotten', 'bohnen', 'röstitaler', 'leipzigerallerlei', 'balkangemüse', 'kaisergemüse', 'sommergemüse', 'beilagensalat', 'salat', 'sauce'];
  const hasSideKeyword = sideKeywords.some(k => name.includes(k) || dpName.includes(k));

  if (!isSoup && hasSideKeyword && price <= 1.20) {
    return 'side';
  }

  // Meisterwerk / Premium Action lines (Pizza, Flammkuchen, Burger, Pasta Mista)
  const isMeisterwerkLine = typeLower.includes('meisterwerk') || typeLower.includes('aktion');
  if (isMeisterwerkLine && !hasSideKeyword && price >= 1.40) {
    return 'meisterwerk';
  }

  // Main dish lines
  const mainLines = ['heimspiel', 'worldwide', 'querbeet', 'streetfood', 'sozialgericht', 'fleisch', 'fisch'];
  const isMainLine = mainLines.some(l => typeLower.includes(l));

  if (isMainLine && !hasSideKeyword) {
    return 'main';
  }

  if (isSoup) {
    return 'main';
  }

  if (customFields['artikel_id'] === '10069' || name.includes('tagesrestproduktion')) {
    return 'main';
  }

  const mainKeywords = [
    'schnitzel', 'bratwurst', 'currywurst', 'wurst', 'lasagne', 'curry', 'dal',
    'auflauf', 'frikadelle', 'bällchen', 'burger', 'pizza', 'flammkuchen',
    'gulasch', 'geschnetzeltes', 'cordon bleu', 'steak', 'filet', 'braten',
    'drum sticks', 'gyros', 'cevapcici', 'tortelloni', 'ravioli', 'maultaschen',
    'bolognese', 'jambalaya', 'paella', 'falafel'
  ];
  if (!hasSideKeyword && price >= 0.90 && mainKeywords.some(k => name.includes(k) || dpName.includes(k))) {
    return 'main';
  }

  if (price >= 1.4) {
    return 'main';
  }

  return 'side';
}

/**
 * Extracts and parses dish serving times from custom_fields['dish_info'].
 * Returns { startHour, endHour, servingTime, raw } or null if absent/invalid.
 *
 * @param {object} dish
 * @returns {{ startHour: number, endHour: number, servingTime: string, raw: string } | null}
 */
export function parseDishServingTime(dish) {
  if (!dish) return null;
  const cf = getCustomFields(dish);
  const dishInfo = cf['dish_info'] || '';
  if (!dishInfo || /^\s*\d?\s*$/.test(dishInfo)) return null;

  const match = dishInfo.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
  if (!match) return null;

  const sH = parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
  const eH = parseInt(match[3], 10) + parseInt(match[4], 10) / 60;
  const sStr = `${match[1].padStart(2, '0')}:${match[2]}`;
  const eStr = `${match[3].padStart(2, '0')}:${match[4]}`;

  return {
    startHour: sH,
    endHour: eH,
    servingTime: `${sStr} - ${eStr}`,
    raw: dishInfo
  };
}

/**
 * Determines whether a dish has already expired for the current day.
 *
 * @param {object} dish
 * @param {number} currentHour - Current decimal hour (e.g. 14.75)
 * @returns {boolean}
 */
export function isDishExpired(dish, currentHour) {
  const serving = parseDishServingTime(dish);
  if (!serving) return false;
  return currentHour > serving.endHour;
}

/**
 * Calculates the combined service window for an array of dishes.
 * Returns { startHour, endHour, formatted } or null if no explicit dish times.
 *
 * @param {object[]} dishes
 * @param {string} [lang='de']
 * @returns {{ startHour: number, endHour: number, formatted: string } | null}
 */
export function getDishesServiceWindow(dishes, lang = 'de') {
  if (!Array.isArray(dishes) || dishes.length === 0) return null;

  let minStart = 24;
  let maxEnd = 0;
  let hasTimes = false;

  for (const d of dishes) {
    const serving = parseDishServingTime(d);
    if (serving) {
      hasTimes = true;
      if (serving.startHour < minStart) minStart = serving.startHour;
      if (serving.endHour > maxEnd) maxEnd = serving.endHour;
    }
  }

  if (!hasTimes) return null;

  const format = (h) => `${Math.floor(h)}:${Math.round((h % 1) * 60).toString().padStart(2, '0')}`;
  const suffix = lang === 'de' ? ' Uhr' : '';
  return {
    startHour: minStart,
    endHour: maxEnd,
    formatted: `${format(minStart)} - ${format(maxEnd)}${suffix}`
  };
}

const SCREEN_PREFIX_BY_CANTEEN = {
  'unimensa': ['mzs', 'mensa zülpicher', 'uni-mensa'],
  'robertkoch': ['mensa lindenthal', 'robert-koch', 'robert koch'],
  'lindenthal': ['bistro lindenthal'],
  'zollstock': ['mensa zollstock', 'zollstock'],
  'eraum': ['bistro uni-e-raum', 'bistro e-raum', 'bistro uni e-raum', 'e-raum'],
  'iwz-deutz': ['mensa deutz', 'deutz'],
  'suedstadt': ['mensa südstadt', 'südstadt', 'suedstadt'],
  'spoho': ['mensa spoho', 'spoho', 'sportpark', 'müngersdorf'],
  'cafe-himmelsblick': ['mensa claudius', 'claudius', 'himmelsblick'],
  'gummersbach': ['mensa gummersbach', 'gummersbach'],
  'kunsthochschule-medien': ['mensa kunsthochschule', 'kunsthochschule', 'khm'],
  'muho': ['mensa muho', 'mensa musikhochschule', 'muho', 'musikhochschule'],
  'leverkusen': ['mensa leverkusen', 'leverkusen'],
  'philcafe': ['bistro philcaf', 'philcaf', 'phil caf']
};

function screenPrefixMatchesCanteen(prefixLower, canteenKey) {
  if (!canteenKey) return true;
  if (canteenKey === 'unimensa' && prefixLower.startsWith('mensa lindenthal')) {
    return false;
  }
  const allowed = SCREEN_PREFIX_BY_CANTEEN[canteenKey];
  if (allowed) {
    if (canteenKey === 'eraum' && prefixLower.startsWith('bistro') && !prefixLower.includes('lindenthal') && !prefixLower.includes('phil')) {
      return true;
    }
    return allowed.some(p => prefixLower.startsWith(p) || prefixLower.includes(p));
  }
  return prefixLower.includes(canteenKey.toLowerCase());
}

/**
 * Extracts serving counter name from dish_info or screens.
 *
 * @param {object} dish
 * @param {string} canteenKey
 * @returns {string}
 */
export function extractDishCounter(dish, canteenKey = '') {
  if (!dish) return '';
  const cf = getCustomFields(dish);
  const dishInfo = cf['dish_info'] || '';
  let dishCounter = '';

  if (dishInfo && !/^\s*\d?\s*$/.test(dishInfo)) {
    const timeMatch = dishInfo.match(/(\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2})/);
    let counterPart = dishInfo;
    if (timeMatch) {
      counterPart = dishInfo.substring(0, dishInfo.indexOf(timeMatch[0]));
    }
    counterPart = counterPart.replace(/\s*-\s*$/, '').replace(/Uhr.*$/i, '').trim();
    if (counterPart && !/^\d+$/.test(counterPart) && counterPart.length > 1) {
      dishCounter = counterPart;
    }
  }

  if (!dishCounter) {
    const screens = dish.screens || [];
    for (const s of screens) {
      if (!s) continue;
      const sLoc = String(s.location || s.name || '').trim();
      const dashIdx = sLoc.indexOf(' - ');
      if (dashIdx !== -1) {
        const prefix = sLoc.slice(0, dashIdx).trim().toLowerCase();
        const counter = sLoc.slice(dashIdx + 3).trim();
        if (counter && screenPrefixMatchesCanteen(prefix, canteenKey)) {
          dishCounter = counter;
          break;
        }
      }
    }
  }

  return dishCounter;
}

/**
 * Normalizes dish name for stable favorites storage across weekly menu updates.
 * Strips allergen brackets, kitchen markers ([TK], [Eigenproduktion], etc.), ERP suffixes, and normalizes whitespace.
 * @param {object|string} dish
 * @returns {string}
 */
export function cleanDishNameForFavorite(dish) {
  const raw = (dish && typeof dish === 'object') ? (dish.name_de || dish.name_en || '') : (typeof dish === 'string' ? dish : '');
  if (!raw) return '';
  return raw
    .replace(/\s*\(\s*\d+[a-z]?(?:\s*,\s*\d+[a-z]?)*\s*\)/gi, ' ')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/\b8\s*mm\s*frisch\b/gi, ' ')
    .replace(/\b1\s*\/\s*4\s*schnitt\s*frisch\b/gi, ' ')
    .replace(/\bstandard\b/gi, ' ')
    .replace(/\bgrundrezept\b/gi, ' ')
    .replace(/\beigenproduktion(?:\s*vega\w*)?\b/gi, ' ')
    .replace(/\s+(Abendessen|TK|Eigenproduktion|Eigenprodukt|Neu|trocken|Vegan|Vegetarisch)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Resolves the clean display name for a dish in the requested language.
 * Prevents truncated 40-char CUSTOM_DPNAME strings from overwriting clean dish.name_de,
 * only falling back to cleanDPName(CUSTOM_DPNAME) when rawName is empty or a bare generic word.
 *
 * @param {object} dish
 * @param {string} [language='de']
 * @returns {string}
 */
export function getDishDisplayName(dish, language = 'de') {
  if (!dish || typeof dish !== 'object') return '';
  const customFields = getCustomFields(dish);
  const rawName = (language === 'en' && dish.name_en) ? dish.name_en : (dish.name_de || '');
  const cleanedRaw = stripInlineAllergenCodes(rawName);

  if (/^(\s*|beilage|beilagen|dessert|salat|suppe|eintopf|gemüse|obst)$/i.test(cleanedRaw)) {
    const dpCleaned = stripInlineAllergenCodes(cleanDPName(customFields['CUSTOM_DPNAME'] || ''));
    if (dpCleaned && (language !== 'en' || !cleanedRaw)) {
      return dpCleaned;
    }
  }

  return cleanedRaw;
}

/**
 * Extracts dish components (dish_ger_1..5 or dish_1..5_eng), strips allergen codes,
 * and deduplicates against mealName.
 *
 * @param {object} dish
 * @param {string} [mealName='']
 * @param {string} [language='de']
 * @returns {string[]}
 */
export function getDishComponentsList(dish, mealName = '', language = 'de') {
  if (!dish || typeof dish !== 'object') return [];
  const customFields = getCustomFields(dish);
  const resolvedMealName = mealName || getDishDisplayName(dish, language);
  const titleClean = stripAllergenCodes(resolvedMealName).toLowerCase().trim();

  const dishComponents = [];
  for (let i = 1; i <= 5; i++) {
    const fieldDe = customFields[`dish_ger_${i}`] || '';
    const fieldEn = customFields[`dish_${i}_eng`] || '';
    const raw = (language === 'en' && fieldEn) ? fieldEn : fieldDe;
    if (raw) {
      const cleaned = stripAllergenCodes(raw).replace(/\s+/g, ' ').trim();
      if (cleaned) {
        dishComponents.push(cleaned);
      }
    }
  }

  if (dishComponents.length > 0 && titleClean) {
    const firstClean = dishComponents[0].toLowerCase();
    if (firstClean === titleClean || titleClean.includes(firstClean) || firstClean.includes(titleClean)) {
      dishComponents.shift();
    }
  }

  return dishComponents;
}

/**
 * Pure helper returning brand metadata and subTag for a dish.
 *
 * @param {object} dish
 * @param {Record<string, string>} [t={}]
 * @returns {{ brandKey: string, brandName: string, brandIcon: string, brandColor: string, subTag: string }}
 */
export function getBrandAndSubTag(dish, t = {}) {
  if (!dish || typeof dish !== 'object') {
    return {
      brandKey: 'GERICHT',
      brandName: t?.brandDish || 'Gericht',
      brandIcon: 'restaurant',
      brandColor: 'bg-slate-100 text-slate-800 border-slate-200/90 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      subTag: ''
    };
  }

  const customFields = getCustomFields(dish);
  const rawType = customFields['menu_type'] || '';
  const category = dish.category || null;
  const classification = classifyDish(dish);

  let brandKey = '';
  let subTagText = '';

  if (rawType) {
    const parts = rawType.trim().split(/\s+/);
    const firstWord = parts[0].toUpperCase();

    if (['HEIMSPIEL', 'WORLDWIDE', 'QUERBEET', 'MEISTERWERK', 'STREETFOOD', 'STREET'].includes(firstWord)) {
      brandKey = firstWord === 'STREET' ? 'STREETFOOD' : firstWord;
      const remaining = parts.slice(1).join(' ');
      subTagText = remaining
        .replace(/\bVEGAN\b/gi, '')
        .replace(/\bST\.?\b/gi, '')
        .trim();
    } else if (firstWord === 'AKTION') {
      brandKey = 'MEISTERWERK';
      const remaining = parts.slice(1).join(' ');
      subTagText = remaining
        .replace(/\bVEGAN\b/gi, '')
        .replace(/\bST\.?\b/gi, '')
        .trim();
    } else if (firstWord === 'SOZIALGERICHT') {
      brandKey = 'SOZIALGERICHT';
    } else if (classification === 'meisterwerk') {
      brandKey = 'MEISTERWERK';
    } else if (classification === 'buffet') {
      brandKey = 'BUFFET';
    } else if (classification === 'side' || firstWord.includes('BEILAGE')) {
      brandKey = 'BEILAGE';
    } else if (classification === 'dessert') {
      brandKey = 'DESSERT';
    } else {
      brandKey = rawType.trim().toUpperCase();
    }
  } else if (classification === 'meisterwerk') {
    brandKey = 'MEISTERWERK';
  } else if (classification === 'buffet') {
    brandKey = 'BUFFET';
  } else if (classification === 'dessert') {
    brandKey = 'DESSERT';
  } else if (classification === 'side') {
    brandKey = 'BEILAGE';
  } else {
    brandKey = 'GERICHT';
  }

  const isEn = t?.all === 'All Foods' || t?.language === 'en';
  let brandName = '';
  let brandIcon = '';
  let brandColor = '';

  switch (brandKey) {
    case 'HEIMSPIEL':
      brandName = t?.brandHeimspiel || 'Heimspiel';
      brandIcon = 'home';
      brandColor = 'bg-amber-50 text-amber-900 border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
      break;
    case 'WORLDWIDE':
      brandName = t?.brandWorldwide || 'Worldwide';
      brandIcon = 'public';
      brandColor = 'bg-cyan-50 text-cyan-900 border-cyan-200/90 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900';
      break;
    case 'QUERBEET':
      brandName = t?.brandQuerbeet || 'Querbeet';
      brandIcon = 'yard';
      brandColor = 'bg-emerald-50 text-emerald-900 border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
      break;
    case 'MEISTERWERK':
      brandName = t?.brandMeisterwerk || t?.sectionMeisterwerk || 'Meisterwerk';
      brandIcon = 'workspace_premium';
      brandColor = 'bg-amber-50 text-amber-900 border-amber-300/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60';
      break;
    case 'STREETFOOD':
      brandName = t?.brandStreetfood || 'Streetfood';
      brandIcon = 'fastfood';
      brandColor = 'bg-rose-50 text-rose-900 border-rose-200/90 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
      break;
    case 'SOZIALGERICHT':
      brandName = t?.brandSocialMeal || (isEn ? 'Social Meal' : 'Sozialgericht');
      brandIcon = 'volunteer_activism';
      brandColor = 'bg-blue-50 text-blue-900 border-blue-200/90 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900';
      break;
    case 'BUFFET':
      brandName = t?.brandBuffet || 'Buffet';
      brandIcon = 'scale';
      brandColor = 'bg-amber-50 text-amber-900 border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
      break;
    case 'BEILAGE':
      brandName = t?.brandSide || (isEn ? 'Side' : 'Beilage');
      brandIcon = 'grain';
      brandColor = 'bg-slate-100 text-slate-800 border-slate-200/90 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      break;
    case 'DESSERT':
      brandName = t?.brandDessert || t?.sectionDessert || (isEn ? 'Dessert & Fruit' : 'Dessert & Obst');
      brandIcon = 'icecream';
      brandColor = 'bg-pink-50 text-pink-900 border-pink-200/90 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-900';
      break;
    default:
      if (category && (category.name_de || category.name_en)) {
        brandName = (isEn && category.name_en) ? category.name_en : (category.name_de || category.name_en);
      } else {
        brandName = t?.brandDish || (isEn ? 'Dish' : 'Gericht');
      }
      brandIcon = 'restaurant';
      brandColor = 'bg-slate-100 text-slate-800 border-slate-200/90 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  }

  let subTag = '';
  if (subTagText) {
    let displaySub = subTagText;
    const upperSub = displaySub.toUpperCase();
    if (upperSub === 'SOZIAL') {
      displaySub = t?.subTagSocial || (isEn ? 'Social' : 'Sozial');
    } else if (upperSub === 'ABENDESSEN') {
      displaySub = t?.subTagDinner || (isEn ? 'Dinner' : 'Abendessen');
    } else if (upperSub === 'AKTION') {
      displaySub = t?.subTagPromo || (isEn ? 'Promo' : 'Aktion');
    } else {
      displaySub = displaySub.charAt(0).toUpperCase() + displaySub.slice(1).toLowerCase();
    }
    subTag = displaySub;
  }

  return { brandKey, brandName, brandIcon, brandColor, subTag };
}

/**
 * Parses numeric price from string or number, supporting comma and dot decimals.
 * @param {string|number|null} val
 * @returns {number|null}
 */
export function parsePrice(val) {
  if (val == null) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim().replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Extracts tariff-specific price for a dish.
 * - 'student' -> dish.price
 * - 'employee' -> price_2
 * - 'guest' -> price_3
 * - 'external' -> price_4 (if > 0, else fallback to guest)
 * @param {object} dish
 * @param {'student'|'employee'|'guest'|'external'} [tariff='student']
 * @returns {number|null}
 */
export function getDishPrice(dish, tariff = 'student') {
  if (!dish) return null;
  const cf = getCustomFields(dish);
  if (tariff === 'employee') {
    const p2 = parsePrice(cf['price_2']);
    if (p2 != null && p2 > 0) return p2;
  } else if (tariff === 'guest') {
    const p3 = parsePrice(cf['price_3']);
    if (p3 != null && p3 > 0) return p3;
  } else if (tariff === 'external') {
    const p4 = parsePrice(cf['price_4']);
    if (p4 != null && p4 > 0) return p4;
    const p3 = parsePrice(cf['price_3']);
    if (p3 != null && p3 > 0) return p3;
  }
  return parsePrice(dish.price ?? dish.price_student);
}

/**
 * Formats a numeric price into localized euro string (e.g. 2.5 -> "2,50 €")
 * @param {number|null} amount
 * @returns {string}
 */
export function formatPrice(amount) {
  if (amount == null || isNaN(amount)) return '';
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

/**
 * Detects whether a dish is a buffet dish (sold by weight per 100g).
 * @param {object} dish
 * @returns {boolean}
 */
export function isBuffetDish(dish) {
  if (!dish) return false;
  const cf = getCustomFields(dish);
  if (cf['preis_gramm'] && String(cf['preis_gramm']) === '100') return true;
  const cat = (dish.category && dish.category.name_de) ? dish.category.name_de.toLowerCase() : '';
  const name = (dish.name_de || '').toLowerCase();
  const dpName = (cf['CUSTOM_DPNAME'] || '').toLowerCase();
  const hinweise = (cf['hinweise'] || '').toLowerCase();
  return cat.includes('buffet') ||
         name.includes('buffet') ||
         dpName.includes('buffet') ||
         hinweise.includes('buffet') ||
         name.includes('pasta theke') ||
         name.includes('pastatheke');
}

/**
 * Returns price per 100g for buffet dishes.
 * @param {object} dish
 * @param {'student'|'employee'|'guest'|'external'} [tariff='student']
 * @returns {number}
 */
export function getBuffetPricePer100g(dish, tariff = 'student') {
  const p = getDishPrice(dish, tariff);
  return p != null ? p : 1.10;
}

/**
 * Calculates total buffet cost for a given weight in grams.
 * @param {number} pricePer100g
 * @param {number} grams
 * @returns {number}
 */
export function calculateBuffetPrice(pricePer100g, grams) {
  if (!pricePer100g || !grams || grams <= 0) return 0;
  return Math.round(pricePer100g * (grams / 100) * 100) / 100;
}

export const SIDE_PRICES_BY_TARIFF = {
  student: 0.70,
  employee: 0.95,
  guest: 1.25,
  external: 1.25
};

export const PRICING_SYSTEM_TRANSITION_DATE = '2026-09-01';

/**
 * Detects the number of sides (Beilagen) bundled/included with a main dish.
 * - Before 2026-09-01 (old system):
 *   - Soups/stews included 0 sides (just bread roll).
 *   - Standard main dishes included 2 sides (Sättigungsbeilage + Gemüseteller/Salat).
 * - On/after 2026-09-01 (flexible modular system):
 *   - Title containing "+ 2 Beilagen" -> 2 sides.
 *   - Title containing "+ 1 Beilage" -> 1 side.
 *   - Otherwise -> 0 sides included.
 *
 * @param {object} dish
 * @param {string} [dateStr=''] - ISO date string (YYYY-MM-DD)
 * @returns {number}
 */
export function detectIncludedSides(dish, dateStr = '') {
  if (!dish) return 0;
  const name = ((dish.name_de || dish.name_en || '') + ' ' + (dish.clean || '')).toLowerCase();

  // Check explicit title hints in new or old system
  if (/(?:\+|\bmit\b|\binkl\.?\b)\s*2\s*beilagen/i.test(name)) return 2;
  if (/(?:\+|\bmit\b|\binkl\.?\b)\s*1\s*beilage/i.test(name)) return 1;

  const isOldSystem = dateStr ? dateStr < PRICING_SYSTEM_TRANSITION_DATE : false;
  if (isOldSystem) {
    if (isSoupOrStew(dish)) return 0;
    return 2;
  }
  return 0;
}

