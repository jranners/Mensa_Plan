import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TRANSLATIONS } from '../data/translations.js';

describe('Translations Parity & Integrity', () => {
  it('has identical keys for both German and English', () => {
    const deKeys = Object.keys(TRANSLATIONS.de).sort();
    const enKeys = Object.keys(TRANSLATIONS.en).sort();

    expect(deKeys).toEqual(enKeys);
  });

  it('contains no empty strings or undefined values', () => {
    const allowEmptyInEn = new Set(['announcementTimeSuffix', 'hoursSuffix']);
    for (const [lang, table] of Object.entries(TRANSLATIONS)) {
      for (const [key, val] of Object.entries(table)) {
        expect(typeof val, `${lang}.${key} should be string`).toBe('string');
        if (lang === 'en' && allowEmptyInEn.has(key)) continue;
        expect(val.trim().length, `${lang}.${key} should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it('contains all required modernization and Stage 3 translation keys in both DE and EN', () => {
    const requiredKeys = [
      'menuSettingsDesc',
      'menuStatsDesc',
      'statsPriceChartTitle',
      'statsChartExplainRaw',
      'statsChartSelection',
      'statsChartSelectHint',
      'statsDishesCount',
      'statsLoadError',
      'retryBtn',
      'canteenGroupMensen',
      'canteenGroupBistros',
      'announcementAsOf',
      'announcementTimeSuffix',
      'brandSocialMeal',
      'brandBuffet',
      'brandSide',
      'brandDish',
      'subTagSocial',
      'subTagClassic',
      'subTagAction',
      'menuForPrefix',
      'allergensLabel',
      'allergensModalTitle',
      'allCanteensClosedToday',
      'sharedWithLindenthal',
      'excludePorkLabel',
      'excludePorkDesc',
      'speciesPoultry',
      'speciesPork',
      'speciesBeef',
      'speciesFish',
      'speciesNeuland',
      'speciesDisclaimer',
      'trayAddAria',
      'trayRemoveAria',
      'trayTitle',
      'trayIncludedSide',
      'trayClearBtn',
      'trayShareBtn',
      'trayEmptyHint',
      'shareDayPlanBtn',
      'exportCalendarAria',
      'searchPlaceholder',
      'quickFilterFavorites',
      'quickFilterBudget',
      'quickFilterNoPork',
      'favoritesRadarTitle',
      'favoritesRadarUpcoming',
      'favoritesRadarNoneUpcoming',
      'favoritesRadarCycleAvg',
      'favoritesRadarLastSeen'
    ];

    for (const key of requiredKeys) {
      expect(typeof TRANSLATIONS.de[key], `de.${key} should be defined`).toBe('string');
      expect(typeof TRANSLATIONS.en[key], `en.${key} should be defined`).toBe('string');
      expect(TRANSLATIONS.de[key].trim().length, `de.${key} should not be empty`).toBeGreaterThan(0);
      if (key !== 'announcementTimeSuffix') {
        expect(TRANSLATIONS.en[key].trim().length, `en.${key} should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it('contains all t.<key> properties referenced in app.js and src/ui/*.js', () => {
    const filesToScan = [
      'app.js',
      'src/ui/cards.js',
      'src/ui/feed.js',
      'src/ui/modals.js',
      'src/ui/settings.js',
      'src/ui/stats-modal.js',
      'src/ui/sw-update.js',
      'src/ui/toast.js',
      'src/ui/tray-calendar.js'
    ];
    const combinedSrc = filesToScan
      .map((f) => readFileSync(resolve(process.cwd(), f), 'utf8'))
      .join('\n');

    const deKeys = new Set(Object.keys(TRANSLATIONS.de));
    const matches = combinedSrc.match(/\bt\.([a-zA-Z0-9_]+)\b/g) || [];
    const usedKeys = new Set();

    const domIgnore = new Set([
      'getElementById', 'add', 'createElement', 'body', 'remove', 'id',
      'className', 'innerHTML', 'classList', 'parentNode', 'execCommand',
      'documentElement', 'toggle', 'addEventListener', 'closest', 'action',
      'visibilityState', 'keys', 'querySelectorAll', 'value', 'label',
      'prompt', 'userChoice', 'outcome', 'readyState', 'textContent', 'split',
      'indexOf', 'substring', 'contains', 'key'
    ]);

    for (const m of matches) {
      const prop = m.replace('t.', '');
      if (!domIgnore.has(prop)) {
        usedKeys.add(prop);
      }
    }

    for (const key of usedKeys) {
      expect(deKeys.has(key), `Missing translation key in TRANSLATIONS.de: ${key}`).toBe(true);
    }
  });
});
