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
