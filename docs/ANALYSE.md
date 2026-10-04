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
- [ ] Mensa-Zuordnung: `getCanteenKeyFromDish` vergleicht Orts- und Screen-Namen per `includes` in beide Richtungen. Kurze oder leere Strings können mehrere Mensen treffen. Sonderregel für Lindenthal (ortid 231) in der Uni-Mensa kann Gerichte doppelt anzeigen, wenn beide Mensen gewählt sind. Prüfen und deduplizieren.
- [ ] Theken-Heuristik: Die Theke (EG Nord, MG Nord, MG Süd) wird teils aus Stichwörtern im Gerichtsnamen abgeleitet und doppelt im Code implementiert. Bei Änderungen zeigt die App falsche Orte als Fakt. Nur API-Felder verwenden oder als "vermutlich" kennzeichnen.
- [ ] Öffnungszeiten werden aus Freitext `info.kurz` per String-Suche ("Mo - Fr", Standardende 14:30) geparst. Fragil bei jedem Formatwechsel. Strukturierte Daten in `canteens.js` pflegen.
- [ ] Pull-to-Refresh: `startY` wird in `touchend` nur zurückgesetzt, wenn tatsächlich gezogen wurde. Veralteter Wert kann später falschen Pull auslösen. Indikatortext "Aktualisieren..." ist fest deutsch.
- [x] `resetApp` ruft `localStorage.clear()` auf: Behoben via `resetAppStorage` in `src/lib/storage.js`. Löscht gezielt nur Voreinstellungen und Menü-/Ankündigungs-Caches (`kstw_prefs_saved`, `kstw_lang`, `kstw_canteens`, `kstw_diet`, `kstw_allergies`, `kstw_menu_cache*`, etc.). `kstw_theme` und `kstw_favorites` sowie externe Schlüssel bleiben erhalten. Im UI mit Zwei-Schritt-Bestätigung („Wirklich zurücksetzen?“ / „Abbrechen“) abgesichert.
- [ ] Fehlende Übersetzungen: Viele Texte haben Fallbacks wie `t.updateAvailableTitle || '...'`, also fehlen wohl Schlüssel in `translations.js`. Englische Nutzer sehen dann Deutsch. `alert()`-Aufrufe im Onboarding sind zudem nur zweisprachig hartcodiert. Durch Toasts ersetzen.
- [ ] Barrierefreiheit: Keine ARIA-Rollen in den gelesenen Templates, Modals ohne Fokus-Trap und Escape-Handler, klickbare `div`s (Allergene) per Tastatur nicht erreichbar. Auf `button` umstellen, `role="dialog"` und `aria-modal` setzen, Kontraste in Light und Dark prüfen.
- [x] Zeitzone: Auf `Europe/Berlin` per `Intl.DateTimeFormat` ('en-CA') in `src/lib/dates.js` umgestellt. ISO-Datumsstrings werden ohne UTC-Verschiebungsfehler zerlegt (`parseIsoParts`), Wochentage und Header-Daten sind zeitzonenunabhängig korrekt.
- [x] Antwort des Menü-Abrufs wird nicht validiert (Array, erwartete Felder): Behoben via `src/lib/validation.js` (`validateWeekMenu`, `validateAnnouncements`). Prüft Array-Struktur, Pflichtfelder (`id`, `date`, `category_ger`, etc.), Datentypen und Datumsformate. Integriert in API-Fetch und Cache-Laden; ungültige Payloads lösen klare Fehler aus bzw. invalidieren fehlerhaften Cache. Mit Vitest getestet.
- [x] `localStorage`-Schlüssel (`kstw_lang`, `kstw_diet`, `kstw_canteens`, `kstw_allergies`, `kstw_prefs_saved`, `kstw_menu_cache`, `kstw_menu_cache_time`, `kstw_announcements_cache`, `kstw_theme`, `kstw_allergen_prompt_shown`, `kstw_updated_successfully`) haben keine Schema-Version: Schema-Versionierung (`CURRENT_SCHEMA_VERSION = 2`, `kstw_schema_version`) und automatische Migration `migrateStorage()` in `src/lib/storage.js` implementiert. Bereinigt korrumpierte JSON-Werte, ungültige Diäten/Sprachen und invalidiert fehlerhafte Menü-Caches vor dem App-Start. Mit Vitest getestet.

## Wartbarkeit und Code-Qualität

- [x] Logik zur Wahl des aktiven Datums steht dreimal im Code: In zentrale Funktion `pickActiveDate` in `src/lib/dates.js` ausgelagert, getestet und eingebunden.
- [x] Montags-Berechnung der Woche steht mehrfach im Code: In Hilfsfunktion `getFetchDateRange` in `src/lib/dates.js` ausgelagert. Sonntag, Monatsgrenzen und 14-Tage-Spanne mit Vitest getestet.
- [ ] Parsing von `dish_info` (Zeit und Theke), `cleanDPName` und der Aufbau von `customFields` kommen mehrfach vor. Zentralisieren.
- [ ] `getDishAllergens` läuft pro Gericht mit mehreren Regex bei jedem Render, auch für jeden Tag im Datumsselektor. Ergebnis pro Gericht-ID cachen.
- [ ] `app.js` hat über 3000 Zeilen. Aufteilen in ES-Module (api, cache, filters, i18n, render, settings, favorites, sw-update), kleiner Build mit esbuild oder Vite.
- [ ] Event-Listener werden nie entfernt (24 `addEventListener`, 0 `removeEventListener`). Prüfen, ob Re-Renders Handler doppelt binden, auf Event Delegation umstellen.
- [ ] `console.*` (ca. 14 Stellen) hinter ein Debug-Flag legen.
- [ ] Tests fehlen im Repo, obwohl `debug-report.md` "11/11 bestanden" nennt. Vitest einführen für `getDishAllergens`, `shouldExcludeDish`, Datum, Öffnungszeiten, Diät-Filter, Mensa-Zuordnung.
- [ ] Linting (ESLint) und Formatierung (Prettier) ergänzen.

## Infrastruktur und Repo-Hygiene

- [ ] SW-Version wird manuell hochgezählt und zusätzlich von der Action committet (`sw.js` im `git add`). Risiko für Vergessen und Merge-Konflikte. Version automatisch aus einem Hash der Assets setzen.
- [ ] Bot-Commits alle 30 Minuten (Mo-Fr) auf `main` verschmutzen die Historie. Daten in eigenen Branch (z. B. `data`) oder nach `gh-pages` schreiben.
- [ ] `continue-on-error: true` verschluckt Scraper-Fehler. Monitoring ergänzen (Issue anlegen oder Benachrichtigung, wenn der Key-Scraper mehrfach scheitert).
- [ ] Geplante GitHub-Workflows werden in öffentlichen Repos nach 60 Tagen ohne Repo-Aktivität deaktiviert. Prüfen, ob die Bot-Commits das verhindern.
- [ ] Key-Scraper liest den Key aus Web-Assets des Betreibers (CloudMensa). Format hat sich bereits geändert. Rechtliche und betriebliche Abhängigkeit bewusst entscheiden, ggf. beim KStW anfragen.
- [ ] `debug-report.md` und `feedback.md` liegen im Root und werden mit ausgeliefert. Nach `docs/` verschieben.
- [ ] README enthält lokalen Pfad `/Users/julius/Desktop/...` und beschreibt neuere Features nicht (Meisterwerk-Sektion, Baukasten-Layout, Theken-Badges, Update-Dialog). Aktualisieren.
- [ ] `.DS_Store` aus dem Tracking entfernen und in `.gitignore` aufnehmen.
- [ ] `Dockerfile` und `docker-compose.yml` passen nicht zu GitHub Pages. Dokumentieren oder entfernen.
- [ ] Datenschutzerklärung (nur `localStorage`, keine Tracker) und Impressum ergänzen, falls öffentlich verbreitet.

## Feature-Ideen mit vorhandenen Daten

Laut Code liefert die API pro Gericht unter anderem `food_icon`, `menu_type`, `allergens_names`, `dish_ger_1` bis `dish_ger_5`, `price_1`, `preis_gramm`, Kategorie, Screens und Ort. Vor der Umsetzung die echte RPC-Antwort einmal komplett dumpen und auf weitere Felder prüfen (Nährwerte, CO2, Bilder, Bewertungen, weitere Preise).

- [ ] Transparenz beim Allergenfilter: Anzahl ausgeblendeter Gerichte anzeigen, mit Umschalter zum Einblenden.
- [ ] Favoriten nach normalisiertem Gerichtsnamen speichern (statt `dish.id`, wahrscheinlich pro Tag neu). Button ist aktuell deaktiviert. Lieblingsgericht soll nochmal Speziell gehighlighted werden so das man dirket sieht das es das GEricht gibt
- [ ] Buffet-Preisrechner mit `preis_gramm` (Gewicht eingeben, Preis sehen).
- [ ] Tarif-Umschalter (Studi, Mitarbeitende, Gäste), sofern weitere Preisfelder in der Antwort vorhanden sind.
- [ ] Status "Jetzt geöffnet" und "schließt in X Minuten" pro Mensa und Theke aus strukturierten Zeiten.
- [ ] Deep-Links mit `?date=...&canteen=...&dish=...` statt `window.location.href` beim Teilen. `?view=today|settings` existiert bereits.
- [ ] Statt dem Einstellungs-Icon oben rechts, sollte dort wie in anderen Apps die Drei-Striche des Hamburger-Menü-Icons sein. Wenn man dort drauf drückt, kommt ein Menü (in modernem Design und passend zu dem wie die App jetzt schon aussieht (mit Dark & White Modes, etc.)). Im Menü soll dann die Einstellungen öffnenbar sein und das Statistik-Menü (nächster Punkt) 
- [ ] Tägliche Snapshots der Menüs als JSON-Archiv (Action). Daraus Statistiken: Häufigkeit von Gerichten, veganer Anteil, Preisentwicklung. 


## Vorgeschlagene Reihenfolge (nur als Orientierung, kann gelöscht werden)

- Zuerst Sicherheit: Allergenfilter, Onboarding-Text, Inline-Handler und CSP.
- Danach App-Lebenszyklus: `visibilitychange`, Einstellungslogik, Datumswahl zentralisieren, Zeitzone.
- Danach Tests mit Vitest für die reine Logik.
- Danach Pipeline-Stabilität: Scraper-Monitoring, Daten-Branch, automatische SW-Version.
- Danach Modularisierung und Doku.
- Zuletzt Features.
