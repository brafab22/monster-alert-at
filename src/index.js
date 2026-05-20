import 'dotenv/config';
import cron from 'node-cron';
import { pruneOldNotifications } from './db.js';
import { analyzeProducts } from './analyzer.js';
import { scrape as scrapeBilla } from './scrapers/billa.js';
import { scrape as scrapeSpar } from './scrapers/spar.js';
import { scrape as scrapeHofer } from './scrapers/hofer.js';
import { scrape as scrapePenny } from './scrapers/penny.js';
import { scrape as scrapeLidl } from './scrapers/lidl.js';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CHECK_NOW = args.includes('--check-now');

async function runCheck() {
  console.log(`\n[${new Date().toISOString()}] Starting price check…`);
  pruneOldNotifications();

  const scrapers = [
    { name: 'BILLA', fn: scrapeBilla },
    { name: 'SPAR',  fn: scrapeSpar },
    { name: 'Hofer', fn: scrapeHofer },
    { name: 'Penny', fn: scrapePenny },
    { name: 'Lidl',  fn: scrapeLidl },
  ];

  let totalDeals = 0;

  for (const { name, fn } of scrapers) {
    console.log(`[check] Scraping ${name}…`);
    try {
      const products = await fn();
      const deals = await analyzeProducts(products, DRY_RUN);
      totalDeals += deals;
    } catch (err) {
      console.error(`[check] ${name} failed: ${err.message}`);
    }
  }

  console.log(`[${new Date().toISOString()}] Done. ${totalDeals} deal(s) found.`);
}

if (DRY_RUN) {
  console.log('[mode] DRY RUN — notifications will be printed, not sent');
}

if (CHECK_NOW) {
  await runCheck();
  if (!process.argv.includes('--daemon')) process.exit(0);
}

const hours = parseInt(process.env.CHECK_INTERVAL_HOURS ?? '2', 10);
const cronExpr = `0 */${hours} * * *`;

console.log(`[cron] Scheduling checks every ${hours} hour(s) (${cronExpr})`);
cron.schedule(cronExpr, runCheck);

// Keep the process alive (PM2 / Docker will manage it)
console.log('[ready] Monster Alert is running. Press Ctrl+C to stop.');
