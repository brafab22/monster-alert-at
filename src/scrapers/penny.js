/**
 * Penny Austria scraper
 * Uses the same REWE Group product-discovery API as BILLA.
 * Note: As of 2026-05, Penny AT does not stock Monster Energy — returns 0 results
 * unless they start carrying it, in which case this will automatically find them.
 */
import axios from 'axios';
import { sleep, parsePrice, detectVariant, detectPackSize, calcPerUnit } from '../utils.js';

const STORE = 'Penny';
const BASE = 'https://www.penny.at';
const API_URL = `${BASE}/api/product-discovery/products?brand=monster&pageSize=50`;

export async function scrape() {
  const products = [];

  try {
    const { data } = await axios.get(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'de-AT,de;q=0.9',
        Referer: 'https://www.penny.at/',
      },
      timeout: 15000,
    });

    for (const item of data?.results ?? []) {
      const name = item.name ?? '';
      if (!name.toLowerCase().includes('monster')) continue;

      const cents = item.price?.regular?.value;
      const priceEur = cents != null ? cents / 100 : parsePrice(cents);
      if (!priceEur) continue;

      const variant = detectVariant(name);
      const packSize = detectPackSize(name);
      const perUnit = calcPerUnit(priceEur, packSize);
      const slug = item.slug ?? item.sku ?? '';
      const url = `${BASE}/produkt/${slug}`;

      products.push({ store: STORE, product: 'Monster Energy', variant, packSize, priceEur, perUnit, url });
      await sleep(300 + Math.random() * 700);
    }
  } catch (err) {
    console.error(`[${STORE}] Scrape error: ${err.message}`);
  }

  console.log(`[${STORE}] Found ${products.length} products`);
  return products;
}
