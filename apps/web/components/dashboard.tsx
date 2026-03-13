'use client'

import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Empty, Spin, Button, Tag, Alert, Result } from 'antd'
import {
  ShoppingCartOutlined,
  AlertOutlined,
  ArrowRightOutlined,
  ApiOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import type { Order, Product } from '@/lib/types'
import { useLineContext } from '@/lib/line-context'

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [apiConnected, setApiConnected] = useState<boolean | null>(null)
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    lowStockProducts: [] as Product[],
    recentOrders: [] as Order[],
  })
  const { selectedLine } = useLineContext()

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setApiConnected(null)
      
      const [ordersRes, productsRes] = await Promise.all([
        apiClient.getOrders(1, 100),
        apiClient.getProducts(1, 100),
      ])

      setApiConnected(true)
      const lowStock = productsRes.data.filter((p) => p.stock < 10)
      const recentOrders = ordersRes.data.slice(0, 5)
      const totalRevenue = ordersRes.data.reduce((sum, order) => sum + order.total, 0)

      setStats({
        totalOrders: ordersRes.meta.total,
        totalRevenue,
        lowStockProducts: lowStock,
        recentOrders,
      })
    } catch (error) {
      setApiConnected(false)
      // Keep previous stats or defaults
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const orderColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => text.slice(0, 8) + '...',
    },
    {
      title: 'Cliente',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (text: string) => text || 'N/A',
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (amount: number) => `$${amount.toFixed(2)}`,
    },
    {
      title: 'Fecha',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('es-AR'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: Order) => (
        <Link href={`/orders/${record.id}`}>
          <Button type="link" size="small">
            Ver
          </Button>
        </Link>
      ),
    },
  ]

  const lowStockColumns = [
    {
      title: 'Producto',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock: number) => (
        <Tag color={stock < 5 ? 'red' : 'orange'}>{stock}</Tag>
      ),
    },
    {
      title: 'Categoría',
      dataIndex: ['category', 'name'],
      key: 'category',
      render: (text: string) => text || 'N/A',
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: '24px', color: '#ffffff' }}>
        Dashboard General
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : apiConnected === false ? (
        <Result
          icon={<ApiOutlined style={{ color: '#f97316' }} />}
          title="API no conectada"
          subTitle={
            <span style={{ color: '#9ca3af' }}>
              No se pudo conectar al backend. Asegurese de que el servidor este corriendo en{' '}
              <code style={{ color: '#22c55e', background: '#1f2937', padding: '2px 6px', borderRadius: '4px' }}>
                {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}
              </code>
            </span>
          }
          extra={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchDashboardData}
              style={{ background: '#22c55e', borderColor: '#22c55e' }}
            >
              Reintentar conexion
            </Button>
          }
          style={{ background: '#1f2937', borderRadius: '8px', padding: '40px' }}
        />
      ) : (
        <>
          {/* Statistics Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{ background: '#1f2937', borderColor: '#2d3748' }}
                variant="outlined"
              >
                <Statistic
                  title="Total de Ordenes"
                  value={stats.totalOrders}
                  prefix={<ShoppingCartOutlined style={{ color: '#22c55e' }} />}
                  valueStyle={{ color: '#22c55e' }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{ background: '#1f2937', borderColor: '#2d3748' }}
                variant="outlined"
              >
                <Statistic
                  title="Ingresos Totales"
                  value={stats.totalRevenue}
                  prefix="$"
                  precision={2}
                  valueStyle={{ color: '#22c55e' }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{ background: '#1f2937', borderColor: '#2d3748' }}
                variant="outlined"
              >
                <Statistic
                  title="Productos en Stock"
                  value={stats.lowStockProducts.length}
                  prefix={<AlertOutlined style={{ color: '#f97316' }} />}
                  valueStyle={{ color: '#f97316' }}
                  suffix="bajo"
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{ background: '#1f2937', borderColor: '#2d3748' }}
                variant="outlined"
              >
                <Statistic
                  title="Linea Seleccionada"
                  value={
                    selectedLine === 'MEAT'
                      ? 'Carnes'
                      : 'Cerveza'
                  }
                  valueStyle={{ color: '#22c55e', fontSize: '14px' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Recent Orders */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col span={24}>
              <Card
                title="Ordenes Recientes"
                style={{ background: '#1f2937', borderColor: '#2d3748' }}
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
                    style={{ backgroundColor: '#111111' }}
                  />
                ) : (
                  <Empty
                    description="No hay ordenes"
                    style={{ color: '#9ca3af' }}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* Low Stock Products */}
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card
                title="Productos con Stock Bajo"
                style={{ background: '#1f2937', borderColor: '#2d3748' }}
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
                    style={{ backgroundColor: '#111111' }}
                  />
                ) : (
                  <Empty
                    description="Todos los productos tienen stock suficiente"
                    style={{ color: '#9ca3af' }}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
