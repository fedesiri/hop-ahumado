import { getAuthHeaders } from "@/lib/auth-fetch";
import type {
  Category,
  Cost,
  CreateCategoryRequest,
  CreateCostRequest,
  CreateCrmCustomerRequest,
  CreateCustomerInteractionRequest,
  CreateCustomerProfileRequest,
  CreateCustomerRequest,
  CreateExpenseRequest,
  CreateOrderPaymentRequest,
  CreateOrderRequest,
  CreatePriceRequest,
  CreateProductRequest,
  CreateRecipeItemRequest,
  CreateStockLocationRequest,
  CreateStockMovementRequest,
  CreateUserRequest,
  CrmCustomerListItem,
  CrmDashboardResponse,
  Customer,
  CustomerInteraction,
  CustomerOpportunity,
  CustomerProfile,
  DistributorSuggestedOrderResponse,
  Expense,
  HealthResponse,
  Order,
  PaginatedResponse,
  Price,
  Product,
  RecipeItem,
  StockBalanceRow,
  StockLocation,
  StockMovement,
  TransferAllStockRequest,
  TransferAllStockResult,
  TreasuryBaseline,
  UpdateCategoryRequest,
  UpdateCostRequest,
  UpdateCustomerInteractionRequest,
  UpdateCustomerOpportunityRequest,
  UpdateCustomerProfileRequest,
  UpdateCustomerRequest,
  UpdateOrderPaymentRequest,
  UpdateOrderRequest,
  UpdatePriceRequest,
  UpdateProductRequest,
  UpdateRecipeItemRequest,
  UpdateStockLocationRequest,
  UpdateTreasuryBaselineRequest,
  UpdateUserRequest,
  User,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = await getAuthHeaders(options.headers);

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  private buildParams(params?: Record<string, any>): string {
    if (!params) return "";
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const query = searchParams.toString();
    return query ? `?${query}` : "";
  }

  // Health
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health");
  }

  // Categories
  async getCategories(page = 1, limit = 10): Promise<PaginatedResponse<Category>> {
    return this.request(`/categories${this.buildParams({ page, limit })}`);
  }

  async getCategory(id: string): Promise<Category> {
    return this.request(`/categories/${id}`);
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    return this.request("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: UpdateCategoryRequest): Promise<Category> {
    return this.request(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return this.request(`/categories/${id}`, { method: "DELETE" });
  }

  // Products
  async getProducts(
    page = 1,
    limit = 10,
    includeDeactivated = false,
    search?: string,
    categoryId?: string,
  ): Promise<PaginatedResponse<Product>> {
    return this.request(
      `/products${this.buildParams({
        page,
        limit,
        includeDeactivated: includeDeactivated ? "true" : undefined,
        search,
        categoryId,
      })}`,
    );
  }

  async getProduct(id: string): Promise<Product> {
    return this.request(`/products/${id}`);
  }

  async createProduct(data: CreateProductRequest): Promise<Product> {
    return this.request("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: UpdateProductRequest): Promise<Product> {
    return this.request(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string): Promise<void> {
    return this.request(`/products/${id}`, { method: "DELETE" });
  }

  // Users
  async getUsers(page = 1, limit = 10): Promise<PaginatedResponse<User>> {
    return this.request(`/users${this.buildParams({ page, limit })}`);
  }

  async getUser(id: string): Promise<User> {
    return this.request(`/users/${id}`);
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    return this.request("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    return this.request(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string): Promise<void> {
    return this.request(`/users/${id}`, { method: "DELETE" });
  }

  // Customers
  async getCustomers(page = 1, limit = 10): Promise<PaginatedResponse<Customer>> {
    return this.request(`/customers${this.buildParams({ page, limit })}`);
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.request(`/customers/${id}`);
  }

  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    return this.request("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: string, data: UpdateCustomerRequest): Promise<Customer> {
    return this.request(`/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(id: string): Promise<void> {
    return this.request(`/customers/${id}`, { method: "DELETE" });
  }

  // Customer Profiles
  async getCustomerProfiles(page = 1, limit = 10): Promise<PaginatedResponse<CustomerProfile>> {
    return this.request(`/customer-profiles${this.buildParams({ page, limit })}`);
  }

  async getCustomerProfile(id: string): Promise<CustomerProfile> {
    return this.request(`/customer-profiles/${id}`);
  }

  async createCustomerProfile(data: CreateCustomerProfileRequest): Promise<CustomerProfile> {
    return this.request("/customer-profiles", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCustomerProfile(id: string, data: UpdateCustomerProfileRequest): Promise<CustomerProfile> {
    return this.request(`/customer-profiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCustomerProfile(id: string): Promise<void> {
    return this.request(`/customer-profiles/${id}`, { method: "DELETE" });
  }

  // Customer Interactions
  async getCustomerInteractions(
    page = 1,
    limit = 10,
    profileId?: string,
  ): Promise<PaginatedResponse<CustomerInteraction>> {
    return this.request(`/customer-interactions${this.buildParams({ page, limit, profileId })}`);
  }

  async getCustomerInteraction(id: string): Promise<CustomerInteraction> {
    return this.request(`/customer-interactions/${id}`);
  }

  async createCustomerInteraction(data: CreateCustomerInteractionRequest): Promise<CustomerInteraction> {
    return this.request("/customer-interactions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCustomerInteraction(id: string, data: UpdateCustomerInteractionRequest): Promise<CustomerInteraction> {
    return this.request(`/customer-interactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCustomerInteraction(id: string): Promise<void> {
    return this.request(`/customer-interactions/${id}`, { method: "DELETE" });
  }

  // CRM
  async listCrmCustomers(
    page = 1,
    limit = 10,
    search?: string,
    status?: string,
    source?: string,
    customerType?: string,
    responsibleId?: string,
    responsibleSearch?: string,
  ): Promise<PaginatedResponse<CrmCustomerListItem>> {
    return this.request(
      `/crm/customers${this.buildParams({
        page,
        limit,
        search,
        status,
        source,
        customerType,
        responsibleId,
        responsibleSearch,
      })}`,
    );
  }

  async getCrmCustomerDetail(profileId: string): Promise<
    CustomerProfile & {
      customer: Customer;
      responsible?: User | null;
      interactions: CustomerInteraction[];
      opportunity?: CustomerOpportunity | null;
      lastContactAt: string | null;
      lastOrderDeliveryAt: string | null;
      lastInteractionAt: string | null;
      daysSinceLastContact: number | null;
    }
  > {
    return this.request(`/crm/customers/${profileId}`);
  }

  async createCrmCustomer(data: CreateCrmCustomerRequest): Promise<{
    customer: Customer;
    profile: CustomerProfile;
  }> {
    return this.request("/crm/customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCrmCustomerProfile(profileId: string, data: UpdateCustomerProfileRequest): Promise<CustomerProfile> {
    return this.request(`/crm/customers/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getCrmCustomerInteractions(
    profileId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResponse<CustomerInteraction>> {
    return this.request(`/crm/customers/${profileId}/interactions${this.buildParams({ page, limit })}`);
  }

  async createCrmCustomerInteraction(
    profileId: string,
    data: Omit<CreateCustomerInteractionRequest, "profileId">,
  ): Promise<CustomerInteraction> {
    return this.request(`/crm/customers/${profileId}/interactions`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getCrmCustomerOpportunity(profileId: string): Promise<CustomerOpportunity | null> {
    return this.request(`/crm/customers/${profileId}/opportunity`);
  }

  async upsertCrmCustomerOpportunity(
    profileId: string,
    data: UpdateCustomerOpportunityRequest,
  ): Promise<CustomerOpportunity> {
    return this.request(`/crm/customers/${profileId}/opportunity`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getCrmDashboard(): Promise<CrmDashboardResponse> {
    return this.request("/crm/dashboard");
  }

  // Prices
  async getPrices(page = 1, limit = 10, productId?: string, activeOnly = false): Promise<PaginatedResponse<Price>> {
    return this.request(
      `/prices${this.buildParams({
        page,
        limit,
        productId,
        activeOnly: activeOnly ? "true" : undefined,
      })}`,
    );
  }

  async getPrice(id: string): Promise<Price> {
    return this.request(`/prices/${id}`);
  }

  async createPrice(data: CreatePriceRequest): Promise<Price> {
    return this.request("/prices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePrice(id: string, data: UpdatePriceRequest): Promise<Price> {
    return this.request(`/prices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deletePrice(id: string): Promise<void> {
    return this.request(`/prices/${id}`, { method: "DELETE" });
  }

  // Costs
  async getCosts(page = 1, limit = 10, productId?: string, activeOnly = false): Promise<PaginatedResponse<Cost>> {
    return this.request(
      `/costs${this.buildParams({
        page,
        limit,
        productId,
        activeOnly: activeOnly ? "true" : undefined,
      })}`,
    );
  }

  async getCost(id: string): Promise<Cost> {
    return this.request(`/costs/${id}`);
  }

  async createCost(data: CreateCostRequest): Promise<Cost> {
    return this.request("/costs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCost(id: string, data: UpdateCostRequest): Promise<Cost> {
    return this.request(`/costs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteCost(id: string): Promise<void> {
    return this.request(`/costs/${id}`, { method: "DELETE" });
  }

  // Expenses (egresos monetarios)
  async getExpenses(page = 1, limit = 10): Promise<PaginatedResponse<Expense>> {
    return this.request(`/expenses${this.buildParams({ page, limit })}`);
  }

  async createExpense(data: CreateExpenseRequest): Promise<Expense[]> {
    return this.request("/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteExpenseGroup(groupId: string): Promise<void> {
    return this.request(`/expenses/group/${groupId}`, { method: "DELETE" });
  }

  async getTreasuryBaseline(): Promise<TreasuryBaseline> {
    return this.request<TreasuryBaseline>("/treasury/baseline");
  }

  async updateTreasuryBaseline(data: UpdateTreasuryBaselineRequest): Promise<TreasuryBaseline> {
    return this.request<TreasuryBaseline>("/treasury/baseline", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Stock locations (ubicaciones de inventario)
  async getStockLocations(): Promise<StockLocation[]> {
    return this.request("/stock-locations");
  }

  async createStockLocation(data: CreateStockLocationRequest): Promise<StockLocation> {
    return this.request("/stock-locations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getStockBalancesAtLocation(locationId: string): Promise<StockBalanceRow[]> {
    return this.request(`/stock-locations/${locationId}/balances`);
  }

  async updateStockLocation(id: string, data: UpdateStockLocationRequest): Promise<StockLocation> {
    return this.request(`/stock-locations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteStockLocation(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.request(`/stock-locations/${id}`, { method: "DELETE" });
  }

  async transferAllStockBetweenLocations(
    fromLocationId: string,
    data: TransferAllStockRequest,
  ): Promise<TransferAllStockResult> {
    return this.request(`/stock-locations/${fromLocationId}/transfer-all`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Stock Movements
  async getStockMovements(page = 1, limit = 10, productId?: string): Promise<PaginatedResponse<StockMovement>> {
    return this.request(`/stock-movements${this.buildParams({ page, limit, productId })}`);
  }

  async getDistributorSuggestedOrder(params?: {
    literTargetBoxes?: number;
    halfLiterTargetBoxes?: number;
    unitsPerBox?: number;
    categoryName?: string;
  }): Promise<DistributorSuggestedOrderResponse> {
    return this.request<DistributorSuggestedOrderResponse>(
      `/distributor-suggested-order${this.buildParams({
        literTargetBoxes: params?.literTargetBoxes,
        halfLiterTargetBoxes: params?.halfLiterTargetBoxes,
        unitsPerBox: params?.unitsPerBox,
        categoryName: params?.categoryName,
      })}`,
    );
  }

  async getStockMovement(id: string): Promise<StockMovement> {
    return this.request(`/stock-movements/${id}`);
  }

  async createStockMovement(data: CreateStockMovementRequest): Promise<StockMovement> {
    return this.request("/stock-movements", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Recipe Items
  async getRecipeItems(page = 1, limit = 10, productId?: string): Promise<PaginatedResponse<RecipeItem>> {
    return this.request(`/recipe-items${this.buildParams({ page, limit, productId })}`);
  }

  async getRecipeItem(id: string): Promise<RecipeItem> {
    return this.request(`/recipe-items/${id}`);
  }

  async createRecipeItem(data: CreateRecipeItemRequest): Promise<RecipeItem> {
    return this.request("/recipe-items", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateRecipeItem(id: string, data: UpdateRecipeItemRequest): Promise<RecipeItem> {
    return this.request(`/recipe-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteRecipeItem(id: string): Promise<void> {
    return this.request(`/recipe-items/${id}`, { method: "DELETE" });
  }

  // Orders
  async getOrders(
    page = 1,
    limit = 10,
    customerId?: string,
    userId?: string,
    dateFrom?: string,
    dateTo?: string,
    minTotal?: number,
    maxTotal?: number,
    paymentStatus?: string,
    delivered?: "true" | "false",
  ): Promise<PaginatedResponse<Order>> {
    return this.request(
      `/orders${this.buildParams({
        page,
        limit,
        customerId,
        userId,
        dateFrom,
        dateTo,
        minTotal,
        maxTotal,
        paymentStatus,
        delivered,
      })}`,
    );
  }

  async getOrder(id: string): Promise<Order> {
    return this.request(`/orders/${id}`);
  }

  async createOrder(data: CreateOrderRequest): Promise<Order> {
    return this.request("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateOrder(id: string, data: UpdateOrderRequest): Promise<Order> {
    return this.request(`/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async createOrderPayment(orderId: string, data: CreateOrderPaymentRequest): Promise<Order> {
    return this.request(`/orders/${orderId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateOrderPayment(orderId: string, paymentId: string, data: UpdateOrderPaymentRequest): Promise<Order> {
    return this.request(`/orders/${orderId}/payments/${paymentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteOrder(id: string): Promise<void> {
    return this.request(`/orders/${id}`, { method: "DELETE" });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
