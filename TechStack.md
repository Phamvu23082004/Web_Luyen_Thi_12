# Tech Stack — OnThi12

Tài liệu này liệt kê công nghệ đề xuất cho từng lớp trong kiến trúc **Service-Oriented (shared database)** đã thống nhất, phù hợp quy mô đồ án (150–200 người dùng đồng thời, 1 người phát triển).

---

## 1. Frontend

| Công nghệ | Vai trò |
|---|---|
| **React + TypeScript** | Framework chính, type-safe |
| **Vite** | Build tool, dev server nhanh |
| **TailwindCSS** | Styling, dễ áp dụng bảng màu ý nghĩa (xanh/vàng/đỏ — mục 5.3 SRS) |
| **shadcn/ui** | Component có sẵn: bảng, form, dialog, dropdown |
| **Recharts** | Vẽ biểu đồ điểm theo thời gian (DASH-01, DASH-02) |
| **TanStack Query (React Query)** | Gọi API, cache phía client, auto refetch |

## 2. Backend

| Công nghệ | Vai trò |
|---|---|
| **Node.js + TypeScript** | Runtime chính |
| **NestJS** | Framework — có sẵn module, dependency injection, guard (phân quyền), pipe (validate) |
| *(thay thế)* **Express** | Nếu muốn tối giản hơn NestJS |
| *(thay thế)* **Python + FastAPI** | Nếu quen Python hơn; SDK Gemini cho Python rất mượt |

Mỗi service (Auth, Exam, Submission, Dashboard, AI Parsing) là 1 module NestJS riêng ở giai đoạn Modular Monolith, sau đó tách thành container độc lập.

## 3. Database & Cache

| Công nghệ | Vai trò |
|---|---|
| **PostgreSQL 16** | Database chính — hỗ trợ JSON column (options câu hỏi), transaction mạnh (NFR-04) |
| **Prisma ORM** | Type-safe query, tự sinh migration, schema dễ đọc |
| **Redis** | Cache dashboard (9.1), rate limiting (9.6) |

## 4. Message Queue & AI

| Công nghệ | Vai trò |
|---|---|
| **RabbitMQ** | Hàng đợi xử lý bất đồng bộ cho AI Parsing + tính dashboard (9.2), có UI quản lý trực quan để demo |
| **amqplib** | Thư viện Node.js kết nối RabbitMQ |
| **Google Generative AI SDK** (`@google/generative-ai`) | Gọi Gemini API (model Flash/Flash-Lite — NFR-09) để trích xuất câu hỏi từ PDF |

## 5. Hạ tầng & DevOps

| Công nghệ | Vai trò |
|---|---|
| **Docker + Docker Compose** | Container hoá từng service |
| **Nginx** | Reverse proxy, load balancer, phục vụ SSL |
| **GitHub Actions** | CI/CD — tự động deploy khi push code |
| **Oracle Cloud Free Tier** (hoặc VPS sinh viên) | Hosting |

## 6. Giám sát (thêm sau MVP — mục 9.5 SRS)

| Công nghệ | Vai trò |
|---|---|
| **Prometheus + Grafana** | Theo dõi độ trễ API, tỷ lệ lỗi, tải hệ thống |

---

## Bảng tổng hợp nhanh

| Lớp | Công nghệ |
|---|---|
| Frontend | React + TypeScript + Tailwind + shadcn/ui |
| Backend | Node.js + NestJS |
| Database | PostgreSQL + Prisma |
| Cache | Redis |
| Message Queue | RabbitMQ |
| AI Parsing | Gemini API |
| Reverse Proxy | Nginx |
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Hosting | VPS (Oracle Cloud Free Tier) |
| Giám sát | Prometheus + Grafana (sau MVP) |

---

## Ghi chú lựa chọn

- Chọn **cùng 1 ngôn ngữ (TypeScript)** cho cả frontend và backend để giảm gánh nặng học 2 ngôn ngữ cùng lúc trong thời gian đồ án.
- **NestJS** được ưu tiên hơn Express vì cấu trúc module sẵn có ánh xạ trực tiếp sang các service đã thiết kế trong SRS (Auth, Exam, Submission, Dashboard), giúp quá trình tách container ở Tuần 3-5 diễn ra tự nhiên hơn.
- Toàn bộ lựa chọn ưu tiên **công nghệ có gói miễn phí / mã nguồn mở**, phù hợp ngân sách đồ án.