# Plan: Umsetzung der offenen Punkte aus `docs/ANALYSE.md`

Stand: 04.10.2026. Branch: `feature/analysis-fixes`. Grundlage sind der vollständig gelesene Code (`app.js`, `sw.js`, `index.html`, `data/*.js`, `scripts/*.js`, Workflow, `manifest.json`, `tailwind.config.js`, `input.css`, `package.json`), die echte RPC-Antwort (`docs/rpc-sample.json`, `docs/RPC-FELDER.md`) und ein Test-Harness, der das bisherige `app.js` gegen diese Daten laufen ließ.

## 1. Ergebnis der Verifikation (Phase 0)

Legende: ✔ bestätigt, ◐ teilweise, ✘ nicht bestätigt / bereits erledigt.

### Sicherheit und Korrektheit

| Punkt | Status | Befund |
|---|---|---|
| Allergenfilter auf bereinigten Codes | ✔ | **Kein Missverständnis der API.** Gemessen: 31 von 232 Gerichten verlieren offiziell deklarierte Codes durch die Bereinigung. Ein Ei-Allergiker sieht 9 von 25 eihaltig deklarierten Gerichten, ein Milch-Allergiker 10 von 64. 23 `VGN`-Gerichte tragen Ei, Milch oder Gelatine, 5 `VGT`-Desserts tragen Gelatine (`27`). Ob Label oder Code falsch ist, entscheiden die Daten nicht. Das generische `Dessert (…)` ist ein Pool mehrerer Desserts, seine Codes sind die Vereinigung. Daraus folgt: Codes nie still verwerfen. |
| Onboarding-Text widerspricht Code | ✔ | Der Text steht an zwei Stellen: `index.html` (wird zur Laufzeit überschrieben) und `translations.js` `allergenWarning` (DE und EN, das ist der sichtbare Text) |
| Dauerhafter Hinweis „Angaben ohne Gewähr“ | ✔ | Fehlt komplett |
| Inline-Handler mit API-Daten | ✔ | `showAllergens('${dish.id}')` (2×), `setActiveDate('${day.date}')`, dazu `changeLanguage`, `changeDietPreference`, `setDietFilter`, `resetApp`, `triggerManualReload`, `fetchAndRender`, `closeAllergensModal`, `onerror`, `onclick` (Zeilentoggle). Zusätzlich blockiert das Inline-`<script>` (`initTheme`) in `index.html` das Streichen von `unsafe-inline` |
| `unsafe-inline` in `script-src` | ✔ | Erst nach Entfernen aller Inline-Handler und des Inline-Skripts möglich. `style-src 'unsafe-inline'` bleibt vorerst (Inline-`style=`-Attribute und Splash-`<style>`) |
| Zwei Escape-Funktionen | ✔ | `escapeHtml` gibt Nicht-Strings unverändert zurück, `escapeHTML` gibt bei falsy `""` zurück. 46 `innerHTML`-Stellen. Ungeescapte Interpolation von API-Daten: `data-dish-price`, die beiden `onclick`-IDs, `day.date`. Statische Daten (`canteen.name`, Übersetzungen) sind unkritisch, werden aber trotzdem geescaped |
| Ankündigungen laufen nach 24 h ab | ✔ | Schlimmer als beschrieben: `dateFetched` wird nur bei inhaltlicher Änderung neu geschrieben. Eine Meldung, die weiter auf kstw.de steht, verschwindet in der App nach 24 h. Der Scraper entfernt Meldungen ohnehin selbst, wenn sie von der Seite verschwinden. Die aktuelle Datei ist `[]` |

### Wahrscheinliche Bugs

| Punkt | Status | Befund |
|---|---|---|
| Kein Refresh beim Zurückkehren | ✔ | Kein `visibilitychange`, `pageshow` oder Intervall |
| Ungespeicherte Einstellungen wirken | ✔ | Checkbox-Handler, `changeDietPreference` und `changeLanguage` schreiben direkt in `state`. Schließen mit X verwirft nichts. Der Hauptbildschirm rendert danach mit dem ungespeicherten Zustand weiter, sobald das Datum wechselt |
| POST + toter SW-Code | ✔ | `method !== 'GET'` bricht ab, Strategie A und `API_CACHE_NAME` sind tot. Offline läuft über `localStorage` (2-Wochen-Antwort ca. 1,1 MB als String, Quota-Risiko wird in `saveMenuCache` verschluckt) |
| SW-Installation mit Teil-Cache | ✔ | Fehlschläge werden nur geloggt. `icons/icon-192.png` und `icon-512.png` fehlen in `STATIC_ASSETS` |
| Update-Dialog | ✔ | Auto-Reload nach 5 s, Fallback-Reload nach 800 ms **und** `controllerchange` (doppelte Navigation möglich). `updateLater` ist übersetzt, wird aber nirgends benutzt. Zusätzlich bleibt `?u=<timestamp>` in der Adresszeile und landet im Teilen-Link |
| Mensa-Zuordnung | ◐ | Leere Strings sind abgefangen. Mit den echten Daten: 0 Gerichte ohne Mensa, 19 Gerichte werden **absichtlich** (Commit `ad7ce51`) von Uni-Mensa **und** Robert-Koch zugeordnet und erscheinen doppelt, wenn beide gewählt sind. Die bidirektionale `includes`-Logik bleibt fragil. `keywords` in `canteens.js` werden nie benutzt |
| Theken-Heuristik | ◐ | Nicht „doppelt“, sondern eine Funktion (`getDishServingMeta`). Echt sind `dish_info` und Screen-Namen. Erfunden sind die Namensregeln (`gnocchi`/`pasta` → „MG Nord“, `vegan`/`beilage` → „EG Nord“) und das Mapping Lindenthal-Ausgabe → Uni-Mensa-Theke |
| Öffnungszeiten per Freitext | ✔ | Zusätzliche echte Bugs: Freitags greift bei `Mo - Do … / Fr …` die Mo-Do-Zeile (Schleife bricht beim ersten Treffer ab). Sonntag fällt auf 11:00–14:30 „geöffnet“ zurück. Der Zweig `canteen.opening_hours` ist toter Code mit hartcodierten Werten |
| Pull-to-Refresh | ✔ | `startY` bleibt nach einem Wisch nach oben stehen. Text „Aktualisieren...“ fest deutsch |
| `resetApp` löscht alles | ✔ | `localStorage.clear()`, kein Bestätigungsdialog |
| Fehlende Übersetzungen | ◐ | Die in der Analyse vermuteten `update…`-Schlüssel **existieren** in beiden Sprachen (Fallbacks sind toter Code). **Tatsächlich fehlen** `noDataAvailable` und `noDataForSelectedDay`: die App zeigt dort das Wort „undefined“. Außerdem ca. 30 hartcodierte DE/EN-Verzweigungen und 3 `alert()`-Aufrufe. Das Warn-Icon (`getIconHTML('warning')`) existiert in `icons.js` nicht, das Allergen-Warnbadge hat daher kein Symbol |
| Barrierefreiheit | ✔ | Keine Rollen, kein Fokus-Trap, kein Escape in Modals, Allergen-Zeile ist ein klickbares `div`, Einstellungsbutton ohne Label |
| Zeitzone | ✔ | Mit `TZ=America/Los_Angeles` wird Montag als Sonntag („So 4“) angezeigt. Zusätzlich: `Montag + 13 × 24 h` verschiebt sich über die Zeitumstellung um einen Tag |
| Antwort nicht validiert | ✔ | Ein Objekt statt Array (z. B. Fehler-JSON mit HTTP 200) führt zu `state.menuData.filter is not a function` |
| `localStorage` ohne Schema-Version | ✔ | Elf Schlüssel plus `kstw_favorites` (fehlt in der Analyse) |

### Wartbarkeit

| Punkt | Status | Befund |
|---|---|---|
| Aktives Datum dreimal | ✔ | `fetchAndRender` (2×), `updateMenuDataBackground` |
| Montags-Berechnung | ✔ | 2× (`fetchAndRender`, `updateMenuDataBackground`), plus der DST-Fehler |
| `dish_info`, `cleanDPName`, `customFields` mehrfach | ✔ | `customFields`-Aufbau 14×, Zeit-Parsing 4×, `cleanDPName` 2× |
| `getDishAllergens` cachen | ✔ | Wird für jeden Tag der Datumsleiste und je Karte doppelt berechnet. **Cache nicht pro `dish.id`** (IDs sind nicht eindeutig), sondern pro Objekt (`WeakMap`) |
| `app.js` über 3000 Zeilen | ✔ | 3060 Zeilen |
| Listener doppelt gebunden | ✘ | Geprüft: `onclick`-Properties und neu erzeugte DOM-Knoten, die globalen Listener werden einmal gebunden. Keine Doppelbindung. Die Umstellung auf Delegation erfolgt im Paket „Inline-Handler“ |
| `console.*` | ✔ | 14 Stellen |
| Tests fehlen | ✔ | Keine Tests im Repo (`scratch/verification.test.js` aus `debug-report.md` existiert nicht) |
| ESLint/Prettier | ✔ | Fehlen |

### Infrastruktur

| Punkt | Status | Befund |
|---|---|---|
| SW-Version manuell + Action | ✔ | `scripts/update-key.js` zählt `CACHE_NAME` per Regex `kstw-mensa-v(\d+)` hoch. **Die Zeile darf ihr Format nicht ändern.** Das Entfernen von `API_HOST` ist unkritisch (Regex läuft dann ins Leere) |
| Bot-Commits alle 30 Minuten | ✘ (aktuell) | Der Bot committet nur bei Änderungen. 25 von 87 Commits, alle vom 15.–17.07.2026. Seit dem Fix von BUG-02 kein Commit-Spam. Strukturell bleibt die Frage nach einem Daten-Branch (Frage 5) |
| `continue-on-error` ohne Monitoring | ✔ | Bei dauerhaftem Fehler merkt es niemand, bis der Key rotiert |
| 60-Tage-Regel | ◐ | Nicht verifizierbar. Letzter Bot-Commit 17.07.2026. Laut Dokumentation zählen Bot-Commits auf dem Default-Branch wohl als Aktivität, GitHub deaktiviert sonst Zeitpläne |
| Key-Scraper rechtlich | – | Entscheidung liegt bei dir (Frage 7) |
| `debug-report.md` im Root | ✔ | Wird über Pages öffentlich ausgeliefert (HTTP 200). `feedback.md` ist bereits per `.gitignore` ausgeschlossen |
| README | ✔ | Lokaler Pfad. **Falsche Aussage:** „API Key Auto-Recovery“ in der App gibt es nicht, der Key wird nur über die GitHub Action aktualisiert |
| `.DS_Store` | ✘ | Bereits in `.gitignore`, nicht getrackt (`git ls-files` und `git check-ignore` geprüft) |
| Docker | – | Entscheidung liegt bei dir (Frage 4) |
| Datenschutz/Impressum | – | Entscheidung liegt bei dir (Frage 8) |

### Features

| Punkt | Machbar? | Befund |
|---|---|---|
| Allergenfilter-Transparenz | ja | Reine UI-Arbeit |
| Favoriten nach Namen | ja | **Teilweise anders als vermutet:** `id` ist nicht „pro Tag neu“, sondern teils stabil (Beilagen), teils wöchentlich neu (nur ca. 20 % der Hauptgerichte). Der normalisierte Name ist trotzdem der bessere Schlüssel. Es gibt aktuell **keinen** Favoriten-Button in den Karten, nur den toten Listener |
| Buffet-Preisrechner | ja | `preis_gramm` = `100`, `price` = Preis je 100 g, 22 Gerichte betroffen |
| Tarif-Umschalter | ja | `price_2` (Bedienstete), `price_3` (Gäste), `price_4` (Externe, `0,00` = nicht angeboten). Komma **oder** Punkt als Dezimaltrenner |
| Status „Jetzt geöffnet“ | ja | Baut auf den strukturierten Zeiten auf |
| Deep-Links | ja | Teilen-Link enthält derzeit `?u=…` aus dem Update-Reload |
| Hamburger-Menü | ja | Der Menüpunkt „Statistik“ hängt an Archiv und Daten-Branch |
| Archiv und Statistik | bedingt | Die API liefert Verlauf bis mindestens April 2026, ein Backfill ist möglich. Tägliche Commits widersprechen dem Punkt „Bot-Commits auf main vermeiden“, daher Frage 5 |

## 2. Architekturentscheidungen

**Module ohne Build.** Statt esbuild oder Vite nutze ich native ES-Module (`<script type="module">`). Gründe: GitHub Pages liefert Dateien unverändert aus, es entsteht kein Build-Artefakt und kein zusätzlicher CI-Schritt, die Bot-Commits (`config.js`, `announcements.json`, `sw.js`) bleiben unberührt, Vitest importiert die Module direkt (kein VM-Hack). CSP `script-src 'self'` genügt für Module. Nachteil: mehr HTTP-Requests, die der Service Worker vorab cacht. Ein Bundler lässt sich später nachrüsten, ohne Code zu ändern.

**`data/config.js` bleibt ein klassisches Skript** mit globalem `const SUPABASE_CONFIG`, weil der Scraper genau dieses Format schreibt. Module lesen es über `typeof SUPABASE_CONFIG`. Reine Logik bekommt Konfiguration und Daten als Parameter.

**Reihenfolge-Abweichung:** Das Modul-Fundament (M0) kommt vor „Sicherheit“, weil jede Korrektur sonst nur mit einem VM-Hack testbar wäre. Es ändert kein Verhalten.

**Neue Struktur (schrittweise):**

```
src/lib/      reine Logik, ohne DOM, mit Tests: dates, allergens, diet, canteen-match, hours, dish-meta, validate, storage, prices, favorites
src/ui/       DOM-Code: render, settings, sw-update, modals, menu
src/data/     canteens, translations, allergens, icons (als ES-Module)
app.js        Einstieg, verdrahtet Module
```

**Allergen-Modell (Sicherheitskern).** Pro Gericht und gewähltem Allergen gibt es drei Zustände statt zwei:

1. `contains`: Code steht in `allergens_numbers` oder in den Hauptkomponenten. Gericht wird ausgeblendet (zählt in der Transparenz-Zeile).
2. `uncertain`: Code stammt nur aus einer generischen Dessert-Komponente (Pool) oder das Diät-Label widerspricht der Deklaration. Gericht bleibt sichtbar mit Warnbadge, das den Code nennt. „Im Zweifel warnen statt filtern.“
3. `unknown`: keine Allergen-Angabe vorhanden. Gericht bleibt sichtbar mit Warnbadge (Regel aus `AGENTS.md`).

Offizielle Codes aus `allergens_numbers` werden **nie** entfernt, auch nicht bei `VGN`/`VGT`-Label. Das Label ändert nur die Anzeige und löst einen sichtbaren Widerspruchs-Hinweis aus („Label und Allergenangabe widersprüchlich, bitte Personal fragen“). Das Verhalten ist in einer Konstante gebündelt, falls du Frage 1 anders beantwortest.

## 3. Arbeitspakete

Jedes Paket: eigener Commit (Conventional Commits), `CACHE_NAME` wird bei Änderungen an gecachten Dateien erhöht, danach `npm test`, `npm run build:css`, Browser-Prüfung.

### Gruppe 0: Fundament

**M0: Test- und Modul-Fundament**
- Ziel: Vitest, `npm test`, ES-Module-Umstellung ohne Verhaltensänderung. Daten (`canteens`, `translations`, `allergens`, `icons`) werden ES-Module, `app.js` wird Modul, `index.html` lädt `config.js` klassisch und `app.js` als Modul. `tailwind.config.js` bekommt `src/**/*.js` im `content`.
- Dateien: `package.json`, `vitest.config.js`, `index.html`, `app.js`, `data/*.js` (außer `config.js`), `sw.js` (`STATIC_ASSETS`), `tailwind.config.js`.
- Testidee: Smoke-Test, der alle Module importiert. Browser: App lädt unverändert.
- Risiko: mittel (Ladereihenfolge, SW-Asset-Liste, Tailwind-Purge). Sofort im Browser prüfen.

### Gruppe 1: Sicherheit

**S1: Allergen- und Diät-Logik**
- Ziel: `src/lib/allergens.js` mit Drei-Zustands-Modell, Rohcodes, Konfliktwarnung, Dessert-Pool als `uncertain`, Cache per `WeakMap`. `src/lib/diet.js` erkennt `VGN`/`vgn`/`Vgn`, `VGT`, `V`, Komma-Listen, Namensfallback. Eine gemeinsame Funktion `getCustomFields(dish)` ersetzt 14 Kopien.
- Dateien: `src/lib/allergens.js`, `src/lib/diet.js`, `src/lib/dish.js`, `app.js`, `data/translations.js`, `data/icons.js` (Warn-Icon).
- Testidee: Vitest mit `docs/rpc-sample.json` plus synthetische Fälle: Ei in `VGN`, Gelatine in `VGT`, Gericht ohne Angabe, Kombigericht mit Dessert-Pool, Codes mit Leerzeichen `(17, 18)`, `19pi`-Untercodes, Gramm-Werte (`3g`) dürfen nicht als Allergen zählen, Ei-Allergiker sieht keines der 25 eihaltigen Gerichte als unauffällig.
- Risiko: **hoch** (sicherheitsrelevant). Zwei Prüfer: Tests plus manueller Abgleich der Ergebnisliste.

**S2: Allergen-Texte und Hinweis**
- Ziel: `allergenWarning` und `allergenDesc` korrigieren (DE/EN), dauerhafter Hinweis „Angaben ohne Gewähr, im Zweifel Personal fragen“ im Allergen-Modal und unter dem Filter, Warn-Icon.
- Dateien: `data/translations.js`, `index.html`, `src/ui/*`.
- Testidee: Test, der prüft, dass beide Sprachen dieselben Schlüssel haben und der Text nicht „ausgeblendet … ohne Angabe“ behauptet.
- Risiko: niedrig.

**S3: Inline-Handler und CSP**
- Ziel: `data-action`-Attribute plus ein delegierter Listener. `initTheme` wird zu `theme-init.js` (klassisch, synchron, Teil von `STATIC_ASSETS`). CSP ohne `unsafe-inline` in `script-src`. `onerror` der Bilder über `error`-Event in der Capture-Phase.
- Dateien: `index.html`, `app.js`, neues `theme-init.js`, `sw.js`.
- Testidee: Test, der `app.js` und `src/` nach `on[a-z]+=` in Template-Strings durchsucht und `index.html` auf Inline-Skripte prüft. Browser: Konsole ohne CSP-Verstöße.
- Risiko: mittel (CSP-Fehler zeigen sich nur zur Laufzeit). Browser-Test mit allen Dialogen.

**S4: Escape vereinheitlichen**
- Ziel: eine Funktion `escapeHtml(value)` (coerct zu String, `null`/`undefined` → `""`), alle `innerHTML`-Stellen geprüft, `data-dish-price` und statische Namen geescaped.
- Dateien: `src/lib/html.js`, `app.js`.
- Testidee: Tests mit `<img onerror=…>`, `"`, `'`, `&`, `null`, Zahl.
- Risiko: niedrig.

**S5: Ankündigungen** (hängt an Frage 9, Standardvorschlag unten)
- Ziel: Frontend zeigt Meldungen, solange sie in `announcements.json` stehen (der Scraper entfernt sie, wenn sie von kstw.de verschwinden), mit Sicherheitsgrenze 14 Tage. Anzeige „Stand“ mit Datum in `Europe/Berlin`.
- Risiko: niedrig. **Wartet auf Antwort.**

### Gruppe 2: App-Lebenszyklus

**L1: Datum, Zeit, Woche**
- Ziel: `src/lib/dates.js` mit festem `Europe/Berlin` per `Intl.DateTimeFormat`, Datum nur aus Y-M-D-Teilen, `mondayOf(date)`, `addDays`, `weekRange`. Eine Funktion `pickActiveDate(menuData, filters, now)` ersetzt die drei Kopien. Wochentage aus dem Y-M-D-String, nie aus `new Date('YYYY-MM-DD')`.
- Testidee: Sonntag, Monatsgrenze, Jahreswechsel, Zeitumstellung (25.10.2026), `TZ=America/Los_Angeles` und `Asia/Tokyo`, 23:30 UTC.
- Risiko: mittel.

**L2: Refresh beim Zurückkehren**
- Ziel: `visibilitychange` und `pageshow`. Beim Sichtbarwerden: Datumswechsel erkennen (Datum neu wählen, neu rendern), Cache älter als 60 min im Hintergrund aktualisieren, Öffnungsstatus neu berechnen. Mindestabstand 30 s.
- Testidee: Funktion `needsRefresh(lastFetch, now, lastRenderedDay)` als reine Logik testen. Browser: Datum faken.
- Risiko: niedrig.

**L3: Einstellungen und Reset**
- Ziel: Entwurfs-Zustand im Dialog, Schließen mit X, Escape oder Backdrop verwirft. Speichern übernimmt. `resetApp` löscht gezielt die Schlüssel der Voreinstellungen und Caches (Favoriten und Theme bleiben), nach Bestätigung (Zwei-Schritt-Button).
- Testidee: Storage-Modul testen (Reset löscht nur `kstw_*`-Voreinstellungen).
- Risiko: niedrig.

**L4: Service Worker und Update-Dialog**
- Ziel: toten Code entfernen (Strategie A, `API_CACHE_NAME`), alten `kstw-api-v1`-Cache beim Aktivieren löschen, Installation schlägt bei fehlendem Asset fehl (alter SW bleibt aktiv), Icons in `STATIC_ASSETS`. Update-Dialog: Button „Später“, genau ein Reload (nur über `controllerchange`, mit einem Zeitlimit als Fallback), `?u=` wird nach dem Laden per `history.replaceState` entfernt. Das Format der Zeile `const CACHE_NAME = 'kstw-mensa-vNN';` bleibt unverändert.
- Testidee: SW-Test, der `STATIC_ASSETS` auf Existenz der Dateien prüft und `CACHE_NAME` gegen das Scraper-Regex. Browser: Update-Dialog (SW-Version erhöhen, neu laden), Offline.
- Risiko: **mittel bis hoch** (SW-Fehler sperren Updates). Zwei Prüfdurchgänge im Browser.

**L5: Validierung und Schema-Version**
- Ziel: `validateWeekMenu(json)` (Array, `date` im Format, `dishes` Array, je Gericht `id`, `name_de`, `custom_fields` Array) mit klarer Fehlermeldung. Cache-Validierung beim Laden. `kstw_schema_version` und Migration (v1 → v2).
- Testidee: kaputte Antworten (Objekt, Fehler-JSON, fehlendes Feld), Cache mit altem Format, Migration idempotent.
- Risiko: niedrig bis mittel (Migration darf keine Nutzerdaten verlieren).

**L6: Mensa-Zuordnung, Theken, Öffnungszeiten**
- Ziel: `canteen-match.js` mit exakten Vergleichen vor Teilstring (`ort_id` → normalisierter `location` → Screen), Tests mit den echten Daten (jedes Gericht genau einer erwarteten Mensa). `hours.js` mit strukturierten Zeiten in `canteens.js` (`hours: { mon: [[690, 1260]], … }`), Funktionen `getHours(canteen, isoDate)` und `getOpenStatus(canteen, now)`. Öffnungszeiten aus `infokurz` einmalig sauber nach Struktur überführen. `dish-meta.js` zentralisiert `dish_info`-Parsing und `cleanDPName`.
- Testidee: Freitag-Fall, Sonntag, Samstag, Mensen mit zwei Zeilen (SpoHo, Uni-Mensa), Grenzen (11:29, 14:30, 14:31).
- Risiko: mittel. **Offen:** Dedupe Lindenthal/Uni-Mensa (Frage 2) und Theken-Heuristik (Frage 3), beides wartet auf Antwort. Der Rest ist unabhängig.

**L7: Pull-to-Refresh, Übersetzungen, Barrierefreiheit**
- Ziel: `startY` immer zurücksetzen, Text übersetzt. Fehlende Schlüssel (`noDataAvailable`, `noDataForSelectedDay`) und alle hartcodierten DE/EN-Verzweigungen nach `translations.js`. `alert()` → Toast. Barrierefreiheit: `role="dialog"`, `aria-modal`, `aria-labelledby`, Fokus-Trap, Escape, Fokus zurück zum Auslöser, `button` statt `div`, Labels, `aria-pressed` für Filter, `aria-live` für Toasts. Kontrast: Stichprobe der Hauptfarbpaare mit berechnetem Verhältnis.
- Testidee: Test auf identische Schlüsselmengen DE/EN und auf Verwendung nur existierender Schlüssel (statische Suche nach `t.<key>`). Browser: Tastaturbedienung.
- Risiko: mittel.

### Gruppe 3: Tests (laufend, nicht nur am Ende)

**T1: Vitest-Suiten** zu jedem Paket (siehe Testideen). Fixtures: `docs/rpc-sample.json` plus kleine handgebaute Gerichte.
**T2: Browser-Smoke** (Playwright, falls installierbar, sonst Chromium-Headless): Onboarding, Einstellungen, Datumsleiste, Filter, Dark/Light, Offline, Update-Dialog. Skript unter `scripts/smoke.mjs`, nicht Teil von `npm test`.
**T3: Linting:** ESLint mit minimaler Konfiguration (`no-undef`, `no-unused-vars`, `eqeqeq`). Prettier bewusst nicht (siehe 4).

### Gruppe 4: Pipeline und Repo

**P1: Gesundheitsprüfung statt stiller Fehler**
- Ziel: `scripts/check-rpc.js` ruft die RPC mit dem aktuellen Key auf und validiert mit demselben `validateWeekMenu`. Schlägt es fehl, wird der Job **rot** (GitHub schickt eine Mail). Die Scraper-Schritte bleiben tolerant, aber der letzte Schritt beendet den Job mit Fehler, wenn der Key-Scraper gescheitert ist **und** der RPC-Test scheitert (App kaputt). Der Commit-Schritt läuft vorher mit `if: always()`.
- Dateien: `scripts/check-rpc.js`, `.github/workflows/update-api-key.yml`.
- Testidee: Skript lokal gegen die echte API und mit einem absichtlich falschen Key. Der Workflow selbst lässt sich lokal nur syntaktisch prüfen, die echte Prüfung erfolgt nach dem Merge.
- Risiko: mittel (CI-Änderung, erst nach Merge im echten Lauf prüfbar).

**P2: SW-Versions-Wächter**
- Ziel: `scripts/check-sw-version.js` (npm-Skript `check:sw`) vergleicht die Hashes der Dateien aus `STATIC_ASSETS` mit `origin/main` und schlägt fehl, wenn Dateien geändert wurden, aber `CACHE_NAME` nicht erhöht ist. Die Regel aus `AGENTS.md` bleibt bestehen (Frage 6).
- Risiko: niedrig.

**P3: Repo-Hygiene**
- `debug-report.md` → `docs/debug-report.md` (wird dann nicht mehr als Seitenwurzel ausgeliefert, aber `docs/` ist weiterhin öffentlich, siehe Hinweis in der Zusammenfassung). README aktualisieren (kein lokaler Pfad, korrekte Beschreibung von Key-Aktualisierung, neue Features, Modulstruktur, Tests, Hinweise zum Betrieb). `.DS_Store`: bereits erledigt.
- Risiko: niedrig.

### Gruppe 5: Modularisierung (schrittweise, nach den Fachpaketen)

**M1: UI aufteilen.** `app.js` wird auf Einstieg und Verdrahtung reduziert: `src/ui/render-menu.js`, `render-cards.js`, `settings.js`, `onboarding.js`, `sw-update.js`, `toast.js`, `modals.js`, `ptr.js`, `src/lib/storage.js`. Kein Verhaltenswechsel, nach jedem Modul läuft die App.
- Risiko: mittel (viele Verschiebungen). Pro Modul ein Commit, danach Browser-Smoke.

**M2: Logging.** `src/lib/log.js` mit Debug-Flag (`localStorage kstw_debug` oder `?debug=1`), `console.*` nur noch dort. Fehler (`console.error`) bleiben standardmäßig sichtbar, Info-Meldungen verschwinden.

### Gruppe 6: Features

**F1: Transparenz beim Allergenfilter.** Zeile „N Gerichte wegen Allergenen ausgeblendet · Anzeigen“, Umschalter blendet sie markiert wieder ein. Zähler gehört zur Mensa-Karte.
**F2: Favoriten nach Namen.** Schlüssel: normalisierter Name (klein, ohne Allergen-Klammern, ohne Suffixe wie „Vegan“, „TK“), `kstw_favorites` wird zu `kstw_favorites_v2` migriert. Herz-Button in der Hauptkarte (derzeit nicht vorhanden). Hervorhebung: Karte mit Rahmen und „Dein Lieblingsgericht“-Banner, Stern in der Datumsleiste an Tagen mit Lieblingsgericht, Zähler im Kopf.
**F3: Buffet-Preisrechner.** Gewicht (g) eingeben, Preis berechnen (`price` je 100 g), Eingabe auf Buffet-Karten, Rundung auf Cent.
**F4: Tarif-Umschalter.** Einstellung Studierende (Standard), Bedienstete, Gäste, Externe. Parser für `1,10` und `1.07`, `0,00` bei `price_4` ausblenden.
**F5: Öffnungsstatus.** „Jetzt geöffnet · schließt in 25 Min“ und „öffnet um 11:30“ pro Mensa. Theke nur mit echten Zeiten aus `dish_info`.
**F6: Deep-Links.** `?date=YYYY-MM-DD&canteen=<key>&dish=<normalisierter Name>`; Teilen nutzt diese URL und nie `?u=`. Beim Öffnen: Datum setzen, Mensa einblenden (auch wenn nicht gewählt, nur für diese Ansicht), Karte scrollen und hervorheben.
**F7: Hamburger-Menü.** Statt Zahnrad ein Menü-Button mit Dialog (Einstellungen, Statistik, Info/Datenschutz). Im Stil der App, Dark/Light, mit Fokus-Trap. „Statistik“ erst sichtbar, wenn Daten vorhanden sind (hängt an Frage 5).
**F8: Archiv und Statistik.** Täglicher Snapshot per Action, Backfill ab April 2026, Statistik (Häufigkeit, veganer Anteil, Preisentwicklung). **Wartet auf Frage 5.**

## 4. Bewusst nicht umgesetzt (vorerst)

| Punkt | Begründung |
|---|---|
| Prettier | Würde 3000 Zeilen neu formatieren und `git blame`/Review unbrauchbar machen. ESLint reicht für die Fehlererkennung. Bei Bedarf später als eigener Commit |
| IndexedDB-Cache | Nicht nötig: `localStorage` genügt, solange wir die gespeicherten Daten verschlanken (nur benötigte Felder, kein `screens`-Overhead). Wird in L5 mit geprüft |
| Tierart-Badge (`G`, `S`, `R`, `F`, `NL`) | Bedeutung nur aus Gerichtsnamen abgeleitet, nicht amtlich bestätigt. Falsche Tierangaben wären bei religiösen/ethischen Einschränkungen schädlich |
| Vollständiger Kontrast-Audit | Nur Stichprobe der Hauptfarbpaare, kein vollständiger WCAG-Test aller Tailwind-Kombinationen |
| Automatischer SW-Hash statt Zählerversion | Widerspricht der Regel in `AGENTS.md` und dem Scraper-Regex. Stattdessen Wächter P2 (Frage 6) |
| Entfernen von Docker-Dateien | Deine Entscheidung (Frage 4). Bis dahin unverändert |
| Datenschutz-Text und Impressum | Rechtlicher Inhalt und Personendaten brauchen deine Angaben (Frage 8) |
| Verschieben der Bot-Commits in einen Daten-Branch | Ändert die Pages-Auslieferung und ggf. die CSP (Frage 5) |
| Eingriffe in `data/config.js`, `data/announcements.json` und Secrets | Verboten laut Auftrag, werden nur von der Action geschrieben |

## 5. Offene Fragen an dich

Bis zu deiner Antwort arbeite ich nur an den davon unabhängigen Paketen (M0, S1–S4, L1–L5, L6 ohne Dedupe/Theken, L7, T1–T3, P1–P3, M1, M2, F1–F6). Offen bleiben S5, F7 (Teil Statistik) und F8 sowie die Teilbereiche von L6.

1. **Allergen-Anzeige bei Widerspruch.** Mein Vorschlag (so umgesetzt, per Konstante änderbar): offizielle `allergens_numbers` werden immer gefiltert, auch wenn das Diät-Label widerspricht (Beispiel `VGN` mit Ei). Zusätzlich erscheint ein Hinweis „Label und Allergenangabe widersprüchlich“. Codes, die nur aus einer generischen `Dessert`-Komponente stammen, **blenden nicht aus**, sondern warnen. Alternative: Konflikt-Gerichte nie ausblenden, nur warnen. Welche Variante soll gelten?
2. **Lindenthal und Uni-Mensa.** 19 Gerichte werden beiden Mensen zugeordnet (Commit `ad7ce51`) und erscheinen doppelt, wenn beide gewählt sind. Soll ein Gericht in diesem Fall nur einmal (in der Uni-Mensa) mit Hinweis „auch in Lindenthal“ erscheinen?
3. **Theken-Heuristik.** Entfernen der Namensregeln (`pasta` → „MG Nord“ usw.) und des Mappings Lindenthal-Ausgabe → „EG Nord“, oder beibehalten und als „vermutlich“ kennzeichnen? Weißt du, ob das Mapping stimmt?
4. **Docker-Dateien.** `Dockerfile`, `docker-compose.yml`, `.dockerignore` entfernen oder in der README dokumentieren?
5. **Daten-Branch und Archiv.** Soll der Bot künftig in einen eigenen Branch (z. B. `data`) schreiben und die App die Daten von dort laden? Das erfordert entweder eine zusätzliche erlaubte Quelle in der CSP (`raw.githubusercontent.com`) oder einen Pages-Deploy per Workflow. Wie wird Pages derzeit deployt (Branch `main`, Wurzelverzeichnis)? Soll der tägliche Archiv-Snapshot dort liegen? Ohne Antwort baue ich weder Archiv noch Statistik.
6. **SW-Version.** Soll die Zählerversion (`v42` → `v43`) bleiben, ergänzt um den Wächter P2? Oder darf ich auf einen Hash umstellen und `AGENTS.md` sowie den Scraper anpassen?
7. **Key-Scraping.** Das Auslesen des Keys aus den Web-Assets von CloudMensa ist technisch und rechtlich eine Abhängigkeit. Möchtest du beim KStW anfragen, oder soll alles so bleiben? Ich ändere daran nichts.
8. **Datenschutz und Impressum.** Das Badge „100% DSGVO-konform“ ist eine rechtliche Behauptung. Soll es bleiben, abgeschwächt werden („keine Tracker, nur lokale Speicherung“)? Für Impressum und Datenschutzerklärung brauche ich Name und Anschrift oder die Entscheidung, sie nicht aufzunehmen.
9. **Ankündigungen.** Vorschlag: anzeigen, solange der Scraper sie führt, harte Grenze 14 Tage. Einverstanden?
10. **Heartbeat gegen die 60-Tage-Regel.** Soll der Workflow bei längerer Stille (z. B. > 45 Tage ohne Commit) einen kleinen Heartbeat-Commit schreiben? Das ist ein gewollter Commit pro Monat in den Ferien.
11. **`food_icon` `V`.** Ich werte `V` als „vegetarisch“ (abgeleitet aus Spinat Lasagne und Kartoffel-Gemüseauflauf). Kannst du das bestätigen oder kennst du das Verzeichnis des KStW?
