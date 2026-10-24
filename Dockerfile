# syntax=docker/dockerfile:1

# --- Construction : on installe tout le monorepo et on compile le client -------------
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable

# Les manifestes d'abord : tant qu'ils ne changent pas, Docker réutilise l'installation.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY packages packages
COPY apps apps
RUN pnpm --filter @pb/web build

# --- Exécution ----------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=2567
RUN corepack enable

COPY --from=build /app ./

EXPOSE 2567
# Le serveur sert aussi le client compilé : une seule origine, pas de CORS.
CMD ["pnpm", "--filter", "@pb/server", "start"]
