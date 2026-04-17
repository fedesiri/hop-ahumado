"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { Cost, PaginationMeta, Product, StockLocation, StockMovement, StockMovementType } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default function StockPage() {
  return (
    <LineProvider>
      <AppLayout>
        <StockContent />
      </AppLayout>
    </LineProvider>
  );
}

function StockContent() {
  const { message } = App.useApp();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [costsByProductId, setCostsByProductId] = useState<Record<string, Cost>>({});
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const selectedMovementType = Form.useWatch("type", form);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [rows, setRows] = useState<Array<{ productId?: string; quantity?: number }>>([
    { productId: undefined, quantity: undefined },
  ]);
  const [extraExpenseRows, setExtraExpenseRows] = useState<
    Array<{ description?: string; cash?: number; card?: number }>
  >([{ description: "", cash: 0, card: 0 }]);

  useEffect(() => {
    fetchMovements();
    fetchProducts();
    (async () => {
      try {
        setLocations(await apiClient.getStockLocations());
      } catch {
        setLocations([]);
      }
    })();
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    if (!modalOpen) return;
    fetchCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getStockMovements(pagination.page, pagination.limit);
      setMovements(response.data);
      setMeta(response.meta);
    } catch (error) {
      message.error("Error al cargar movimientos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await apiClient.getProducts(1, 100);
      setProducts(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchCosts = async () => {
    try {
      const limit = 100;
      let page = 1;
      let res = await apiClient.getCosts(page, limit, undefined, true);
      const all: Cost[] = [...res.data];

      while (res.meta.totalPages > page) {
        page += 1;
        res = await apiClient.getCosts(page, limit, undefined, true);
        all.push(...res.data);
      }

      const map: Record<string, Cost> = {};
      for (const c of all) map[c.productId] = c;
      setCostsByProductId(map);
    } catch (error) {
      console.error(error);
      message.error("Error al cargar costos");
      setCostsByProductId({});
    }
  };

  const computedProductsCostTotal = (() => {
    const validRows = rows.filter((r) => r.productId && r.quantity && r.quantity !== 0) as Array<{
      productId: string;
      quantity: number;
    }>;
    const total = validRows.reduce((sum, r) => {
      const cost = costsByProductId[r.productId];
      const unitCost = cost ? Number(cost.value ?? 0) : 0;
      return sum + r.quantity * unitCost;
    }, 0);
    return roundMoney(total);
  })();

  const hasMissingCostForSelectedProducts = (() => {
    const validRows = rows.filter((r) => r.productId && r.quantity && r.quantity !== 0) as Array<{
      productId: string;
      quantity: number;
    }>;
    return validRows.some((r) => !costsByProductId[r.productId]);
  })();

  const missingCostProductNames = (() => {
    const validRows = rows.filter((r) => r.productId && r.quantity && r.quantity !== 0) as Array<{
      productId: string;
      quantity: number;
    }>;
    return validRows
      .filter((r) => !costsByProductId[r.productId])
      .map((r) => products.find((p) => p.id === r.productId)?.name || r.productId);
  })();

  const defaultLocationId = locations.find((l) => l.isDefault)?.id ?? locations[0]?.id;

  const handleCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      locationId: defaultLocationId,
      fromLocationId: defaultLocationId,
      toLocationId: undefined,
    });
    setRows([{ productId: undefined, quantity: undefined }]);
    setExtraExpenseRows([{ description: "", cash: 0, card: 0 }]);
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const type = values.type as StockMovementType;
      const reason = values.reason;

      const validRows = rows.filter((r) => r.productId && r.quantity && r.quantity !== 0);
      if (validRows.length === 0) {
        message.error("Debes cargar al menos un producto con cantidad");
        return;
      }

      let productsCashAmount = 0;
      let productsCardAmount = 0;
      let productsDescription = "";

      // Validaciones de egreso (MVP) ANTES de crear el movimiento de stock.
      if (type === "IN") {
        if (hasMissingCostForSelectedProducts) {
          message.error(`Falta costo para: ${missingCostProductNames.join(", ")}.`);
          return;
        }

        productsCashAmount = Number(values.productsCashAmount ?? 0);
        productsCardAmount = Number(values.productsCardAmount ?? 0);

        const productsTotalPaid = productsCashAmount + productsCardAmount;

        if (productsTotalPaid <= 0) {
          message.error("Para una entrada de stock, informá el pago de los productos (efectivo y/o transferencia).");
          return;
        }

        const computedTotal = computedProductsCostTotal;
        const shouldValidateProductsTotal = computedTotal > 0 && !hasMissingCostForSelectedProducts;
        if (shouldValidateProductsTotal) {
          const diff = Math.abs(productsTotalPaid - computedTotal);
          if (diff > 0.01) {
            message.error(
              `El pago informado para productos no coincide con el costo calculado (${computedTotal.toFixed(2)}).`,
            );
            return;
          }
        }

        const invalidExtra = extraExpenseRows.find(
          (r) => (Number(r.cash ?? 0) > 0 || Number(r.card ?? 0) > 0) && !(r.description || "").trim(),
        );
        if (invalidExtra) {
          message.error("Si cargás un egreso variable con monto, tenés que ponerle una descripción.");
          return;
        }

        productsDescription = reason ? `Productos (costo) - ${reason}` : "Productos (costo)";
      }

      const movementLocationId = values.locationId as string | undefined;
      const fromLocationId = values.fromLocationId as string | undefined;
      const toLocationId = values.toLocationId as string | undefined;

      if (type === "TRANSFER") {
        if (!fromLocationId || !toLocationId) {
          message.error("En traslado elegí ubicación de origen y destino.");
          return;
        }
        if (fromLocationId === toLocationId) {
          message.error("Origen y destino deben ser distintos.");
          return;
        }
      } else if (locations.length > 0 && !movementLocationId) {
        message.error("Elegí la ubicación del movimiento.");
        return;
      }

      await Promise.all(
        validRows.map((r) =>
          apiClient.createStockMovement({
            productId: r.productId!,
            quantity: r.quantity!,
            type,
            reason,
            ...(type === "TRANSFER" ? { fromLocationId, toLocationId } : { locationId: movementLocationId }),
          }),
        ),
      );

      // Si es una entrada (IN), registramos egreso monetario en `expenses`.
      if (type === "IN") {
        await apiClient.createExpense({
          description: productsDescription,
          cashAmount: productsCashAmount,
          cardAmount: productsCardAmount,
        });

        const validExtras = extraExpenseRows.filter((r) => Number(r.cash ?? 0) > 0 || Number(r.card ?? 0) > 0);
        for (const extra of validExtras) {
          const description = (extra.description || "").trim();
          await apiClient.createExpense({
            description: reason ? `${description} - ${reason}` : description,
            cashAmount: Number(extra.cash ?? 0),
            cardAmount: Number(extra.card ?? 0),
          });
        }
      }

      message.success("Movimientos de stock registrados");
      setModalOpen(false);
      fetchMovements();
    } catch (error) {
      message.error("Error al registrar movimiento");
    }
  };

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case "IN":
        return "green";
      case "OUT":
        return "red";
      case "ADJUSTMENT":
        return "orange";
      case "TRANSFER":
        return "blue";
      default:
        return "default";
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case "IN":
        return "Entrada";
      case "OUT":
        return "Salida";
      case "ADJUSTMENT":
        return "Ajuste";
      case "TRANSFER":
        return "Traslado";
      default:
        return type;
    }
  };

  const columns: ColumnsType<StockMovement> = [
    {
      title: "Producto",
      dataIndex: ["product", "name"],
      key: "product",
      ellipsis: true,
      minWidth: 140,
      render: (text: string) => text || "-",
    },
    {
      title: isMobile ? "Ubicación" : "Ubicación / traslado",
      key: "where",
      ellipsis: !isMobile,
      minWidth: isMobile ? 112 : 160,
      render: (_: unknown, row: StockMovement) => {
        if (row.type === "TRANSFER") {
          const a = row.fromLocation?.name ?? "—";
          const b = row.toLocation?.name ?? "—";
          if (isMobile) {
            return (
              <div style={{ fontSize: 12, lineHeight: 1.35, color: "#e5e7eb" }}>
                <div style={{ wordBreak: "break-word" }}>{a}</div>
                <div style={{ color: "#9ca3af", margin: "2px 0" }}>→</div>
                <div style={{ wordBreak: "break-word" }}>{b}</div>
              </div>
            );
          }
          return `${a} → ${b}`;
        }
        return row.location?.name ?? "—";
      },
    },
    {
      title: "Tipo",
      dataIndex: "type",
      key: "type",
      width: isMobile ? 86 : 108,
      align: "center",
      render: (type: string) => (
        <Tag color={getMovementTypeColor(type)} style={{ margin: 0, fontSize: isMobile ? 11 : undefined }}>
          {getMovementTypeLabel(type)}
        </Tag>
      ),
    },
    {
      title: "Cant.",
      dataIndex: "quantity",
      key: "quantity",
      width: isMobile ? 72 : 88,
      align: "right",
      render: (q: number) => formatQuantity(q),
    },
    {
      title: "Razón",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
      minWidth: 100,
      render: (text: string | null) => text || "—",
    },
    {
      title: "Fecha",
      dataIndex: "createdAt",
      key: "createdAt",
      width: isMobile ? 76 : 96,
      render: (date: string) => (
        <span style={{ fontSize: isMobile ? 12 : undefined, whiteSpace: "nowrap" }}>
          {new Date(date).toLocaleDateString("es-AR", isMobile ? { day: "2-digit", month: "2-digit" } : undefined)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, color: "#ffffff" }}>Movimientos de Stock</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} block={isMobile}>
          Registrar Movimiento
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message=""
        description="Usá decimales si el producto se mide en kg, litros, etc. (ej. entrada 2,5 kg de tomate). Mantené la misma unidad que en el producto y en recetas."
      />

      {loading ? (
        <Spin />
      ) : movements.length > 0 ? (
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Table<StockMovement>
            columns={columns}
            dataSource={movements}
            rowKey="id"
            size={isMobile ? "small" : "middle"}
            tableLayout={isMobile ? "auto" : "fixed"}
            style={{ backgroundColor: "#1f2937", minWidth: isMobile ? 680 : undefined }}
            scroll={{ x: isMobile ? 680 : 960 }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: meta?.total || 0,
              size: isMobile ? "small" : "default",
              showSizeChanger: !isMobile,
              responsive: true,
              onChange: (page, pageSize) => {
                setPagination({ page, limit: pageSize });
              },
            }}
          />
        </div>
      ) : (
        <Empty description="No hay movimientos de stock" style={{ color: "#9ca3af" }} />
      )}

      <Modal
        title="Registrar Movimiento de Stock"
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        width={isMobile ? "calc(100vw - 24px)" : 520}
        styles={{ body: { maxHeight: isMobile ? "75vh" : undefined, overflowY: "auto" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="type"
            label="Tipo de Movimiento"
            rules={[{ required: true, message: "El tipo es requerido" }]}
          >
            <Select
              placeholder="Selecciona tipo"
              options={[
                { label: "Entrada", value: "IN" },
                { label: "Salida", value: "OUT" },
                { label: "Ajuste", value: "ADJUSTMENT" },
                { label: "Traslado entre ubicaciones", value: "TRANSFER" },
              ]}
            />
          </Form.Item>

          {selectedMovementType === "TRANSFER" ? (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <Form.Item
                name="fromLocationId"
                label="Origen"
                rules={[{ required: true, message: "Elegí origen" }]}
                style={{ minWidth: 200, flex: 1 }}
              >
                <Select
                  placeholder="Ubicación origen"
                  options={locations.map((l) => ({ label: l.name, value: l.id }))}
                />
              </Form.Item>
              <Form.Item
                name="toLocationId"
                label="Destino"
                rules={[{ required: true, message: "Elegí destino" }]}
                style={{ minWidth: 200, flex: 1 }}
              >
                <Select
                  placeholder="Ubicación destino"
                  options={locations.map((l) => ({ label: l.name, value: l.id }))}
                />
              </Form.Item>
            </div>
          ) : (
            <Form.Item
              name="locationId"
              label="Ubicación"
              rules={locations.length > 0 ? [{ required: true, message: "Elegí ubicación" }] : []}
            >
              <Select
                placeholder="Ubicación del movimiento"
                allowClear={locations.length === 0}
                options={locations.map((l) => ({
                  label: l.isDefault ? `${l.name} (predeterminada)` : l.name,
                  value: l.id,
                }))}
              />
            </Form.Item>
          )}

          <p style={{ margin: "0 0 12px 0", color: "#9ca3af", fontSize: 13 }}>
            Producto y cantidad: misma unidad que definiste al cargar el producto (enteros o decimales, ej. 0,5 kg).
          </p>

          <div style={{ marginBottom: 16 }}>
            {rows.map((row, index) => (
              <Space key={index} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                <Select
                  showSearch
                  placeholder="Producto"
                  style={{ minWidth: 260 }}
                  value={row.productId}
                  options={products.map((p) => ({ label: p.name, value: p.id }))}
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={(value) => {
                    const next = [...rows];
                    next[index].productId = value;
                    setRows(next);
                  }}
                />
                <InputNumber
                  placeholder="Cantidad"
                  value={row.quantity}
                  onChange={(value) => {
                    const next = [...rows];
                    next[index].quantity = value ?? undefined;
                    setRows(next);
                  }}
                  min={0}
                  step={0.01}
                  precision={4}
                />
                {rows.length > 1 && (
                  <Button
                    danger
                    onClick={() => {
                      const next = rows.filter((_, i) => i !== index);
                      setRows(next.length ? next : [{ productId: undefined, quantity: undefined }]);
                    }}
                  >
                    Quitar
                  </Button>
                )}
              </Space>
            ))}
            <Button onClick={() => setRows([...rows, { productId: undefined, quantity: undefined }])}>
              Agregar producto
            </Button>
          </div>

          {selectedMovementType === "IN" && (
            <>
              <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px solid #2d3748" }}>
                <p style={{ margin: "0 0 8px 0", color: "#ffffff", fontWeight: 600 }}>
                  Pago de productos (solo para `Entrada`)
                </p>
                <p style={{ margin: "0 0 12px 0", color: "#9ca3af" }}>
                  Costo total calculado (productos):{" "}
                  <span style={{ color: "#22c55e" }}>{formatCurrency(computedProductsCostTotal)}</span>
                </p>

                <Form.Item name="productsCashAmount" label="Productos - Efectivo" rules={[{ required: false }]}>
                  <InputNumber
                    min={0}
                    step={0.01}
                    precision={2}
                    placeholder="Ingresá monto en efectivo"
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item name="productsCardAmount" label="Productos - Transferencia" rules={[{ required: false }]}>
                  <InputNumber
                    min={0}
                    step={0.01}
                    precision={2}
                    placeholder="Ingresá monto por transferencia"
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <p style={{ margin: "8px 0 0 0", color: "#9ca3af" }}>
                  El total de efectivo + transferencia debe coincidir con el costo calculado.
                </p>
              </div>

              <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px solid #2d3748" }}>
                <p style={{ margin: "0 0 8px 0", color: "#ffffff", fontWeight: 600 }}>
                  Otros egresos variables (opcionales)
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 120px 120px 36px",
                    gap: 8,
                    marginBottom: 8,
                    color: "#9ca3af",
                    fontSize: 12,
                  }}
                >
                  <span>Concepto</span>
                  <span>Efectivo</span>
                  <span>Transferencia</span>
                  <span />
                </div>
                {extraExpenseRows.map((row, index) => (
                  <div
                    key={index}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 120px 120px 36px",
                      gap: 8,
                      marginBottom: 8,
                      alignItems: "center",
                    }}
                  >
                    <Input
                      placeholder="Concepto (ej. leña, nafta, peaje)"
                      value={row.description}
                      onChange={(e) => {
                        const next = [...extraExpenseRows];
                        next[index].description = e.target.value;
                        setExtraExpenseRows(next);
                      }}
                    />
                    <InputNumber
                      placeholder="Efectivo"
                      min={0}
                      step={0.01}
                      precision={2}
                      value={row.cash}
                      onChange={(value) => {
                        const next = [...extraExpenseRows];
                        next[index].cash = Number(value || 0);
                        setExtraExpenseRows(next);
                      }}
                    />
                    <InputNumber
                      placeholder="Transferencia"
                      min={0}
                      step={0.01}
                      precision={2}
                      value={row.card}
                      onChange={(value) => {
                        const next = [...extraExpenseRows];
                        next[index].card = Number(value || 0);
                        setExtraExpenseRows(next);
                      }}
                    />
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      disabled={extraExpenseRows.length === 1}
                      onClick={() => {
                        const next = extraExpenseRows.filter((_, i) => i !== index);
                        setExtraExpenseRows(next.length ? next : [{ description: "", cash: 0, card: 0 }]);
                      }}
                    />
                  </div>
                ))}
                <Button
                  onClick={() => setExtraExpenseRows([...extraExpenseRows, { description: "", cash: 0, card: 0 }])}
                >
                  Agregar egreso variable
                </Button>
              </div>
            </>
          )}

          <Form.Item name="reason" label="Razón (Opcional)">
            <Input placeholder="Razón del movimiento" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
