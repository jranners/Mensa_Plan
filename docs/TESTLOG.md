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
