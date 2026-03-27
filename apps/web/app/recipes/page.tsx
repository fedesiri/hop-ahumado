"use client";

import { AppLayout } from "@/components/app-layout";
import { apiClient } from "@/lib/api-client";
import { LineProvider } from "@/lib/line-context";
import {
  ProductUnit,
  type CreateCostRequest,
  type CreatePriceRequest,
  type CreateProductRequest,
  type CreateRecipeItemRequest,
  type Product,
  type RecipeItem,
  type UpdateRecipeItemRequest,
} from "@/lib/types";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

const PRODUCT_UNIT_OPTIONS: { label: string; value: ProductUnit }[] = [
  { label: "Unidad", value: ProductUnit.UNIT },
  { label: "Kg", value: ProductUnit.KG },
  { label: "Gr", value: ProductUnit.G },
  { label: "Litro", value: ProductUnit.L },
  { label: "Ml", value: ProductUnit.ML },
];

const UNIT_SHORT_LABEL: Record<ProductUnit, string> = {
  [ProductUnit.UNIT]: "un",
  [ProductUnit.KG]: "kg",
  [ProductUnit.G]: "gr",
  [ProductUnit.L]: "l",
  [ProductUnit.ML]: "ml",
};

/** Insumo por 1 kg de producto final (solo si el final está en masa: kg o gr). null = no aplica. */
function ingredientAmountPerKgOfFinal(ingredientPerFinalUnit: number, finalUnit: ProductUnit): number | null {
  if (finalUnit === ProductUnit.KG) return ingredientPerFinalUnit;
  if (finalUnit === ProductUnit.G) return ingredientPerFinalUnit * 1000;
  return null;
}

function formatRecipeAmount(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 6 });
}

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
  const [productForm] = Form.useForm();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productCreateTarget, setProductCreateTarget] = useState<"final" | "ingredient">("final");
  const [calculatorAmount, setCalculatorAmount] = useState<number | null>(null);
  const batchQuantity = Form.useWatch("batchQuantity", form);
  const ingredientBatchQuantity = Form.useWatch("ingredientBatchQuantity", form);

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
      if (!selectedProductId) {
        setRecipes([]);
        setLoadError(null);
        return;
      }
      const limit = 100;
      setLoading(true);
      setLoadError(null);
      const all: RecipeItem[] = [];
      let page = 1;
      while (true) {
        const response = await apiClient.getRecipeItems(page, limit, selectedProductId);
        all.push(...response.data);
        if (response.meta.totalPages <= page) break;
        page += 1;
      }
      setRecipes(all);
    } catch (error) {
      const msg = getErrorMessage(error, "Error al cargar recetas");
      setLoadError(msg);
      message.error(msg);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, message]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  useEffect(() => {
    setCalculatorAmount(null);
  }, [selectedProductId]);

  useEffect(() => {
    fetchProducts().catch((e) => {
      console.error(e);
      message.error("Error al cargar productos para los selectores");
    });
  }, [fetchProducts, message]);

  const ingredientOptions = useMemo(() => {
    if (!selectedProductId) return [];
    return products.filter((p) => p.id !== selectedProductId).map((p) => ({ label: p.name, value: p.id }));
  }, [products, selectedProductId]);

  const productOptions = useMemo(() => products.map((p) => ({ label: p.name, value: p.id })), [products]);
  const selectedProduct = useMemo(
    () => (selectedProductId ? products.find((p) => p.id === selectedProductId) : undefined),
    [products, selectedProductId],
  );
  const selectedIngredientId = Form.useWatch("ingredientId", form);
  const selectedIngredient = useMemo(
    () => (selectedIngredientId ? products.find((p) => p.id === selectedIngredientId) : undefined),
    [products, selectedIngredientId],
  );

  const handleCreate = () => {
    if (!selectedProductId) {
      message.error("Elegí un producto final antes de agregar ingredientes");
      return;
    }
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openCreateProductModal = (target: "final" | "ingredient") => {
    setProductCreateTarget(target);
    productForm.resetFields();
    setProductModalOpen(true);
  };

  const handleEdit = (record: RecipeItem) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ingredientId: record.ingredientId,
      batchQuantity: 1,
      ingredientBatchQuantity: record.quantity,
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

  const handleSubmit = async (values: {
    ingredientId: string;
    batchQuantity?: number;
    ingredientBatchQuantity?: number;
  }) => {
    try {
      if (!selectedProductId) {
        message.error("Seleccioná un producto final");
        return;
      }
      if (values.ingredientId === selectedProductId) {
        message.error("El producto elaborado y el ingrediente no pueden ser el mismo");
        return;
      }
      const produced = Number(values.batchQuantity);
      const used = Number(values.ingredientBatchQuantity);
      if (!Number.isFinite(produced) || produced <= 0) {
        message.error("La cantidad elaborada debe ser mayor que 0");
        return;
      }
      if (!Number.isFinite(used) || used <= 0) {
        message.error("La cantidad del ingrediente debe ser mayor que 0");
        return;
      }
      const normalizedQuantity = used / produced;

      if (!normalizedQuantity || normalizedQuantity <= 0) {
        message.error("La cantidad es inválida");
        return;
      }

      const data: CreateRecipeItemRequest = {
        productId: selectedProductId,
        ingredientId: values.ingredientId,
        quantity: normalizedQuantity,
      };

      if (editingId) {
        const patch: UpdateRecipeItemRequest = { quantity: normalizedQuantity };
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

  const handleCreateProductSubmit = async (values: {
    name: string;
    unit?: ProductUnit;
    stock?: number;
    costValue: number;
    priceMayorista?: number;
    priceMinorista?: number;
    priceFabrica?: number;
  }) => {
    try {
      const productData: CreateProductRequest = {
        name: values.name,
        unit: values.unit ?? ProductUnit.UNIT,
        stock: values.stock != null && values.stock !== "" ? Number(values.stock) : 0,
      };
      const created = await apiClient.createProduct(productData);

      const costData: CreateCostRequest = { productId: created.id, value: values.costValue };
      await apiClient.createCost(costData);

      const priceFields: { field: keyof typeof values; description: "mayorista" | "minorista" | "fabrica" }[] = [
        { field: "priceMayorista", description: "mayorista" },
        { field: "priceMinorista", description: "minorista" },
        { field: "priceFabrica", description: "fabrica" },
      ];

      for (const pf of priceFields) {
        const raw = values[pf.field];
        if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
        const priceData: CreatePriceRequest = { productId: created.id, value: raw, description: pf.description };
        await apiClient.createPrice(priceData);
      }

      await fetchProducts();
      if (productCreateTarget === "ingredient") {
        form.setFieldValue("ingredientId", created.id);
      } else {
        setSelectedProductId(created.id);
      }
      setProductModalOpen(false);
      message.success("Producto creado y listo para usar en recetas");
    } catch (error) {
      message.error(getErrorMessage(error, "Error al crear producto"));
    }
  };

  const calculatorRows = useMemo(() => {
    const n = calculatorAmount;
    if (n == null || !Number.isFinite(n) || n <= 0 || recipes.length === 0) return [];
    return recipes.map((r) => {
      const ing = r.ingredient;
      const unit = ing?.unit ?? ProductUnit.UNIT;
      return {
        key: r.id,
        name: ing?.name ?? "—",
        amount: r.quantity * n,
        unitLabel: UNIT_SHORT_LABEL[unit],
      };
    });
  }, [recipes, calculatorAmount]);

  const calculatorColumns = [
    {
      title: "Ingrediente",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Cantidad a usar",
      key: "need",
      render: (_: unknown, row: { amount: number; unitLabel: string }) =>
        `${formatRecipeAmount(row.amount)} ${row.unitLabel}`,
    },
  ];

  const columns = [
    {
      title: "Producto (receta)",
      dataIndex: ["product", "name"],
      key: "product",
      render: (_: string) => (selectedProduct ? selectedProduct.name : "-"),
    },
    {
      title: "Ingrediente",
      dataIndex: ["ingredient", "name"],
      key: "ingredient",
      render: (_: string, record: RecipeItem) =>
        record.ingredient?.name
          ? `${record.ingredient.name} (${UNIT_SHORT_LABEL[record.ingredient.unit ?? ProductUnit.UNIT]})`
          : "-",
    },
    {
      title: "Proporción",
      dataIndex: "quantity",
      key: "quantity",
      render: (q: number, record: RecipeItem) => {
        if (typeof q !== "number") return "-";
        const final = selectedProduct;
        const ing = record.ingredient;
        if (!final || !ing) return formatRecipeAmount(q);
        const ingU = UNIT_SHORT_LABEL[ing.unit ?? ProductUnit.UNIT];
        const perKg = ingredientAmountPerKgOfFinal(q, final.unit ?? ProductUnit.UNIT);
        if (perKg != null) {
          return (
            <span>
              {formatRecipeAmount(perKg)} {ingU} / kg de final
            </span>
          );
        }
        return (
          <span>
            {formatRecipeAmount(q)} {ingU} por 1 {UNIT_SHORT_LABEL[final.unit ?? ProductUnit.UNIT]} de final
          </span>
        );
      },
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
        <Button onClick={() => openCreateProductModal("final")} icon={<PlusOutlined />}>
          Nuevo producto
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
        <Row gutter={16} align="middle">
          <Col xs={24} md={12} lg={10}>
            <label style={{ color: "#9ca3af", display: "block", marginBottom: "8px" }}>Producto final (receta)</label>
            <Select
              allowClear
              placeholder="Elegí el producto que querés fabricar"
              options={productOptions}
              value={selectedProductId}
              onChange={(value) => setSelectedProductId(value)}
              style={{ width: "100%" }}
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} md={12} lg={14}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} disabled={!selectedProductId}>
                Agregar ingrediente
              </Button>
            </div>
          </Col>
        </Row>

        <div style={{ marginTop: 14, color: "#9ca3af", lineHeight: 1.5 }}>
          Si el producto final está en <strong>kg</strong> o <strong>gr</strong>, la tabla muestra cuánto insumo entra
          por <strong>cada 1 kg de final</strong>. Si no, se muestra por la unidad del final (unidad, litro, etc.).
        </div>
      </Card>

      {!selectedProductId ? (
        <Empty description="Elegí un producto final para ver su receta" style={{ color: "#9ca3af", marginTop: 64 }} />
      ) : loading ? (
        <Spin />
      ) : recipes.length > 0 ? (
        <>
          <Table
            columns={columns.filter((c) => c.key !== "product")}
            dataSource={recipes}
            rowKey="id"
            style={{ backgroundColor: "#1f2937" }}
          />
          <Card
            title="Calculadora de ingredientes"
            style={{ marginTop: 20, background: "#1f2937", borderColor: "#2d3748" }}
            styles={{ header: { borderColor: "#2d3748", color: "#ffffff" } }}
          >
            <p style={{ color: "#9ca3af", marginBottom: 16, lineHeight: 1.55 }}>
              Tomá las proporciones de la receta de arriba. Indicá{" "}
              <strong>cuánto vas a elaborar del producto final</strong> (en la misma unidad que tiene cargado ese
              producto: {UNIT_SHORT_LABEL[selectedProduct?.unit ?? ProductUnit.UNIT]}). El listado es solo orientativo;
              no modifica stock ni la receta guardada.
            </p>
            <Space wrap align="center" style={{ marginBottom: calculatorRows.length > 0 ? 16 : 0 }}>
              <span style={{ color: "#e5e7eb" }}>Quiero elaborar</span>
              <InputNumber
                min={0.0001}
                step={0.01}
                value={calculatorAmount ?? undefined}
                onChange={(v) => setCalculatorAmount(typeof v === "number" && Number.isFinite(v) ? v : null)}
                placeholder="Ej. 2,5"
                style={{ minWidth: 120 }}
              />
              <span style={{ color: "#9ca3af" }}>
                {UNIT_SHORT_LABEL[selectedProduct?.unit ?? ProductUnit.UNIT]} de «{selectedProduct?.name ?? "final"}»
              </span>
            </Space>
            {calculatorRows.length > 0 ? (
              <Table
                size="small"
                columns={calculatorColumns}
                dataSource={calculatorRows}
                pagination={false}
                style={{ backgroundColor: "#1f2937" }}
              />
            ) : (
              <Empty
                description="Ingresá un número arriba para ver cuánto necesitás de cada ingrediente"
                style={{ color: "#9ca3af", marginTop: 8 }}
              />
            )}
          </Card>
        </>
      ) : (
        <Empty
          description={loadError ? "Reintentá cuando la API esté disponible" : "No hay ingredientes para esta receta"}
          style={{ color: "#9ca3af" }}
        />
      )}

      <Modal
        title={editingId ? "Editar ingrediente" : "Agregar ingrediente"}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => setModalOpen(false)}
        width={480}
      >
        <p style={{ color: "#9ca3af", marginBottom: 16, lineHeight: 1.55 }}>
          Receta de <strong>{selectedProduct?.name ?? "…"}</strong> (producto final). Para cada ingrediente cargás dos
          cantidades que corresponden a <strong>la misma tanda o lote</strong>: una del final y otra del insumo. El
          primero es siempre el <strong>{selectedProduct?.name ?? "producto final"}</strong>, no el ingrediente.
        </p>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
              disabled={!!editingId}
            />
          </Form.Item>
          {!editingId && (
            <Button type="link" style={{ paddingLeft: 0 }} onClick={() => openCreateProductModal("ingredient")}>
              + Crear producto nuevo sin salir de recetas
            </Button>
          )}

          <Row gutter={[12, 8]}>
            <Col xs={24} sm={12}>
              <div style={{ color: "#ffffff", fontWeight: 500, marginBottom: 4 }}>
                Cuánto hacés de «{selectedProduct?.name ?? "producto final"}» (una tanda)
              </div>
              <div style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.45 }}>
                Referencia del <strong>final</strong> en la unidad que definiiste para él (
                {UNIT_SHORT_LABEL[selectedProduct?.unit ?? ProductUnit.UNIT]}).
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ color: "#ffffff", fontWeight: 500, marginBottom: 4 }}>
                Cuánto de «{selectedIngredient?.name ?? "el ingrediente"}» en esa misma tanda
              </div>
              <div style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.45 }}>
                Cantidad del insumo elegido arriba, en su unidad (
                {selectedIngredient
                  ? UNIT_SHORT_LABEL[selectedIngredient.unit ?? ProductUnit.UNIT]
                  : UNIT_SHORT_LABEL[ProductUnit.UNIT]}
                ).
              </div>
            </Col>
          </Row>
          <Row gutter={[12, 8]} style={{ marginTop: 4 }}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="batchQuantity"
                rules={[
                  { required: true, message: "Este dato es obligatorio" },
                  { type: "number", min: 0.0001, message: "Tiene que ser mayor que 0" },
                ]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0.0001} step={0.01} placeholder="Ej: 1" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="ingredientBatchQuantity"
                rules={[
                  { required: true, message: "Este dato es obligatorio" },
                  { type: "number", min: 0.0001, message: "Tiene que ser mayor que 0" },
                ]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber min={0.0001} step={0.01} placeholder="Ej: 0.7" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ color: "#9ca3af", marginTop: 14, marginBottom: 12, lineHeight: 1.5 }}>
            {Number(batchQuantity) > 0 && Number(ingredientBatchQuantity) > 0 && selectedProduct && selectedIngredient
              ? (() => {
                  const ratio = Number(ingredientBatchQuantity) / Number(batchQuantity);
                  const perKg = ingredientAmountPerKgOfFinal(ratio, selectedProduct.unit ?? ProductUnit.UNIT);
                  const ingU = UNIT_SHORT_LABEL[selectedIngredient.unit ?? ProductUnit.UNIT];
                  const nameIng = selectedIngredient.name ?? "ingrediente";
                  const nameFin = selectedProduct.name ?? "final";
                  if (perKg != null) {
                    return `Por cada 1 kg de «${nameFin}» se usan ${formatRecipeAmount(perKg)} ${ingU} de «${nameIng}».`;
                  }
                  return `Por cada 1 ${UNIT_SHORT_LABEL[selectedProduct.unit ?? ProductUnit.UNIT]} de «${nameFin}» se usan ${formatRecipeAmount(ratio)} ${ingU} de «${nameIng}». (Para ver por kg, cargá el final en kg o gr.)`;
                })()
              : "Completá ambos números para ver la proporción (por kg de final si el final está en kg o gr)."}
          </div>
        </Form>
      </Modal>

      <Modal
        title="Nuevo producto"
        open={productModalOpen}
        onOk={() => productForm.submit()}
        onCancel={() => setProductModalOpen(false)}
        width={560}
        zIndex={1300}
      >
        <Form form={productForm} layout="vertical" onFinish={handleCreateProductSubmit}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: "El nombre es requerido" }]}>
            <Input placeholder="Nombre del producto" />
          </Form.Item>

          <Form.Item name="unit" label="Unidad de medida" initialValue={ProductUnit.UNIT}>
            <Select placeholder="Seleccioná unidad" options={PRODUCT_UNIT_OPTIONS} />
          </Form.Item>

          <Form.Item name="stock" label="Stock inicial (opcional)">
            <InputNumber min={0} step={0.01} precision={4} placeholder="Ej: 10 o 3,5" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="costValue"
            label="Costo (obligatorio)"
            rules={[{ required: true, message: "El costo es requerido" }]}
          >
            <InputNumber min={0} step={0.01} precision={4} placeholder="Ej: 1200" style={{ width: "100%" }} />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="priceMayorista" label="Precio mayorista (opcional)">
                <InputNumber min={0} step={0.01} precision={4} placeholder="Ej: 1500" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="priceMinorista" label="Precio minorista (opcional)">
                <InputNumber min={0} step={0.01} precision={4} placeholder="Ej: 1800" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="priceFabrica" label="Precio fabrica (opcional)">
            <InputNumber min={0} step={0.01} precision={4} placeholder="Ej: 1300" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
