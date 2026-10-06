# Mensa Plan PWA – Design System & UI Specification

> **Version:** 2.0 (Post-Audit Rework)  
> **Status:** Live & Production-Ready (`kstw-mensa-v56`)  
> **Zielgruppe:** Senior Product Designers, Stitch MCP, UI/UX-Iterationen

---

## 1. Übersicht & Design-Philosophie

Die Mensa Plan PWA ist eine native-artige progressive Web-App für das Kölner Studierendenwerk (KStW). Das Design folgt dem Prinzip: **Informationsdichte ohne Überladung, maximale Geschwindigkeit und absolute Barrierefreiheit.**

### Kernprinzipien
1. **Mobile-First & One-Thumb Usability:** Alle Primärfunktionen (Heute-Sprung, Tagewechsel, Diät-Filter, Menü) sind im oberen bzw. leicht erreichbaren Daumenbereich angeordnet.
2. **Klares Farb-Hierarchie-System:**
   - **KStW Tiefblau & Slate-Navy:** Schafft professionelle Tiefe, Struktur und Seriosität.
   - **KStW Signalgold/Gelb (`#ffd600`):** Hebt Preise, aktive Tage, Favoriten und CTAs sofort hervor.
   - **Ampelfarben für Diät & Sicherheit:** Grün für Vegan, Bernstein für Vegetarisch/Warnungen, Koralle/Rot für Fleisch/Konflikte.
3. **Konsequenter Dark/Light-Mode (1:1 Parität):** Jede Komponente besitzt ein semantisches Äquivalent im Hell- und Dunkelmodus mit sorgfältig abgestimmten Kontrastverhältnissen (WCAG AAA/AA).
4. **Keine Clipping- oder Overflow-Probleme:** Flex-Wrap, Break-Words und Min-W-0-Schutz auf allen Textelementen verhindern Textabschneidungen selbst auf schmalen 320px-Screens.

---

## 2. Farbpalette & Design-Tokens

### 2.1 Primäre Marken- & Oberflächenfarben

| Token | Light Mode (Hex) | Dark Mode (Hex) | Semantische Verwendung |
|---|---|---|---|
| `--app-bg` | `#f0f5fa` → `#f8fafc` | `#08131e` → `#0f2236` | App-Hintergrundverlauf (Vignette) |
| `--surface-card` | `#ffffff` | `#122338` (`navy-card`) | Mensa-Hauptkarten, Container |
| `--surface-dish` | `#f8fafc` (`slate-50`) | `#182c44` (`navy-dish`) | Speisenkarten (Hauptgericht, Beilage) |
| `--surface-dish-hover` | `#ffffff` | `#1f3754` (`navy-dish-hover`) | Hover-/Active-Zustand von Speisen |
| `--surface-modal` | `#ffffff` | `#0b1926` (`navy-surface`) | Modale Dialoge (Menü, Stats, Settings) |
| `--text-heading` | `#143d59` | `#ffffff` | Titel, Mensanamen, Header |
| `--text-main` | `#373737` | `#e2e8f0` (`slate-200`) | Standard-Fließtext, Beschreibungen |
| `--text-muted` | `#64748b` (`slate-500`) | `#94a3b8` (`slate-400`) | Adressen, Uhrzeiten, Zähler |
| `--border-subtle` | `rgba(0,39,62, 0.08)` | `rgba(255,255,255, 0.08)` | Karten- & Trennlinien |

### 2.2 Akzente & Funktionsfarben

| Token | Hex | Verwendung |
|---|---|---|
| `--accent-gold` | `#ffd600` | Preisschild-Hintergrund, aktiver Wochentag-Pill, Favoriten-Stern |
| `--accent-gold-hover` | `#f5c400` | Hover-State für goldene Schaltflächen |
| `--brand-navy` | `#00273e` | Textfarbe auf goldenen Preisschildern, Header-Logos |
| `--brand-blue` | `#143d59` | Aktive Filter-Buttons, Primär-Container |
| `--badge-vegan-bg` | `#ecfdf5` / `#052e16` | Hintergrund Vegan-Badge (Light / Dark) |
| `--badge-vegan-text` | `#065f46` / `#4ade80` | Text Vegan-Badge (Light / Dark) |
| `--badge-veg-bg` | `#fffbeb` / `#451a03` | Hintergrund Vegetarisch-Badge (Light / Dark) |
| `--badge-veg-text` | `#92400e` / `#facc15` | Text Vegetarisch-Badge (Light / Dark) |
| `--badge-meat-bg` | `#fff1f2` / `#4c0519` | Hintergrund Fleisch/Fisch-Badge (Light / Dark) |
| `--badge-meat-text` | `#9f1239` / `#fb7185` | Text Fleisch/Fisch-Badge (Light / Dark) |
| `--warning-bg` | `#fffbeb` / `#451a03` | Warnbadge fehlende Allergene / Unsicherheit |
| `--warning-border` | `#fde68a` / `#78350f` | Rahmen für Allergen-Warnhinweise |
| `--favorite-ring` | `#f59e0b` / `#fbbf24` | 2px Ring & Glow um favorisierte Gerichte |

---

## 3. Typografie

- **Schriftfamilie:** `Hanken Grotesk`, sans-serif (lokal gecacht als WOFF2)
- **Fallback-Kette:** `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

| Stil | Schriftgröße | Zeilenhöhe | Gewicht | Verwendung |
|---|---|---|---|---|
| `Headline-LG` | 18px (1.125rem) | 1.25 | Bold (700) | App-Titel, Mensaname, Modal-Überschriften |
| `Headline-SM` | 15px (0.9375rem) | 1.35 | Bold (700) | Speisentitel (Hauptgerichte) |
| `Title-Compact` | 13–14px | 1.3 | Bold (700) | Speisentitel (Beilagen & Desserts) |
| `Label-LG` | 14px (0.875rem) | 1.2 | Extrabold (800) | Onboarding-CTAs, Primärschaltflächen |
| `Label-MD` | 12–13px | 1.2 | Bold (700) | Datums-Pills, Diät-Filter-Segmente |
| `Label-Price` | 13px (0.8125rem) | 1.0 | Extrabold (800) | Preise (`1,50 €`, `2,25 €`) im Badge |
| `Body-MD` | 13px (0.8125rem) | 1.45 | Regular (400) | Adressen, Speisenbeschreibungen |
| `Body-SM` | 11–12px | 1.35 | Medium (500) | Theken-Name, Uhrzeiten, Allergen-Pills |
| `Badge-Micro` | 10–11px | 1.0 | SemiBold (600) | Vegan/Veg-Pills, `+3` Überlaufzähler |

---

## 4. Spacing, Radien & Layout-Raster

- **8pt Basis-Raster:** Abstände sind Vielfache von 4px / 8px (`gap-1` = 4px, `gap-2` = 8px, `gap-2.5` = 10px, `gap-4` = 16px).
- **Rahmenradien (Border-Radius):**
  - `rounded-full` (`9999px`): Alle interaktiven Pills (Preisschild, Heute-Button, Datums-Pills, Diät-Filter, Allergen-Badges).
  - `rounded-3xl` (`24px`): App-Container (Desktop), Mensa-Hauptkarten, Modale Dialoge.
  - `rounded-2xl` (`16px`): Speisenkarten, Menü-Aktionsblöcke, Statistik-Cards.
  - `rounded-xl` (`12px`): Eingabefelder, Theken-Pills, Bestätigungs-Buttons.
- **Viewport-Begrenzung:**
  - Mobil: Volle Breite (`100vw`), maximal `448px` (`max-w-md`) zentriert.
  - Desktop / Tablet: `max-w-6xl` (`1152px`) mit eleganter Schatten-Vignette und 32px Außenabstand.

---

## 5. Komponenten-Spezifikation

### 5.1 Sticky Header (`<header>`)
- **Struktur:** `[Logo] [Titel: Mensaplan] ----- [Heute-Button] [Theme-Toggle] [Menü-Button]`
- **Hintergrund:** Dunkelblau mit Glasmorphism (`glass-dark`, `backdrop-blur-md`).
- **Heute-Button (`#today-btn`):**
  - Pill-Button mit Kalender-Icon + Label „Heute“ (bzw. „Today“).
  - Styling: Transparenter weißer Hintergrund (`bg-white/15 hover:bg-white/25`), aktive Skalierung (`active:scale-95`).
  - Springt zum aktuellen Tag und scrollt die Datumsleiste ins Blickfeld.
- **Theme-Toggle (`#theme-toggle`):** Weicher Übergang zwischen Sonnen- und Mondsichel-Icon.
- **Hamburger-Menü-Button (`#menu-btn`):** Dreistrich-Icon öffnet das Modal `#app-menu-modal`.

### 5.2 Datums-Segment-Karussell
- **Zweck:** Horizontale Leiste der Wochentage der aktuellen Woche (Montag–Freitag, ggf. Samstag).
- **Status Nicht-Aktiv:** `bg-white dark:bg-[#122338] text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/5`.
- **Status Aktiv (Gewählt):** `bg-[#ffd600] text-[#00273e] font-extrabold shadow-md scale-102`.
- **Favoriten-Punkt:** Zeigt einen kleinen goldenen Stern/Punkt, wenn an diesem Tag ein gemerktes Lieblingsgericht angeboten wird.

### 5.3 Diät-Filter-Segmente
- **Optionen:** `[ Alles ] [ Vegetarisch ] [ Vegan ]`
- **Container:** Abgerundete Kapsel mit weichem Schatten.
- **Aktiv-State:** Kräftiges Navy im Light Mode (`#143d59 text-white`) bzw. Gold im Dark Mode (`#ffd600 text-[#00273e]`).

### 5.4 Mensa-Karten (`.canteen-card`)
- Großzügig abgerundeter Container (`rounded-3xl p-6`).
- **Header:** Mensaname, Straße, PLZ/Ort und Live-Öffnungszeit-Badge:
  - *Jetzt geöffnet · schließt in 45 Min.* (Grün/Emerald)
  - *Öffnet um 11:30 Uhr* (Blau/Slate)
  - *Heute geschlossen* (Grau/Gedämpft)
- **Sektionen:**
  1. *Hauptgerichte* (`dinner_dining`)
  2. *Meisterwerk / Aktionen* (`workspace_premium` mit goldenem Glanzrand)
  3. *Buffet & Selbstbedienung* (`scale` mit Grammrechner)
  4. *Beilagen & Gemüse* (`grain`)
  5. *Dessert & Obst* (`icecream`)

### 5.5 Speisenkarte Hauptgericht (`renderMainDishCard`)
- **Container:** `rounded-2xl p-4 border border-slate-200/70 dark:border-white/[0.08] overflow-hidden break-words min-w-0`.
- **Kopfbereich:**
  - Aktions-Badge (`Heimspiel`, `Querbeet`, `Meisterwerk`).
  - Preisschild: Markantes goldenes Pill-Badge (`#ffd600`, Schrift `#00273e`, `font-extrabold`).
  - Titel: Bis zu 2 Zeilen (`line-clamp-2`), kein Textüberlauf.
  - Unterkomponenten (z. B. *Bratensauce · Kartoffelstampf*): Dezent formatiert mit Klick zum Aufklappen.
- **Theken- & Zeit-Meta:**
  - Theken-Badge: `[MG Nord]`, `[EG Nord]`, `[MG Süd]`.
  - Ausgabezeit: `[11:30 - 14:15]`.
- **Fußbereich:**
  - Links: Diät-Badges (`Vegan`, `Vegetarisch`), Warnbadge bei fehlenden Allergenen.
  - Rechts: Stern (Favorit, `#ffd600` bei Aktivierung), Share-Button, Allergen-Schaltfläche mit Nummern-Pills (`[1] [2] [8] +5`).

### 5.6 Speisenkarte Beilagen & Desserts (`renderCompactDishCard`)
- **Layout:** Vertikaler Stapel voller Breite (`flex flex-col gap-2.5`) – **kein 2-Spalten-Raster**, um Quetschen auf Handys zu eliminieren.
- **Kompakt-Footer:**
  - Redundantes Textlabel `"Allergene:"` ist rein für Screen-Reader hinterlegt (`.sr-only`), optisch werden nur die Pill-Badges (`[11]`, `[19h]`, `+1`) dargestellt.
  - Verhindert jeglichen Überstand über den Kartenrand hinaus.

### 5.7 Hamburger-Menü (`#app-menu-modal`)
- **Verschlankt auf 2 Kernpunkte:**
  1. **Einstellungen** (Mensen, Diät, Allergene, Tarif)
  2. **Mensa-Statistiken** (Vegan-Anteil, Preise, Häufigkeit)
- **Design:** Saubere Card-Buttons mit Icon-Vignette, Chevron und erklärendem Subtext.
- **Barrierefreiheit:** Schließen per X-Button, Klick auf Backdrop oder `Escape`-Taste; vollständige Fokusfalle (`trapFocus`).

### 5.8 Statistik-Modal (`#stats-modal`)
- **Speicher-Footprint:** Streng **< 2 KB lokal** (`kstw_stats_v1` in `localStorage`), keine externen Tracker.
- **Zeitraum- & Mensen-Steuerung:**
  - **Zeitraum:** Umschaltbar zwischen `2 Wochen` (aktueller Datenbestand), `Diese Woche` und `All-Time` (historischer Gesamtzeitraum seit Januar 2026, On-Demand gestreamt und im ServiceWorker gecacht, ~20 KB gzip).
  - **Mensen-Scope:** Filterung nach `Meine Mensen` (aktive Auswahl) oder `Alle Mensen`.
- **Kategorie-Filterung:**
  - `🍲 Hauptgerichte` (Standard – bereinigt um tägliche Beilagen/Desserts wie Schokopudding oder Salatbuffet)
  - `🥗 Beilagen`
  - `🍮 Desserts`
- **Ausklappbare Häufigkeits-Rangliste:**
  - Standardmäßig kompakte Top 5 mit Medaillen-Badges (🥇, 🥈, 🥉).
  - Vollständig ausklappbar via `⌄ Mehr anzeigen ({count})`, um den gesamten Speiseplan-Verlauf zu durchsuchen.
- **Ernährungs- & Preis-Metriken:**
  - Segmentierter Verteilungsbalken (Vegan, Vegetarisch, Fleisch & Fisch) mit Prozenten und absoluten Zählern.
  - 3-Spalten-Raster für *Durchschnittspreis*, *Günstigstes Gericht* und *Teuerstes Gericht* (basierend auf gewähltem Tarif).
  - Automatische Favoriten-Erkennung mit Trefferzähler.
- **Speicher-Badge:** Grünes Pill-Badge: *„🌱 Extrem speicherplatzsparend (< 2 KB lokal)“*.

### 5.9 Einstellungs- & Onboarding-Modal (`#onboarding`)
- **Sprachumschalter:** Dual-Pill für Deutsch & English.
- **Mensen-Akkordeon:** Unterteilt in *Mensen* und *Bistros & Cafés* mit nativen Checkboxen.
- **Diät-Auswahl & Allergen-Mehrfachfilter:** 14 Standard-Allergene mit Nummern-Codes.
- **Tarif-Wahl:** Studierende, Bedienstete, Gäste, Externe.
- **Zwei-Schritt-Reset:** Schützt Nutzerdaten vor versehentlichem Löschen.

---

## 6. Screenshot-Katalog (Mobile Referenzen)

Alle Screenshots wurden in nativer 2x Retina-Auflösung (iPhone 14 Viewport, 390 × 844 px) direkt aus der Live-App erfasst und liegen in diesem Verzeichnis:

| Datei | Bildschirm / Zustand | Besonderheiten |
|---|---|---|
| `01_mobile_onboarding_light.png` | Willkommen & Ersteinstellung (Light) | Mensenauswahl, Sprachwahl, CTA-Button |
| `02_mobile_feed_light.png` | Haupt-Speiseplan (Light Mode) | Neuer Heute-Button, Tagestreifen, Hauptgericht-Karten |
| `03_mobile_feed_sides_desserts_light.png` | Beilagen & Aktionen (Light Mode) | Keine Überläufe, volle Kartenbreite |
| `04_mobile_feed_dark.png` | Haupt-Speiseplan (Dark Mode) | Navy-Tiefen, Preisschilder, Mond-Icon |
| `05_mobile_feed_sides_desserts_dark.png` | Beilagen & Desserts (Dark Mode) | Dark-Cards `#182c44`, Badges, Allergene |
| `06_mobile_hamburger_menu_dark.png` | Verschlanktes Menü (Dark Mode) | Exakt 2 Optionen: Einstellungen & Statistiken |
| `07_mobile_stats_modal_dark.png` | Mensa-Statistiken (Dark Mode) | Verteilungsbalken, Preise, Top-5-Gerichte |
| `08_mobile_stats_modal_light.png` | Mensa-Statistiken (Light Mode) | Hellmodus-Äquivalent der Statistiken |
| `09_mobile_allergens_modal_light.png` | Allergen-Detaildialog (Light Mode) | Klare Auszeichnung, Gewähr-Disclaimer |
| `10_mobile_settings_modal_light.png` | Einstellungen im Betrieb (Light Mode) | Draft-Zustand, Speichern-Button |
| `11_mobile_stats_all_time.png` | All-Time Gesamtzeitraum-Statistiken | 204 Öffnungstage, 1.300+ Gerichte, Top-Rangliste |

---

## 7. Richtlinien für Stitch-Iterationen

Wenn du mit **Stitch MCP** am weiteren Redesign arbeitest, beachte folgende Leitplanken:

1. **Behalte den Kontrast der Preisschilder bei:** Die gelbe Pill `#ffd600` mit dunkelblauem Text `#00273e` ist das visuelle Erkennungsmerkmal der App und garantiert perfekte Lesbarkeit auch bei Sonnenlicht.
2. **Keine Rückkehr zum 2-Spalten-Raster für Beilagen/Desserts auf Mobile:** Kompakte Speisen müssen auf Viewports unter 640px immer die volle Spaltenbreite nutzen, um Badge-Kollisionen zu vermeiden.
3. **Statistiken immer speicheroptimiert halten:** Keine externen Analytics-Bibliotheken oder schwergewichtigen Chart-Engines einbinden; die CSS-Segmentleiste ist extrem schnell, responsive und benötigt 0 KB zusätzlichen JS-Code.
4. **Allergen-Sicherheitsregel (AGENTS.md):** Speisen ohne Allergen-Angaben dürfen nie ausgeblendet werden, sondern erhalten immer das auffällige Warnbadge.
5. **Dark Mode Tiefenhierarchie einhalten:**
   - App-Hintergrund: `#08131e` bis `#0f2236`
   - Mensa-Container: `#122338`
   - Speisen-Karten: `#182c44`
   - Hover / Active: `#1f3754`
   - Modaler Dialog: `#0b1926`
