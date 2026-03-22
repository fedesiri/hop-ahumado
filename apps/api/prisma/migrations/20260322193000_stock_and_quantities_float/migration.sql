-- Stock y cantidades en decimales (ej. kg): compatibilidad con enteros existentes.
ALTER TABLE "Product" ALTER COLUMN "stock" TYPE DOUBLE PRECISION USING "stock"::double precision;

ALTER TABLE "StockMovement" ALTER COLUMN "quantity" TYPE DOUBLE PRECISION USING "quantity"::double precision;

ALTER TABLE "OrderItem" ALTER COLUMN "quantity" TYPE DOUBLE PRECISION USING "quantity"::double precision;
