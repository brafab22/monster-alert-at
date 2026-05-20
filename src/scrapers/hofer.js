/**
 * Hofer Austria scraper
 * Hofer is a weekly-deals discounter (ALDI group). Their website shows rotating promotions.
 * We scrape the current and next week's deals pages for Monster Energy products.
 * If Monster is on promotion, it will appear here; otherwise nothing is returned.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { sleep, parsePrice, detectVariant, detectPackSize, calcPerUnit } from '../utils.js';

const STORE = 'Hofer';
const BASE = 'https://www.hofer.at';

function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Build URLs for today and the next 7 days (Hofer posts deals by date)
function dealsUrls() {
  const dates = new Set();
  const today = new Date();
  for (let i = 0; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.add(formatDate(d));
  }
  return [...dates].map(date => `${BASE}/de/angebote/d.${date}.html`);
}

async function scrapePage(url) {
  const products = [];
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'de-AT,de;q=0.9',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(html);

  // Hofer AEM page — product tiles are in <article> or divs with offer/product classes
  const cardSel = [
    'article[class*="offer"]',
    'article[class*="product"]',
    '.offer-tile',
    '.product-tile',
    '[data-component*="product"]',
    '[data-component*="offer"]',
    '.mod-article-tile',
  ].join(', ');

  $(cardSel).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text.toLowerCase().includes('monster')) return;

    const name = $(el).find('h2, h3, h4, [class*="title"], [class*="name"]').first().text().trim() || text.slice(0, 60);
    const priceText = $(el).find('[class*="price"], [itemprop="price"]').first().text().trim()
      || text.match(/\d+[.,]\d{2}\s*€/)?.[0] || '';
    const priceEur = parsePrice(priceText);
    if (!priceEur) return;

    const href = $(el).find('a[href]').first().attr('href') ?? '';
    const productUrl = href.startsWith('http') ? href : `${BASE}${href}`;
    const variant = detectVariant(name);
    const packSize = detectPackSize(name);
    const perUnit = calcPerUnit(priceEur, packSize);
    products.push({ store: STORE, product: 'Monster Energy', variant, packSize, priceEur, perUnit, url: productUrl || url });
  });

  return products;
}

export async function scrape() {
  const allProducts = [];
  const seen = new Set();

  for (const url of dealsUrls()) {
    try {
      const products = await scrapePage(url);
      for (const p of products) {
        const key = `${p.priceEur}|${p.variant}`;
        if (!seen.has(key)) {
          seen.add(key);
          allProducts.push(p);
        }
      }
      await sleep(1000 + Math.random() * 1500);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error(`[${STORE}] Error on ${url}: ${err.message}`);
      }
    }
  }

  console.log(`[${STORE}] Found ${allProducts.length} products`);
  return allProducts;
}
