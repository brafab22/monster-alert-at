import axios from 'axios';
import { wasAlreadyNotified, markNotified } from './db.js';
import { isoWeekKey } from './utils.js';

const NTFY_BASE = 'https://ntfy.sh';

export async function sendDealNotification(deal, dryRun = false) {
  const { store, product, variant, packSize, priceEur, perUnit, url } = deal;

  const packLabel = packSize > 1 ? `${packSize}-pack` : 'single';
  const variantLabel = variant ? ` ${variant}` : '';
  const title = '🟢 Monster Deal in Austria!';
  const body = `€${priceEur.toFixed(2)} at ${store} — €${perUnit.toFixed(2)}/can (${packLabel})${variantLabel}`;

  const dealKey = `${store}|${product}|${variant}|${packSize}|${priceEur.toFixed(2)}`;

  if (wasAlreadyNotified(dealKey)) {
    return;
  }

  if (dryRun) {
    console.log(`[DRY-RUN] Would notify: ${title} | ${body} | ${url}`);
    return;
  }

  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.error('[notify] NTFY_TOPIC not set in .env');
    return;
  }

  try {
    await axios.post(`${NTFY_BASE}/${topic}`, body, {
      headers: {
        Title: title,
        Priority: 'default',
        Tags: 'green_circle,shopping',
        Click: url,
        'Content-Type': 'text/plain',
      },
    });
    markNotified(dealKey);
    console.log(`[notify] Sent: ${body}`);
  } catch (err) {
    console.error(`[notify] Failed to send notification: ${err.message}`);
  }
}

// For stores that only publish a weekly/monthly flyer with no machine-readable
// per-product price (ADEG, Nah&Frisch) — alerts that Monster was *mentioned*,
// without an exact per-can price. Deduped once per store per ISO week.
export async function sendFlyerAlert(mention, dryRun = false) {
  const { store, note, url } = mention;
  const dealKey = `flyer|${store}|${isoWeekKey()}`;

  if (wasAlreadyNotified(dealKey)) {
    return;
  }

  const title = '🟡 Monster evtl. im Angebot';
  const body = `${note} (${store})`;

  if (dryRun) {
    console.log(`[DRY-RUN] Would notify: ${title} | ${body} | ${url}`);
    return;
  }

  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.error('[notify] NTFY_TOPIC not set in .env');
    return;
  }

  try {
    await axios.post(`${NTFY_BASE}/${topic}`, body, {
      headers: {
        Title: title,
        Priority: 'low',
        Tags: 'yellow_circle,shopping',
        Click: url,
        'Content-Type': 'text/plain',
      },
    });
    markNotified(dealKey);
    console.log(`[notify] Sent flyer alert: ${body}`);
  } catch (err) {
    console.error(`[notify] Failed to send flyer alert: ${err.message}`);
  }
}

function formatPriceList(prices) {
  const byStore = new Map();
  for (const p of prices) {
    if (!byStore.has(p.store)) byStore.set(p.store, []);
    byStore.get(p.store).push(p);
  }

  const lines = [];
  for (const [store, items] of byStore) {
    lines.push(store);
    for (const p of items) {
      const packLabel = p.packSize > 1 ? `${p.packSize}-pack` : 'single';
      const variantLabel = p.variant ? ` ${p.variant}` : '';
      lines.push(`  ${variantLabel.trim()} (${packLabel}): €${p.priceEur.toFixed(2)} — €${p.perUnit.toFixed(2)}/Dose`);
    }
  }
  return lines.join('\n');
}

// Daily digest of the latest known price per store/variant/pack, regardless
// of whether it's currently a "deal". Sent once a day (see CHECK_INTERVAL
// separate cron in index.js), not deduped since it's expected daily.
export async function sendDailySummary(prices, dryRun = false) {
  const title = '📋 Monster-Preise heute';

  if (prices.length === 0) {
    console.log('[notify] No recent prices to summarize — skipping daily summary');
    return;
  }

  const body = formatPriceList(prices);

  if (dryRun) {
    console.log(`[DRY-RUN] Would send daily summary:\n${title}\n${body}`);
    return;
  }

  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.error('[notify] NTFY_TOPIC not set in .env');
    return;
  }

  try {
    await axios.post(`${NTFY_BASE}/${topic}`, body, {
      headers: {
        Title: title,
        Priority: 'default',
        Tags: 'clipboard',
        'Content-Type': 'text/plain',
      },
    });
    console.log(`[notify] Sent daily summary (${prices.length} price(s))`);
  } catch (err) {
    console.error(`[notify] Failed to send daily summary: ${err.message}`);
  }
}
