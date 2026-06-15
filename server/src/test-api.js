import assert from "node:assert/strict";

const baseUrl = process.env.API_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const data = await response.json();
  return { status: response.status, data };
}

function post(path, body, headers = {}) {
  return request(path, { method: "POST", headers, body: JSON.stringify(body) });
}

console.log(`Testing ${baseUrl}`);

const categoriesResponse = await request("/categories");
assert.equal(categoriesResponse.status, 200);
assert.equal(categoriesResponse.data.length, 6);
assert.ok(categoriesResponse.data.some((group) => group.slug === "ao"));
assert.ok(
  categoriesResponse.data
    .find((group) => group.slug === "ao")
    .categories.some((category) => category.slug === "ao-kieu")
);
assert.ok(categoriesResponse.data.some((group) => group.slug === "vay-dam"));
assert.ok(categoriesResponse.data.some((group) => group.slug === "set-do"));
assert.ok(categoriesResponse.data.some((group) => group.slug === "ao-khoac"));
assert.ok(
  categoriesResponse.data.every(
    (group) =>
      !group.name.includes("&") &&
      group.categories.every((category) => !category.name.includes("&"))
  )
);

const vouchersResponse = await request("/vouchers");
assert.equal(vouchersResponse.status, 200);
assert.ok(vouchersResponse.data.some((voucher) => voucher.code === "THREAD10"));
console.log("PASS: category hierarchy and public vouchers");

const leadEmail = `qa-${Date.now()}@threadco.vn`;
const invalidLead = await post("/leads", {
  email: "khong-hop-le",
  consent: true
});
assert.equal(invalidLead.status, 400);
assert.equal(invalidLead.data.code, "INVALID_EMAIL");

const lead = await post("/leads", {
  name: "Khách QA",
  email: leadEmail,
  phone: "0901234567",
  consent: true,
  source: "api-test"
});
assert.equal(lead.status, 201);
assert.equal(lead.data.lead.email, leadEmail);
console.log("PASS: lead validation and lowdb persistence");

const productsResponse = await request("/products");
assert.equal(productsResponse.status, 200);
assert.equal(productsResponse.data.length, 42, "Expected 42 seeded products");
assert.ok(productsResponse.data.every((product) => product.variants.length > 0));
assert.ok(productsResponse.data.every((product) => !/\bnữ\b/iu.test(product.name)));
assert.ok(
  productsResponse.data.every(
    (product) =>
      product.images.length > 0 &&
      product.images.every((image) => image.startsWith("https://images.unsplash.com/"))
  )
);
const productCountByCategory = productsResponse.data.reduce((counts, product) => {
  counts[product.categoryId] = (counts[product.categoryId] || 0) + 1;
  return counts;
}, {});
assert.equal(Object.values(productCountByCategory).reduce((sum, count) => sum + count, 0), 42);
assert.ok(productsResponse.data.every((product) => product.category && product.categoryGroup));
const singleVariantProduct = productsResponse.data.find(
  (product) => product.variants.length === 1 && product.variants[0].stock > 0
);
assert.ok(singleVariantProduct, "Expected one in-stock single-variant product for quick add");
console.log(`PASS: product list (${productsResponse.data.length} products)`);

const filteredResponse = await request(
  "/products?category=ao-so-mi&size=M&color=C%C3%A1t&sort=price_asc"
);
assert.equal(filteredResponse.status, 200);
assert.ok(filteredResponse.data.length > 0, "Expected filtered products");
assert.ok(filteredResponse.data.every((product) => product.category.slug === "ao-so-mi"));
assert.ok(filteredResponse.data.every((product) => product.sizes.includes("M")));
assert.ok(filteredResponse.data.every((product) => product.colors.includes("Cát")));
console.log(`PASS: product filters (${filteredResponse.data.length} matches)`);

const groupFilterResponse = await request("/products?category=vay-dam");
assert.equal(groupFilterResponse.status, 200);
assert.ok(groupFilterResponse.data.length > 0);
assert.ok(
  groupFilterResponse.data.every(
    (product) => product.categoryGroup.slug === "vay-dam"
  )
);
for (const group of categoriesResponse.data) {
  const response = await request(`/products?category=${group.slug}`);
  assert.equal(response.status, 200);
  assert.ok(response.data.length > 0, `Expected products in ${group.slug}`);
  assert.ok(response.data.every((product) => product.categoryGroup.slug === group.slug));
}
console.log("PASS: product filter by all parent category groups");

const saleResponse = await request("/products?sale=true&sort=price_desc");
assert.equal(saleResponse.status, 200);
assert.ok(saleResponse.data.length > 0);
assert.ok(saleResponse.data.every((product) => product.isSale));
assert.ok(
  saleResponse.data.every(
    (product, index, products) => index === 0 || products[index - 1].price >= product.price
  )
);
console.log("PASS: sale filter and descending price sort");

const searchResponse = await request("/products?search=cong%20so");
assert.equal(searchResponse.status, 200);
assert.ok(searchResponse.data.length > 0, "Expected accent-insensitive search results");
assert.ok(
  searchResponse.data.some((product) =>
    [product.name, product.description, product.category?.name]
      .join(" ")
      .toLocaleLowerCase("vi")
      .includes("công sở")
  )
);

const emptySearchResponse = await request("/products?search=tu-khoa-khong-ton-tai-987654");
assert.equal(emptySearchResponse.status, 200);
assert.deepEqual(emptySearchResponse.data, []);
console.log(`PASS: product search (${searchResponse.data.length} matches)`);

const targetProduct = productsResponse.data.find((product) => product.slug === "linen-camp-shirt");
assert.ok(targetProduct, "Expected linen-camp-shirt seed product");

const detailBefore = await request(`/products/${targetProduct.id}`);
assert.equal(detailBefore.status, 200);
assert.equal(detailBefore.data.id, targetProduct.id);
assert.ok(detailBefore.data.category);
assert.ok(detailBefore.data.description.length > 40);
assert.ok(detailBefore.data.details?.material);
assert.ok(detailBefore.data.details?.fit);
assert.ok(detailBefore.data.details?.care);
const targetVariant = detailBefore.data.variants[0];
const stockBefore = targetVariant.stock;
console.log(`PASS: product detail (variant stock ${stockBefore})`);

const validOrderPayload = {
  customerName: "Nguyễn Minh Anh",
  phone: "090 123 4567",
  address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
  region: "HCM",
  paymentMethod: "COD",
  items: [{ variantId: targetVariant.id, quantity: 1 }]
};
const customerLogin = await post("/customer/login", {
  email: "customer@threadco.vn",
  password: "customer123"
});
assert.equal(customerLogin.status, 200);
assert.equal(customerLogin.data.user.role, "customer");
const customerHeaders = { Authorization: `Bearer ${customerLogin.data.token}` };

const registrationEmail = `customer-${Date.now()}@threadco.vn`;
const customerRegistration = await post("/customer/register", {
  name: "Khách Hàng QA",
  email: registrationEmail,
  phone: "0912345678",
  password: "password123"
});
assert.equal(customerRegistration.status, 201);
assert.equal(customerRegistration.data.user.email, registrationEmail);

const unauthorizedOrder = await post("/orders", validOrderPayload);
assert.equal(unauthorizedOrder.status, 401);
assert.equal(unauthorizedOrder.data.code, "AUTH_REQUIRED");
console.log("PASS: customer register/login and checkout authentication");

const validOrder = await post("/orders", validOrderPayload, customerHeaders);
assert.equal(validOrder.status, 201);
assert.equal(validOrder.data.items.length, 1);
assert.equal(validOrder.data.shippingFee, 0, "Order over 500,000 VND should have free shipping");
assert.equal(validOrder.data.total, targetProduct.price);
console.log(`PASS: valid order (${validOrder.data.id}) and free shipping`);

const detailAfter = await request(`/products/${targetProduct.slug}`);
const stockAfter = detailAfter.data.variants.find((variant) => variant.id === targetVariant.id).stock;
assert.equal(stockAfter, stockBefore - 1);
console.log(`PASS: stock reduced from ${stockBefore} to ${stockAfter}`);

const lowValueProduct = productsResponse.data.find((product) => product.slug === "washed-cotton-cap");
const lowValueVariant = lowValueProduct.variants[0];
const paidShippingOrder = await post("/orders", {
  ...validOrderPayload,
  region: "OTHER",
  paymentMethod: "BANK_TRANSFER",
  items: [{ variantId: lowValueVariant.id, quantity: 1 }]
}, customerHeaders);
assert.equal(paidShippingOrder.status, 201);
assert.equal(paidShippingOrder.data.shippingFee, 45000);
assert.equal(paidShippingOrder.data.total, lowValueProduct.price + 45000);
console.log("PASS: regional shipping fee for order below 500,000 VND");

const voucherProduct = productsResponse.data.find((product) => product.slug === "boxy-pocket-tee");
const voucherVariant = voucherProduct.variants[0];
const voucherOrder = await post("/orders", {
  ...validOrderPayload,
  region: "OTHER",
  voucherCode: "FREESHIP",
  items: [{ variantId: voucherVariant.id, quantity: 1 }]
}, customerHeaders);
assert.equal(voucherOrder.status, 201);
assert.equal(voucherOrder.data.shippingFee, 0);
assert.equal(voucherOrder.data.voucherCode, "FREESHIP");
assert.equal(voucherOrder.data.total, voucherProduct.price);

const invalidVoucherOrder = await post("/orders", {
  ...validOrderPayload,
  voucherCode: "KHONGTONTAI",
  items: [{ variantId: voucherVariant.id, quantity: 1 }]
}, customerHeaders);
assert.equal(invalidVoucherOrder.status, 400);
assert.equal(invalidVoucherOrder.data.code, "VOUCHER_NOT_FOUND");
console.log("PASS: voucher applies on checkout and invalid code is rejected");

const trackedOrder = await request(`/orders/track/${voucherOrder.data.id.toLowerCase()}`);
assert.equal(trackedOrder.status, 200);
assert.equal(trackedOrder.data.id, voucherOrder.data.id);
assert.equal(trackedOrder.data.status, "PENDING");
assert.equal(trackedOrder.data.items.length, 1);
assert.equal(trackedOrder.data.address, undefined);

const missingTrackedOrder = await request("/orders/track/TC-NOT-FOUND");
assert.equal(missingTrackedOrder.status, 404);
console.log("PASS: public order tracking returns safe order details");

const excessiveOrder = await post("/orders", {
  ...validOrderPayload,
  items: [{ variantId: targetVariant.id, quantity: stockAfter + 1 }]
}, customerHeaders);
assert.equal(excessiveOrder.status, 409);
assert.equal(excessiveOrder.data.code, "INSUFFICIENT_STOCK");

const detailAfterRejectedOrder = await request(`/products/${targetProduct.id}`);
const stockAfterRejectedOrder = detailAfterRejectedOrder.data.variants.find(
  (variant) => variant.id === targetVariant.id
).stock;
assert.equal(stockAfterRejectedOrder, stockAfter);
console.log("PASS: excessive order rejected without changing stock");

const invalidPhoneOrder = await post("/orders", {
  ...validOrderPayload,
  phone: "12345"
}, customerHeaders);
assert.equal(invalidPhoneOrder.status, 400);
assert.equal(invalidPhoneOrder.data.code, "INVALID_PHONE");

const detailAfterInvalidPhone = await request(`/products/${targetProduct.id}`);
const stockAfterInvalidPhone = detailAfterInvalidPhone.data.variants.find(
  (variant) => variant.id === targetVariant.id
).stock;
assert.equal(stockAfterInvalidPhone, stockAfter);
console.log("PASS: invalid Vietnamese phone rejected without changing stock");

const adminLogin = await post("/auth/login", {
  email: "admin@threadco.vn",
  password: "admin123"
});
assert.equal(adminLogin.status, 200);
assert.equal(adminLogin.data.user.role, "admin");

const staffLogin = await post("/auth/login", {
  email: "staff@threadco.vn",
  password: "staff123"
});
assert.equal(staffLogin.status, 200);
assert.equal(staffLogin.data.user.role, "staff");
console.log("PASS: bcrypt login for admin and staff");

const customerAdminAttempt = await request("/admin/dashboard", {
  headers: customerHeaders
});
assert.equal(customerAdminAttempt.status, 403);
assert.equal(customerAdminAttempt.data.code, "FORBIDDEN");
console.log("PASS: customer cannot access admin API");

const adminDashboard = await request("/admin/dashboard", {
  headers: { Authorization: `Bearer ${adminLogin.data.token}` }
});
assert.equal(adminDashboard.status, 200);
assert.ok(adminDashboard.data.totalOrders >= 2);

const staffRevenue = await request("/admin/reports/revenue", {
  headers: { Authorization: `Bearer ${staffLogin.data.token}` }
});
assert.equal(staffRevenue.status, 403);
assert.equal(staffRevenue.data.code, "FORBIDDEN");
console.log("PASS: admin can view revenue and staff receives 403");

const adminOrders = await request("/admin/orders", {
  headers: { Authorization: `Bearer ${staffLogin.data.token}` }
});
assert.equal(adminOrders.status, 200);
assert.ok(adminOrders.data.length >= 2);

const statusUpdate = await request(`/admin/orders/${validOrder.data.id}/status`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${staffLogin.data.token}` },
  body: JSON.stringify({ status: "COMPLETED" })
});
assert.equal(statusUpdate.status, 200);
assert.equal(statusUpdate.data.status, "COMPLETED");

const adminRevenue = await request("/admin/reports/revenue", {
  headers: { Authorization: `Bearer ${adminLogin.data.token}` }
});
assert.equal(adminRevenue.status, 200);
assert.ok(adminRevenue.data.revenue >= validOrder.data.total);
assert.ok(Number.isInteger(adminRevenue.data.averageOrderValue));
assert.equal(adminRevenue.data.totalProducts, 42);
assert.ok(adminRevenue.data.inventoryValue > 0);
assert.equal(adminRevenue.data.statusBreakdown.length, 5);
assert.ok(Array.isArray(adminRevenue.data.topProducts));

const inventory = await request("/admin/inventory", {
  headers: { Authorization: `Bearer ${adminLogin.data.token}` }
});
assert.equal(inventory.status, 200);
assert.ok(inventory.data.length >= 260);
assert.ok(inventory.data.every((variant) => variant.stockStatus));
assert.ok(inventory.data.every((variant) => Array.isArray(variant.sizes)));
assert.ok(inventory.data.some((variant) => variant.stockStatus === "OUT_OF_STOCK"));
console.log("PASS: staff order management and inventory API");

const editableVariant = inventory.data.find((variant) => variant.stock > 0);
const originalEditableStock = editableVariant.stock;
const stockUpdate = await request(`/admin/inventory/${editableVariant.id}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${staffLogin.data.token}` },
  body: JSON.stringify({ stock: originalEditableStock + 2 })
});
assert.equal(stockUpdate.status, 200);
assert.equal(stockUpdate.data.stock, originalEditableStock + 2);

const invalidStockUpdate = await request(`/admin/inventory/${editableVariant.id}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${staffLogin.data.token}` },
  body: JSON.stringify({ stock: -1 })
});
assert.equal(invalidStockUpdate.status, 400);
assert.equal(invalidStockUpdate.data.code, "INVALID_STOCK");
console.log("PASS: staff can update stock and invalid stock is rejected");

const staffProducts = await request("/admin/products", {
  headers: { Authorization: `Bearer ${staffLogin.data.token}` }
});
assert.equal(staffProducts.status, 403);

const productPayload = {
  name: "Áo kiểu kiểm thử",
  slug: `ao-kieu-kiem-thu-${Date.now()}`,
  categoryId: "cat-polos",
  description: "Sản phẩm dùng để kiểm thử đầy đủ thao tác quản trị.",
  price: 499000,
  oldPrice: 599000,
  images: [
    "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=1200&q=85"
  ],
  colors: ["Trắng", "Đen"],
  sizes: ["M"],
  isNew: true,
  isBestSeller: false,
  isSale: true,
  details: {
    material: "Cotton mềm.",
    fit: "Phom suông.",
    care: "Giặt nhẹ."
  },
  variants: [
    { size: "M", color: "Trắng", stock: 7, image: "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=1200&q=85" },
    { size: "M", color: "Đen", stock: 5, image: "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=1200&q=85" }
  ]
};

const staffCreateProduct = await post(
  "/admin/products",
  productPayload,
  { Authorization: `Bearer ${staffLogin.data.token}` }
);
assert.equal(staffCreateProduct.status, 403);

const createdProduct = await post(
  "/admin/products",
  productPayload,
  { Authorization: `Bearer ${adminLogin.data.token}` }
);
assert.equal(createdProduct.status, 201);
assert.equal(createdProduct.data.variants.length, 2);

const updatedProduct = await request(`/admin/products/${createdProduct.data.id}`, {
  method: "PUT",
  headers: { Authorization: `Bearer ${adminLogin.data.token}` },
  body: JSON.stringify({
    ...productPayload,
    name: "Áo kiểu kiểm thử đã sửa",
    price: 459000,
    variants: createdProduct.data.variants.map((variant, index) => ({
      ...variant,
      stock: index === 0 ? 9 : variant.stock
    }))
  })
});
assert.equal(updatedProduct.status, 200);
assert.equal(updatedProduct.data.name, "Áo kiểu kiểm thử đã sửa");
assert.equal(updatedProduct.data.price, 459000);
assert.equal(updatedProduct.data.variants[0].stock, 9);

const publicUpdatedProduct = await request(`/products/${createdProduct.data.id}`);
assert.equal(publicUpdatedProduct.status, 200);
assert.equal(publicUpdatedProduct.data.name, "Áo kiểu kiểm thử đã sửa");

const deletedCreatedProduct = await request(`/admin/products/${createdProduct.data.id}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${adminLogin.data.token}` }
});
assert.equal(deletedCreatedProduct.status, 200);
console.log("PASS: admin product CRUD and staff receives 403");

const staffDelete = await request("/admin/products/prod-belt", {
  method: "DELETE",
  headers: { Authorization: `Bearer ${staffLogin.data.token}` }
});
assert.equal(staffDelete.status, 403);

const adminDelete = await request("/admin/products/prod-belt", {
  method: "DELETE",
  headers: { Authorization: `Bearer ${adminLogin.data.token}` }
});
assert.equal(adminDelete.status, 200);
assert.ok(adminDelete.data.deletedVariantCount > 0);

const deletedProduct = await request("/products/prod-belt");
assert.equal(deletedProduct.status, 404);
console.log("PASS: only admin can delete a product and its variants");

const cancellableProduct = productsResponse.data.find((product) => product.slug === "boxy-pocket-tee");
const cancellableDetail = await request(`/products/${cancellableProduct.id}`);
const cancellableVariant = cancellableDetail.data.variants[0];
const cancellableStockBefore = cancellableVariant.stock;
const cancellableOrder = await post("/orders", {
  ...validOrderPayload,
  items: [{ variantId: cancellableVariant.id, quantity: 1 }]
}, customerHeaders);
assert.equal(cancellableOrder.status, 201);

const cancelResponse = await request(`/admin/orders/${cancellableOrder.data.id}/status`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${staffLogin.data.token}` },
  body: JSON.stringify({ status: "CANCELLED" })
});
assert.equal(cancelResponse.status, 200);

const stockAfterCancel = await request(`/products/${cancellableProduct.id}`);
assert.equal(
  stockAfterCancel.data.variants.find((variant) => variant.id === cancellableVariant.id).stock,
  cancellableStockBefore
);

const cancelAgain = await request(`/admin/orders/${cancellableOrder.data.id}/status`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${staffLogin.data.token}` },
  body: JSON.stringify({ status: "CANCELLED" })
});
assert.equal(cancelAgain.status, 200);

const stockAfterSecondCancel = await request(`/products/${cancellableProduct.id}`);
assert.equal(
  stockAfterSecondCancel.data.variants.find((variant) => variant.id === cancellableVariant.id).stock,
  cancellableStockBefore
);
console.log("PASS: cancelling an order restores stock exactly once");

console.log("All backend API tests passed.");
