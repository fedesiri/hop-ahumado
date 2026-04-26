"use client";

import { AppLayout } from "@/components/app-layout";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { apiClient } from "@/lib/api-client";
import type { Dayjs } from "@/lib/dayjs";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import { orderPriceListDisplayLabel } from "@/lib/order-calculator/price-types";
import { buildOrderClipboardText } from "@/lib/order-clipboard";
import { formatPaymentMethodsOnly, orderPaymentStatusLabel } from "@/lib/order-labels";
import { OrderPaymentStatus, type Customer, type Order, type OrderItem, type User } from "@/lib/types";
import { useMediaQuery } from "@/lib/use-media-query";
import { CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import {
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
  Switch,
  Table,
  Tag,
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
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [togglingDeliveryId, setTogglingDeliveryId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [filterCustomerId, setFilterCustomerId] = useState<string | undefined>(undefined);
  const [filterUserId, setFilterUserId] = useState<string | undefined>(undefined);
  const [filterDateRange, setFilterDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [filterMinTotal, setFilterMinTotal] = useState<number | undefined>(undefined);
  const [filterMaxTotal, setFilterMaxTotal] = useState<number | undefined>(undefined);
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<OrderPaymentStatus | undefined>(undefined);
  const [filterDelivered, setFilterDelivered] = useState<"true" | "false" | undefined>(undefined);

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
    filterPaymentStatus,
    filterDelivered,
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
        filterPaymentStatus,
        filterDelivered,
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

  const openViewModal = async (orderId: string) => {
    setViewModalOpen(true);
    setModalOrder(null);
    setModalLoading(true);
    try {
      const data = await apiClient.getOrder(orderId);
      setModalOrder(data);
    } catch (error) {
      console.error(error);
      message.error("No se pudo cargar el detalle de la orden");
      setViewModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleDelivered = async (record: Order, nextDelivered: boolean) => {
    setTogglingDeliveryId(record.id);
    try {
      const updated = await apiClient.updateOrder(record.id, {
        deliveredAt: nextDelivered ? new Date().toISOString() : null,
      });
      setOrders((prev) => prev.map((o) => (o.id === record.id ? updated : o)));
      setModalOrder((m) => (m?.id === record.id ? updated : m));
      message.success(nextDelivered ? "Orden marcada como entregada" : "Entrega desmarcada");
    } catch (error) {
      console.error(error);
      message.error("No se pudo actualizar el estado de entrega");
    } finally {
      setTogglingDeliveryId(null);
    }
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
      title: "Confirmar eliminación",
      content: "¿Seguro que deseas eliminar esta orden?",
      okText: "Sí",
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
      title: "Cliente",
      key: "customer",
      ellipsis: true,
      minWidth: 200,
      width: 220,
      fixed: isMobile ? undefined : ("left" as const),
      render: (_: unknown, record: Order) => record.customer?.name?.trim() || "Sin cliente",
    },
    {
      title: "Total",
      dataIndex: "totalPrice",
      key: "totalPrice",
      width: 120,
      render: (amount: number | string) => formatCurrency(amount),
    },
    {
      title: "Estado de pago",
      key: "paymentStatus",
      width: 128,
      render: (_: unknown, record: Order) => (
        <Tag
          color={
            record.paymentStatus === OrderPaymentStatus.PAID
              ? "green"
              : record.paymentStatus === OrderPaymentStatus.PARTIALLY_PAID
                ? "gold"
                : "default"
          }
        >
          {orderPaymentStatusLabel(record.paymentStatus)}
        </Tag>
      ),
    },
    {
      title: "Medios de pago",
      key: "paymentMethods",
      width: 200,
      ellipsis: true,
      render: (_: unknown, record: Order) => (
        <span style={{ color: "rgba(255,255,255,0.85)" }}>{formatPaymentMethodsOnly(record.payments)}</span>
      ),
    },
    {
      title: "Pagado",
      key: "paidAmount",
      width: 112,
      render: (_: unknown, record: Order) => formatCurrency(record.paidAmount ?? 0),
    },
    {
      title: "Pendiente",
      key: "remainingAmount",
      width: 120,
      render: (_: unknown, record: Order) => formatCurrency(record.remainingAmount ?? 0),
    },
    {
      title: "Lista de precios",
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
      title: "Programada",
      key: "deliveryDate",
      width: 108,
      render: (_: unknown, record: Order) =>
        record.deliveryDate ? new Date(record.deliveryDate).toLocaleDateString("es-AR") : "—",
    },
    {
      title: "Entregada",
      key: "isDelivered",
      width: 108,
      render: (_: unknown, record: Order) => (
        <Switch
          size="small"
          checked={record.isDelivered}
          loading={togglingDeliveryId === record.id}
          onChange={(checked) => void handleToggleDelivered(record, checked)}
        />
      ),
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
            onClick={() => void openViewModal(record.id)}
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

      <ScreenInfoPanel title="Dónde están los productos al armar un pedido">
        <>
          Los ítems salen del catálogo en <strong>Productos</strong>. Para que aparezcan con precio en la calculadora,
          cargá al menos un <strong>Precio</strong> activo para cada producto. Luego abrí{" "}
          <Link href="/orders/calculator">Nueva orden</Link>: elegís cliente, buscás el producto (ej. panes) y la
          cantidad. Al confirmar, el sistema <strong>descuenta solo el stock del producto vendido</strong> (el pan), no
          los ingredientes de la receta; las recetas hoy sirven para documentar composición, no para descontar insumos
          automáticamente.
        </>
      </ScreenInfoPanel>

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
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              allowClear
              placeholder="Estado de pago"
              style={{ width: "100%" }}
              popupMatchSelectWidth={false}
              value={filterPaymentStatus}
              options={[
                { value: OrderPaymentStatus.UNPAID, label: orderPaymentStatusLabel(OrderPaymentStatus.UNPAID) },
                {
                  value: OrderPaymentStatus.PARTIALLY_PAID,
                  label: orderPaymentStatusLabel(OrderPaymentStatus.PARTIALLY_PAID),
                },
                { value: OrderPaymentStatus.PAID, label: orderPaymentStatusLabel(OrderPaymentStatus.PAID) },
              ]}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilterPaymentStatus(value);
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              allowClear
              placeholder="Entrega"
              style={{ width: "100%" }}
              value={filterDelivered}
              options={[
                { value: "true", label: "Entregadas" },
                { value: "false", label: "No entregadas" },
              ]}
              onChange={(value) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilterDelivered((value as "true" | "false") || undefined);
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
            style={{ backgroundColor: "#1f2937", minWidth: isMobile ? 1180 : 1200 }}
            scroll={{ x: isMobile ? 1180 : 1400 }}
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
        title="Detalle de la orden"
        open={viewModalOpen}
        onCancel={() => {
          setViewModalOpen(false);
          setModalOrder(null);
        }}
        footer={
          <Space wrap>
            {modalOrder ? (
              <Link href={`/orders/${modalOrder.id}`}>
                <Button type="link">Abrir en página completa</Button>
              </Link>
            ) : null}
            <Button onClick={() => setViewModalOpen(false)}>Cerrar</Button>
          </Space>
        }
        width={isMobile ? "calc(100vw - 24px)" : 880}
        styles={{ body: { maxHeight: isMobile ? "75vh" : undefined, overflowY: "auto" } }}
      >
        {modalLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
            <Spin />
          </div>
        ) : null}
        {modalOrder ? (
          <OrderDetailView
            key={modalOrder.id}
            order={modalOrder}
            onOrderUpdated={(o) => {
              setModalOrder(o);
              setOrders((prev) => prev.map((row) => (row.id === o.id ? o : row)));
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
