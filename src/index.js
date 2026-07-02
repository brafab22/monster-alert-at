import 'dotenv/config';
import cron from 'node-cron';
import { pruneOldNotifications, getLatestPrices } from './db.js';
import { analyzeProducts, checkFlyerMentions } from './analyzer.js';
import { sendDailySummary } from './notify.js';
import { scrape as scrapeBilla } from './scrapers/billa.js';
import { scrape as scrapeSpar } from './scrapers/spar.js';
import { scrape as scrapeHofer } from './scrapers/hofer.js';
import { scrape as scrapePenny } from './scrapers/penny.js';
import { scrape as scrapeLidl } from './scrapers/lidl.js';
import { scrape as scrapeAdeg } from './scrapers/adeg.js';
import { scrape as scrapeNahUndFrisch } from './scrapers/nahundfrisch.js';
import { scrape as scrapeMarktguru } from './scrapers/marktguru.js';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CHECK_NOW = args.includes('--check-now');
const SUMMARY_NOW = args.includes('--summary-now');

async function runCheck() {
  console.log(`\n[${new Date().toISOString()}] Starting price check…`);
  pruneOldNotifications();

  const scrapers = [
    { name: 'BILLA',       type: 'price', fn: scrapeBilla },
    { name: 'SPAR',        type: 'price', fn: scrapeSpar },
    { name: 'Hofer',       type: 'price', fn: scrapeHofer },
    { name: 'Penny',       type: 'price', fn: scrapePenny },
    { name: 'Lidl',        type: 'price', fn: scrapeLidl },
    // ADEG and Nah&Frisch are franchise networks with no per-product online
    // price data — they only get a best-effort "flyer mention" check (see
    // src/scrapers/adeg.js and nahundfrisch.js for details).
    { name: 'ADEG',        type: 'flyer', fn: scrapeAdeg },
    { name: 'Nah&Frisch',  type: 'flyer', fn: scrapeNahUndFrisch },
    // marktguru aggregates the in-store flyer promos of all Austrian chains.
    // The shop APIs above do NOT include in-store promos (e.g. BILLA
    // "2+2 gratis", SPAR -34%), so this is what actually catches them.
    { name: 'marktguru',   type: 'price', fn: scrapeMarktguru },
  ];

  let totalDeals = 0;

  for (const { name, type, fn } of scrapers) {
    console.log(`[check] Scraping ${name}…`);
    try {
      if (type === 'flyer') {
        const mentions = await fn();
        totalDeals += await checkFlyerMentions(mentions, DRY_RUN);
      } else {
        const products = await fn();
        totalDeals += await analyzeProducts(products, DRY_RUN);
      }
    } catch (err) {
      console.error(`[check] ${name} failed: ${err.message}`);
    }
  }

  console.log(`[${new Date().toISOString()}] Done. ${totalDeals} deal(s) found.`);
}

async function runDailySummary() {
  console.log(`\n[${new Date().toISOString()}] Sending daily price summary…`);
  const prices = getLatestPrices();
  await sendDailySummary(prices, DRY_RUN);
}

if (DRY_RUN) {
  console.log('[mode] DRY RUN — notifications will be printed, not sent');
}

if (CHECK_NOW) {
  await runCheck();
  if (!process.argv.includes('--daemon')) process.exit(0);
}

if (SUMMARY_NOW) {
  await runDailySummary();
  if (!process.argv.includes('--daemon')) process.exit(0);
}

const hours = parseInt(process.env.CHECK_INTERVAL_HOURS ?? '2', 10);
const cronExpr = `0 */${hours} * * *`;

console.log(`[cron] Scheduling checks every ${hours} hour(s) (${cronExpr})`);
cron.schedule(cronExpr, runCheck);

const summaryHour = parseInt(process.env.DAILY_SUMMARY_HOUR ?? '9', 10);
const summaryCronExpr = `0 ${summaryHour} * * *`;

console.log(`[cron] Scheduling daily price summary at ${summaryHour}:00 (${summaryCronExpr})`);
cron.schedule(summaryCronExpr, runDailySummary);

// Keep the process alive (PM2 / Docker will manage it)
console.log('[ready] Monster Alert is running. Press Ctrl+C to stop.');
