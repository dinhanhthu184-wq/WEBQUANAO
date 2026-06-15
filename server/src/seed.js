import bcrypt from "bcrypt";
import { db } from "./db.js";

const categoryGroups = [
  { id: "group-tops", name: "Áo", slug: "ao" },
  { id: "group-bottoms", name: "Quần", slug: "quan" },
  { id: "group-dresses", name: "Váy / Đầm", slug: "vay-dam" },
  { id: "group-sets", name: "Set đồ", slug: "set-do" },
  { id: "group-jackets", name: "Áo khoác", slug: "ao-khoac" },
  { id: "group-accessories", name: "Phụ kiện", slug: "phu-kien" }
];

const categories = [
  { id: "cat-tshirts", groupId: "group-tops", name: "Áo thun", slug: "ao-thun" },
  { id: "cat-polos", groupId: "group-tops", name: "Áo kiểu", slug: "ao-kieu" },
  { id: "cat-shirts", groupId: "group-tops", name: "Áo sơ mi", slug: "ao-so-mi" },
  { id: "cat-trousers", groupId: "group-bottoms", name: "Quần tây", slug: "quan-tay" },
  { id: "cat-denim", groupId: "group-bottoms", name: "Quần jeans", slug: "quan-jeans" },
  { id: "cat-shorts", groupId: "group-bottoms", name: "Quần short", slug: "quan-short" },
  { id: "cat-skirt-denim", groupId: "group-dresses", name: "Chân váy chữ A", slug: "chan-vay-chu-a" },
  { id: "cat-skirt-midi", groupId: "group-dresses", name: "Chân váy midi", slug: "chan-vay-midi" },
  { id: "cat-skirt-mini", groupId: "group-dresses", name: "Chân váy mini", slug: "chan-vay-mini" },
  { id: "cat-dresses", groupId: "group-dresses", name: "Đầm", slug: "dam" },
  { id: "cat-jumpsuits", groupId: "group-sets", name: "Set liền thân", slug: "set-lien-than" },
  { id: "cat-office-sets", groupId: "group-sets", name: "Set công sở", slug: "set-cong-so" },
  { id: "cat-jackets", groupId: "group-jackets", name: "Áo blazer", slug: "blazer" },
  { id: "cat-cardigans", groupId: "group-jackets", name: "Áo cardigan", slug: "cardigan" },
  { id: "cat-light-jackets", groupId: "group-jackets", name: "Áo khoác nhẹ", slug: "ao-khoac-nhe" },
  { id: "cat-bags", groupId: "group-accessories", name: "Túi xách", slug: "tui-xach" },
  { id: "cat-hats", groupId: "group-accessories", name: "Mũ", slug: "mu" },
  { id: "cat-belts", groupId: "group-accessories", name: "Thắt lưng", slug: "that-lung" },
  { id: "cat-scarves", groupId: "group-accessories", name: "Khăn", slug: "khan" },
  { id: "cat-wallets", groupId: "group-accessories", name: "Ví", slug: "vi" }
];

const vouchers = [
  {
    id: "voucher-thread10",
    code: "THREAD10",
    name: "Giảm 10%",
    description: "Giảm 10% tối đa 100.000đ cho đơn từ 500.000đ.",
    type: "PERCENT",
    value: 10,
    minOrder: 500000,
    maxDiscount: 100000,
    active: true,
    expiresAt: "2026-12-31T23:59:59.000Z"
  },
  {
    id: "voucher-welcome50",
    code: "WELCOME50",
    name: "Giảm 50.000đ",
    description: "Giảm trực tiếp 50.000đ cho đơn từ 400.000đ.",
    type: "FIXED",
    value: 50000,
    minOrder: 400000,
    maxDiscount: null,
    active: true,
    expiresAt: "2026-12-31T23:59:59.000Z"
  },
  {
    id: "voucher-freeship",
    code: "FREESHIP",
    name: "Miễn phí giao hàng",
    description: "Miễn phí giao hàng cho đơn từ 200.000đ.",
    type: "FREE_SHIPPING",
    value: 0,
    minOrder: 200000,
    maxDiscount: null,
    active: true,
    expiresAt: "2026-12-31T23:59:59.000Z"
  }
];

const productSeeds = [
  {
    id: "prod-heavy-tee",
    categoryId: "cat-tshirts",
    name: "Everyday Heavy Tee",
    slug: "everyday-heavy-tee",
    description: "Áo thun cotton 260gsm, phom relaxed và cổ áo giữ dáng.",
    price: 390000,
    oldPrice: null,
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Trắng", "Đen", "Xanh rêu"],
    sizes: ["S", "M", "L", "XL"],
    isNew: true,
    isBestSeller: true,
    isSale: false,
    createdAt: "2026-06-12T08:00:00.000Z"
  },
  {
    id: "prod-boxy-tee",
    categoryId: "cat-tshirts",
    name: "Boxy Pocket Tee",
    slug: "boxy-pocket-tee",
    description: "Áo thun túi ngực với vai rơi nhẹ và chiều dài gọn.",
    price: 320000,
    oldPrice: 390000,
    images: [
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Kem", "Than chì"],
    sizes: ["S", "M", "L"],
    isNew: false,
    isBestSeller: false,
    isSale: true,
    createdAt: "2026-05-28T08:00:00.000Z"
  },
  {
    id: "prod-linen-shirt",
    categoryId: "cat-shirts",
    name: "Linen Camp Shirt",
    slug: "linen-camp-shirt",
    description: "Sơ mi linen cổ camp thoáng nhẹ dành cho ngày nắng.",
    price: 690000,
    oldPrice: null,
    images: [
      "https://images.unsplash.com/photo-1603252110481-7ba873bf42ab?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Cát", "Xanh navy"],
    sizes: ["S", "M", "L", "XL"],
    isNew: true,
    isBestSeller: true,
    isSale: false,
    createdAt: "2026-06-10T08:00:00.000Z"
  },
  {
    id: "prod-oxford-shirt",
    categoryId: "cat-shirts",
    name: "Oxford Daily Shirt",
    slug: "oxford-daily-shirt",
    description: "Sơ mi Oxford phom vừa, phù hợp cả ngày làm việc và cuối tuần.",
    price: 590000,
    oldPrice: 720000,
    images: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Trắng", "Xanh nhạt"],
    sizes: ["S", "M", "L", "XL"],
    isNew: false,
    isBestSeller: false,
    isSale: true,
    createdAt: "2026-04-21T08:00:00.000Z"
  },
  {
    id: "prod-wide-trousers",
    categoryId: "cat-denim",
    name: "Wide-leg Trousers",
    slug: "wide-leg-trousers",
    description: "Quần ống rộng cạp cao, bề mặt vải mịn và độ rủ tự nhiên.",
    price: 750000,
    oldPrice: null,
    images: [
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Đen", "Be"],
    sizes: ["S", "M", "L"],
    isNew: true,
    isBestSeller: true,
    isSale: false,
    createdAt: "2026-06-08T08:00:00.000Z"
  },
  {
    id: "prod-relaxed-denim",
    categoryId: "cat-trousers",
    name: "Relaxed Denim",
    slug: "relaxed-denim",
    description: "Denim wash xanh phom relaxed, cạp vừa và mềm từ lần mặc đầu.",
    price: 850000,
    oldPrice: null,
    images: [
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Xanh vừa", "Xanh đậm"],
    sizes: ["28", "30", "32", "34"],
    isNew: false,
    isBestSeller: true,
    isSale: false,
    createdAt: "2026-03-17T08:00:00.000Z"
  },
  {
    id: "prod-utility-shorts",
    categoryId: "cat-shorts",
    name: "Utility Shorts",
    slug: "utility-shorts",
    description: "Quần short cotton ripstop với túi hộp tối giản.",
    price: 420000,
    oldPrice: 520000,
    images: [
      "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Rêu", "Đen"],
    sizes: ["S", "M", "L", "XL"],
    isNew: false,
    isBestSeller: false,
    isSale: true,
    createdAt: "2026-02-25T08:00:00.000Z"
  },
  {
    id: "prod-slip-dress",
    categoryId: "cat-dresses",
    name: "Bias Slip Dress",
    slug: "bias-slip-dress",
    description: "Váy hai dây cắt xéo tạo độ rủ mềm, có thể mặc riêng hoặc layer.",
    price: 890000,
    oldPrice: null,
    images: [
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Đen", "Champagne"],
    sizes: ["S", "M", "L"],
    isNew: true,
    isBestSeller: false,
    isSale: false,
    createdAt: "2026-06-05T08:00:00.000Z"
  },
  {
    id: "prod-shirt-dress",
    categoryId: "cat-dresses",
    name: "Linen Shirt Dress",
    slug: "linen-shirt-dress",
    description: "Váy sơ mi linen dáng dài, đi kèm dây thắt eo tháo rời.",
    price: 990000,
    oldPrice: 1190000,
    images: [
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Trắng ngà", "Nâu đất"],
    sizes: ["S", "M", "L"],
    isNew: false,
    isBestSeller: true,
    isSale: true,
    createdAt: "2026-04-02T08:00:00.000Z"
  },
  {
    id: "prod-canvas-tote",
    categoryId: "cat-bags",
    name: "Daily Canvas Tote",
    slug: "daily-canvas-tote",
    description: "Túi tote canvas dày với ngăn trong và quai đeo gia cố.",
    price: 290000,
    oldPrice: null,
    images: [
      "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Natural", "Đen"],
    sizes: ["One Size"],
    isNew: true,
    isBestSeller: true,
    isSale: false,
    createdAt: "2026-06-01T08:00:00.000Z"
  },
  {
    id: "prod-cap",
    categoryId: "cat-hats",
    name: "Washed Cotton Cap",
    slug: "washed-cotton-cap",
    description: "Mũ cotton wash mềm với khóa kim loại điều chỉnh phía sau.",
    price: 260000,
    oldPrice: 320000,
    images: [
      "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Navy", "Be", "Đen"],
    sizes: ["One Size"],
    isNew: false,
    isBestSeller: false,
    isSale: true,
    createdAt: "2026-03-01T08:00:00.000Z"
  },
  {
    id: "prod-belt",
    categoryId: "cat-belts",
    name: "Classic Leather Belt",
    slug: "classic-leather-belt",
    description: "Thắt lưng da bò hoàn thiện mờ, khóa kim loại tối giản.",
    price: 490000,
    oldPrice: null,
    images: [
      "https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=1200&q=85"
    ],
    colors: ["Đen", "Nâu"],
    sizes: ["S", "M", "L"],
    isNew: false,
    isBestSeller: false,
    isSale: false,
    createdAt: "2026-01-20T08:00:00.000Z"
  }
];

const additionalCatalog = [
  {
    categoryId: "cat-tshirts",
    products: [
      ["essential-rib-tee", "Essential Rib Tee", "Áo thun gân co giãn nhẹ, ôm vừa và dễ phối nhiều lớp.", 350000, null, ["Trắng kem", "Nâu cacao"], ["S", "M", "L"], "photo-1521572163474-6864f9cf17ab", true, true],
      ["weekend-stripe-tee", "Weekend Stripe Tee", "Áo thun sọc ngang cotton mềm với phom suông thư giãn.", 420000, null, ["Sọc navy", "Sọc rêu"], ["S", "M", "L", "XL"], "photo-1576566588028-4147f3842f27", true, false],
      ["clean-collar-polo", "Clean Collar Polo", "Polo dệt pique thoáng khí, cổ gọn và đường vai cân đối.", 520000, 620000, ["Trắng", "Xanh navy"], ["S", "M", "L", "XL"], "photo-1521572163474-6864f9cf17ab", false, true],
      ["soft-touch-polo", "Soft Touch Polo", "Polo sợi cotton chải mềm dành cho trang phục thường ngày.", 560000, null, ["Be", "Xanh olive"], ["S", "M", "L"], "photo-1583743814966-8936f5b7be1a", false, false],
      ["cropped-baby-tee", "Cropped Baby Tee", "Áo thun dáng lửng cân đối, bề mặt mịn và co giãn thoải mái.", 330000, 390000, ["Trắng", "Đen", "Hồng bụi"], ["S", "M", "L"], "photo-1503341504253-dff4815485f1", true, false]
    ]
  },
  {
    categoryId: "cat-shirts",
    products: [
      ["relaxed-poplin-shirt", "Relaxed Poplin Shirt", "Sơ mi poplin phom rộng với bề mặt sắc nét và nhẹ.", 620000, null, ["Trắng", "Xanh trời"], ["S", "M", "L", "XL"], "photo-1596755094514-f87e34085b2c", true, true],
      ["denim-overshirt", "Denim Overshirt", "Áo khoác sơ mi denim wash nhẹ, phù hợp mặc chuyển mùa.", 890000, null, ["Xanh nhạt", "Xanh đậm"], ["S", "M", "L"], "photo-1603252109303-2751441dd157", true, false],
      ["cropped-linen-shirt", "Cropped Linen Shirt", "Sơ mi linen dáng lửng, tay rộng và hàng nút tối giản.", 650000, 760000, ["Trắng ngà", "Nâu cát"], ["S", "M", "L"], "photo-1603252110481-7ba873bf42ab", false, false],
      ["utility-light-jacket", "Utility Light Jacket", "Áo khoác nhẹ nhiều túi với chất liệu cotton chống nhăn.", 990000, null, ["Khaki", "Đen"], ["S", "M", "L", "XL"], "photo-1551028719-00167b16eac5", false, true],
      ["soft-cardigan-jacket", "Soft Cardigan Jacket", "Áo cardigan dệt mềm, phom gọn để khoác trong không gian điều hòa.", 790000, 920000, ["Kem", "Xám tro"], ["S", "M", "L"], "photo-1434389677669-e08b4cac3105", true, false]
    ]
  },
  {
    categoryId: "cat-trousers",
    products: [
      ["straight-chino", "Straight Chino", "Quần chino ống đứng với cạp vừa và bề mặt cotton mịn.", 690000, null, ["Be", "Đen"], ["28", "30", "32", "34"], "photo-1473966968600-fa801b869a1a", true, true],
      ["pleated-work-trousers", "Pleated Work Trousers", "Quần tây ly trước, ống suông và độ rủ phù hợp môi trường công sở.", 790000, 890000, ["Xám", "Navy"], ["S", "M", "L", "XL"], "photo-1594633312681-425c7b97ccd1", false, false],
      ["barrel-leg-denim", "Barrel Leg Denim", "Denim ống cong hiện đại với wash xanh cổ điển.", 890000, null, ["Xanh sáng", "Xanh đậm"], ["26", "28", "30", "32"], "photo-1541099649105-f69ad21f3246", true, true],
      ["linen-drawstring-pants", "Linen Drawstring Pants", "Quần linen dây rút thoáng nhẹ, ống rộng và dễ vận động.", 720000, null, ["Cát", "Nâu đất"], ["S", "M", "L"], "photo-1506629082955-511b1aa562c8", true, false],
      ["slim-black-denim", "Slim Black Denim", "Jeans đen phom slim vừa phải, co giãn nhẹ và giữ dáng.", 820000, 950000, ["Đen wash", "Đen"], ["28", "30", "32", "34"], "photo-1542272604-787c3835535d", false, false]
    ]
  },
  {
    categoryId: "cat-shorts",
    products: [
      ["tailored-bermuda", "Tailored Bermuda", "Quần Bermuda may đo, chiều dài trên gối và ly trước gọn.", 590000, null, ["Đen", "Be"], ["S", "M", "L"], "photo-1591195853828-11db59a44f6b", true, true],
      ["linen-easy-shorts", "Linen Easy Shorts", "Quần short linen cạp chun với dây rút ẩn.", 450000, null, ["Trắng ngà", "Rêu"], ["S", "M", "L", "XL"], "photo-1565084888279-aca607ecce0c", true, false],
      ["denim-a-line-skirt", "Denim A-line Skirt", "Chân váy denim chữ A cơ bản, dễ phối cùng áo thun và sơ mi.", 620000, 720000, ["Xanh vừa", "Đen"], ["S", "M", "L"], "photo-1541099649105-f69ad21f3246", false, true],
      ["satin-midi-skirt", "Satin Midi Skirt", "Chân váy satin midi cắt xéo với độ rủ mềm.", 690000, null, ["Champagne", "Đen"], ["S", "M", "L"], "photo-1582142306909-195724d33ffc", true, false],
      ["cargo-mini-skirt", "Cargo Mini Skirt", "Chân váy mini túi hộp, chất cotton đứng phom.", 540000, 640000, ["Khaki", "Than chì"], ["S", "M", "L"], "photo-1592301933927-35b597393c0a", false, false]
    ]
  },
  {
    categoryId: "cat-dresses",
    products: [
      ["column-knit-dress", "Column Knit Dress", "Váy dệt kim dáng cột, co giãn và tôn đường nét tự nhiên.", 920000, null, ["Đen", "Nâu mocha"], ["S", "M", "L"], "photo-1566174053879-31528523f8ae", true, true],
      ["weekend-wrap-dress", "Weekend Wrap Dress", "Váy quấn midi với tay ngắn và dây eo điều chỉnh.", 850000, 990000, ["Đỏ gạch", "Navy"], ["S", "M", "L"], "photo-1595777457583-95e059d581b8", false, true],
      ["utility-jumpsuit", "Utility Jumpsuit", "Jumpsuit cổ sơ mi, túi hộp và dây eo tháo rời.", 1190000, null, ["Rêu", "Đen"], ["S", "M", "L"], "photo-1594633312681-425c7b97ccd1", true, false],
      ["linen-midi-dress", "Linen Midi Dress", "Váy midi linen cổ vuông, thân váy xòe nhẹ.", 980000, null, ["Trắng ngà", "Xanh olive"], ["S", "M", "L"], "photo-1572804013309-59a88b7e92f1", true, true],
      ["minimal-slip-jumpsuit", "Minimal Slip Jumpsuit", "Jumpsuit hai dây ống rộng với phom tối giản và linh hoạt.", 1050000, 1250000, ["Đen", "Xám khói"], ["S", "M", "L"], "photo-1529139574466-a303027c1d8b", false, false]
    ]
  },
  {
    categoryId: "cat-accessories",
    products: [
      ["mini-shoulder-bag", "Mini Shoulder Bag", "Túi đeo vai nhỏ gọn với khóa nam châm và quai điều chỉnh.", 690000, null, ["Đen", "Nâu"], ["One Size"], "photo-1584917865442-de89df76afd3", true, true],
      ["woven-market-bag", "Woven Market Bag", "Túi đan nhẹ, rộng rãi cho những chuyến đi cuối tuần.", 520000, null, ["Natural", "Nâu"], ["One Size"], "photo-1594223274512-ad4803739b7c", true, false],
      ["everyday-bucket-hat", "Everyday Bucket Hat", "Mũ bucket cotton hai mặt, vành vừa và dễ gấp gọn.", 320000, 390000, ["Be", "Đen"], ["S/M", "L/XL"], "photo-1521369909029-2afed882baee", false, true],
      ["silk-neck-scarf", "Silk Neck Scarf", "Khăn lụa vuông họa tiết tối giản, dùng cho cổ hoặc quai túi.", 290000, null, ["Xanh cobalt", "Cam đất"], ["One Size"], "photo-1601924994987-69e26d50dc26", true, false],
      ["compact-card-wallet", "Compact Card Wallet", "Ví thẻ da nhỏ gọn với sáu ngăn và ngăn tiền giữa.", 450000, 520000, ["Đen", "Nâu cognac"], ["One Size"], "photo-1627123424574-724758594e93", false, false]
    ]
  }
];

additionalCatalog.forEach((category, categoryIndex) => {
  category.products.forEach(([
    slug,
    name,
    description,
    price,
    oldPrice,
    colors,
    sizes,
    imageId,
    isNew,
    isBestSeller
  ], productIndex) => {
    productSeeds.push({
      id: `prod-${slug}`,
      categoryId: category.categoryId,
      name,
      slug,
      description,
      price,
      oldPrice,
      images: [`https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=1200&q=85`],
      colors,
      sizes,
      isNew,
      isBestSeller,
      isSale: oldPrice !== null,
      createdAt: new Date(Date.UTC(2026, 4, 30 - categoryIndex * 5 - productIndex, 8)).toISOString()
    });
  });
});

const categoryOverrides = new Map([
  ["prod-clean-collar-polo", "cat-polos"],
  ["prod-soft-touch-polo", "cat-polos"],
  ["prod-denim-overshirt", "cat-jackets"],
  ["prod-utility-light-jacket", "cat-jackets"],
  ["prod-soft-cardigan-jacket", "cat-jackets"],
  ["prod-barrel-leg-denim", "cat-denim"],
  ["prod-slim-black-denim", "cat-denim"],
  ["prod-denim-a-line-skirt", "cat-skirt-denim"],
  ["prod-satin-midi-skirt", "cat-skirt-midi"],
  ["prod-cargo-mini-skirt", "cat-skirt-mini"],
  ["prod-utility-jumpsuit", "cat-jumpsuits"],
  ["prod-minimal-slip-jumpsuit", "cat-jumpsuits"],
  ["prod-mini-shoulder-bag", "cat-bags"],
  ["prod-woven-market-bag", "cat-bags"],
  ["prod-everyday-bucket-hat", "cat-hats"],
  ["prod-silk-neck-scarf", "cat-scarves"],
  ["prod-compact-card-wallet", "cat-wallets"]
]);

productSeeds.forEach((product) => {
  product.categoryId = categoryOverrides.get(product.id) || product.categoryId;
});

const womenCatalog = [
  ["prod-heavy-tee", "Áo thun Soft Cotton", "cat-tshirts", "Áo thun cotton mềm, cổ tròn thanh thoát và phom suông vừa vặn cho trang phục hằng ngày.", "photo-1524250502761-1ac6f2e30d43"],
  ["prod-boxy-tee", "Áo thun Boxy Crop", "cat-tshirts", "Áo thun dáng boxy lửng nhẹ, tạo tỷ lệ cân đối khi phối cùng quần hoặc chân váy cạp cao.", "photo-1515886657613-9f3515b0c78f"],
  ["prod-linen-shirt", "Áo sơ mi Linen Breeze", "cat-shirts", "Sơ mi linen thoáng mát với vai rơi mềm và hàng nút tối giản, phù hợp ngày nắng.", "photo-1564257631407-4deb1f99d992"],
  ["prod-oxford-shirt", "Áo sơ mi Office Blue", "cat-shirts", "Sơ mi phom relaxed, chất poplin ít nhăn dành cho công sở và những buổi gặp gỡ cuối tuần.", "photo-1584030373081-f37b7bb4fa8e"],
  ["prod-wide-trousers", "Quần jeans ống rộng", "cat-denim", "Jeans cạp cao ống rộng giúp kéo dài vóc dáng, chất denim đứng phom nhưng vẫn dễ vận động.", "photo-1594633312681-425c7b97ccd1"],
  ["prod-relaxed-denim", "Quần tây Relaxed", "cat-trousers", "Quần tây ống suông với ly trước nhẹ và cạp cao, phù hợp phong cách công sở hiện đại.", "photo-1506629082955-511b1aa562c8"],
  ["prod-utility-shorts", "Quần short Utility", "cat-shorts", "Quần short cạp cao, ống rộng vừa và túi hộp nhỏ tạo vẻ năng động.", "photo-1529139574466-a303027c1d8b"],
  ["prod-slip-dress", "Đầm lụa Bias", "cat-dresses", "Đầm hai dây cắt xéo, bề mặt satin mềm và độ rủ tự nhiên cho những buổi hẹn tối.", "photo-1566174053879-31528523f8ae"],
  ["prod-shirt-dress", "Đầm sơ mi Linen", "cat-dresses", "Đầm sơ mi dáng midi đi kèm dây thắt eo, linh hoạt từ công sở đến kỳ nghỉ.", "photo-1572804013309-59a88b7e92f1"],
  ["prod-canvas-tote", "Túi tote Daily", "cat-bags", "Túi tote rộng rãi với ngăn trong tiện dụng, phù hợp đi làm và dạo phố.", "photo-1578606137970-de4c3d8a08a2"],
  ["prod-cap", "Mũ bucket Weekend", "cat-hats", "Mũ bucket vành vừa, chất cotton mềm và có thể gấp gọn khi di chuyển.", "photo-1521369909029-2afed882baee"],
  ["prod-belt", "Thắt lưng Slim Classic", "cat-belts", "Thắt lưng bản nhỏ với khóa kim loại tối giản, tạo điểm nhấn cho đầm và quần cạp cao.", "photo-1624222247344-550fb60583dc"],
  ["prod-essential-rib-tee", "Áo thun Rib Fit", "cat-tshirts", "Áo thun gân ôm vừa cơ thể, co giãn mềm và dễ mặc như lớp nền hằng ngày.", "photo-1509631179647-0177331693ae"],
  ["prod-weekend-stripe-tee", "Áo thun Breton", "cat-tshirts", "Áo thun sọc ngang thanh lịch, phom suông nhẹ lấy cảm hứng từ phong cách Pháp.", "photo-1584030373081-f37b7bb4fa8e"],
  ["prod-clean-collar-polo", "Áo kiểu cổ vuông", "cat-polos", "Áo kiểu cổ vuông với đường chiết eo nhẹ, tôn phần cổ và vai.", "photo-1564257631407-4deb1f99d992"],
  ["prod-soft-touch-polo", "Áo kiểu tay phồng", "cat-polos", "Áo kiểu tay phồng mềm, cổ tròn nhỏ và thân áo gọn để phối chân váy.", "photo-1534528741775-53994a69daeb"],
  ["prod-cropped-baby-tee", "Áo thun Baby Tee", "cat-tshirts", "Baby tee dáng lửng, chất cotton co giãn và đường viền cổ gọn.", "photo-1515886657613-9f3515b0c78f"],
  ["prod-relaxed-poplin-shirt", "Áo sơ mi Poplin", "cat-shirts", "Sơ mi poplin phom rộng, cổ đứng mềm và tay áo có thể xắn gọn.", "photo-1584030373081-f37b7bb4fa8e"],
  ["prod-denim-overshirt", "Áo khoác denim dáng ngắn", "cat-light-jackets", "Áo khoác denim dáng lửng với wash xanh nhẹ, tạo điểm nhấn cho đầm và quần cạp cao.", "photo-1485968579580-b6d095142e6e"],
  ["prod-cropped-linen-shirt", "Áo sơ mi Linen Crop", "cat-shirts", "Sơ mi linen dáng lửng với tay rộng, phù hợp phối cùng chân váy midi.", "photo-1564257631407-4deb1f99d992"],
  ["prod-utility-light-jacket", "Blazer City", "cat-jackets", "Blazer nhẹ có đường vai gọn và phần eo cân đối, phù hợp tủ đồ công sở hiện đại.", "photo-1779150182406-accea37308c8"],
  ["prod-soft-cardigan-jacket", "Cardigan Soft Knit", "cat-cardigans", "Cardigan dệt mềm, dáng ngắn vừa và hàng nút thanh lịch.", "photo-1434389677669-e08b4cac3105"],
  ["prod-straight-chino", "Quần tây ống đứng", "cat-trousers", "Quần tây ống đứng, cạp cao và đường ly ép phẳng tạo vẻ gọn gàng.", "photo-1594633312681-425c7b97ccd1"],
  ["prod-pleated-work-trousers", "Quần tây xếp ly", "cat-trousers", "Quần tây xếp ly trước với ống rộng vừa, thích hợp cho tủ đồ công sở.", "photo-1506629082955-511b1aa562c8"],
  ["prod-barrel-leg-denim", "Quần jeans Barrel", "cat-denim", "Jeans ống barrel hiện đại, cạp cao ôm gọn và wash xanh cổ điển.", "photo-1541099649105-f69ad21f3246"],
  ["prod-linen-drawstring-pants", "Quần Linen Flow", "cat-trousers", "Quần linen ống rộng, cạp chun êm và độ rủ nhẹ cho ngày hè.", "photo-1594633312681-425c7b97ccd1"],
  ["prod-slim-black-denim", "Quần jeans Slim Black", "cat-denim", "Jeans màu đen phom slim vừa phải, tôn chân và co giãn nhẹ.", "photo-1542272604-787c3835535d"],
  ["prod-tailored-bermuda", "Quần short Bermuda", "cat-shorts", "Quần Bermuda may đo với cạp cao và chiều dài thanh lịch trên gối.", "photo-1591195853828-11db59a44f6b"],
  ["prod-linen-easy-shorts", "Quần short Linen", "cat-shorts", "Quần short linen ống rộng, lưng chun phía sau và túi chéo tiện dụng.", "photo-1565084888279-aca607ecce0c"],
  ["prod-denim-a-line-skirt", "Chân váy chữ A Denim", "cat-skirt-denim", "Chân váy chữ A bằng denim, cạp cao và chiều dài trên gối dễ phối.", "photo-1550639525-c97d455acf70"],
  ["prod-satin-midi-skirt", "Chân váy Satin Midi", "cat-skirt-midi", "Chân váy midi cắt xéo với satin lì, chuyển động mềm mại theo bước chân.", "photo-1550639525-c97d455acf70"],
  ["prod-cargo-mini-skirt", "Chân váy Mini Cargo", "cat-skirt-mini", "Chân váy mini với túi hộp nhỏ và phom chữ A trẻ trung.", "photo-1515886657613-9f3515b0c78f"],
  ["prod-column-knit-dress", "Đầm dệt kim Column", "cat-dresses", "Đầm dệt kim ôm vừa, cổ vuông và chiều dài midi thanh lịch.", "photo-1566174053879-31528523f8ae"],
  ["prod-weekend-wrap-dress", "Đầm Wrap Weekend", "cat-dresses", "Đầm quấn tay ngắn, dây eo điều chỉnh và tà midi mềm mại.", "photo-1595777457583-95e059d581b8"],
  ["prod-utility-jumpsuit", "Set blazer City", "cat-office-sets", "Set blazer và quần đồng điệu với đường cắt gọn, phù hợp ngày làm việc và những cuộc hẹn trang trọng.", "photo-1773859096339-dd1ca5158835"],
  ["prod-linen-midi-dress", "Đầm Linen Midi", "cat-dresses", "Đầm linen cổ vuông, thân váy xòe nhẹ và túi ẩn hai bên.", "photo-1623609163859-ca93c959b98a"],
  ["prod-minimal-slip-jumpsuit", "Set liền thân Minimal", "cat-jumpsuits", "Thiết kế liền thân tối giản, nhấn eo nhẹ và dễ phối cùng áo khoác mỏng.", "photo-1618932260643-eee4a2f652a6"],
  ["prod-mini-shoulder-bag", "Túi xách Mini", "cat-bags", "Túi xách dáng hộp nhỏ với quai đeo vai điều chỉnh và khóa nam châm.", "photo-1559563458-527698bf5295"],
  ["prod-woven-market-bag", "Túi cói Summer", "cat-bags", "Túi cói phom mềm, lòng rộng cho những chuyến đi biển và cuối tuần.", "photo-1594223274512-ad4803739b7c"],
  ["prod-everyday-bucket-hat", "Mũ rộng vành", "cat-hats", "Mũ vành mềm giúp che nắng, có dây rút nhỏ để điều chỉnh.", "photo-1521369909029-2afed882baee"],
  ["prod-silk-neck-scarf", "Khăn lụa Signature", "cat-scarves", "Khăn lụa họa tiết thanh lịch, có thể dùng cho cổ, tóc hoặc quai túi.", "photo-1601924994987-69e26d50dc26"],
  ["prod-compact-card-wallet", "Ví Compact", "cat-wallets", "Ví nhỏ gọn với nhiều ngăn thẻ, khóa bấm và bề mặt da mịn.", "photo-1627123424574-724758594e93"]
];

const vietnameseProductNames = new Map([
  ["prod-heavy-tee", "Áo thun cotton mềm"],
  ["prod-boxy-tee", "Áo thun dáng lửng"],
  ["prod-linen-shirt", "Áo sơ mi linen thoáng mát"],
  ["prod-oxford-shirt", "Áo sơ mi công sở xanh"],
  ["prod-relaxed-denim", "Quần tây ống suông"],
  ["prod-utility-shorts", "Quần short túi hộp"],
  ["prod-slip-dress", "Đầm lụa cắt xéo"],
  ["prod-shirt-dress", "Đầm sơ mi linen"],
  ["prod-canvas-tote", "Túi tote hằng ngày"],
  ["prod-cap", "Mũ bucket cuối tuần"],
  ["prod-belt", "Thắt lưng bản nhỏ cổ điển"],
  ["prod-essential-rib-tee", "Áo thun gân ôm"],
  ["prod-weekend-stripe-tee", "Áo thun sọc ngang"],
  ["prod-cropped-baby-tee", "Áo thun dáng ôm lửng"],
  ["prod-relaxed-poplin-shirt", "Áo sơ mi poplin"],
  ["prod-cropped-linen-shirt", "Áo sơ mi linen dáng lửng"],
  ["prod-utility-light-jacket", "Áo blazer công sở"],
  ["prod-soft-cardigan-jacket", "Áo cardigan dệt mềm"],
  ["prod-barrel-leg-denim", "Quần jeans ống cong"],
  ["prod-linen-drawstring-pants", "Quần linen ống rộng"],
  ["prod-slim-black-denim", "Quần jeans đen ôm nhẹ"],
  ["prod-linen-easy-shorts", "Quần short linen"],
  ["prod-denim-a-line-skirt", "Chân váy denim chữ A"],
  ["prod-satin-midi-skirt", "Chân váy satin midi"],
  ["prod-cargo-mini-skirt", "Chân váy mini túi hộp"],
  ["prod-column-knit-dress", "Đầm dệt kim dáng cột"],
  ["prod-weekend-wrap-dress", "Đầm quấn cuối tuần"],
  ["prod-utility-jumpsuit", "Set blazer công sở"],
  ["prod-linen-midi-dress", "Đầm linen midi"],
  ["prod-minimal-slip-jumpsuit", "Set liền thân tối giản"],
  ["prod-mini-shoulder-bag", "Túi xách mini"],
  ["prod-woven-market-bag", "Túi cói mùa hè"],
  ["prod-silk-neck-scarf", "Khăn lụa họa tiết"],
  ["prod-compact-card-wallet", "Ví nhỏ gọn"]
]);

womenCatalog.forEach((product) => {
  product[1] = vietnameseProductNames.get(product[0]) || product[1];
});

const womenProductMap = new Map(womenCatalog.map(([id, ...values]) => [id, values]));
const detailByGroup = {
  "group-tops": { material: "Cotton, linen hoặc sợi dệt mềm phù hợp khí hậu Việt Nam.", fit: "Phom nữ cân đối, dễ phối với quần và chân váy cạp cao.", care: "Giặt nhẹ với sản phẩm cùng màu, phơi trong bóng râm." },
  "group-bottoms": { material: "Vải may mặc có độ đứng và độ rủ vừa phải.", fit: "Thiết kế cạp cao giúp tôn eo và kéo dài tỷ lệ cơ thể.", care: "Lộn trái khi giặt, tránh sấy nhiệt cao." },
  "group-dresses": { material: "Linen, satin hoặc vải dệt mềm có lớp lót phù hợp.", fit: "Phom nữ tôn dáng, ưu tiên sự thoải mái khi vận động.", care: "Giặt tay hoặc chế độ nhẹ, ủi ở nhiệt độ thấp." },
  "group-sets": { material: "Vải may mặc ít nhăn, có độ rủ và đứng phom cân đối.", fit: "Các món trong set được thiết kế đồng điệu, dễ mặc cùng hoặc tách rời.", care: "Giặt nhẹ, treo phẳng và ủi ở nhiệt độ thấp." },
  "group-jackets": { material: "Denim, cotton hoặc sợi dệt mềm phù hợp mặc nhiều lớp.", fit: "Phom khoác gọn, chừa độ rộng vừa đủ cho lớp áo bên trong.", care: "Giặt theo hướng dẫn riêng trên nhãn và phơi bằng móc." },
  "group-accessories": { material: "Chất liệu được chọn để bền, nhẹ và dễ sử dụng hằng ngày.", fit: "Kích thước thực tế được thể hiện trong lựa chọn sản phẩm.", care: "Lau bằng khăn mềm và bảo quản nơi khô thoáng." }
};

productSeeds.forEach((product) => {
  const override = womenProductMap.get(product.id);
  if (!override) throw new Error(`Missing women catalog override for ${product.id}`);
  const [name, categoryId, description, imageId] = override;
  const category = categories.find((item) => item.id === categoryId);
  product.name = name;
  product.categoryId = categoryId;
  product.description = description;
  product.images = [`https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=1200&q=85`];
  product.details = detailByGroup[category.groupId];
});

// Keep one true single-variant item for the product-card quick-add flow.
productSeeds.find((product) => product.id === "prod-compact-card-wallet").colors = ["Đen"];
productSeeds.find((product) => product.id === "prod-canvas-tote").colors.push("Đỏ rượu");

const generatedVariants = productSeeds.flatMap((product, productIndex) =>
  product.colors.flatMap((color, colorIndex) =>
    product.sizes.map((size, sizeIndex) => ({
      id: `var-${product.id.replace("prod-", "")}-${colorIndex + 1}-${sizeIndex + 1}`,
      productId: product.id,
      size,
      color,
      stock: 4 + ((productIndex + colorIndex * 2 + sizeIndex * 3) % 12),
      image: product.images[colorIndex % product.images.length]
    }))
  )
);

const orders = [
  {
    id: "TC-DEMO-1001",
    customerName: "Lê Hoàng Nam",
    phone: "0912345678",
    address: "25 Nguyễn Trãi, Quận 1, TP.HCM",
    region: "HCM",
    paymentMethod: "COD",
    shippingFee: 0,
    subtotal: 780000,
    discount: 0,
    voucherCode: null,
    total: 780000,
    status: "COMPLETED",
    createdAt: "2026-06-13T09:30:00.000Z"
  },
  {
    id: "TC-DEMO-1002",
    customerName: "Trần Ngọc Mai",
    phone: "0987654321",
    address: "18 Cầu Giấy, Quận Cầu Giấy, Hà Nội",
    region: "HANOI",
    paymentMethod: "BANK_TRANSFER",
    shippingFee: 35000,
    subtotal: 260000,
    discount: 0,
    voucherCode: null,
    total: 295000,
    status: "PENDING",
    createdAt: "2026-06-14T03:15:00.000Z"
  },
  {
    id: "TC-DEMO-1003",
    customerName: "Phạm Thanh Hà",
    phone: "0903456789",
    address: "72 Lê Lợi, Thành phố Đà Nẵng",
    region: "OTHER",
    paymentMethod: "COD",
    shippingFee: 0,
    subtotal: 590000,
    discount: 0,
    voucherCode: null,
    total: 590000,
    status: "SHIPPING",
    createdAt: "2026-06-14T08:45:00.000Z"
  }
];

const orderItems = [
  {
    id: "item-demo-1001",
    orderId: "TC-DEMO-1001",
    productId: "prod-heavy-tee",
    variantId: "var-heavy-tee-1-2",
    productName: "Áo thun Soft Cotton",
    size: "M",
    color: "Trắng",
    quantity: 2,
    price: 390000
  },
  {
    id: "item-demo-1002",
    orderId: "TC-DEMO-1002",
    productId: "prod-cap",
    variantId: "var-cap-1-1",
    productName: "Mũ bucket Weekend",
    size: "One Size",
    color: "Navy",
    quantity: 1,
    price: 260000
  },
  {
    id: "item-demo-1003",
    orderId: "TC-DEMO-1003",
    productId: "prod-oxford-shirt",
    variantId: "var-oxford-shirt-2-3",
    productName: "Áo sơ mi Office Blue",
    size: "L",
    color: "Xanh nhạt",
    quantity: 1,
    price: 590000
  }
];

orderItems.forEach((item) => {
  item.productName =
    productSeeds.find((product) => product.id === item.productId)?.name || item.productName;
});

const orderedQuantities = new Map(
  orderItems.map((item) => [item.variantId, item.quantity])
);
const stockOverrides = new Map([
  ["var-heavy-tee-3-4", 0],
  ["var-slip-dress-2-3", 0],
  ["var-cap-3-1", 0]
]);
const variants = generatedVariants.map((variant) => ({
  ...variant,
  stock:
    stockOverrides.get(variant.id) ??
    variant.stock - (orderedQuantities.get(variant.id) || 0)
}));

const [adminPasswordHash, staffPasswordHash, customerPasswordHash] = await Promise.all([
  bcrypt.hash("admin123", 10),
  bcrypt.hash("staff123", 10),
  bcrypt.hash("customer123", 10)
]);

db.data = {
  users: [
    {
      id: "user-admin",
      name: "Chủ cửa hàng THREAD & CO.",
      email: "admin@threadco.vn",
      passwordHash: adminPasswordHash,
      role: "admin"
    },
    {
      id: "user-staff",
      name: "THREAD & CO Staff",
      email: "staff@threadco.vn",
      passwordHash: staffPasswordHash,
      role: "staff"
    },
    {
      id: "user-customer-demo",
      name: "Nguyễn Minh Anh",
      email: "customer@threadco.vn",
      phone: "0901234567",
      passwordHash: customerPasswordHash,
      role: "customer",
      createdAt: "2026-06-15T00:00:00.000Z"
    }
  ],
  categoryGroups,
  categories,
  products: productSeeds,
  variants,
  vouchers,
  leads: [],
  orders,
  order_items: orderItems
};

await db.write();

console.log(
  `Seeded ${db.data.users.length} users, ${categoryGroups.length} category groups, ` +
    `${categories.length} categories, ${productSeeds.length} products, ${variants.length} variants, ` +
    `${vouchers.length} vouchers and ${orders.length} demo orders.`
);
console.log("Admin: admin@threadco.vn / admin123");
console.log("Staff: staff@threadco.vn / staff123");
console.log("Customer: customer@threadco.vn / customer123");
