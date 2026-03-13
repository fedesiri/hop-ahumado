# Hop Ahumado - Sistema de Gestión de Negocios

Frontend en Next.js 16 para gestionar dos líneas de negocio: Carnes Ahumadas y Cerveza Artesanal.

## Características

- **Dashboard Global**: Panorama completo de ambas líneas de negocio
- **Selector de Línea**: Pestañas para filtrar por Carnes o Cerveza
- **Gestión Completa**: Categorías, Productos, Clientes, Órdenes, Precios, Costos, Stock, Recetas
- **Tema Oscuro**: Paleta negra y verde profesional
- **Responsivo**: Funciona en desktop y mobile
- **Componentes Ant Design**: UI moderna con formularios y tablas

## Stack Tecnológico

- **Next.js 16** (App Router)
- **TypeScript**
- **Ant Design 5** (Componentes y tema)
- **Tailwind CSS** (Base)
- **SWR** (Data fetching)
- **Dayjs** (Date handling)

## Requisitos

- Node.js 18+
- API Backend disponible

## Instalación

```bash
# Instalar dependencias
pnpm install

# Configurar variables de entorno
# Crear archivo .env.local con:
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev

# Abrir http://localhost:3000
```

## Variables de Entorno

- `NEXT_PUBLIC_API_URL`: URL base de la API (default: http://localhost:3001)

## Estructura de Carpetas

```
app/
├── layout.tsx          # Layout principal con Ant Design
├── page.tsx            # Página de inicio (Dashboard)
├── categories/         # Gestión de categorías
├── products/           # Gestión de productos
├── customers/          # Gestión de clientes
├── customer-profiles/  # Perfiles de clientes
├── customer-interactions/ # Interacciones
├── orders/             # Órdenes con ítems y pagos
├── prices/             # Precios
├── costs/              # Costos
├── stock/              # Movimientos de stock
├── recipes/            # Recetas (ingredientes)
└── users/              # Usuarios y salud de API

components/
├── app-layout.tsx      # Wrapper de layout
├── app-sidebar.tsx     # Menú lateral
└── dashboard.tsx       # Componente dashboard

lib/
├── api-client.ts       # Cliente HTTP para la API
├── types.ts            # Tipos TypeScript
├── line-context.tsx    # Contexto para selección de línea
└── use-media-query.ts  # Hook para responsive
```

## Páginas y Funcionalidades

### Dashboard (`/`)
- Métricas de ambas líneas de negocio
- Órdenes recientes
- Productos con stock bajo
- Selector de línea (Carnes/Cerveza)

### Categorías (`/categories`)
- CRUD de categorías
- Listado paginado
- Crear, editar, eliminar

### Productos (`/products`)
- CRUD de productos
- Stock, SKU, código de barras
- Filtro de desactivados
- Asociación con categorías

### Clientes (`/customers`)
- CRUD de clientes
- Email y teléfono
- Listado paginado

### Perfiles de Clientes (`/customer-profiles`)
- Asociación cliente + responsable
- Empresa, tipo, estado, fuente
- Último contacto

### Interacciones (`/customer-interactions`)
- Registro de llamadas, emails, reuniones
- Asociadas a perfiles de clientes
- Notas descriptivas

### Órdenes (`/orders`)
- Creación con ítems y pagos en mismo formulario
- Validación de totales
- Vista detallada de orden
- Cliente y usuario responsable
- Historial de pagos

### Precios (`/prices`)
- Histórico de precios por producto
- Descripción y vigencia
- Listado paginado

### Costos (`/costs`)
- Histórico de costos
- Asociados a productos
- Cálculos de margen

### Stock (`/stock`)
- Movimientos (Entrada, Salida, Ajuste)
- Razón del movimiento
- Histórico completo

### Recetas (`/recipes`)
- Composición de productos
- Relación producto-ingrediente-cantidad
- Filtro por producto

### Usuarios (`/users`)
- CRUD de usuarios
- Email único
- Estado de API (Health check)
- Total de usuarios

## API Client

El cliente API (`lib/api-client.ts`) maneja:
- Autenticación de requests
- Paginación automática
- Manejo de errores
- Serialización JSON

Uso:
```typescript
import { apiClient } from '@/lib/api-client'

// Ejemplo
const products = await apiClient.getProducts(1, 10)
const category = await apiClient.createCategory({ name: 'Nueva' })
```

## Contexto de Línea de Negocio

El componente `LineProvider` maneja la selección de línea (MEAT/BEER) a nivel de app. Aunque la API no filtre por línea actualmente, el contexto está preparado para cuando se implemente.

```typescript
import { useLineContext } from '@/lib/line-context'

const { selectedLine, setSelectedLine } = useLineContext()
```

## Temas y Colores

Tema oscuro personalizado (Ant Design):
- **Background**: `#0a0a0a` (Negro profundo)
- **Surface**: `#1f2937` (Gris oscuro)
- **Primary**: `#22c55e` (Verde esmeralda)
- **Success**: Verde
- **Warning**: Naranja
- **Error**: Rojo

## Notas de Desarrollo

1. **Paginación**: Todos los listados usan `limit` de 10 por defecto, personalizable en tablas
2. **Responsive**: Sidebar colapsable en móvil, tablas adaptables
3. **Fechas**: Formateadas en formato argentino (dd/mm/yyyy) con dayjs
4. **Decimales**: Precios y costos con 2 decimales
5. **Validación**: Validación básica en formularios, validación compleja en backend

## Deploy

```bash
# Build
pnpm build

# Start production
pnpm start
```

Puedes deployar en Vercel, GitHub Pages o cualquier host que soporte Next.js.

## Próximas Mejoras Recomendadas

- Autenticación y login
- Búsqueda por texto en listados
- Exportación a CSV/PDF
- Gráficos de ventas y márgenes
- Notificaciones en tiempo real
- Filtros avanzados
- Historial de cambios
