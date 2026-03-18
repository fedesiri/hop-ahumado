"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { LineProvider } from "@/lib/line-context";
import type { CreateUserRequest, HealthResponse, UpdateUserRequest, User } from "@/lib/types";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { App, Button, Card, Col, Empty, Form, Input, Modal, Row, Space, Spin, Statistic, Table } from "antd";
import { useEffect, useState } from "react";

export default function UsersPage() {
  return (
    <LineProvider>
      <AppLayout>
        <UsersContent />
      </AppLayout>
    </LineProvider>
  );
}

function UsersContent() {
  const { message, modal } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [apiHealthOk, setApiHealthOk] = useState(false);

  useEffect(() => {
    fetchUsers();
    checkApiHealth();
  }, [pagination.page, pagination.limit]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUsers(pagination.page, pagination.limit);
      setUsers(response.data);
      setMeta(response.meta);
    } catch (error) {
      message.error("Error al cargar usuarios");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const checkApiHealth = async () => {
    try {
      const health = await apiClient.checkHealth();
      setHealthStatus(health);
      setApiHealthOk(true);
    } catch (error) {
      setApiHealthOk(false);
      console.error("API Health check failed:", error);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: User) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      email: record.email,
    });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: "Confirmar eliminacion",
      content: "Estas seguro de que deseas eliminar este usuario?",
      okText: "Si",
      cancelText: "No",
      onOk: async () => {
        try {
          await apiClient.deleteUser(id);
          message.success("Usuario eliminado");
          fetchUsers();
        } catch (error) {
          message.error("Error al eliminar usuario");
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const data: CreateUserRequest = {
        name: values.name,
        email: values.email,
        password: values.password,
      };

      if (editingId) {
        // En edición no exigimos contraseña.
        await apiClient.updateUser(editingId, { name: values.name, email: values.email } as UpdateUserRequest);
        message.success("Usuario actualizado");
      } else {
        await apiClient.createUser(data);
        message.success("Usuario creado");
      }
      setModalOpen(false);
      fetchUsers();
    } catch (error) {
      message.error("Error al guardar usuario");
    }
  };

  const columns = [
    {
      title: "Nombre",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Fecha de Creación",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleDateString("es-AR"),
    },
    {
      title: "Acciones",
      key: "actions",
      width: 120,
      render: (_: any, record: User) => (
        <Space>
          <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, color: "#ffffff" }}>Usuarios</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nuevo Usuario
        </Button>
      </div>

      {/* API Health Status Card */}
      <Card
        style={{
          marginBottom: "24px",
          background: "#1f2937",
          borderColor: apiHealthOk ? "#22c55e" : "#ef4444",
          borderLeft: `4px solid ${apiHealthOk ? "#22c55e" : "#ef4444"}`,
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title="Estado de la API"
              value={apiHealthOk ? "En línea" : "Fuera de línea"}
              prefix={
                apiHealthOk ? (
                  <CheckCircleOutlined style={{ color: "#22c55e" }} />
                ) : (
                  <CloseCircleOutlined style={{ color: "#ef4444" }} />
                )
              }
              valueStyle={{
                color: apiHealthOk ? "#22c55e" : "#ef4444",
              }}
            />
          </Col>
          <Col span={12}>
            <Statistic title="Total de Usuarios" value={meta?.total || 0} valueStyle={{ color: "#22c55e" }} />
          </Col>
        </Row>
        {healthStatus && (
          <div style={{ marginTop: "12px", color: "#9ca3af", fontSize: "12px" }}>Status: {healthStatus.status}</div>
        )}
      </Card>

      {loading ? (
        <Spin />
      ) : users.length > 0 ? (
        <Table
          columns={columns}
          dataSource={users}
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
        <Empty description="No hay usuarios" style={{ color: "#9ca3af" }} />
      )}

      <Modal
        title={editingId ? "Editar Usuario" : "Nuevo Usuario"}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: "El nombre es requerido" }]}>
            <Input placeholder="Nombre del usuario" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "El email es requerido" },
              { type: "email", message: "Ingresa un email válido" },
            ]}
          >
            <Input type="email" placeholder="Email" />
          </Form.Item>

          {!editingId && (
            <Form.Item
              name="password"
              label="Contraseña (Firebase)"
              rules={[
                { required: true, message: "La contraseña es requerida" },
                { min: 6, message: "La contraseña debe tener al menos 6 caracteres" },
              ]}
            >
              <Input.Password placeholder="••••••••" autoComplete="new-password" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
