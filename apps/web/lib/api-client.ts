import type {
  PaginatedResponse,
  Category,
  Product,
  User,
  Customer,
  CustomerProfile,
  CustomerInteraction,
  Price,
  Cost,
  StockMovement,
  RecipeItem,
  Order,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateProductRequest,
  UpdateProductRequest,
  CreateUserRequest,
  UpdateUserRequest,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CreateCustomerProfileRequest,
  UpdateCustomerProfileRequest,
  CreateCustomerInteractionRequest,
  UpdateCustomerInteractionRequest,
  CreatePriceRequest,
  UpdatePriceRequest,
  CreateCostRequest,
  UpdateCostRequest,
  CreateStockMovementRequest,
  CreateRecipeItemRequest,
  UpdateRecipeItemRequest,
  CreateOrderRequest,
  UpdateOrderRequest,
  HealthResponse,
} from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `API Error: ${response.status}`)
    }

    return response.json()
  }

  private buildParams(params?: Record<string, any>): string {
    if (!params) return ''
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })
    const query = searchParams.toString()
    return query ? `?${query}` : ''
  }

  // Health
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health')
  }

  // Categories
  async getCategories(page = 1, limit = 10): Promise<PaginatedResponse<Category>> {
    return this.request(`/categories${this.buildParams({ page, limit })}`)
  }

  async getCategory(id: string): Promise<Category> {
    return this.request(`/categories/${id}`)
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCategory(id: string, data: UpdateCategoryRequest): Promise<Category> {
    return this.request(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteCategory(id: string): Promise<void> {
    return this.request(`/categories/${id}`, { method: 'DELETE' })
  }

  // Products
  async getProducts(
    page = 1,
    limit = 10,
    includeDeactivated = false
  ): Promise<PaginatedResponse<Product>> {
    return this.request(
      `/products${this.buildParams({ page, limit, includeDeactivated: includeDeactivated ? 'true' : undefined })}`
    )
  }

  async getProduct(id: string): Promise<Product> {
    return this.request(`/products/${id}`)
  }

  async createProduct(data: CreateProductRequest): Promise<Product> {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateProduct(id: string, data: UpdateProductRequest): Promise<Product> {
    return this.request(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteProduct(id: string): Promise<void> {
    return this.request(`/products/${id}`, { method: 'DELETE' })
  }

  // Users
  async getUsers(page = 1, limit = 10): Promise<PaginatedResponse<User>> {
    return this.request(`/users${this.buildParams({ page, limit })}`)
  }

  async getUser(id: string): Promise<User> {
    return this.request(`/users/${id}`)
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    return this.request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: string): Promise<void> {
    return this.request(`/users/${id}`, { method: 'DELETE' })
  }

  // Customers
  async getCustomers(page = 1, limit = 10): Promise<PaginatedResponse<Customer>> {
    return this.request(`/customers${this.buildParams({ page, limit })}`)
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.request(`/customers/${id}`)
  }

  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCustomer(id: string, data: UpdateCustomerRequest): Promise<Customer> {
    return this.request(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteCustomer(id: string): Promise<void> {
    return this.request(`/customers/${id}`, { method: 'DELETE' })
  }

  // Customer Profiles
  async getCustomerProfiles(page = 1, limit = 10): Promise<PaginatedResponse<CustomerProfile>> {
    return this.request(`/customer-profiles${this.buildParams({ page, limit })}`)
  }

  async getCustomerProfile(id: string): Promise<CustomerProfile> {
    return this.request(`/customer-profiles/${id}`)
  }

  async createCustomerProfile(data: CreateCustomerProfileRequest): Promise<CustomerProfile> {
    return this.request('/customer-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCustomerProfile(
    id: string,
    data: UpdateCustomerProfileRequest
  ): Promise<CustomerProfile> {
    return this.request(`/customer-profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteCustomerProfile(id: string): Promise<void> {
    return this.request(`/customer-profiles/${id}`, { method: 'DELETE' })
  }

  // Customer Interactions
  async getCustomerInteractions(
    page = 1,
    limit = 10,
    profileId?: string
  ): Promise<PaginatedResponse<CustomerInteraction>> {
    return this.request(
      `/customer-interactions${this.buildParams({ page, limit, profileId })}`
    )
  }

  async getCustomerInteraction(id: string): Promise<CustomerInteraction> {
    return this.request(`/customer-interactions/${id}`)
  }

  async createCustomerInteraction(data: CreateCustomerInteractionRequest): Promise<CustomerInteraction> {
    return this.request('/customer-interactions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCustomerInteraction(
    id: string,
    data: UpdateCustomerInteractionRequest
  ): Promise<CustomerInteraction> {
    return this.request(`/customer-interactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteCustomerInteraction(id: string): Promise<void> {
    return this.request(`/customer-interactions/${id}`, { method: 'DELETE' })
  }

  // Prices
  async getPrices(
    page = 1,
    limit = 10,
    productId?: string,
    activeOnly = false
  ): Promise<PaginatedResponse<Price>> {
    return this.request(
      `/prices${this.buildParams({
        page,
        limit,
        productId,
        activeOnly: activeOnly ? 'true' : undefined,
      })}`
    )
  }

  async getPrice(id: string): Promise<Price> {
    return this.request(`/prices/${id}`)
  }

  async createPrice(data: CreatePriceRequest): Promise<Price> {
    return this.request('/prices', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updatePrice(id: string, data: UpdatePriceRequest): Promise<Price> {
    return this.request(`/prices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deletePrice(id: string): Promise<void> {
    return this.request(`/prices/${id}`, { method: 'DELETE' })
  }

  // Costs
  async getCosts(
    page = 1,
    limit = 10,
    productId?: string,
    activeOnly = false
  ): Promise<PaginatedResponse<Cost>> {
    return this.request(
      `/costs${this.buildParams({
        page,
        limit,
        productId,
        activeOnly: activeOnly ? 'true' : undefined,
      })}`
    )
  }

  async getCost(id: string): Promise<Cost> {
    return this.request(`/costs/${id}`)
  }

  async createCost(data: CreateCostRequest): Promise<Cost> {
    return this.request('/costs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCost(id: string, data: UpdateCostRequest): Promise<Cost> {
    return this.request(`/costs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteCost(id: string): Promise<void> {
    return this.request(`/costs/${id}`, { method: 'DELETE' })
  }

  // Stock Movements
  async getStockMovements(page = 1, limit = 10, productId?: string): Promise<PaginatedResponse<StockMovement>> {
    return this.request(
      `/stock-movements${this.buildParams({ page, limit, productId })}`
    )
  }

  async getStockMovement(id: string): Promise<StockMovement> {
    return this.request(`/stock-movements/${id}`)
  }

  async createStockMovement(data: CreateStockMovementRequest): Promise<StockMovement> {
    return this.request('/stock-movements', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Recipe Items
  async getRecipeItems(page = 1, limit = 10, productId?: string): Promise<PaginatedResponse<RecipeItem>> {
    return this.request(
      `/recipe-items${this.buildParams({ page, limit, productId })}`
    )
  }

  async getRecipeItem(id: string): Promise<RecipeItem> {
    return this.request(`/recipe-items/${id}`)
  }

  async createRecipeItem(data: CreateRecipeItemRequest): Promise<RecipeItem> {
    return this.request('/recipe-items', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateRecipeItem(id: string, data: UpdateRecipeItemRequest): Promise<RecipeItem> {
    return this.request(`/recipe-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteRecipeItem(id: string): Promise<void> {
    return this.request(`/recipe-items/${id}`, { method: 'DELETE' })
  }

  // Orders
  async getOrders(page = 1, limit = 10): Promise<PaginatedResponse<Order>> {
    return this.request(`/orders${this.buildParams({ page, limit })}`)
  }

  async getOrder(id: string): Promise<Order> {
    return this.request(`/orders/${id}`)
  }

  async createOrder(data: CreateOrderRequest): Promise<Order> {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateOrder(id: string, data: UpdateOrderRequest): Promise<Order> {
    return this.request(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteOrder(id: string): Promise<void> {
    return this.request(`/orders/${id}`, { method: 'DELETE' })
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
