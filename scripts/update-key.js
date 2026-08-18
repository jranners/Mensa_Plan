const fs = require('fs');
const path = require('path');

function extractCredentials(jsCode) {
  // 1. Suche nach Supabase URL
  const urlMatch = jsCode.match(/https:\/\/[a-zA-Z0-9-]+\.supabase\.co/);
  if (!urlMatch) return null;
  const url = urlMatch[0];

  // 2. Suche nach Supabase Key (entweder neues sb_publishable_ Format oder klassisches JWT Format)
  const publishableKeyMatch = jsCode.match(/sb_publishable_[a-zA-Z0-9_-]{20,}/);
  const jwtKeyMatch = jsCode.match(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+/);
  
  const apiKey = publishableKeyMatch ? publishableKeyMatch[0] : (jwtKeyMatch ? jwtKeyMatch[0] : null);
  if (!apiKey) return null;

  // 3. KStW Organization UUID
  const orgMatch = jsCode.match(/4c89c35f-16ac-413f-af04-ec9ffe610f67/i);
  const orgId = orgMatch ? orgMatch[0] : "4c89c35f-16ac-413f-af04-ec9ffe610f67";

  return { url, apiKey, orgId };
}

async function run() {
  const targetUrl = "https://app.cloudmensa.io/menu/kstw";
  console.log("Fetching CloudMensa HTML...");
  
  try {
    const htmlResponse = await fetch(targetUrl, { signal: AbortSignal.timeout(15000) });
    if (!htmlResponse.ok) throw new Error(`CloudMensa failed to load: ${htmlResponse.status}`);
    const html = await htmlResponse.text();

    const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
    let match;
    const scriptUrls = [];
    while ((match = scriptRegex.exec(html)) !== null) {
      scriptUrls.push(match[1]);
    }

    if (scriptUrls.length === 0) {
      throw new Error("No script tags found in CloudMensa HTML.");
    }
    
    for (const src of scriptUrls) {
      const fullUrl = src.startsWith("http") ? src : `https://app.cloudmensa.io${src}`;
      console.log(`Checking script: ${fullUrl}`);
      
      try {
        const jsResponse = await fetch(fullUrl, { signal: AbortSignal.timeout(10000) });
        if (!jsResponse.ok) continue;
        const js = await jsResponse.text();
        
        const creds = extractCredentials(js);
        if (creds) {
          const { url: newUrl, apiKey: newKey, orgId: newOrgId } = creds;
          console.log(`Credentials found! URL: ${newUrl}, Key prefix: ${newKey.substring(0, 15)}...`);
          
          const configPath = path.join(__dirname, '../data/config.js');
          const swPath = path.join(__dirname, '../sw.js');
          
          let currentConfig = "";
          if (fs.existsSync(configPath)) {
            currentConfig = fs.readFileSync(configPath, 'utf8');
          }
          
          if (currentConfig.includes(newKey) && currentConfig.includes(newUrl)) {
            console.log("Supabase credentials in data/config.js are already up-to-date. No write needed.");
            return;
          }

          console.log("New credentials detected! Updating data/config.js...");
          const dir = path.dirname(configPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          const newConfigContent = `// Diese Datei wird automatisch von der GitHub Action aktualisiert.
const SUPABASE_CONFIG = {
  url: "${newUrl}",
  apiKey: "${newKey}",
  orgId: "${newOrgId}"
};
`;
          fs.writeFileSync(configPath, newConfigContent);
          console.log("data/config.js successfully written.");

          // Synchronize Service Worker API_HOST and bump CACHE_NAME if sw.js exists
          if (fs.existsSync(swPath)) {
            let swContent = fs.readFileSync(swPath, 'utf8');
            const newHost = new URL(newUrl).hostname;
            swContent = swContent.replace(/const API_HOST = '[^']+';/, `const API_HOST = '${newHost}';`);
            swContent = swContent.replace(/const CACHE_NAME = 'kstw-mensa-v(\d+)';/, (m, v) => {
              return `const CACHE_NAME = 'kstw-mensa-v${parseInt(v, 10) + 1}';`;
            });
            fs.writeFileSync(swPath, swContent);
            console.log("sw.js cache version and API host synchronized.");
          }

          return;
        }
      } catch (err) {
        console.warn(`Failed to fetch script ${fullUrl}:`, err.message);
      }
    }
    
    console.error("ERROR: No valid Supabase credentials could be extracted from CloudMensa scripts.");
    process.exit(1);
  } catch (err) {
    console.error("Scraper Error:", err.message || err);
    process.exit(1);
  }
}

run();
