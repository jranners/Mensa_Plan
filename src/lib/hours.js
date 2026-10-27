/**
 * Structured food serving hours (Essensausgabezeiten) and status calculation for canteens.
 * Source: https://www.kstw.de/gastronomie/mensen-bistros-und-kaffeebars/
 */

/**
 * Structured food serving hours (Essensausgabezeiten) mapped by canteen key.
 * Primary `start`/`end` (`startHour`/`endHour`) reflect when warm meals are served.
 * Optional `noteDe`/`noteEn` and `openHoursDe`/`openHoursEn` provide secondary context
 * (e.g., Abendmensa in MG Nord or extended building/bistro/coffee bar hours).
 * Times are stored in decimal hours (e.g. 11.5 = 11:30, 14.25 = 14:15).
 */
export const CANTEEN_HOURS = {
  'unimensa': {
    weekdays: {
      start: '11:30',
      end: '14:30',
      startHour: 11.5,
      endHour: 14.5,
      extendedEndHour: 18.25,
      noteDe: 'MG Nord bis 18:15',
      noteEn: 'MG Nord until 18:15',
      openHoursDe: 'Mo - Fr 11:30 - 15:00 Uhr (MG Nord bis 18:45, Kaffeebar 09:00 - 16:00)',
      openHoursEn: 'Mon - Fri 11:30 - 15:00 (MG Nord until 18:45, Coffee bar 09:00 - 16:00)'
    },
    saturday: null,
    sunday: null
  },
  'iwz-deutz': {
    weekdays: {
      start: '11:00',
      end: '14:15',
      startHour: 11.0,
      endHour: 14.25,
      openHoursDe: 'Mensa 11:00 - 14:15 Uhr · Bistro Mo - Do 07:30 - 15:30, Fr 07:30 - 14:15 Uhr',
      openHoursEn: 'Canteen 11:00 - 14:15 · Bistro Mon - Thu 07:30 - 15:30, Fri 07:30 - 14:15'
    },
    saturday: null,
    sunday: null
  },
  'suedstadt': {
    weekdays: {
      start: '11:30',
      end: '14:30',
      startHour: 11.5,
      endHour: 14.5,
      openHoursDe: 'Mensa 07:30 - 15:00 Uhr · Kaffeebar Mo - Do 07:30 - 16:00, Fr bis 14:45 Uhr',
      openHoursEn: 'Canteen 07:30 - 15:00 · Coffee bar Mon - Thu 07:30 - 16:00, Fri until 14:45'
    },
    saturday: null,
    sunday: null
  },
  'spoho': {
    weekdays: {
      start: '11:15',
      end: '14:30',
      startHour: 11.25,
      endHour: 14.5,
      openHoursDe: 'Mensa 11:15 - 14:30 Uhr · Bistro Auszeit Mo - Do 08:00 - 18:00, Fr 08:00 - 14:30 Uhr',
      openHoursEn: 'Canteen 11:15 - 14:30 · Bistro Auszeit Mon - Thu 08:00 - 18:00, Fri 08:00 - 14:30'
    },
    saturday: null,
    sunday: null
  },
  'eraum': {
    monday_thursday: {
      start: '11:00',
      end: '17:00',
      startHour: 11.0,
      endHour: 17.0,
      noteDe: 'Bistro ab 07:30',
      noteEn: 'Bistro from 07:30',
      openHoursDe: 'Bistro Mo - Do 07:30 - 17:00 Uhr (Warme Speisen ab 11:00 Uhr)',
      openHoursEn: 'Bistro Mon - Thu 07:30 - 17:00 (Warm dishes from 11:00)'
    },
    friday: {
      start: '11:00',
      end: '15:00',
      startHour: 11.0,
      endHour: 15.0,
      noteDe: 'Bistro ab 07:30',
      noteEn: 'Bistro from 07:30',
      openHoursDe: 'Bistro Fr 07:30 - 15:00 Uhr (Warme Speisen ab 11:00 Uhr)',
      openHoursEn: 'Bistro Fri 07:30 - 15:00 (Warm dishes from 11:00)'
    },
    saturday: null,
    sunday: null
  },
  'cafe-himmelsblick': {
    monday_thursday: {
      start: '11:30',
      end: '14:30',
      startHour: 11.5,
      endHour: 14.5,
      noteDe: 'Kaffeebar bis 16:00',
      noteEn: 'Coffee bar until 16:00',
      openHoursDe: 'Mensa 11:30 - 14:30 Uhr · Kaffeebar Mo - Do 07:30 - 16:00 Uhr',
      openHoursEn: 'Canteen 11:30 - 14:30 · Coffee bar Mon - Thu 07:30 - 16:00'
    },
    friday: {
      start: '11:30',
      end: '14:30',
      startHour: 11.5,
      endHour: 14.5,
      noteDe: 'Kaffeebar bis 15:00',
      noteEn: 'Coffee bar until 15:00',
      openHoursDe: 'Mensa 11:30 - 14:30 Uhr · Kaffeebar Fr 07:30 - 15:00 Uhr',
      openHoursEn: 'Canteen 11:30 - 14:30 · Coffee bar Fri 07:30 - 15:00'
    },
    saturday: null,
    sunday: null
  },
  'gummersbach': {
    weekdays: {
      start: '11:15',
      end: '14:30',
      startHour: 11.25,
      endHour: 14.5,
      openHoursDe: 'Mensa 08:00 - 15:00 Uhr · Kaffeebar 08:30 - 14:00 Uhr',
      openHoursEn: 'Canteen 08:00 - 15:00 · Coffee bar 08:30 - 14:00'
    },
    saturday: null,
    sunday: null
  },
  'kunsthochschule-medien': {
    weekdays: {
      start: '11:30',
      end: '14:30',
      startHour: 11.5,
      endHour: 14.5,
      openHoursDe: 'Öffnungszeit Mo - Fr 09:30 - 14:45 Uhr',
      openHoursEn: 'Opening hours Mon - Fri 09:30 - 14:45'
    },
    saturday: null,
    sunday: null
  },
  'lindenthal': {
    monday_thursday: {
      start: '11:30',
      end: '14:30',
      startHour: 11.5,
      endHour: 14.5,
      noteDe: 'Bistro 07:30 - 16:00',
      noteEn: 'Bistro 07:30 - 16:00',
      openHoursDe: 'Bistro Mo - Do 07:30 - 16:00 Uhr · Kaffeebar 09:00 - 14:00 Uhr',
      openHoursEn: 'Bistro Mon - Thu 07:30 - 16:00 · Coffee bar 09:00 - 14:00'
    },
    friday: {
      start: '11:30',
      end: '14:30',
      startHour: 11.5,
      endHour: 14.5,
      noteDe: 'Bistro 07:30 - 14:30',
      noteEn: 'Bistro 07:30 - 14:30',
      openHoursDe: 'Bistro Fr 07:30 - 14:30 Uhr · Kaffeebar 09:00 - 14:00 Uhr',
      openHoursEn: 'Bistro Fri 07:30 - 14:30 · Coffee bar 09:00 - 14:00'
    },
    saturday: null,
    sunday: null
  },
  'muho': {
    weekdays: {
      start: '11:30',
      end: '14:15',
      startHour: 11.5,
      endHour: 14.25,
      openHoursDe: 'Mensa 11:30 - 14:15 Uhr · Kaffeebar 08:30 - 16:00 Uhr',
      openHoursEn: 'Canteen 11:30 - 14:15 · Coffee bar 08:30 - 16:00'
    },
    saturday: null,
    sunday: null
  },
  'robertkoch': {
    weekdays: {
      start: '11:00',
      end: '14:15',
      startHour: 11.0,
      endHour: 14.25,
      openHoursDe: 'Öffnungszeit Mo - Fr 11:00 - 15:00 Uhr (Essensausgabe bis 14:15 Uhr)',
      openHoursEn: 'Opening hours Mon - Fri 11:00 - 15:00 (Food service until 14:15)'
    },
    saturday: null,
    sunday: null
  },
  'leverkusen': {
    weekdays: {
      start: '11:00',
      end: '13:30',
      startHour: 11.0,
      endHour: 13.5,
      openHoursDe: 'Öffnungszeit Mo - Fr 08:45 - 13:30 Uhr',
      openHoursEn: 'Opening hours Mon - Fri 08:45 - 13:30'
    },
    saturday: null,
    sunday: null
  },
  'zollstock': {
    weekdays: {
      start: '11:30',
      end: '14:30',
      startHour: 11.5,
      endHour: 14.5,
      openHoursDe: 'Öffnungszeit Mo - Fr 09:00 - 15:00 Uhr',
      openHoursEn: 'Opening hours Mon - Fri 09:00 - 15:00'
    },
    saturday: null,
    sunday: null
  },
  'philcafe': {
    weekdays: {
      start: '11:30',
      end: '14:30',
      startHour: 11.5,
      endHour: 14.5,
      noteDe: 'Bistro 09:00 - 15:00',
      noteEn: 'Bistro 09:00 - 15:00',
      openHoursDe: 'Warme Gerichte 11:30 - 14:30 Uhr · Salatbuffet 10:00 - 14:30 Uhr · Bistro 09:00 - 15:00 Uhr · Kaffeebar 08:00 - 17:00 Uhr',
      openHoursEn: 'Warm dishes 11:30 - 14:30 · Salad buffet 10:00 - 14:30 · Bistro 09:00 - 15:00 · Coffee bar 08:00 - 17:00'
    },
    saturday: null,
    sunday: null
  }
};

/**
 * Formats a decimal hour into "HH:MM" string.
 * @param {number} decimalHour
 * @returns {string}
 */
export function formatDecimalHour(decimalHour) {
  const h = Math.floor(decimalHour);
  const m = Math.round((decimalHour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns structured opening hours for a canteen on a given day of the week.
 *
 * @param {string} canteenKey - e.g. 'unimensa', 'iwz-deutz'
 * @param {number} dayOfWeek - 0 (Sunday) to 6 (Saturday)
 * @param {object} [canteen] - Optional canteen object from CANTEENS
 * @param {string} [lang='de'] - Language ('de' or 'en')
 * @returns {{ isOpenToday: boolean, startHour: number, endHour: number, formatted: string }}
 */
export function getCanteenHoursForDay(canteenKey, dayOfWeek, canteen = null, lang = 'de') {
  const schedule = CANTEEN_HOURS[canteenKey];
  let window = null;

  if (schedule) {
    if (dayOfWeek === 0) {
      window = schedule.sunday || null;
    } else if (dayOfWeek === 6) {
      window = schedule.saturday || null;
    } else if (dayOfWeek === 5) {
      window = schedule.friday || schedule.weekdays || null;
    } else {
      // Monday to Thursday (1 - 4)
      window = schedule.monday_thursday || schedule.weekdays || null;
    }
  }

  // Fallback: parse from canteen.infokurz if no structured schedule
  if (!window && canteen && canteen.infokurz) {
    const lines = canteen.infokurz.split('\n');
    const dayNamesMap = { 1: ['mo'], 2: ['di'], 3: ['mi'], 4: ['do'], 5: ['fr'], 6: ['sa'], 0: ['so'] };
    const searchTerms = dayNamesMap[dayOfWeek] || [];

    for (const line of lines) {
      const lineLower = line.toLowerCase();
      const matchesDay = searchTerms.some(term => lineLower.includes(term)) ||
        (dayOfWeek >= 1 && dayOfWeek <= 5 && lineLower.includes('mo - fr')) ||
        (dayOfWeek >= 1 && dayOfWeek <= 4 && lineLower.includes('mo - do'));

      if (matchesDay) {
        const match = line.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
        if (match) {
          const sH = parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
          const eH = parseInt(match[3], 10) + parseInt(match[4], 10) / 60;
          window = {
            start: `${match[1].padStart(2, '0')}:${match[2]}`,
            end: `${match[3].padStart(2, '0')}:${match[4]}`,
            startHour: sH,
            endHour: eH
          };
          break;
        }
      }
    }
  }

  if (!window) {
    return {
      isOpenToday: false,
      startHour: 0,
      endHour: 0,
      extendedEndHour: null,
      note: null,
      openHours: null,
      formatted: lang === 'de' ? 'Geschlossen' : 'Closed'
    };
  }

  const suffix = lang === 'de' ? ' Uhr' : '';
  const note = (lang === 'de' ? window.noteDe : window.noteEn) || null;
  const openHours = (lang === 'de' ? window.openHoursDe : window.openHoursEn) || null;
  return {
    isOpenToday: true,
    startHour: window.startHour,
    endHour: window.endHour,
    extendedEndHour: window.extendedEndHour || null,
    note,
    openHours,
    formatted: `${window.start} - ${window.end}${suffix}`
  };
}

/**
 * Computes current open/closed status for a canteen given its day hours and the current hour.
 *
 * @param {{ isOpenToday: boolean, startHour: number, endHour: number }} hours
 * @param {number} currentHour - Current time in decimal hours (e.g. 12.5 for 12:30)
 * @returns {{ isOpen: boolean, opensLater: boolean, isClosed: boolean, minutesUntilClose: number|null, minutesUntilOpen: number|null }}
 */
export function getCanteenOpenStatus(hours, currentHour) {
  if (!hours || !hours.isOpenToday) {
    return {
      isOpen: false,
      opensLater: false,
      isClosed: true,
      minutesUntilClose: null,
      minutesUntilOpen: null
    };
  }

  if (currentHour >= hours.startHour && currentHour < hours.endHour) {
    const minsToClose = Math.round((hours.endHour - currentHour) * 60);
    return {
      isOpen: true,
      opensLater: false,
      isClosed: false,
      minutesUntilClose: minsToClose,
      minutesUntilOpen: null
    };
  }

  if (currentHour < hours.startHour) {
    const minsToOpen = Math.round((hours.startHour - currentHour) * 60);
    return {
      isOpen: false,
      opensLater: true,
      isClosed: false,
      minutesUntilClose: null,
      minutesUntilOpen: minsToOpen
    };
  }

  // currentHour >= hours.endHour
  return {
    isOpen: false,
    opensLater: false,
    isClosed: true,
    minutesUntilClose: null,
    minutesUntilOpen: null
  };
}
