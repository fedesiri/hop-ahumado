"use client";

import { AppLayout } from "@/components/app-layout";
import { ScreenInfoPanel } from "@/components/screen-info-panel";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import { LineProvider } from "@/lib/line-context";
import { PRICE_TYPE_LABELS, PRICE_TYPES, type PriceType } from "@/lib/order-calculator/price-types";
import type { CreatePriceRequest, Price, Product, UpdatePriceRequest } from "@/lib/types";
import { DeleteOutlined, EditOutlined, PlusOutlined, SwapOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  App,
  AutoComplete,
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
import { useEffect, useMemo, useState } from "react";

function formatPriceListLabel(text: string | null | undefined): string {
  if (!text?.trim()) return "—";
  const t = text.trim().toLowerCase();
  if (PRICE_TYPES.includes(t as PriceType)) return PRICE_TYPE_LABELS[t as PriceType];
  return text.trim();
}

export default function PricesPage() {
  return (
    <LineProvider>
      <AppLayout>
        <PricesContent />
      </AppLayout>
    </LineProvider>
  );
}

function PricesContent() {
  const { message, modal } = App.useApp();
  const [prices, setPrices] = useState<Price[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<Price | null>(null);
  const [bulkReplaceModalOpen, setBulkReplaceModalOpen] = useState(false);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<Price[] | null>(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [selectedPriceIds, setSelectedPriceIds] = useState<string[]>([]);

  const [form] = Form.useForm();
  const [replaceForm] = Form.useForm();
  const [bulkReplaceForm] = Form.useForm();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  /** Solo precios activos; alineado con la grilla de Costos (sin toggle en UI por ahora). */
  const showActive = true;
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listTypeFilter, setListTypeFilter] = useState<"" | PriceType>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText.trim()), 350);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    setPagination((p) => (p.page === 1 ? p : { ...p, page: 1 }));
  }, [debouncedSearch]);

  useEffect(() => {
    setPagination((p) => (p.page === 1 ? p : { ...p, page: 1 }));
  }, [listTypeFilter]);

  useEffect(() => {
    fetchPrices();
    fetchProducts();
  }, [pagination.page, pagination.limit, debouncedSearch, listTypeFilter]);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPrices(
        pagination.page,
        pagination.limit,
        undefined,
        true,
        debouncedSearch || undefined,
        listTypeFilter ? listTypeFilter : undefined,
      );
      setPrices(response.data);
      setMeta(response.meta);
    } catch (error) {
      message.error("Error al cargar precios");
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

  const bulkSelectionSummary = useMemo(() => {
    const selectedOnPage = prices.filter((p) => selectedPriceIds.includes(p.id));
    const rowCount = selectedPriceIds.length;
    const someSelectionOffPage = rowCount > 0 && selectedOnPage.length < rowCount;
    return { rowCount, someSelectionOffPage };
  }, [prices, selectedPriceIds]);

  const bulkPreviewColumns: ColumnsType<Price> = useMemo(
    () => [
      {
        title: "Producto",
        key: "product",
        ellipsis: true,
        render: (_: unknown, row: Price) => row.product?.name ?? "—",
      },
      {
        title: "Lista",
        dataIndex: "description",
        key: "description",
        width: 160,
        ellipsis: true,
        render: (text: string | null) => formatPriceListLabel(text),
      },
      {
        title: "Precio actual",
        dataIndex: "value",
        key: "value",
        width: 148,
        align: "right",
        render: (v: number | string) => formatCurrency(v),
      },
    ],
    [],
  );

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Price) => {
    setEditingId(record.id);
    form.setFieldsValue({
      productId: record.productId,
      value: record.value,
      description: record.description,
    });
    setModalOpen(true);
  };

  const openReplacePrice = (record: Price) => {
    setReplaceTarget(record);
    replaceForm.resetFields();
    setReplaceModalOpen(true);
  };

  const handleReplaceSubmit = async (values: { value: number }) => {
    if (!replaceTarget) return;
    try {
      await apiClient.replacePrice(replaceTarget.id, { value: values.value });
      message.success("Precio actualizado: el anterior quedó archivado.");
      setReplaceModalOpen(false);
      setReplaceTarget(null);
      fetchPrices();
    } catch {
      message.error("Error al actualizar precio");
    }
  };

  const openBulkReplace = async () => {
    if (selectedPriceIds.length === 0) return;
    bulkReplaceForm.resetFields();
    setBulkPreviewRows(null);
    setBulkReplaceModalOpen(true);
    setBulkPreviewLoading(true);
    const orderedUniqueIds = [...new Set(selectedPriceIds)];
    try {
      const rows = await Promise.all(orderedUniqueIds.map((id) => apiClient.getPrice(id)));
      setBulkPreviewRows(rows);
    } catch {
      message.error("No se pudo cargar el detalle de los precios");
      setBulkReplaceModalOpen(false);
      setBulkPreviewRows(null);
    } finally {
      setBulkPreviewLoading(false);
    }
  };

  const handleBulkReplaceSubmit = async (values: { value: number }) => {
    if (selectedPriceIds.length === 0) return;
    try {
      const res = await apiClient.bulkReplacePrices({
        priceIds: selectedPriceIds,
        value: values.value,
      });
      message.success(
        `Listo: ${res.count} producto(s)/lista(s) con nuevo precio; los anteriores quedaron archivados.`,
      );
      setBulkReplaceModalOpen(false);
      setBulkPreviewRows(null);
      setSelectedPriceIds([]);
      bulkReplaceForm.resetFields();
      fetchPrices();
    } catch {
      message.error("Error al actualizar precios");
    }
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: "Confirmar eliminacion",
      content: "Estas seguro de que deseas eliminar este precio?",
      okText: "Si",
      cancelText: "No",
      onOk: async () => {
        try {
          await apiClient.deletePrice(id);
          message.success("Precio eliminado");
          fetchPrices();
        } catch (error) {
          message.error("Error al eliminar precio");
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const data: CreatePriceRequest = {
        productId: values.productId,
        value: values.value,
        description: values.description,
      };

      if (editingId) {
        await apiClient.updatePrice(editingId, data as UpdatePriceRequest);
        message.success("Precio actualizado");
      } else {
        await apiClient.createPrice(data);
        message.success("Precio creado");
      }
      setModalOpen(false);
      fetchPrices();
    } catch (error) {
      message.error("Error al guardar precio");
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
      title: "Valor",
      dataIndex: "value",
      key: "value",
      render: (value: number | string) => formatCurrency(value),
    },
    {
      title: "Lista / descripción",
      dataIndex: "description",
      key: "description",
      render: (text: string | null) => formatPriceListLabel(text),
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
      width: showActive ? 188 : 120,
      render: (_: unknown, record: Price) => (
        <Space size="small" wrap>
          {showActive && !record.deactivatedAt && (
            <Tooltip title="Archiva este precio y crea uno nuevo (misma lista: mayorista/minorista/fábrica)">
              <Button type="default" size="small" icon={<SwapOutlined />} onClick={() => openReplacePrice(record)} />
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
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, color: "#ffffff" }}>Precios</h1>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            flex: 1,
            justifyContent: "flex-end",
            minWidth: 0,
          }}
        >
          <Input.Search
            allowClear
            placeholder="Buscar por nombre, SKU o código de barras"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ maxWidth: 420, width: "100%", minWidth: 200 }}
          />
          <Select
            allowClear
            placeholder="Lista de precio"
            value={listTypeFilter === "" ? undefined : listTypeFilter}
            onChange={(v) => setListTypeFilter((v ?? "") as "" | PriceType)}
            style={{ minWidth: 200 }}
            options={PRICE_TYPES.map((t) => ({
              value: t,
              label: PRICE_TYPE_LABELS[t],
            }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Nuevo Precio
          </Button>
        </div>
      </div>

      <ScreenInfoPanel title="Tres listas para todos los productos">
        <>
          Podés cargar <strong>mayorista</strong>, <strong>minorista</strong> y <strong>fábrica</strong> para{" "}
          <strong>cualquier</strong> producto (cerveza, pan, lo que sea): son tres registros de precio distintos con la
          misma descripción de lista. En <strong>Nueva orden</strong> el selector usa esas etiquetas para elegir qué
          valor aplicar. Si dejás otra descripción libre, el precio se guarda pero la calculadora puede no reconocerla
          como lista estándar. Podés <strong>seleccionar varias filas</strong> y aplicar un{" "}
          <strong>mismo valor nuevo</strong>: cada fila conserva su lista (mayorista/minorista/fábrica); si varios
          productos comparten el mismo aumento en la misma lista, marcá todas y usá{" "}
          <strong>Mismo nuevo precio para todos</strong>.
        </>
      </ScreenInfoPanel>

      {showActive && bulkSelectionSummary.rowCount > 0 && (
        <div
          style={{
            marginBottom: 16,
            marginTop: 16,
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
            <strong>{bulkSelectionSummary.rowCount}</strong> precio(s) seleccionado(s)
            {bulkSelectionSummary.someSelectionOffPage && (
              <span style={{ color: "#9ca3af" }}> (incluye otras páginas)</span>
            )}
            .
          </span>
          <Button type="primary" icon={<SwapOutlined />} onClick={openBulkReplace}>
            Mismo nuevo precio para todos
          </Button>
        </div>
      )}

      <Table
        columns={columns}
        dataSource={prices}
        rowKey="id"
        loading={loading}
        style={{ backgroundColor: "#1f2937" }}
        rowSelection={
          showActive
            ? {
                selectedRowKeys: selectedPriceIds,
                onChange: (keys) => setSelectedPriceIds(keys as string[]),
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
          total: meta?.total ?? 0,
          onChange: (page, pageSize) => {
            setPagination({ page, limit: pageSize });
          },
        }}
        locale={{
          emptyText: <Empty description="No hay precios cargados todavía" style={{ color: "#9ca3af" }} />,
        }}
      />

      <Modal
        title={editingId ? "Editar Precio" : "Nuevo Precio"}
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

          <Form.Item name="value" label="Valor" rules={[{ required: true, message: "El valor es requerido" }]}>
            <InputNumber min={0} step={0.01} placeholder="Valor del producto" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="description"
            label="Lista de precio"
            extra="Usá mayorista, minorista o fabrica (minúsculas) para que coincida con el selector de Nueva orden. Podés repetir para cada producto."
          >
            <AutoComplete
              style={{ width: "100%" }}
              placeholder="Elegí o escribí: mayorista, minorista, fabrica"
              options={PRICE_TYPES.map((t) => ({
                value: t,
                label: `${PRICE_TYPE_LABELS[t]} (${t})`,
              }))}
              filterOption={(input, option) =>
                (option?.value as string)?.toLowerCase().includes(input.trim().toLowerCase()) ?? false
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Nuevo precio (archivar el actual)"
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
              {" — "}
              {formatPriceListLabel(replaceTarget.description)} — precio vigente{" "}
              {formatCurrency(replaceTarget.value)} (referencia).
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
              Se crea un registro nuevo con la <strong>misma lista</strong> ({formatPriceListLabel(replaceTarget.description)}).
            </Typography.Paragraph>
          </>
        )}
        <Form form={replaceForm} layout="vertical" onFinish={handleReplaceSubmit}>
          <Form.Item
            name="value"
            label="Nuevo valor"
            rules={[{ required: true, message: "Ingresá el nuevo precio" }]}
          >
            <InputNumber min={0} step={0.01} precision={4} placeholder="Ej. 2500" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Mismo nuevo precio para varias filas"
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
        width={780}
      >
        <Typography.Paragraph style={{ marginBottom: 8, color: "rgba(255,255,255,0.85)" }}>
          Cada fila tiene su <strong>lista</strong> (mayorista, minorista o fábrica). Se archivan los precios vigentes
          mostrados y se crea <strong>un precio nuevo por cada combinación producto + lista</strong>, todos con el{" "}
          <strong>mismo valor</strong> que ingreses abajo.
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 14 }}>
          Ejemplo: si marcás &quot;Golden mayorista&quot; y &quot;Red ale mayorista&quot;, ambas pasan al mismo precio
          nuevo en <strong>mayorista</strong>; las listas minorista/fábrica de esos productos no cambian salvo que las
          selecciones también.
        </Typography.Paragraph>
        <div style={{ marginBottom: 16 }}>
          {bulkPreviewLoading ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <Spin />
            </div>
          ) : bulkPreviewRows && bulkPreviewRows.length > 0 ? (
            <Table<Price>
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
            label="Nuevo valor (aplica a todas las filas de la tabla)"
            rules={[{ required: true, message: "Ingresá el nuevo precio" }]}
          >
            <InputNumber min={0} step={0.01} precision={4} placeholder="Ej. 2500" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
