# KStW Mensaplan PWA

> [!TIP]
> **Du suchst die Live-App?** Du findest den Mensaplan direkt unter:
> 👉 **[https://jranners.github.io/Mensa_Plan/](https://jranners.github.io/Mensa_Plan/)**

---

Eine schlichte, mobile-first Progressive Web App (PWA) für den Speiseplan des Kölner Studierendenwerks (KStW). Die App läuft vollständig clientseitig im Browser (serverless) und bietet Offline-Support für die Nutzung in Mensa-Kellerräumen.

## Features
* **KStW Corporate Design**: Kachel-Optik im offiziellen Farbschema (KStW-Blau `#143d59` und KStW-Gelb `#ffd600`).
* **Onboarding & Speicherung**: Beim ersten Start wählst du deine Lieblingsmensen, deine Ernährungsvorlieben (Vegan/Vegetarisch/Alles) und die Sprache (Deutsch/Englisch) aus. Diese Einstellungen werden lokal im Browser gespeichert (`localStorage`).
* **Smarte Daten-Filterung**:
  * Zeigt **ausschließlich Studi-Preise** (andere Tarife werden ausgeblendet).
  * Filtert nach Vegan 🌱 und Vegetarisch 🥕.
  * Zeigt genaue Theken-Informationen (z. B. `EG Nord 2`) und Ausgabe-Uhrzeiten (z. B. `14:30 - 18:15`) direkt auf der Gerichtskarte an, sofern verfügbar.
  * Blendet Wochenenden und Tage ohne Speiseplandaten automatisch aus.
* **Offline-Unterstützung**: Der Service Worker (`sw.js`) cacht die App-Struktur sowie die abgerufenen Speisepläne. So kann der Speiseplan auch bei schlechtem Netz direkt in der Mensa aufgerufen werden.
* **API Key Auto-Recovery**: Sollte der Betreiber (CloudMensa) die Supabase-Schlüssel ändern, liest die App im Fall eines Fehlers automatisch die aktuellen Zugangsdaten aus den Web-Assets aus, sodass die App wartungsfrei bleibt.

---

## Installation & Lokaler Start

1. Öffne ein Terminal im Projektverzeichnis `/Users/julius/Desktop/Git_Repo/Mensa_Plan`.
2. Starte einen einfachen lokalen Webserver:
   ```bash
   python3 -m http.server 8000
   ```
3. Öffne deinen Webbrowser unter:
   ```
   http://localhost:8000
   ```

Um die App als **PWA auf deinem Smartphone** zu installieren:
1. Greife vom Smartphone über dein lokales WLAN auf die IP deines Rechners zu (z. B. `http://192.168.x.x:8000`).
2. Nutze im mobilen Browser die Funktion "Zum Startbildschirm hinzufügen".

---

## Technische Details

### Datenquelle (CloudMensa Supabase)
Die Speisepläne werden direkt vom CloudMensa-Supabase-Projekt geladen:
* **Supabase URL**: `https://axxiebkvmfjmiaanviob.supabase.co`
* **API Key**: `sb_publishable_G6p4Gfhzcx2AM5ToCWAChA_pY-PKF2a`
* **Organization ID**: `4c89c35f-16ac-413f-af04-ec9ffe610f67` (KStW)
* **RPC Endpoint**: `public_get_week_menu`

Da es sich um einen öffentlichen Client-Schlüssel handelt, ist CORS serverseitig für alle Ursprünge freigeschaltet.
