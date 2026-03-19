"use client";

import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import type { Customer, Order, Product } from "@/lib/types";
import {
  AlertOutlined,
  ApiOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Empty, Modal, Result, Row, Spin, Statistic, Table, Tag } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    incomeCash: 0,
    incomeCard: 0,
    expenseCash: 0,
    expenseCard: 0,
    lowStockProducts: [] as Product[],
    recentOrders: [] as Order[],
    totalCustomers: 0,
    netCash: 0,
    netCard: 0,
  });
  const [cashFlowModalOpen, setCashFlowModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setApiConnected(null);

      const limit = 100; // máximo que permite la API
      const [productsRes, customersRes] = await Promise.all([
        apiClient.getProducts(1, 100),
        apiClient.getCustomers(1, 50),
      ]);

      setApiConnected(true);

      // Órdenes: paginar para calcular ingresos reales desde el inicio
      let page = 1;
      let ordersRes = await apiClient.getOrders(page, limit);
      const firstOrdersPage = ordersRes.data;
      let allOrders = [...ordersRes.data];
      while (ordersRes.meta.totalPages > page) {
        page += 1;
        ordersRes = await apiClient.getOrders(page, limit);
        allOrders = [...allOrders, ...ordersRes.data];
      }

      // Ingresos (pagos por método)
      const incomeCash = allOrders.reduce((sum, order) => {
        const payments = order.payments ?? [];
        return sum + payments.filter((p) => p.method === "CASH").reduce((ps, p) => ps + Number(p.amount ?? 0), 0);
      }, 0);
      const incomeCard = allOrders.reduce((sum, order) => {
        const payments = order.payments ?? [];
        return sum + payments.filter((p) => p.method === "CARD").reduce((ps, p) => ps + Number(p.amount ?? 0), 0);
      }, 0);

      // Egresos (payments CASH/CARD desde expenses)
      page = 1;
      let expensesRes = await apiClient.getExpenses(page, limit);
      let allExpenses = [...expensesRes.data];
      while (expensesRes.meta.totalPages > page) {
        page += 1;
        expensesRes = await apiClient.getExpenses(page, limit);
        allExpenses = [...allExpenses, ...expensesRes.data];
      }

      const expenseCash = allExpenses
        .filter((e) => e.method === "CASH")
        .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
      const expenseCard = allExpenses
        .filter((e) => e.method === "CARD")
        .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

      const netCash = incomeCash - expenseCash;
      const netCard = incomeCard - expenseCard;
      const totalRevenue = netCash + netCard;

      const lowStock = productsRes.data.filter((p) => p.stock < 10);
      const recentOrders = firstOrdersPage.slice(0, 5);

      const sortedCustomers = [...customersRes.data].sort(
        (a: Customer, b: Customer) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const lastCustomer = sortedCustomers[0];

      setStats({
        totalOrders: ordersRes.meta.total,
        totalRevenue,
        incomeCash,
        incomeCard,
        expenseCash,
        expenseCard,
        lowStockProducts: lowStock,
        recentOrders,
        totalCustomers: customersRes.meta.total,
        netCash,
        netCard,
      });
    } catch (error) {
      setApiConnected(false);
      // Keep previous stats or defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
      title: "Fecha",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleDateString("es-AR"),
    },
    {
      title: "Acciones",
      key: "actions",
      render: (_: any, record: Order) => (
        <Link href={`/orders/${record.id}`}>
          <Button type="link" size="small">
            Ver
          </Button>
        </Link>
      ),
    },
  ];

  const lowStockColumns = [
    {
      title: "Producto",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Stock",
      dataIndex: "stock",
      key: "stock",
      render: (stock: number) => <Tag color={stock < 5 ? "red" : "orange"}>{stock}</Tag>,
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
          {/* Statistics Cards */}
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
                  title="Flujo de Caja Actual"
                  value={Number(stats.totalRevenue)}
                  formatter={(value) => formatCurrency(value)}
                  valueStyle={{ color: "#22c55e" }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card style={{ background: "#1f2937", borderColor: "#2d3748" }} variant="outlined">
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

          {/* Recent Orders */}
          <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
            <Col span={24}>
              <Card
                title="Ordenes Recientes"
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
                  <Empty description="No hay ordenes" style={{ color: "#9ca3af" }} />
                )}
              </Card>
            </Col>
          </Row>

          {/* Low Stock Products */}
          <Row gutter={[16, 16]}>
            <Col span={24}>
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
            </Col>
          </Row>
        </>
      )}

      <Modal
        title="Detalle de Flujo de Caja"
        open={cashFlowModalOpen}
        onCancel={() => setCashFlowModalOpen(false)}
        footer={null}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <p style={{ color: "#ffffff", margin: 0, fontWeight: 600 }}>Efectivo</p>
            <p style={{ color: "#9ca3af", margin: "8px 0 0 0" }}>
              Ingresos: <span style={{ color: "#22c55e" }}>{formatCurrency(stats.incomeCash)}</span>
            </p>
            <p style={{ color: "#9ca3af", margin: "8px 0 0 0" }}>
              Egresos: <span style={{ color: "#f97316" }}>{formatCurrency(stats.expenseCash)}</span>
            </p>
            <p style={{ color: "#9ca3af", margin: "8px 0 0 0" }}>
              Neto: <span style={{ color: "#22c55e" }}>{formatCurrency(stats.netCash)}</span>
            </p>
          </div>
          <div>
            <p style={{ color: "#ffffff", margin: 0, fontWeight: 600 }}>Tarjeta</p>
            <p style={{ color: "#9ca3af", margin: "8px 0 0 0" }}>
              Ingresos: <span style={{ color: "#22c55e" }}>{formatCurrency(stats.incomeCard)}</span>
            </p>
            <p style={{ color: "#9ca3af", margin: "8px 0 0 0" }}>
              Egresos: <span style={{ color: "#f97316" }}>{formatCurrency(stats.expenseCard)}</span>
            </p>
            <p style={{ color: "#9ca3af", margin: "8px 0 0 0" }}>
              Neto: <span style={{ color: "#22c55e" }}>{formatCurrency(stats.netCard)}</span>
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
