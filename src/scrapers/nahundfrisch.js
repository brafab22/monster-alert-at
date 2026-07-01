/**
 * Nah&Frisch Austria — best-effort flyer scan.
 *
 * Nah&Frisch is a franchise network of ~480 independent local merchants with
 * no national online shop and no per-product price feed. The only
 * text-extractable document they publish is the monthly "Dauertiefpreise"
 * (permanent low price) PDF — the weekly "Angebote der Woche" are plain
 * image graphics with no product text at all, so they can't be scraped.
 *
 * This scraper downloads the current Dauertiefpreise PDF and checks whether
 * "Monster" is mentioned anywhere in it. It cannot extract an exact per-can
 * price (the PDF layout doesn't associate prices with product names in a
 * machine-parseable way), so a match only triggers a flyer-mention alert,
 * not a price-deal notification.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
// Import the internal lib directly, not the 'pdf-parse' package entry point:
// that entry point's top-level code checks `!module.parent` to detect "am I
// the main module", which is always true under ESM interop, so it tries to
// self-test against a fixture file that isn't installed and crashes on import.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const STORE = 'Nah&Frisch';
const BASE = 'https://www.nahundfrisch.at';
const OFFERS_PAGE = `${BASE}/de/aktuelles/angebote-der-woche`;

export async function scrape() {
  const mentions = [];

  try {
    const { data: html } = await axios.get(OFFERS_PAGE, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-AT,de;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(html);
    const pdfHref = $('a[href*="/storage/"][href$=".pdf"]').first().attr('href');

    if (!pdfHref) {
      console.log(`[${STORE}] No Dauertiefpreise PDF link found this run — skipping`);
      return mentions;
    }

    const pdfUrl = pdfHref.startsWith('http') ? pdfHref : `${BASE}${pdfHref}`;
    const { data: pdfBuffer } = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
    });

    const { text } = await pdfParse(pdfBuffer);
    if (/monster/i.test(text)) {
      mentions.push({
        store: STORE,
        note: 'Monster Energy im Dauertiefpreis-Flugblatt erwähnt (kein exakter Preis verfügbar)',
        url: pdfUrl,
      });
    }
  } catch (err) {
    console.error(`[${STORE}] Scrape error: ${err.message}`);
  }

  console.log(`[${STORE}] ${mentions.length} flyer mention(s) found`);
  return mentions;
}
