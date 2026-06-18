const fs = require('fs');
const path = require('path');

async function run() {
  const targetUrl = "https://app.cloudmensa.io/menu/kstw";
  console.log("Fetching CloudMensa HTML...");
  
  try {
    const htmlResponse = await fetch(targetUrl);
    if (!htmlResponse.ok) throw new Error("CloudMensa failed to load");
    const html = await htmlResponse.text();

    const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
    let match;
    const scriptUrls = [];
    while ((match = scriptRegex.exec(html)) !== null) {
      scriptUrls.push(match[1]);
    }

    const pattern = /"(https:\/\/[a-zA-Z0-9-]+\.supabase\.co)",\w+="([a-zA-Z0-9\._-]+)"/;
    
    for (const src of scriptUrls) {
      const fullUrl = src.startsWith("http") ? src : `https://app.cloudmensa.io${src}`;
      console.log(`Checking script: ${fullUrl}`);
      
      const jsResponse = await fetch(fullUrl);
      if (!jsResponse.ok) continue;
      const js = await jsResponse.text();
      
      const credentialsMatch = js.match(pattern);
      if (credentialsMatch) {
        const newUrl = credentialsMatch[1];
        const newKey = credentialsMatch[2];
        
        console.log("Credentials found!");
        const configPath = path.join(__dirname, '../data/config.js');
        
        const newConfigContent = `// Diese Datei wird automatisch von der GitHub Action aktualisiert.
const SUPABASE_CONFIG = {
  url: "${newUrl}",
  apiKey: "${newKey}",
  orgId: "4c89c35f-16ac-413f-af04-ec9ffe610f67"
};
`;
        fs.writeFileSync(configPath, newConfigContent);
        console.log("data/config.js successfully updated.");
        return;
      }
    }
    console.log("No credentials found in any scripts.");
  } catch (err) {
    console.error("Scraper Error:", err);
    process.exit(1);
  }
}

run();
