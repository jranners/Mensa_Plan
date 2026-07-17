# Project Rules – Mensa Plan PWA

## Service Worker Cache Versioning (CRITICAL)
**Every time** code changes are committed and pushed, the `CACHE_NAME` version in `sw.js` (line 1) **MUST** be incremented (e.g. `v25` → `v26`).
Without this, client browsers will never detect an update and will keep serving stale cached files indefinitely.
This applies to changes in **any** file that is listed in `STATIC_ASSETS` inside `sw.js`: `app.js`, `index.html`, `styles.css`, `data/*.js`, etc.

## Allergen Data Handling
- Dishes without allergen declarations must **never** be hidden/excluded from the menu.
- When a user has allergen filters active and a dish has no allergen data, show a visible warning badge on that dish card (e.g. "Keine Allergen-Info – bitte Personal fragen").
- The allergen filter only excludes dishes that **positively** contain a selected allergen code.
