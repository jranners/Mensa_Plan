import { describe, it, expect } from 'vitest';
import { needsRefresh, DEFAULT_THROTTLE_MS, MAX_CACHE_AGE_MS } from '../src/lib/lifecycle.js';

describe('App Lifecycle & Resume Logic (needsRefresh)', () => {
  const baseTime = 1760000000000; // arbitrary timestamp

  it('throttles rapid checks within minIntervalMs on the same calendar day', () => {
    const lastCheck = baseTime;
    const now = baseTime + 15000; // 15 seconds later (< 30s)
    const result = needsRefresh(baseTime, now, '2026-10-05', lastCheck, {
      currentBerlinDay: '2026-10-05'
    });

    expect(result.throttled).toBe(true);
    expect(result.action).toBe('none');
    expect(result.shouldRerender).toBe(false);
    expect(result.shouldFetchBackground).toBe(false);
    expect(result.shouldUpdateActiveDate).toBe(false);
  });

  it('allows check after minIntervalMs on the same day without expired cache', () => {
    const lastCheck = baseTime;
    const now = baseTime + 35000; // 35 seconds later (> 30s)
    const lastFetch = baseTime - 10 * 60 * 1000; // 10 minutes ago
    const result = needsRefresh(lastFetch, now, '2026-10-05', lastCheck, {
      currentBerlinDay: '2026-10-05'
    });

    expect(result.throttled).toBe(false);
    expect(result.action).toBe('status_update');
    expect(result.dayChanged).toBe(false);
    expect(result.shouldRerender).toBe(true); // Re-renders to update canteen opening badges
    expect(result.shouldFetchBackground).toBe(false);
    expect(result.shouldUpdateActiveDate).toBe(false);
  });

  it('detects calendar day change and does NOT throttle even if lastCheck was recent', () => {
    const lastCheck = baseTime;
    const now = baseTime + 5000; // only 5 seconds later
    // Overnight transition: lastRenderedDay is Oct 4th, now is Oct 5th
    const result = needsRefresh(baseTime - 3600000, now, '2026-10-04', lastCheck, {
      currentBerlinDay: '2026-10-05'
    });

    expect(result.throttled).toBe(false);
    expect(result.dayChanged).toBe(true);
    expect(result.action).toBe('day_changed');
    expect(result.shouldUpdateActiveDate).toBe(true);
    expect(result.shouldFetchBackground).toBe(true);
    expect(result.shouldRerender).toBe(true);
  });

  it('triggers background fetch when cache is older than 60 minutes on the same day', () => {
    const lastFetch = baseTime;
    const now = baseTime + 65 * 60 * 1000; // 65 minutes later (> 60m)
    const lastCheck = baseTime;
    const result = needsRefresh(lastFetch, now, '2026-10-05', lastCheck, {
      currentBerlinDay: '2026-10-05'
    });

    expect(result.throttled).toBe(false);
    expect(result.dayChanged).toBe(false);
    expect(result.action).toBe('cache_expired');
    expect(result.shouldUpdateActiveDate).toBe(false);
    expect(result.shouldFetchBackground).toBe(true);
    expect(result.shouldRerender).toBe(true);
  });

  it('triggers background fetch when lastFetch is null or 0', () => {
    const now = baseTime + 40000;
    const result = needsRefresh(null, now, '2026-10-05', 0, {
      currentBerlinDay: '2026-10-05'
    });

    expect(result.throttled).toBe(false);
    expect(result.action).toBe('cache_expired');
    expect(result.shouldFetchBackground).toBe(true);
    expect(result.shouldRerender).toBe(true);
  });

  it('derives Europe/Berlin date automatically when currentBerlinDay option is omitted', () => {
    // 2026-10-04T22:30:00Z is 2026-10-05 00:30:00 in Berlin (CEST = UTC+2)
    const cestMidnight = Date.parse('2026-10-04T22:30:00.000Z');
    const result = needsRefresh(cestMidnight - 10000, cestMidnight, '2026-10-04', 0);

    expect(result.currentBerlinDay).toBe('2026-10-05');
    expect(result.dayChanged).toBe(true);
    expect(result.action).toBe('day_changed');
    expect(result.shouldUpdateActiveDate).toBe(true);
  });
});
