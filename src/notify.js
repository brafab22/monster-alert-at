import axios from 'axios';
import { wasAlreadyNotified, markNotified } from './db.js';

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
