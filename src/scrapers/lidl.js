/**
 * Lidl Austria scraper — uses Playwright to render the search results page.
 * The Lidl search API requires a session token only available after JS execution,
 * so we let Playwright load the page and extract product cards from the DOM.
 */
import { chromium } from 'playwright';
import { sleep, parsePrice, detectVariant, detectPackSize, calcPerUnit } from '../utils.js';

const STORE = 'Lidl';
const SEARCH_URL = 'https://www.lidl.at/q/search?query=monster+energy';
const BASE = 'https://www.lidl.at';

export async function scrape() {
  const products = [];
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'de-AT,de;q=0.9' });

    await page.goto(SEARCH_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Accept cookie consent if it appears
    try {
      await page.click('[id*="onetrust-accept"], [class*="accept-all"], [data-testid*="accept"]', { timeout: 3000 });
      await sleep(1000);
    } catch { /* no cookie banner */ }

    // Wait for product grid to appear
    await page.waitForSelector(
      'article[data-product-id], [class*="product-tile"], [class*="AArticleTile"], .s-grid__item a[href*="/p/"]',
      { timeout: 15000 }
    ).catch(() => {});

    // Extract product data from the rendered DOM
    const items = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll(
        'article[data-product-id], [class*="s-article-tile"], [class*="AArticleTile"]'
      );
      cards.forEach(card => {
        const name = card.querySelector('[class*="title"], [class*="Title"], h2, h3')?.textContent?.trim() ?? '';
        if (!name.toLowerCase().includes('monster')) return;

        const priceEl = card.querySelector('[class*="m-price__top"], [class*="price"], [data-price]');
        const priceText = priceEl?.textContent?.trim() ?? '';
        const link = card.querySelector('a[href]')?.getAttribute('href') ?? '';
        results.push({ name, priceText, link });
      });
      return results;
    });

    for (const item of items) {
      const priceEur = parsePrice(item.priceText);
      if (!priceEur) continue;
      const variant = detectVariant(item.name);
      const packSize = detectPackSize(item.name);
      const perUnit = calcPerUnit(priceEur, packSize);
      const url = item.link.startsWith('http') ? item.link : `${BASE}${item.link}`;
      products.push({ store: STORE, product: 'Monster Energy', variant, packSize, priceEur, perUnit, url });
    }
  } catch (err) {
    console.error(`[${STORE}] Scrape error: ${err.message}`);
  } finally {
    await browser?.close();
  }

  console.log(`[${STORE}] Found ${products.length} products`);
  return products;
}
