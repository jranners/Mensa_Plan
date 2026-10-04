# KStW Mensaplan PWA

> [!TIP]
> **Du suchst die Live-App?** Du findest den Mensaplan direkt unter:
> 👉 **[https://jranners.github.io/Mensa_Plan/](https://jranners.github.io/Mensa_Plan/)**

---

Eine schlichte, barrierefreie und mobile-first Progressive Web App (PWA) für den Speiseplan des Kölner Studierendenwerks (KStW). Die App läuft vollständig clientseitig im Browser (serverless) und bietet verlässlichen Offline-Support für die Nutzung in Mensa-Räumen mit schlechtem Mobilfunkempfang.

## Features
* **KStW Corporate Design**: Kachel-Optik im offiziellen Farbschema (KStW-Blau `#143d59` und KStW-Gelb `#ffd600`) mit vollständigem Dark Mode und Light Mode.
* **Onboarding & Speicherung**: Beim ersten Start wählst du deine Lieblingsmensen, deine Ernährungsvorlieben (Vegan/Vegetarisch/Alles) und die Sprache (Deutsch/Englisch) aus. Diese Einstellungen werden lokal im Browser gespeichert (`localStorage`).
* **Sicherheitsfokussierter Allergenfilter**:
  * Dreistufiges Schutzmodell (`contains`, `uncertain`, `unknown`).
  * Gerichte mit deklarierten Allergenen werden verlässlich gefiltert.
  * Gerichte ohne Allergen-Angaben oder mit potentiell allergenhaltigen Dessert-Komponenten werden **nie** versteckt, sondern mit sichtbarem Warnhinweis („Keine Allergen-Info – bitte Personal fragen“) hervorgehoben.
  * Automatische Erkennung von Widersprüchen (z. B. Diät-Label `Vegan` bei deklarierten tierischen Inhaltsstoffen).
* **Baukasten-Organisation**:
  * Strukturierte Kategorisierung in Hauptgerichte, Meisterwerk (Aktionen, Grill, Pizza), Buffet & Selbstbedienung, Beilagen und Desserts.
  * Anzeige von Theken (z. B. `EG Nord`, `MG Nord`) und Ausgabezeiten (z. B. `11:30 - 14:30 Uhr`).
* **Offline-Unterstützung & Lebenszyklus**:
  * Der Service Worker (`sw.js`) cacht die statische App-Shell.
  * Menüs werden clientseitig validiert und lokal gespeichert.
  * Automatischer Hintergrund-Refresh bei Wiederkehr in die App (`visibilitychange`) und Erkennung von Datumswechseln.
  * Update-Dialog mit „Jetzt neu starten“- und „Später“-Option bei neuen Versionen.

---

## Entwicklung & Lokaler Start

### Voraussetzungen
* Node.js (Version 18+)

### Installation
```bash
npm install
```

### Tests ausführen
```bash
npm test
```
Führt die Vitest-Testsuite (Unit-Tests für Allergenfilterung, Diät-Logik, Zeitzonenberechnung, Mensa-Zuordnung, Öffnungszeiten, Storage-Migration und Validierung) aus.

### CSS kompilieren
```bash
npm run build:css
```

### Lokalen Webserver starten
```bash
python3 -m http.server 8000
```
Öffne anschließend `http://localhost:8000` im Browser.

### PWA auf dem Smartphone testen
1. Greife vom Smartphone über dein lokales WLAN auf die IP deines Rechners zu (z. B. `http://192.168.x.x:8000`).
2. Nutze im mobilen Browser die Funktion „Zum Startbildschirm hinzufügen“ / „App installieren“.

---

## Architektur

* **Vanilla JavaScript (ES Modules)**: Reine Webstandards ohne schwere Frameworks.
* **Tailwind CSS**: Minifizierter Build via `input.css` -> `styles.css`.
* **Modulstruktur (`src/lib/`)**:
  * `allergens.js`: Drei-Stufen-Allergenmodell, Auswertung und Warnungen.
  * `diet.js`: Diät-Erkennung (Vegan, Vegetarisch, Konflikterkennung).
  * `dates.js`: Zeitzonensichere Datumslogik (`Europe/Berlin`), Wochenberechnung.
  * `canteen-match.js`: Zuordnung von Gerichten zu Mensen anhand `ort_id`, Location und Screens.
  * `hours.js`: Strukturierte Öffnungszeiten und Statusberechnung.
  * `dish.js`: Auswertung von Ausgabezeiten, Theken und Metadaten.
  * `validation.js`: Validierung von RPC-Antworten und Caches.
  * `storage.js`: Gekapselte Storage-Verwaltung und Schema-Migration v2.
  * `lifecycle.js`: Tab-Lebenszyklus und Hintergrund-Aktualisierungen.
  * `a11y.js`: Barrierefreiheit, Fokus-Fallen und ARIA-Attribute.
  * `html.js`: Sicheres HTML-Escaping gegen XSS.

---

## Datenquelle (CloudMensa Supabase)
Die Speisepläne werden direkt vom CloudMensa-Supabase-Projekt bezogen:
* **Supabase URL**: Verwaltet via `data/config.js` (GitHub Action)
* **RPC Endpoint**: `public_get_week_menu`
* **Ankündigungen**: Verwaltet via `data/announcements.json`
