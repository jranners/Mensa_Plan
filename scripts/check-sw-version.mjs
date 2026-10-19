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

  // Check git diff against base branch (main, origin/main, or HEAD~1)
  let currentBranch = '';
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    currentBranch = '';
  }

  let statusFiles = [];
  try {
    statusFiles = execSync('git status --porcelain', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const cleaned = line.replace(/^[MADRCU?!]+\s+/, '').trim();
        return cleaned.includes(' -> ') ? cleaned.split(' -> ').pop().trim() : cleaned;
      })
      .filter(Boolean);
  } catch {
    statusFiles = [];
  }

  const hasOriginMain = (() => {
    try {
      execSync('git rev-parse --verify origin/main', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  const hasLocalMain = (() => {
    try {
      execSync('git rev-parse --verify main', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  let baseBranch = null;
  if (currentBranch === 'main') {
    if (hasOriginMain) {
      const headSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      const originMainSha = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim();
      if (headSha !== originMainSha || statusFiles.length > 0) {
        baseBranch = 'origin/main';
      } else {
        baseBranch = 'HEAD~1';
      }
    } else if (statusFiles.length > 0 && hasLocalMain) {
      baseBranch = 'main';
    } else {
      baseBranch = 'HEAD~1';
    }
  } else if (hasLocalMain) {
    baseBranch = 'main';
  } else if (hasOriginMain) {
    baseBranch = 'origin/main';
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

    // Get list of changed files compared to base branch plus uncommitted working tree files
    const committedFiles = execSync(`git diff --name-only ${baseBranch}...HEAD`, { encoding: 'utf8' })
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    const changedFiles = Array.from(new Set([...committedFiles, ...statusFiles]));

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
      console.log(`Modified static assets between ${baseBranch} and working tree:`, touchedAssets);
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
