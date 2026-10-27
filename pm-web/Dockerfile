# PrevenTech web (pm-web): Next.js 14 standalone server on port 3000. Built by ../docker-compose.yml (context ./pm-web).
# The browser only talks to this origin: /api and /sanctum are proxied to BACKEND_URL (the pm-api container), so the
# Sanctum session cookie stays first-party. Rewrites and NEXT_PUBLIC_* values are fixed at build time.
FROM node:18-alpine AS build
WORKDIR /app
ARG BACKEND_URL=http://pm-api:8080
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# NEXT_PUBLIC_PORTAL_* (Portal app id and URLs) come from .env.local on the server; BACKEND_URL above wins over it.
RUN test -f .env.local || { echo "pm-web/.env.local belum ada: salin dari .env.example lalu isi nilai produksi."; exit 1; }
RUN npm run build -- --no-lint

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Jakarta
ARG BACKEND_URL=http://pm-api:8080
ENV BACKEND_URL=$BACKEND_URL
RUN apk add --no-cache tzdata \
    && addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
