# monster-alert-at

Monitors Monster Energy prices across Austrian supermarkets (BILLA, SPAR, Hofer, Penny, Lidl) and pushes a notification to your phone when a deal is detected.

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description | Default |
|---|---|---|
| `NTFY_TOPIC` | Your unique ntfy.sh topic (keep it secret) | — |
| `PRICE_THRESHOLD_EUR` | Alert when price/can drops below this | `1.49` |
| `CHECK_INTERVAL_HOURS` | How often to check (hours) | `2` |

> **Tip:** pick a hard-to-guess topic name like `monster-alert-austria-xk9q2p`.

### 3. Set up ntfy on your phone

1. Install **ntfy** from the App Store or Google Play.
2. Open the app → tap **+** → enter your topic name (same as `NTFY_TOPIC` in `.env`).
3. Done — you'll receive a push whenever a deal is found.

---

## Running

### Run once (manual check)

```bash
node src/index.js --check-now
```

### Dry run (print deals, don't notify)

```bash
node src/index.js --dry-run --check-now
```

### Run as a background daemon (cron every N hours)

```bash
node src/index.js
```

---

## Running as a background service with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the app
pm2 start src/index.js --name monster-alert

# Auto-start on reboot
pm2 save
pm2 startup

# Logs
pm2 logs monster-alert

# Stop
pm2 stop monster-alert
```

---

## Running in Docker

```bash
# Build
docker build -t monster-alert-at .

# Run (mounts a local ./data directory for the SQLite database)
docker run -d \
  --name monster-alert \
  --restart unless-stopped \
  -v "$(pwd)/data:/app/data" \
  --env-file .env \
  monster-alert-at
```

### Docker Compose (optional)

```yaml
services:
  monster-alert:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data
```

```bash
docker compose up -d
```

---

## How it works

1. Every N hours (default: 2) the cron job fires all scrapers.
2. Each scraper fetches Monster Energy products from its store.
3. Prices are saved to `prices.db` (SQLite).
4. The analyzer checks:
   - Is the per-can price ≤ `PRICE_THRESHOLD_EUR`?
   - Is the per-can price >10% below the 7-day rolling average?
5. A deal triggers a push notification via ntfy.sh with the store name, price, and a direct buy link.
6. Each unique deal is only notified once (suppressed for 3 days).

---

## Supported stores

| Store | Method |
|---|---|
| BILLA | JSON API |
| SPAR | JSON API |
| Hofer | HTML scrape (cheerio) |
| Penny | HTML scrape (cheerio) |
| Lidl | JSON API |

---

## Troubleshooting

- **No products found for a store** — The store may have changed its website structure. Check the scraper file and update the selectors/API path.
- **Notifications not arriving** — Make sure `NTFY_TOPIC` in `.env` exactly matches the topic you subscribed to in the ntfy app.
- **"NTFY_TOPIC not set"** — Copy `.env.example` to `.env` and fill in the topic.
