/**
 * ADEG Austria — best-effort flyer scan.
 *
 * ADEG is a franchise network: adeg.at has no national online shop or price
 * feed, and its "ADEG Flugblatt" page requires picking a specific local
 * market before it shows anything — each market's flyer is then a pure
 * image viewer (no product text), served by a third-party widget.
 *
 * There is no way to check "ADEG in Austria" as a whole. To use this
 * scraper, pick your local market on https://www.adeg.at/flugblatt-aktionen/adeg-flugblatt,
 * copy the resulting flyer-viewer URL and set it as ADEG_MARKT_URL in .env.
 * Without that env var this scraper is a documented no-op.
 *
 * Playwright is used (rather than a plain HTTP request) because the flyer
 * widget is rendered client-side. We scan both the visible page text and
 * image alt attributes for "Monster" — some flyer widgets label images with
 * the product name, but this is not guaranteed, so absence of a match here
 * doesn't reliably mean Monster isn't in the flyer.
 */
import { chromium } from 'playwright';

const STORE = 'ADEG';

export async function scrape() {
  const mentions = [];
  const marktUrl = process.env.ADEG_MARKT_URL;

  if (!marktUrl) {
    console.log(`[${STORE}] ADEG_MARKT_URL not set — ADEG has no national flyer, skipping (see README)`);
    return mentions;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'de-AT,de;q=0.9' });
    await page.goto(marktUrl, { waitUntil: 'networkidle', timeout: 30000 });

    try {
      await page.click('[id*="accept"], [class*="accept-all"], [data-testid*="accept"]', { timeout: 3000 });
    } catch { /* no cookie banner */ }

    const hasMonster = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const altText = [...document.querySelectorAll('img[alt]')].map(img => img.alt).join(' ');
      return /monster/i.test(bodyText) || /monster/i.test(altText);
    });

    if (hasMonster) {
      mentions.push({
        store: STORE,
        note: 'Monster Energy möglicherweise im ADEG-Flugblatt (kein exakter Preis verfügbar)',
        url: marktUrl,
      });
    }
  } catch (err) {
    console.error(`[${STORE}] Scrape error: ${err.message}`);
  } finally {
    await browser?.close();
  }

  console.log(`[${STORE}] ${mentions.length} flyer mention(s) found`);
  return mentions;
}
