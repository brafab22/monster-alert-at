FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
 && npx playwright install --with-deps chromium

COPY . .

# Data volume so prices.db survives container restarts
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/prices.db

CMD ["node", "src/index.js"]
