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

# Ruta estable para el runner (pnpm puede dejar .prisma en la raíz del workspace o en apps/api)
RUN mkdir -p /tmp/prisma-for-runner && \
    if [ -d /app/node_modules/.prisma ]; then cp -a /app/node_modules/.prisma /tmp/prisma-for-runner/; \
    elif [ -d /app/apps/api/node_modules/.prisma ]; then cp -a /app/apps/api/node_modules/.prisma /tmp/prisma-for-runner/; \
    else echo "No se encontró node_modules/.prisma tras generate" && find /app -name ".prisma" -type d 2>/dev/null && exit 1; fi

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

# prisma CLI no está en --prod; copiamos el cliente generado en builder.
COPY --from=builder /tmp/prisma-for-runner/.prisma /app/node_modules/.prisma

COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 8080

USER node

CMD ["node", "dist/main.js"]
