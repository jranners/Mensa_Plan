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
