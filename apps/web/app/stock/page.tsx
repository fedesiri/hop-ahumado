"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { LineProvider } from "@/lib/line-context";
import type { PaginationMeta, Product, StockMovement, StockMovementType } from "@/lib/types";
import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag } from "antd";
import { useEffect, useState } from "react";

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
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [rows, setRows] = useState<Array<{ productId?: string; quantity?: number }>>([
    { productId: undefined, quantity: undefined },
  ]);

  useEffect(() => {
    fetchMovements();
    fetchProducts();
  }, [pagination.page, pagination.limit]);

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

  const handleCreate = () => {
    form.resetFields();
    setRows([{ productId: undefined, quantity: undefined }]);
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
                  placeholder="Producto"
                  style={{ minWidth: 220 }}
                  value={row.productId}
                  options={products.map((p) => ({ label: p.name, value: p.id }))}
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

          <Form.Item name="reason" label="Razón (Opcional)">
            <Input placeholder="Razón del movimiento" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
