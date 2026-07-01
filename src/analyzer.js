import { getRollingAverage, insertPrice } from './db.js';
import { sendDealNotification, sendFlyerAlert } from './notify.js';

const THRESHOLD = () => parseFloat(process.env.PRICE_THRESHOLD_EUR ?? '1.49');

export async function analyzeProducts(products, dryRun = false) {
  let dealsFound = 0;

  for (const p of products) {
    // Persist this price snapshot
    insertPrice(p);

    const { store, product, variant, packSize, perUnit, priceEur, url } = p;

    const threshold = THRESHOLD();
    const avg = getRollingAverage(store, product, variant, packSize);

    const belowThreshold = perUnit <= threshold;
    const belowAvg = avg !== null && perUnit < avg * 0.9;

    if (belowThreshold || belowAvg) {
      const reason = belowThreshold
        ? `€${perUnit.toFixed(2)}/can ≤ threshold €${threshold}`
        : `€${perUnit.toFixed(2)}/can is >10% below 7d avg €${avg.toFixed(2)}`;

      console.log(`[deal] ${store} — ${product} ${variant} ${packSize}-pack: ${reason}`);
      await sendDealNotification(p, dryRun);
      dealsFound++;
    }
  }

  return dealsFound;
}

// For flyer-only stores (ADEG, Nah&Frisch): no priceEur is available, so we
// just alert on a "Monster mentioned" flyer match instead of a price deal.
export async function checkFlyerMentions(mentions, dryRun = false) {
  let count = 0;

  for (const m of mentions) {
    console.log(`[flyer] ${m.store} — ${m.note}`);
    await sendFlyerAlert(m, dryRun);
    count++;
  }

  return count;
}
