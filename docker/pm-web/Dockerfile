# pm-web — Next.js 14 standalone server. Built from the repository root:
#   docker build -f docker/pm-web/Dockerfile --build-arg NEXT_PUBLIC_PORTAL_APP_ID=... -t pm-web .
FROM node:18-alpine AS deps
WORKDIR /app
COPY pm-web/package.json pm-web/package-lock.json ./
RUN npm ci

FROM node:18-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY pm-web/ ./
# Baked into the client bundle at build time (see docs/DEPLOY.md).
ARG NEXT_PUBLIC_PORTAL_APP_ID
ARG NEXT_PUBLIC_PORTAL_LAUNCH_URL
ARG NEXT_PUBLIC_PORTAL_HOME_URL
# /api and /sanctum are routed by nginx straight to php-fpm; this only serves as the fallback for `next` rewrites.
ENV BACKEND_URL=http://pm-nginx-internal \
    NEXT_PUBLIC_PORTAL_APP_ID=$NEXT_PUBLIC_PORTAL_APP_ID \
    NEXT_PUBLIC_PORTAL_LAUNCH_URL=$NEXT_PUBLIC_PORTAL_LAUNCH_URL \
    NEXT_PUBLIC_PORTAL_HOME_URL=$NEXT_PUBLIC_PORTAL_HOME_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Jakarta
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
