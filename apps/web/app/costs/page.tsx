"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import type { Cost, CreateCostRequest, Product, UpdateCostRequest } from "@/lib/types";
import { DeleteOutlined, EditOutlined, PlusOutlined, SwapOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

export default function CostsPage() {
  return (
    <LineProvider>
      <AppLayout>
        <CostsContent />
      </AppLayout>
    </LineProvider>
  );
}

function CostsContent() {
  const { message, modal } = App.useApp();
  const [costs, setCosts] = useState<Cost[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<Cost | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [replaceForm] = Form.useForm();
  const [bulkReplaceModalOpen, setBulkReplaceModalOpen] = useState(false);
  const [bulkReplaceForm] = Form.useForm();
  const [bulkPreviewRows, setBulkPreviewRows] = useState<Cost[] | null>(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [selectedCostIds, setSelectedCostIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [showActive, setShowActive] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText.trim()), 350);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    setPagination((p) => (p.page === 1 ? p : { ...p, page: 1 }));
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCosts();
    fetchProducts();
  }, [pagination.page, pagination.limit, showActive, debouncedSearch]);

  useEffect(() => {
    setSelectedCostIds([]);
  }, [showActive]);

  const fetchCosts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCosts(
        pagination.page,
        pagination.limit,
        undefined,
        showActive,
        debouncedSearch || undefined,
      );
      setCosts(response.data);
      setMeta(response.meta);
    } catch (error) {
      message.error("Error al cargar costos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await apiClient.getProducts(1, 100);
      setProducts(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Cost) => {
    setEditingId(record.id);
    form.setFieldsValue({
      productId: record.productId,
      value: record.value,
    });
    setModalOpen(true);
  };

  const openReplaceCost = (record: Cost) => {
    setReplaceTarget(record);
    replaceForm.resetFields();
    setReplaceModalOpen(true);
  };

  const bulkSelectionSummary = useMemo(() => {
    const selectedOnPage = costs.filter((c) => selectedCostIds.includes(c.id));
    const rowCount = selectedCostIds.length;
    const someSelectionOffPage = rowCount > 0 && selectedOnPage.length < rowCount;
    return { rowCount, someSelectionOffPage };
  }, [costs, selectedCostIds]);

  const bulkPreviewColumns: ColumnsType<Cost> = useMemo(
    () => [
      {
        title: "Producto",
        key: "product",
        ellipsis: true,
        render: (_: unknown, row: Cost) => row.product?.name ?? "—",
      },
      {
        title: "Costo actual (unidad)",
        dataIndex: "value",
        key: "value",
        width: 168,
        align: "right",
        render: (v: number | string) => formatCurrency(v),
      },
    ],
    [],
  );

  const openBulkReplace = async () => {
    if (selectedCostIds.length === 0) return;
    bulkReplaceForm.resetFields();
    setBulkPreviewRows(null);
    setBulkReplaceModalOpen(true);
    setBulkPreviewLoading(true);
    const orderedUniqueIds = [...new Set(selectedCostIds)];
    try {
      const rows = await Promise.all(orderedUniqueIds.map((id) => apiClient.getCost(id)));
      setBulkPreviewRows(rows);
    } catch {
      message.error("No se pudo cargar el detalle de los costos");
      setBulkReplaceModalOpen(false);
      setBulkPreviewRows(null);
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const handleBulkReplaceSubmit = async (values: { value: number }) => {
    if (selectedCostIds.length === 0) return;
    try {
      const res = await apiClient.bulkReplaceCosts({
        costIds: selectedCostIds,
        value: values.value,
      });
      message.success(
        `Listo: ${res.count} producto${res.count === 1 ? "" : "s"} con nuevo costo; los anteriores quedaron archivados.`,
      );
      setBulkReplaceModalOpen(false);
      setBulkPreviewRows(null);
      setSelectedCostIds([]);
      bulkReplaceForm.resetFields();
      fetchCosts();
    } catch {
      message.error("Error al actualizar costos");
    }
  };

  const handleReplaceSubmit = async (values: { value: number }) => {
    if (!replaceTarget) return;
    try {
      await apiClient.replaceCost(replaceTarget.id, { value: values.value });
      message.success("Costo actualizado: el anterior quedó archivado.");
      setReplaceModalOpen(false);
      setReplaceTarget(null);
      fetchCosts();
    } catch {
      message.error("Error al actualizar costo");
    }
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: "Confirmar eliminacion",
      content: "Estas seguro de que deseas eliminar este costo?",
      okText: "Si",
      cancelText: "No",
      onOk: async () => {
        try {
          await apiClient.deleteCost(id);
          message.success("Costo eliminado");
          fetchCosts();
        } catch (error) {
          message.error("Error al eliminar costo");
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const data: CreateCostRequest = {
        productId: values.productId,
        value: values.value,
      };

      if (editingId) {
        await apiClient.updateCost(editingId, data as UpdateCostRequest);
        message.success("Costo actualizado");
      } else {
        await apiClient.createCost(data);
        message.success("Costo creado");
      }
      setModalOpen(false);
      fetchCosts();
    } catch (error) {
      message.error("Error al guardar costo");
    }
  };

  const columns = [
    {
      title: "Producto",
      dataIndex: ["product", "name"],
      key: "product",
      render: (text: string) => text || "-",
    },
    {
      title: "Costo",
      dataIndex: "value",
      key: "value",
      render: (value: number | string) => formatCurrency(value),
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
      width: showActive ? 168 : 120,
      render: (_: any, record: Cost) => (
        <Space size="small" wrap>
          {showActive && !record.deactivatedAt && (
            <Tooltip title="Archiva este costo y crea uno nuevo (misma acción que eliminar + crear)">
              <Button
                type="default"
                size="small"
                icon={<SwapOutlined />}
                onClick={() => openReplaceCost(record)}
              />
            </Tooltip>
          )}
          <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <h1 style={{ margin: 0, color: "#ffffff" }}>Costos</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
          <Input.Search
            allowClear
            placeholder="Buscar por nombre, SKU o código de barras"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ maxWidth: 420, width: "100%", minWidth: 200 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Nuevo Costo
          </Button>
        </div>
      </div>

      {showActive && bulkSelectionSummary.rowCount > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(59, 130, 246, 0.35)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ color: "#e5e7eb" }}>
            <strong>{bulkSelectionSummary.rowCount}</strong> costo(s) seleccionado(s)
            {bulkSelectionSummary.someSelectionOffPage && (
              <span style={{ color: "#9ca3af" }}> (incluye otras páginas)</span>
            )}
            .
          </span>
          <Button type="primary" icon={<SwapOutlined />} onClick={openBulkReplace}>
            Mismo nuevo costo para todos
          </Button>
        </div>
      )}

      {loading ? (
        <Spin />
      ) : costs.length > 0 ? (
        <Table
          columns={columns}
          dataSource={costs}
          rowKey="id"
          style={{ backgroundColor: "#1f2937" }}
          rowSelection={
            showActive
              ? {
                  selectedRowKeys: selectedCostIds,
                  onChange: (keys) => setSelectedCostIds(keys as string[]),
                  preserveSelectedRowKeys: true,
                  getCheckboxProps: (record) => ({
                    disabled: !!record.deactivatedAt,
                  }),
                }
              : undefined
          }
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
        <Empty description="No hay costos" style={{ color: "#9ca3af" }} />
      )}

      <Modal
        title={editingId ? "Editar Costo" : "Nuevo Costo"}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="productId"
            label="Producto"
            rules={[{ required: true, message: "El producto es requerido" }]}
          >
            <Select
              placeholder="Selecciona un producto"
              options={products.map((p) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>

          <Form.Item name="value" label="Costo" rules={[{ required: true, message: "El costo es requerido" }]}>
            <InputNumber min={0} step={0.01} placeholder="Costo del producto" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Nuevo costo (archivar el actual)"
        open={replaceModalOpen}
        onOk={() => replaceForm.submit()}
        onCancel={() => {
          setReplaceModalOpen(false);
          setReplaceTarget(null);
        }}
        forceRender
      >
        {replaceTarget && (
          <>
            <Typography.Paragraph style={{ marginBottom: 12, color: "rgba(255,255,255,0.75)" }}>
              <strong>{replaceTarget.product?.name ?? "Producto"}</strong>
              {" — costo vigente "}
              {formatCurrency(replaceTarget.value)} (solo referencia).
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
              El costo vigente pasará al historial (archivado) y este valor será el único activo para el producto.
            </Typography.Paragraph>
          </>
        )}
        <Form form={replaceForm} layout="vertical" onFinish={handleReplaceSubmit}>
          <Form.Item
            name="value"
            label="Nuevo costo por unidad"
            rules={[{ required: true, message: "Ingresá el nuevo costo" }]}
          >
            <InputNumber min={0} step={0.01} precision={4} placeholder="Ej. 1520.50" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Mismo nuevo costo para varios productos"
        open={bulkReplaceModalOpen}
        onOk={() => bulkReplaceForm.submit()}
        onCancel={() => {
          setBulkReplaceModalOpen(false);
          setBulkPreviewRows(null);
        }}
        okButtonProps={{
          disabled: bulkPreviewLoading || !bulkPreviewRows?.length,
        }}
        forceRender
        width={720}
      >
        <Typography.Paragraph style={{ marginBottom: 8, color: "rgba(255,255,255,0.85)" }}>
          Se archivan los costos vigentes de cada fila elegida y se crea{" "}
          <strong>un costo activo nuevo por producto</strong>, todos con el{" "}
          <strong>mismo valor por unidad</strong> que ingreses abajo.
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 14 }}>
          Revisá el costo actual de cada ítem; al confirmar, todos pasan al mismo precio nuevo.
        </Typography.Paragraph>
        <div style={{ marginBottom: 16 }}>
          {bulkPreviewLoading ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <Spin />
            </div>
          ) : bulkPreviewRows && bulkPreviewRows.length > 0 ? (
            <Table<Cost>
              size="small"
              rowKey="id"
              columns={bulkPreviewColumns}
              dataSource={bulkPreviewRows}
              pagination={false}
              scroll={{ y: 280 }}
              locale={{ emptyText: <Empty description="Sin filas" /> }}
              style={{ backgroundColor: "#1f2937" }}
            />
          ) : null}
        </div>
        <Form form={bulkReplaceForm} layout="vertical" onFinish={handleBulkReplaceSubmit}>
          <Form.Item
            name="value"
            label="Nuevo costo por unidad (aplica a todos los listados arriba)"
            rules={[{ required: true, message: "Ingresá el nuevo costo" }]}
          >
            <InputNumber min={0} step={0.01} precision={4} placeholder="Ej. 1520.50" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
