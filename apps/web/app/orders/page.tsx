"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type {
  CreateOrderRequest,
  Customer,
  Order,
  OrderItem,
  OrderPayment,
  PaymentMethod,
  Product,
  UpdateOrderRequest,
  User,
} from "@/lib/types";
import { DeleteOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Table as AntTable,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
} from "antd";
import { Dayjs } from "dayjs";
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
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [orderItems, setOrderItems] = useState<Partial<OrderItem>[]>([]);
  const [orderPayments, setOrderPayments] = useState<Partial<OrderPayment>[]>([]);
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
      const [productsRes, customersRes, usersRes] = await Promise.all([
        apiClient.getProducts(1, 100),
        apiClient.getCustomers(1, 100),
        apiClient.getUsers(1, 100),
      ]);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setOrderItems([{ quantity: 0, price: 0 }]);
    setOrderPayments([{ amount: 0, method: "CASH" as PaymentMethod }]);
    setModalOpen(true);
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

  const calculateTotal = () => {
    const itemsTotal = orderItems.reduce((sum, item) => {
      return sum + (item.price || 0) * (item.quantity || 0);
    }, 0);
    return itemsTotal;
  };

  const handleSubmit = async (values: any) => {
    try {
      // Validate items
      if (!orderItems.some((item) => item.productId && item.quantity && item.price)) {
        message.error("Debe agregar al menos un ítem");
        return;
      }

      // Validate payments
      if (!orderPayments.some((payment) => payment.amount && payment.method)) {
        message.error("Debe agregar al menos un pago");
        return;
      }

      const itemsTotal = calculateTotal();
      const paymentsTotal = orderPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

      if (Math.abs(itemsTotal - paymentsTotal) > 0.01) {
        message.error("El total de pagos debe coincidir con el total de ítems");
        return;
      }

      const data: CreateOrderRequest = {
        customerId: values.customerId,
        userId: values.userId,
        deliveryDate: values.deliveryDate?.toISOString(),
        total: itemsTotal,
        items: orderItems
          .filter((item) => item.productId && item.quantity)
          .map((item) => ({
            productId: item.productId!,
            quantity: item.quantity!,
            price: item.price!,
          })),
        payments: orderPayments
          .filter((payment) => payment.amount && payment.method)
          .map((payment) => ({
            amount: payment.amount!,
            method: payment.method!,
          })),
      };

      if (editingId) {
        await apiClient.updateOrder(editingId, {
          customerId: values.customerId,
          userId: values.userId,
          deliveryDate: values.deliveryDate?.toISOString(),
        } as UpdateOrderRequest);
        message.success("Orden actualizada");
      } else {
        await apiClient.createOrder(data);
        message.success("Orden creada");
      }
      setModalOpen(false);
      fetchOrders();
    } catch (error) {
      message.error("Error al guardar orden");
    }
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
      title: "Fecha",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleDateString("es-AR"),
    },
    {
      title: "Acciones",
      key: "actions",
      width: 150,
      render: (_: any, record: Order) => (
        <Space>
          <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => handleViewOrder(record)} />
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, color: "#ffffff" }}>Órdenes</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nueva Orden
        </Button>
      </div>

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
            placeholder="Filtrar por usuario"
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

      {/* Create/Edit Modal */}
      <Modal
        title={editingId ? "Editar Orden" : "Nueva Orden"}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        width={900}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Tabs
            items={[
              {
                key: "header",
                label: "Cabecera",
                children: (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="customerId" label="Cliente">
                        <Select
                          placeholder="Selecciona cliente"
                          options={customers.map((c) => ({ label: c.name, value: c.id }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="userId" label="Usuario">
                        <Select
                          placeholder="Selecciona usuario"
                          options={users.map((u) => ({ label: u.name, value: u.id }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="deliveryDate" label="Fecha de Entrega">
                        <DatePicker placeholder="Selecciona fecha" />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: "items",
                label: "Ítems",
                children: (
                  <div>
                    <div style={{ marginBottom: "16px" }}>
                      {orderItems.map((item, index) => (
                        <Row key={index} gutter={8} style={{ marginBottom: "8px" }}>
                          <Col span={12}>
                            <Select
                              placeholder="Producto"
                              value={item.productId}
                              onChange={(value) => {
                                const newItems = [...orderItems];
                                newItems[index].productId = value;
                                setOrderItems(newItems);
                              }}
                              options={products.map((p) => ({ label: p.name, value: p.id }))}
                            />
                          </Col>
                          <Col span={6}>
                            <InputNumber
                              placeholder="Cant"
                              value={item.quantity}
                              onChange={(value) => {
                                const newItems = [...orderItems];
                                newItems[index].quantity = value || 0;
                                setOrderItems(newItems);
                              }}
                              min={0}
                            />
                          </Col>
                          <Col span={6}>
                            <InputNumber
                              placeholder="Precio"
                              value={item.price}
                              onChange={(value) => {
                                const newItems = [...orderItems];
                                newItems[index].price = value || 0;
                                setOrderItems(newItems);
                              }}
                              min={0}
                              step={0.01}
                            />
                          </Col>
                        </Row>
                      ))}
                    </div>
                    <Button onClick={() => setOrderItems([...orderItems, { quantity: 0, price: 0 }])}>
                      Agregar Ítem
                    </Button>
                  </div>
                ),
              },
              {
                key: "payments",
                label: "Pagos",
                children: (
                  <div>
                    <div style={{ marginBottom: "16px" }}>
                      {orderPayments.map((payment, index) => (
                        <Row key={index} gutter={8} style={{ marginBottom: "8px" }}>
                          <Col span={12}>
                            <Select
                              placeholder="Método"
                              value={payment.method}
                              onChange={(value) => {
                                const newPayments = [...orderPayments];
                                newPayments[index].method = value;
                                setOrderPayments(newPayments);
                              }}
                              options={[
                                { label: "Efectivo", value: "CASH" },
                                { label: "Tarjeta", value: "CARD" },
                              ]}
                            />
                          </Col>
                          <Col span={12}>
                            <InputNumber
                              placeholder="Monto"
                              value={payment.amount}
                              onChange={(value) => {
                                const newPayments = [...orderPayments];
                                newPayments[index].amount = value || 0;
                                setOrderPayments(newPayments);
                              }}
                              min={0}
                              step={0.01}
                            />
                          </Col>
                        </Row>
                      ))}
                    </div>
                    <Button
                      onClick={() =>
                        setOrderPayments([...orderPayments, { amount: 0, method: "CASH" as PaymentMethod }])
                      }
                    >
                      Agregar Pago
                    </Button>
                    <Card
                      style={{
                        marginTop: "16px",
                        background: "#1f2937",
                      }}
                    >
                      <div style={{ color: "#9ca3af" }}>
                        <div>Total Ítems: {formatCurrency(calculateTotal())}</div>
                        <div>
                          Total Pagos: {formatCurrency(orderPayments.reduce((sum, p) => sum + (p.amount || 0), 0))}
                        </div>
                      </div>
                    </Card>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* View Modal */}
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
                  <strong>Usuario:</strong> {selectedOrder.user?.name || "-"}
                </Col>
                <Col span={12}>
                  <strong>Total:</strong> {formatCurrency(selectedOrder.total)}
                </Col>
                <Col span={12}>
                  <strong>Fecha:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString("es-AR")}
                </Col>
              </Row>
            </Card>

            <h3 style={{ color: "#ffffff" }}>Ítems</h3>
            <AntTable
              columns={[
                { title: "Producto", dataIndex: ["product", "name"], key: "product" },
                { title: "Cantidad", dataIndex: "quantity", key: "quantity" },
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
                  render: (v) => (v === "CASH" ? "Efectivo" : "Tarjeta"),
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
