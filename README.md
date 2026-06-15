# THREAD & CO

Website thời trang nữ fullstack sử dụng React + Vite, Node.js + Express và lowdb.

Yêu cầu: Node.js `22.12.0` trở lên.

## Cấu trúc dự án

```text
.
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── data/db.json
│   ├── src/
│   │   ├── db.js
│   │   ├── index.js
│   │   ├── seed.js
│   │   └── test-api.js
│   ├── .env.example
│   └── package.json
└── README.md
```

## Chức năng bàn giao

Trang khách hàng:

- Trang chủ có banner, hàng mới và bán chạy; khối bán chạy được ưu tiên ngay sau hàng mới.
- Catalog responsive với lọc nhóm/danh mục con, size, màu, sale và sắp xếp.
- Chi tiết sản phẩm theo tổ hợp Size × Màu, tồn kho thực tế và khối mô tả gồm chất liệu, phom dáng, bảo quản.
- Danh sách voucher ở trang chi tiết và chọn voucher hợp lệ khi thanh toán.
- Yêu thích và giỏ hàng lưu bằng `localStorage`.
- Nút thêm nhanh trên product card; sản phẩm nhiều biến thể bắt buộc chọn size/màu tại trang chi tiết.
- Đăng ký/đăng nhập khách hàng bằng bcrypt + JWT.
- Checkout yêu cầu khách hàng đăng nhập, hỗ trợ COD/chuyển khoản, phí ship theo vùng và freeship.
- Tra cứu trạng thái và tiến trình đơn hàng bằng mã đơn.
- Hotline `tel:`, Zalo, form nhận ưu đãi lưu lead vào lowdb.
- Footer có thông tin liên hệ, chính sách đổi trả, giao hàng và hướng dẫn mua sắm.
- Không hiển thị liên kết hay thẻ quản trị; khu vực vận hành dùng đường dẫn riêng và bắt buộc đăng nhập.

Trang quản trị:

- Đăng nhập JWT, phân quyền `admin` và `staff`.
- Tài khoản chủ cửa hàng dùng role `admin`, có toàn quyền vận hành.
- Dashboard chủ cửa hàng có doanh thu, giá trị đơn trung bình, giá trị tồn kho, tình trạng đơn và sản phẩm bán nổi bật.
- Nhân viên chỉ thấy ba thẻ Tổng quan, Đơn hàng và Kho hàng.
- Doanh thu chỉ dành cho admin; staff nhận HTTP 403.
- Xem chi tiết và cập nhật trạng thái đơn.
- Theo dõi tồn kho từng variant, cảnh báo sắp hết/hết hàng.
- Kho được gom theo sản phẩm, có sort size, chỉnh số lượng và xóa sản phẩm.
- Tab Sản phẩm dành riêng cho chủ cửa hàng/admin: thêm, sửa, xóa và quản lý toàn bộ nội dung hiển thị phía khách hàng.
- Form sản phẩm quản lý tên, slug, danh mục, mô tả, giá, ảnh, kích thước, màu, cờ hiển thị, thông tin chi tiết và tồn kho từng biến thể.
- Danh sách dashboard, đơn hàng và kho có phân trang.

## Chạy backend

```bash
cd server
npm install
cp .env.example .env
npm run seed
npm start
```

Backend chạy tại `http://localhost:4000`.

Tài khoản vận hành được tạo bởi seed:

| Role | Email | Mật khẩu |
| --- | --- | --- |
| Chủ cửa hàng / Admin | `admin@threadco.vn` | `admin123` |
| Nhân viên | `staff@threadco.vn` | `staff123` |
| Khách hàng demo | `customer@threadco.vn` | `customer123` |

Mật khẩu được hash bằng bcrypt trước khi ghi vào `server/data/db.json`.

## Database

lowdb lưu dữ liệu trong `server/data/db.json` với các collection:

- `users`
- `categoryGroups`
- `categories`
- `products`
- `variants`
- `vouchers`
- `leads`
- `orders`
- `order_items`

Seed hiện có 6 nhóm danh mục, 20 danh mục con, 42 sản phẩm, 262 biến thể Size × Màu, 3 voucher và 3 đơn demo. Mỗi biến thể có tồn kho riêng và dữ liệu mẫu có cả hàng sắp hết lẫn hết hàng.

Toàn bộ catalog là sản phẩm dành cho nữ. Hệ danh mục:

- Áo: Áo thun, Áo kiểu, Áo sơ mi.
- Quần: Quần tây, Quần jeans, Quần short.
- Váy / Đầm: Chân váy chữ A, Chân váy midi, Chân váy mini, Đầm.
- Set đồ: Set liền thân, Set công sở.
- Áo khoác: Blazer, Cardigan, Áo khoác nhẹ.
- Phụ kiện: Túi xách, Mũ, Thắt lưng, Khăn, Ví.

## API

### Health check

```http
GET /api/health
```

### Danh mục và voucher

```http
GET /api/categories
GET /api/vouchers
```

`/api/categories` trả về nhóm danh mục kèm danh mục con. `/api/vouchers` chỉ trả về voucher đang hoạt động và còn hạn.

### Danh sách sản phẩm

```http
GET /api/products
```

Query hỗ trợ:

| Query | Giá trị |
| --- | --- |
| `search` | Từ khóa tên, mô tả, danh mục, màu hoặc kích thước; không phân biệt dấu |
| `category` | ID, slug hoặc tên nhóm/danh mục con |
| `size` | Ví dụ `M`, `XL`, `One Size` |
| `color` | Ví dụ `Đen`, `Cát` |
| `sale` | `true`, `false`, `1`, `0` |
| `sort` | `newest`, `price_asc`, `price_desc`, `bestseller` |

Ví dụ:

```bash
curl "http://localhost:4000/api/products?search=cong%20so"
curl "http://localhost:4000/api/products?category=ao-so-mi&size=M&color=C%C3%A1t&sort=price_asc"
curl "http://localhost:4000/api/products?category=vay-dam"
curl "http://localhost:4000/api/products?sale=true&sort=price_desc"
```

Mỗi sản phẩm trả về kèm thông tin `category` và danh sách `variants`.

### Chi tiết sản phẩm

Có thể dùng ID hoặc slug:

```http
GET /api/products/:id
```

```bash
curl "http://localhost:4000/api/products/prod-linen-shirt"
curl "http://localhost:4000/api/products/linen-camp-shirt"
```

### Tài khoản khách hàng

```http
POST /api/customer/register
POST /api/customer/login
GET /api/customer/me
```

Đăng ký yêu cầu `name`, `email`, số điện thoại Việt Nam và mật khẩu tối thiểu 8 ký tự. Login trả về JWT role `customer`.

### Lead nhận ưu đãi

```http
POST /api/leads
```

Payload gồm `email`, `consent: true` và tùy chọn `name`, `phone`, `source`. Lead được lưu trong collection `leads` của lowdb.

### Đặt hàng

API yêu cầu JWT của khách hàng:

```http
POST /api/orders
Content-Type: application/json
Authorization: Bearer <customer-jwt>
```

Payload:

```json
{
  "customerName": "Nguyễn Minh Anh",
  "phone": "0901234567",
  "address": "123 Nguyễn Huệ, Quận 1, TP.HCM",
  "region": "HCM",
  "paymentMethod": "COD",
  "voucherCode": "FREESHIP",
  "items": [
    {
      "variantId": "var-linen-shirt-1-1",
      "quantity": 1
    }
  ]
}
```

Giá trị hợp lệ:

- `region`: `HCM`, `HANOI`, `OTHER`
- `paymentMethod`: `COD`, `BANK_TRANSFER`

Phí giao hàng:

| Vùng | Phí |
| --- | ---: |
| `HCM` | 30.000 VND |
| `HANOI` | 35.000 VND |
| `OTHER` | 45.000 VND |

Đơn có tiền hàng từ 500.000 VND được miễn phí giao hàng.

Ví dụ curl:

```bash
curl -X POST "http://localhost:4000/api/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <customer-jwt>" \
  -d '{
    "customerName": "Nguyễn Minh Anh",
    "phone": "0901234567",
    "address": "123 Nguyễn Huệ, Quận 1, TP.HCM",
    "region": "HCM",
    "paymentMethod": "COD",
    "items": [
      {
        "variantId": "var-linen-shirt-1-1",
        "quantity": 1
      }
    ]
  }'
```

API kiểm tra toàn bộ đơn trước khi ghi dữ liệu. Nếu variant không tồn tại, vượt tồn kho hoặc thông tin khách hàng sai, API trả JSON có `code` và `message`; kho không bị thay đổi.

Voucher được kiểm tra lại ở backend theo trạng thái, hạn dùng và giá trị đơn tối thiểu. Backend là nguồn tính toán chính thức cho giảm giá, phí giao hàng và tổng đơn.

### Tra cứu đơn hàng

Đây là API công khai, chỉ trả thông tin cần thiết và không để lộ tên, số điện thoại hoặc địa chỉ khách hàng:

```http
GET /api/orders/track/:orderId
```

```bash
curl "http://localhost:4000/api/orders/track/TC-DEMO-1002"
```

### Đăng nhập nhân viên

```http
POST /api/auth/login
GET /api/auth/me
```

`GET /api/auth/me` yêu cầu:

```text
Authorization: Bearer <jwt-token>
```

### API quản trị

Tất cả API dưới đây yêu cầu JWT:

| Method | Endpoint | Quyền |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard` | admin, staff |
| `GET` | `/api/admin/reports/revenue` | admin |
| `GET` | `/api/admin/orders` | admin, staff |
| `GET` | `/api/admin/orders/:id` | admin, staff |
| `PATCH` | `/api/admin/orders/:id/status` | admin, staff |
| `GET` | `/api/admin/inventory` | admin, staff |
| `PATCH` | `/api/admin/inventory/:variantId` | admin, staff |
| `GET` | `/api/admin/products` | admin |
| `POST` | `/api/admin/products` | admin |
| `PUT` | `/api/admin/products/:productId` | admin |
| `DELETE` | `/api/admin/products/:productId` | admin |

Trạng thái đơn hợp lệ:

- `PENDING`: Chờ xác nhận
- `CONFIRMED`: Đã xác nhận
- `SHIPPING`: Đang giao
- `COMPLETED`: Hoàn thành
- `CANCELLED`: Hủy

Khi hủy đơn, tồn kho được hoàn lại một lần. Đơn đã hủy không thể chuyển sang trạng thái khác.

Cập nhật tồn kho:

```bash
curl -X PATCH "http://localhost:4000/api/admin/inventory/VARIANT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN" \
  -d '{"stock":12}'
```

Xóa sản phẩm sẽ xóa sản phẩm và các variant khỏi catalog/kho. `order_items` cũ vẫn được giữ để bảo toàn lịch sử đơn hàng.

Ví dụ cập nhật trạng thái:

```bash
curl -X PATCH "http://localhost:4000/api/admin/orders/ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_TOKEN" \
  -d '{"status":"CONFIRMED"}'
```

## Kiểm thử backend

Khởi động server sau khi seed:

```bash
cd server
npm run seed
npm start
```

Ở terminal khác:

```bash
cd server
npm run test:api
```

Test runner kiểm tra:

- Lấy đúng 42 sản phẩm và kiểm tra toàn bộ sản phẩm có danh mục hợp lệ.
- Lấy cấu trúc nhóm danh mục và danh sách voucher.
- Lọc theo category, size, color, sale và sort.
- Lọc sản phẩm theo nhóm danh mục cha.
- Xem chi tiết sản phẩm.
- Đặt hàng hợp lệ và miễn phí ship từ 500.000 VND.
- Áp dụng voucher hợp lệ và chặn voucher không tồn tại.
- Tra cứu đơn bằng mã, không trả dữ liệu cá nhân.
- Tính phí ship theo vùng cho đơn dưới 500.000 VND.
- Stock giảm đúng sau khi đặt hàng.
- Đơn vượt tồn kho bị chặn và không làm thay đổi stock.
- Số điện thoại sai bị chặn và không làm thay đổi stock.
- Đăng nhập bcrypt cho tài khoản admin và staff.
- Đăng ký/đăng nhập khách hàng, chặn checkout khi thiếu JWT.
- Validate và lưu lead nhận ưu đãi.
- Customer gọi API admin nhận HTTP 403.
- Admin xem được doanh thu của đơn hoàn thành.
- Staff gọi report doanh thu nhận HTTP 403.
- Staff xem/cập nhật đơn và xem tồn kho.
- Admin/staff cập nhật số lượng từng variant.
- Chỉ admin được xóa sản phẩm.
- Admin tạo, sửa, xóa sản phẩm và biến thể; staff gọi API sản phẩm nhận HTTP 403.
- Hủy đơn hoàn kho đúng một lần.

Chạy lại `npm run seed` sau test nếu cần đưa database về trạng thái ban đầu.

## Chạy frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

Frontend chạy tại `http://localhost:5173`.

Các đường dẫn demo:

- `http://localhost:5173/#/`: trang chủ.
- `http://localhost:5173/#/shop`: danh sách sản phẩm.
- `http://localhost:5173/#/product/linen-camp-shirt`: chi tiết sản phẩm.
- `http://localhost:5173/#/track`: tra cứu trạng thái đơn hàng.
- `http://localhost:5173/#/account`: đăng ký/đăng nhập khách hàng.
- `http://localhost:5173/#/admin`: đăng nhập quản trị.

Biến cấu hình liên hệ trong `client/.env`:

```env
VITE_STORE_PHONE=0901234567
VITE_STORE_PHONE_LABEL=0901 234 567
VITE_ZALO_URL=https://zalo.me/0901234567
```

Quy trình checkout: thêm sản phẩm vào giỏ → đăng nhập/đăng ký customer → mở lại giỏ → thanh toán. Backend cũng kiểm tra JWT customer, nên không thể bỏ qua bước đăng nhập bằng cách gọi API trực tiếp.

Build production:

```bash
cd client
npm run build
```

## Kiểm tra bàn giao

```bash
# Terminal 1
cd server
npm run seed
npm start

# Terminal 2
cd client
npm run dev

# Terminal 3
cd server
npm run test:api

# Kiểm tra production build
cd ../client
npm run build
```

## Lưu ý bàn giao

- `npm run seed` xóa dữ liệu phát sinh và đưa database về bộ dữ liệu mẫu, gồm 3 đơn demo.
- Mã đơn có sẵn để demo tra cứu: `TC-DEMO-1001`, `TC-DEMO-1002`, `TC-DEMO-1003`.
- Voucher demo: `THREAD10`, `WELCOME50`, `FREESHIP`.
- Dữ liệu thật nằm tại `server/data/db.json`.
- Giỏ hàng và yêu thích nằm trong localStorage của trình duyệt.
- Phiên quản trị dùng key `threadco_admin` trong localStorage.
- Đổi `JWT_SECRET` trong `server/.env` trước khi triển khai production.
- Cấu hình `CLIENT_URL` nếu frontend được phục vụ từ domain khác.
