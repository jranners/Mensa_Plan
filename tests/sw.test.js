import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Service Worker & Shell Asset Integrity', () => {
  const rootDir = path.resolve(__dirname, '..');
  const swPath = path.join(rootDir, 'sw.js');
  const swContent = fs.readFileSync(swPath, 'utf8');

  it('matches the scraper CACHE_NAME regex format (kstw-mensa-vNN)', () => {
    const regex = /const CACHE_NAME = 'kstw-mensa-v(\d+)';/;
    const match = swContent.match(regex);
    expect(match).not.toBeNull();
    const versionNum = parseInt(match[1], 10);
    expect(versionNum).toBeGreaterThanOrEqual(49);
  });

  it('contains icons/icon-192.png and icons/icon-512.png in STATIC_ASSETS', () => {
    expect(swContent).toContain("'./icons/icon-192.png'");
    expect(swContent).toContain("'./icons/icon-512.png'");
  });

  it('does not contain dead Stale-While-Revalidate API cache logic', () => {
    expect(swContent).not.toContain('const API_CACHE_NAME');
    expect(swContent).not.toContain('Strategie A: API-Calls');
  });

  it('verifies every asset listed in STATIC_ASSETS physically exists on disk', () => {
    // Extract STATIC_ASSETS array from sw.js
    const match = swContent.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();

    const assetEntries = match[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith("'./") || line.startsWith("'"))
      .map(line => line.replace(/[',]/g, '').trim());

    expect(assetEntries.length).toBeGreaterThan(15);

    for (const asset of assetEntries) {
      const relPath = asset === './' ? 'index.html' : asset.replace(/^\.\//, '');
      const filePath = path.join(rootDir, relPath);
      expect(fs.existsSync(filePath), `Asset missing on disk: ${relPath}`).toBe(true);
    }
  });
});
