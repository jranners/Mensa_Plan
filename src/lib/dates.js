/**
 * Date and timezone utilities for KStW Mensaplan.
 * Standardizes Europe/Berlin timezone handling and date calculations.
 */

const berlinDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/**
 * Returns today's ISO date string (YYYY-MM-DD) in Europe/Berlin timezone.
 *
 * @param {Date} [date=new Date()]
 * @returns {string} e.g. "2026-10-05"
 */
export function getBerlinTodayDate(date = new Date()) {
  return berlinDateFormatter.format(date);
}

/**
 * Parses a YYYY-MM-DD ISO string into year, month, and day integers.
 * Returns null if format is invalid.
 *
 * @param {string} isoStr
 * @returns {{ year: number, month: number, day: number } | null}
 */
export function parseIsoParts(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return null;
  const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10)
  };
}

/**
 * Returns the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * for a given YYYY-MM-DD string without timezone-shift artifacts.
 *
 * @param {string} isoStr
 * @returns {number}
 */
export function getDayOfWeekFromIso(isoStr) {
  const parts = parseIsoParts(isoStr);
  if (!parts) return 0;
  // Use noon to stay far away from daylight saving transition hours
  const dt = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  return dt.getDay();
}

/**
 * Calculates start and end ISO date strings for week menu fetching.
 * Always anchors to Monday of current week (or previous Monday on Sundays)
 * and spans 14 days (up to Sunday of the next week).
 *
 * @param {Date} [now=new Date()]
 * @returns {{ startDate: string, endDate: string }}
 */
export function getFetchDateRange(now = new Date()) {
  const berlinTodayIso = getBerlinTodayDate(now);
  const parts = parseIsoParts(berlinTodayIso);
  const d = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysSinceMonday = dayOfWeek === 0 ? 6 : (dayOfWeek - 1);

  const monday = new Date(parts.year, parts.month - 1, parts.day - daysSinceMonday, 12, 0, 0);
  const sundayTwoWeeksLater = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 13, 12, 0, 0);

  return {
    startDate: getBerlinTodayDate(monday),
    endDate: getBerlinTodayDate(sundayTwoWeeksLater)
  };
}

/**
 * Formats an ISO date string for display in the horizontal date picker.
 * e.g. "Heute" / "Today", "Mo 5", "Di 6".
 *
 * @param {string} isoDate
 * @param {string} todayIso
 * @param {string} [lang="de"]
 * @returns {string}
 */
export function formatDateSelector(isoDate, todayIso, lang = 'de') {
  if (isoDate === todayIso) {
    return lang === 'de' ? 'Heute' : 'Today';
  }
  const parts = parseIsoParts(isoDate);
  if (!parts) return isoDate;

  const dt = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  const dayNames = {
    de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  };
  const dayStr = (dayNames[lang] || dayNames.de)[dt.getDay()];
  return `${dayStr} ${parts.day}`;
}

/**
 * Formats an ISO date string for display in the date header card.
 * e.g. "Montag, 5. Oktober" (DE) or "Monday, October 5" (EN).
 *
 * @param {string} isoDate
 * @param {string} [lang="de"]
 * @returns {string}
 */
export function formatDateHeader(isoDate, lang = 'de') {
  const parts = parseIsoParts(isoDate);
  if (!parts) return isoDate;
  const dt = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  return dt.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', options);
}

/**
 * Centralized selection of active date.
 * Prioritizes:
 * 1. Previously selected active date if still present and valid
 * 2. Today's date if it has dishes
 * 3. Next upcoming date >= today that has dishes
 * 4. First future date >= today
 * 5. First available date in list
 * 6. Fallback: today's date
 *
 * @param {object} params
 * @param {string[]} params.datesWithMeals - Array of date strings that have available dishes
 * @param {string[]} [params.allAvailableDates=[]] - Array of all date strings in the menu
 * @param {string} params.todayIso - Today's ISO date string
 * @param {string} [params.previousActiveDate] - Previously active date to preserve if still valid
 * @returns {string} Selected active date ISO string
 */
export function pickActiveDate({
  datesWithMeals = [],
  allAvailableDates = [],
  todayIso,
  previousActiveDate
}) {
  const effectiveToday = todayIso || getBerlinTodayDate();

  // 1. Preserve previous date if still in current menu data
  if (previousActiveDate && allAvailableDates.includes(previousActiveDate)) {
    return previousActiveDate;
  }

  // 2. Today if it has available meals
  if (datesWithMeals.includes(effectiveToday)) {
    return effectiveToday;
  }

  // 3. Next upcoming date >= today with meals
  const sortedMealDates = [...datesWithMeals].sort((a, b) => a.localeCompare(b));
  const nextMealDate = sortedMealDates.find(d => d >= effectiveToday);
  if (nextMealDate) {
    return nextMealDate;
  }

  // 4. Any future date >= today
  const sortedAllDates = [...allAvailableDates].sort((a, b) => a.localeCompare(b));
  const nextAnyDate = sortedAllDates.find(d => d >= effectiveToday);
  if (nextAnyDate) {
    return nextAnyDate;
  }

  // 5. First available date with meals, or first date overall
  if (sortedMealDates.length > 0) {
    return sortedMealDates[0];
  }
  if (sortedAllDates.length > 0) {
    return sortedAllDates[0];
  }

  // 6. Ultimate fallback
  return effectiveToday;
}
