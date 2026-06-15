import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
const shippingFees = { HCM: 30000, HANOI: 35000, OTHER: 45000 };
const productFallback = "/product-fallback.svg";
const storePhone = import.meta.env.VITE_STORE_PHONE || "0901234567";
const storePhoneLabel = import.meta.env.VITE_STORE_PHONE_LABEL || "0901 234 567";
const zaloUrl = import.meta.env.VITE_ZALO_URL || `https://zalo.me/${storePhone}`;
const statusLabels = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Hủy"
};

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const update = () => setRoute(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}

function go(path) {
  window.location.hash = path;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goToShopFilter(path) {
  const currentPath = (window.location.hash.slice(1) || "/").split("?")[0];
  if (currentPath === "/shop") {
    const nextUrl = `${window.location.pathname}${window.location.search}#${path}`;
    window.history.pushState(null, "", nextUrl);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  go(path);
}

function useProductFallback(event) {
  if (event.currentTarget.dataset.fallbackApplied) return;
  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = productFallback;
}

export default function App() {
  const route = useHashRoute();
  const [products, setProducts] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [catalogState, setCatalogState] = useState({ loading: true, error: "" });
  const [cart, setCart] = useState(() => readStorage("threadco_cart", []));
  const [favorites, setFavorites] = useState(() => readStorage("threadco_favorites", []));
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerSession, setCustomerSession] = useState(() =>
    readStorage("threadco_customer", null)
  );
  const [toast, setToast] = useState(null);

  const refreshProducts = async (params) => {
    setCatalogState({ loading: true, error: "" });
    try {
      const data = await api.products(params);
      setProducts(data);
      setCatalogState({ loading: false, error: "" });
      return data;
    } catch (error) {
      setCatalogState({ loading: false, error: error.message });
      return [];
    }
  };

  useEffect(() => {
    refreshProducts();
    api.categories().then(setCategoryGroups).catch(() => {});
    api.vouchers().then(setVouchers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!customerSession?.token) return;
    api.customerMe(customerSession.token).catch(() => {
      localStorage.removeItem("threadco_customer");
      setCustomerSession(null);
    });
  }, [customerSession?.token]);

  useEffect(() => {
    if (!products.length) return;

    const productIds = new Set(products.map((product) => product.id));
    setFavorites((current) => current.filter((productId) => productIds.has(productId)));
    setCart((current) =>
      current
        .map((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          const variant = product?.variants.find((entry) => entry.id === item.variantId);

          if (!product || !variant || variant.stock < 1) return null;

          return {
            ...item,
            name: product.name,
            image: variant.image || product.images[0],
            price: product.price,
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
            quantity: Math.min(item.quantity, variant.stock)
          };
        })
        .filter(Boolean)
    );
  }, [products]);

  useEffect(() => localStorage.setItem("threadco_cart", JSON.stringify(cart)), [cart]);
  useEffect(
    () => localStorage.setItem("threadco_favorites", JSON.stringify(favorites)),
    [favorites]
  );
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message, type = "success") => setToast({ message, type });
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product, variant, quantity = 1) {
    if (!variant || variant.stock < 1) {
      notify("Biến thể này hiện đã hết hàng.", "error");
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.variantId === variant.id);
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + quantity, variant.stock);
        if (nextQuantity === existing.quantity) {
          notify(`Chỉ còn ${variant.stock} sản phẩm trong kho.`, "error");
        }
        return current.map((item) =>
          item.variantId === variant.id
            ? { ...item, quantity: nextQuantity, stock: variant.stock }
            : item
        );
      }
      return [
        ...current,
        {
          variantId: variant.id,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image: variant.image || product.images[0],
          price: product.price,
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
          quantity: Math.min(quantity, variant.stock)
        }
      ];
    });
    notify(`${product.name} đã được thêm vào giỏ.`);
  }

  function updateCart(variantId, quantity) {
    setCart((current) =>
      current
        .map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.min(quantity, item.stock) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function toggleFavorite(productId) {
    setFavorites((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  }

  function saveCustomerSession(session) {
    localStorage.setItem("threadco_customer", JSON.stringify(session));
    setCustomerSession(session);
  }

  function logoutCustomer() {
    localStorage.removeItem("threadco_customer");
    setCustomerSession(null);
    notify("Bạn đã đăng xuất.");
  }

  function requestCheckout() {
    setCartOpen(false);
    if (!customerSession?.token) {
      notify("Vui lòng đăng nhập trước khi thanh toán.", "error");
      go("/account?next=checkout");
      return;
    }
    setCheckoutOpen(true);
  }

  const routePath = route.split("?")[0];
  const routeParams = new URLSearchParams(route.split("?")[1] || "");
  const activeCategory = routeParams.get("category") || "";
  const activeSearch = routeParams.get("search") || "";
  const isAdminRoute = routePath.startsWith("/admin");
  const detailSlug = routePath.startsWith("/product/") ? routePath.split("/product/")[1] : null;

  return (
    <div className={isAdminRoute ? "app admin-app" : "app"}>
      {isAdminRoute ? (
        <AdminArea notify={notify} />
      ) : (
        <>
          <StoreHeader
            count={itemCount}
            favoriteCount={favorites.length}
            onCart={() => setCartOpen(true)}
            categoryGroups={categoryGroups}
            activeCategory={activeCategory}
            activeSearch={activeSearch}
            customer={customerSession?.user}
            onLogout={logoutCustomer}
          />
          {routePath === "/" && (
            <HomePage
              products={products}
              state={catalogState}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              categoryGroups={categoryGroups}
              addToCart={addToCart}
            />
          )}
          {routePath === "/shop" && (
            <ShopPage
              initialProducts={products}
              categoryGroups={categoryGroups}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              addToCart={addToCart}
              activeCategory={activeCategory}
              activeSearch={activeSearch}
            />
          )}
          {routePath === "/wishlist" && (
            <WishlistPage
              products={products}
              state={catalogState}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              addToCart={addToCart}
            />
          )}
          {detailSlug && (
            <ProductPage
              slug={detailSlug}
              vouchers={vouchers}
              addToCart={addToCart}
              isFavorite={favorites.includes(
                products.find((product) => product.slug === detailSlug)?.id
              )}
              toggleFavorite={toggleFavorite}
            />
          )}
          {routePath === "/track" && <OrderTracking />}
          {routePath === "/account" && (
            <CustomerAccount
              customer={customerSession?.user}
              onAuthenticated={(session) => {
                saveCustomerSession(session);
                notify(`Xin chào ${session.user.name}.`);
                const next = new URLSearchParams(route.split("?")[1] || "").get("next");
                go("/");
                if (next === "checkout" && cart.length) setCheckoutOpen(true);
              }}
              onLogout={logoutCustomer}
              notify={notify}
            />
          )}
          {!["/", "/shop", "/wishlist", "/track", "/account"].includes(routePath) &&
            !detailSlug && <NotFound />}
          <ContactButtons />
          <StoreFooter notify={notify} />
          {cartOpen && (
            <CartDrawer
              cart={cart}
              onClose={() => setCartOpen(false)}
              onUpdate={updateCart}
              onCheckout={requestCheckout}
              customer={customerSession?.user}
            />
          )}
          {checkoutOpen && (
            <Checkout
              cart={cart}
              onClose={() => setCheckoutOpen(false)}
              onSuccess={async (order) => {
                setCart([]);
                setCheckoutOpen(false);
                await refreshProducts();
                notify(`Đặt hàng thành công. Mã đơn ${order.id}`);
              }}
              onStockError={refreshProducts}
              vouchers={vouchers}
              notify={notify}
              session={customerSession}
            />
          )}
        </>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}

function StoreHeader({
  count,
  favoriteCount,
  onCart,
  categoryGroups,
  activeCategory,
  activeSearch,
  customer,
  onLogout
}) {
  const [search, setSearch] = useState(activeSearch);
  const [dismissedCategoryGroup, setDismissedCategoryGroup] = useState("");

  useEffect(() => {
    setSearch(activeSearch);
  }, [activeSearch]);

  function submitSearch(event) {
    event.preventDefault();
    const keyword = search.trim();
    goToShopFilter(keyword ? `/shop?search=${encodeURIComponent(keyword)}` : "/shop");
  }

  function clearSearch() {
    setSearch("");
    if (activeSearch) goToShopFilter("/shop");
  }

  function selectCategory(event, groupId, categorySlug) {
    event.currentTarget.blur();
    setDismissedCategoryGroup(groupId);
    goToShopFilter(`/shop?category=${categorySlug}`);
  }

  return (
    <>
      <div className="topbar">
        <span>Miễn phí giao hàng cho đơn từ 500.000đ</span>
      </div>
      <header className="store-header">
        <button className="brand" onClick={() => go("/")}>THREAD & CO</button>
        <nav>
          <button onClick={() => go("/")}>Trang chủ</button>
          <button onClick={() => go("/shop")}>Cửa hàng</button>
          <button onClick={() => go("/track")}>Tra cứu đơn</button>
        </nav>
        <div className="store-actions">
          {customer ? (
            <div className="customer-menu">
              <button onClick={() => go("/account")}>Chào, {customer.name.split(" ").at(-1)}</button>
              <button className="logout-link" onClick={onLogout}>Đăng xuất</button>
            </div>
          ) : (
            <button onClick={() => go("/account")}>Đăng nhập</button>
          )}
          <button
            className="wishlist-action"
            title="Xem sản phẩm yêu thích"
            aria-label={`Xem ${favoriteCount} sản phẩm yêu thích`}
            onClick={() => go("/wishlist")}
          >
            ♡ <span>{favoriteCount}</span>
          </button>
          <button onClick={onCart}>Giỏ hàng <span>{count}</span></button>
        </div>
      </header>
      <div className="store-search-row">
        <form className="store-search" role="search" onSubmit={submitSearch}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm áo, váy, quần, phụ kiện..."
            aria-label="Tìm kiếm sản phẩm"
          />
          {search && (
            <button className="search-clear" type="button" onClick={clearSearch} aria-label="Xóa từ khóa">
              ×
            </button>
          )}
          <button className="search-submit" type="submit">Tìm kiếm</button>
        </form>
      </div>
      <nav className="category-nav" aria-label="Danh mục sản phẩm">
        {categoryGroups.map((group) => (
          <div
            className={[
              "category-nav-group",
              activeCategory === group.slug ||
              group.categories.some((category) => category.slug === activeCategory)
                ? "active"
                : "",
              dismissedCategoryGroup === group.id ? "menu-dismissed" : ""
            ].filter(Boolean).join(" ")}
            key={group.id}
            onMouseLeave={() => {
              if (dismissedCategoryGroup === group.id) setDismissedCategoryGroup("");
            }}
          >
            <button onClick={() => goToShopFilter(`/shop?category=${group.slug}`)}>
              {group.name}
            </button>
            <div>
              {group.categories.map((category) => (
                <button
                  key={category.id}
                  onClick={(event) => selectCategory(event, group.id, category.slug)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

function HomePage({
  products,
  state,
  favorites,
  toggleFavorite,
  categoryGroups,
  addToCart
}) {
  const newest = products.filter((product) => product.isNew).slice(0, 4);
  const bestSellers = products.filter((product) => product.isBestSeller).slice(0, 4);
  return (
    <main>
      <section className="home-hero">
        <div className="hero-content">
          <p className="kicker">BỘ SƯU TẬP NỮ / 2026</p>
          <h1>Cho mọi<br /><span>phiên bản của nàng</span></h1>
          <p>Thời trang nữ hiện đại, tinh tế và linh hoạt cho từng nhịp sống của bạn.</p>
          <button className="button dark" onClick={() => go("/shop")}>Khám phá bộ sưu tập</button>
        </div>
        <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=88" alt="Bộ sưu tập THREAD & CO" />
        <span className="hero-mark">T&CO<br />01</span>
      </section>

      <section className="brand-statement">
        <p className="kicker">CÂU CHUYỆN THƯƠNG HIỆU</p>
        <h2>Ít xu hướng hơn<br /><span>Nhiều phong cách hơn</span></h2>
      </section>

      <CategoryShowcase groups={categoryGroups} products={products} />

      <ProductSection title="Hàng mới về" eyebrow="VỪA CẬP BẾN" products={newest} state={state} favorites={favorites} toggleFavorite={toggleFavorite} addToCart={addToCart} />

      <ProductSection title="Bán chạy" eyebrow="ĐƯỢC YÊU THÍCH" products={bestSellers} state={state} favorites={favorites} toggleFavorite={toggleFavorite} addToCart={addToCart} />

      <section className="editorial">
        <img src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1500&q=85" alt="Phong cách THREAD & CO" />
        <div>
          <p className="kicker">THIẾT KẾ BỀN LÂU</p>
          <h2>Chọn kỹ<br />Mặc <span>thật lâu</span></h2>
          <p>Mỗi thiết kế bắt đầu từ chất liệu tốt, phom dáng linh hoạt và những chi tiết không thừa.</p>
          <button className="text-button" onClick={() => go("/shop")}>Xem tất cả sản phẩm →</button>
        </div>
      </section>
    </main>
  );
}

function CategoryShowcase({ groups, products }) {
  return (
    <section className="category-section">
      <SectionTitle eyebrow="MUA SẮM THEO PHONG CÁCH" title="Danh mục nổi bật" />
      <div className="category-grid">
        {groups.map((group) => {
          const product = products.find((item) => item.categoryGroup?.id === group.id);
          return (
            <button
              className="category-card"
              key={group.id}
              onClick={() => go(`/shop?category=${group.slug}`)}
            >
              <img
                src={product?.images?.[0] || productFallback}
                alt={`Khám phá danh mục ${group.name}`}
                onError={useProductFallback}
              />
              <span>{group.name}</span>
              <small>{group.categories.length} dòng sản phẩm</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ProductSection({ title, eyebrow, products, state, favorites, toggleFavorite, addToCart }) {
  return (
    <section className="product-section">
      <SectionTitle eyebrow={eyebrow} title={title} action="Xem tất cả" />
      <ProductResults products={products} state={state} favorites={favorites} toggleFavorite={toggleFavorite} addToCart={addToCart} compact />
    </section>
  );
}

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="section-title">
      <div><p className="kicker">{eyebrow}</p><h2>{title}</h2></div>
      {action && <button className="text-button" onClick={() => go("/shop")}>{action} →</button>}
    </div>
  );
}

function ShopPage({
  initialProducts,
  categoryGroups,
  favorites,
  toggleFavorite,
  addToCart,
  activeCategory,
  activeSearch
}) {
  const resultsRef = useRef(null);
  const shouldFocusResults = useRef(Boolean(activeCategory || activeSearch));
  const routeFiltersRef = useRef({ category: activeCategory, search: activeSearch });
  const [filters, setFilters] = useState({
    search: activeSearch,
    category: activeCategory,
    size: "",
    color: "",
    sale: false,
    sort: "newest"
  });
  const [results, setResults] = useState(initialProducts);
  const [state, setState] = useState({ loading: !initialProducts.length, error: "" });
  const allCategories = categoryGroups.flatMap((group) => [
    { value: group.slug, label: `Tất cả ${group.name}` },
    ...group.categories.map((category) => ({
      value: category.slug,
      label: `${group.name} / ${category.name}`
    }))
  ]);
  const allSizes = [...new Set(initialProducts.flatMap((p) => p.sizes))];
  const allColors = [...new Set(initialProducts.flatMap((p) => p.colors))];

  useEffect(() => {
    const previous = routeFiltersRef.current;
    if (activeCategory !== previous.category || activeSearch !== previous.search) {
      shouldFocusResults.current = true;
    }
    routeFiltersRef.current = { category: activeCategory, search: activeSearch };
    setFilters((current) => ({
      ...current,
      search: activeSearch,
      category: activeCategory
    }));
  }, [activeCategory, activeSearch]);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: "" });
    api.products(filters)
      .then((data) => {
        if (!active) return;
        setResults(data);
        setState({ loading: false, error: "" });
        if (shouldFocusResults.current) {
          shouldFocusResults.current = false;
          window.requestAnimationFrame(() => {
            resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
      })
      .catch((error) => {
        if (!active) return;
        setResults([]);
        setState({ loading: false, error: error.message });
      });
    return () => { active = false; };
  }, [filters.search, filters.category, filters.size, filters.color, filters.sale, filters.sort]);

  function setFilter(name, value) {
    shouldFocusResults.current = true;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function setCategory(value) {
    shouldFocusResults.current = true;
    setFilters((current) => ({ ...current, category: value }));
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (value) params.set("category", value);
    const query = params.toString();
    goToShopFilter(query ? `/shop?${query}` : "/shop");
  }

  function clearFilters() {
    shouldFocusResults.current = true;
    setFilters({ search: "", category: "", size: "", color: "", sale: false, sort: "newest" });
    goToShopFilter("/shop");
  }

  return (
    <main className="shop-page">
      <div className="page-heading">
        <p className="kicker">BỘ SƯU TẬP</p>
        <h1>Cửa hàng</h1>
        <p>
          {filters.search
            ? `Kết quả tìm kiếm cho “${filters.search}”`
            : "Những thiết kế được cân nhắc kỹ cho nhịp sống mỗi ngày."}
        </p>
      </div>
      <nav className="shop-category-tabs" aria-label="Lọc nhanh theo danh mục">
        <button className={!filters.category ? "active" : ""} onClick={() => setCategory("")}>
          Tất cả sản phẩm
        </button>
        {categoryGroups.map((group) => (
          <button
            className={
              filters.category === group.slug ||
              group.categories.some((category) => category.slug === filters.category)
                ? "active"
                : ""
            }
            key={group.id}
            onClick={() => setCategory(group.slug)}
          >
            {group.name}
          </button>
        ))}
      </nav>
      <div className="catalog-layout">
        <aside className="filters">
          <FilterSelect label="Danh mục" value={filters.category} options={allCategories} onChange={setCategory} />
          <FilterSelect label="Kích thước" value={filters.size} options={allSizes.map((v) => ({ value: v, label: v }))} onChange={(v) => setFilter("size", v)} />
          <FilterSelect label="Màu sắc" value={filters.color} options={allColors.map((v) => ({ value: v, label: v }))} onChange={(v) => setFilter("color", v)} />
          <label className="check-filter">
            <input type="checkbox" checked={filters.sale} onChange={(e) => setFilter("sale", e.target.checked)} />
            Chỉ xem hàng giảm giá
          </label>
          <button className="clear-filter" onClick={clearFilters}>Xóa bộ lọc</button>
        </aside>
        <section className="catalog-results" ref={resultsRef}>
          <div className="catalog-toolbar">
            <span>{results.length} sản phẩm</span>
            <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="price_asc">Giá tăng dần</option>
              <option value="price_desc">Giá giảm dần</option>
              <option value="bestseller">Bán chạy</option>
            </select>
          </div>
          <ProductResults products={results} state={state} favorites={favorites} toggleFavorite={toggleFavorite} addToCart={addToCart} />
        </section>
      </div>
    </main>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Tất cả</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ProductResults({
  products,
  state,
  favorites,
  toggleFavorite,
  addToCart,
  compact = false
}) {
  if (state.loading) {
    return <div className={`product-grid ${compact ? "compact" : ""}`}>{Array.from({ length: compact ? 4 : 6 }, (_, index) => <div className="product-skeleton" key={index} />)}</div>;
  }
  if (state.error) {
    return <StateMessage title="Không tải được sản phẩm" message={state.error} />;
  }
  if (!products.length) {
    return <StateMessage title="Không có sản phẩm phù hợp" message="Hãy thử bỏ bớt một vài bộ lọc." />;
  }
  return (
    <div className={`product-grid ${compact ? "compact" : ""}`}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          favorite={favorites.includes(product.id)}
          toggleFavorite={toggleFavorite}
          addToCart={addToCart}
        />
      ))}
    </div>
  );
}

function WishlistPage({ products, state, favorites, toggleFavorite, addToCart }) {
  const favoriteProducts = products.filter((product) => favorites.includes(product.id));

  return (
    <main className="shop-page wishlist-page">
      <div className="page-heading">
        <p className="kicker">DANH SÁCH CỦA BẠN</p>
        <h1>Yêu thích</h1>
        <p>
          {favoriteProducts.length
            ? `${favoriteProducts.length} sản phẩm bạn đang quan tâm.`
            : "Lưu lại những thiết kế bạn muốn xem và cân nhắc sau."}
        </p>
      </div>
      {state.loading ? (
        <ProductResults
          products={[]}
          state={state}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          addToCart={addToCart}
        />
      ) : state.error ? (
        <StateMessage title="Không tải được danh sách yêu thích" message={state.error} />
      ) : favoriteProducts.length ? (
        <ProductResults
          products={favoriteProducts}
          state={{ loading: false, error: "" }}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          addToCart={addToCart}
        />
      ) : (
        <section className="wishlist-empty">
          <span>♡</span>
          <h2>Danh sách yêu thích đang trống</h2>
          <p>Chạm vào biểu tượng trái tim trên sản phẩm để lưu vào đây.</p>
          <button className="button dark" onClick={() => go("/shop")}>Khám phá sản phẩm</button>
        </section>
      )}
    </main>
  );
}

function ProductCard({ product, favorite, toggleFavorite, addToCart }) {
  const soldOut = product.variants.every((variant) => variant.stock === 0);
  const quickVariant =
    product.variants.length === 1 && product.variants[0].stock > 0
      ? product.variants[0]
      : null;

  function quickAdd() {
    if (soldOut) return;
    if (quickVariant) {
      addToCart(product, quickVariant);
      return;
    }
    go(`/product/${product.slug}`);
  }

  return (
    <article className="product-card">
      <button className="product-photo" onClick={() => go(`/product/${product.slug}`)}>
        <img src={product.images[0]} alt={product.name} onError={useProductFallback} />
        <div className="tags">
          {product.isNew && <span>MỚI</span>}
          {product.isSale && <span className="sale">GIẢM GIÁ</span>}
        </div>
        {soldOut && <span className="sold-out">HẾT HÀNG</span>}
      </button>
      <button
        className={`favorite ${favorite ? "active" : ""}`}
        onClick={() => toggleFavorite(product.id)}
        aria-label={favorite ? `Bỏ yêu thích ${product.name}` : `Yêu thích ${product.name}`}
        title={favorite ? "Bỏ khỏi danh sách yêu thích" : "Thêm vào danh sách yêu thích"}
      >
        ♡
      </button>
      <div className="product-meta">
        <button onClick={() => go(`/product/${product.slug}`)}>
          <h3>{product.name}</h3>
          <p>{product.category.name}</p>
        </button>
        <div className="price"><strong>{money.format(product.price)}</strong>{product.oldPrice && <del>{money.format(product.oldPrice)}</del>}</div>
      </div>
      <button className="quick-add" disabled={soldOut} onClick={quickAdd}>
        {soldOut ? "Hết hàng" : "Bỏ vào giỏ hàng"}
      </button>
    </article>
  );
}

function ProductPage({ slug, vouchers, addToCart, isFavorite, toggleFavorite }) {
  const [product, setProduct] = useState(null);
  const [state, setState] = useState({ loading: true, error: "" });
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  useEffect(() => {
    setState({ loading: true, error: "" });
    api.product(slug)
      .then((data) => {
        setProduct(data);
        setColor(data.colors[0]);
        setSize(data.sizes[0]);
        setState({ loading: false, error: "" });
      })
      .catch((error) => setState({ loading: false, error: error.message }));
  }, [slug]);

  if (state.loading) return <main className="detail-page"><div className="detail-skeleton" /></main>;
  if (state.error || !product) return <main><StateMessage title="Không thể mở sản phẩm" message={state.error} /></main>;

  const selectedVariant = product.variants.find((variant) => variant.color === color && variant.size === size);
  const activeImage = product.variants.find((variant) => variant.color === color)?.image || product.images[0];
  const selectedSoldOut = !selectedVariant || selectedVariant.stock === 0;

  return (
    <main className="detail-page">
      <button className="back-link" onClick={() => go("/shop")}>← Trở lại cửa hàng</button>
      <div className="detail-layout">
        <div className="detail-gallery">
          <img className="detail-main-image" src={activeImage} alt={product.name} onError={useProductFallback} />
          {product.images.slice(1).map((image) => <img key={image} src={image} alt={`${product.name} - góc chụp chi tiết`} onError={useProductFallback} />)}
        </div>
        <div className="detail-info">
          <p className="kicker">{product.category.name}</p>
          <h1>{product.name}</h1>
          <div className="detail-price"><strong>{money.format(product.price)}</strong>{product.oldPrice && <del>{money.format(product.oldPrice)}</del>}</div>
          <section className="product-description-panel">
            <p className="kicker">CÂU CHUYỆN SẢN PHẨM</p>
            <h2>Mô tả sản phẩm</h2>
            <p>{product.description}</p>
            {product.details && (
              <dl>
                <div><dt>Chất liệu</dt><dd>{product.details.material}</dd></div>
                <div><dt>Phom dáng</dt><dd>{product.details.fit}</dd></div>
                <div><dt>Bảo quản</dt><dd>{product.details.care}</dd></div>
              </dl>
            )}
          </section>

          <div className="choice-heading"><span>Màu sắc</span><strong>{color}</strong></div>
          <div className="choice-row">
            {product.colors.map((value) => {
              const hasStock = product.variants.some((variant) => variant.color === value && variant.stock > 0);
              return <button key={value} className={color === value ? "selected" : ""} disabled={!hasStock} onClick={() => { setColor(value); const available = product.variants.find((variant) => variant.color === value && variant.stock > 0); if (available) setSize(available.size); }}>{value}</button>;
            })}
          </div>

          <div className="choice-heading"><span>Kích thước</span><button onClick={() => setShowSizeGuide(true)}>Bảng kích thước</button></div>
          <div className="choice-row sizes">
            {product.sizes.map((value) => {
              const variant = product.variants.find((item) => item.color === color && item.size === value);
              return <button key={value} className={size === value ? "selected" : ""} disabled={!variant || variant.stock === 0} onClick={() => setSize(value)}>{value}</button>;
            })}
          </div>
          <p className={`stock-note ${selectedSoldOut ? "out" : ""}`}>{selectedSoldOut ? "Biến thể này đã hết hàng" : `Còn ${selectedVariant.stock} sản phẩm`}</p>
          <button className="button dark full" disabled={selectedSoldOut} onClick={() => addToCart(product, selectedVariant)}>Thêm vào giỏ hàng</button>
          <button className={`button outline full ${isFavorite ? "liked" : ""}`} onClick={() => toggleFavorite(product.id)}>{isFavorite ? "♥ Đã yêu thích" : "♡ Thêm vào yêu thích"}</button>
          <VoucherList vouchers={vouchers} productPrice={product.price} />
          <div className="detail-notes"><p>✓ Đổi trả trong 14 ngày</p><p>✓ Miễn phí ship từ 500.000đ</p><p>✓ Kiểm tra hàng trước khi thanh toán</p></div>
        </div>
      </div>
      {showSizeGuide && <SizeGuide onClose={() => setShowSizeGuide(false)} />}
    </main>
  );
}

function SizeGuide({ onClose }) {
  return (
    <Modal onClose={onClose} title="Bảng kích thước">
      <div className="size-table">
        <div><strong>Kích thước</strong><strong>Ngực</strong><strong>Eo</strong><strong>Mông</strong></div>
        {[["S", "84-88", "68-72", "88-92"], ["M", "89-94", "73-78", "93-98"], ["L", "95-100", "79-84", "99-104"], ["XL", "101-106", "85-90", "105-110"]].map((row) => <div key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
      </div>
      <p className="muted">Đơn vị: cm. Nếu nằm giữa hai kích thước, hãy chọn cỡ lớn hơn để mặc thoải mái.</p>
    </Modal>
  );
}

function VoucherList({ vouchers, productPrice }) {
  if (!vouchers.length) return null;

  return (
    <section className="voucher-section">
      <div className="choice-heading"><span>Mã ưu đãi dành cho bạn</span></div>
      <div className="voucher-list">
        {vouchers.map((voucher) => (
          <div className="voucher-card" key={voucher.id}>
            <div>
              <strong>{voucher.code}</strong>
              <span>{voucher.name}</span>
            </div>
            <p>{voucher.description}</p>
            <small>
              {productPrice >= voucher.minOrder
                ? "Có thể áp dụng khi thanh toán"
                : `Đơn tối thiểu ${money.format(voucher.minOrder)}`}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

function CartDrawer({ cart, onClose, onUpdate, onCheckout, customer }) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-heading"><div><p className="kicker">SẢN PHẨM ĐÃ CHỌN</p><h2>Giỏ hàng</h2></div><button onClick={onClose}>×</button></div>
        <div className="cart-list">
          {!cart.length && <StateMessage title="Giỏ hàng đang trống" message="Hãy chọn một món đồ bạn yêu thích." />}
          {cart.map((item) => (
            <div className="cart-row" key={item.variantId}>
              <img src={item.image} alt={`${item.name}, màu ${item.color}`} onError={useProductFallback} />
              <div>
                <h3>{item.name}</h3>
                <p>{item.color} / {item.size}</p>
                <div className="quantity-control"><button onClick={() => onUpdate(item.variantId, item.quantity - 1)}>−</button><span>{item.quantity}</span><button disabled={item.quantity >= item.stock} onClick={() => onUpdate(item.variantId, item.quantity + 1)}>+</button></div>
                {item.quantity >= item.stock && <small>Đã đạt tồn kho tối đa</small>}
              </div>
              <div className="cart-price"><strong>{money.format(item.price * item.quantity)}</strong><button onClick={() => onUpdate(item.variantId, 0)}>Xóa</button></div>
            </div>
          ))}
        </div>
        {!!cart.length && (
          <div className="drawer-total">
            <div><span>Tạm tính</span><strong>{money.format(subtotal)}</strong></div>
            <p>{subtotal >= 500000 ? "Đơn hàng được miễn phí giao hàng." : `Mua thêm ${money.format(500000 - subtotal)} để được freeship.`}</p>
            {!customer && <p className="login-note">Bạn cần đăng nhập để tiếp tục thanh toán.</p>}
            <button className="button dark full" onClick={onCheckout}>
              {customer ? "Thanh toán" : "Đăng nhập để thanh toán"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Checkout({ cart, vouchers, onClose, onSuccess, onStockError, notify, session }) {
  const [region, setRegion] = useState("HCM");
  const [voucherCode, setVoucherCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const baseShippingFee = subtotal >= 500000 ? 0 : shippingFees[region];
  const selectedVoucher = vouchers.find((voucher) => voucher.code === voucherCode);
  const voucherEligible = !selectedVoucher || subtotal >= selectedVoucher.minOrder;
  const voucherResult = calculateClientVoucher(selectedVoucher, subtotal, baseShippingFee);
  const shippingFee = voucherResult.shippingFee;
  const discount = voucherResult.discount;

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const order = await api.createOrder(
        {
          ...form,
          region,
          voucherCode: voucherCode || undefined,
          items: cart.map(({ variantId, quantity }) => ({ variantId, quantity }))
        },
        session.token
      );
      onSuccess(order);
    } catch (error) {
      notify(error.message, "error");
      if (error.code === "INSUFFICIENT_STOCK" || error.code === "VARIANT_NOT_FOUND") {
        await onStockError();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Thông tin giao hàng" wide>
      <form className="checkout-form" onSubmit={submit}>
        <div className="checkout-fields">
          <label>Họ và tên<input name="customerName" required minLength="2" defaultValue={session.user.name} placeholder="Nguyễn Minh Anh" /></label>
          <label>Số điện thoại<input name="phone" required defaultValue={session.user.phone || ""} placeholder="0901234567" /></label>
          <label className="wide-field">Địa chỉ<textarea name="address" required minLength="10" placeholder="Số nhà, đường, phường/xã, tỉnh thành" /></label>
          <label>Vùng giao hàng<select name="region" value={region} onChange={(event) => setRegion(event.target.value)}><option value="HCM">TP. Hồ Chí Minh</option><option value="HANOI">Hà Nội</option><option value="OTHER">Tỉnh thành khác</option></select></label>
          <label>Thanh toán<select name="paymentMethod" defaultValue="COD"><option value="COD">Thanh toán khi nhận hàng</option><option value="BANK_TRANSFER">Chuyển khoản</option></select></label>
          <label className="wide-field">
            Mã ưu đãi
            <select value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)}>
              <option value="">Không sử dụng mã ưu đãi</option>
              {vouchers.map((voucher) => (
                <option key={voucher.id} value={voucher.code}>
                  {voucher.code} — {voucher.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedVoucher && subtotal < selectedVoucher.minOrder && (
          <p className="voucher-warning">
            Cần thêm {money.format(selectedVoucher.minOrder - subtotal)} để dùng {selectedVoucher.code}.
          </p>
        )}
        <div className="checkout-summary">
          <div><span>Tiền hàng</span><strong>{money.format(subtotal)}</strong></div>
          {discount > 0 && <div><span>Mã ưu đãi {voucherCode}</span><strong>− {money.format(discount)}</strong></div>}
          <div><span>Phí giao hàng</span><strong>{shippingFee ? money.format(shippingFee) : "Miễn phí"}</strong></div>
          <div className="grand-total"><span>Tổng thanh toán</span><strong>{money.format(subtotal - discount + shippingFee)}</strong></div>
        </div>
        <button className="button dark full" disabled={submitting || !voucherEligible}>{submitting ? "Đang tạo đơn..." : "Xác nhận đặt hàng"}</button>
      </form>
    </Modal>
  );
}

function calculateClientVoucher(voucher, subtotal, shippingFee) {
  if (!voucher || subtotal < voucher.minOrder) return { discount: 0, shippingFee };
  if (voucher.type === "FREE_SHIPPING") return { discount: 0, shippingFee: 0 };
  const rawDiscount =
    voucher.type === "PERCENT"
      ? Math.floor((subtotal * voucher.value) / 100)
      : voucher.value;
  return {
    discount: Math.min(rawDiscount, voucher.maxDiscount || rawDiscount, subtotal),
    shippingFee
  };
}

function CustomerAccount({ customer, onAuthenticated, onLogout, notify }) {
  const [mode, setMode] = useState("login");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const session =
        mode === "login"
          ? await api.customerLogin(data)
          : await api.customerRegister(data);
      onAuthenticated(session);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (customer) {
    return (
      <main className="account-page">
        <section className="account-card signed-in">
          <p className="kicker">TÀI KHOẢN THREAD & CO</p>
          <h1>Xin chào, {customer.name}</h1>
          <p>Bạn đang đăng nhập bằng <strong>{customer.email}</strong>.</p>
          <div className="account-actions">
            <button className="button dark" onClick={() => go("/shop")}>Tiếp tục mua sắm</button>
            <button className="button outline" onClick={onLogout}>Đăng xuất</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page">
      <section className="account-intro">
        <p className="kicker">QUYỀN LỢI THÀNH VIÊN</p>
        <h1>Mua sắm<br /><span>thuận tiện hơn.</span></h1>
        <p>Đăng nhập để thanh toán an toàn, lưu thông tin nhận hàng và theo dõi đơn dễ dàng.</p>
      </section>
      <section className="account-card">
        <div className="account-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Đăng nhập</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Đăng ký</button>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <label>Họ và tên<input name="name" required minLength="2" autoComplete="name" /></label>
              <label>Số điện thoại<input name="phone" required inputMode="tel" placeholder="0901234567" autoComplete="tel" /></label>
            </>
          )}
          <label>Email<input name="email" required type="email" autoComplete="email" /></label>
          <label>
            Mật khẩu
            <input
              name="password"
              required
              type="password"
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </label>
          <button className="button dark full" disabled={submitting}>
            {submitting ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </form>
        <p className="account-demo">Tài khoản demo: customer@threadco.vn / customer123</p>
      </section>
    </main>
  );
}

function OrderTracking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const orderId = new FormData(event.currentTarget).get("orderId").trim();
    if (!orderId) return;
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      setOrder(await api.trackOrder(orderId));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const statusSteps = ["PENDING", "CONFIRMED", "SHIPPING", "COMPLETED"];
  const currentStep = order ? statusSteps.indexOf(order.status) : -1;

  return (
    <main className="tracking-page">
      <div className="tracking-intro">
        <p className="kicker">TRA CỨU ĐƠN HÀNG</p>
        <h1>Đơn hàng của bạn<br />đang ở đâu?</h1>
        <p>Nhập mã đơn được hiển thị sau khi thanh toán để xem trạng thái mới nhất.</p>
        <form onSubmit={submit}>
          <input name="orderId" placeholder="Ví dụ: TC-DEMO-1002" autoComplete="off" />
          <button className="button dark" disabled={loading}>{loading ? "Đang tra cứu..." : "Tra cứu đơn"}</button>
        </form>
        {error && <p className="tracking-error">{error}</p>}
      </div>
      {order && (
        <section className="tracking-result">
          <div className="tracking-heading">
            <div><span>Mã đơn</span><strong>{order.id}</strong></div>
            <Status status={order.status} />
          </div>
          {order.status === "CANCELLED" ? (
            <div className="cancelled-message">Đơn hàng này đã được hủy.</div>
          ) : (
            <div className="tracking-steps">
              {statusSteps.map((status, index) => (
                <div className={index <= currentStep ? "active" : ""} key={status}>
                  <i>{index < currentStep ? "✓" : index + 1}</i>
                  <span>{statusLabels[status]}</span>
                </div>
              ))}
            </div>
          )}
          <div className="tracking-items">
            {order.items.map((item, index) => (
              <div key={`${item.productName}-${index}`}>
                <span><strong>{item.productName}</strong><small>{item.color} / {item.size} × {item.quantity}</small></span>
                <b>{money.format(item.price * item.quantity)}</b>
              </div>
            ))}
          </div>
          <div className="tracking-totals">
            <span>Đặt lúc {dateTime.format(new Date(order.createdAt))}</span>
            <strong>{money.format(order.total)}</strong>
          </div>
        </section>
      )}
    </main>
  );
}

function AdminArea({ notify }) {
  const [session, setSession] = useState(() => readStorage("threadco_admin", null));

  function logout() {
    localStorage.removeItem("threadco_admin");
    setSession(null);
    notify("Đã đăng xuất khỏi trang quản trị.");
  }

  if (!session) {
    return <AdminLogin onLogin={(data) => { localStorage.setItem("threadco_admin", JSON.stringify(data)); setSession(data); notify(`Đăng nhập với quyền ${data.user.role === "admin" ? "quản trị viên" : "nhân viên"}.`); }} notify={notify} />;
  }
  return <AdminDashboard session={session} logout={logout} notify={notify} />;
}

function AdminLogin({ onLogin, notify }) {
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      onLogin(await api.login(Object.fromEntries(new FormData(event.currentTarget))));
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="admin-login">
      <button className="brand" onClick={() => go("/")}>THREAD & CO</button>
      <form onSubmit={submit}>
        <p className="kicker">CỔNG VẬN HÀNH</p>
        <h1>Đăng nhập quản trị</h1>
        <p>Khu vực riêng dành cho chủ cửa hàng và nhân viên được cấp tài khoản.</p>
        <label>Email<input name="email" type="email" required defaultValue="admin@threadco.vn" /></label>
        <label>Mật khẩu<input name="password" type="password" required defaultValue="admin123" /></label>
        <button className="button dark full" disabled={loading}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</button>
        <div className="demo-accounts"><span>Chủ cửa hàng / Quản trị viên: admin@threadco.vn / admin123</span><span>Nhân viên: staff@threadco.vn / staff123</span></div>
      </form>
    </main>
  );
}

function AdminDashboard({ session, logout, notify }) {
  const [tab, setTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminCategories, setAdminCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [productEditor, setProductEditor] = useState(undefined);

  async function load() {
    setLoading(true);
    try {
      const [dashboardData, ordersData, inventoryData, categoryData] = await Promise.all([
        api.dashboard(session.token),
        api.adminOrders(session.token),
        api.inventory(session.token),
        api.categories()
      ]);
      setDashboard(dashboardData);
      setOrders(ordersData);
      setInventory(inventoryData);
      setAdminCategories(categoryData);
      if (session.user.role === "admin") {
        const [revenueData, productData] = await Promise.all([
          api.revenue(session.token),
          api.adminProducts(session.token)
        ]);
        setRevenue(revenueData);
        setAdminProducts(productData);
      } else {
        setRevenue(null);
        setAdminProducts([]);
      }
    } catch (error) {
      notify(error.message, "error");
      if (error.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(orderId, status) {
    try {
      const updated = await api.updateOrderStatus(orderId, status, session.token);
      setOrders((current) => current.map((order) => order.id === orderId ? updated : order));
      setSelectedOrder(updated);
      notify(`Đã cập nhật đơn ${orderId}.`);
      await load();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function updateStock(variantId, stock) {
    try {
      await api.updateStock(variantId, stock, session.token);
      notify("Đã cập nhật tồn kho.");
      await load();
    } catch (error) {
      notify(error.message, "error");
      throw error;
    }
  }

  async function deleteProduct(productId, productName) {
    if (!window.confirm(`Xóa "${productName}" và toàn bộ biến thể khỏi kho?`)) return;

    try {
      await api.deleteProduct(productId, session.token);
      notify(`Đã xóa ${productName}.`);
      await load();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function saveProduct(productId, payload) {
    try {
      if (productId) {
        await api.updateProduct(productId, payload, session.token);
        notify(`Đã cập nhật ${payload.name}.`);
      } else {
        await api.createProduct(payload, session.token);
        notify(`Đã thêm ${payload.name}.`);
      }
      setProductEditor(undefined);
      await load();
    } catch (error) {
      notify(error.message, "error");
      throw error;
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button className="brand light" onClick={() => go("/")}>THREAD & CO</button>
        <nav>
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>Tổng quan</button>
          <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Đơn hàng <span>{orders.length}</span></button>
          <button className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>Kho hàng</button>
          {session.user.role === "admin" && (
            <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>
              Sản phẩm <span>{adminProducts.length}</span>
            </button>
          )}
        </nav>
        <button className="back-store" onClick={() => go("/")}>← Về cửa hàng</button>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p>{session.user.name}</p>
            <span className={`role ${session.user.role}`}>
              {session.user.role === "admin" ? "Chủ cửa hàng / Quản trị viên" : "Nhân viên"}
            </span>
          </div>
          <button onClick={logout}>Đăng xuất</button>
        </header>
        {loading ? <AdminLoading /> : (
          <>
            {tab === "dashboard" && (
              <DashboardTab
                dashboard={dashboard}
                revenue={revenue}
                role={session.user.role}
                orders={orders}
                inventory={inventory}
              />
            )}
            {tab === "orders" && <OrdersTab orders={orders} onSelect={setSelectedOrder} />}
            {tab === "inventory" && (
              <InventoryTab
                inventory={inventory}
                role={session.user.role}
                onUpdateStock={updateStock}
                onDeleteProduct={deleteProduct}
              />
            )}
            {tab === "products" && session.user.role === "admin" && (
              <ProductsTab
                products={adminProducts}
                onAdd={() => setProductEditor(null)}
                onEdit={setProductEditor}
                onDelete={deleteProduct}
              />
            )}
          </>
        )}
      </main>
      {selectedOrder && <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdate={updateStatus} />}
      {productEditor !== undefined && (
        <ProductEditor
          product={productEditor}
          categoryGroups={adminCategories}
          onClose={() => setProductEditor(undefined)}
          onSave={saveProduct}
        />
      )}
    </div>
  );
}

function DashboardTab({ dashboard, revenue, role, orders, inventory }) {
  const [orderPage, setOrderPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const recent = paginate(orders, orderPage, 5);
  const stockWarnings = inventory.filter((item) => item.stock <= 5);
  const visibleWarnings = paginate(stockWarnings, stockPage, 5);

  useEffect(() => {
    setOrderPage((current) => clampPage(current, orders.length, 5));
  }, [orders.length]);
  useEffect(() => {
    setStockPage((current) => clampPage(current, stockWarnings.length, 5));
  }, [stockWarnings.length]);

  return (
    <section className="admin-content">
      <div className="admin-title"><div><p className="kicker">TÌNH HÌNH HÔM NAY</p><h1>Tổng quan</h1></div><span>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "full" }).format(new Date())}</span></div>
      <div className="metric-grid">
        <Metric label="Tổng đơn" value={dashboard.totalOrders} />
        <Metric label="Chờ xử lý" value={dashboard.pendingOrders} warning />
        <Metric label="Biến thể sắp hết" value={dashboard.lowStockVariants} />
        {role === "admin" && (
          <>
            <Metric label="Doanh thu hoàn thành" value={money.format(revenue?.revenue || 0)} />
            <Metric label="Giá trị đơn trung bình" value={money.format(revenue?.averageOrderValue || 0)} />
            <Metric label="Đơn hoàn thành" value={revenue?.completedOrders || 0} />
            <Metric label="Tổng sản phẩm" value={revenue?.totalProducts || 0} />
            <Metric label="Giá trị hàng tồn" value={money.format(revenue?.inventoryValue || 0)} />
          </>
        )}
      </div>
      {role === "admin" && (
        <div className="owner-insights">
          <div className="panel">
            <div className="panel-title"><h2>Tình trạng đơn hàng</h2></div>
            <div className="status-breakdown">
              {revenue?.statusBreakdown.map((item) => (
                <div key={item.status}>
                  <span>{statusLabels[item.status]}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-title"><h2>Sản phẩm bán nổi bật</h2></div>
            <div className="top-products">
              {revenue?.topProducts.map((product, index) => (
                <div key={product.productId}>
                  <b>{index + 1}</b>
                  <span><strong>{product.productName}</strong><small>{product.quantity} sản phẩm đã bán</small></span>
                  <em>{money.format(product.sales)}</em>
                </div>
              ))}
              {!revenue?.topProducts.length && <p>Chưa có dữ liệu bán hàng.</p>}
            </div>
          </div>
        </div>
      )}
      <div className="admin-two-col">
        <div className="panel">
          <div className="panel-title"><h2>Đơn gần đây</h2></div>
          <OrderTable orders={recent} compact />
          <Pagination page={orderPage} totalItems={orders.length} pageSize={5} onChange={setOrderPage} />
        </div>
        <div className="panel">
          <div className="panel-title"><h2>Cảnh báo kho</h2></div>
          <div className="stock-alerts">
            {visibleWarnings.map((item) => (
              <div key={item.id}>
                <span><strong>{item.productName}</strong><small>{item.color} / {item.size}</small></span>
                <b className={item.stock === 0 ? "danger" : "warning"}>{item.stock === 0 ? "Hết hàng" : `Còn ${item.stock}`}</b>
              </div>
            ))}
          </div>
          <Pagination page={stockPage} totalItems={stockWarnings.length} pageSize={5} onChange={setStockPage} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, warning, restricted }) {
  return <div className={`metric ${warning ? "warning" : ""} ${restricted ? "restricted" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function OrdersTab({ orders, onSelect }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const filtered = status ? orders.filter((order) => order.status === status) : orders;
  const visibleOrders = paginate(filtered, page, 8);

  useEffect(() => setPage(1), [status]);
  useEffect(() => {
    setPage((current) => clampPage(current, filtered.length, 8));
  }, [filtered.length]);

  return (
    <section className="admin-content">
      <div className="admin-title"><div><p className="kicker">QUẢN LÝ ĐƠN HÀNG</p><h1>Đơn hàng</h1></div><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="panel">
        <OrderTable orders={visibleOrders} onSelect={onSelect} />
        <Pagination page={page} totalItems={filtered.length} pageSize={8} onChange={setPage} />
      </div>
    </section>
  );
}

function OrderTable({ orders, onSelect, compact }) {
  return (
    <div className="table-wrap"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th>{!compact && <th>Thanh toán</th>}<th>Tổng tiền</th><th>Trạng thái</th>{onSelect && <th />}</tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.id}</strong><small>{dateTime.format(new Date(order.createdAt))}</small></td><td>{order.customerName}<small>{order.phone}</small></td>{!compact && <td>{order.paymentMethod === "COD" ? "COD" : "Chuyển khoản"}</td>}<td>{money.format(order.total)}</td><td><Status status={order.status} /></td>{onSelect && <td><button className="table-action" onClick={() => onSelect(order)}>Chi tiết</button></td>}</tr>)}</tbody></table>{!orders.length && <StateMessage title="Chưa có đơn hàng" message="Đơn mới sẽ xuất hiện tại đây." />}</div>
  );
}

function Status({ status }) {
  return <span className={`status status-${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}

function OrderDetail({ order, onClose, onUpdate }) {
  return (
    <Modal onClose={onClose} title={`Đơn ${order.id}`} wide>
      <div className="order-detail">
        <div className="order-customer"><div><span>Khách hàng</span><strong>{order.customerName}</strong><p>{order.phone}</p></div><div><span>Địa chỉ</span><strong>{order.address}</strong><p>{order.region}</p></div><div><span>Thanh toán</span><strong>{order.paymentMethod === "COD" ? "COD" : "Chuyển khoản"}</strong></div></div>
        <div className="order-lines">{order.items.map((item) => <div key={item.id}><span><strong>{item.productName}</strong><small>{item.color} / {item.size} × {item.quantity}</small></span><b>{money.format(item.price * item.quantity)}</b></div>)}</div>
        <div className="order-total"><span>Tổng thanh toán</span><strong>{money.format(order.total)}</strong></div>
        <label className="status-update">Cập nhật trạng thái<select value={order.status} disabled={order.status === "CANCELLED"} onChange={(event) => onUpdate(order.id, event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
    </Modal>
  );
}

function ProductsTab({ products, onAdd, onEdit, onDelete }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const filtered = products.filter((product) =>
    [product.name, product.slug, product.category?.name]
      .join(" ")
      .toLocaleLowerCase("vi")
      .includes(normalizedQuery)
  );
  const visible = paginate(filtered, page, 8);

  useEffect(() => setPage(1), [query]);
  useEffect(() => setPage((current) => clampPage(current, filtered.length, 8)), [filtered.length]);

  return (
    <section className="admin-content">
      <div className="admin-title">
        <div><p className="kicker">QUẢN LÝ SẢN PHẨM</p><h1>Sản phẩm</h1></div>
        <button className="button dark" onClick={onAdd}>Thêm sản phẩm</button>
      </div>
      <div className="product-admin-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo tên, slug hoặc danh mục..."
        />
        <span>{filtered.length} sản phẩm</span>
      </div>
      <div className="admin-product-list">
        {visible.map((product) => (
          <article className="admin-product-row" key={product.id}>
            <img src={product.images[0]} alt={product.name} onError={useProductFallback} />
            <div>
              <strong>{product.name}</strong>
              <span>{product.category?.name} · {product.variants.length} biến thể</span>
              <small>{product.slug}</small>
            </div>
            <div className="admin-product-price">
              <strong>{money.format(product.price)}</strong>
              {product.oldPrice && <del>{money.format(product.oldPrice)}</del>}
            </div>
            <div className="admin-product-actions">
              <button onClick={() => onEdit(product)}>Chỉnh sửa</button>
              <button className="danger-action" onClick={() => onDelete(product.id, product.name)}>Xóa</button>
            </div>
          </article>
        ))}
        {!visible.length && <StateMessage title="Không có sản phẩm phù hợp" message="Hãy thử từ khóa khác." />}
      </div>
      <Pagination page={page} totalItems={filtered.length} pageSize={8} onChange={setPage} />
    </section>
  );
}

function productDraft(product, categoryGroups) {
  const firstCategory = categoryGroups.flatMap((group) => group.categories)[0]?.id || "";
  if (!product) {
    return {
      name: "",
      slug: "",
      categoryId: firstCategory,
      description: "",
      price: "",
      oldPrice: "",
      imagesText: "",
      sizesText: "S, M, L",
      colorsText: "Đen",
      isNew: true,
      isBestSeller: false,
      isSale: false,
      material: "",
      fit: "",
      care: "",
      variants: ["S", "M", "L"].map((size) => ({
        id: "",
        size,
        color: "Đen",
        stock: 0,
        image: ""
      }))
    };
  }
  return {
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    description: product.description,
    price: String(product.price),
    oldPrice: product.oldPrice == null ? "" : String(product.oldPrice),
    imagesText: product.images.join("\n"),
    sizesText: product.sizes.join(", "),
    colorsText: product.colors.join(", "),
    isNew: product.isNew,
    isBestSeller: product.isBestSeller,
    isSale: product.isSale,
    material: product.details?.material || "",
    fit: product.details?.fit || "",
    care: product.details?.care || "",
    variants: product.variants.map((variant) => ({ ...variant }))
  };
}

function parseOptions(value) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function slugifyProductName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ProductEditor({ product, categoryGroups, onClose, onSave }) {
  const [draft, setDraft] = useState(() => productDraft(product, categoryGroups));
  const [slugEdited, setSlugEdited] = useState(Boolean(product));
  const [saving, setSaving] = useState(false);
  const categories = categoryGroups.flatMap((group) =>
    group.categories.map((category) => ({
      ...category,
      groupName: group.name
    }))
  );

  function setField(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function changeName(value) {
    setDraft((current) => ({
      ...current,
      name: value,
      slug: slugEdited ? current.slug : slugifyProductName(value)
    }));
  }

  function changeOptions(field, value) {
    setDraft((current) => {
      const sizesText = field === "sizesText" ? value : current.sizesText;
      const colorsText = field === "colorsText" ? value : current.colorsText;
      const sizes = parseOptions(sizesText);
      const colors = parseOptions(colorsText);
      const firstImage = current.imagesText.split("\n").map((item) => item.trim()).find(Boolean) || "";
      const variants = sizes.flatMap((size) =>
        colors.map((color) => {
          const existing = current.variants.find(
            (variant) => variant.size === size && variant.color === color
          );
          return existing || { id: "", size, color, stock: 0, image: firstImage };
        })
      );
      return { ...current, [field]: value, variants };
    });
  }

  function updateVariant(index, field, value) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index
          ? { ...variant, [field]: field === "stock" ? Number(value) : value }
          : variant
      )
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const images = draft.imagesText.split("\n").map((item) => item.trim()).filter(Boolean);
    const sizes = parseOptions(draft.sizesText);
    const colors = parseOptions(draft.colorsText);
    const payload = {
      name: draft.name,
      slug: draft.slug,
      categoryId: draft.categoryId,
      description: draft.description,
      price: Number(draft.price),
      oldPrice: draft.oldPrice === "" ? null : Number(draft.oldPrice),
      images,
      sizes,
      colors,
      isNew: draft.isNew,
      isBestSeller: draft.isBestSeller,
      isSale: draft.isSale,
      details: {
        material: draft.material,
        fit: draft.fit,
        care: draft.care
      },
      variants: draft.variants.map((variant) => ({
        ...variant,
        image: variant.image || images[0] || ""
      }))
    };
    setSaving(true);
    try {
      await onSave(product?.id, payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title={product ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"} wide>
      <form className="product-editor" onSubmit={submit}>
        <div className="product-editor-grid">
          <label>Tên sản phẩm<input required minLength="2" value={draft.name} onChange={(event) => changeName(event.target.value)} /></label>
          <label>Slug<input required value={draft.slug} onChange={(event) => { setSlugEdited(true); setField("slug", event.target.value); }} /></label>
          <label>
            Danh mục
            <select required value={draft.categoryId} onChange={(event) => setField("categoryId", event.target.value)}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.groupName} / {category.name}</option>
              ))}
            </select>
          </label>
          <label>Giá bán<input required type="number" min="0" value={draft.price} onChange={(event) => setField("price", event.target.value)} /></label>
          <label>Giá cũ<input type="number" min="0" value={draft.oldPrice} onChange={(event) => setField("oldPrice", event.target.value)} /></label>
          <label className="wide-field">Mô tả<textarea required minLength="10" value={draft.description} onChange={(event) => setField("description", event.target.value)} /></label>
          <label className="wide-field">URL ảnh, mỗi dòng một ảnh<textarea required value={draft.imagesText} onChange={(event) => setField("imagesText", event.target.value)} /></label>
          <label>Kích thước, cách nhau bằng dấu phẩy<input required value={draft.sizesText} onChange={(event) => changeOptions("sizesText", event.target.value)} /></label>
          <label>Màu sắc, cách nhau bằng dấu phẩy<input required value={draft.colorsText} onChange={(event) => changeOptions("colorsText", event.target.value)} /></label>
          <label>Chất liệu<textarea value={draft.material} onChange={(event) => setField("material", event.target.value)} /></label>
          <label>Phom dáng<textarea value={draft.fit} onChange={(event) => setField("fit", event.target.value)} /></label>
          <label className="wide-field">Bảo quản<textarea value={draft.care} onChange={(event) => setField("care", event.target.value)} /></label>
        </div>
        <div className="product-flags">
          <label><input type="checkbox" checked={draft.isNew} onChange={(event) => setField("isNew", event.target.checked)} /> Hàng mới</label>
          <label><input type="checkbox" checked={draft.isBestSeller} onChange={(event) => setField("isBestSeller", event.target.checked)} /> Bán chạy</label>
          <label><input type="checkbox" checked={draft.isSale} onChange={(event) => setField("isSale", event.target.checked)} /> Giảm giá</label>
        </div>
        <section className="product-variant-editor">
          <div className="panel-title"><h2>Biến thể và tồn kho</h2><span>{draft.variants.length} tổ hợp</span></div>
          <div className="variant-editor-grid">
            {draft.variants.map((variant, index) => (
              <article key={`${variant.size}-${variant.color}`}>
                <strong>{variant.size} / {variant.color}</strong>
                <label>Tồn kho<input type="number" min="0" max="99999" value={variant.stock} onChange={(event) => updateVariant(index, "stock", event.target.value)} /></label>
                <label>Ảnh biến thể<input value={variant.image} onChange={(event) => updateVariant(index, "image", event.target.value)} placeholder="Để trống sẽ dùng ảnh đầu tiên" /></label>
              </article>
            ))}
          </div>
        </section>
        <div className="product-editor-actions">
          <button type="button" className="button outline" onClick={onClose}>Hủy</button>
          <button className="button dark" disabled={saving}>{saving ? "Đang lưu..." : "Lưu sản phẩm"}</button>
        </div>
      </form>
    </Modal>
  );
}

function InventoryTab({ inventory, role, onUpdateStock, onDeleteProduct }) {
  const [query, setQuery] = useState("");
  const [onlyWarning, setOnlyWarning] = useState(false);
  const [sizeSort, setSizeSort] = useState("asc");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const groupedInventory = [...inventory.reduce((groups, variant) => {
    if (!groups.has(variant.productId)) {
      groups.set(variant.productId, {
        productId: variant.productId,
        productName: variant.productName,
        productImage: variant.productImage || variant.image,
        sizes: variant.sizes,
        variants: []
      });
    }
    groups.get(variant.productId).variants.push(variant);
    return groups;
  }, new Map()).values()];
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const filtered = groupedInventory
    .filter((product) => {
      const searchable = [
        product.productName,
        ...product.variants.flatMap((variant) => [variant.color, variant.size])
      ].join(" ").toLocaleLowerCase("vi");
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesWarning = !onlyWarning || product.variants.some((variant) => variant.stock <= 5);
      return matchesQuery && matchesWarning;
    })
    .toSorted((a, b) => a.productName.localeCompare(b.productName, "vi"));
  const visibleProducts = paginate(filtered, page, 5);

  useEffect(() => setPage(1), [query, onlyWarning, sizeSort]);
  useEffect(() => {
    setPage((current) => clampPage(current, filtered.length, 5));
  }, [filtered.length]);

  function sortedVariants(product) {
    const sizeOrder = product.sizes.length
      ? product.sizes
      : [...new Set(product.variants.map((variant) => variant.size))];
    return product.variants.toSorted((a, b) => {
      const sizeDifference = sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size);
      const orderedDifference = sizeSort === "asc" ? sizeDifference : -sizeDifference;
      return orderedDifference || a.color.localeCompare(b.color, "vi");
    });
  }

  return (
    <section className="admin-content">
      <div className="admin-title"><div><p className="kicker">QUẢN LÝ TỒN KHO</p><h1>Kho hàng</h1></div><span>{inventory.length} biến thể</span></div>
      <div className="inventory-tools">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm sản phẩm, màu, kích thước..." />
        <div className="inventory-filters">
          <label>
            Sắp xếp kích thước
            <select value={sizeSort} onChange={(event) => setSizeSort(event.target.value)}>
              <option value="asc">Nhỏ → lớn</option>
              <option value="desc">Lớn → nhỏ</option>
            </select>
          </label>
          <label><input type="checkbox" checked={onlyWarning} onChange={(e) => setOnlyWarning(e.target.checked)} /> Chỉ xem cảnh báo</label>
        </div>
      </div>
      <div className="inventory-groups">
        {visibleProducts.map((product) => {
          const variants = sortedVariants(product);
          const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
          const warningCount = variants.filter((variant) => variant.stock <= 5).length;
          const isExpanded = expanded[product.productId] ?? true;

          return (
            <article className="inventory-group" key={product.productId}>
              <div className="inventory-group-head">
                <button
                  className="inventory-product-summary"
                  onClick={() => setExpanded((current) => ({
                    ...current,
                    [product.productId]: !isExpanded
                  }))}
                >
                  <img src={product.productImage} alt={`Ảnh ${product.productName}`} onError={useProductFallback} />
                  <span>
                    <strong>{product.productName}</strong>
                    <small>{variants.length} biến thể · Tổng tồn {totalStock}</small>
                  </span>
                  {warningCount > 0 && <b>{warningCount} cảnh báo</b>}
                  <i>{isExpanded ? "−" : "+"}</i>
                </button>
                {role === "admin" && (
                  <button
                    className="danger-action"
                    onClick={() => onDeleteProduct(product.productId, product.productName)}
                  >
                    Xóa sản phẩm
                  </button>
                )}
              </div>
              {isExpanded && (
                <div className="variant-grid">
                  {variants.map((variant) => (
                    <VariantStockEditor
                      key={variant.id}
                      variant={variant}
                      onSave={onUpdateStock}
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {!visibleProducts.length && <StateMessage title="Không có sản phẩm phù hợp" message="Hãy thử thay đổi bộ lọc kho." />}
      </div>
      <Pagination page={page} totalItems={filtered.length} pageSize={5} onChange={setPage} />
    </section>
  );
}

function VariantStockEditor({ variant, onSave }) {
  const [stock, setStock] = useState(String(variant.stock));
  const [saving, setSaving] = useState(false);

  useEffect(() => setStock(String(variant.stock)), [variant.stock]);

  async function save() {
    const nextStock = Number(stock);
    if (!Number.isInteger(nextStock) || nextStock < 0) return;
    setSaving(true);
    try {
      await onSave(variant.id, nextStock);
    } catch {
      setStock(String(variant.stock));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`variant-stock ${variant.stock === 0 ? "out" : variant.stock <= 5 ? "low" : ""}`}>
      <div>
        <strong>{variant.size}</strong>
        <span>{variant.color}</span>
      </div>
      <label>
        Tồn kho
        <input
          type="number"
          min="0"
          max="99999"
          value={stock}
          onChange={(event) => setStock(event.target.value)}
        />
      </label>
      <span className={`stock-status ${variant.stockStatus.toLowerCase()}`}>
        {variant.stockStatus === "OUT_OF_STOCK" ? "Hết hàng" : variant.stockStatus === "LOW_STOCK" ? "Sắp hết" : "Còn hàng"}
      </span>
      <button
        className="save-stock"
        disabled={saving || Number(stock) === variant.stock || stock === ""}
        onClick={save}
      >
        {saving ? "Đang lưu" : "Lưu"}
      </button>
    </div>
  );
}

function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function clampPage(page, totalItems, pageSize) {
  return Math.min(page, Math.max(1, Math.ceil(totalItems / pageSize)));
}

function Pagination({ page, totalItems, pageSize, onChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const safePage = Math.min(page, totalPages);
  return (
    <div className="pagination">
      <button disabled={safePage === 1} onClick={() => onChange(safePage - 1)}>← Trước</button>
      <span>Trang {safePage} / {totalPages}</span>
      <button disabled={safePage === totalPages} onClick={() => onChange(safePage + 1)}>Sau →</button>
    </div>
  );
}

function Modal({ onClose, title, children, wide }) {
  return <div className="overlay centered" onMouseDown={onClose}><section className={`modal ${wide ? "wide" : ""}`} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</section></div>;
}

function StateMessage({ title, message }) {
  return <div className="state-message"><strong>{title}</strong><p>{message}</p></div>;
}

function AdminLoading() {
  return <div className="admin-content"><div className="admin-loading" /><div className="admin-loading large" /></div>;
}

function NotFound() {
  return <main className="not-found"><h1>404</h1><p>Trang bạn tìm không tồn tại.</p><button className="button dark" onClick={() => go("/")}>Về trang chủ</button></main>;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.1 3.5 9.3 8l-2 1.7c1 2.1 2.9 4 5 5l1.7-2 4.5 2.2-.7 4c-.2 1-1.1 1.7-2.1 1.6C9 19.8 4.2 15 3.5 8.3c-.1-1 .6-1.9 1.6-2.1z" />
    </svg>
  );
}

function ContactButtons() {
  return (
    <aside className="contact-buttons" aria-label="Liên hệ nhanh">
      <a href={`tel:${storePhone}`} aria-label={`Gọi hotline ${storePhoneLabel}`}>
        <span className="contact-icon phone"><PhoneIcon /></span>
        <strong>Hotline</strong>
      </a>
      <a href={zaloUrl} target="_blank" rel="noreferrer" aria-label="Nhắn tin với THREAD & CO qua Zalo">
        <span className="contact-icon zalo">
          <img src="https://h5.zdn.vn/static/zalo-site/favicon.ico" alt="" />
        </span>
        <strong>Zalo</strong>
      </a>
    </aside>
  );
}

function StoreFooter({ notify }) {
  const [submitting, setSubmitting] = useState(false);

  async function submitLead(event) {
    event.preventDefault();
    setSubmitting(true);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await api.createLead({
        ...data,
        consent: data.consent === "on",
        source: "footer"
      });
      notify(result.message);
      form.reset();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <footer className="store-footer">
      <section className="newsletter">
        <div>
          <p className="kicker">ĐĂNG KÝ NHẬN TIN KHUYẾN MÃI</p>
          <h2>Nhận ngay voucher 10%</h2>
          <p>Voucher sẽ được gửi sau 24h, chỉ áp dụng cho khách hàng mới.</p>
        </div>
        <form onSubmit={submitLead}>
          <div>
            <input name="email" type="email" required placeholder="Email của bạn" aria-label="Email nhận ưu đãi" />
            <button disabled={submitting}>{submitting ? "Đang gửi" : "Đăng ký"}</button>
          </div>
          <label><input name="consent" type="checkbox" required /> Tôi đồng ý nhận thông tin ưu đãi từ THREAD & CO</label>
        </form>
      </section>
      <div className="footer-main">
        <div className="footer-brand">
          <span className="brand light">THREAD & CO</span>
          <p>Trang phục mỗi ngày, được chăm chút trong từng chi tiết.</p>
          <div className="footer-contact">
            <a href={`tel:${storePhone}`}>Hotline: {storePhoneLabel}</a>
            <a href="mailto:hello@threadco.vn">hello@threadco.vn</a>
            <span>25 Nguyễn Trãi, Quận 1, TP.HCM</span>
          </div>
        </div>
        <div className="footer-column">
          <strong>Mua sắm</strong>
          <button onClick={() => go("/shop?category=ao")}>Áo</button>
          <button onClick={() => go("/shop?category=quan")}>Quần</button>
          <button onClick={() => go("/shop?category=vay-dam")}>Váy / Đầm</button>
          <button onClick={() => go("/shop?category=set-do")}>Set đồ</button>
          <button onClick={() => go("/shop?category=ao-khoac")}>Áo khoác</button>
          <button onClick={() => go("/shop?category=phu-kien")}>Phụ kiện</button>
          <button onClick={() => go("/track")}>Tra cứu đơn hàng</button>
        </div>
        <div className="footer-column">
          <strong>Chính sách đổi trả</strong>
          <p>Đổi sản phẩm trong 14 ngày, còn nguyên tem và chưa qua sử dụng.</p>
          <p>Hỗ trợ đổi kích thước miễn phí một lần cho mỗi đơn hàng.</p>
        </div>
        <div className="footer-column">
          <strong>Giao hàng & thanh toán</strong>
          <p>Giao toàn quốc từ 2–5 ngày làm việc.</p>
          <p>Miễn phí ship từ 500.000đ. Hỗ trợ COD và chuyển khoản.</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 THREAD & CO</span>
        <span>Trang phục mỗi ngày, được chăm chút trong từng chi tiết.</span>
      </div>
    </footer>
  );
}
