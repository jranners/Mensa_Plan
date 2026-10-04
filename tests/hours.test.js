import { describe, it, expect } from 'vitest';
import { CANTEENS } from '../data/canteens.js';
import {
  formatDecimalHour,
  getCanteenHoursForDay,
  getCanteenOpenStatus
} from '../src/lib/hours.js';

describe('Hours Module', () => {
  it('formats decimal hours correctly', () => {
    expect(formatDecimalHour(11.5)).toBe('11:30');
    expect(formatDecimalHour(14.25)).toBe('14:15');
    expect(formatDecimalHour(7.5)).toBe('07:30');
    expect(formatDecimalHour(21)).toBe('21:00');
  });

  it('retrieves weekday opening hours', () => {
    // Monday (1)
    const deutzMon = getCanteenHoursForDay('iwz-deutz', 1, CANTEENS['iwz-deutz']);
    expect(deutzMon.isOpenToday).toBe(true);
    expect(deutzMon.startHour).toBe(11.5);
    expect(deutzMon.endHour).toBe(14.5);
    expect(deutzMon.formatted).toBe('11:30 - 14:30 Uhr');

    // Friday (5) specific for SpoHo (closes 14:15 instead of 14:30)
    const spohoFri = getCanteenHoursForDay('spoho', 5, CANTEENS['spoho']);
    expect(spohoFri.isOpenToday).toBe(true);
    expect(spohoFri.endHour).toBe(14.25);
    expect(spohoFri.formatted).toBe('11:15 - 14:15 Uhr');

    // Monday (1) for SpoHo (11:15 - 14:30)
    const spohoMon = getCanteenHoursForDay('spoho', 1, CANTEENS['spoho']);
    expect(spohoMon.endHour).toBe(14.5);
    expect(spohoMon.formatted).toBe('11:15 - 14:30 Uhr');
  });

  it('handles weekend opening hours correctly', () => {
    // Saturday (6) for Uni-Mensa (open 11:30 - 15:00)
    const uniSat = getCanteenHoursForDay('unimensa', 6, CANTEENS['unimensa']);
    expect(uniSat.isOpenToday).toBe(true);
    expect(uniSat.startHour).toBe(11.5);
    expect(uniSat.endHour).toBe(15.0);

    // Saturday (6) for Deutz (closed)
    const deutzSat = getCanteenHoursForDay('iwz-deutz', 6, CANTEENS['iwz-deutz']);
    expect(deutzSat.isOpenToday).toBe(false);
    expect(deutzSat.formatted).toBe('Geschlossen');

    // Sunday (0) for Uni-Mensa (closed)
    const uniSun = getCanteenHoursForDay('unimensa', 0, CANTEENS['unimensa'], 'en');
    expect(uniSun.isOpenToday).toBe(false);
    expect(uniSun.formatted).toBe('Closed');
  });

  it('computes canteen open status correctly', () => {
    const hours = {
      isOpenToday: true,
      startHour: 11.5,
      endHour: 14.5
    };

    // Before opening: 10:30 (10.5)
    const statusBefore = getCanteenOpenStatus(hours, 10.5);
    expect(statusBefore.isOpen).toBe(false);
    expect(statusBefore.opensLater).toBe(true);
    expect(statusBefore.isClosed).toBe(false);
    expect(statusBefore.minutesUntilOpen).toBe(60);

    // During opening: 12:00 (12.0)
    const statusOpen = getCanteenOpenStatus(hours, 12.0);
    expect(statusOpen.isOpen).toBe(true);
    expect(statusOpen.opensLater).toBe(false);
    expect(statusOpen.isClosed).toBe(false);
    expect(statusOpen.minutesUntilClose).toBe(150);

    // After closing: 14:31 (~14.52)
    const statusAfter = getCanteenOpenStatus(hours, 14.6);
    expect(statusAfter.isOpen).toBe(false);
    expect(statusAfter.opensLater).toBe(false);
    expect(statusAfter.isClosed).toBe(true);

    // Closed day
    const statusClosedDay = getCanteenOpenStatus({ isOpenToday: false, startHour: 0, endHour: 0 }, 12.0);
    expect(statusClosedDay.isOpen).toBe(false);
    expect(statusClosedDay.isClosed).toBe(true);
  });
});
