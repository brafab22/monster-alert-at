export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function parsePrice(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw > 0 ? raw : null;
  const cleaned = String(raw)
    .replace(/[^\d.,]/g, '')
    .replace(',', '.');
  const val = parseFloat(cleaned);
  return isFinite(val) && val > 0 ? val : null;
}

const VARIANT_MAP = [
  [/ultra\s*white/i, 'Ultra White'],
  [/ultra\s*rosa/i, 'Ultra Rosa'],
  [/ultra\s*gold/i, 'Ultra Gold'],
  [/ultra\s*fiesta/i, 'Ultra Fiesta'],
  [/ultra\s*paradise/i, 'Ultra Paradise'],
  [/ultra\s*sunrise/i, 'Ultra Sunrise'],
  [/ultra\s*blue/i, 'Ultra Blue'],
  [/ultra\s*red/i, 'Ultra Red'],
  [/\bultra\b/i, 'Ultra'],
  [/juiced\s*aussie\s*lemonade/i, 'Juiced Aussie Lemonade'],
  [/juiced\s*khaotic/i, 'Juiced Khaotic'],
  [/juiced\s*mango\s*loco/i, 'Juiced Mango Loco'],
  [/\bjuiced\b/i, 'Juiced'],
  [/pipeline\s*punch/i, 'Pipeline Punch'],
  [/pacific\s*punch/i, 'Pacific Punch'],
  [/rio\s*punch/i, 'Rio Punch'],
  [/lewis\s*hamilton/i, 'Lewis Hamilton'],
  [/\bzeroh?\b|zero\s*sugar/i, 'Zero'],
  [/java\s*monster/i, 'Java'],
  [/lo-carb|low\s*carb/i, 'Lo-Carb'],
  [/original|green/i, 'Original'],
];

export function detectVariant(name) {
  for (const [re, label] of VARIANT_MAP) {
    if (re.test(name)) return label;
  }
  return 'Original';
}

export function detectPackSize(name) {
  const m = name.match(/(\d+)\s*[xX×]\s*\d+\s*ml/i)
    ?? name.match(/(\d+)[- ]?(?:pack|stück|st\.?)\b/i)
    ?? name.match(/(\d+)\s*[xX×]\s*(?:dose|can)/i);
  if (m) return parseInt(m[1], 10);
  return 1;
}

export function calcPerUnit(priceEur, packSize) {
  return packSize > 0 ? priceEur / packSize : priceEur;
}

// ISO 8601 week key (e.g. "2026-W27"), used to dedupe flyer alerts per week
export function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
