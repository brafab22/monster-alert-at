/**
 * BILLA scraper
 * API: https://shop.billa.at/api/product-discovery/products?brand=monster&pageSize=50
 * Price is in cents (divide by 100). Slug builds the product URL.
 */
import axios from 'axios';
import { sleep, parsePrice, detectVariant, detectPackSize, calcPerUnit } from '../utils.js';

const STORE = 'BILLA';
const BASE = 'https://shop.billa.at';
const API_URL = `${BASE}/api/product-discovery/products?brand=monster&pageSize=50`;

export async function scrape() {
  const products = [];

  try {
    const { data } = await axios.get(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'de-AT,de;q=0.9',
        Referer: 'https://shop.billa.at/',
      },
      timeout: 15000,
    });

    for (const item of data?.results ?? []) {
      const name = item.name ?? '';
      if (!name.toLowerCase().includes('monster')) continue;

      // Price is in cents
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
