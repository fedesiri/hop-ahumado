"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { Cost, PaginationMeta, Product, StockMovement, StockMovementType } from "@/lib/types";
import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag } from "antd";
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
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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

  const handleCreate = () => {
    form.resetFields();
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
          message.error("Para una entrada de stock, informá el pago de los productos (efectivo y/o tarjeta).");
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

      await Promise.all(
        validRows.map((r) =>
          apiClient.createStockMovement({
            productId: r.productId!,
            quantity: r.quantity!,
            type,
            reason,
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
      default:
        return type;
    }
  };

  const columns = [
    {
      title: "Producto",
      dataIndex: ["product", "name"],
      key: "product",
      render: (text: string) => text || "-",
    },
    {
      title: "Tipo",
      dataIndex: "type",
      key: "type",
      render: (type: string) => <Tag color={getMovementTypeColor(type)}>{getMovementTypeLabel(type)}</Tag>,
    },
    {
      title: "Cantidad",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "Razón",
      dataIndex: "reason",
      key: "reason",
      render: (text: string) => text || "-",
    },
    {
      title: "Fecha",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleDateString("es-AR"),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, color: "#ffffff" }}>Movimientos de Stock</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Registrar Movimiento
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : movements.length > 0 ? (
        <Table
          columns={columns}
          dataSource={movements}
          rowKey="id"
          style={{ backgroundColor: "#1f2937" }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: meta?.total || 0,
            onChange: (page, pageSize) => {
              setPagination({ page, limit: pageSize });
            },
          }}
        />
      ) : (
        <Empty description="No hay movimientos de stock" style={{ color: "#9ca3af" }} />
      )}

      <Modal
        title="Registrar Movimiento de Stock"
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
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
              ]}
            />
          </Form.Item>

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
                    next[index].quantity = value || 0;
                    setRows(next);
                  }}
                  min={0}
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
                <Form.Item name="productsCardAmount" label="Productos - Tarjeta" rules={[{ required: false }]}>
                  <InputNumber
                    min={0}
                    step={0.01}
                    precision={2}
                    placeholder="Ingresá monto en tarjeta"
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <p style={{ margin: "8px 0 0 0", color: "#9ca3af" }}>
                  El total de efectivo + tarjeta debe coincidir con el costo calculado.
                </p>
              </div>

              <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px solid #2d3748" }}>
                <p style={{ margin: "0 0 8px 0", color: "#ffffff", fontWeight: 600 }}>
                  Otros egresos variables (opcionales)
                </p>
                {extraExpenseRows.map((row, index) => (
                  <Space key={index} style={{ display: "flex", marginBottom: 8 }} align="baseline" size="middle">
                    <Input
                      placeholder="Concepto (ej. leña, nafta, peaje)"
                      style={{ minWidth: 240 }}
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
                      placeholder="Tarjeta"
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
                    {extraExpenseRows.length > 1 && (
                      <Button
                        danger
                        onClick={() => {
                          const next = extraExpenseRows.filter((_, i) => i !== index);
                          setExtraExpenseRows(next.length ? next : [{ description: "", cash: 0, card: 0 }]);
                        }}
                      >
                        Quitar
                      </Button>
                    )}
                  </Space>
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
