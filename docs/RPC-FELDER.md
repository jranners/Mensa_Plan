# RPC-Felder: `public_get_week_menu`

Stand: 04.10.2026. Grundlage ist `docs/rpc-sample.json` (echte Antwort für die Woche 05.–11.10.2026, 6 Tage, 232 Gerichte, 381 KB). Die Datei enthält keinen API-Key. Ausgewertet wurden zusätzlich die Wochen 28.09.–04.10.2026 und 06.04.2026 (zum Prüfen von ID-Stabilität und Archivtiefe).

Aufruf (siehe `fetchWeekMenuData` in `app.js`):

```
POST {SUPABASE_CONFIG.url}/rest/v1/rpc/public_get_week_menu
Header: apikey / authorization: Bearer <publishable key>, content-type: application/json
Body:   { "p_organization_id": <orgId>, "p_start_date": "YYYY-MM-DD", "p_end_date": "YYYY-MM-DD" }
```

Antwort: Array von Tagen `[{ "date": "YYYY-MM-DD", "dishes": [ ... ] }]`. Tage ohne Daten fehlen komplett (kein leerer Eintrag). Die Wochenenden erscheinen nur, wenn Daten vorhanden sind (im Beispiel: Samstag 10.10. mit 1 Gericht). Historische Daten liefert die API mindestens bis April 2026 zurück (Januar 2026 leer).

## Tag

| Feld | Typ | Genutzt | Hinweis |
|---|---|---|---|
| `date` | string `YYYY-MM-DD` | ja | Kalendertag in Köln, kein Zeitstempel |
| `dishes` | array | ja | |

## Gericht (Top-Level)

| Feld | Typ | Beispiel | Genutzt | Hinweis |
|---|---|---|---|---|
| `id` | string (UUID) | `63032074-…` | ja | **Nicht eindeutig.** 28 IDs kommen mehrfach vor (wiederkehrende Beilagen an mehreren Tagen, 8 Fälle sogar am selben Tag mit anderem Screen). In einem Fall unterscheiden sich die Allergene zwischen den Vorkommen. Von Hauptgerichten teilen nur ca. 20 % ihre ID mit der Vorwoche. Als Schlüssel nur zusammen mit dem Datum und nie allein zum Nachschlagen verwenden. |
| `price` | number | `0.55` | ja | Studierendenpreis in Euro (bei `preis_gramm`-Gerichten: Preis je 100 g) |
| `name_de` / `name_en` | string | `Pommes Wedges` / `wedges` | ja | Teilweise mit Allergen-Codes im Namen: `Kartoffel-Gemüseauflauf(17, 18)` (17 von 232 Gerichten, Leerzeichen innerhalb der Klammer möglich) |
| `description_de` / `description_en` | string \| null | `Zwiebeln, vegane Sahne` | ja | Nur 18 von 232 Gerichten haben eine Beschreibung. Meist Zutatenliste |
| `image_url` | string \| null | Supabase-Storage-URL (`.webp`) | ja | 96 von 232 Gerichten. CSP erlaubt `*.supabase.co` |
| `category` | object \| null | `{id, name_de, name_en, sort_order}` | ja | Nur 3 von 232 gesetzt (`Beilage`, `Dessert`). Alles andere hängt an `menu_type` |
| `screens` | array \| null | `[{id, name, location, screen_group_name}]` | ja | Nur 42 von 232 gefüllt. `location` ist der Anzeigename der Ausgabe, z. B. `Mensa Zollstock - Ausgabe 1 (links)` |
| `menu_group_id` / `menu_group_name` | string \| null | `Mensa Zollstock` | **nein** | 44 von 232 gesetzt. Nur für Zollstock, Deutz und E-Raum befüllt |
| `is_available` | boolean | `true` | **nein** | Im Beispiel immer `true`. Mögliche Nutzung: „ausverkauft“-Status, falls der Betreiber ihn irgendwann pflegt (nicht verifiziert) |
| `placement_id` | null | `null` | nein | Immer `null` |
| `custom_fields` | array | siehe unten | ja | Eigentliche Nutzdaten. Jedes Element: `{type, value, field_id, label_de, label_en, sort_order}`. Nicht jedes Gericht hat alle Felder |

## `custom_fields` (nach `field_id`)

Zählung über 232 Gerichte. „gefüllt“ = Wert nicht leer.

| `field_id` | vorhanden / gefüllt | Bedeutung | Genutzt | Hinweis |
|---|---|---|---|---|
| `food_icon` | 232 / 214 | Kennzeichnung (Ernährung, Tierart) | teilweise | Werte (Häufigkeit): `VGN` 144, `VGT` 32, `G` 14, `D` 5, `R,NL` 4, `S,NL` 3, `F` 3, `S` 2, `V` 2, `R,S` 2, `vgt,Vgn` 2, `vgn` 1, leer 18. **Schreibweise uneinheitlich** (Groß-/Kleinschreibung, Komma-Listen). Die App vergleicht für die Diät groß geschrieben, `vgn` und `Vgn` fallen durch. `V` (vegetarisch, abgeleitet aus den Gerichten Spinat Lasagne und Kartoffel-Gemüseauflauf) wird ignoriert. Bedeutung der Buchstaben ist **nicht amtlich bestätigt**, siehe Hypothesen unten |
| `price_2` | 232 / 232 | Preis Bedienstete | **nein** | Text mit Komma **oder** Punkt (`1,10` und `1.07`) |
| `price_3` | 232 / 232 | Preis Gäste | **nein** | wie `price_2` |
| `price_4` | 229 / 228 | Preis Externe | **nein** | `0,00` bedeutet „nicht angeboten“ (180-mal). 48 Gerichte mit echtem Preis |
| `price_1` | 0 | (Studierendenpreis) | Code erwartet es | Existiert in der Antwort nicht. Der Studierendenpreis steht in `price`. Der Fallback `customFields.price_1` im Code ist toter Code |
| `location` | 232 / 232 | Name der Ausgabestelle | ja | 9 Werte: Mensa Zülpicher Straße, Am Sportpark Müngersdorf, Bistro E-Raum, Mensa Gummersbach, Mensa Deutz, Mensa Zollstock, Mensa Musikhochschule, Mensa Lindenthal, Mensa Claudiusstrasse |
| `ort_id` | 232 / 189 | Standort-ID | ja | 201, 231, 242, 261, 271, 281, 291. Bei 43 Gerichten leer (dann greift `location`) |
| `allergens_numbers` | 201 / 156 | Allergen-Codes, kommagetrennt | ja | Offizielle Deklaration, z. B. `11h, 11w, 17, 18, 27`. Bei Gerichten mit mehreren Komponenten die **Vereinigung** aller Komponenten |
| `allergens_names` | 201 / 156 | Klartext zu den Codes | ja (Modal) | Format `13=Enthält Eier \| contains eggs, 20=…` |
| `dish_ger_1` … `dish_ger_5` | 224 / 201 / 201 / 201 / 201 | Komponenten (DE) | ja | Mit Codes in Klammern, z. B. `Beilagensalat (13,20,21)`. Generische Komponenten wie `Dessert (11h,11w,17,18,27)` sind ein **Pool mehrerer Desserts**, die Codes sind die Vereinigung des Pools |
| `dish_1_eng` … `dish_5_eng` | analog | Komponenten (EN) | ja | |
| `menu_type` | 201 / 195 | Linie | ja | `Beilagen` 103, `vegan/vegetarisch` 52, `Aktion` 18, `Fleisch` 15, `HEIMSPIEL ST`, `QUERBEET VEGAN ST`, `WORLDWIDE ST`, `Fisch` |
| `dish_info` | 201 / 93 | Theke und Ausgabezeit | ja | Beispiele: `EG Nord 11.30 - 14.30 Uhr`, `MG Nord & EG Nord 11.30 - 14.15 Uhr`, `EG Süd - 11:30 - 14:30 Uhr`, aber auch Rauschen wie `1`, `2`, `MG Süd Restaurant 2` |
| `CUSTOM_DPNAME` | 201 / 201 | Interner Anzeigename | ja | Z. B. `Salzkartoffeln 1 / 4 Schnitt frisch`, Suffixe wie `Vegan`, `TK` |
| `preis_gramm` | 22 / 22 | Preis gilt je X Gramm | ja (nur als Flag) | Immer `100`. Betrifft Buffet-Gerichte (Salatbuffet, Beilagenbuffet) |
| `preis_stueck` | 22 / 22 | Preis je Stück | nein | Immer `0` |
| `dispo_id`, `artikel_id` | 201 / 201 | interne Artikel-IDs | nein | `artikel_id` hat 58 verschiedene Werte, taugt als stabiler Gerichts-Schlüssel (nicht verifiziert über längere Zeit) |
| `hinweise` | 201 / 173 | interner Planungshinweis | nein | z. B. `WISE 26/27 KW2-MO`, `Suppenpool`, `#AsiaMittwoch`. Enthält Semester und Kalenderwoche. Nicht für Nutzer gedacht |
| `EDIT_INFO` | 201 / 0 | | nein | Immer leer |

## Nicht vorhanden

Nach vollständiger Durchsicht aller Felder gibt es **keine** Nährwerte (Kalorien, Fett, Eiweiß …), **keine** CO₂-Werte oder Umwelt-Ampeln, **keine** Bewertungen, **keine** Zutatenlisten außer der gelegentlichen `description_*` und **keine** Gewichts-/Portionsangaben. Features dazu sind mit dieser API nicht möglich.

## Ungenutzte Felder, die Features ermöglichen

| Feld | Mögliches Feature | Paket in `PLAN.md` |
|---|---|---|
| `price_2`, `price_3`, `price_4` | Tarif-Umschalter (Studierende, Bedienstete, Gäste, Externe). Preis-Parser muss Komma und Punkt akzeptieren und `0,00` bei `price_4` als „nicht angeboten“ behandeln | Feature: Tarif |
| `preis_gramm` (= `100`) und `price` | Buffet-Preisrechner (Gewicht eingeben, Preis sehen) | Feature: Buffet-Rechner |
| `food_icon` (`G`, `S`, `R`, `F`, `NL`) | Tierart-Anzeige und feinerer Diätfilter (z. B. „kein Schwein“), siehe Hypothesen | Feature: Tierart-Badge (nur nach Rückfrage) |
| `food_icon` `V` | Korrekte Erkennung vegetarischer Gerichte (aktuell übersehen) | Bugfix im Diätfilter |
| `dish_info` | Strukturierte Theke und Ausgabezeit, „schließt in X Minuten“ pro Theke | Feature: Öffnungsstatus |
| `description_*` | Zutatenzeile (derzeit schon in der Karte, auf zwei Zeilen gekürzt) | – |
| `artikel_id` | Stabiler Schlüssel für Favoriten und Statistik statt `id` | Feature: Favoriten (neben dem normalisierten Namen) |
| `date` + Archiv | Tägliche Snapshots und Statistik. Die API liefert Verlauf bis mindestens April 2026, ein **Backfill** ist möglich | Feature: Archiv und Statistik |
| `is_available` | „Nicht verfügbar“-Hinweis | nur falls der Betreiber das Feld nutzt |

## Hypothesen zu `food_icon` (nicht amtlich bestätigt)

Aus den Gerichtsnamen abgeleitet, kein offizielles Verzeichnis gefunden:

| Wert | Vermutete Bedeutung | Belege im Beispiel |
|---|---|---|
| `VGN` | vegan | Pommes Wedges, Beilagensalat |
| `VGT` | vegetarisch | Farfalle, Kartoffelstampf, Himbeerquark |
| `V` | vegetarisch | Spinat Lasagne, Kartoffel-Gemüseauflauf |
| `G` | Geflügel | Hähnchen Cordon bleu, Putenschnitzel |
| `S` | Schwein | Grillbratwurst, Flammkuchen mit Speck |
| `R` | Rind | Rindfleisch Bolognese |
| `F` | Fisch | Fisch-Nuggets, Seelachsfilet |
| `NL` | unklar (vermutlich Neuland-Fleisch) | Currywurst, Rindfleisch Bolognese |
| `D` | unklar (Dessert?) | `Dessert` |

## Datenqualität: Widersprüche (wichtig für Allergene)

Gemessen an `docs/rpc-sample.json`:

- 23 von 144 als `VGN` gekennzeichneten Gerichten tragen offiziell deklarierte Allergen-Codes, die nicht vegan sind (Ei `13`, Milch/Laktose `17`/`18`, Gelatine `27`). Beispiele: `Beilagensalat` (13), `Blumenkohl` (17, 18), `Veganes Jambalaya` (17, 18, 27).
- 5 als `VGT` gekennzeichnete Desserts tragen `27` (Gelatine, nicht vegetarisch).
- 59 von 232 Gerichten (25 %) haben **gar keine** Allergen-Angabe.
- 23 Gerichte nennen im Text (Name oder Komponenten) Codes, die in `allergens_numbers` fehlen.
- Die aktuelle App entfernt solche Codes vor dem Filtern. Ein Ei-Allergiker sieht dadurch 9 von 25 eihaltig deklarierten Gerichten, ein Milch-Allergiker 10 von 64.

Mögliche Ursache für die Widersprüche: Pool-Gerichte (`Dessert`) und Komponenten mit Varianten. Ob das Label oder der Code falsch ist, lässt sich aus den Daten nicht entscheiden. Deshalb behandelt der Plan beides als Warnung statt als Entwarnung.
