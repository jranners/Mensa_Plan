# Project Rules – Mensa Plan PWA

## Service Worker Cache Versioning (CRITICAL)
**Every time** code changes are committed and pushed, the `CACHE_NAME` version in `sw.js` (line 1) **MUST** be incremented (e.g. `v25` → `v26`).
Without this, client browsers will never detect an update and will keep serving stale cached files indefinitely.
This applies to changes in **any** file that is listed in `STATIC_ASSETS` inside `sw.js`: `app.js`, `index.html`, `styles.css`, `data/*.js`, etc.

## Allergen Data Handling
- Dishes without allergen declarations must **never** be hidden/excluded from the menu.
- When a user has allergen filters active and a dish has no allergen data, show a visible warning badge on that dish card (e.g. "Keine Allergen-Info – bitte Personal fragen").
- The allergen filter only excludes dishes that **positively** contain a selected allergen code.

## Missing Dishes & Menu Verification (CRITICAL)
- Whenever the user reports that dishes are missing for a Mensa or Bistro, **ALWAYS** check `https://www.kstw.de/speiseplan/` (and its embedded `https://app.cloudmensa.io/menu/kstw` client / `public_get_organization_by_slug` settings) for that specific Mensa/Bistro and day **in addition** to inspecting the raw Supabase RPC (`public_get_week_menu`) response.
- Compare the 1:1 dish list rendered on `https://www.kstw.de/speiseplan/` against the app's matched and classified dish list for that canteen and day to identify any discrepancies in RPC parameters (e.g. `p_dedup_fields`), screen-group mappings, or dish classification.

