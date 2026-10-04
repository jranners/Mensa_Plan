import { describe, it, expect } from 'vitest';
import {
  getBerlinTodayDate,
  parseIsoParts,
  getDayOfWeekFromIso,
  getFetchDateRange,
  formatDateSelector,
  formatDateHeader,
  pickActiveDate
} from '../src/lib/dates.js';

describe('dates module', () => {
  describe('getBerlinTodayDate', () => {
    it('correctly formats Berlin date across UTC boundaries (CEST UTC+2)', () => {
      // 2026-10-04 22:30:00 UTC is 2026-10-05 00:30:00 in Berlin (CEST)
      const dateInUtc = new Date('2026-10-04T22:30:00Z');
      expect(getBerlinTodayDate(dateInUtc)).toBe('2026-10-05');
    });

    it('correctly formats Berlin date during CET (winter time UTC+1)', () => {
      // 2026-12-15 23:30:00 UTC is 2026-12-16 00:30:00 in Berlin (CET)
      const dateInUtc = new Date('2026-12-15T23:30:00Z');
      expect(getBerlinTodayDate(dateInUtc)).toBe('2026-12-16');
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
    it('anchors to Monday on a Wednesday and spans 14 days', () => {
      // Wednesday 2026-10-07
      const wednesday = new Date('2026-10-07T12:00:00Z');
      const { startDate, endDate } = getFetchDateRange(wednesday);
      expect(startDate).toBe('2026-10-05'); // Monday
      expect(endDate).toBe('2026-10-18');   // Sunday 2 weeks later
    });

    it('anchors to previous Monday on Sunday and spans to next Sunday', () => {
      // Sunday 2026-10-11
      const sunday = new Date('2026-10-11T12:00:00Z');
      const { startDate, endDate } = getFetchDateRange(sunday);
      expect(startDate).toBe('2026-10-05'); // Monday of ending week
      expect(endDate).toBe('2026-10-18');   // Sunday of coming week
    });

    it('handles month transitions correctly', () => {
      // Thursday 2026-10-01 (October 1)
      const oct1 = new Date('2026-10-01T12:00:00Z');
      const { startDate, endDate } = getFetchDateRange(oct1);
      expect(startDate).toBe('2026-09-28'); // Monday in September
      expect(endDate).toBe('2026-10-11');   // Sunday in October
    });
  });

  describe('formatDateSelector and formatDateHeader', () => {
    it('formats today as "Heute" / "Today"', () => {
      expect(formatDateSelector('2026-10-05', '2026-10-05', 'de')).toBe('Heute');
      expect(formatDateSelector('2026-10-05', '2026-10-05', 'en')).toBe('Today');
    });

    it('formats other days with weekday and day number', () => {
      expect(formatDateSelector('2026-10-06', '2026-10-05', 'de')).toBe('Di 6');
      expect(formatDateSelector('2026-10-06', '2026-10-05', 'en')).toBe('Tue 6');
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
