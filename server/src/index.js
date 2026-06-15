import crypto from "node:crypto";
import bcrypt from "bcrypt";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import { db, databasePath } from "./db.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const jwtSecret = process.env.JWT_SECRET || "threadco-development-secret";
const validPaymentMethods = new Set(["COD", "BANK_TRANSFER"]);
const shippingFees = {
  HCM: 30000,
  HANOI: 35000,
  OTHER: 45000
};
const freeShippingThreshold = 500000;
const validOrderStatuses = new Set([
  "PENDING",
  "CONFIRMED",
  "SHIPPING",
  "COMPLETED",
  "CANCELLED"
]);
let databaseWriteQueue = Promise.resolve();

app.use(cors({ origin: clientUrl }));
app.use(express.json());

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.phone ? { phone: user.phone } : {})
  };
}

function createToken(user) {
  return jwt.sign(publicUser(user), jwtSecret, { expiresIn: "7d" });
}

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return res.status(401).json({ code: "AUTH_REQUIRED", message: "Bạn cần đăng nhập để tiếp tục." });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({
      code: "INVALID_TOKEN",
      message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
    });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return apiError(res, 403, "FORBIDDEN", "Không đủ quyền.");
    }
    next();
  };
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase("vi");
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function normalizePhone(value) {
  const compact = String(value || "").replace(/[\s().-]/g, "");

  if (compact.startsWith("+84")) {
    return `0${compact.slice(3)}`;
  }

  if (compact.startsWith("84")) {
    return `0${compact.slice(2)}`;
  }

  return compact;
}

function isValidVietnamesePhone(phone) {
  return /^0(?:3|5|7|8|9)\d{8}$/.test(phone);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRegion(value) {
  const region = normalizeText(value).replace(/\s+/g, "");

  if (["hcm", "tphcm", "hochiminh", "saigon"].includes(region)) return "HCM";
  if (["hanoi", "hn"].includes(region)) return "HANOI";
  if (["other", "khac", "tinhkhac"].includes(region)) return "OTHER";
  return null;
}

function enrichProduct(product) {
  const category = db.data.categories.find((item) => item.id === product.categoryId) || null;
  const categoryGroup =
    db.data.categoryGroups.find((item) => item.id === category?.groupId) || null;
  const variants = db.data.variants.filter((variant) => variant.productId === product.id);

  return { ...product, category, categoryGroup, variants };
}

function validateProductInput(body, existingProduct = null) {
  const name = body.name?.trim();
  const slug = body.slug?.trim().toLowerCase();
  const categoryId = body.categoryId?.trim();
  const description = body.description?.trim();
  const price = Number(body.price);
  const oldPrice =
    body.oldPrice === null || body.oldPrice === undefined || body.oldPrice === ""
      ? null
      : Number(body.oldPrice);
  const images = Array.isArray(body.images)
    ? [...new Set(body.images.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  const sizes = Array.isArray(body.sizes)
    ? [...new Set(body.sizes.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  const colors = Array.isArray(body.colors)
    ? [...new Set(body.colors.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  const variants = Array.isArray(body.variants) ? body.variants : [];

  if (!name || name.length < 2) {
    throw Object.assign(new Error("Tên sản phẩm phải có ít nhất 2 ký tự."), {
      status: 400,
      code: "INVALID_PRODUCT_NAME"
    });
  }
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw Object.assign(new Error("Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang."), {
      status: 400,
      code: "INVALID_PRODUCT_SLUG"
    });
  }
  if (db.data.products.some((item) => item.slug === slug && item.id !== existingProduct?.id)) {
    throw Object.assign(new Error("Slug sản phẩm đã tồn tại."), {
      status: 409,
      code: "PRODUCT_SLUG_EXISTS"
    });
  }
  if (!db.data.categories.some((item) => item.id === categoryId)) {
    throw Object.assign(new Error("Danh mục sản phẩm không hợp lệ."), {
      status: 400,
      code: "INVALID_PRODUCT_CATEGORY"
    });
  }
  if (!description || description.length < 10) {
    throw Object.assign(new Error("Mô tả sản phẩm phải có ít nhất 10 ký tự."), {
      status: 400,
      code: "INVALID_PRODUCT_DESCRIPTION"
    });
  }
  if (!Number.isInteger(price) || price < 0) {
    throw Object.assign(new Error("Giá bán phải là số nguyên không âm."), {
      status: 400,
      code: "INVALID_PRODUCT_PRICE"
    });
  }
  if (oldPrice !== null && (!Number.isInteger(oldPrice) || oldPrice < price)) {
    throw Object.assign(new Error("Giá cũ phải là số nguyên và không nhỏ hơn giá bán."), {
      status: 400,
      code: "INVALID_PRODUCT_OLD_PRICE"
    });
  }
  if (!images.length || !images.every((image) => /^https?:\/\//i.test(image))) {
    throw Object.assign(new Error("Sản phẩm cần ít nhất một URL ảnh hợp lệ."), {
      status: 400,
      code: "INVALID_PRODUCT_IMAGES"
    });
  }
  if (!sizes.length || !colors.length) {
    throw Object.assign(new Error("Sản phẩm cần ít nhất một kích thước và một màu."), {
      status: 400,
      code: "INVALID_PRODUCT_OPTIONS"
    });
  }
  if (variants.length !== sizes.length * colors.length) {
    throw Object.assign(new Error("Danh sách biến thể phải đủ mọi tổ hợp kích thước và màu."), {
      status: 400,
      code: "INVALID_PRODUCT_VARIANTS"
    });
  }

  const combinations = new Set();
  const normalizedVariants = variants.map((variant, index) => {
    const size = String(variant.size || "").trim();
    const color = String(variant.color || "").trim();
    const stock = Number(variant.stock);
    const image = String(variant.image || images[index % images.length]).trim();
    const key = `${size}\u0000${color}`;

    if (
      !sizes.includes(size) ||
      !colors.includes(color) ||
      combinations.has(key) ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      stock > 99999 ||
      !/^https?:\/\//i.test(image)
    ) {
      throw Object.assign(new Error("Dữ liệu biến thể không hợp lệ hoặc bị trùng."), {
        status: 400,
        code: "INVALID_PRODUCT_VARIANT"
      });
    }
    combinations.add(key);
    return {
      id:
        existingProduct &&
        db.data.variants.some(
          (item) => item.id === variant.id && item.productId === existingProduct.id
        )
          ? variant.id
          : `var-${crypto.randomUUID()}`,
      productId: existingProduct?.id || null,
      size,
      color,
      stock,
      image
    };
  });

  return {
    product: {
      name,
      slug,
      categoryId,
      description,
      price,
      oldPrice,
      images,
      colors,
      sizes,
      isNew: Boolean(body.isNew),
      isBestSeller: Boolean(body.isBestSeller),
      isSale: Boolean(body.isSale || oldPrice !== null),
      details: {
        material: body.details?.material?.trim() || "",
        fit: body.details?.fit?.trim() || "",
        care: body.details?.care?.trim() || ""
      }
    },
    variants: normalizedVariants
  };
}

function isVoucherAvailable(voucher) {
  return voucher.active && new Date(voucher.expiresAt).getTime() >= Date.now();
}

function calculateVoucher(voucher, subtotal, shippingFee) {
  if (!voucher) return { discount: 0, shippingFee };
  if (!isVoucherAvailable(voucher)) {
    const error = new Error("Voucher đã hết hạn hoặc ngừng áp dụng.");
    error.status = 400;
    error.code = "VOUCHER_UNAVAILABLE";
    throw error;
  }
  if (subtotal < voucher.minOrder) {
    const error = new Error(
      `Voucher ${voucher.code} yêu cầu đơn tối thiểu ${voucher.minOrder.toLocaleString("vi-VN")}đ.`
    );
    error.status = 400;
    error.code = "VOUCHER_MIN_ORDER";
    throw error;
  }

  if (voucher.type === "FREE_SHIPPING") {
    return { discount: 0, shippingFee: 0 };
  }

  const rawDiscount =
    voucher.type === "PERCENT"
      ? Math.floor((subtotal * voucher.value) / 100)
      : voucher.value;
  const discount = Math.min(
    rawDiscount,
    voucher.maxDiscount || rawDiscount,
    subtotal
  );
  return { discount, shippingFee };
}

function queueDatabaseWrite(task) {
  const result = databaseWriteQueue.then(task, task);
  databaseWriteQueue = result.catch(() => {});
  return result;
}

function apiError(res, status, code, message, details) {
  return res.status(status).json({
    code,
    message,
    ...(details ? { details } : {})
  });
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get("/api/health", asyncHandler(async (_req, res) => {
  await db.read();
  res.json({
    status: "ok",
    service: "threadco-api",
    database: {
      status: "connected",
      engine: "lowdb",
      file: databasePath,
      records: {
        users: db.data.users.length,
        products: db.data.products.length,
        variants: db.data.variants.length,
        orders: db.data.orders.length
      }
    },
    timestamp: new Date().toISOString()
  });
}));

app.get("/api/categories", asyncHandler(async (_req, res) => {
  await db.read();
  const groups = db.data.categoryGroups.map((group) => ({
    ...group,
    categories: db.data.categories.filter((category) => category.groupId === group.id)
  }));
  res.json(groups);
}));

app.get("/api/vouchers", asyncHandler(async (_req, res) => {
  await db.read();
  res.json(db.data.vouchers.filter(isVoucherAvailable));
}));

app.get("/api/products", asyncHandler(async (req, res) => {
  await db.read();

  const categoryFilter = normalizeText(req.query.category);
  const sizeFilter = normalizeText(req.query.size);
  const colorFilter = normalizeText(req.query.color);
  const searchFilter = normalizeSearchText(req.query.search);
  const saleValue = req.query.sale === undefined ? null : normalizeText(req.query.sale);
  const sort = req.query.sort || "newest";

  if (saleValue !== null && !["true", "false", "1", "0"].includes(saleValue)) {
    return apiError(
      res,
      400,
      "INVALID_SALE_FILTER",
      "Giá trị sale phải là true, false, 1 hoặc 0."
    );
  }

  const saleFilter = saleValue === null ? null : ["true", "1"].includes(saleValue);

  let products = db.data.products.filter((product) => {
    const category = db.data.categories.find((item) => item.id === product.categoryId);
    const group = db.data.categoryGroups.find((item) => item.id === category?.groupId);
    const matchesCategory =
      !categoryFilter ||
      [category?.id, category?.slug, category?.name, group?.id, group?.slug, group?.name].some(
        (value) => normalizeText(value) === categoryFilter
      );
    const matchesSize =
      !sizeFilter || product.sizes.some((size) => normalizeText(size) === sizeFilter);
    const matchesColor =
      !colorFilter || product.colors.some((color) => normalizeText(color) === colorFilter);
    const matchesSale = saleFilter === null || product.isSale === saleFilter;
    const searchableText = normalizeSearchText([
      product.name,
      product.slug,
      product.description,
      category?.name,
      group?.name,
      ...product.sizes,
      ...product.colors
    ].join(" "));
    const matchesSearch = !searchFilter || searchableText.includes(searchFilter);

    return matchesCategory && matchesSize && matchesColor && matchesSale && matchesSearch;
  });

  const sorters = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    bestseller: (a, b) =>
      Number(b.isBestSeller) - Number(a.isBestSeller) || b.createdAt.localeCompare(a.createdAt)
  };

  if (!sorters[sort]) {
    return apiError(
      res,
      400,
      "INVALID_SORT",
      "Giá trị sort không hợp lệ.",
      { allowed: Object.keys(sorters) }
    );
  }

  products = products.toSorted(sorters[sort]).map(enrichProduct);
  res.json(products);
}));

app.get("/api/products/:id", asyncHandler(async (req, res) => {
  await db.read();
  const product = db.data.products.find(
    (item) => item.id === req.params.id || item.slug === req.params.id
  );

  if (!product) {
    return apiError(res, 404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.");
  }

  res.json(enrichProduct(product));
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  await db.read();
  const user = db.data.users.find((item) => item.email === email);

  if (
    !user ||
    !["admin", "staff"].includes(user.role) ||
    !password ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    return apiError(res, 401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
  }

  res.json({ user: publicUser(user), token: createToken(user) });
}));

app.post("/api/customer/register", asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const phone = normalizePhone(req.body.phone);
  const password = String(req.body.password || "");

  if (!name || name.length < 2) {
    return apiError(res, 400, "INVALID_CUSTOMER_NAME", "Họ tên phải có ít nhất 2 ký tự.");
  }
  if (!isValidEmail(email)) {
    return apiError(res, 400, "INVALID_EMAIL", "Email không hợp lệ.");
  }
  if (!isValidVietnamesePhone(phone)) {
    return apiError(res, 400, "INVALID_PHONE", "Số điện thoại Việt Nam không hợp lệ.");
  }
  if (password.length < 8) {
    return apiError(res, 400, "WEAK_PASSWORD", "Mật khẩu phải có ít nhất 8 ký tự.");
  }

  const user = await queueDatabaseWrite(async () => {
    await db.read();
    if (db.data.users.some((item) => item.email === email)) {
      const error = new Error("Email đã được sử dụng.");
      error.status = 409;
      error.code = "EMAIL_EXISTS";
      throw error;
    }

    const newUser = {
      id: `customer-${crypto.randomUUID()}`,
      name,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 10),
      role: "customer",
      createdAt: new Date().toISOString()
    };
    const previousData = db.data;
    db.data = { ...db.data, users: [...db.data.users, newUser] };

    try {
      await db.write();
    } catch (error) {
      db.data = previousData;
      throw error;
    }
    return newUser;
  });

  res.status(201).json({ user: publicUser(user), token: createToken(user) });
}));

app.post("/api/customer/login", asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  await db.read();
  const user = db.data.users.find(
    (item) => item.email === email && item.role === "customer"
  );

  if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
    return apiError(res, 401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
  }

  res.json({ user: publicUser(user), token: createToken(user) });
}));

app.get(
  "/api/customer/me",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
    await db.read();
    const user = db.data.users.find(
      (item) => item.id === req.user.id && item.role === "customer"
    );
    if (!user) {
      return apiError(res, 404, "USER_NOT_FOUND", "Không tìm thấy tài khoản khách hàng.");
    }
    res.json(publicUser(user));
  })
);

app.post("/api/leads", asyncHandler(async (req, res) => {
  const name = req.body.name?.trim() || "";
  const email = req.body.email?.trim().toLowerCase();
  const phone = req.body.phone ? normalizePhone(req.body.phone) : "";
  const source = req.body.source?.trim() || "footer";

  if (!isValidEmail(email)) {
    return apiError(res, 400, "INVALID_EMAIL", "Vui lòng nhập email hợp lệ.");
  }
  if (phone && !isValidVietnamesePhone(phone)) {
    return apiError(res, 400, "INVALID_PHONE", "Số điện thoại Việt Nam không hợp lệ.");
  }
  if (req.body.consent !== true) {
    return apiError(
      res,
      400,
      "CONSENT_REQUIRED",
      "Bạn cần đồng ý nhận thông tin ưu đãi."
    );
  }

  const result = await queueDatabaseWrite(async () => {
    await db.read();
    const existing = db.data.leads.find((item) => item.email === email);
    if (existing) return { lead: existing, created: false };

    const lead = {
      id: `lead-${crypto.randomUUID()}`,
      name,
      email,
      phone,
      source,
      consent: true,
      createdAt: new Date().toISOString()
    };
    const previousData = db.data;
    db.data = { ...db.data, leads: [...db.data.leads, lead] };
    try {
      await db.write();
    } catch (error) {
      db.data = previousData;
      throw error;
    }
    return { lead, created: true };
  });

  res.status(result.created ? 201 : 200).json({
    message: result.created
      ? "Đăng ký nhận ưu đãi thành công."
      : "Email này đã nằm trong danh sách nhận ưu đãi.",
    lead: { id: result.lead.id, email: result.lead.email }
  });
}));

app.get("/api/auth/me", authenticate, asyncHandler(async (req, res) => {
  await db.read();
  const user = db.data.users.find((item) => item.id === req.user.id);

  if (!user) {
    return apiError(res, 404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");
  }

  res.json(publicUser(user));
}));

app.get(
  "/api/admin/dashboard",
  authenticate,
  authorize("admin", "staff"),
  asyncHandler(async (_req, res) => {
    await db.read();
    const lowStockVariants = db.data.variants.filter((variant) => variant.stock <= 5);

    res.json({
      totalOrders: db.data.orders.length,
      pendingOrders: db.data.orders.filter((order) => order.status === "PENDING").length,
      lowStockVariants: lowStockVariants.length,
      outOfStockVariants: lowStockVariants.filter((variant) => variant.stock === 0).length
    });
  })
);

app.get(
  "/api/admin/reports/revenue",
  authenticate,
  authorize("admin"),
  asyncHandler(async (_req, res) => {
    await db.read();
    const completedOrders = db.data.orders.filter((order) => order.status === "COMPLETED");
    const activeOrders = db.data.orders.filter((order) => order.status !== "CANCELLED");
    const revenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
    const totalStockUnits = db.data.variants.reduce((sum, variant) => sum + variant.stock, 0);
    const inventoryValue = db.data.variants.reduce((sum, variant) => {
      const product = db.data.products.find((item) => item.id === variant.productId);
      return sum + variant.stock * (product?.price || 0);
    }, 0);
    const statusBreakdown = [...validOrderStatuses].map((status) => ({
      status,
      count: db.data.orders.filter((order) => order.status === status).length
    }));
    const soldByProduct = new Map();

    for (const item of db.data.order_items) {
      const order = activeOrders.find((entry) => entry.id === item.orderId);
      if (!order) continue;
      const current = soldByProduct.get(item.productId) || {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        sales: 0
      };
      current.quantity += item.quantity;
      current.sales += item.quantity * item.price;
      soldByProduct.set(item.productId, current);
    }

    res.json({
      revenue,
      completedOrders: completedOrders.length,
      averageOrderValue: completedOrders.length ? Math.round(revenue / completedOrders.length) : 0,
      activeOrders: activeOrders.length,
      cancelledOrders: db.data.orders.length - activeOrders.length,
      totalProducts: db.data.products.length,
      totalStockUnits,
      inventoryValue,
      statusBreakdown,
      topProducts: [...soldByProduct.values()]
        .toSorted((a, b) => b.quantity - a.quantity || b.sales - a.sales)
        .slice(0, 5)
    });
  })
);

app.get(
  "/api/admin/orders",
  authenticate,
  authorize("admin", "staff"),
  asyncHandler(async (_req, res) => {
    await db.read();
    const orders = db.data.orders
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((order) => ({
        ...order,
        items: db.data.order_items.filter((item) => item.orderId === order.id)
      }));
    res.json(orders);
  })
);

app.get(
  "/api/admin/orders/:id",
  authenticate,
  authorize("admin", "staff"),
  asyncHandler(async (req, res) => {
    await db.read();
    const order = db.data.orders.find((item) => item.id === req.params.id);

    if (!order) {
      return apiError(res, 404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.");
    }

    res.json({
      ...order,
      items: db.data.order_items.filter((item) => item.orderId === order.id)
    });
  })
);

app.patch(
  "/api/admin/orders/:id/status",
  authenticate,
  authorize("admin", "staff"),
  asyncHandler(async (req, res) => {
    const status = req.body.status;

    if (!validOrderStatuses.has(status)) {
      return apiError(res, 400, "INVALID_ORDER_STATUS", "Trạng thái đơn hàng không hợp lệ.", {
        allowed: [...validOrderStatuses]
      });
    }

    const updatedOrder = await queueDatabaseWrite(async () => {
      await db.read();
      const order = db.data.orders.find((item) => item.id === req.params.id);

      if (!order) {
        const error = new Error("Không tìm thấy đơn hàng.");
        error.status = 404;
        error.code = "ORDER_NOT_FOUND";
        throw error;
      }

      if (order.status === "CANCELLED" && status !== "CANCELLED") {
        const error = new Error("Đơn đã hủy không thể chuyển sang trạng thái khác.");
        error.status = 409;
        error.code = "CANCELLED_ORDER_LOCKED";
        throw error;
      }

      const shouldRestoreStock = status === "CANCELLED" && order.status !== "CANCELLED";
      const orderItems = db.data.order_items.filter((item) => item.orderId === order.id);
      const previousData = db.data;
      const nextVariants = shouldRestoreStock
        ? db.data.variants.map((variant) => {
            const orderItem = orderItems.find((item) => item.variantId === variant.id);
            return orderItem
              ? { ...variant, stock: variant.stock + orderItem.quantity }
              : variant;
          })
        : db.data.variants;
      const nextOrder = { ...order, status };

      db.data = {
        ...db.data,
        variants: nextVariants,
        orders: db.data.orders.map((item) => (item.id === order.id ? nextOrder : item))
      };

      try {
        await db.write();
      } catch (error) {
        db.data = previousData;
        throw error;
      }

      return { ...nextOrder, items: orderItems };
    });

    res.json(updatedOrder);
  })
);

app.get(
  "/api/admin/inventory",
  authenticate,
  authorize("admin", "staff"),
  asyncHandler(async (_req, res) => {
    await db.read();
    const inventory = db.data.variants
      .map((variant) => {
        const product = db.data.products.find((item) => item.id === variant.productId);
        return {
          ...variant,
          productName: product?.name || "Sản phẩm không tồn tại",
          productSlug: product?.slug || null,
          productImage: product?.images?.[0] || variant.image,
          sizes: product?.sizes || [],
          colors: product?.colors || [],
          stockStatus: variant.stock === 0 ? "OUT_OF_STOCK" : variant.stock <= 5 ? "LOW_STOCK" : "IN_STOCK"
        };
      })
      .toSorted((a, b) => a.stock - b.stock || a.productName.localeCompare(b.productName, "vi"));
    res.json(inventory);
  })
);

app.get(
  "/api/admin/products",
  authenticate,
  authorize("admin"),
  asyncHandler(async (_req, res) => {
    await db.read();
    res.json(
      db.data.products
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(enrichProduct)
    );
  })
);

app.post(
  "/api/admin/products",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const created = await queueDatabaseWrite(async () => {
      await db.read();
      const { product: input, variants } = validateProductInput(req.body);
      const product = {
        id: `prod-${crypto.randomUUID()}`,
        ...input,
        createdAt: new Date().toISOString()
      };
      const nextVariants = variants.map((variant) => ({
        ...variant,
        productId: product.id
      }));
      const previousData = db.data;
      db.data = {
        ...db.data,
        products: [...db.data.products, product],
        variants: [...db.data.variants, ...nextVariants]
      };
      try {
        await db.write();
      } catch (error) {
        db.data = previousData;
        throw error;
      }
      return enrichProduct(product);
    });

    res.status(201).json(created);
  })
);

app.put(
  "/api/admin/products/:productId",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const updated = await queueDatabaseWrite(async () => {
      await db.read();
      const existing = db.data.products.find((item) => item.id === req.params.productId);
      if (!existing) {
        const error = new Error("Không tìm thấy sản phẩm.");
        error.status = 404;
        error.code = "PRODUCT_NOT_FOUND";
        throw error;
      }

      const { product: input, variants } = validateProductInput(req.body, existing);
      const product = { ...existing, ...input };
      const nextVariants = variants.map((variant) => ({
        ...variant,
        productId: existing.id
      }));
      const previousData = db.data;
      db.data = {
        ...db.data,
        products: db.data.products.map((item) => (item.id === existing.id ? product : item)),
        variants: [
          ...db.data.variants.filter((variant) => variant.productId !== existing.id),
          ...nextVariants
        ]
      };
      try {
        await db.write();
      } catch (error) {
        db.data = previousData;
        throw error;
      }
      return enrichProduct(product);
    });

    res.json(updated);
  })
);

app.patch(
  "/api/admin/inventory/:variantId",
  authenticate,
  authorize("admin", "staff"),
  asyncHandler(async (req, res) => {
    const stock = Number(req.body.stock);

    if (!Number.isInteger(stock) || stock < 0 || stock > 99999) {
      return apiError(
        res,
        400,
        "INVALID_STOCK",
        "Tồn kho phải là số nguyên từ 0 đến 99.999."
      );
    }

    const updatedVariant = await queueDatabaseWrite(async () => {
      await db.read();
      const variant = db.data.variants.find((item) => item.id === req.params.variantId);

      if (!variant) {
        const error = new Error("Không tìm thấy biến thể.");
        error.status = 404;
        error.code = "VARIANT_NOT_FOUND";
        throw error;
      }

      const previousData = db.data;
      const nextVariant = { ...variant, stock };
      db.data = {
        ...db.data,
        variants: db.data.variants.map((item) =>
          item.id === variant.id ? nextVariant : item
        )
      };

      try {
        await db.write();
      } catch (error) {
        db.data = previousData;
        throw error;
      }

      return nextVariant;
    });

    res.json(updatedVariant);
  })
);

app.delete(
  "/api/admin/products/:productId",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const result = await queueDatabaseWrite(async () => {
      await db.read();
      const product = db.data.products.find((item) => item.id === req.params.productId);

      if (!product) {
        const error = new Error("Không tìm thấy sản phẩm.");
        error.status = 404;
        error.code = "PRODUCT_NOT_FOUND";
        throw error;
      }

      const previousData = db.data;
      const deletedVariantCount = db.data.variants.filter(
        (variant) => variant.productId === product.id
      ).length;

      db.data = {
        ...db.data,
        products: db.data.products.filter((item) => item.id !== product.id),
        variants: db.data.variants.filter((variant) => variant.productId !== product.id)
      };

      try {
        await db.write();
      } catch (error) {
        db.data = previousData;
        throw error;
      }

      return { productId: product.id, deletedVariantCount };
    });

    res.json({
      message: "Đã xóa sản phẩm và các biến thể khỏi kho.",
      ...result
    });
  })
);

app.get("/api/orders/track/:orderId", asyncHandler(async (req, res) => {
  await db.read();
  const orderId = req.params.orderId.trim().toUpperCase();
  const order = db.data.orders.find((item) => item.id.toUpperCase() === orderId);

  if (!order) {
    return apiError(
      res,
      404,
      "ORDER_NOT_FOUND",
      "Không tìm thấy đơn hàng với mã đã nhập."
    );
  }

  const items = db.data.order_items
    .filter((item) => item.orderId === order.id)
    .map(({ productName, size, color, quantity, price }) => ({
      productName,
      size,
      color,
      quantity,
      price
    }));

  res.json({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal ?? order.total - order.shippingFee,
    shippingFee: order.shippingFee,
    discount: order.discount || 0,
    voucherCode: order.voucherCode || null,
    total: order.total,
    items
  });
}));

app.post(
  "/api/orders",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
  const customerName = req.body.customerName?.trim();
  const phone = normalizePhone(req.body.phone);
  const address = req.body.address?.trim();
  const region = normalizeRegion(req.body.region);
  const paymentMethod = req.body.paymentMethod;
  const voucherCode = req.body.voucherCode?.trim().toUpperCase() || null;
  const requestedItems = req.body.items;

  if (!customerName || customerName.length < 2) {
    return apiError(res, 400, "INVALID_CUSTOMER_NAME", "Tên khách hàng phải có ít nhất 2 ký tự.");
  }

  if (!isValidVietnamesePhone(phone)) {
    return apiError(
      res,
      400,
      "INVALID_PHONE",
      "Số điện thoại Việt Nam không hợp lệ. Ví dụ: 0901234567."
    );
  }

  if (!address || address.length < 10) {
    return apiError(res, 400, "INVALID_ADDRESS", "Địa chỉ phải có ít nhất 10 ký tự.");
  }

  if (!region) {
    return apiError(
      res,
      400,
      "INVALID_REGION",
      "Vùng giao hàng không hợp lệ.",
      { allowed: Object.keys(shippingFees) }
    );
  }

  if (!validPaymentMethods.has(paymentMethod)) {
    return apiError(
      res,
      400,
      "INVALID_PAYMENT_METHOD",
      "Phương thức thanh toán không hợp lệ.",
      { allowed: [...validPaymentMethods] }
    );
  }

  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    return apiError(res, 400, "EMPTY_ORDER", "Đơn hàng phải có ít nhất một sản phẩm.");
  }

  const quantitiesByVariant = new Map();

  for (const item of requestedItems) {
    const quantity = Number(item.quantity);

    if (!item.variantId || !Number.isInteger(quantity) || quantity < 1) {
      return apiError(
        res,
        400,
        "INVALID_ORDER_ITEM",
        "Mỗi sản phẩm cần có variantId và quantity là số nguyên dương."
      );
    }

    quantitiesByVariant.set(
      item.variantId,
      (quantitiesByVariant.get(item.variantId) || 0) + quantity
    );
  }

  try {
    const result = await queueDatabaseWrite(async () => {
      await db.read();

      const preparedItems = [];

      for (const [variantId, quantity] of quantitiesByVariant) {
        const variant = db.data.variants.find((item) => item.id === variantId);

        if (!variant) {
          const error = new Error(`Không tìm thấy biến thể ${variantId}.`);
          error.status = 404;
          error.code = "VARIANT_NOT_FOUND";
          error.details = { variantId };
          throw error;
        }

        const product = db.data.products.find((item) => item.id === variant.productId);

        if (!product) {
          const error = new Error(`Sản phẩm của biến thể ${variantId} không tồn tại.`);
          error.status = 409;
          error.code = "PRODUCT_DATA_ERROR";
          throw error;
        }

        if (quantity > variant.stock) {
          const error = new Error(
            `${product.name} - ${variant.size} / ${variant.color} chỉ còn ${variant.stock} sản phẩm.`
          );
          error.status = 409;
          error.code = "INSUFFICIENT_STOCK";
          error.details = {
            variantId,
            requestedQuantity: quantity,
            availableStock: variant.stock
          };
          throw error;
        }

        preparedItems.push({ product, variant, quantity });
      }

      const subtotal = preparedItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const baseShippingFee = subtotal >= freeShippingThreshold ? 0 : shippingFees[region];
      const voucher = voucherCode
        ? db.data.vouchers.find((item) => item.code === voucherCode)
        : null;

      if (voucherCode && !voucher) {
        const error = new Error("Mã voucher không tồn tại.");
        error.status = 400;
        error.code = "VOUCHER_NOT_FOUND";
        throw error;
      }

      const voucherResult = calculateVoucher(voucher, subtotal, baseShippingFee);
      const shippingFee = voucherResult.shippingFee;
      const discount = voucherResult.discount;
      const orderId = `TC-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      const createdAt = new Date().toISOString();
      const order = {
        id: orderId,
        customerId: req.user.id,
        customerName,
        phone,
        address,
        region,
        paymentMethod,
        shippingFee,
        subtotal,
        discount,
        voucherCode: voucher?.code || null,
        total: subtotal - discount + shippingFee,
        status: "PENDING",
        createdAt
      };
      const orderItems = preparedItems.map(({ product, variant, quantity }) => ({
        id: crypto.randomUUID(),
        orderId,
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        size: variant.size,
        color: variant.color,
        quantity,
        price: product.price
      }));

      const previousData = db.data;
      const nextVariants = db.data.variants.map((variant) => {
        const orderedItem = preparedItems.find((item) => item.variant.id === variant.id);
        return orderedItem
          ? { ...variant, stock: variant.stock - orderedItem.quantity }
          : variant;
      });

      db.data = {
        ...db.data,
        variants: nextVariants,
        orders: [...db.data.orders, order],
        order_items: [...db.data.order_items, ...orderItems]
      };

      try {
        await db.write();
      } catch (error) {
        db.data = previousData;
        throw error;
      }

      return { ...order, items: orderItems };
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.code && error.status) {
      return apiError(res, error.status, error.code, error.message, error.details);
    }
    throw error;
  }
  })
);

app.use((req, res) => {
  apiError(res, 404, "ROUTE_NOT_FOUND", `Không tìm thấy ${req.method} ${req.path}.`);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.status && error.code) {
    return apiError(res, error.status, error.code, error.message, error.details);
  }
  apiError(res, 500, "INTERNAL_SERVER_ERROR", "Máy chủ gặp lỗi. Vui lòng thử lại.");
});

app.listen(port, () => {
  console.log(`THREAD & CO API is running at http://localhost:${port}`);
});
