"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { CreateExpenseRequest, Expense } from "@/lib/types";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, InputNumber, Modal, Space, Spin, Table } from "antd";
import { useEffect, useMemo, useState } from "react";

type ExpenseGroup = {
  groupId: string;
  description: string;
  createdAt: string;
  cashAmount: number;
  cardAmount: number;
};

export default function ExpensesPage() {
  return (
    <LineProvider>
      <AppLayout>
        <ExpensesContent />
      </AppLayout>
    </LineProvider>
  );
}

function ExpensesContent() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const groups: ExpenseGroup[] = useMemo(() => {
    const byGroup = new Map<
      string,
      { description: string; createdAt: string; cashAmount: number; cardAmount: number }
    >();

    for (const e of expenses) {
      const group = byGroup.get(e.groupId) ?? {
        description: e.description ?? "Egreso",
        createdAt: e.createdAt,
        cashAmount: 0,
        cardAmount: 0,
      };

      if (e.method === "CASH") group.cashAmount += Number(e.amount ?? 0);
      if (e.method === "CARD") group.cardAmount += Number(e.amount ?? 0);

      // Mantener la descripción/fecha del primer registro del grupo
      byGroup.set(e.groupId, group);
    }

    return [...byGroup.entries()].map(([groupId, v]) => ({
      groupId,
      description: v.description,
      createdAt: v.createdAt,
      cashAmount: v.cashAmount,
      cardAmount: v.cardAmount,
    }));
  }, [expenses]);

  const fetchAllExpenses = async () => {
    const limit = 100; // máximo permitido por la API
    let page = 1;
    let res = await apiClient.getExpenses(page, limit);
    const all: Expense[] = [...res.data];

    while (res.meta.totalPages > page) {
      page += 1;
      res = await apiClient.getExpenses(page, limit);
      all.push(...res.data);
    }

    setExpenses(all);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await fetchAllExpenses();
      } catch (error) {
        console.error(error);
        message.error("Error al cargar egresos");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const data: CreateExpenseRequest = {
        description: values.description ?? undefined,
        cashAmount: values.cashAmount ?? 0,
        cardAmount: values.cardAmount ?? 0,
      };

      if ((data.cashAmount ?? 0) <= 0 && (data.cardAmount ?? 0) <= 0) {
        message.error("Debe ingresar un monto mayor a 0");
        return;
      }

      await apiClient.createExpense(data);
      message.success("Egreso registrado");
      setModalOpen(false);
      await fetchAllExpenses();
    } catch (error) {
      console.error(error);
      message.error("Error al registrar egreso");
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    modal.confirm({
      title: "Confirmar eliminación",
      content: "¿Eliminar este egreso? (se borrarán también sus splits en efectivo y transferencia)",
      okText: "Eliminar",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await apiClient.deleteExpenseGroup(groupId);
          message.success("Egreso eliminado");
          await fetchAllExpenses();
        } catch (error) {
          console.error(error);
          message.error("Error al eliminar egreso");
        }
      },
    });
  };

  const columns = [
    {
      title: "Descripción",
      dataIndex: "description",
      key: "description",
      render: (v: string) => v || "-",
    },
    {
      title: "Fecha",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleDateString("es-AR"),
    },
    {
      title: "Efectivo",
      dataIndex: "cashAmount",
      key: "cashAmount",
      render: (v: number) => formatCurrency(v),
    },
    {
      title: "Transferencia",
      dataIndex: "cardAmount",
      key: "cardAmount",
      render: (v: number) => formatCurrency(v),
    },
    {
      title: "Total",
      key: "total",
      render: (_: unknown, record: ExpenseGroup) => formatCurrency(record.cashAmount + record.cardAmount),
    },
    {
      title: "Acciones",
      key: "actions",
      width: 120,
      render: (_: unknown, record: ExpenseGroup) => (
        <Space>
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteGroup(record.groupId)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, color: "#ffffff" }}>Egresos</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Nuevo egreso
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : groups.length > 0 ? (
        <Table
          columns={columns}
          dataSource={groups}
          rowKey="groupId"
          style={{ backgroundColor: "#1f2937" }}
          pagination={false}
        />
      ) : (
        <div>
          <p style={{ color: "#9ca3af" }}>No hay egresos.</p>
        </div>
      )}

      <Modal title="Nuevo egreso" open={modalOpen} onOk={() => form.submit()} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="description" label="Descripción">
            <Input placeholder="Ej. Productos - pallet / Transporte" />
          </Form.Item>

          <Form.Item name="cashAmount" label="Efectivo" rules={[{ required: false }]}>
            <InputNumber min={0} step={0.01} placeholder="0" />
          </Form.Item>

          <Form.Item name="cardAmount" label="Transferencia" rules={[{ required: false }]}>
            <InputNumber min={0} step={0.01} placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
