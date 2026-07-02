/**
 * marktguru.at scraper — aggregated flyer offers across ALL Austrian retailers.
 *
 * Why this exists: the chains' own shop APIs (shop.billa.at, spar-ics.com)
 * only reflect ONLINE-shop prices. In-store flyer promotions — like
 * "2+2 gratis" (€0.84/can) at BILLA or -34% (€1.12) at SPAR — are NOT
 * exposed there at all (verified 2026-07: both APIs reported €1.69 /
 * inPromotion:false while those promos were running). marktguru.at
 * aggregates the printed/app flyer offers of Billa, Billa Plus, Spar,
 * Eurospar, Interspar, Hofer, Penny, Lidl, ADEG, MPREIS, Metro and more,
 * so this scraper is what actually catches in-store deals.
 *
 * Store names are suffixed with "(Aktion)" so these flyer prices don't mix
 * into the rolling averages of the online-shop scrapers for the same chain.
 */
import { chromium } from 'playwright';
import { parsePrice, detectPackSize, calcPerUnit } from '../utils.js';

const STORE_SUFFIX = ' (Aktion)';
const BRAND_URL = 'https://www.marktguru.at/b/monster-energy';

export async function scrape() {
  const products = [];
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'de-AT,de;q=0.9' });
    await page.goto(BRAND_URL, { waitUntil: 'networkidle', timeout: 45000 });

    try {
      await page.click('#onetrust-accept-btn-handler, [id*="accept"]', { timeout: 4000 });
      await page.waitForTimeout(1500);
    } catch { /* no cookie banner */ }

    const offers = await page.evaluate(() => {
      const results = [];
      // Active offers only — expired cards carry the "expired" class
      const cards = document.querySelectorAll('li.offer-list-item:not(.expired)');
      for (const card of cards) {
        const lines = (card.innerText ?? '').split('\n').map(l => l.trim()).filter(Boolean);
        results.push(lines);
      }
      return results;
    });

    for (const lines of offers) {
      // Expected line layout (labels and values are separate lines):
      //   [-34%] [Brandneu] Energy Drink / Marke: / Monster Energy /
      //   Preis: / € 1,12 / [€ 1,69] / ...Gültig:01.07. - 15.07. /
      //   Händler: / SPAR / € 2,24 / l - versch. Sorten, 0,5 Liter
      const brandIdx = lines.indexOf('Marke:');
      const brand = brandIdx >= 0 ? lines[brandIdx + 1] ?? '' : '';
      if (!brand.toLowerCase().includes('monster')) continue;

      const priceIdx = lines.indexOf('Preis:');
      const priceEur = priceIdx >= 0 ? parsePrice(lines[priceIdx + 1]) : null;
      if (!priceEur) continue;

      const retailerIdx = lines.indexOf('Händler:');
      const retailer = retailerIdx >= 0 ? lines[retailerIdx + 1] ?? '' : '';
      if (!retailer) continue;

      const validity = lines.find(l => /Gültig:/.test(l))?.match(/Gültig:\s*(.+)/)?.[1] ?? '';
      const description = lines[lines.length - 1] ?? '';

      // Flyer prices are per can; multi-can descriptions (e.g. Metro trays)
      // still list the per-can price, so packSize stays 1 unless explicit.
      const packSize = detectPackSize(description);
      const perUnit = calcPerUnit(priceEur, packSize);

      products.push({
        store: `${retailer}${STORE_SUFFIX}`,
        product: 'Monster Energy',
        variant: validity ? `Flugblatt ${validity}` : 'Flugblatt',
        packSize,
        priceEur,
        perUnit,
        url: BRAND_URL,
      });
    }
  } catch (err) {
    console.error(`[marktguru] Scrape error: ${err.message}`);
  } finally {
    await browser?.close();
  }

  console.log(`[marktguru] Found ${products.length} flyer offer(s)`);
  return products;
}
