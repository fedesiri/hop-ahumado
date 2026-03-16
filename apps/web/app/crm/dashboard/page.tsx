"use client";

import { apiClient } from "@/lib/api-client";
import type { CrmDashboardResponse } from "@/lib/types";
import { formatStatusLabel } from "@/lib/utils";
import { MessageOutlined, RiseOutlined, UserOutlined } from "@ant-design/icons";
import { Card, Col, Row, Spin, Statistic, Table } from "antd";
import { useEffect, useState } from "react";

export default function CrmDashboardPage() {
  const [data, setData] = useState<CrmDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getCrmDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) return null;

  const statusColumns = [
    { title: "Estado", dataIndex: "status", key: "status", render: (v: string | null) => formatStatusLabel(v) || "—" },
    { title: "Cantidad", dataIndex: "count", key: "count" },
  ];

  return (
    <div style={{ padding: 0 }}>
      <h1 style={{ marginBottom: 24, color: "#fafafa", fontSize: 24 }}>CRM - Dashboard</h1>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Contactos (perfiles)" value={data.profileCount} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Interacciones" value={data.interactionCount} prefix={<MessageOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Oportunidades" value={data.opportunityCount} prefix={<RiseOutlined />} />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="Por estado">
            <Table rowKey="status" dataSource={data.byStatus} columns={statusColumns} pagination={false} size="small" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
