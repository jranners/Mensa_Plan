# KStW Mensaplan PWA – Vollständiger Diagnose- & Debugging-Bericht

**Datum:** 18. August 2026  
**Projekt:** Mensa Plan PWA (Kölner Studierendenwerk)  
**Status:** 🟢 Alle Fehler analysiert und behoben – Testsuite 11/11 bestanden – SW Cache `kstw-mensa-v34`

---

## 1. Zusammenfassung aller identifizierten Bugs

| ID | Komponente | Beschreibung | Schweregrad | Status |
|:---|:---|:---|:---:|:---:|
| **BUG-01** | `sw.js` | `data/config.js` lag in `STATIC_ASSETS` (Cache-First). Wurde ein neuer Supabase-API-Key über GitHub Actions gepusht, servierte der Service Worker weiterhin den alten gecachten Key $\rightarrow$ 401 Unauthorized bei allen Speiseplan-Abfragen. | 🔴 **Kritisch** | **Behoben** |
| **BUG-02** | `scripts/update-announcements.js` & Actions | Der Announcement-Scraper erzeugte bei jedem Durchlauf einen neuen `dateFetched`-Timestamp, selbst wenn die Ankündigungen inhaltlich identisch waren. `git diff` schlug alle 5 Minuten an $\rightarrow$ Commit-Spam in GitHub Actions. | 🔴 **Kritisch** | **Behoben** |
| **BUG-03** | `app.js` (Startup) | Bei Cache-Miss (z. B. Erstbesuch oder gelöschter Cache) wurde `renderSkeletons()` gerendert, blieb jedoch unsichtbar hinter dem fixierten `#app-splash` liegen, bis der Supabase-Netzwerk-Fetch fertig war. | 🟡 **Mittel** | **Behoben** |
| **BUG-04** | `app.js` (Cache-Validierung) | `loadMenuCache()` prüfte lediglich `Array.length > 0`. Veraltete Caches von vor Wochen wurden fälschlicherweise als gültig geladen und für 1–2 Sekunden gerendert. | 🟡 **Mittel** | **Behoben** |
| **BUG-05** | `app.js` (Background-Refresh) | Nach einem asynchronen Hintergrund-Update wurde die vom Nutzer aktiv ausgewählte Datumsansicht hart auf "Heute" zurückgesetzt. | 🟡 **Mittel** | **Behoben** |
| **BUG-06** | `app.js` (SW-Registrierung) | `registerSW()` wartete starr auf `window.addEventListener('load')`, was fehlschlagen konnte, wenn `document.readyState === 'complete'` durch `defer` bereits erreicht war. | 🟡 **Mittel** | **Behoben** |
| **BUG-07** | `scripts/update-key.js` | Der Regex war starr an Minifier-Variablennamen und Double-Quotes gekoppelt. Bei Ausfällen wurden keine verlässlichen Fehler geworfen. | 🟡 **Mittel** | **Behoben** |
| **BUG-08** | `.github/workflows/update-api-key.yml` | Fehlendes `continue-on-error: true` beim Key-Scraper brach die Pipeline ab und verhinderte das Announcement-Scraping. Der 5-Minuten-Cron erzeugte unnötige Quota-Belastung und Verzögerungen. | 🟡 **Mittel** | **Behoben** |
| **BUG-09** | `index.html` (CSP) | CSP `img-src` blockierte externe Bilder von KStW-Domains (`kstw.de`). | 🟢 **Niedrig** | **Behoben** |

---

## 2. Implementierte Fixes im Detail

### 2.1 Service Worker (`sw.js`)
- **Versionierung**: `CACHE_NAME` auf `kstw-mensa-v34` erhöht.
- **Entfernung aus Shell-Cache**: `./data/config.js` aus `STATIC_ASSETS` entfernt.
- **Network-First Strategie**: Dedizierter Fetch-Interceptor für `data/config.js` und `data/announcements.json` mit 2,5s Timeout und Offline-Cache-Fallback:
```javascript
if (pathname.endsWith('data/config.js') || pathname.endsWith('data/announcements.json')) {
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkPromise = fetch(event.request);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 2500)
        );
        const response = await Promise.race([networkPromise, timeoutPromise]);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        const cached = await cache.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        throw err;
      }
    })()
  );
  return;
}
```

### 2.2 Frontend Startup & UX (`app.js`)
- **Sofortige Skeleton-Anzeige**: Bei Cache-Miss wird `removeSplash()` sofort nach `renderSkeletons()` aufgerufen, damit Nutzer direkt die flüssige Lade-Animation sehen.
- **Cache-Gültigkeitsprüfung**: `hasValidCurrentOrFutureMenuData()` stellt sicher, dass Menü-Caches nur verwendet werden, wenn Tage $\ge$ heute enthalten sind.
- **Erhalt der Datumsselektion**: Bei `updateMenuDataBackground()` bleibt das aktuell vom Nutzer gewählte Datum erhalten (`renderApp(false)`).
- **Robuste SW-Registrierung**: Sofortige Registrierung bei `document.readyState === 'complete'`.
- **Bereinigung**: Redundanter synchroner `initTheme()` IIFE-Aufruf am Dateianfang entfernt.

### 2.3 Scraper-Skripte & CI/CD
- **`scripts/update-key.js`**:
  - Unabhängige Extraktion für `sb_publishable_...` und `eyJ...` (JWT).
  - Inhaltsprüfung: Keine Dateiänderungen und keine Commits, wenn der Key unverändert ist.
  - Automatische Synchronisation von `API_HOST` und `CACHE_NAME` in `sw.js` bei Key-Änderung.
- **`scripts/update-announcements.js`**:
  - Inhaltsvergleich: Timestamp wird bei unverändertem Inhalt beibehalten (bis zu 12 Stunden).
  - Fehlertoleranter Exit mit Code 0, damit KStW-Server-Auszeiten die GitHub Action nicht abbrechen.
- **`.github/workflows/update-api-key.yml`**:
  - `continue-on-error: true` und `if: always()` hinzugefügt.
  - Cron auf `*/30 6-16 * * 1-5` (Geschäftszeiten MEZ/MESZ) optimiert.
  - `sw.js` in `git add` aufgenommen.

---

## 3. Testergebnisse & Verifikation

- **Automatisierte Testsuite (`scratch/verification.test.js`):** 11/11 Tests bestanden (SW Cache-Version, Tailwind Dark Mode Tokens, Allergen-Sanitierung, Share Fallback).
- **Supabase RPC Live-Test:** Status 200 OK, 13 Tage Speisedaten erfolgreich geladen.
- **CloudMensa Scraper Live-Test:** Findet Script-Bundle `/assets/index-BK7DnEjF.js` und extrahiert den aktuellen Key `sb_publishable_G6p4Gfhzcx2AM5ToCWAChA_pY-PKF2a`.
- **Multi-Viewport VM-Simulation:** Erfolgreich für 375px (Mobile), 768px (Tablet), 1200px (Desktop).
- **CSS Build:** Erfolgreich minifiziert mit Tailwind CSS.

---

## 4. Empfehlungen für langfristige Architekturverbesserungen

1. **Native Supabase JS Client oder direkter REST Query:**
   - Aktuell wird der Supabase RPC Endpoint per manuellem `fetch()` `POST` aufgerufen. Dadurch greift das Standard-GET-Caching im Service Worker nicht. Die Kombination aus `localStorage`-Caching im Client und Network-First für `config.js` ist jetzt optimal abgestimmt.
2. **Offline-Sync von Favoriten & Einstellungen:**
   - Einstellungen und Filter bleiben in `localStorage` persistent. Bei einer zukünftigen Benachrichtigungsfunktion (z. B. Push-API für Lieblingsgerichte) empfiehlt sich die Speicherung in `IndexedDB`.
3. **Web-App Manifest Update-Notification:**
   - Der Service-Worker Update-Dialog informiert Nutzer sauber über neue App-Versionen und führt ein kontrolliertes Reloading ohne Stale-Caches durch.
