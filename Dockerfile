FROM node:20-slim

# Playwright needs some system libs even if we mostly use cheerio
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Data volume so prices.db survives container restarts
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/prices.db

CMD ["node", "src/index.js"]
