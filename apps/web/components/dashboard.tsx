"use client";

import { apiClient } from "@/lib/api-client";
import dayjs from "@/lib/dayjs";
import { formatCurrency, formatQuantity } from "@/lib/format-currency";
import type { Expense, Order, Product, TreasuryBaseline } from "@/lib/types";
import {
  AlertOutlined,
  ApiOutlined,
  ArrowRightOutlined,
  EyeOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  InputNumber,
  Modal,
  Result,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
} from "antd";
import { isPromoGiftComboName } from "@/lib/order-calculator/order-promo";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isOnOrAfterCutoff(isoDate: string, cutoffIso: string): boolean {
  return new Date(isoDate).getTime() >= new Date(cutoffIso).getTime();
}

function sumPaymentsSince(orders: Order[], method: "CASH" | "CARD", sinceIso: string): number {
  return orders.reduce((sum, order) => {
    if (!isOnOrAfterCutoff(order.createdAt, sinceIso)) return sum;
    const payments = order.payments ?? [];
    return sum + payments.filter((p) => p.method === method).reduce((ps, p) => ps + Number(p.amount ?? 0), 0);
  }, 0);
}

function sumExpensesSince(expenses: Expense[], method: "CASH" | "CARD", sinceIso: string): number {
  return expenses
    .filter((e) => e.method === method && isOnOrAfterCutoff(e.createdAt, sinceIso))
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);
}

export function Dashboard() {
  const { message } = App.useApp();
  const lowStockSectionRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [baseline, setBaseline] = useState<TreasuryBaseline | null>(null);
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [rawExpenses, setRawExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    lowStockProducts: [] as Product[],
    recentOrders: [] as Order[],
    totalCustomers: 0,
  });
  const [cashFlowModalOpen, setCashFlowModalOpen] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [form] = Form.useForm<{
    openingCash: number;
    openingCard: number;
    deltaSince: ReturnType<typeof dayjs>;
  }>();

  const cash = useMemo(() => {
    if (!baseline) {
      return {
        deltaCashIn: 0,
        deltaCashOut: 0,
        deltaCardIn: 0,
        deltaCardOut: 0,
        balanceCash: 0,
        balanceCard: 0,
        total: 0,
      };
    }
    const since = baseline.deltaSince;
    const deltaCashIn = sumPaymentsSince(rawOrders, "CASH", since);
    const deltaCardIn = sumPaymentsSince(rawOrders, "CARD", since);
    const deltaCashOut = sumExpensesSince(rawExpenses, "CASH", since);
    const deltaCardOut = sumExpensesSince(rawExpenses, "CARD", since);
    const balanceCash = baseline.openingCash + deltaCashIn - deltaCashOut;
    const balanceCard = baseline.openingCard + deltaCardIn - deltaCardOut;
    return {
      deltaCashIn,
      deltaCashOut,
      deltaCardIn,
      deltaCardOut,
      balanceCash,
      balanceCard,
      total: balanceCash + balanceCard,
    };
  }, [baseline, rawOrders, rawExpenses]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setApiConnected(null);

      const limit = 100;
      const [productsRes, customersRes, baselineRes] = await Promise.all([
        apiClient.getProducts(1, 100),
        apiClient.getCustomers(1, 50),
        apiClient.getTreasuryBaseline().catch(() => null),
      ]);

      setApiConnected(true);
      if (baselineRes) setBaseline(baselineRes);

      let page = 1;
      let ordersRes = await apiClient.getOrders(page, limit);
      let allOrders = [...ordersRes.data];
      while (ordersRes.meta.totalPages > page) {
        page += 1;
        ordersRes = await apiClient.getOrders(page, limit);
        allOrders = [...allOrders, ...ordersRes.data];
      }

      page = 1;
      let expensesRes = await apiClient.getExpenses(page, limit);
      let allExpenses = [...expensesRes.data];
      while (expensesRes.meta.totalPages > page) {
        page += 1;
        expensesRes = await apiClient.getExpenses(page, limit);
        allExpenses = [...allExpenses, ...expensesRes.data];
      }

      setRawOrders(allOrders);
      setRawExpenses(allExpenses);

      const lowStock = productsRes.data.filter(
        (p) => p.stock < 10 && !isPromoGiftComboName(p.name),
      );
      const todayStart = startOfLocalDay(new Date());
      const recentOrders = allOrders
        .filter((order) => {
          if (order.isDelivered) return false;
          if (!order.deliveryDate) return false;
          return startOfLocalDay(new Date(order.deliveryDate)).getTime() >= todayStart.getTime();
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      setStats({
        totalOrders: ordersRes.meta.total,
        lowStockProducts: lowStock,
        recentOrders,
        totalCustomers: customersRes.meta.total,
      });
    } catch {
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (cashFlowModalOpen && baseline) {
      form.setFieldsValue({
        openingCash: baseline.openingCash,
        openingCard: baseline.openingCard,
        deltaSince: dayjs(baseline.deltaSince),
      });
    }
  }, [cashFlowModalOpen, baseline, form]);

  const scrollToLowStockSection = () => {
    lowStockSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveBaseline = async () => {
    try {
      const v = await form.validateFields();
      setSavingBaseline(true);
      const updated = await apiClient.updateTreasuryBaseline({
        openingCash: Number(v.openingCash ?? 0),
        openingCard: Number(v.openingCard ?? 0),
        deltaSince: v.deltaSince.toDate().toISOString(),
      });
      setBaseline(updated);
      message.success("Saldos guardados");
    } catch (e: unknown) {
      if (e && typeof e === "object" && "errorFields" in e) return;
      message.error("No se pudo guardar");
    } finally {
      setSavingBaseline(false);
    }
  };

  const orderColumns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      render: (text: string) => text.slice(0, 8) + "...",
    },
    {
      title: "Cliente",
      dataIndex: "customer",
      key: "customer",
      render: (_: unknown, record: Order) => record.customer?.name ?? (record.customerId ? "—" : "Sin asignar"),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (amount: number | string) => formatCurrency(amount),
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
      width: 88,
      render: (_: unknown, record: Order) => (
        <Space>
          <Link href={`/orders/${record.id}`}>
            <Button type="default" size="small" icon={<EyeOutlined />} title="Ver orden" aria-label="Ver orden" />
          </Link>
        </Space>
      ),
    },
  ];

  const lowStockColumns = [
    { title: "Producto", dataIndex: "name", key: "name" },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      render: (stock: number) => {
        const n = Number(stock);
        return <Tag color={n < 5 ? "red" : "orange"}>{formatQuantity(stock)}</Tag>;
      },
    },
    {
      title: "Categoría",
      dataIndex: ["category", "name"],
      key: "category",
      render: (text: string) => text || "N/A",
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: "24px", color: "#ffffff" }}>Dashboard General</h1>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px" }}>
          <Spin size="large" />
        </div>
      ) : apiConnected === false ? (
        <Result
          icon={<ApiOutlined style={{ color: "#f97316" }} />}
          title="API no conectada"
          subTitle={
            <span style={{ color: "#9ca3af" }}>
              No se pudo conectar al backend. Asegurese de que el servidor este corriendo en{" "}
              <code style={{ color: "#22c55e", background: "#1f2937", padding: "2px 6px", borderRadius: "4px" }}>
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}
              </code>
            </span>
          }
          extra={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchDashboardData}
              style={{ background: "#22c55e", borderColor: "#22c55e" }}
            >
              Reintentar conexion
            </Button>
          }
          style={{ background: "#1f2937", borderRadius: "8px", padding: "40px" }}
        />
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
            <Col xs={24} sm={12} lg={6}>
              <Card style={{ background: "#1f2937", borderColor: "#2d3748" }} variant="outlined">
                <Statistic
                  title="Total de Ordenes"
                  value={stats.totalOrders}
                  prefix={<ShoppingCartOutlined style={{ color: "#22c55e" }} />}
                  valueStyle={{ color: "#22c55e" }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{ background: "#1f2937", borderColor: "#2d3748", cursor: "pointer" }}
                variant="outlined"
                onClick={() => setCashFlowModalOpen(true)}
              >
                <Statistic
                  title="Caja (efectivo + transferencia)"
                  value={Number(cash.total)}
                  formatter={(value) => formatCurrency(value)}
                  valueStyle={{ color: "#22c55e" }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{ background: "#1f2937", borderColor: "#2d3748", cursor: "pointer" }}
                variant="outlined"
                role="button"
                tabIndex={0}
                aria-label="Ir a la lista de productos con stock bajo"
                onClick={scrollToLowStockSection}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    scrollToLowStockSection();
                  }
                }}
              >
                <Statistic
                  title="Productos en Stock"
                  value={stats.lowStockProducts.length}
                  prefix={<AlertOutlined style={{ color: "#f97316" }} />}
                  valueStyle={{ color: "#f97316" }}
                  suffix="bajo"
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card style={{ background: "#1f2937", borderColor: "#2d3748" }} variant="outlined">
                <Statistic
                  title="Clientes registrados"
                  value={stats.totalCustomers}
                  valueStyle={{ color: "#22c55e" }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
            <Col span={24}>
              <Card
                title="Entregas pendientes (hoy o posterior)"
                style={{ background: "#1f2937", borderColor: "#2d3748" }}
                extra={
                  <Link href="/orders">
                    <Button type="link" icon={<ArrowRightOutlined />}>
                      Ver todas
                    </Button>
                  </Link>
                }
              >
                {stats.recentOrders.length > 0 ? (
                  <Table
                    columns={orderColumns}
                    dataSource={stats.recentOrders}
                    rowKey="id"
                    pagination={false}
                    style={{ backgroundColor: "#111111" }}
                  />
                ) : (
                  <Empty
                    description="No hay entregas pendientes con fecha hoy o futura"
                    style={{ color: "#9ca3af" }}
                  />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col span={24}>
              <div
                id="dashboard-low-stock"
                ref={lowStockSectionRef}
                style={{ scrollMarginTop: 72 }}
              >
              <Card
                title="Productos con Stock Bajo"
                style={{ background: "#1f2937", borderColor: "#2d3748" }}
                extra={
                  <Link href="/products">
                    <Button type="link" icon={<ArrowRightOutlined />}>
                      Ver todos
                    </Button>
                  </Link>
                }
              >
                {stats.lowStockProducts.length > 0 ? (
                  <Table
                    columns={lowStockColumns}
                    dataSource={stats.lowStockProducts}
                    rowKey="id"
                    pagination={false}
                    style={{ backgroundColor: "#111111" }}
                  />
                ) : (
                  <Empty description="Todos los productos tienen stock suficiente" style={{ color: "#9ca3af" }} />
                )}
              </Card>
              </div>
            </Col>
          </Row>
        </>
      )}

      <Modal
        title="Caja: saldos y movimiento"
        open={cashFlowModalOpen}
        onCancel={() => setCashFlowModalOpen(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <p style={{ color: "#9ca3af", marginTop: 0, fontSize: 13, marginBottom: 16 }}>
          Definí cuánto tenés hoy en efectivo y en transferencia, y desde qué fecha deben sumarse las{" "}
          <strong style={{ color: "#e5e7eb" }}>órdenes y gastos nuevos</strong> (por ejemplo justo después de importar
          el Excel, para no duplicar lo histórico).
        </p>
        <Form form={form} layout="vertical" style={{ marginBottom: 16 }}>
          <Form.Item
            name="openingCash"
            label="Efectivo inicial (hoy)"
            rules={[{ required: true, message: "Requerido" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} step={1} />
          </Form.Item>
          <Form.Item
            name="openingCard"
            label="Transferencia inicial (hoy)"
            rules={[{ required: true, message: "Requerido" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} step={1} />
          </Form.Item>
          <Form.Item
            name="deltaSince"
            label="Contar órdenes y gastos desde"
            rules={[{ required: true, message: "Requerido" }]}
          >
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: "100%" }} />
          </Form.Item>
          <Button
            type="primary"
            onClick={saveBaseline}
            loading={savingBaseline}
            style={{ background: "#22c55e", borderColor: "#22c55e" }}
          >
            Guardar saldos
          </Button>
        </Form>

        {baseline ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
              <div>
                <p style={{ color: "#ffffff", margin: 0, fontWeight: 600 }}>Efectivo</p>
                <p style={{ color: "#9ca3af", margin: "8px 0 0 0", fontSize: 13 }}>
                  Inicial: {formatCurrency(baseline.openingCash)}
                </p>
                <p style={{ color: "#9ca3af", margin: "4px 0 0 0", fontSize: 13 }}>
                  + Ventas (desde corte): <span style={{ color: "#22c55e" }}>{formatCurrency(cash.deltaCashIn)}</span>
                </p>
                <p style={{ color: "#9ca3af", margin: "4px 0 0 0", fontSize: 13 }}>
                  − Gastos (desde corte): <span style={{ color: "#f97316" }}>{formatCurrency(cash.deltaCashOut)}</span>
                </p>
                <p style={{ color: "#e5e7eb", margin: "8px 0 0 0", fontWeight: 600 }}>
                  = {formatCurrency(cash.balanceCash)}
                </p>
              </div>
              <div>
                <p style={{ color: "#ffffff", margin: 0, fontWeight: 600 }}>Transferencia</p>
                <p style={{ color: "#9ca3af", margin: "8px 0 0 0", fontSize: 13 }}>
                  Inicial: {formatCurrency(baseline.openingCard)}
                </p>
                <p style={{ color: "#9ca3af", margin: "4px 0 0 0", fontSize: 13 }}>
                  + Ventas: <span style={{ color: "#22c55e" }}>{formatCurrency(cash.deltaCardIn)}</span>
                </p>
                <p style={{ color: "#9ca3af", margin: "4px 0 0 0", fontSize: 13 }}>
                  − Gastos: <span style={{ color: "#f97316" }}>{formatCurrency(cash.deltaCardOut)}</span>
                </p>
                <p style={{ color: "#e5e7eb", margin: "8px 0 0 0", fontWeight: 600 }}>
                  = {formatCurrency(cash.balanceCard)}
                </p>
              </div>
            </div>
            <p style={{ color: "#ffffff", margin: "16px 0 0 0", fontWeight: 600 }}>
              Total caja: {formatCurrency(cash.total)}
            </p>
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>
              Corte: {new Date(baseline.deltaSince).toLocaleString("es-AR")}
            </p>
          </>
        ) : (
          <p style={{ color: "#f97316" }}>No se pudo cargar la configuración de caja. Reintentá o revisá la API.</p>
        )}
      </Modal>
    </div>
  );
}
