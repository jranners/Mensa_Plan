import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Service Worker & Shell Asset Integrity', () => {
  const rootDir = path.resolve(__dirname, '..');
  const swPath = path.join(rootDir, 'sw.js');
  const swContent = fs.readFileSync(swPath, 'utf8');

  const extractStaticAssets = () => {
    const match = swContent.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    return match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith("'./") || line.startsWith("'"))
      .map((line) => line.replace(/[',]/g, '').trim());
  };

  it('matches the scraper CACHE_NAME regex format (kstw-mensa-vNN)', () => {
    const regex = /const CACHE_NAME = 'kstw-mensa-v(\d+)';/;
    const match = swContent.match(regex);
    expect(match).not.toBeNull();
    const versionNum = parseInt(match[1], 10);
    expect(versionNum).toBeGreaterThanOrEqual(62);
  });

  it('contains icons/icon-192.png and icons/icon-512.png in STATIC_ASSETS', () => {
    expect(swContent).toContain("'./icons/icon-192.png'");
    expect(swContent).toContain("'./icons/icon-512.png'");
  });

  it('does not contain dead Stale-While-Revalidate API cache logic or dead API_HOST', () => {
    expect(swContent).not.toContain('const API_CACHE_NAME');
    expect(swContent).not.toContain('const API_HOST');
    expect(swContent).not.toContain('gstatic.com');
  });

  it('verifies every asset listed in STATIC_ASSETS physically exists on disk', () => {
    const assetEntries = extractStaticAssets();
    expect(assetEntries.length).toBeGreaterThan(20);

    for (const asset of assetEntries) {
      const relPath = asset === './' ? 'index.html' : asset.replace(/^\.\//, '');
      const filePath = path.join(rootDir, relPath);
      expect(fs.existsSync(filePath), `Asset missing on disk: ${relPath}`).toBe(true);
    }
  });

  it('verifies every ES module imported transitively from app.js is listed in STATIC_ASSETS', () => {
    const assetSet = new Set(extractStaticAssets());
    const visited = new Set();

    const walkImports = (relFile) => {
      const normalized = './' + relFile.replace(/^\.\//, '').replace(/\\/g, '/');
      if (visited.has(normalized)) return;
      visited.add(normalized);

      expect(
        assetSet.has(normalized),
        `Module ${normalized} is imported by the app but missing from STATIC_ASSETS in sw.js!`
      ).toBe(true);

      const absFile = path.join(rootDir, normalized.replace(/^\.\//, ''));
      const content = fs.readFileSync(absFile, 'utf8');
      const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importedRel = path.relative(
          rootDir,
          path.resolve(path.dirname(absFile), match[1])
        );
        walkImports(importedRel);
      }
    };

    walkImports('app.js');
    expect(visited.size).toBeGreaterThanOrEqual(20);
  });
});
