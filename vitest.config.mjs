import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Die Tests laufen bewusst in Europe/Berlin, damit sie unabhängig von der Zeitzone des Entwicklungsrechners sind.
    // Einzelne Tests prüfen Zeitzonen-Robustheit explizit über Intl und nicht über die Prozess-Zeitzone.
    env: { TZ: 'Europe/Berlin' }
  }
});
