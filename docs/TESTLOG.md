# Testlog – Mensa Plan PWA

## Paket M0: Test- und Modul-Fundament (04.10.2026)
- **Geprüft**:
  - ES-Module Umstellung (`data/*.js` exportieren Konstanten, `app.js` importiert sie, `index.html` nutzt `type="module"`).
  - Vitest Einrichtung (`npm test` führt `tests/smoke.test.js` aus).
  - `npm run build:css` (Tailwind kompiliert erfolgreich).
  - `node --check` auf allen modifizierten JS-Dateien.
- **Ergebnis**: 4/4 Tests bestanden, CSS erfolgreich minifiziert, Syntax fehlerfrei.
## Paket S1 & S2: Allergenfilter & Diät-Sicherheit (04.10.2026)
- **Geprüft**:
  - `tests/allergens-diet.test.js`: 16 Unittests für Drei-Stufen-Modell, Rohe-Code-Auswertung, Erkennung von Widersprüchen (Vegan + Ei/Milch), Kombigerichte mit Dessert-Komponenten, Gerichte ohne Kennzeichnung, Diät-Erkennung (VGN, VGT, Fallbacks).
  - Verifikation gegen echte RPC-Beispieldaten (`docs/rpc-sample.json`).
  - `node --check` auf allen modifizierten/neuen Skripten.
  - `npm run build:css` (Tailwind-Kompilierung).
  - Integration in `app.js` (`renderMainDishCard`, `renderCompactDishCard`, `showAllergens`, `findDishById`).
- **Ergebnis**: 20/20 Tests bestanden. Service Worker auf `kstw-mensa-v44` aktualisiert.
- **Offene Probleme**: Keine.

## Paket S3: Inline-Handler & CSP-Härtung (04.10.2026)
- **Geprüft**:
  - Sämtliche `onclick` und `onerror` Attribute in `index.html` und `app.js` eliminiert.
  - Event Delegation für `[data-action]` implementiert (`change-language`, `change-diet-preference`, `reset-app`, `trigger-manual-reload`, `set-active-date`, `set-diet-filter`, `show-allergens`, `close-allergens-modal`, `toggle-clamp`, `fetch-and-render`).
  - `theme-init.js` als Standalone-Skript im `<head>` eingebunden, synchron ausgeführt (kein White Flash).
  - CSP: `'unsafe-inline'` aus `script-src` entfernt (`script-src 'self'`).
  - Modal-A11y: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape-Taste schließt Modals.
  - `node --check` auf `theme-init.js`, `app.js`, `sw.js`.
  - `npm test` (20/20 Vitest Tests erfolgreich).
  - `npm run build:css` (Tailwind Build erfolgreich).
- **Ergebnis**: Alle Tests bestanden, CSP gehärtet, Service Worker auf `kstw-mensa-v45` aktualisiert.
- **Offene Probleme**: Keine.

## Paket S4: Escape vereinheitlichen & XSS-Audit (04.10.2026)
- **Geprüft**:
  - `escapeHtml` und `escapeHTML` vereinheitlicht in `src/lib/html.js`.
  - `tests/html.test.js` mit 4 Vitest-Tests für Sonderzeichen, Null, Undefined, Zahlen und leere Strings.
  - Audit aller `innerHTML`-Stellen in `app.js` (u.a. Escaping von Mensa-Daten, Preisen, Titeln und Ankündigungen).
  - `node --check` auf `src/lib/html.js`, `app.js`, `sw.js`.
  - `npm test` (24/24 Vitest Tests bestanden).
  - `npm run build:css` (Tailwind Build erfolgreich).
- **Ergebnis**: Alle Tests bestanden, Service Worker auf `kstw-mensa-v46` aktualisiert.
- **Offene Probleme**: Keine.

## Paket L1: Datum, Zeit & Woche – Zentralisierung & Zeitzonensicherheit (04.10.2026)
- **Geprüft**:
  - `src/lib/dates.js`: `getBerlinTodayDate`, `parseIsoParts`, `getDayOfWeekFromIso`, `getFetchDateRange`, `formatDateSelector`, `formatDateHeader`, `pickActiveDate`.
  - `tests/dates.test.js`: 14 Unittests für Berlin-Zeitzonenbestimmung (Sommerzeit/Winterzeit über UTC-Grenzen), UTC-Parsing-Sicherheit bei ISO-Strings, Wochentagsbestimmung (Schaltjahre, Jahreswechsel), 14-Tage-Berechnung bei Sonntagen und Monatsgrenzen, und aktive Datumswahl (Wochenende, Feierabend, Präferenz-Erhalt).
  - Integration in `app.js`: 3-fache Duplizierung der aktiven Datumsauswahl eliminiert, Datumsleiste und Header auf zeitzonensichere Helfer umgestellt.
  - `node --check` auf `src/lib/dates.js`, `app.js`, `sw.js`.
  - `npm test` (38/38 Vitest Tests bestanden).
  - `npm run build:css` (Tailwind Build erfolgreich).
- **Ergebnis**: Alle Tests bestanden, Service Worker auf `kstw-mensa-v47` aktualisiert.
- **Offene Probleme**: Keine.

## Paket L2: App-Lebenszyklus & Background-Refresh (`visibilitychange`, `pageshow`)
- **Geprüft**:
  - `src/lib/lifecycle.js` mit Funktion `needsRefresh(lastFetchTime, now, lastRenderedDay, lastCheckTime, options)`.
  - 6 neue Unit-Tests in `tests/lifecycle.test.js`:
    - Drosselung schneller Wechsel (< 30s) am selben Tag (`throttled: true`).
    - Wiederkehr nach > 30s am selben Tag ohne Cache-Ablauf löst UI-Re-Render für Öffnungsstatus aus (`action: 'status_update'`).
    - Datumswechsel über Mitternacht/Tage hinweg erzwingt sofortige Aktualisierung von Datum, Re-Render und Menü-Abruf, auch bei schnellem Wechsel (`action: 'day_changed'`).
    - Cache-Ablauf nach > 60 Minuten löst Hintergrundabruf aus (`action: 'cache_expired'`).
    - Ungültiger/Fehlender Cache-Zeitpunkt löst Hintergrundabruf aus.
    - Automatische Zeitzonenauflösung Europe/Berlin (inkl. CEST Mitternachtsgrenzen).
  - Integration in `app.js`: Event-Listener für `visibilitychange` und `pageshow`, Speicherung von `state.lastRenderedDay` und `state.lastLifecycleCheckTime`.
  - `sw.js`: `CACHE_NAME` auf `kstw-mensa-v48` erhöht und `./src/lib/lifecycle.js` zu `STATIC_ASSETS` hinzugefügt.
  - `node --check app.js`, `node --check sw.js`, `node --check src/lib/lifecycle.js`.
  - `npm test` (45/45 Vitest Tests bestanden).
  - `npm run build:css` (Tailwind Build erfolgreich).
- **Ergebnis**: Alle Tests bestanden, Service Worker auf `kstw-mensa-v48` aktualisiert.
- **Offene Probleme**: Keine.

## Paket L3: Einstellungs-Zustand & Scoped Reset
- **Geprüft**:
  - `src/lib/storage.js` mit `resetAppStorage` und `createSettingsDraft`.
  - 3 neue Unit-Tests in `tests/storage.test.js`:
    - `resetAppStorage` löscht alle Voreinstellungen und Caches (`kstw_prefs_saved`, `kstw_lang`, `kstw_canteens`, `kstw_diet`, `kstw_allergies`, `kstw_menu_cache*`, `kstw_announcements_cache`).
    - `resetAppStorage` behält `kstw_theme`, `kstw_favorites` und fremde Domain-Schlüssel unberührt.
    - `createSettingsDraft` erzeugt eine isolierte Deep-Copy der Einstellungen; Modifikationen am Draft verändern den globalen `state` nicht.
  - Integration in `app.js`:
    - Einstellungsdialog nutzt isolierten `settingsDraft`. Änderungen an Checkboxen, Diät-Pills oder Sprache modifizieren nur den Entwurf.
    - Speichern („Speichern“ / `#submit-onboarding-btn`) übernimmt den Entwurf in `state` und persistiert in `localStorage`.
    - Verwerfen per „X“-Button, Escape-Taste oder Klick auf den Backdrop verwirft `settingsDraft` und stellt den vorherigen Zustand wieder her.
    - Zwei-Schritt-Reset: Klick auf „Voreinstellungen zurücksetzen“ zeigt Bestätigungs-Buttons („Wirklich zurücksetzen?“ / „Abbrechen“) statt sofortigem Wipe.
    - Zweisprachige Texte (`resetConfirmBtn`, `resetCancelBtn`) in `data/translations.js` (DE & EN).
  - `sw.js`: `CACHE_NAME` auf `kstw-mensa-v49` erhöht und `./src/lib/storage.js` zu `STATIC_ASSETS` hinzugefügt.
  - `node --check app.js`, `node --check sw.js`, `node --check src/lib/storage.js`, `node --check data/translations.js`.
  - `npm test` (49/49 Vitest Tests bestanden).
  - `npm run build:css` (Tailwind Build erfolgreich).
- **Ergebnis**: Alle Tests bestanden, Service Worker auf `kstw-mensa-v49` aktualisiert.
- **Offene Probleme**: Keine.

## Paket L4: Service Worker Bereinigung & Update-Dialog
- **Geprüft**:
  - `sw.js`:
    - `CACHE_NAME` auf `kstw-mensa-v50` erhöht.
    - Format `const CACHE_NAME = 'kstw-mensa-v50';` entspricht exakt dem Regex aus `scripts/update-key.js`.
    - Toter Code entfernt: `API_CACHE_NAME` und „Strategie A“ (Stale-While-Revalidate für Supabase POST) eliminiert.
    - `activate`-Handler löscht alle Alt-Caches (`cache !== CACHE_NAME`).
    - Fehlerbehandlung in `install`: wirft nun Fehler bei fehlenden Assets (`throw new Error(...)`), sodass die Installation fehlschlägt und ein vorheriger funktionierender Service Worker aktiv bleibt.
    - PWA-Icons (`./icons/icon-192.png`, `./icons/icon-512.png`) zu `STATIC_ASSETS` hinzugefügt.
  - 4 neue Unit-Tests in `tests/sw.test.js`:
    - Validierung des Scraper-Regex für `CACHE_NAME`.
    - Überprüfung der Existenz aller in `STATIC_ASSETS` aufgeführten Dateien auf der Festplatte.
    - Bestätigung der Icon-Präsenz in `STATIC_ASSETS`.
    - Bestätigung der Entfernung von totem API-Cache-Code.
  - Integration in `app.js`:
    - Reentrancy-Guard (`appReloading`) für `reloadWithCacheBust()`, verhindert doppelten Reload zwischen `controllerchange` und Fallback-Timer.
    - Update-Dialog: Button „Später“ hinzugefügt, stoppt Countdown/Auto-Reload und schließt den Dialog.
    - `cleanUpdateUrlParam`: entfernt den Cache-Bust-Parameter `?u=` nach dem Neuladen via `window.history.replaceState`.
  - `node --check app.js`, `node --check sw.js`.
  - `npm test` (53/53 Vitest Tests bestanden).
  - `npm run build:css` (Tailwind Build erfolgreich).
- **Ergebnis**: Alle Tests bestanden, Service Worker auf `kstw-mensa-v50` aktualisiert.
## Paket L5: RPC-Response-Validierung & LocalStorage Schema-Version v2 (04.10.2026)
- **Geprüft**:
  - `src/lib/validation.js`:
    - `validateWeekMenu`: Überprüft, dass Payloads Arrays sind, Elemente Objekte sind, `id` (Zahl oder String), `date` (ISO-Format `YYYY-MM-DD`) und String-Kategorie (`category_ger` oder `category_en`) vorhanden sind.
    - `validateAnnouncements`: Überprüft Array-Struktur, Pflichtfelder `id` und `text`.
  - `src/lib/storage.js`:
    - `CURRENT_SCHEMA_VERSION = 2` und `SCHEMA_VERSION_KEY = 'kstw_schema_version'`.
    - `migrateStorage()`: Migration v1 -> v2 stellt valide Formate für `kstw_canteens` (Array), `kstw_allergies` (Array), `kstw_diet` (`vegan|vegetarian|all`) und `kstw_lang` (`de|en`) sicher, invalidiert defekte Menü-Caches und setzt Version 2 idempotent.
  - 10 Unittests in `tests/validation.test.js`:
    - Validierung gegen echte RPC-Beispieldaten (`docs/rpc-sample.json`).
    - Abfangen von Nicht-Arrays, fehlerhaften Elementen, fehlenden Pflichtfeldern, ungültigem Datumsformat.
    - Validierung von `announcements`.
    - Vollständiger Migrationslauf v1 -> v2 mit bereinigtem Storage und intaktem Schema.
  - Integration in `app.js`:
    - Aufruf von `migrateStorage()` im `DOMContentLoaded`-Handler vor `loadPreferences()`.
    - Validierung beim Laden des Menü-Caches (`loadMenuCache`) und Ankündigungs-Caches (`loadAnnouncementsCache`) mit Cache-Purge bei Schema-Fehlern.
    - Validierung bei Live-Abrufen (`fetchWeekMenuData` und `fetchAnnouncements`) mit klarer Fehlerbehandlung.
  - `sw.js`:
    - `CACHE_NAME` auf `kstw-mensa-v51` erhöht.
    - `./src/lib/validation.js` zu `STATIC_ASSETS` hinzugefügt.
  - `node --check` auf `src/lib/validation.js`, `src/lib/storage.js`, `app.js`, `sw.js`.
  - `npm test` (64/64 Vitest Tests bestanden).
  - `npm run build:css` (Tailwind Build erfolgreich).
- **Ergebnis**: Alle Tests bestanden, Service Worker auf `kstw-mensa-v51` aktualisiert.
- **Offene Probleme**: Keine.



