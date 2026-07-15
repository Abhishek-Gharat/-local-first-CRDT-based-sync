FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/sync-server/package.json apps/sync-server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm-store \
  pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY packages/shared packages/shared
COPY apps/sync-server apps/sync-server
RUN pnpm --filter shared build

FROM base AS runner
WORKDIR /app
COPY --from=build /app /app
EXPOSE 8080
ENV PORT=8080
CMD ["pnpm", "--filter", "sync-server", "start"]
