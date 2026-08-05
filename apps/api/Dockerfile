# syntax=docker/dockerfile:1
# Build context is the repo ROOT: `docker build -f apps/api/Dockerfile .`

# ---- Build stage ----
FROM node:20-slim AS build
WORKDIR /app
# OpenSSL is required by Prisma's query engine.
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install deps for just the API and the two packages it depends on.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm install --workspace @kynren/api --workspace @kynren/db --workspace @kynren/shared \
    --include-workspace-root --no-audit --no-fund

# Build the workspace packages, generate the Prisma client, then build the API.
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run build --workspace @kynren/shared \
 && npm run build --workspace @kynren/db \
 && DATABASE_URL="postgresql://u:p@localhost:5432/db?schema=public" npm run db:generate \
 && npm run build --workspace @kynren/api

# ---- Runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV API_PORT=4000

# node_modules carries the generated Prisma client and the @kynren/* symlinks;
# packages/ carries their built dist that those symlinks resolve to.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
# main.js loads the root .env if present, else uses the container environment.
CMD ["node", "apps/api/dist/main.js"]
