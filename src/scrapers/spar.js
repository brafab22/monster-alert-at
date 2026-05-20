/**
 * SPAR Austria scraper
 * API: https://search-spar.spar-ics.com/fact-finder/rest/v4/search/products_lmos_at
 * Response: data.hits (array) → each hit.masterValues
 * Relevant fields: .name (detailed), .title (brand), .price (EUR), .url (relative)
 */
import axios from 'axios';
import { sleep, parsePrice, detectVariant, detectPackSize, calcPerUnit } from '../utils.js';

const STORE = 'SPAR';
const SEARCH_URL =
  'https://search-spar.spar-ics.com/fact-finder/rest/v4/search/products_lmos_at' +
  '?query=monster+energy&page=1&hitsPerPage=50';
const BASE_URL = 'https://www.interspar.at';

export async function scrape() {
  const products = [];

  try {
    const { data } = await axios.get(SEARCH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json',
        'Accept-Language': 'de-AT,de;q=0.9',
        Referer: 'https://www.interspar.at/',
        'sec-fetch-mode': 'cors',
      },
      timeout: 15000,
    });

    // data.hits is the array directly (not data.hits.hits)
    const hits = Array.isArray(data.hits)
      ? data.hits
      : Object.values(data.hits ?? {});

    for (const hit of hits) {
      const mv = hit.masterValues ?? hit;
      // "name" is the detailed product name (e.g. "Monster Ultra Parad.zero 0,5l GVE 24")
      // "title" is the brand ("Monster Energy")
      const name = mv.name ?? mv.title ?? '';
      if (!name.toLowerCase().includes('monster')) continue;

      const priceEur = parsePrice(mv.price ?? mv['regular-price']);
      if (!priceEur) continue;

      const variant = detectVariant(name);
      const packSize = detectPackSize(name);
      const perUnit = calcPerUnit(priceEur, packSize);
      const relUrl = mv.url ?? '';
      const url = relUrl.startsWith('http') ? relUrl : `${BASE_URL}${relUrl}`;

      products.push({ store: STORE, product: 'Monster Energy', variant, packSize, priceEur, perUnit, url });
      await sleep(300 + Math.random() * 700);
    }
  } catch (err) {
    console.error(`[${STORE}] Scrape error: ${err.message}`);
  }

  console.log(`[${STORE}] Found ${products.length} products`);
  return products;
}
