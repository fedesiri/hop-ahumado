# Hop Ahumado — Monorepo

Monorepo con **Turborepo** + **pnpm**: frontend Next.js y backend NestJS con Prisma y PostgreSQL.

## Estructura

```
hop-ahumado/
├── apps/
│   ├── api/          # NestJS + Prisma + PostgreSQL
│   └── web/          # Next.js 15 + TypeScript
├── package.json      # Scripts raíz y Turbo
├── pnpm-workspace.yaml
└── turbo.json
```

## Requisitos

- **Node.js** ≥ 20
- **pnpm** 9 (o `corepack enable && corepack prepare pnpm@latest --activate`)
- **PostgreSQL** (local o remoto)

## Instalación

```bash
# Instalar dependencias de todo el monorepo
pnpm install

# Configurar entorno (elegir una opción)
cp .env.example .env
# y/o copiar apps/api/.env.example → apps/api/.env
# y/o copiar apps/web/.env.example → apps/web/.env.local
```

## Base de datos (API)

En `apps/api`:

```bash
# Definir DATABASE_URL en apps/api/.env
# Luego:

pnpm db:generate   # Genera el cliente Prisma
pnpm db:push       # Crea/actualiza tablas (desarrollo)
# o
pnpm db:migrate    # Crea migraciones (recomendado para producción)
pnpm db:studio     # Abre Prisma Studio
```

Los comandos `db:*` se ejecutan desde la raíz del monorepo y aplican al proyecto `api`.

## Desarrollo

Desde la **raíz** del repo:

```bash
# Levanta api (puerto 3001) y web (puerto 3000) en paralelo
pnpm dev

# Solo backend
pnpm dev:api

# Solo frontend
pnpm dev:web
```

- **Web:** http://localhost:3000  
- **API:** http://localhost:3001  
- **Health:** http://localhost:3001/health  

En la app Next.js, las rutas bajo `/api/*` se hacen proxy al backend según `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:3001`).

## Build y producción

```bash
# Build de todas las apps
pnpm build
```

- **API:** `apps/api/dist` — ejecutar con `node dist/main` (o el script `start` del package).
- **Web:** `apps/web/.next` — servir con `next start` (o export estático si lo configuras).

Cada app se puede desplegar por separado (ej. API en Railway/Render/Fly, Web en Vercel).

## Deploy

- **Web (Next.js):** Vercel, Netlify, o cualquier host que soporte Next. Configurar `NEXT_PUBLIC_API_URL` con la URL pública del API.
- **API (NestJS):** Railway, Render, Fly.io, etc. Configurar `DATABASE_URL` (PostgreSQL) y `CORS_ORIGIN` con el origen del frontend.
- En CI/CD: instalar con `pnpm install`, luego `pnpm build` (Turbo se encarga de orden y caché).

## Scripts útiles (raíz)

| Script        | Descripción                          |
|---------------|--------------------------------------|
| `pnpm dev`    | Dev de api + web                     |
| `pnpm build`  | Build de todas las apps              |
| `pnpm lint`   | Lint en todos los proyectos          |
| `pnpm db:generate` | Prisma generate (api)           |
| `pnpm db:push`     | Prisma db push (api)             |
| `pnpm db:migrate`  | Prisma migrate dev (api)         |
| `pnpm db:studio`   | Prisma Studio (api)              |

## Sugerencias a futuro

- **Tipos compartidos:** crear `packages/shared` con DTOs o tipos y consumir desde `api` y `web`.
- **Validación:** en API usar `class-validator` + `class-transformer` o Zod; en front, Zod o los mismos tipos.
- **Auth:** JWT o sesiones en NestJS; en Next.js usar cookies o almacenar token y enviarlo en headers.
- **Variables de entorno:** en producción no commitear `.env`; usar variables del proveedor de deploy o un gestor de secretos.
