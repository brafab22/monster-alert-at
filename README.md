# monster-alert-at

Monitors Monster Energy prices across Austrian supermarkets (BILLA, SPAR, Hofer, Penny, Lidl, ADEG, Nah&Frisch) and pushes a notification to your phone when a deal is detected.

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
| `ADEG_MARKT_URL` | Optional: your local ADEG market's flyer-viewer URL (see [ADEG](#adeg--nahfrisch-best-effort-flyer-only) below) | — |

> **Tip:** pick a hard-to-guess topic name like `monster-alert-austria-xk9q2p`.

> **Requires Node.js ≥ 22.5** (uses the built-in `node:sqlite` module). Skip this if you're using Docker — the image already pins a compatible version.

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

## Running as a systemd service on Ubuntu Server LTS

This is the recommended way to run Monster Alert unattended on a bare-metal or VPS Ubuntu Server (tested target: 22.04 / 24.04 LTS). It installs Node.js, Playwright's Chromium (with its required system libraries), and a `systemd` unit that restarts on failure and starts on boot.

```bash
git clone <this-repo-url> monster-alert-at
cd monster-alert-at
sudo bash deploy/install-ubuntu.sh
```

The script copies the app to `/opt/monster-alert`, runs it as a dedicated unprivileged `monsteralert` system user, and creates `/opt/monster-alert/.env` from `.env.example` if it doesn't already exist.

```bash
# Edit config (at minimum, set NTFY_TOPIC)
sudo nano /opt/monster-alert/.env

# Start it
sudo systemctl start monster-alert

# Follow logs
sudo journalctl -u monster-alert -f

# Status / stop / restart
sudo systemctl status monster-alert
sudo systemctl stop monster-alert
sudo systemctl restart monster-alert
```

To deploy an update later, pull the latest code and re-run `sudo bash deploy/install-ubuntu.sh` — it re-syncs the app, reinstalls dependencies, and restarts the systemd unit definition (run `sudo systemctl restart monster-alert` afterwards to pick up the new code).

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

| Store | Method | Exact price? |
|---|---|---|
| BILLA | JSON API | ✅ |
| SPAR | JSON API | ✅ |
| Hofer | HTML scrape (cheerio) | ✅ |
| Penny | HTML scrape (cheerio) | ✅ |
| Lidl | Playwright (rendered DOM) | ✅ |
| ADEG | Best-effort flyer scan (Playwright) | ❌ mention only |
| Nah&Frisch | Best-effort flyer scan (PDF text) | ❌ mention only |

### ADEG / Nah&Frisch: best-effort, flyer-only

ADEG and Nah&Frisch are franchise networks of independent local merchants — neither has a national online shop or per-product price feed like the other five chains. Their only public offer data is a weekly/monthly flyer:

- **Nah&Frisch** publishes a "Dauertiefpreise" (permanent low price) PDF with real text. This scraper downloads it and checks whether "Monster" is mentioned anywhere — it can't reliably extract an exact per-can price from the PDF layout, so a match sends a *flyer-mention* alert instead of a price-deal alert (deduped once per ISO week).
- **ADEG** has no page at all until you pick your local market, and each market's flyer is a pure image viewer with no text. Set `ADEG_MARKT_URL` in `.env` to your local market's flyer-viewer URL (find it via [adeg.at → ADEG Flugblatt](https://www.adeg.at/flugblatt-aktionen/adeg-flugblatt), select your market) to enable a best-effort scan of that page's text/image `alt` attributes. Leave it unset to skip ADEG entirely — this is expected and logged, not an error.

---

## Troubleshooting

- **No products found for a store** — The store may have changed its website structure. Check the scraper file and update the selectors/API path.
- **Notifications not arriving** — Make sure `NTFY_TOPIC` in `.env` exactly matches the topic you subscribed to in the ntfy app.
- **"NTFY_TOPIC not set"** — Copy `.env.example` to `.env` and fill in the topic.
