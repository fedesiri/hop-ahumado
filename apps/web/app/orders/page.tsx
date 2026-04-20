"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import type { Dayjs } from "@/lib/dayjs";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import { orderPriceListDisplayLabel } from "@/lib/order-calculator/price-types";
import { buildOrderClipboardText } from "@/lib/order-clipboard";
import type { Customer, Order, OrderItem, User } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import {
  Alert,
  Table as AntTable,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function OrdersPage() {
  return (
    <LineProvider>
      <AppLayout>
        <OrdersContent />
      </AppLayout>
    </LineProvider>
  );
}

function OrdersContent() {
  const { message, modal } = App.useApp();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [filterCustomerId, setFilterCustomerId] = useState<string | undefined>(undefined);
  const [filterUserId, setFilterUserId] = useState<string | undefined>(undefined);
  const [filterDateRange, setFilterDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [filterMinTotal, setFilterMinTotal] = useState<number | undefined>(undefined);
  const [filterMaxTotal, setFilterMaxTotal] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetchOrders();
    fetchRelatedData();
  }, [
    pagination.page,
    pagination.limit,
    filterCustomerId,
    filterUserId,
    filterDateRange,
    filterMinTotal,
    filterMaxTotal,
  ]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getOrders(
        pagination.page,
        pagination.limit,
        filterCustomerId,
        filterUserId,
        filterDateRange ? filterDateRange[0]?.startOf("day").toISOString() : undefined,
        filterDateRange ? filterDateRange[1]?.endOf("day").toISOString() : undefined,
        filterMinTotal,
        filterMaxTotal,
      );
      setOrders(response.data);
      setMeta(response.meta);
    } catch (error) {
      message.error("Error al cargar órdenes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async () => {
    try {
      const [customersRes, usersRes] = await Promise.all([apiClient.getCustomers(1, 100), apiClient.getUsers(1, 100)]);
      setCustomers(customersRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      message.error("Error al cargar datos para filtros de órdenes");
      console.error(error);
    }
  };

  const handleViewOrder = (record: Order) => {
    setSelectedOrder(record);
    setViewModalOpen(true);
  };

  const handleCopyOrder = async (record: Order) => {
    const text = buildOrderClipboardText(record);
    if (!text) {
      message.warning("Esta orden no tiene ítems para copiar");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      if (navigator.vibrate) navigator.vibrate(30);
      message.success("Pedido copiado");
    } catch {
      message.error("No se pudo copiar");
    }
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: "Confirmar eliminacion",
      content: "Estas seguro de que deseas eliminar esta orden?",
      okText: "Si",
      cancelText: "No",
      onOk: async () => {
        try {
          await apiClient.deleteOrder(id);
          message.success("Orden eliminada");
          fetchOrders();
        } catch (error) {
          message.error("Error al eliminar orden");
        }
      },
    });
  };

  const columns: ColumnsType<Order> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 96,
      fixed: isMobile ? undefined : ("left" as const),
      render: (text: string) => text.slice(0, 8) + "...",
    },
    {
      title: "Cliente",
      dataIndex: ["customer", "name"],
      key: "customer",
      ellipsis: true,
      minWidth: 148,
      render: (text: string) => text || "-",
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 112,
      render: (amount: number | string) => formatCurrency(amount),
    },
    {
      title: "Lista",
      key: "priceListType",
      width: 100,
      ellipsis: true,
      render: (_: unknown, record: Order) => orderPriceListDisplayLabel(record.priceListType),
    },
    {
      title: "Ítems",
      dataIndex: "orderItems",
      key: "items",
      width: 72,
      render: (items: OrderItem[]) => items?.length || 0,
    },
    {
      title: "Entrega",
      key: "deliveryDate",
      width: 108,
      render: (_: unknown, record: Order) =>
        record.deliveryDate ? new Date(record.deliveryDate).toLocaleDateString("es-AR") : "—",
    },
    {
      title: "Stock desde",
      key: "fulfillmentLocation",
      width: 128,
      ellipsis: true,
      render: (_: unknown, record: Order) => record.fulfillmentLocation?.name ?? "—",
    },
    {
      title: "Acciones",
      key: "actions",
      width: isMobile ? 204 : 216,
      fixed: isMobile ? undefined : ("right" as const),
      render: (_: unknown, record: Order) => (
        <Space size={4} wrap={isMobile}>
          <Button
            type="default"
            size="small"
            icon={<EyeOutlined />}
            title="Ver detalle"
            aria-label="Ver detalle"
            onClick={() => handleViewOrder(record)}
          />
          <Button
            type="default"
            size="small"
            icon={<CopyOutlined />}
            title="Copiar pedido"
            aria-label="Copiar pedido"
            onClick={() => void handleCopyOrder(record)}
          />
          <Link href={`/orders/${record.id}/edit`}>
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              title="Editar ítems y stock"
              aria-label="Editar ítems y stock"
            />
          </Link>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            title="Eliminar"
            aria-label="Eliminar"
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          gap: 12,
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <h1 style={{ margin: 0, color: "#ffffff" }}>Órdenes</h1>
        <Link href="/orders/calculator" style={isMobile ? { width: "100%" } : undefined}>
          <Button type="primary" block={isMobile}>
            Nueva orden (cargar productos)
          </Button>
        </Link>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Dónde están los productos al armar un pedido"
        description={
          <>
            Los ítems salen del catálogo en <strong>Productos</strong>. Para que aparezcan con precio en la calculadora,
            cargá al menos un <strong>Precio</strong> activo para cada producto. Luego abrí{" "}
            <Link href="/orders/calculator">Nueva orden</Link>: elegís cliente, buscás el producto (ej. panes) y la
            cantidad. Al confirmar, el sistema <strong>descuenta solo el stock del producto vendido</strong> (el pan),
            no los ingredientes de la receta; las recetas hoy sirven para documentar composición, no para descontar
            insumos automáticamente.
          </>
        }
      />

      <Card style={{ marginBottom: "16px", background: "#1f2937", borderColor: "#2d3748" }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              allowClear
              showSearch
              placeholder="Filtrar por cliente"
              style={{ width: "100%" }}
              popupMatchSelectWidth={false}
              dropdownStyle={{ maxWidth: "min(100vw - 32px, 360px)" }}
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.trim().toLowerCase())
              }
              value={filterCustomerId}
              options={customers.map((c) => ({ label: c.name, value: c.id }))}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilterCustomerId(value || undefined);
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              allowClear
              showSearch
              placeholder="Filtrar por vendedor"
              style={{ width: "100%" }}
              popupMatchSelectWidth={false}
              dropdownStyle={{ maxWidth: "min(100vw - 32px, 320px)" }}
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.trim().toLowerCase())
              }
              value={filterUserId}
              options={users.map((u) => ({ label: u.name, value: u.id }))}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilterUserId(value || undefined);
              }}
            />
          </Col>
          <Col xs={24} md={12} lg={8}>
            <DatePicker.RangePicker
              allowClear
              placeholder={["Desde fecha", "Hasta fecha"]}
              style={{ width: "100%" }}
              value={filterDateRange as any}
              onChange={(values) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilterDateRange(values as [Dayjs, Dayjs] | null);
              }}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <InputNumber
              placeholder="Total mínimo"
              min={0}
              style={{ width: "100%" }}
              value={filterMinTotal}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilterMinTotal(value ?? undefined);
              }}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <InputNumber
              placeholder="Total máximo"
              min={0}
              style={{ width: "100%" }}
              value={filterMaxTotal}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilterMaxTotal(value ?? undefined);
              }}
            />
          </Col>
        </Row>
      </Card>

      {loading ? (
        <Spin />
      ) : orders.length > 0 ? (
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="id"
            tableLayout={isMobile ? "auto" : "fixed"}
            style={{ backgroundColor: "#1f2937", minWidth: isMobile ? 1068 : 1028 }}
            scroll={{ x: isMobile ? 1068 : 1200 }}
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
        <Empty description="No hay órdenes" style={{ color: "#9ca3af" }} />
      )}

      <Modal
        title="Detalles de la Orden"
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        footer={null}
        width={isMobile ? "calc(100vw - 24px)" : 800}
        styles={{ body: { maxHeight: isMobile ? "75vh" : undefined, overflowY: "auto" } }}
      >
        {selectedOrder && (
          <div>
            <Card style={{ marginBottom: "16px", background: "#1f2937" }}>
              <Row gutter={[16, 12]}>
                <Col xs={24} sm={12}>
                  <strong>Cliente:</strong> {selectedOrder.customer?.name || "-"}
                </Col>
                <Col xs={24} sm={12}>
                  <strong>Vendedor:</strong> {selectedOrder.user?.name || "-"}
                </Col>
                <Col xs={24} sm={12}>
                  <strong>Total:</strong> {formatCurrency(selectedOrder.total)}
                </Col>
                <Col xs={24} sm={12}>
                  <strong>Lista de precios:</strong> {orderPriceListDisplayLabel(selectedOrder.priceListType)}
                </Col>
                <Col xs={24} sm={12}>
                  <strong>Creada:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString("es-AR")}
                </Col>
                <Col xs={24} sm={12}>
                  <strong>Entrega:</strong>{" "}
                  {selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString("es-AR") : "—"}
                </Col>
                <Col xs={24} sm={12}>
                  <strong>Ubicación de stock:</strong> {selectedOrder.fulfillmentLocation?.name ?? "—"}
                </Col>
                {selectedOrder.comment ? (
                  <Col xs={24}>
                    <strong>Comentario:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{selectedOrder.comment}</span>
                  </Col>
                ) : null}
              </Row>
            </Card>

            <h3 style={{ color: "#ffffff" }}>Ítems</h3>
            <AntTable
              columns={[
                { title: "Producto", dataIndex: ["product", "name"], key: "product" },
                {
                  title: "Cantidad",
                  dataIndex: "quantity",
                  key: "quantity",
                  render: (q: number) => formatQuantity(q),
                },
                {
                  title: "Precio",
                  dataIndex: "price",
                  key: "price",
                  render: (v) => formatCurrency(v),
                },
                {
                  title: "Subtotal",
                  key: "subtotal",
                  render: (_, record: OrderItem) => formatCurrency(Number(record.price) * Number(record.quantity)),
                },
              ]}
              dataSource={selectedOrder.orderItems || []}
              rowKey="id"
              pagination={false}
            />

            <h3 style={{ color: "#ffffff", marginTop: "24px" }}>Pagos</h3>
            <AntTable
              columns={[
                {
                  title: "Método",
                  dataIndex: "method",
                  key: "method",
                  render: (v) => (v === "CASH" ? "Efectivo" : "Transferencia"),
                },
                {
                  title: "Monto",
                  dataIndex: "amount",
                  key: "amount",
                  render: (v) => formatCurrency(v),
                },
              ]}
              dataSource={selectedOrder.payments || []}
              rowKey="id"
              pagination={false}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
