const fs = require('fs');
const path = require('path');

function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, ' ') // Strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

async function run() {
  const url = "https://www.kstw.de/";
  const outputPath = path.join(__dirname, '../data/announcements.json');
  
  console.log("Fetching KStW homepage for announcements...");
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch homepage: ${response.status}`);
    }

    const html = await response.text();
    const announceRegex = /<div class="tx-epwerkannouncement-message">([\s\S]*?)<\/div>/gi;
    const topicRegex = /<span class="tx-epwerkannouncement-topic">([\s\S]*?)<\/span>/i;

    const announcements = [];
    let match;

    while ((match = announceRegex.exec(html)) !== null) {
      const innerHtml = match[1];
      
      // Extract topic if exists
      let topic = "";
      const topicMatch = innerHtml.match(topicRegex);
      if (topicMatch) {
        topic = cleanText(topicMatch[1]);
      }
      
      // Content is the rest of the inner HTML
      const contentHtml = innerHtml.replace(topicRegex, '');
      const content = cleanText(contentHtml);
      
      announcements.push({
        topic,
        content,
        rawText: cleanText(innerHtml),
        dateFetched: new Date().toISOString()
      });
    }

    console.log(`Parsed ${announcements.length} announcement(s).`);
    
    // Ensure data directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(announcements, null, 2));
    console.log("Successfully wrote data/announcements.json.");
    console.log(JSON.stringify(announcements, null, 2));

  } catch (err) {
    console.error("Scraper Error:", err);
    process.exit(1);
  }
}

run();
