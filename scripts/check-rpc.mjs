/**
 * RPC Health Check Script
 * Validates that Supabase credentials work and RPC returns a valid menu payload schema.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getFetchDateRange } from '../src/lib/dates.js';
import { validateWeekMenu } from '../src/lib/validation.js';

async function main() {
  const configPath = resolve(process.cwd(), 'data/config.js');
  const configContent = readFileSync(configPath, 'utf8');

  const urlMatch = configContent.match(/url:\s*["']([^"']+)["']/);
  const keyMatch = configContent.match(/apiKey:\s*["']([^"']+)["']/);
  const orgMatch = configContent.match(/orgId:\s*["']([^"']+)["']/);

  if (!urlMatch || !keyMatch || !orgMatch) {
    console.error('Failed to parse SUPABASE_CONFIG from data/config.js');
    process.exit(1);
  }

  const url = urlMatch[1];
  const apiKey = keyMatch[1];
  const orgId = orgMatch[1];

  const { startDate, endDate } = getFetchDateRange();
  console.log(`Checking RPC ${url}/rest/v1/rpc/public_get_week_menu for range ${startDate} to ${endDate}...`);

  const rpcUrl = `${url}/rest/v1/rpc/public_get_week_menu`;
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_organization_id: orgId,
      p_start_date: startDate,
      p_end_date: endDate
    })
  });

  if (!response.ok) {
    console.error(`RPC request failed with HTTP ${response.status}: ${response.statusText}`);
    process.exit(1);
  }

  const data = await response.json();
  const validation = validateWeekMenu(data);

  if (!validation.valid) {
    console.error(`RPC response failed schema validation: ${validation.error}`);
    process.exit(1);
  }

  console.log(`✅ RPC Health Check PASSED: Valid menu payload with ${data.length} days returned.`);
}

main().catch(err => {
  console.error('RPC Health Check error:', err);
  process.exit(1);
});
