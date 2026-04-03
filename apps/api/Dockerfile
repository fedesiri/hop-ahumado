# Build from repository root:
#   docker build -f apps/api/Dockerfile -t api:local .

FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile --filter api...

WORKDIR /app/apps/api

ENV DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/dummy"

RUN pnpm exec prisma generate
RUN pnpm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

RUN pnpm install --frozen-lockfile --filter api... --prod

WORKDIR /app/apps/api

ENV DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/dummy"

RUN pnpm exec prisma generate

COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 8080

USER node

CMD ["node", "dist/main.js"]
