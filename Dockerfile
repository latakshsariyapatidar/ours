FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci
FROM dependencies AS frontend
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build
FROM dependencies AS production-dependencies
RUN npm prune --omit=dev
FROM node:24-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends libheif-examples ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY scripts/admin.js ./scripts/admin.js
USER node
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=192 MALLOC_ARENA_MAX=2
EXPOSE 3000
CMD ["node","server/index.js"]
FROM caddy:2-alpine AS web
COPY --from=frontend /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
