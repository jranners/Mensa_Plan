# Mensa Plan PWA – Analyse, Bugs und Feature-Ideen

Stand: 04.10.2026. Dieses Dokument ist für einen Coding-Agenten gedacht. Jeder Punkt ist eine eigenständige Checkbox und kann einzeln gelöscht oder bearbeitet werden. Es gibt bewusst keine Nummerierung.

## Hinweise für den Agenten

- Vor dem Fixen jeden Punkt im Code verifizieren. Die Analyse basiert auf `app.js` (fast vollständig gelesen) und `sw.js` (vollständig). Nicht gelesen: `styles.css`, `input.css`, `tailwind.config.js`, `icons.js`, `canteens.js`, `translations.js`, `allergens.js`, `manifest.json`, `scripts/*`, Workflow.
- Projektregel aus `.agents/AGENTS.md`: Bei jeder Code-Änderung `CACHE_NAME` in `sw.js` erhöhen (aktuell `kstw-mensa-v42`).
- Projektregel: Gerichte ohne Allergen-Angaben nie verstecken, sondern mit Warnbadge anzeigen. Der Allergenfilter schließt nur Gerichte aus, die einen gewählten Code positiv enthalten.
- Architektur: reine Client-PWA (Vanilla JS, Tailwind), Supabase-RPC `public_get_week_menu` (POST), `data/announcements.json` per GitHub Action, `localStorage` für Prefs und Cache.

## Kritisch: Sicherheit und Korrektheit

- [x] Allergenfilter rechnet auf bereinigten Codes: Behoben via Drei-Stufen-Sicherheitsmodell (contains, uncertain, unknown) in `src/lib/allergens.js`. Rohe Codes werden geprüft. Gerichte mit Hauptspeisen-Allergenen werden gefiltert, Dessert-Pool-Allergene und fehlende Angaben erhalten Warn-Badges. Widersprüche (z.B. Vegan + Ei) werden erkannt und als Warnung markiert.
- [x] Onboarding-Text in `index.html` widerspricht dem Code: Korrigiert in `index.html` und `data/translations.js` (DE & EN: Gerichte ohne Allergenangaben werden mit Warnhinweis angezeigt und nicht ausgeblendet).
- [x] Dauerhafter Hinweis "Angaben ohne Gewähr, im Zweifel Personal fragen" bei Allergen-Infos ergänzen: Eingebunden im Onboarding und im `#allergens-modal` mit zweisprachigem Footer.
- [x] Inline-Handler mit API-Daten: Alle Inline-Handler (`onclick=`, `onerror=`) durch semantische Buttons mit `data-action` und `data-dish-id` ersetzt. Zentraler delegierter Event-Listener auf `document` bindet alle Aktionen.
- [x] CSP in `index.html` enthält `script-src 'self' 'unsafe-inline'`: Inline-Theme-Skript nach `theme-init.js` ausgelagert, alle Inline-Handler eliminiert, `'unsafe-inline'` aus `script-src` der CSP gestrichen.
- [x] Zwei Escape-Funktionen `escapeHtml` und `escapeHTML` mit unterschiedlichem Verhalten: Zu einem getesteten Modul `src/lib/html.js` vereinheitlicht. Alle `innerHTML`-Stellen auditiert und gegen XSS abgesichert.
- [ ] Ankündigungen laufen nach 24 Stunden ab, gerechnet ab `dateFetched` (Scrape-Zeitpunkt). Eine Schließungsmeldung für nächste Woche verschwindet dadurch zu früh. Scraper soll echtes Datum oder Gültigkeit der Meldung liefern, Frontend darauf prüfen.

## Wahrscheinliche Bugs

- [x] Kein Refresh beim Zurückkehren in die App: Behoben in `src/lib/lifecycle.js` (`needsRefresh`) und `app.js` (`visibilitychange`, `pageshow`). Erkennt Datumswechsel (wählt aktives Datum neu, rendert neu und lädt frische Daten im Hintergrund), aktualisiert Cache im Hintergrund bei Alter > 60 Min und berechnet Öffnungsstatus/Badges neu bei Wiederkehr. Drosselung auf min. 30s Mindestabstand gegen Flackern. Mit Vitest getestet.
- [x] Ungespeicherte Einstellungen wirken trotzdem: Behoben via isoliertem `settingsDraft`-Zustand (`src/lib/storage.js` und `app.js`). Änderungen an Mensen, Diät, Allergenen und Sprache wirken im Einstellungsdialog nur auf den temporären Entwurf. Erst bei Klick auf „Speichern“ werden sie in `state` und `localStorage` übernommen. Schließen per X, Backdrop oder Escape verwirft den Entwurf und stellt den vorherigen Zustand vollständig wieder her.
- [x] Menü-Abruf ist ein POST, der Service Worker bricht bei `method !== 'GET'` ab: Toter Code „Strategie A“ (Stale-While-Revalidate für Supabase) und `API_CACHE_NAME` aus `sw.js` entfernt. Menü-Abrufe laufen sauber ungefiltert über das Netz, Offline-Cache wird zuverlässig im Client (`localStorage`) verwaltet.
- [x] Service-Worker-Installation: Fehler beim Laden eines Assets im `install`-Handler werfen nun einen Fehler (`throw new Error(...)`), sodass die Installation fehlschlägt und der vorherige lauffähige Service Worker aktiv bleibt. PWA-Icons `icons/icon-192.png` und `icons/icon-512.png` wurden zu `STATIC_ASSETS` hinzugefügt und per Vitest auf Dateisystem-Präsenz geprüft.
- [x] Update-Dialog: Doppelter Reload behoben durch `reloadWithCacheBust()` mit Reentrancy-Guard (`appReloading`), der Reload wird primär über `controllerchange` ausgeführt (mit 2500ms Fallback). Button „Später“ hinzugefügt, der den Countdown und Auto-Reload abbricht und den Dialog schließt. Cache-Bust-Query-Parameter `?u=` wird nach dem Neuladen via `history.replaceState` sauber aus der URL entfernt.
- [x] Mensa-Zuordnung: In `src/lib/canteen-match.js` überführt. Priorisiert exakten Vergleich von `ort_id`, prüft normalisierte Ortsnamen und Screens/Screen-Gruppen ohne gefährliche lose Teilstrings. Alle 232 Gerichte des RPC-Samples werden stabil zugeordnet. Mit Vitest getestet.
- [ ] Theken-Heuristik: Die Theke (EG Nord, MG Nord, MG Süd) wird teils aus Stichwörtern im Gerichtsnamen abgeleitet und doppelt im Code implementiert. Bei Änderungen zeigt die App falsche Orte als Fakt. Nur API-Felder verwenden oder als "vermutlich" kennzeichnen.
- [x] Öffnungszeiten werden aus Freitext `info.kurz` per String-Suche ("Mo - Fr", Standardende 14:30) geparst: Durch strukturierte Öffnungszeiten (`CANTEEN_HOURS`) und Status-Berechnung in `src/lib/hours.js` abgelöst. Berücksichtigt Wochentage, Freitag-Sonderzeiten (z.B. SpoHo 14:15, E-Raum 15:00), Samstagszeiten der Uni-Mensa und Sonntage. Zeitzonensicher mit `getDayOfWeekFromIso` angebunden. Mit Vitest getestet.
- [x] Pull-to-Refresh: `startY` wird in `touchend` und `touchcancel` bedingungslos zurückgesetzt, sodass veraltete Touch-Werte keine falschen Pulls mehr auslösen. Der Indikatortext (`#ptr-indicator-text`) ist zweisprachig angebunden (`pullToRefresh` in DE & EN) und reagiert dynamisch auf Sprachwechsel.
- [x] `resetApp` ruft `localStorage.clear()` auf: Behoben via `resetAppStorage` in `src/lib/storage.js`. Löscht gezielt nur Voreinstellungen und Menü-/Ankündigungs-Caches (`kstw_prefs_saved`, `kstw_lang`, `kstw_canteens`, `kstw_diet`, `kstw_allergies`, `kstw_menu_cache*`, etc.). `kstw_theme` und `kstw_favorites` sowie externe Schlüssel bleiben erhalten. Im UI mit Zwei-Schritt-Bestätigung („Wirklich zurücksetzen?“ / „Abbrechen“) abgesichert.
- [x] Fehlende Übersetzungen: Alle UI-Texte, Toasts, ARIA-Labels und PTR-Texte in `data/translations.js` synchronisiert (100% Parität zwischen DE und EN, per Vitest `tests/translations.test.js` abgesichert). Alle blockierenden nativen `alert()`-Aufrufe im Onboarding und bei der Installation durch barrierefreie Toasts (`showToast`) ersetzt.
- [x] Barrierefreiheit: `role="dialog"`, `aria-modal="true"` und `aria-labelledby` für alle Modals (`#onboarding`, `#allergens-modal`, `#update-modal`). Fokus-Falle (`src/lib/a11y.js`) sperrt Tastaturfokus im modalen Dialog und stellt ihn beim Schließen wieder her. `aria-pressed` auf Datumsleiste und Diät-Segmenten, `role="group"` mit Label auf Filterleisten, `role="button"` / `tabindex="0"` mit Enter/Space-Tastatursteuerung für aufklappbare Komponenten, sprechende `aria-label`s auf allen Aktions- und Icon-Buttons.
- [x] Zeitzone: Auf `Europe/Berlin` per `Intl.DateTimeFormat` ('en-CA') in `src/lib/dates.js` umgestellt. ISO-Datumsstrings werden ohne UTC-Verschiebungsfehler zerlegt (`parseIsoParts`), Wochentage und Header-Daten sind zeitzonenunabhängig korrekt.
- [x] Antwort des Menü-Abrufs wird nicht validiert (Array, erwartete Felder): Behoben via `src/lib/validation.js` (`validateWeekMenu`, `validateAnnouncements`). Prüft Array-Struktur, Pflichtfelder (`id`, `date`, `category_ger`, etc.), Datentypen und Datumsformate. Integriert in API-Fetch und Cache-Laden; ungültige Payloads lösen klare Fehler aus bzw. invalidieren fehlerhaften Cache. Mit Vitest getestet.
- [x] `localStorage`-Schlüssel (`kstw_lang`, `kstw_diet`, `kstw_canteens`, `kstw_allergies`, `kstw_prefs_saved`, `kstw_menu_cache`, `kstw_menu_cache_time`, `kstw_announcements_cache`, `kstw_theme`, `kstw_allergen_prompt_shown`, `kstw_updated_successfully`) haben keine Schema-Version: Schema-Versionierung (`CURRENT_SCHEMA_VERSION = 2`, `kstw_schema_version`) und automatische Migration `migrateStorage()` in `src/lib/storage.js` implementiert. Bereinigt korrumpierte JSON-Werte, ungültige Diäten/Sprachen und invalidiert fehlerhafte Menü-Caches vor dem App-Start. Mit Vitest getestet.

## Wartbarkeit und Code-Qualität

- [x] Logik zur Wahl des aktiven Datums steht dreimal im Code: In zentrale Funktion `pickActiveDate` in `src/lib/dates.js` ausgelagert, getestet und eingebunden.
- [x] Montags-Berechnung der Woche steht mehrfach im Code: In Hilfsfunktion `getFetchDateRange` in `src/lib/dates.js` ausgelagert. Sonntag, Monatsgrenzen und 14-Tage-Spanne mit Vitest getestet.
- [x] Parsing von `dish_info` (Zeit und Theke), `cleanDPName` und der Aufbau von `customFields` kommen mehrfach vor: In `src/lib/dish.js` (`getCustomFields`, `cleanDPName`, `parseDishServingTime`, `isDishExpired`, `getDishesServiceWindow`, `extractDishCounter`) zentralisiert, aus `app.js` importiert und mit 7 Vitest-Tests abgesichert.
- [x] `getDishAllergens` läuft pro Gericht mit mehreren Regex bei jedem Render, auch für jeden Tag im Datumsselektor. Ergebnis pro Gericht-ID cachen. *(Erledigt: `WeakMap`-Cache `dishAllergenCache` in `src/lib/allergens.js` cacht geparste Allergene pro Gerichts-Objekt).*
- [ ] `app.js` hat über 3000 Zeilen. Aufteilen in ES-Module (api, cache, filters, i18n, render, settings, favorites, sw-update), kleiner Build mit esbuild oder Vite.
- [x] Event-Listener werden nie entfernt (24 `addEventListener`, 0 `removeEventListener`). Prüfen, ob Re-Renders Handler doppelt binden, auf Event Delegation umstellen. *(Erledigt: Dynamische Karten für Favoriten, Buffet-Rechner, Teilen, Text-Aufklappen und Filter auf Event-Delegation auf Dokumentebene umgestellt).*
- [ ] `console.*` (ca. 14 Stellen) hinter ein Debug-Flag legen.
- [x] Tests fehlen im Repo, obwohl `debug-report.md` "11/11 bestanden" nennt. Vitest einführen für `getDishAllergens`, `shouldExcludeDish`, Datum, Öffnungszeiten, Diät-Filter, Mensa-Zuordnung. *(Erledigt: 104 Unit-Tests in 14 Suiten für alle Logikbereiche, läuft mit `npm test`).*
- [x] Linting (ESLint) und Formatierung (Prettier) ergänzen. *(Erledigt: ESLint mit Flat Config `eslint.config.mjs` und `npm run lint` eingerichtet; Prettier bewusst ausgelassen, um git blame zu wahren).*

## Infrastruktur und Repo-Hygiene

- [x] SW-Version wird manuell hochgezählt und zusätzlich von der Action committet (`sw.js` im `git add`). Risiko für Vergessen und Merge-Konflikte. Version automatisch aus einem Hash der Assets setzen. *(Erledigt: Zähler-Regel aus AGENTS.md beibehalten, durch automatischen Wächter `scripts/check-sw-version.mjs` / `npm run check:sw` abgesichert).*
- [ ] Bot-Commits alle 30 Minuten (Mo-Fr) auf `main` verschmutzen die Historie. Daten in eigenen Branch (z. B. `data`) oder nach `gh-pages` schreiben.
- [x] `continue-on-error: true` verschluckt Scraper-Fehler. Monitoring ergänzen (Issue anlegen oder Benachrichtigung, wenn der Key-Scraper mehrfach scheitert). *(Erledigt: `scripts/check-rpc.mjs` validiert den RPC-Endpunkt und bricht den Workflow bei fehlerhafter API/Key-Kombination mit Exit-Code 1 ab).*
- [ ] Geplante GitHub-Workflows werden in öffentlichen Repos nach 60 Tagen ohne Repo-Aktivität deaktiviert. Prüfen, ob die Bot-Commits das verhindern.
- [ ] Key-Scraper liest den Key aus Web-Assets des Betreibers (CloudMensa). Format hat sich bereits geändert. Rechtliche und betriebliche Abhängigkeit bewusst entscheiden, ggf. beim KStW anfragen.
- [x] `debug-report.md` und `feedback.md` liegen im Root und werden mit ausgeliefert. Nach `docs/` verschieben. *(Erledigt: Beide Dateien nach `docs/` verschoben).*
- [x] README enthält lokalen Pfad `/Users/julius/Desktop/...` und beschreibt neuere Features nicht (Meisterwerk-Sektion, Baukasten-Layout, Theken-Badges, Update-Dialog). Aktualisieren. *(Erledigt: README bereinigt und modernisiert).*
- [x] `.DS_Store` aus dem Tracking entfernen und in `.gitignore` aufnehmen. *(Erledigt: In `.gitignore` hinterlegt, nicht im Index).*
- [ ] `Dockerfile` und `docker-compose.yml` passen nicht zu GitHub Pages. Dokumentieren oder entfernen.
- [ ] Datenschutzerklärung (nur `localStorage`, keine Tracker) und Impressum ergänzen, falls öffentlich verbreitet.

## Feature-Ideen mit vorhandenen Daten

Laut Code liefert die API pro Gericht unter anderem `food_icon`, `menu_type`, `allergens_names`, `dish_ger_1` bis `dish_ger_5`, `price_1`, `preis_gramm`, Kategorie, Screens und Ort. Vor der Umsetzung die echte RPC-Antwort einmal komplett dumpen und auf weitere Felder prüfen (Nährwerte, CO2, Bilder, Bewertungen, weitere Preise).

- [x] Transparenz beim Allergenfilter: Anzahl ausgeblendeter Gerichte anzeigen, mit Umschalter zum Einblenden. *(Erledigt: Hinweiskarte bei vollständiger Filterung, Banner mit Ein-/Ausblenden und gestrichelter Markierung der gefilterten Speisen).*
- [x] Favoriten nach normalisiertem Gerichtsnamen speichern (statt `dish.id`, wahrscheinlich pro Tag neu). Button ist aktuell deaktiviert. Lieblingsgericht soll nochmal Speziell gehighlighted werden so das man dirket sieht das es das GEricht gibt. *(Erledigt: `cleanDishNameForFavorite` in `src/lib/dish.js`, Persistenz in `src/lib/storage.js`, Stern im Datumsselektor, goldener Rahmen und Badge).*
- [x] Buffet-Preisrechner mit `preis_gramm` (Gewicht eingeben, Preis sehen). *(Erledigt: Gramm-Input mit Schnellwahltasten 150g, 250g, 400g und Cent-genauer Berechnung).*
- [x] Tarif-Umschalter (Studi, Mitarbeitende, Gäste), sofern weitere Preisfelder in der Antwort vorhanden sind. *(Erledigt: Umschalter für Studierende, Bedienstete, Gäste, Externe mit Fallback-Kette in `src/lib/dish.js` und Onboarding/Settings).*
- [x] Status "Jetzt geöffnet" und "schließt in X Minuten" pro Mensa und Theke aus strukturierten Zeiten. *(Erledigt: Live-Berechnung mit `getCanteenOpenStatus` in `src/lib/hours.js`, Restminuten bis Schließung und Öffnungszeitpunkt).*
- [x] Deep-Links mit `?date=...&canteen=...&dish=...` statt `window.location.href` beim Teilen. `?view=today|settings` existiert bereits. *(Erledigt: Teilen-Button erzeugt Deep-Link; beim Öffnen wird die Mensa aktiviert, das Gericht fokussiert, gescrollt und animiert).*
- [x] Statt dem Einstellungs-Icon oben rechts, sollte dort wie in anderen Apps die Drei-Striche des Hamburger-Menü-Icons sein. Wenn man dort drauf drückt, kommt ein Menü (in modernem Design und passend zu dem wie die App jetzt schon aussieht (mit Dark & White Modes, etc.)). Im Menü soll dann die Einstellungen öffnenbar sein und das Statistik-Menü (nächster Punkt). *(Erledigt: Hamburger-Button `#menu-btn` und Menü-Dialog `#app-menu-modal` verschlankt auf genau zwei Einträge: Einstellungen und Statistiken. Separater „Heute“-Button direkt im Header platziert).*
- [x] Tägliche Snapshots der Menüs als JSON-Archiv bzw. Client-seitige Statistiken: Häufigkeit von Gerichten, veganer Anteil, Preisentwicklung. *(Erledigt: Ultraleichtes Statistikmodul `src/lib/stats.js` mit < 2 KB Speicherbedarf in `localStorage` unter `kstw_stats_v1`. Visualisiert Ernährungsanteile, Preisspannen, Top-5-Gerichte und Favoriten-Treffer im barrierefreien Dialog `#stats-modal`).* 


## Vorgeschlagene Reihenfolge (nur als Orientierung, kann gelöscht werden)

- Zuerst Sicherheit: Allergenfilter, Onboarding-Text, Inline-Handler und CSP.
- Danach App-Lebenszyklus: `visibilitychange`, Einstellungslogik, Datumswahl zentralisieren, Zeitzone.
- Danach Tests mit Vitest für die reine Logik.
- Danach Pipeline-Stabilität: Scraper-Monitoring, Daten-Branch, automatische SW-Version.
- Danach Modularisierung und Doku.
- Zuletzt Features.
