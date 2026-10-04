#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const swPath = path.join(rootDir, 'sw.js');

function getCacheVersion(content) {
  const match = content.match(/const CACHE_NAME = 'kstw-mensa-v(\d+)';/);
  return match ? parseInt(match[1], 10) : null;
}

function run() {
  const swContent = fs.readFileSync(swPath, 'utf8');
  const currentVersion = getCacheVersion(swContent);

  if (!currentVersion) {
    console.error('❌ Error: Could not parse CACHE_NAME in sw.js! Format must be: const CACHE_NAME = \'kstw-mensa-v<number>\';');
    process.exit(1);
  }

  console.log(`Current sw.js CACHE_NAME version: v${currentVersion}`);

  // Check git diff against base branch (main or origin/main)
  let baseBranch = 'main';
  try {
    execSync('git rev-parse --verify main', { stdio: 'ignore' });
  } catch {
    try {
      execSync('git rev-parse --verify origin/main', { stdio: 'ignore' });
      baseBranch = 'origin/main';
    } catch {
      baseBranch = null;
    }
  }

  if (!baseBranch) {
    console.log('ℹ️ Base branch (main/origin/main) not found. Verifying sw.js syntax only.');
    console.log('✅ Service worker syntax valid.');
    return;
  }

  try {
    // Get sw.js from base branch
    const baseSwContent = execSync(`git show ${baseBranch}:sw.js`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const baseVersion = getCacheVersion(baseSwContent);

    // Get list of changed files compared to base branch
    const changedFiles = execSync(`git diff --name-only ${baseBranch}...HEAD`, { encoding: 'utf8' })
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    // Parse STATIC_ASSETS from current sw.js
    const assetsMatch = swContent.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/);
    const staticAssets = assetsMatch
      ? assetsMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith("'./") || line.startsWith("'"))
          .map(line => line.replace(/[',]/g, '').trim().replace(/^\.\//, ''))
          .filter(f => f && f !== '.')
      : [];

    staticAssets.push('sw.js');
    staticAssets.push('index.html');

    const touchedAssets = changedFiles.filter(file => staticAssets.includes(file));

    if (touchedAssets.length > 0) {
      console.log(`Modified static assets between ${baseBranch} and HEAD:`, touchedAssets);
      if (baseVersion !== null && currentVersion <= baseVersion) {
        console.error(`❌ Rule Violation: Static assets were modified, but CACHE_NAME (v${currentVersion}) was not bumped above base v${baseVersion}!`);
        console.error('Please increment CACHE_NAME in sw.js (line 1) according to .agents/AGENTS.md.');
        process.exit(1);
      }
      console.log(`✅ CACHE_NAME is bumped (v${baseVersion} -> v${currentVersion}) for ${touchedAssets.length} modified assets.`);
    } else {
      console.log(`✅ No cached assets were modified compared to ${baseBranch}.`);
    }
  } catch (err) {
    console.warn(`⚠️ Warning: Could not complete git diff check (${err.message}). Proceeding.`);
  }
}

run();
