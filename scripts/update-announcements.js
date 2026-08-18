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
    // Load existing announcements for content comparison
    let existingAnnouncements = [];
    if (fs.existsSync(outputPath)) {
      try {
        existingAnnouncements = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      } catch (e) {
        existingAnnouncements = [];
      }
    }

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
      
      // Check if this announcement already exists
      const existing = existingAnnouncements.find(a => a.topic === topic && a.content === content);
      const now = Date.now();
      const existingDate = existing && existing.dateFetched ? new Date(existing.dateFetched).getTime() : 0;
      // Preserve timestamp if under 12 hours old to prevent commit spam
      const dateFetched = (existing && (now - existingDate < 12 * 60 * 60 * 1000))
        ? existing.dateFetched
        : new Date().toISOString();

      announcements.push({
        topic,
        content,
        rawText: cleanText(innerHtml),
        dateFetched
      });
    }

    console.log(`Parsed ${announcements.length} announcement(s).`);
    
    // Ensure data directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }

    // Compare content ignoring small timestamp drifts
    const isSameContent = (
      announcements.length === existingAnnouncements.length &&
      announcements.every((a, idx) => {
        const b = existingAnnouncements[idx];
        return b && a.topic === b.topic && a.content === b.content;
      })
    );

    if (!isSameContent) {
      fs.writeFileSync(outputPath, JSON.stringify(announcements, null, 2) + "\n");
      console.log("Successfully updated data/announcements.json.");
    } else {
      console.log("Announcements unchanged, skipping file write to prevent git noise.");
    }
    console.log(JSON.stringify(announcements, null, 2));

  } catch (err) {
    console.warn("Warning: Announcements scraper failed (non-fatal):", err.message || err);
    // If output file does not exist at all, write empty array so app can function
    if (!fs.existsSync(outputPath)) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, "[]\n");
    }
    // Exit with 0 so the GitHub Actions pipeline does not fail
    process.exit(0);
  }
}

run();
