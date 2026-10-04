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
    for (const [lang, table] of Object.entries(TRANSLATIONS)) {
      for (const [key, val] of Object.entries(table)) {
        expect(typeof val, `${lang}.${key} should be string`).toBe('string');
        expect(val.trim().length, `${lang}.${key} should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it('contains all t.<key> properties referenced in app.js', () => {
    const appJs = readFileSync(resolve(process.cwd(), 'app.js'), 'utf8');
    // Find all accesses of form t.<property> where t is TRANSLATIONS
    // Exclude DOM property accesses like btn.dataset.dishName or e.target
    const deKeys = new Set(Object.keys(TRANSLATIONS.de));

    // Regex matching t.key where key is word
    const matches = appJs.match(/\bt\.([a-zA-Z0-9_]+)\b/g) || [];
    const usedKeys = new Set();

    // Built-in DOM / JS keywords that might collide with a variable named t
    const domIgnore = new Set([
      'getElementById', 'add', 'createElement', 'body', 'remove', 'id',
      'className', 'innerHTML', 'classList', 'parentNode', 'execCommand',
      'documentElement', 'toggle', 'addEventListener', 'closest', 'action',
      'visibilityState', 'keys', 'querySelectorAll', 'value', 'label',
      'prompt', 'userChoice', 'outcome', 'readyState', 'textContent', 'split',
      'indexOf', 'substring', 'contains'
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
