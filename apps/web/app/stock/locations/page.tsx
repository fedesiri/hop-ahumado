"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatQuantity } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { StockBalanceRow, StockLocation } from "@/lib/types";
import { ProductUnit } from "@/lib/types";
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, SwapOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
} from "antd";
import { useCallback, useEffect, useState } from "react";

const UNIT_SHORT_LABEL: Record<ProductUnit, string> = {
  [ProductUnit.UNIT]: "un",
  [ProductUnit.KG]: "kg",
  [ProductUnit.G]: "gr",
  [ProductUnit.L]: "l",
  [ProductUnit.ML]: "ml",
};

export default function StockLocationsPage() {
  return (
    <LineProvider>
      <AppLayout>
        <StockLocationsContent />
      </AppLayout>
    </LineProvider>
  );
}

function StockLocationsContent() {
  const { message } = App.useApp();
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StockLocation | null>(null);
  const [viewingLocation, setViewingLocation] = useState<StockLocation | null>(null);
  const [viewBalances, setViewBalances] = useState<StockBalanceRow[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferFromLocation, setTransferFromLocation] = useState<StockLocation | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLocations(await apiClient.getStockLocations());
    } catch {
      message.error("Error al cargar ubicaciones");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  const openView = async (loc: StockLocation) => {
    setViewingLocation(loc);
    setViewModalOpen(true);
    setViewLoading(true);
    setViewBalances([]);
    try {
      const rows = await apiClient.getStockBalancesAtLocation(loc.id);
      setViewBalances(rows);
    } catch {
      message.error("No se pudo cargar el stock de la ubicación");
      setViewBalances([]);
    } finally {
      setViewLoading(false);
    }
  };

  const openEdit = (loc: StockLocation) => {
    setEditingLocation(loc);
    editForm.setFieldsValue({ name: loc.name, isDefault: loc.isDefault });
    setEditModalOpen(true);
  };

  const handleCreate = async (values: { name: string; isDefault?: boolean }) => {
    setSubmitting(true);
    try {
      await apiClient.createStockLocation({
        name: values.name.trim(),
        isDefault: values.isDefault === true,
      });
      message.success("Ubicación creada");
      setCreateModalOpen(false);
      createForm.resetFields();
      await load();
    } catch {
      message.error("No se pudo crear la ubicación");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (values: { name: string; isDefault?: boolean }) => {
    if (!editingLocation) return;
    setSubmitting(true);
    try {
      await apiClient.updateStockLocation(editingLocation.id, {
        name: values.name.trim(),
        isDefault: values.isDefault === true,
      });
      message.success("Ubicación actualizada");
      setEditModalOpen(false);
      setEditingLocation(null);
      editForm.resetFields();
      await load();
    } catch {
      message.error("No se pudo actualizar la ubicación");
    } finally {
      setSubmitting(false);
    }
  };

  const openTransferAll = (loc: StockLocation) => {
    setTransferFromLocation(loc);
    transferForm.resetFields();
    setTransferModalOpen(true);
  };

  const handleTransferAll = async (values: { toLocationId: string }) => {
    if (!transferFromLocation) return;
    setSubmitting(true);
    try {
      const res = await apiClient.transferAllStockBetweenLocations(transferFromLocation.id, {
        toLocationId: values.toLocationId,
      });
      if (res.movementsCreated === 0) {
        message.info(res.message ?? "No había stock para mover en el origen");
      } else {
        message.success(`Traspasados ${res.movementsCreated} productos (movimientos registrados)`);
      }
      setTransferModalOpen(false);
      setTransferFromLocation(null);
      transferForm.resetFields();
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      message.error(msg || "No se pudo completar el traspaso");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (loc: StockLocation) => {
    try {
      await apiClient.deleteStockLocation(loc.id);
      message.success("Ubicación eliminada");
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      message.error(msg || "No se pudo eliminar la ubicación");
    }
  };

  const nonzeroBalances = viewBalances.filter((r) => Math.abs(Number(r.quantity)) > 1e-6);

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, color: "#ffffff" }}>Ubicaciones de stock</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          Nueva ubicación
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message=""
        description={
          <div style={{ lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 8px 0" }}>
              Cada ubicación es un depósito o lugar donde tenés inventario (local, tu casa, casa de un socio). Los
              movimientos y los pedidos eligen desde cuál se descuenta o hacia cuál ingresa.
            </p>
            <p style={{ margin: "0 0 8px 0" }}>
              Usá la <strong>misma unidad</strong> de cantidad que definiste al cargar el producto (enteros o decimales,
              ej. 10,5 kg).
            </p>
            <p style={{ margin: 0 }}>
              Podés <strong>traspasar todo el stock</strong> para consolidar depósitos. Solo podés eliminar una
              ubicación si no tiene stock.
            </p>
          </div>
        }
      />

      {loading ? (
        <Spin />
      ) : (
        <Table
          rowKey="id"
          dataSource={locations}
          pagination={false}
          style={{ backgroundColor: "#1f2937" }}
          columns={[
            { title: "Nombre", dataIndex: "name", key: "name" },
            {
              title: "Predeterminada",
              dataIndex: "isDefault",
              key: "isDefault",
              render: (v: boolean) => (v ? <Tag color="green">Sí</Tag> : <Tag>No</Tag>),
            },
            {
              title: "Alta",
              dataIndex: "createdAt",
              key: "createdAt",
              render: (d: string) => new Date(d).toLocaleDateString("es-AR"),
            },
            {
              title: "Acciones",
              key: "actions",
              width: 146,
              render: (_: unknown, record: StockLocation) => (
                <Space size={4}>
                  <Tooltip title="Ver stock">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => openView(record)}
                      aria-label="Ver stock"
                    />
                  </Tooltip>
                  <Tooltip title="Editar">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(record)}
                      aria-label="Editar"
                    />
                  </Tooltip>
                  <Tooltip title="Traspasar todo el stock">
                    <Button
                      type="text"
                      size="small"
                      icon={<SwapOutlined />}
                      onClick={() => openTransferAll(record)}
                      disabled={locations.length < 2}
                      aria-label="Traspasar todo el stock"
                    />
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <span>
                      <Popconfirm
                        title="¿Eliminar esta ubicación?"
                        description="Solo se puede si no hay stock. Los movimientos y pedidos viejos quedarán sin ubicación asociada."
                        onConfirm={() => handleDelete(record)}
                        okText="Sí, eliminar"
                        cancelText="Cancelar"
                        okButtonProps={{ danger: true }}
                      >
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Eliminar" />
                      </Popconfirm>
                    </span>
                  </Tooltip>
                </Space>
              ),
            },
          ]}
        />
      )}

      <Modal
        title={transferFromLocation ? `Traspasar todo desde «${transferFromLocation.name}»` : "Traspasar stock"}
        open={transferModalOpen}
        onCancel={() => {
          setTransferModalOpen(false);
          setTransferFromLocation(null);
          transferForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <p style={{ color: "#9ca3af", marginBottom: 16 }}>
          Se mueven todas las cantidades distintas de cero del origen al destino. El total por producto no cambia; queda
          registro en movimientos de stock (traslado).
        </p>
        <Form form={transferForm} layout="vertical" onFinish={handleTransferAll}>
          <Form.Item
            name="toLocationId"
            label="Ubicación destino"
            rules={[{ required: true, message: "Elegí el destino" }]}
          >
            <Select
              placeholder="Destino"
              options={locations
                .filter((l) => l.id !== transferFromLocation?.id)
                .map((l) => ({
                  label: l.isDefault ? `${l.name} (predeterminada)` : l.name,
                  value: l.id,
                }))}
            />
          </Form.Item>
          <Space>
            <Button
              onClick={() => {
                setTransferModalOpen(false);
                setTransferFromLocation(null);
                transferForm.resetFields();
              }}
            >
              Cancelar
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Traspasar todo
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="Nueva ubicación"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: "Ingresá un nombre" }]}>
            <Input placeholder="Ej. Local, Casa Centro, Depósito Norte" />
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked">
            <Checkbox>Marcar como ubicación predeterminada</Checkbox>
          </Form.Item>
          <Space>
            <Button onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Guardar
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingLocation ? `Editar: ${editingLocation.name}` : "Editar ubicación"}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingLocation(null);
          editForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: "Ingresá un nombre" }]}>
            <Input placeholder="Nombre" />
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked">
            <Checkbox>Ubicación predeterminada</Checkbox>
          </Form.Item>
          <Space>
            <Button
              onClick={() => {
                setEditModalOpen(false);
                setEditingLocation(null);
                editForm.resetFields();
              }}
            >
              Cancelar
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Guardar cambios
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={viewingLocation ? `Stock en «${viewingLocation.name}»` : "Stock por ubicación"}
        open={viewModalOpen}
        onCancel={() => {
          setViewModalOpen(false);
          setViewingLocation(null);
          setViewBalances([]);
        }}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setViewModalOpen(false);
              setViewingLocation(null);
              setViewBalances([]);
            }}
          >
            Cerrar
          </Button>,
        ]}
        width={720}
      >
        {viewLoading ? (
          <Spin />
        ) : nonzeroBalances.length === 0 ? (
          <Empty description="No hay stock en esta ubicación (cantidades en cero o sin registros)" />
        ) : (
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={nonzeroBalances}
            columns={[
              {
                title: "Producto",
                key: "product",
                render: (_: unknown, row: StockBalanceRow) => row.product?.name ?? row.productId,
              },
              {
                title: "Cantidad",
                key: "qty",
                align: "right" as const,
                render: (_: unknown, row: StockBalanceRow) => {
                  const u = row.product?.unit ?? ProductUnit.UNIT;
                  return (
                    <span>
                      {formatQuantity(row.quantity)} {UNIT_SHORT_LABEL[u] ?? ""}
                    </span>
                  );
                },
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
