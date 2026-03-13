// Common types for API responses and entities

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface HealthResponse {
  status: string;
}

// Enums
export enum BusinessLine {
  MEAT = 'MEAT',
  BEER = 'BEER',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
}

export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

// Entities
export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  sku?: string | null;
  barcode?: string | null;
  stock: number;
  deactivationDate?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Category | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfile {
  id: string;
  customerId: string;
  company?: string | null;
  customerType?: string | null;
  status?: string | null;
  source?: string | null;
  responsibleId?: string | null;
  lastContactAt?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  responsible?: User | null;
}

export interface CustomerInteraction {
  id: string;
  profileId: string;
  type?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: CustomerProfile;
  customer?: Customer;
}

export interface Price {
  id: string;
  productId: string;
  value: number;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}

export interface Cost {
  id: string;
  productId: string;
  value: number;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}

export interface StockMovement {
  id: string;
  productId: string;
  quantity: number;
  type: StockMovementType;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}

export interface RecipeItem {
  id: string;
  productId: string;
  ingredientId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  ingredient?: Product;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}

export interface OrderPayment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  customerId?: string | null;
  userId?: string | null;
  deliveryDate?: string | null;
  total: number;
  createdAt: string;
  updatedAt: string;
  customer?: Customer | null;
  user?: User | null;
  orderItems?: OrderItem[];
  payments?: OrderPayment[];
}

// API Request/Response types
export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name?: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  categoryId?: string;
  sku?: string;
  barcode?: string;
  stock?: number;
  deactivationDate?: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  categoryId?: string;
  sku?: string;
  barcode?: string;
  stock?: number;
  deactivationDate?: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export interface CreateCustomerRequest {
  name: string;
  phone?: string;
  email?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  phone?: string;
  email?: string;
}

export interface CreateCustomerProfileRequest {
  customerId: string;
  company?: string;
  customerType?: string;
  status?: string;
  source?: string;
  responsibleId?: string;
  lastContactAt?: string;
}

export interface UpdateCustomerProfileRequest {
  customerId?: string;
  company?: string;
  customerType?: string;
  status?: string;
  source?: string;
  responsibleId?: string;
  lastContactAt?: string;
}

export interface CreateCustomerInteractionRequest {
  profileId: string;
  type?: string;
  note?: string;
}

export interface UpdateCustomerInteractionRequest {
  type?: string;
  note?: string;
}

export interface CreatePriceRequest {
  productId: string;
  value: number;
  description?: string;
}

export interface UpdatePriceRequest {
  value?: number;
  description?: string;
}

export interface CreateCostRequest {
  productId: string;
  value: number;
}

export interface UpdateCostRequest {
  value?: number;
}

export interface CreateStockMovementRequest {
  productId: string;
  quantity: number;
  type: StockMovementType;
  reason?: string;
}

export interface CreateRecipeItemRequest {
  productId: string;
  ingredientId: string;
  quantity: number;
}

export interface UpdateRecipeItemRequest {
  quantity?: number;
}

export interface CreateOrderItemRequest {
  productId: string;
  quantity: number;
  price: number;
}

export interface CreateOrderPaymentRequest {
  amount: number;
  method: PaymentMethod;
}

export interface CreateOrderRequest {
  customerId?: string;
  userId?: string;
  deliveryDate?: string;
  total: number;
  items: CreateOrderItemRequest[];
  payments: CreateOrderPaymentRequest[];
}

export interface UpdateOrderRequest {
  customerId?: string;
  userId?: string;
  deliveryDate?: string;
}

// Context types for line selection
export interface LineContext {
  selectedLine: BusinessLine | null;
  setSelectedLine: (line: BusinessLine | null) => void;
}
