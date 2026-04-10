# Scripts

## Importar desde Excel (inventario)

Carga productos, clientes, precios (Mayorista, Minorista, Fábrica), costos, stock, movimientos y **órdenes históricas** (agrupadas por fecha y cliente desde la hoja Salidas, con ítems y pagos). No importa la hoja Caja Diaria ni crea gastos desde el Excel; el stock sigue definiéndose con Stock General y la ubicación San Luis, no con las órdenes importadas.

**Uso** (desde `apps/api`):

```bash
pnpm run import:xlsx -- "ruta/al/archivo.xlsx"
```

Ejemplo con la plantilla en Descargas:

```bash
pnpm run import:xlsx -- "C:\Users\Federico Siri\Downloads\Plantilla de control de inventario 🍻.xlsx"
```

## Importar CRM desde Excel (BierLife)

Carga clientes, perfiles CRM, interacciones y oportunidades desde el Excel del CRM.

**Uso** (desde `apps/api`):

```bash
pnpm run import:crm -- "C:\Users\Federico Siri\Downloads\CRM _ BierLife.xlsx"
```

Hojas esperadas (por nombre o por orden):

1. **Clientes** (ej. "DB_Clientes" o 1ª hoja): Empresa, Nombre completo, Tipo, Telefono, Email, Estado, Fuente, Responsable, próximo seguimiento, Notas generales.
2. **Interacciones** (2ª hoja): nombre cliente, fecha, medios de contacto, resumen/notas, proximo paso.
3. **Oportunidades** (3ª hoja, opcional): nombre cliente / empresa, etapa, valor, fecha cierre, notas.

Para ver los nombres reales de hojas y columnas de tu Excel:

```bash
pnpm run inspect:crm -- "C:\Users\Federico Siri\Downloads\CRM _ BierLife.xlsx"
```

Requisitos: `DATABASE_URL` en `.env` y `prisma generate` ya ejecutado.
