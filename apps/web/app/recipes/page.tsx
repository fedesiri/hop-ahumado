"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { LineProvider } from "@/lib/line-context";
import type { CreateRecipeItemRequest, Product, RecipeItem, UpdateRecipeItemRequest } from "@/lib/types";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Col, Empty, Form, InputNumber, Modal, Row, Select, Space, Spin, Table } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function RecipesPage() {
  return (
    <LineProvider>
      <AppLayout>
        <RecipesContent />
      </AppLayout>
    </LineProvider>
  );
}

function RecipesContent() {
  const { message, modal } = App.useApp();
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const recipeProductId = Form.useWatch("productId", form);
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    const limit = 100;
    const all: Product[] = [];
    let page = 1;
    let res = await apiClient.getProducts(page, limit);
    all.push(...res.data);
    while (res.meta.totalPages > page) {
      page += 1;
      res = await apiClient.getProducts(page, limit);
      all.push(...res.data);
    }
    setProducts(all);
  }, []);

  const fetchRecipes = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await apiClient.getRecipeItems(
        pagination.page,
        pagination.limit,
        selectedProductId || undefined,
      );
      setRecipes(response.data);
      setMeta(response.meta);
    } catch (error) {
      const msg = getErrorMessage(error, "Error al cargar recetas");
      setLoadError(msg);
      message.error(msg);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, selectedProductId, message]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  useEffect(() => {
    fetchProducts().catch((e) => {
      console.error(e);
      message.error("Error al cargar productos para los selectores");
    });
  }, [fetchProducts, message]);

  useEffect(() => {
    if (!recipeProductId) return;
    const ing = form.getFieldValue("ingredientId") as string | undefined;
    if (ing === recipeProductId) {
      form.setFieldValue("ingredientId", undefined);
    }
  }, [recipeProductId, form]);

  const ingredientOptions = useMemo(() => {
    return products.filter((p) => p.id !== recipeProductId).map((p) => ({ label: p.name, value: p.id }));
  }, [products, recipeProductId]);

  const productOptions = useMemo(() => products.map((p) => ({ label: p.name, value: p.id })), [products]);

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: RecipeItem) => {
    setEditingId(record.id);
    form.setFieldsValue({
      productId: record.productId,
      ingredientId: record.ingredientId,
      quantity: record.quantity,
    });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: "Confirmar eliminación",
      content: "¿Seguro que deseas eliminar este ítem de la receta?",
      okText: "Sí",
      cancelText: "No",
      onOk: async () => {
        try {
          await apiClient.deleteRecipeItem(id);
          message.success("Ítem de receta eliminado");
          fetchRecipes();
        } catch (error) {
          message.error(getErrorMessage(error, "Error al eliminar"));
        }
      },
    });
  };

  const handleSubmit = async (values: { productId: string; ingredientId: string; quantity: number }) => {
    try {
      if (values.productId === values.ingredientId) {
        message.error("El producto elaborado y el ingrediente no pueden ser el mismo");
        return;
      }
      const data: CreateRecipeItemRequest = {
        productId: values.productId,
        ingredientId: values.ingredientId,
        quantity: values.quantity,
      };

      if (editingId) {
        const patch: UpdateRecipeItemRequest = { quantity: values.quantity };
        await apiClient.updateRecipeItem(editingId, patch);
        message.success("Ítem de receta actualizado");
      } else {
        await apiClient.createRecipeItem(data);
        message.success("Ítem de receta creado");
      }
      setModalOpen(false);
      fetchRecipes();
    } catch (error) {
      message.error(getErrorMessage(error, "Error al guardar ítem de receta"));
    }
  };

  const columns = [
    {
      title: "Producto (receta)",
      dataIndex: ["product", "name"],
      key: "product",
      render: (text: string) => text || "-",
    },
    {
      title: "Ingrediente",
      dataIndex: ["ingredient", "name"],
      key: "ingredient",
      render: (text: string) => text || "-",
    },
    {
      title: "Cantidad",
      dataIndex: "quantity",
      key: "quantity",
      render: (q: number) =>
        typeof q === "number" ? q.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : "-",
    },
    {
      title: "Alta",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string | undefined) =>
        date ? new Date(date).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "-",
    },
    {
      title: "Acciones",
      key: "actions",
      width: 120,
      render: (_: unknown, record: RecipeItem) => (
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
        <h1 style={{ margin: 0, color: "#ffffff" }}>Recetas</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Agregar ingrediente
        </Button>
      </div>

      {loadError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="No se pudieron cargar los ítems de receta"
          description={loadError}
        />
      )}

      <Card style={{ marginBottom: "16px", background: "#1f2937", borderColor: "#2d3748" }}>
        <Row gutter={16}>
          <Col span={12}>
            <label style={{ color: "#9ca3af", display: "block", marginBottom: "8px" }}>
              Filtrar por producto (receta)
            </label>
            <Select
              allowClear
              placeholder="Todos los productos"
              options={productOptions}
              value={selectedProductId}
              onChange={(value) => {
                setSelectedProductId(value);
                setPagination({ page: 1, limit: 10 });
              }}
              style={{ width: "100%" }}
              showSearch
              optionFilterProp="label"
            />
          </Col>
        </Row>
      </Card>

      {loading ? (
        <Spin />
      ) : recipes.length > 0 ? (
        <Table
          columns={columns}
          dataSource={recipes}
          rowKey="id"
          style={{ backgroundColor: "#1f2937" }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: meta?.total || 0,
            showSizeChanger: true,
            onChange: (page, pageSize) => {
              setPagination({ page, limit: pageSize || 10 });
            },
          }}
        />
      ) : (
        <Empty
          description={loadError ? "Reintentá cuando la API esté disponible" : "No hay ítems de receta"}
          style={{ color: "#9ca3af" }}
        />
      )}

      <Modal
        title={editingId ? "Editar ingrediente" : "Agregar ingrediente"}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={480}
      >
        <p style={{ color: "#9ca3af", marginBottom: 16 }}>
          Indicá cuánto de cada ingrediente se usa para producir <strong>una unidad</strong> del producto elaborado
          (misma unidad lógica que uses en stock: unidades, kg, etc.).
        </p>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="productId"
            label="Producto elaborado (receta)"
            rules={[{ required: true, message: "Elegí el producto que se fabrica" }]}
          >
            <Select
              placeholder="Producto final"
              options={productOptions}
              showSearch
              optionFilterProp="label"
              disabled={!!editingId}
            />
          </Form.Item>

          <Form.Item
            name="ingredientId"
            label="Ingrediente"
            rules={[{ required: true, message: "Elegí un ingrediente" }]}
          >
            <Select
              placeholder="Ingrediente"
              options={ingredientOptions}
              showSearch
              optionFilterProp="label"
              disabled={!!editingId || !recipeProductId}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Cantidad por unidad elaborada"
            rules={[
              { required: true, message: "La cantidad es obligatoria" },
              {
                type: "number",
                min: 0.0001,
                message: "Tiene que ser mayor que 0",
              },
            ]}
          >
            <InputNumber min={0.0001} step={0.01} placeholder="Ej: 0.25" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
