# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM

*(Software Requirements Specification — SRS)*

# OnThi12

Nền tảng ôn thi đại học cho học sinh và giáo viên THPT

**Phiên bản 1.1** — Tháng 7 năm 2026
*(Cập nhật từ bản 1.0: đề thi chỉ được tạo qua upload PDF + AI parsing, bỏ chế độ nhập tay toàn bộ; bổ sung yêu cầu xác nhận đáp án khi file không kèm sẵn đáp án.)*

---

## Mục lục

1. Giới thiệu
2. Mô tả tổng quan hệ thống
3. Yêu cầu chức năng
4. Yêu cầu phi chức năng
5. Yêu cầu giao diện người dùng
6. Kiến trúc hệ thống (tổng quan)
7. Mô hình dữ liệu (tóm tắt)
8. Lộ trình phát triển đề xuất (MVP)
9. Kế hoạch tối ưu sau MVP
10. Phụ lục

---

## 1. Giới thiệu

### 1.1. Mục đích tài liệu

Tài liệu này đặc tả các yêu cầu chức năng và phi chức năng của hệ thống OnThi12 — một nền tảng web hỗ trợ học sinh trung học phổ thông ôn thi đại học và giáo viên quản lý, theo dõi tiến độ học tập của học sinh. Tài liệu là cơ sở để đội phát triển thiết kế, xây dựng và kiểm thử hệ thống, đồng thời là căn cứ để các bên liên quan thống nhất phạm vi sản phẩm.

### 1.2. Phạm vi sản phẩm

OnThi12 là ứng dụng web cho phép:

- Giáo viên tạo đề thi trắc nghiệm bằng cách **upload file PDF đề thi**, hệ thống dùng AI đọc và trích xuất câu hỏi tự động, sau đó giao đề cho các lớp phụ trách.
- Học sinh làm bài thi trực tuyến trong thời gian giới hạn và được chấm điểm tự động.
- Cả hai vai trò xem được dashboard thống kê: học sinh theo dõi tiến độ cá nhân, giáo viên theo dõi tình hình từng lớp và từng học sinh.

Phiên bản 1.1 giới hạn ở loại câu hỏi trắc nghiệm (chấm tự động), tạo đề **chỉ qua đường upload file + AI parsing** (không có màn hình soạn đề từ số 0). Câu hỏi tự luận và các tính năng nâng cao (chống gian lận nâng cao, gợi ý dạng bài tự động) được liệt kê ở mục Phạm vi ngoài (1.4) và có thể đưa vào các phiên bản sau.

### 1.3. Đối tượng sử dụng tài liệu

- Đội phát triển (lập trình viên, người thiết kế hệ thống) — dùng để hiểu yêu cầu và thiết kế kiến trúc.
- Người kiểm thử (tester) — dùng để xây dựng test case dựa trên các yêu cầu chức năng.
- Giáo viên hướng dẫn / nhà tuyển dụng đánh giá đồ án — dùng để hiểu phạm vi và mức độ hoàn chỉnh của sản phẩm.

### 1.4. Phạm vi ngoài (Out of scope — phiên bản 1.1)

- **Soạn đề bằng cách gõ từng câu hỏi từ đầu (không qua file)** — đã loại bỏ khỏi phạm vi 1.1; mọi đề thi bắt buộc phải xuất phát từ 1 file PDF được upload.
- Chấm điểm tự động cho câu hỏi tự luận (yêu cầu xử lý ngôn ngữ tự nhiên phức tạp).
- Giám sát chống gian lận nâng cao (nhận diện khuôn mặt, phát hiện chuyển tab bằng camera).
- Tự động gợi ý "dạng bài" cho câu hỏi bằng AI/NLP — hệ thống không phân loại câu hỏi theo chủ đề chi tiết trong bản 1.1.
- Ứng dụng di động (mobile app) riêng biệt — bản 1.1 chỉ là web, responsive cơ bản.
- Thanh toán / gói trả phí.
- Chấm điểm tự động 100% không cần review cho câu hỏi nhập từ file — với cả PDF dạng text lẫn dạng ảnh (scan), kết quả trích xuất bằng AI đa phương thức vẫn có tỷ lệ sai nhất định (xem 3.2), nên bước giáo viên xem trước và xác nhận (EXAM-07) luôn bắt buộc, không thể tắt.
- **Tự động suy luận đáp án đúng khi file đề không kèm đáp án** — trong trường hợp này hệ thống yêu cầu giáo viên xác nhận thủ công (xem EXAM-09), không có cơ chế AI tự đoán đáp án.

---

## 2. Mô tả tổng quan hệ thống

### 2.1. Bối cảnh sản phẩm

Học sinh lớp 12 tại Việt Nam ôn thi đại học thường tự tìm đề thi rải rác từ nhiều nguồn, không có công cụ theo dõi tiến độ học tập của bản thân một cách có hệ thống. Giáo viên quản lý điểm số và mức độ hoàn thành bài tập của học sinh chủ yếu bằng Excel hoặc sổ tay, mất thời gian tổng hợp và khó phát hiện sớm học sinh đang tụt lại. Giáo viên cũng thường đã có sẵn rất nhiều đề dạng file PDF/ảnh scan từ các nguồn khác nhau, việc gõ lại thủ công từng câu tốn nhiều thời gian và là rào cản chính khiến giáo viên ngại đưa đề lên hệ thống. OnThi12 giải quyết các vấn đề này trong một nền tảng duy nhất, kết nối giáo viên và học sinh của cùng một lớp học, với trọng tâm là **giảm tối đa công sức nhập liệu của giáo viên** bằng AI.

### 2.2. Đối tượng người dùng (tác nhân)

| Tác nhân | Mô tả | Mục tiêu chính khi dùng hệ thống |
|---|---|---|
| Học sinh | Học sinh lớp 12 thuộc một lớp học cụ thể trong hệ thống | Làm đề ôn thi, xem điểm, theo dõi tiến độ ôn tập của bản thân |
| Giáo viên | Giáo viên bộ môn hoặc GVCN phụ trách một hoặc nhiều lớp | Upload đề thi có sẵn (PDF), giao bài, theo dõi kết quả và tình hình học tập của lớp |
| Quản trị viên (Admin) | Người quản lý hệ thống ở cấp trường (phạm vi giới hạn trong 1.1) | Tạo tài khoản giáo viên, quản lý danh sách lớp |

### 2.3. Giả định và ràng buộc

- Người dùng có kết nối Internet ổn định trong lúc làm bài thi; hệ thống không hỗ trợ làm bài offline ở bản 1.1.
- Mỗi học sinh thuộc đúng một lớp; mỗi lớp có một giáo viên chủ nhiệm quản lý chính.
- Đề thi trong bản 1.1 chỉ gồm câu hỏi trắc nghiệm một đáp án đúng.
- **Mọi đề thi bắt buộc xuất phát từ 1 file PDF do giáo viên upload** — hệ thống không cung cấp màn hình soạn đề trống để gõ tay từ đầu.
- Hệ thống được triển khai trên một VPS quy mô nhỏ, phục vụ đồng thời tối đa khoảng 150–200 người dùng cùng lúc (quy mô vài lớp học).
- Việc gọi AI Parsing (Gemini API) cần API key hợp lệ, cấu hình ở tầng backend (AI Parsing service), không lộ ra frontend.

---

## 3. Yêu cầu chức năng

Các yêu cầu được đánh mã theo nhóm: AUTH (xác thực), EXAM (đề thi), TAKE (làm bài), DASH (dashboard), CLASS (lớp học). Độ ưu tiên: Cao / Trung bình / Thấp.

### 3.1. Nhóm xác thực và phân quyền (AUTH)

| Mã | Tên yêu cầu | Mô tả | Độ ưu tiên | Tác nhân |
|---|---|---|---|---|
| AUTH-01 | **Đăng ký / đăng nhập** | Người dùng đăng nhập bằng email và mật khẩu. Hệ thống phân quyền theo vai trò (học sinh / giáo viên) ngay sau khi đăng nhập. | Cao | Học sinh, Giáo viên |
| AUTH-02 | **Phân quyền theo vai trò** | Giao diện và chức năng hiển thị khác nhau tùy vai trò. Học sinh không truy cập được các trang quản lý lớp/đề của giáo viên và ngược lại. | Cao | Hệ thống |
| AUTH-03 | **Quên mật khẩu** | Người dùng có thể đặt lại mật khẩu qua email xác thực. | Trung bình | Học sinh, Giáo viên |

### 3.2. Nhóm quản lý đề thi (EXAM) — phía Giáo viên

| Mã | Tên yêu cầu | Mô tả | Độ ưu tiên | Tác nhân |
|---|---|---|---|---|
| EXAM-01 | **Tạo đề thi bằng upload file PDF** | Giáo viên upload 1 file PDF đề thi (kể cả PDF dạng ảnh/scan). Hệ thống gửi file cho AI Parsing service để trích xuất toàn bộ câu hỏi. Kết quả điền thẳng vào 1 trình xem/sửa duy nhất — **không có màn hình gõ câu hỏi từ đầu**. Giáo viên chỉ nhập thông tin bổ sung (tên đề, môn học, thời gian làm bài) trước hoặc sau khi upload. | Cao | Giáo viên |
| EXAM-02 | **Giao đề cho lớp** | Giáo viên chọn một hoặc nhiều lớp để giao đề, đặt hạn nộp bài. Đề chuyển trạng thái từ "Nháp" sang "Đang mở". Không cho giao nếu còn câu hỏi chưa xác nhận đáp án (xem EXAM-09). | Cao | Giáo viên |
| EXAM-03 | **Xem danh sách đề đã tạo** | Giáo viên xem tất cả đề đã tạo, lọc theo trạng thái (Nháp / Đang mở / Đã đóng), thấy tỷ lệ học sinh đã nộp bài cho từng đề. | Cao | Giáo viên |
| EXAM-04 | **Đóng đề thi** | Giáo viên chủ động đóng đề trước hoặc đúng hạn nộp; sau khi đóng học sinh không thể nộp bài mới. | Trung bình | Giáo viên |
| EXAM-05 | **Chỉnh sửa / xoá đề** | Giáo viên chỉnh sửa nội dung câu hỏi đã trích xuất (sửa lỗi AI đọc sai) khi đề đang ở trạng thái Nháp. Đề đã có học sinh làm bài không được xoá, chỉ có thể đóng. | Trung bình | Giáo viên |
| EXAM-06 | **Trích xuất câu hỏi từ file bằng AI đa phương thức** | Từng trang PDF được gửi cho mô hình AI có khả năng đọc ảnh (multimodal AI — Gemini API, dùng API key cấu hình phía backend) kèm yêu cầu trả về danh sách câu hỏi dạng JSON có cấu trúc (nội dung, 4 phương án, đáp án đúng nếu file có kèm, có hình hay không, mức độ tự tin khi đọc). Kết quả điền thẳng vào màn hình xem/sửa của EXAM-01. | Cao | Giáo viên |
| EXAM-07 | **Đánh dấu câu cần chú ý ngay trong màn hình xem/sửa** | Câu hỏi vừa import có "độ tin cậy thấp" hoặc có hình ảnh được đánh dấu nổi bật (ví dụ viền cảnh báo) ngay trong danh sách câu hỏi, để giáo viên ưu tiên kiểm tra trước khi giao đề cho lớp. Hệ thống không cho giao đề (EXAM-02) nếu còn câu bị đánh dấu chưa xử lý mà giáo viên chưa xác nhận bỏ qua. | Cao | Giáo viên |
| EXAM-08 | **Tự động phát hiện và cắt hình minh hoạ trong câu hỏi** | Với câu hỏi có hình vẽ/đồ thị/bảng biến thiên, AI trả về thêm toạ độ vùng chứa hình (bounding box) trên trang. Hệ thống tự động cắt ảnh từ trang gốc theo toạ độ đó và gắn vào đúng câu hỏi tương ứng, cho phép giáo viên xác nhận hoặc tự cắt lại thủ công nếu vùng cắt không chính xác. | Trung bình | Giáo viên |
| EXAM-09 | **Xác nhận đáp án đúng khi file không kèm sẵn đáp án** *(mới)* | Nếu AI không trích xuất được đáp án đúng cho 1 câu (file đề không có bảng đáp án, hoặc đáp án nằm ở 1 file riêng chưa được upload), câu hỏi đó được đánh dấu "Thiếu đáp án" và giáo viên **bắt buộc chọn đáp án đúng bằng cách click A/B/C/D** trực tiếp trong danh sách câu hỏi trước khi có thể giao đề. Giáo viên cũng có thể upload thêm 1 file đáp án riêng (ảnh hoặc PDF bảng đáp án ngắn) để AI tự động match theo số thứ tự câu, thay vì chọn tay từng câu. | Cao | Giáo viên |

*Lưu ý về độ chính xác của EXAM-06 (dựa trên thử nghiệm thực tế với đề thi mẫu): trích xuất bằng AI đa phương thức cho kết quả chính xác cao hơn đáng kể so với OCR truyền thống (Tesseract), đặc biệt với công thức toán học.*

| Phương pháp trích xuất | Tách đúng cấu trúc câu hỏi | Độ chính xác nội dung/công thức |
|---|---|---|
| OCR truyền thống (Tesseract), chưa tối ưu | ~83% | ~0% — không dùng được |
| OCR truyền thống, đã tối ưu (tiền xử lý ảnh + quy tắc khoan dung) | ~83% | ~50%, riêng công thức toán vẫn sai nhiều |
| AI đa phương thức (Gemini đọc ảnh trực tiếp) | 100% | ~90-100% với phần chữ và công thức; câu có hình vẫn cần EXAM-08 hỗ trợ |

*Rủi ro kỹ thuật đã biết trước với EXAM-08: toạ độ bounding box do AI trả về có thể lệch vài phần trăm so với vị trí thực tế của hình, đặc biệt với trang có chữ và hình xen kẽ dày đặc. Vì vậy hệ thống luôn cắt ảnh có thêm viền đệm và bắt buộc giáo viên xác nhận trước khi lưu.*

*Lý do giữ EXAM-09 bắt buộc thay vì để AI tự suy luận đáp án: nếu file đề không kèm đáp án, không có cách nào xác định đáp án đúng một cách đáng tin cậy chỉ từ nội dung câu hỏi — để AI "đoán" đáp án là rủi ro cao nhất trong toàn hệ thống, vì 1 đáp án sai sẽ làm sai điểm của mọi học sinh làm đề đó, trong khi lỗi chính tả nội dung câu hỏi chỉ ảnh hưởng trải nghiệm đọc.*

### 3.3. Nhóm làm bài thi (TAKE) — phía Học sinh

| Mã | Tên yêu cầu | Mô tả | Độ ưu tiên | Tác nhân |
|---|---|---|---|---|
| TAKE-01 | **Xem danh sách đề được giao** | Học sinh xem các đề thi được giao cho lớp của mình, lọc theo trạng thái (Chưa làm / Đã làm) và theo môn học. | Cao | Học sinh |
| TAKE-02 | **Làm bài thi có giới hạn thời gian** | Học sinh làm từng câu trắc nghiệm, có đồng hồ đếm ngược theo thời gian quy định của đề. Hệ thống tự động nộp bài khi hết giờ. | Cao | Học sinh |
| TAKE-03 | **Điều hướng giữa các câu hỏi** | Học sinh xem được bảng tổng quan các câu đã làm / chưa làm và di chuyển tự do giữa các câu trong lúc làm bài. | Trung bình | Học sinh |
| TAKE-04 | **Nộp bài và chấm điểm tự động** | Khi học sinh nộp bài (chủ động hoặc hết giờ), hệ thống so khớp đáp án và tính điểm ngay lập tức, không cần chờ giáo viên. | Cao | Hệ thống |
| TAKE-05 | **Xem lại kết quả chi tiết** | Sau khi nộp, học sinh xem điểm số, số câu đúng/sai, và với mỗi câu sai thấy được đáp án đã chọn và đáp án đúng. | Cao | Học sinh |

### 3.4. Nhóm dashboard và thống kê (DASH)

| Mã | Tên yêu cầu | Mô tả | Độ ưu tiên | Tác nhân |
|---|---|---|---|---|
| DASH-01 | **Dashboard cá nhân học sinh** | Học sinh xem điểm trung bình, số đề đã làm, biểu đồ điểm theo thời gian, và so sánh điểm trung bình với cả lớp. | Cao | Học sinh |
| DASH-02 | **Lọc thống kê theo môn học** | Học sinh chọn 1 môn cụ thể để xem điểm trung bình, biểu đồ xu hướng và lịch sử làm đề riêng cho môn đó. | Cao | Học sinh |
| DASH-03 | **Trang kết quả đầy đủ** | Học sinh xem toàn bộ lịch sử các đề đã làm dưới dạng bảng, lọc theo môn và sắp xếp theo ngày/điểm. | Trung bình | Học sinh |
| DASH-04 | **Dashboard tổng quan lớp (giáo viên)** | Giáo viên xem điểm trung bình từng lớp phụ trách, tỷ lệ nộp bài, và danh sách học sinh cần chú ý (điểm giảm liên tục hoặc lâu không làm bài). | Cao | Giáo viên |
| DASH-05 | **Thống kê chi tiết theo đề thi** | Giáo viên chọn 1 đề cụ thể để xem phân phối điểm số của lớp và danh sách câu hỏi có tỷ lệ sai cao nhất. | Cao | Giáo viên |
| DASH-06 | **Xem chi tiết 1 học sinh** | Giáo viên click vào 1 học sinh để xem đầy đủ lịch sử điểm, tương tự dashboard cá nhân của học sinh đó. | Trung bình | Giáo viên |

### 3.5. Nhóm quản lý lớp học (CLASS)

| Mã | Tên yêu cầu | Mô tả | Độ ưu tiên | Tác nhân |
|---|---|---|---|---|
| CLASS-01 | **Xem danh sách lớp (giáo viên)** | Giáo viên xem các lớp mình phụ trách, mỗi lớp hiện số học sinh, điểm trung bình, tỷ lệ nộp bài gần nhất. | Cao | Giáo viên |
| CLASS-02 | **Xem danh sách học sinh trong lớp** | Giáo viên chọn 1 lớp để xem bảng học sinh: điểm trung bình, thời gian hoạt động gần nhất, có thể xem chi tiết từng em. | Cao | Giáo viên |
| CLASS-03 | **Xem thông tin lớp (học sinh)** | Học sinh xem thông tin lớp mình (giáo viên chủ nhiệm, điểm trung bình lớp) và bảng xếp hạng rút gọn (top 3 và vị trí của bản thân). | Thấp | Học sinh |

---

## 4. Yêu cầu phi chức năng

| Mã | Loại | Mô tả yêu cầu |
|---|---|---|
| NFR-01 | Hiệu năng | Hệ thống xử lý được tối thiểu 40 học sinh nộp bài trong cùng khoảng thời gian 5 phút (giờ thi cố định của một lớp) mà không mất dữ liệu bài làm. |
| NFR-02 | Hiệu năng dashboard | Trang dashboard tải trong dưới 2 giây khi lớp có tối đa 40 học sinh và lịch sử 30 đề thi. |
| NFR-03 | Bảo mật | Mật khẩu người dùng được mã hoá (hash) trước khi lưu trữ. Nội dung đề thi chỉ hiển thị cho học sinh trong khoảng thời gian đề đang mở. |
| NFR-04 | Toàn vẹn dữ liệu | Thao tác nộp bài phải là giao dịch (transaction) — không để xảy ra tình trạng bài nộp bị ghi một phần hoặc nộp trùng lặp. |
| NFR-05 | Khả dụng | Hệ thống hoạt động ổn định trong khung giờ học sinh làm bài thi thật (thường 19h–22h các ngày trong tuần). |
| NFR-06 | Khả năng mở rộng | Kiến trúc cho phép tách thêm service hoặc thêm cache (Redis) khi số lượng lớp/học sinh tăng, không cần viết lại từ đầu. |
| NFR-07 | Khả năng sử dụng (UX) | Giao diện làm bài thi tối giản, không có phần tử gây phân tán, phù hợp thao tác nhanh trên máy tính lẫn máy tính bảng. |
| NFR-08 | Khả năng bảo trì | Mã nguồn được tổ chức theo từng service riêng biệt (xác thực, đề thi, nộp bài, dashboard) để dễ kiểm thử và mở rộng độc lập. |
| NFR-09 | Chi phí vận hành AI Parsing | Ở quy mô đồ án/MVP (vài lớp học), sử dụng gói miễn phí của Gemini API (model Flash/Flash-Lite) là đủ, không phát sinh chi phí. Gemini API key được lưu ở biến môi trường phía backend (AI Parsing service), không hard-code trong source, không lộ ra frontend. Cần theo dõi hạn mức request/ngày để tránh gián đoạn. |
| NFR-10 | Quyền riêng tư dữ liệu khi gọi AI bên ngoài | Chỉ gửi ảnh trang đề thi (không chứa thông tin học sinh) cho AI Parsing service. Nếu triển khai thật với dữ liệu học sinh, cần dùng gói API trả phí để đảm bảo dữ liệu không bị dùng cho việc huấn luyện model của bên thứ ba. |
| NFR-11 | Độ tin cậy khi phụ thuộc AI *(mới)* | Vì toàn bộ luồng tạo đề phụ thuộc vào AI Parsing service, hệ thống phải xử lý được trường hợp Gemini API lỗi, timeout, hoặc hết hạn mức: hiển thị thông báo rõ ràng cho giáo viên, giữ nguyên file đã upload để thử lại, không mất dữ liệu file gốc. |

---

## 5. Yêu cầu giao diện người dùng

Hệ thống có hai bộ giao diện tương ứng hai vai trò, dùng chung một cấu trúc điều hướng (sidebar) nhưng khác nội dung menu và trang chủ.

### 5.1. Giao diện phía học sinh

- Trang chủ: chào tên học sinh, đếm ngược ngày còn lại đến kỳ thi, 4 thẻ số liệu tổng quan (điểm trung bình, số đề đã làm, chuỗi ngày ôn tập, so với lớp), biểu đồ điểm theo thời gian, danh sách môn cần ôn thêm, đề thi gần đây.
- Trang Đề thi: danh sách đề được giao, lọc theo trạng thái và môn học, đề chưa làm được làm nổi bật.
- Trang làm bài thi: hiển thị 1 câu hỏi tại một thời điểm, đồng hồ đếm ngược, bảng điều hướng nhanh giữa các câu, nút nộp bài.
- Trang kết quả sau khi nộp: điểm số hiển thị lớn, danh sách câu sai kèm đáp án đúng/sai để học sinh tự ôn lại.
- Trang Kết quả (lịch sử): bảng đầy đủ các lần làm bài, lọc theo môn, sắp xếp theo ngày hoặc điểm.
- Trang Lớp học: thông tin lớp, bảng xếp hạng rút gọn.

### 5.2. Giao diện phía giáo viên

- Trang chủ: tổng quan số lớp/học sinh phụ trách, 4 thẻ số liệu, danh sách các lớp kèm điểm trung bình, danh sách học sinh cần chú ý được xếp theo mức độ nghiêm trọng.
- Trang Đề thi: danh sách đề đã tạo, lọc theo trạng thái, hiện tỷ lệ nộp bài từng đề.
- **Trang tạo đề thi (upload + xem/sửa)**: bắt đầu bằng khu vực kéo-thả file PDF. Sau khi AI xử lý xong, hiển thị danh sách câu hỏi đã trích xuất — không có màn hình nhập tay trống. Giáo viên có thể: sửa nội dung câu hỏi/đáp án nếu AI đọc sai, xác nhận hình minh hoạ đã cắt tự động, và **bắt buộc chọn đáp án đúng cho các câu bị đánh dấu "Thiếu đáp án"** (EXAM-09) trước khi giao đề. Có tuỳ chọn upload thêm 1 file đáp án riêng nếu đề chính không kèm sẵn.
- Trang Lớp học: chọn lớp để xem bảng học sinh (điểm trung bình, hoạt động gần nhất, xem chi tiết).
- Trang Thống kê: so sánh điểm trung bình giữa các lớp, biểu đồ phân phối điểm, danh sách câu hỏi có tỷ lệ sai cao nhất theo từng đề.

### 5.3. Nguyên tắc thiết kế chung

- Giao diện tối giản, ưu tiên hiển thị đúng thông tin người dùng cần ngay tại thời điểm đó (ví dụ: lúc thi chỉ hiện câu hỏi, không có menu điều hướng phụ).
- Dùng màu sắc có ý nghĩa nhất quán: xanh lá cho tiến độ tốt/điểm cao, vàng cho cảnh báo nhẹ, đỏ cho cần chú ý gấp. Câu hỏi "Thiếu đáp án" (EXAM-09) dùng màu đỏ để phân biệt rõ với cảnh báo "độ tin cậy thấp" (EXAM-07, màu vàng).
- Responsive cơ bản để dùng được trên máy tính bảng, ưu tiên chính cho màn hình máy tính/laptop.

---

## 6. Kiến trúc hệ thống (tổng quan)

Hệ thống được thiết kế theo hướng tách các luồng đọc và ghi dữ liệu quan trọng, để đảm bảo việc nộp bài thi luôn được ưu tiên và không bị ảnh hưởng bởi tải tính toán thống kê.

### 6.1. Các thành phần chính

| Thành phần | Vai trò |
|---|---|
| Nginx (reverse proxy) | Định tuyến request, xử lý SSL, cân bằng tải cơ bản |
| Auth service | Xác thực người dùng, phát hành JWT, kiểm tra phân quyền theo vai trò |
| Exam service | Quản lý CRUD đề thi và câu hỏi (phía giáo viên), điều phối luồng upload → AI Parsing → xác nhận đáp án |
| AI Parsing service | Gọi Gemini API (multimodal) để trích xuất câu hỏi, đáp án (nếu có) và vị trí hình ảnh từ file đề upload; xử lý bất đồng bộ vì mỗi trang mất vài giây |
| Submission service | Nhận bài làm của học sinh, ghi vào DB trong 1 giao dịch, chấm điểm trắc nghiệm ngay lập tức |
| Dashboard service | Đọc dữ liệu tổng hợp (đọc từ cache hoặc bảng thống kê), phục vụ các trang dashboard |
| PostgreSQL | Cơ sở dữ liệu chính, lưu người dùng, lớp học, đề thi, bài làm |
| Redis | Cache kết quả thống kê dashboard, giảm tải truy vấn lặp lại |

### 6.2. Lý do tách Submission service và Dashboard service

Vào thời điểm cả lớp làm bài cùng lúc (ví dụ đúng giờ thi), hệ thống cần ưu tiên ghi đúng và không mất dữ liệu bài làm hơn là cập nhật thống kê ngay lập tức. Vì vậy, việc tính toán dashboard (điểm trung bình lớp, phân phối điểm) được thực hiện định kỳ hoặc khi có yêu cầu xem, đọc từ cache thay vì tính lại trực tiếp trên bảng bài làm mỗi lần có submission mới.

### 6.3. Lý do tách AI Parsing service riêng khỏi Exam service

Gọi Gemini API để đọc từng trang đề mất vài giây mỗi trang và phụ thuộc vào dịch vụ bên thứ ba (có thể lỗi, chậm, hoặc hết hạn mức miễn phí). Vì **toàn bộ việc tạo đề trong bản 1.1 phụ thuộc 100% vào bước này** (không còn lối tắt nhập tay như bản 1.0), nếu xử lý đồng bộ ngay trong request upload sẽ khiến giáo viên phải chờ lâu hoặc gặp lỗi timeout với đề nhiều trang — rủi ro này cao hơn bản 1.0. Vì vậy AI Parsing service xử lý bất đồng bộ theo hàng đợi (queue): giáo viên upload xong có thể rời trang, hệ thống xử lý nền và thông báo khi có kết quả để vào xem trước (EXAM-07/EXAM-09).

---

## 7. Mô hình dữ liệu (tóm tắt)

Các bảng chính trong cơ sở dữ liệu:

| Bảng | Mô tả | Trường chính |
|---|---|---|
| users | Tài khoản người dùng (học sinh, giáo viên) | id, name, email, password_hash, role |
| classes | Lớp học | id, name, teacher_id |
| class_students | Quan hệ học sinh — lớp | class_id, student_id |
| exams | Đề thi | id, title, subject, teacher_id, duration_minutes, status, source_file_url |
| exam_classes | Quan hệ đề thi — lớp được giao | exam_id, class_id, due_date |
| questions | Câu hỏi trong đề | id, exam_id, content, options, correct_answer (nullable — trống nếu chưa xác nhận), image_url, ai_confidence, answer_status (`ai_extracted` / `needs_confirmation` / `manually_confirmed`) |
| submissions | Lượt nộp bài của học sinh | id, student_id, exam_id, score, time_taken_seconds, submitted_at |
| answer_details | Chi tiết từng câu trả lời trong 1 lượt nộp | id, submission_id, question_id, student_answer, is_correct |
| class_exam_stats | Bảng thống kê được tính trước cho dashboard | class_id, exam_id, avg_score, completion_rate |

**Thay đổi so với bản 1.0:** thêm cột `source_file_url` (bảng `exams`) để lưu lại file PDF gốc đã upload — cần thiết vì đây là **nguồn duy nhất** tạo ra đề, giáo viên có thể cần xem lại hoặc AI Parsing lại nếu lỗi. Bảng `questions` thêm cột `answer_status` để hệ thống biết câu nào cần chặn giao đề (EXAM-09) — thay vì chỉ có `correct_answer` như bản 1.0.

Lưu ý: bảng `questions` không có cột phân loại "dạng bài" (tag chủ đề) trong phiên bản 1.1, vì hệ thống không tự động phân loại câu hỏi theo chủ đề chi tiết ở bản này (xem 1.4).

---

## 8. Lộ trình phát triển đề xuất (MVP)

| Giai đoạn | Nội dung | Yêu cầu liên quan |
|---|---|---|
| Tuần 1–2 | Xác thực, phân quyền, luồng tạo đề đầy đủ: upload PDF → AI parsing → xem/sửa → xác nhận đáp án → tự động cắt hình | AUTH-01 → AUTH-02, EXAM-01 → EXAM-09 |
| Tuần 3 | Học sinh làm bài, nộp bài, chấm điểm trắc nghiệm tự động | TAKE-01 → TAKE-05 |
| Tuần 4 | Dashboard cá nhân học sinh (điểm theo thời gian, theo môn) | DASH-01 → DASH-03 |
| Tuần 5 | Dashboard giáo viên theo lớp, theo từng học sinh | DASH-04 → DASH-06, CLASS-01 → CLASS-02 |
| Sau đó (mở rộng) | Tối ưu dashboard bằng bảng thống kê tính trước (class_exam_stats), thêm cảnh báo học sinh cần chú ý | NFR-02, NFR-06 |

*Lưu ý: vì toàn bộ luồng EXAM-01 → EXAM-09 dùng chung 1 giao diện và phụ thuộc chuỗi vào nhau (upload → parse → review → xác nhận đáp án → giao đề), nhóm này nên được làm liền mạch trong Tuần 1-2 theo đúng thứ tự đó, tránh làm rời rạc từng mã yêu cầu — đặc biệt EXAM-09 (xác nhận đáp án) cần làm cùng lúc với EXAM-07 vì cùng nằm trên 1 màn hình review.*

---

## 9. Kế hoạch tối ưu sau MVP

Phần này liệt kê các hạng mục tối ưu về hiệu năng, kiến trúc và khả năng mở rộng, được thực hiện SAU khi MVP (mục 8) đã chạy ổn định và có người dùng thật. Nguyên tắc chung: không tối ưu sớm khi chưa có dấu hiệu cần thiết (premature optimization) — mỗi hạng mục dưới đây gắn với một ngưỡng kích hoạt cụ thể, không làm theo lịch cố định.

### 9.1. Tối ưu dashboard: pre-aggregate và cache

MVP tính điểm trung bình, phân phối điểm... bằng cách query trực tiếp trên bảng `submissions` mỗi lần giáo viên/học sinh mở dashboard. Cách này đơn giản nhưng chậm dần khi số lượng bài nộp tăng.

- Bước 1: Thêm bảng `class_exam_stats` (đã thiết kế ở mục 7), được cập nhật bằng background job mỗi khi có submission mới, thay vì tính lại từ đầu mỗi lần xem.
- Bước 2: Thêm Redis cache cho các câu query lặp lại nhiều (ví dụ bảng xếp hạng lớp), với thời gian hết hạn (TTL) ngắn (1-5 phút).
- Ngưỡng kích hoạt: dashboard load trên 2 giây (vi phạm NFR-02), hoặc 1 lớp có trên 30 đề thi trong lịch sử.

### 9.2. Tách xử lý bất đồng bộ bằng message queue

MVP gọi AI Parsing service (EXAM-06) và tính dashboard theo kiểu gọi trực tiếp (đồng bộ) hoặc job đơn giản. Khi số lượng giáo viên dùng cùng lúc tăng, cần hàng đợi thật sự để tránh nghẽn.

- Thêm message queue (RabbitMQ hoặc tương đương) đứng giữa: request upload đề / nộp bài → queue → worker xử lý.
- Với AI Parsing: xử lý theo batch nhiều trang cùng lúc thay vì gọi API tuần tự từng trang, giảm thời gian chờ và tận dụng tốt hơn hạn mức API — **quan trọng hơn ở bản 1.1** vì mọi đề đều phải qua bước này, không còn lối tắt nhập tay để giảm tải.
- Ngưỡng kích hoạt: có trên 5 giáo viên import đề cùng lúc gây chậm, hoặc thời gian nộp bài giờ cao điểm vượt quá 3 giây/request.

### 9.3. Tách Submission service và Dashboard service thành service độc lập

- Lợi ích: giờ cao điểm nộp bài không làm chậm dashboard đang được xem bởi giáo viên khác, và ngược lại.
- Ngưỡng kích hoạt: hệ thống phục vụ đồng thời nhiều hơn 3-4 lớp thi cùng khung giờ, hoặc log cho thấy 2 luồng nghẽn lẫn nhau.

### 9.4. Scale hạ tầng ngang (horizontal scaling)

- Chạy nhiều instance của ứng dụng (backend) đứng sau Nginx làm load balancer.
- Thêm read replica cho PostgreSQL: tách truy vấn đọc (dashboard, danh sách đề) sang replica, giữ truy vấn ghi (nộp bài) trên primary.
- Ngưỡng kích hoạt: vượt quy mô ước tính ban đầu (150-200 người dùng đồng thời), hoặc CPU/RAM của VPS hiện tại thường xuyên trên 80%.

### 9.5. Giám sát và vận hành (observability)

- Thêm công cụ giám sát (Prometheus + Grafana, hoặc dịch vụ ngoài) để theo dõi độ trễ API, tỷ lệ lỗi, tải hệ thống theo thời gian thực — **đặc biệt theo dõi tỷ lệ lỗi/timeout của AI Parsing service**, vì đây là điểm phụ thuộc bên ngoài duy nhất trong luồng tạo đề.
- Cảnh báo tự động khi tỷ lệ lỗi nộp bài tăng bất thường (liên quan NFR-04).
- Ngưỡng kích hoạt: ngay khi bắt đầu có người dùng thật ngoài phạm vi thử nghiệm nội bộ.

### 9.6. Rate limiting (giới hạn tần suất request)

- Giới hạn theo IP hoặc theo tài khoản cho các endpoint nhạy cảm: đăng nhập, nộp bài, **gọi AI Parsing (ưu tiên cao nhất ở bản 1.1** vì mỗi lần upload đều tốn hạn mức Gemini API thật, không còn lối tắt nhập tay để giảm phụ thuộc).
- Kỹ thuật: Redis đếm số request trong 1 cửa sổ thời gian (sliding window hoặc token bucket).
- Ngưỡng kích hoạt: nên làm sớm cùng MVP cho đăng nhập và AI Parsing.

### 9.7. Bảng tóm tắt ngưỡng kích hoạt

| Hạng mục tối ưu | Ngưỡng kích hoạt |
|---|---|
| Pre-aggregate + cache dashboard (9.1) | Dashboard load > 2s, hoặc > 30 đề/lớp |
| Message queue cho xử lý bất đồng bộ (9.2) | > 5 giáo viên import đề cùng lúc, hoặc nộp bài > 3s/request giờ cao điểm |
| Tách Submission / Dashboard service (9.3) | > 3-4 lớp thi cùng khung giờ |
| Scale ngang + read replica (9.4) | > 200 người dùng đồng thời, hoặc VPS > 80% tải thường xuyên |
| Giám sát/observability (9.5) | Ngay khi có người dùng thật, không đợi ngưỡng |
| Rate limiting (9.6) | Làm ngay cùng MVP cho đăng nhập và AI Parsing |

*Nguyên tắc chọn thứ tự làm: ưu tiên 9.1, 9.5, 9.6 trước (chi phí công sức thấp, lợi ích ngay). Các hạng mục 9.2-9.4 chỉ nên làm khi có bằng chứng thực tế cho thấy cần thiết.*

### 9.8. Bảng tổng hợp kỹ thuật nền tảng system design áp dụng trong OnThi12

| Kỹ thuật | Định nghĩa ngắn gọn | Áp dụng ở đâu trong OnThi12 |
|---|---|---|
| Load balancing | Phân phối request đến nhiều instance ứng dụng thay vì 1 điểm duy nhất | Nginx đứng trước các instance backend khi scale ngang (9.4) |
| Caching | Lưu tạm kết quả tính toán tốn kém để trả nhanh cho lần hỏi sau | Redis cache kết quả dashboard, bảng xếp hạng (9.1) |
| Database indexing | Tạo cấu trúc tra cứu nhanh trên các cột hay được query/lọc | Index trên `submissions(student_id, exam_id)`, `questions(exam_id)` |
| Read replica | Bản sao chỉ đọc của database chính, tách tải đọc khỏi tải ghi | Tách truy vấn dashboard khỏi luồng nộp bài khi scale (9.4) |
| Message queue | Hàng đợi trung gian giúp xử lý bất đồng bộ, không chặn luồng chính | Xử lý AI Parsing và tính dashboard nền (9.2) |
| Rate limiting | Giới hạn số request trong 1 khoảng thời gian để chống lạm dụng | Giới hạn đăng nhập sai và số lần gọi AI Parsing (9.6) |
| Idempotency | Gọi lại nhiều lần cùng 1 request chỉ tạo ra 1 kết quả | Nộp bài thi: chỉ 1 submission được ghi nhận dù nộp 2 lần (NFR-04) |
| Horizontal vs vertical scaling | Scale ngang: thêm instance. Scale dọc: nâng cấu hình 1 máy | MVP scale dọc trước; scale ngang khi vượt ngưỡng ở 9.4 |
| CQRS (tách read/write) | Tách luồng xử lý ghi và luồng xử lý đọc thành 2 đường riêng | Submission service (ghi) tách khỏi Dashboard service (đọc) — 6.2 |
| Health check | Endpoint riêng để hệ thống giám sát biết service còn sống hay không | Mỗi service có endpoint `/health` để công cụ giám sát (9.5) kiểm tra |
| **Circuit breaker / graceful degradation** *(mới, liên quan NFR-11)* | Khi 1 dependency bên ngoài lỗi liên tục, tạm ngắt gọi thêm để tránh dồn lỗi, trả thông báo rõ ràng thay vì treo request | Áp dụng cho lời gọi Gemini API trong AI Parsing service — vì bản 1.1 phụ thuộc 100% vào AI để tạo đề |

---

## 10. Phụ lục

### 10.1. Bảng thuật ngữ

| Thuật ngữ | Giải thích |
|---|---|
| Đề thi (Exam) | Một bộ câu hỏi trắc nghiệm được tạo từ 1 file PDF do giáo viên upload, sau đó giao cho một hoặc nhiều lớp |
| Submission | Một lượt học sinh nộp bài làm cho một đề thi cụ thể |
| Dashboard | Trang tổng quan hiển thị số liệu thống kê dưới dạng biểu đồ và thẻ số liệu |
| MVP | Minimum Viable Product — phiên bản tối thiểu có thể sử dụng được để kiểm chứng sản phẩm |
| AI Parsing | Bước hệ thống gọi Gemini API để đọc file PDF và trích xuất câu hỏi/đáp án dạng có cấu trúc |
| Answer status | Trạng thái đáp án của 1 câu hỏi: đã AI trích xuất, cần xác nhận, hoặc đã giáo viên xác nhận thủ công |

### 10.2. Tài liệu tham khảo

Tài liệu này được xây dựng dựa trên quá trình trao đổi yêu cầu ban đầu (bản 1.0), sau đó cập nhật ở bản 1.1 theo quyết định chuyển hoàn toàn sang mô hình tạo đề qua upload file PDF + AI parsing (Gemini API), bỏ chế độ nhập tay toàn bộ.