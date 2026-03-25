"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import type { Dayjs } from "@/lib/dayjs";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { Customer, Order, OrderItem, User } from "@/lib/types";
import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
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

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      render: (text: string) => text.slice(0, 8) + "...",
    },
    {
      title: "Cliente",
      dataIndex: ["customer", "name"],
      key: "customer",
      render: (text: string) => text || "-",
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (amount: number | string) => formatCurrency(amount),
    },
    {
      title: "Ítems",
      dataIndex: "orderItems",
      key: "items",
      render: (items: OrderItem[]) => items?.length || 0,
    },
    {
      title: "Entrega",
      key: "deliveryDate",
      render: (_: unknown, record: Order) =>
        record.deliveryDate ? new Date(record.deliveryDate).toLocaleDateString("es-AR") : "—",
    },
    {
      title: "Acciones",
      key: "actions",
      width: 200,
      render: (_: any, record: Order) => (
        <Space>
          <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => handleViewOrder(record)} />
          <Link href={`/orders/${record.id}/edit`}>
            <Button type="default" size="small" icon={<EditOutlined />} title="Editar ítems y stock" />
          </Link>
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, color: "#ffffff" }}>Órdenes</h1>
        <Link href="/orders/calculator">
          <Button type="primary">Nueva orden (cargar productos)</Button>
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
        <Space wrap>
          <Select
            allowClear
            placeholder="Filtrar por cliente"
            style={{ minWidth: 200 }}
            value={filterCustomerId}
            options={customers.map((c) => ({ label: c.name, value: c.id }))}
            onChange={(value) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setFilterCustomerId(value || undefined);
            }}
          />
          <Select
            allowClear
            placeholder="Filtrar por vendedor"
            style={{ minWidth: 200 }}
            value={filterUserId}
            options={users.map((u) => ({ label: u.name, value: u.id }))}
            onChange={(value) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setFilterUserId(value || undefined);
            }}
          />
          <DatePicker.RangePicker
            allowClear
            placeholder={["Desde fecha", "Hasta fecha"]}
            value={filterDateRange as any}
            onChange={(values) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setFilterDateRange(values as [Dayjs, Dayjs] | null);
            }}
          />
          <InputNumber
            placeholder="Total mínimo"
            min={0}
            value={filterMinTotal}
            onChange={(value) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setFilterMinTotal(value ?? undefined);
            }}
          />
          <InputNumber
            placeholder="Total máximo"
            min={0}
            value={filterMaxTotal}
            onChange={(value) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setFilterMaxTotal(value ?? undefined);
            }}
          />
        </Space>
      </Card>

      {loading ? (
        <Spin />
      ) : orders.length > 0 ? (
        <Table
          columns={columns}
          dataSource={orders}
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
        <Empty description="No hay órdenes" style={{ color: "#9ca3af" }} />
      )}

      <Modal
        title="Detalles de la Orden"
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        footer={null}
        width={800}
      >
        {selectedOrder && (
          <div>
            <Card style={{ marginBottom: "16px", background: "#1f2937" }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>Cliente:</strong> {selectedOrder.customer?.name || "-"}
                </Col>
                <Col span={12}>
                  <strong>Vendedor:</strong> {selectedOrder.user?.name || "-"}
                </Col>
                <Col span={12}>
                  <strong>Total:</strong> {formatCurrency(selectedOrder.total)}
                </Col>
                <Col span={12}>
                  <strong>Creada:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString("es-AR")}
                </Col>
                <Col span={12}>
                  <strong>Entrega:</strong>{" "}
                  {selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate).toLocaleDateString("es-AR") : "—"}
                </Col>
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
