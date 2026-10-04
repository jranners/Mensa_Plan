import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;
const USER_DATA_DIR = `/tmp/chrome-screenshot-profile-${Date.now()}`;
const OUTPUT_DIR = '/Users/julius/Desktop/Git_Repo/Mensa_Plan/Design_Rework';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForCdp(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(item => item.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page;
      }
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error('CDP target page not available');
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
    });
    this.ws.onmessage = evt => {
      const msg = JSON.parse(evt.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  async send(method, params = {}) {
    await this.ready;
    const msgId = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  async capture(filePath) {
    const res = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false
    });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filePath}`);
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Starting headless Chrome...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'http://localhost:8000/'
  ]);

  try {
    const target = await waitForCdp();
    console.log('Connected to CDP target:', target.webSocketDebuggerUrl);

    const cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Emulate iPhone 14 mobile viewport (390 x 844, scale 2)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    await sleep(1500);

    // 1. Capture Onboarding Screen (Initial Visit)
    await cdp.capture(path.join(OUTPUT_DIR, '01_mobile_onboarding_light.png'));

    // Submit Onboarding to load the actual menu and trigger fetch
    await cdp.eval(`document.getElementById('submit-onboarding-btn')?.click();`);
    console.log('Submitted onboarding, waiting for live menu data to render...');
    
    // Wait for live data to load and render dishes
    for (let i = 0; i < 40; i++) {
      const cardCount = await cdp.eval(`document.querySelectorAll('.canteen-card article').length`);
      if (cardCount && cardCount > 0) {
        console.log(`Rendered ${cardCount} dish cards!`);
        break;
      }
      await sleep(250);
    }
    await sleep(1000);

    // Ensure Light mode
    await cdp.eval(`
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('kstw_theme', 'light');
    `);
    await sleep(400);

    // 2. Capture Light Mode Feed (Header with Heute button, Date selector, Canteen cards, Main dishes)
    await cdp.capture(path.join(OUTPUT_DIR, '02_mobile_feed_light.png'));

    // Scroll down slightly to showcase side dishes & desserts with no overflow
    await cdp.eval(`window.scrollTo({ top: 580, behavior: 'instant' });`);
    await sleep(400);
    await cdp.capture(path.join(OUTPUT_DIR, '03_mobile_feed_sides_desserts_light.png'));

    // Scroll back to top and toggle to Dark Mode
    await cdp.eval(`
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('kstw_theme', 'dark');
    `);
    await sleep(400);

    // 3. Capture Dark Mode Feed
    await cdp.capture(path.join(OUTPUT_DIR, '04_mobile_feed_dark.png'));

    // Scroll down in dark mode to show compact cards & badges
    await cdp.eval(`window.scrollTo({ top: 580, behavior: 'instant' });`);
    await sleep(400);
    await cdp.capture(path.join(OUTPUT_DIR, '05_mobile_feed_sides_desserts_dark.png'));

    // Scroll back to top
    await cdp.eval(`window.scrollTo({ top: 0, behavior: 'instant' });`);
    await sleep(300);

    // 4. Open Hamburger Menu (Dark Mode)
    await cdp.eval(`document.getElementById('menu-btn')?.click();`);
    await sleep(500);
    await cdp.capture(path.join(OUTPUT_DIR, '06_mobile_hamburger_menu_dark.png'));

    // 5. Open Statistics Modal with real live data (Dark Mode)
    await cdp.eval(`document.querySelector('[data-action="menu-open-stats"]')?.click();`);
    await sleep(600);
    await cdp.capture(path.join(OUTPUT_DIR, '07_mobile_stats_modal_dark.png'));

    // 6. Switch Statistics Modal to Light Mode
    await cdp.eval(`
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('kstw_theme', 'light');
    `);
    await sleep(400);
    await cdp.capture(path.join(OUTPUT_DIR, '08_mobile_stats_modal_light.png'));

    // 7. Close Stats and Open Allergens Modal on a dish
    await cdp.eval(`
      document.querySelector('[data-action="close-stats-modal"]')?.click();
      setTimeout(() => {
        const allergenBtn = document.querySelector('[data-action="show-allergens"]');
        if (allergenBtn) allergenBtn.click();
      }, 300);
    `);
    await sleep(700);
    await cdp.capture(path.join(OUTPUT_DIR, '09_mobile_allergens_modal_light.png'));

    // 8. Close Allergens and Open Settings Modal (Light Mode)
    await cdp.eval(`
      document.querySelector('[data-action="close-allergens-modal"]')?.click();
      setTimeout(() => {
        document.getElementById('menu-btn')?.click();
        setTimeout(() => {
          document.querySelector('[data-action="menu-open-settings"]')?.click();
        }, 300);
      }, 300);
    `);
    await sleep(800);
    await cdp.capture(path.join(OUTPUT_DIR, '10_mobile_settings_modal_light.png'));

    cdp.close();
    console.log('All 10 mobile screenshots captured successfully!');
  } finally {
    try {
      chromeProc.kill();
    } catch {
      // ignore
    }
    // Clean up temporary test file if present
    const testFile = path.join(OUTPUT_DIR, 'test.png');
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  }
}

main().catch(err => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
