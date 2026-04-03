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

# pnpm deja .prisma dentro de .pnpm/@prisma+client@.../node_modules/.prisma (no en /app/node_modules/.prisma)
RUN mkdir -p /tmp/prisma-for-runner && \
    PRISMA_SRC=$(find /app/node_modules/.pnpm -type d -path "*/node_modules/.prisma" 2>/dev/null | head -1) && \
    if [ -z "$PRISMA_SRC" ]; then echo "No se encontró .prisma tras generate" && find /app -name ".prisma" -type d 2>/dev/null && exit 1; fi && \
    cp -aL "$PRISMA_SRC" /tmp/prisma-for-runner/

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

# Mismo layout pnpm que en builder: el cliente debe vivir junto a @prisma/client
COPY --from=builder /tmp/prisma-for-runner/.prisma /tmp/prisma-generated/
RUN PRISMA_PARENT="$(ls -d /app/node_modules/.pnpm/@prisma+client@*/node_modules 2>/dev/null | head -1)" && \
    if [ -z "$PRISMA_PARENT" ]; then echo "No hay @prisma+client en node_modules" && ls /app/node_modules/.pnpm && exit 1; fi && \
    rm -rf "$PRISMA_PARENT/.prisma" && mv /tmp/prisma-generated "$PRISMA_PARENT/.prisma"

COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 8080

USER node

CMD ["node", "dist/main.js"]
