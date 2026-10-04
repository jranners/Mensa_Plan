/**
 * Structured opening hours and status calculation for canteens
 */

/**
 * Structured opening hours mapped by canteen key.
 * Times are stored in decimal hours (e.g. 11.5 = 11:30, 14.25 = 14:15).
 */
export const CANTEEN_HOURS = {
  'unimensa': {
    weekdays: { start: '11:30', end: '21:00', startHour: 11.5, endHour: 21.0 },
    saturday: { start: '11:30', end: '15:00', startHour: 11.5, endHour: 15.0 },
    sunday: null
  },
  'iwz-deutz': {
    weekdays: { start: '11:30', end: '14:30', startHour: 11.5, endHour: 14.5 },
    saturday: null,
    sunday: null
  },
  'suedstadt': {
    weekdays: { start: '11:30', end: '14:30', startHour: 11.5, endHour: 14.5 },
    saturday: null,
    sunday: null
  },
  'spoho': {
    monday_thursday: { start: '11:15', end: '14:30', startHour: 11.25, endHour: 14.5 },
    friday: { start: '11:15', end: '14:15', startHour: 11.25, endHour: 14.25 },
    saturday: null,
    sunday: null
  },
  'eraum': {
    monday_thursday: { start: '07:30', end: '18:00', startHour: 7.5, endHour: 18.0 },
    friday: { start: '07:30', end: '15:00', startHour: 7.5, endHour: 15.0 },
    saturday: null,
    sunday: null
  },
  'cafe-himmelsblick': {
    monday_thursday: { start: '11:30', end: '18:00', startHour: 11.5, endHour: 18.0 },
    friday: { start: '11:30', end: '16:00', startHour: 11.5, endHour: 16.0 },
    saturday: null,
    sunday: null
  },
  'gummersbach': {
    monday_thursday: { start: '11:30', end: '15:00', startHour: 11.5, endHour: 15.0 },
    friday: { start: '11:30', end: '14:00', startHour: 11.5, endHour: 14.0 },
    saturday: null,
    sunday: null
  },
  'kunsthochschule-medien': {
    weekdays: { start: '10:00', end: '17:00', startHour: 10.0, endHour: 17.0 },
    saturday: null,
    sunday: null
  },
  'lindenthal': {
    monday_thursday: { start: '07:30', end: '18:00', startHour: 7.5, endHour: 18.0 },
    friday: { start: '07:30', end: '16:00', startHour: 7.5, endHour: 16.0 },
    saturday: null,
    sunday: null
  },
  'muho': {
    weekdays: { start: '11:30', end: '14:30', startHour: 11.5, endHour: 14.5 },
    saturday: null,
    sunday: null
  },
  'robertkoch': {
    weekdays: { start: '11:00', end: '15:00', startHour: 11.0, endHour: 15.0 },
    saturday: null,
    sunday: null
  },
  'leverkusen': {
    weekdays: { start: '11:30', end: '14:00', startHour: 11.5, endHour: 14.0 },
    saturday: null,
    sunday: null
  },
  'zollstock': {
    weekdays: { start: '11:30', end: '14:30', startHour: 11.5, endHour: 14.5 },
    saturday: null,
    sunday: null
  },
  'philcafe': {
    monday_thursday: { start: '08:00', end: '17:00', startHour: 8.0, endHour: 17.0 },
    friday: { start: '08:00', end: '15:00', startHour: 8.0, endHour: 15.0 },
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
        (dayOfWeek >= 1 && dayOfWeek <= 5 && (lineLower.includes('mo - fr') || lineLower.includes('mo - do')));

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
      formatted: lang === 'de' ? 'Geschlossen' : 'Closed'
    };
  }

  const suffix = lang === 'de' ? ' Uhr' : '';
  return {
    isOpenToday: true,
    startHour: window.startHour,
    endHour: window.endHour,
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
