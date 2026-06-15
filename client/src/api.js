const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Không thể kết nối tới máy chủ.");
    error.status = response.status;
    error.code = data.code;
    error.details = data.details;
    throw error;
  }

  return data;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  health: () => request("/health"),
  categories: () => request("/categories"),
  vouchers: () => request("/vouchers"),
  products: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== "" && value !== false && value != null)
    );
    return request(`/products${query.size ? `?${query}` : ""}`);
  },
  product: (id) => request(`/products/${id}`),
  createOrder: (order, token) =>
    request("/orders", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(order)
    }),
  customerRegister: (data) =>
    request("/customer/register", { method: "POST", body: JSON.stringify(data) }),
  customerLogin: (credentials) =>
    request("/customer/login", { method: "POST", body: JSON.stringify(credentials) }),
  customerMe: (token) => request("/customer/me", { headers: authHeaders(token) }),
  createLead: (data) =>
    request("/leads", { method: "POST", body: JSON.stringify(data) }),
  trackOrder: (orderId) => request(`/orders/track/${encodeURIComponent(orderId.trim())}`),
  login: (credentials) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  me: (token) => request("/auth/me", { headers: authHeaders(token) }),
  dashboard: (token) => request("/admin/dashboard", { headers: authHeaders(token) }),
  revenue: (token) => request("/admin/reports/revenue", { headers: authHeaders(token) }),
  adminOrders: (token) => request("/admin/orders", { headers: authHeaders(token) }),
  inventory: (token) => request("/admin/inventory", { headers: authHeaders(token) }),
  adminProducts: (token) => request("/admin/products", { headers: authHeaders(token) }),
  createProduct: (product, token) =>
    request("/admin/products", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(product)
    }),
  updateProduct: (productId, product, token) =>
    request(`/admin/products/${productId}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(product)
    }),
  updateStock: (variantId, stock, token) =>
    request(`/admin/inventory/${variantId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ stock })
    }),
  deleteProduct: (productId, token) =>
    request(`/admin/products/${productId}`, {
      method: "DELETE",
      headers: authHeaders(token)
    }),
  updateOrderStatus: (id, status, token) =>
    request(`/admin/orders/${id}/status`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ status })
    })
};
