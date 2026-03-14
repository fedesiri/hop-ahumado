# Scripts

## Importar desde Excel

Carga categorías, productos, clientes, precios (Mayorista, Minorista, Fábrica), costos, stock y movimientos desde la plantilla de control de inventario.

**Uso** (desde `apps/api`):

```bash
pnpm run import:xlsx -- "ruta/al/archivo.xlsx"
```

Ejemplo con la plantilla en Descargas:

```bash
pnpm run import:xlsx -- "C:\Users\Federico Siri\Downloads\Plantilla de control de inventario 🍻.xlsx"
```

Requisitos: `DATABASE_URL` en `.env` y `prisma generate` ya ejecutado.
