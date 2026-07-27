# Buôn Bán Xe

Chatbot quản lý kho xe (1 người dùng) — dữ liệu SQLite lưu trên máy tại `data/inventory.db`.

## Chạy

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Lệnh chat

| Lệnh | Ví dụ | Việc làm |
|------|--------|----------|
| Nhập xe | `nhập GTR 10m` | Lưu giá nhập, giá bán dự kiến = +35%, trạng thái **Còn hàng**, ghi giờ nhập |
| Đặt cọc | `/coc GTR 100k` | Đổi sang **đã đặt cọc**, lưu tiền cọc + ngày cọc |
| Bán | `bán GTR 13.5m` | Chỉ khi đủ **48 giờ** sau nhập; trừ **5% thuế**; lãi = giá bán×0.95 − giá nhập |
| Kho | `kho` | Danh sách xe |
| Tổng hợp ngày | `hôm nay` | Xe nhập/cọc/bán + lãi trong ngày |
| Tổng | `tổng` | Tổng tiền nhập / bán / lãi |
| Chi tiết | `tìm GTR` | Xem 1 xe |
| Help | `help` | Hướng dẫn |

### Giá viết tắt

- `10m` / `10tr` = 10.000.000 đ
- `100k` = 100.000 đ
- `7.5m` = 7.500.000 đ

## Quy tắc nghiệp vụ

1. Xe nhập sau **48 giờ** mới bán được.
2. Giá bán dự kiến = giá nhập × **1.35**.
3. Lãi thực = giá bán thực tế × **0.95** − giá nhập.
