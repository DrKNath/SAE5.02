# syntax=docker/dockerfile:1
#
# Multi-stage build.
#   - dev  : hote de dev avec hot-reload (ts-node-dev), code monte en volume
#   - build: compile le TypeScript en JS
#   - prod : image de production minimale (sans devDependencies, sans sources TS)

FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma

# ---------------------------------------------------------------------------
# Dependances completes (dev + prod), avec generation du client Prisma
# ---------------------------------------------------------------------------
FROM base AS deps-dev
RUN npm ci
RUN npx prisma generate

# ---------------------------------------------------------------------------
# Cible "dev" : utilisee par docker-compose.yml, code source monte en volume
# ---------------------------------------------------------------------------
FROM deps-dev AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# Compilation TypeScript -> JavaScript
# ---------------------------------------------------------------------------
FROM deps-dev AS build
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Dependances de production uniquement
# ---------------------------------------------------------------------------
FROM base AS deps-prod
RUN npm ci --omit=dev
RUN npx prisma generate

# ---------------------------------------------------------------------------
# Cible "prod" : image finale, publiee sur le registry (cf. CI)
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=deps-prod /app/prisma ./prisma
COPY package*.json ./
COPY --from=build /app/dist ./dist

# L'image officielle node fournit deja un utilisateur non-root "node".
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
