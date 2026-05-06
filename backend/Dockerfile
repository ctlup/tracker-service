# Single-stage Node image — no build step needed for plain ESM.

FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# src/ is the main app, scripts/ contains terminal verification tools (seed, checkDb, simulateApp)
COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/index.mjs"]
