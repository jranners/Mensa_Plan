import { describe, it, expect } from 'vitest';
import {
  getBerlinTodayDate,
  getBerlinHourDecimal,
  parseIsoParts,
  getDayOfWeekFromIso,
  getFetchDateRange,
  formatDateSelector,
  formatDateHeader,
  pickActiveDate,
  getAllowedMenuDates
} from '../src/lib/dates.js';

describe('dates module', () => {
  describe('getBerlinTodayDate and getBerlinHourDecimal', () => {
    it('correctly formats Berlin date across UTC boundaries (CEST UTC+2)', () => {
      // 2026-10-04 22:30:00 UTC is 2026-10-05 00:30:00 in Berlin (CEST)
      const dateInUtc = new Date('2026-10-04T22:30:00Z');
      expect(getBerlinTodayDate(dateInUtc)).toBe('2026-10-05');
      expect(getBerlinHourDecimal(dateInUtc)).toBe(0.5);
    });

    it('correctly formats Berlin date and decimal hour during CET (winter time UTC+1)', () => {
      // 2026-12-15 23:30:00 UTC is 2026-12-16 00:30:00 in Berlin (CET)
      const dateInUtc = new Date('2026-12-15T23:30:00Z');
      expect(getBerlinTodayDate(dateInUtc)).toBe('2026-12-16');
      expect(getBerlinHourDecimal(dateInUtc)).toBe(0.5);
    });

    it('calculates midday Berlin decimal hour accurately', () => {
      // 2026-10-05 10:15:00 UTC is 12:15 in Berlin (CEST UTC+2) -> 12.25
      const middayUtc = new Date('2026-10-05T10:15:00Z');
      expect(getBerlinHourDecimal(middayUtc)).toBe(12.25);
    });
  });

  describe('parseIsoParts and getDayOfWeekFromIso', () => {
    it('parses valid ISO parts correctly', () => {
      expect(parseIsoParts('2026-10-05')).toEqual({ year: 2026, month: 10, day: 5 });
      expect(parseIsoParts('invalid')).toBeNull();
      expect(parseIsoParts(null)).toBeNull();
    });

    it('determines day of week accurately without timezone shifts', () => {
      // 2026-10-05 is Monday
      expect(getDayOfWeekFromIso('2026-10-05')).toBe(1);
      // 2026-10-10 is Saturday
      expect(getDayOfWeekFromIso('2026-10-10')).toBe(6);
      // 2026-10-11 is Sunday
      expect(getDayOfWeekFromIso('2026-10-11')).toBe(0);
      // Leap year 2028-02-29 is Tuesday
      expect(getDayOfWeekFromIso('2028-02-29')).toBe(2);
    });
  });

  describe('getFetchDateRange', () => {
    it('anchors to 3 days before Monday on a Wednesday and spans to Sunday 2 weeks later', () => {
      // Wednesday 2026-10-07 -> Monday is 2026-10-05 -> 3 days before is Friday 2026-10-02
      const wednesday = new Date('2026-10-07T12:00:00Z');
      const { startDate, endDate } = getFetchDateRange(wednesday);
      expect(startDate).toBe('2026-10-02'); // Friday before Monday
      expect(endDate).toBe('2026-10-18');   // Sunday 2 weeks later
    });

    it('anchors to 3 days before Monday on Sunday and spans to next Sunday', () => {
      // Sunday 2026-10-11 -> Monday is 2026-10-05 -> 3 days before is Friday 2026-10-02
      const sunday = new Date('2026-10-11T12:00:00Z');
      const { startDate, endDate } = getFetchDateRange(sunday);
      expect(startDate).toBe('2026-10-02'); // Friday before Monday of ending week
      expect(endDate).toBe('2026-10-18');   // Sunday of coming week
    });

    it('handles month transitions correctly', () => {
      // Thursday 2026-10-01 (October 1) -> Monday is 2026-09-28 -> 3 days before is Friday 2026-09-25
      const oct1 = new Date('2026-10-01T12:00:00Z');
      const { startDate, endDate } = getFetchDateRange(oct1);
      expect(startDate).toBe('2026-09-25'); // Friday before Monday in September
      expect(endDate).toBe('2026-10-11');   // Sunday in October
    });
  });

  describe('formatDateSelector and formatDateHeader', () => {
    it('formats today as "Heute" / "Today"', () => {
      expect(formatDateSelector('2026-10-05', '2026-10-05', 'de').dayName).toBe('Heute');
      expect(formatDateSelector('2026-10-05', '2026-10-05', 'en').dayName).toBe('Today');
      expect(formatDateSelector('2026-10-05', '2026-10-05', 'de').isToday).toBe(true);
      expect(formatDateSelector('2026-10-05', '2026-10-05', 'de').isYesterday).toBe(false);
    });

    it('formats yesterday as "Gestern" / "Yesterday"', () => {
      const de = formatDateSelector('2026-10-05', '2026-10-06', 'de');
      expect(de.dayName).toBe('Gestern');
      expect(de.isYesterday).toBe(true);
      expect(de.isToday).toBe(false);
      expect(de.label).toBe('Gestern');

      const en = formatDateSelector('2026-10-05', '2026-10-06', 'en');
      expect(en.dayName).toBe('Yesterday');
      expect(en.isYesterday).toBe(true);
      expect(en.isToday).toBe(false);
      expect(en.label).toBe('Yesterday');
    });

    it('formats past day before yesterday with weekday and number (e.g. Friday when today is Monday)', () => {
      const de = formatDateSelector('2026-10-02', '2026-10-05', 'de');
      expect(de.dayName).toBe('Fr');
      expect(de.dayNum).toBe('2');
      expect(de.label).toBe('Fr 2');
      expect(de.isYesterday).toBe(false);
      expect(de.isToday).toBe(false);

      const en = formatDateSelector('2026-10-02', '2026-10-05', 'en');
      expect(en.dayName).toBe('Fri');
      expect(en.dayNum).toBe('2');
      expect(en.label).toBe('Fri 2');
      expect(en.isYesterday).toBe(false);
      expect(en.isToday).toBe(false);
    });

    it('formats future days with weekday and day number', () => {
      const de = formatDateSelector('2026-10-06', '2026-10-05', 'de');
      expect(de.dayName).toBe('Di');
      expect(de.dayNum).toBe('6');
      expect(de.label).toBe('Di 6');

      const en = formatDateSelector('2026-10-06', '2026-10-05', 'en');
      expect(en.dayName).toBe('Tue');
      expect(en.dayNum).toBe('6');
      expect(en.label).toBe('Tue 6');
    });

    it('formats date header in German and English', () => {
      const headerDe = formatDateHeader('2026-10-05', 'de');
      expect(headerDe).toContain('Montag');
      expect(headerDe).toContain('5');
      expect(headerDe).toContain('Oktober');

      const headerEn = formatDateHeader('2026-10-05', 'en');
      expect(headerEn).toContain('Monday');
      expect(headerEn).toContain('October');
    });
  });

  describe('getAllowedMenuDates', () => {
    it('returns empty array for invalid inputs', () => {
      expect(getAllowedMenuDates(null, '2026-10-05')).toEqual([]);
      expect(getAllowedMenuDates([], '2026-10-05')).toEqual([]);
      expect(getAllowedMenuDates([{ date: '2026-10-05', dishes: [] }], '')).toEqual([]);
    });

    it('excludes weekends and days without dishes', () => {
      const days = [
        { date: '2026-10-03', dishes: [{ id: 1 }] }, // Saturday
        { date: '2026-10-04', dishes: [{ id: 2 }] }, // Sunday
        { date: '2026-10-05', dishes: [] },           // Monday no dishes
        { date: '2026-10-06', dishes: [{ id: 3 }] }  // Tuesday has dishes
      ];
      const result = getAllowedMenuDates(days, '2026-10-05');
      expect(result.map(d => d.date)).toEqual(['2026-10-06']);
    });

    it('includes exactly 1 last past opening day plus all future open days', () => {
      const days = [
        { date: '2026-10-01', dishes: [{ id: 1 }] }, // Thursday (past day 1)
        { date: '2026-10-02', dishes: [{ id: 2 }] }, // Friday (past day 2 - last past day!)
        { date: '2026-10-05', dishes: [{ id: 3 }] }, // Monday (today)
        { date: '2026-10-06', dishes: [{ id: 4 }] }, // Tuesday (future)
        { date: '2026-10-07', dishes: [{ id: 5 }] }  // Wednesday (future)
      ];
      const result = getAllowedMenuDates(days, '2026-10-05');
      expect(result.map(d => d.date)).toEqual([
        '2026-10-02',
        '2026-10-05',
        '2026-10-06',
        '2026-10-07'
      ]);
    });

    it('handles case when there are no past days', () => {
      const days = [
        { date: '2026-10-05', dishes: [{ id: 1 }] },
        { date: '2026-10-06', dishes: [{ id: 2 }] }
      ];
      const result = getAllowedMenuDates(days, '2026-10-05');
      expect(result.map(d => d.date)).toEqual(['2026-10-05', '2026-10-06']);
    });
  });

  describe('pickActiveDate', () => {
    const datesWithMeals = ['2026-10-05', '2026-10-06', '2026-10-07'];
    const allAvailableDates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];

    it('selects today when today has available meals', () => {
      const selected = pickActiveDate({
        datesWithMeals,
        allAvailableDates,
        todayIso: '2026-10-05'
      });
      expect(selected).toBe('2026-10-05');
    });

    it('selects next available date when today has no meals (e.g. weekend/evening)', () => {
      const selected = pickActiveDate({
        datesWithMeals: ['2026-10-06', '2026-10-07'],
        allAvailableDates,
        todayIso: '2026-10-05'
      });
      expect(selected).toBe('2026-10-06');
    });

    it('preserves previously selected date if still valid in menu', () => {
      const selected = pickActiveDate({
        datesWithMeals,
        allAvailableDates,
        todayIso: '2026-10-05',
        previousActiveDate: '2026-10-07'
      });
      expect(selected).toBe('2026-10-07');
    });

    it('falls back gracefully when dates are empty', () => {
      const selected = pickActiveDate({
        datesWithMeals: [],
        allAvailableDates: [],
        todayIso: '2026-10-05'
      });
      expect(selected).toBe('2026-10-05');
    });
  });
});
