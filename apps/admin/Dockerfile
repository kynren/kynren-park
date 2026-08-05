# syntax=docker/dockerfile:1
# Build context is the repo ROOT: `docker build -f apps/admin/Dockerfile .`

# ---- Build stage ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/
RUN npm install --workspace @kynren/admin --workspace @kynren/shared \
    --include-workspace-root --no-audit --no-fund

COPY packages/shared ./packages/shared
COPY apps/admin ./apps/admin
# NEXT_PUBLIC_* is inlined at build time — pass the real API URL as a build arg.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build --workspace @kynren/shared \
 && npm run build --workspace @kynren/admin

# ---- Runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app/apps/admin
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/admin/.next ./.next
COPY --from=build /app/apps/admin/package.json ./package.json
COPY --from=build /app/apps/admin/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
