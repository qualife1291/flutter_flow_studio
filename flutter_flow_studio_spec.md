# Đặc Tả Kỹ Thuật Chi Tiết (AI-Coding Blueprint): Package `flutter_flow_studio`

> **Mục đích tài liệu:** Đây là tài liệu Đặc tả Kỹ thuật & Kiến trúc Hệ thống (Engineering Specification) được viết chi tiết ở cấp độ thực thi (Implementation-ready) để các **AI Coding Agents (Cursor, Claude Code, Windsurf, GitHub Copilot)** và lập trình viên có thể đọc hiểu toàn bộ yêu cầu, cấu trúc dữ liệu, thuật toán AST, giao thức WebSocket, chuẩn UI/UX và tiến hành code từng module một cách chính xác.
>
> **Cổng bàn giao:** Không được báo xong khi chưa đạt [mục 9 — Chuẩn Handover](#9-chuẩn-handover). Mục 9 thắng các mục trước nếu lệch nhau về phiên bản Flutter, danh sách platform, hoặc cách viết tài liệu.

## 1. Tổng quan Dự án & Giá trị Cốt lõi cho 4 Nhóm Đối tượng (Target Personas)

`flutter_flow_studio` là một thư viện Dart/Flutter (được thiết kế để xuất bản lên **pub.dev**). Khi cài vào bất kỳ dự án Flutter nào và chạy một lệnh duy nhất `dart run flutter_flow_studio`, công cụ sẽ quét mã nguồn tĩnh kết hợp lắng nghe sự kiện thời gian thực (Runtime) để dựng nên một **Web Studio tương tác qua mạng LAN / Wi-Fi**.

Không chỉ phục vụ lập trình viên lâu năm, sản phẩm được thiết kế chuyên biệt để giải quyết bài toán cho **4 nhóm vai trò** thông qua thanh chuyển đổi chế độ xem (**Role-Based View Switcher**) ngay trên Web Studio:

| Nhóm đối tượng | Nỗi đau thực tế (Pain Points) | Giải pháp & Tính năng chuyên biệt trên `flutter_flow_studio` |
| :--- | :--- | :--- |
| **1. Dev mới vào dự án (New Developer Onboarding)** | Dự án lớn có hàng chục màn hình, nhiều tầng BLoC/Riverpod/Repository lồng nhau; mất nhiều ngày mò mẫm mới biết bấm nút này gọi hàm nào, ở file nào. | • **Bản đồ kiến trúc toàn cảnh:** Nhìn thấy ngay dự án dùng Flutter/Dart bản mấy, State Management gì, các package nào.<br>• **Truy vết xuyên tầng:** Bấm vào bất kỳ Node nào trên cây để xem tên class, hàm, dòng code và bấm nút **"Open in VS Code / Cursor"** nhảy thẳng tới dòng code đó. |
| **2. Business Analyst (BA - Nắm bắt & Cải thiện luồng)** | Tài liệu nghiệp vụ cũ lệch với code thực tế; BA không đọc được code Dart thô nhưng cần biết hiện tại app đang xử lý những nhánh điều kiện nào để tối ưu luồng. | • **Chế độ BA Mode (Human-Readable Labels):** Tự động dịch biểu thức code (`res.code == 200 && user.isKyc`) thành ngôn ngữ tự nhiên dễ hiểu (`API Thành công & Đã định danh KYC`).<br>• **Phát hiện lỗ hổng luồng (Flow Health Audit):** Tự động cảnh báo màu vàng các nhánh `if` thiếu `else` (người dùng bấm nhưng không có phản hồi), hoặc gọi API nhưng chưa bắt lỗi.<br>• **Xuất sơ đồ chuẩn BA:** Xuất 1 chạm ra **Draw.io (`.drawio`)**, **Mermaid (`.mmd`)**, **Excalidraw** để BA chỉnh sửa và đề xuất luồng mới. |
| **3. QA / Tester (Kiểm thử & Độ phủ kịch bản)** | Khi test trên điện thoại không biết mình đã test hết các trường hợp rẽ nhánh (`if/else`) trong code chưa, hoặc khi gặp bug khó mô tả lại các bước cho Dev. | • **Real-time Green Path & Branch Coverage:** Tester bấm trên điện thoại tới đâu, đường màu xanh lá chạy tới đó. Web Studio thống kê trực tiếp **`% Nhánh đã test (Tested)` vs `Nhánh chưa đi qua (Untested)`** để Tester không bỏ sót kịch bản.<br>• **Xuất Bug Snapshot:** Cho phép xuất riêng **Đường màu xanh vừa chạy** kèm dữ liệu API Request/Response thành file ảnh hoặc `.flow.json` đính kèm vào Jira/Ticket. |
| **4. Người dùng Low-Code / PM (Hiểu luồng trực quan)** | Bị choáng ngợp bởi các thuật ngữ kỹ thuật như `Cubit`, `BlocListener`, `DioInterceptor`, `Either.fold`. Chỉ muốn hiểu logic đầu-cuối của tính năng. | • **Chế độ Low-Code Simplified View:** Tự động ẩn các tầng kỹ thuật trung gian (như State/Repository), gộp luồng về dạng khối chuẩn Low-Code quen thuộc: **`[Màn hình] ➔ [Khi bấm nút] ➔ [Gọi API] ➔ [Nếu Đúng / Nếu Sai] ➔ [Mở Hộp thoại / Chuyển màn hình / Đăng xuất]`**. |

## 2. Kiến trúc Hệ thống & Bộ Công nghệ Tối ưu (Tech Stack Specification)

Để đảm bảo package chạy bằng **1 lệnh CLI duy nhất**, không yêu cầu người dùng cuối phải cài Node.js và đạt điểm tối đa (`160/160`) khi publish lên `pub.dev`, hệ thống sử dụng kiến trúc đóng gói kép:

1. **CLI, Static AST Analyzer & LAN Server (Viết bằng Dart SDK `>=3.2.0`):**
   * `analyzer: ^6.4.0`: Phân tích cây cú pháp trừu tượng (AST) của toàn bộ file `.dart` trong thư mục `lib/`.
   * `yaml: ^3.1.2` & `pub_semver: ^2.1.4`: Đọc và phân tích `pubspec.yaml`, `pubspec.lock`, `.dart_tool/package_config.json`.
   * `shelf: ^1.4.1`, `shelf_static: ^1.1.2`, `shelf_web_socket: ^2.0.0`: Khởi tạo HTTP Server phục vụ giao diện Web Studio và WebSocket Hub đồng bộ sự kiện thời gian thực qua mạng LAN (`0.0.0.0:<port>`).
   * `args: ^2.5.0`: Xử lý tham số dòng lệnh (`--port`, `--host`, `--open`, `--deep-trace`, `--export`).
2. **Runtime SDK nhúng trong App Flutter (`lib/flutter_flow_studio.dart`):**
   * Viết thuần bằng Flutter/Dart + `web_socket_channel: ^3.0.0`.
   * Tự động vô hiệu hóa hoàn toàn (`no-op`) khi `kReleaseMode == true` để không ảnh hưởng tới dung lượng hay hiệu năng bản Production.
3. **Giao diện Web Studio (`web_studio/` — Pre-built SPA):**
   * **Framework:** `React 19` + `TypeScript 5` + `Vite`.
   * **Đồ thị tương tác:** `@xyflow/react` (React Flow v12) kết hợp thuật toán dàn trang tự động `elkjs` (Layered Graph Layout).
   * **Quản lý trạng thái & UI:** `zustand` (lưu trữ Graph State, Live Green Path, Role Mode, Filter State), `tailwindcss`, `lucide-react` (bộ icon đồng nhất), `html-to-image` (xuất ảnh PNG/SVG).
   * **Cơ chế đóng gói vào Package Dart:** Sau khi build (`npm run build`), toàn bộ thư mục tĩnh `web_studio/dist/` được copy vào `lib/src/web_assets/` của package Dart.

## 3. Cấu trúc Thư mục Chuẩn của Repository (Directory Structure)

AI Coding Agent khi khởi tạo dự án cần tuân thủ đúng cấu trúc thư mục sau:

```text
flutter_flow_studio/
├── bin/
│   └── flutter_flow_studio.dart               # CLI Entrypoint (dart run flutter_flow_studio)
├── lib/
│   ├── flutter_flow_studio.dart               # Public Runtime API cho dự án Flutter đích
│   └── src/
│       ├── schema/
│       │   ├── graph_models.dart              # Data classes: FlowGraph, FlowNode, FlowEdge, FlowIssue
│       │   ├── project_info.dart              # Data classes: ProjectMetadata, PackageDependency
│       │   └── ws_protocol.dart               # Data classes: WsMessage, RuntimeStepEvent
│       ├── analyzer/
│       │   ├── project_inspector.dart         # Đọc pubspec.yaml, Flutter/Dart version, phân nhóm packages
│       │   ├── ast_pipeline.dart              # Điều phối toàn bộ quá trình quét AST
│       │   ├── sink_detector_visitor.dart     # Nhận diện 4 nhóm Sink: Screen, Dialog, API, Logout
│       │   ├── backward_slicer.dart           # Quét ngược cây điều khiển (if/else, switch, try/catch, fold)
│       │   ├── cross_layer_linker.dart        # Bắc cầu UI Trigger -> Logic -> State -> UI Listener
│       │   ├── human_readable_translator.dart # Dịch biểu thức code sang ngôn ngữ tự nhiên cho BA/Low-code
│       │   ├── flow_health_auditor.dart       # Phát hiện nhánh thiếu else, thiếu bắt lỗi API cho BA/Dev
│       │   ├── deep_trace_instrumenter.dart   # Tự động chèn/gỡ FlowProbe.hit() khi chạy --deep-trace
│       │   └── adapters/                      # Các Adapter nhận diện thư viện phổ biến trên pub.dev
│       │       ├── router_adapters.dart       # Navigator 1.0/2.0, GoRouter, AutoRoute, GetX, Beamer
│       │       ├── state_adapters.dart        # Bloc/Cubit, Riverpod, Provider, GetX, MobX, Signals
│       │       └── network_adapters.dart      # Dio, http, Retrofit, Chopper, GraphQL
│       ├── runtime/
│       │   ├── flow_studio_client.dart        # Kết nối WebSocket từ App tới LAN Server + hàng đợi Offline
│       │   ├── navigator_observer.dart        # Bắt push/pop/replace Screen & DialogRoute/BottomSheetRoute
│       │   ├── http_overrides.dart            # Bắt tự động 100% HTTP/HTTPS calls ở tầng dart:io
│       │   ├── dio_interceptor.dart           # Interceptor chi tiết cho Dio (nếu dự án muốn gắn riêng)
│       │   ├── bloc_observer.dart             # Bắt Event & State cho flutter_bloc
│       │   ├── riverpod_observer.dart         # Bắt Provider update cho flutter_riverpod
│       │   └── flow_probe.dart                # Hàm đánh dấu nhánh: FlowStudio.step() & FlowProbe.hit()
│       ├── server/
│       │   ├── studio_lan_server.dart         # Shelf HTTP Server + WebSocket Broadcast Hub
│       │   ├── network_utils.dart             # Tìm địa chỉ IPv4 LAN (192.168.x.x / 10.x.x.x)
│       │   └── cli_exporters.dart             # Xuất file Mermaid, Draw.io, JSON trực tiếp từ CLI
│       └── web_assets/                        # Chứa bản build tĩnh của web_studio/dist
├── web_studio/                                # Source code giao diện Web Studio (React + TypeScript)
│   ├── src/
│   │   ├── types/
│   │   │   └── graph.ts                       # TypeScript interfaces khớp 100% với lib/src/schema/
│   │   ├── store/
│   │   │   └── useFlowStore.ts                # Zustand store quản lý Graph, Green Path, Coverage, Role Mode
│   │   ├── theme/
│   │   │   └── tokens.ts                      # Bảng màu Semantic, Dark/Light theme, Glow styles
│   │   ├── components/
│   │   │   ├── toolbar/
│   │   │   │   ├── TopNavbar.tsx              # Chuyển chế độ (Dev/BA/Tester/LowCode), Tìm kiếm, Export
│   │   │   │   └── RoleModeSwitcher.tsx       # Nút chuyển 4 góc nhìn chuyên biệt
│   │   │   ├── canvas/
│   │   │   │   ├── FlowCanvas.tsx             # React Flow wrapper + Auto-follow camera + Spotlight mode
│   │   │   │   ├── nodes/                     # 6 Custom Nodes: Screen, Action, Decision, Api, Dialog, Logout
│   │   │   │   └── edges/                     # AnimatedGreenEdge.tsx (hiệu ứng dòng chảy xanh lá + số bước)
│   │   │   ├── panels/
│   │   │   │   ├── LeftProjectPanel.tsx       # Thông tin SDK, Packages, Cảnh báo BA, Độ phủ QA Coverage
│   │   │   │   ├── RightInspectorDrawer.tsx   # Chi tiết Node, Code Viewer, API Payload, Nút Open in IDE
│   │   │   │   └── LiveTimelineBar.tsx        # Thanh lịch sử bước chạy realtime + Tua lại (Replay)
│   │   │   └── modals/
│   │   │       └── ExportModal.tsx            # Hộp thoại chọn định dạng (.drawio, .mmd, .excalidraw...)
│   │   └── engine/
│   │       ├── elkLayout.ts                   # Thuật toán xếp cây tự động bằng ELKjs
│   │       ├── pathInference.ts               # Suy luận nhánh if/else đã đi qua + tính % QA Coverage
│   │       ├── lowCodeSimplifier.ts           # Thuật toán rút gọn node kỹ thuật cho chế độ Low-Code/BA
│   │       └── exporters/                     # Các bộ chuyển đổi: drawio.ts, mermaid.ts, excalidraw.ts, puml.ts
├── example/                                   # Dự án Flutter mẫu dùng để kiểm thử & chấm điểm pub.dev
├── test/                                      # Unit tests cho AST Slicer, Translator & Exporters
├── pubspec.yaml
├── README.md
└── CHANGELOG.md
```

## 4. Đặc tả Chi tiết Cấu trúc Dữ liệu (Exact Data Schemas)

Để Backend (Dart) và Frontend (TypeScript) giao tiếp chính xác tuyệt đối, mọi dữ liệu đều tuân theo schema JSON dưới đây.

### 4.1. Schema Tổng thể của Đồ thị Dự án (`FlowGraphPayload`)

Endpoint `GET /api/graph` và sự kiện WebSocket `INITIAL_GRAPH` trả về cấu trúc JSON sau:

```typescript
export type RoleViewMode = 'DEV' | 'BA' | 'TESTER' | 'LOW_CODE';

export type NodeKind =
  | 'SCREEN'      // Màn hình / Page / RouteWidget
  | 'ACTION'      // Sự kiện bấm nút / Hàm khởi phát / BLoC Event
  | 'DECISION'    // Nhánh điều kiện if/else, switch/case, try/catch, Either.fold
  | 'API'         // Lời gọi mạng HTTP / Dio / Retrofit / GraphQL
  | 'DIALOG'      // showDialog, showModalBottomSheet, SnackBar, Toast
  | 'LOGOUT';     // Đăng xuất, xóa token, reset phiên về màn Login

export interface ProjectMetadata {
  projectName: string;
  description: string;
  version: string;
  flutterSdkVersion: string;
  dartSdkConstraint: string;
  detectedArchitecture: {
    stateManagement: string[]; // VD: ["flutter_bloc (^8.1.6)", "provider (^6.1.2)"]
    routing: string[];         // VD: ["go_router (^14.2.0)"]
    networking: string[];      // VD: ["dio (^5.7.0)", "retrofit (^4.4.0)"]
    localStorage: string[];    // VD: ["shared_preferences (^2.3.2)", "flutter_secure_storage (^9.2.2)"]
  };
  allDependencies: Array<{
    name: string;
    version: string;
    category: 'STATE' | 'ROUTER' | 'NETWORK' | 'STORAGE' | 'DI' | 'UI_UTILS' | 'DEV';
    isDirect: boolean;
  }>;
  stats: {
    totalScreens: number;
    totalActions: number;
    totalDecisions: number;
    totalApis: number;
    totalDialogs: number;
    totalLogoutPoints: number;
  };
}

export interface FlowNodeData {
  id: string;                  // Định danh duy nhất, VD: "screen:LoginScreen", "decision:auth_cubit.dart:54"
  kind: NodeKind;
  featureGroup: string;        // Tên cụm tính năng lấy theo thư mục, VD: "auth", "checkout", "profile"
  
  // Nhãn hiển thị thích ứng theo từng đối tượng người dùng (Role-Based Labels):
  technicalTitle: string;      // Cho Dev: "AuthCubit.submitLogin()" hoặc "if (res.statusCode == 200)"
  businessTitle: string;       // Cho BA & Low-Code: "Xử lý Đăng nhập" hoặc "Kiểm tra: Đăng nhập thành công?"
  description?: string;        // Mô tả chi tiết lấy từ comment /// hoặc tự sinh
  
  // Thông tin vị trí mã nguồn (Cho Dev & Nút Open in IDE):
  sourceLocation?: {
    filePath: string;          // VD: "lib/features/auth/cubit/auth_cubit.dart"
    line: number;
    column: number;
    codeSnippet: string;       // 5-15 dòng code trích xuất quanh node
  };

  // Thuộc tính chuyên biệt cho từng loại Node:
  routeInfo?: {
    routePath: string;         // VD: "/login", "/home/product/:id"
    isInitialRoute: boolean;
    parameters: string[];
  };
  apiInfo?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'GRAPHQL';
    endpoint: string;          // VD: "/api/v1/auth/login"
    clientType: string;        // VD: "Dio", "Retrofit", "HttpClient"
    requestModel?: string;
    responseModel?: string;
  };
  decisionInfo?: {
    kind: 'IF_ELSE' | 'SWITCH' | 'TRY_CATCH' | 'EITHER_FOLD';
    rawExpression: string;     // VD: "response.statusCode == 200 && user.isVerified"
    humanReadableRule: string; // VD: "API trả về 200 VÀ Tài khoản đã xác minh"
    branches: Array<{
      branchId: string;        // VD: "true_branch", "false_branch", "catch_branch"
      technicalLabel: string;  // VD: "true", "else (statusCode == 401)", "catch (DioException)"
      businessLabel: string;   // VD: "Hợp lệ", "Hết hạn phiên (401)", "Lỗi kết nối mạng"
    }>;
  };
  dialogInfo?: {
    overlayType: 'DIALOG' | 'BOTTOM_SHEET' | 'SNACKBAR' | 'TOAST';
    widgetName: string;        // VD: "OtpVerificationDialog"
    actions: string[];         // VD: ["Xác nhận", "Hủy"]
  };
}

export interface FlowEdgeData {
  id: string;                  // VD: "edge:decision_54->dialog_OtpDialog"
  source: string;              // ID của Node nguồn
  target: string;              // ID của Node đích
  sourceHandle?: string;       // Cổng ra trên Decision Node (VD: "true_branch", "false_branch")
  technicalLabel?: string;     // Nhãn cho Dev: "emit(LoginFailure) -> state is LoginFailure"
  businessLabel?: string;      // Nhãn cho BA/Low-Code: "Khi sai mật khẩu"
  isStateBridge?: boolean;     // true nếu cạnh này nối xuyên tầng từ BLoC/Notifier sang UI Listener
}

export interface FlowHealthIssue {
  id: string;
  severity: 'WARNING' | 'INFO';
  category: 'MISSING_ELSE_BRANCH' | 'UNHANDLED_API_ERROR' | 'ORPHAN_SCREEN' | 'DEAD_END_ACTION';
  nodeId: string;
  title: string;               // VD: "Thiếu nhánh xử lý khi điều kiện sai (Missing Else)"
  suggestionForBA: string;     // VD: "Cần bổ sung thông báo Dialog/SnackBar nếu giỏ hàng rỗng."
  suggestionForDev: string;    // VD: "Thêm khối else cho câu lệnh if tại checkout_cubit.dart:78."
}

export interface FlowGraphPayload {
  generatedAt: string;
  project: ProjectMetadata;
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  healthIssues: FlowHealthIssue[]; // Phục vụ BA & Dev cải thiện luồng
}
```

### 4.2. Giao thức Bản tin Thời gian thực qua WebSocket (`RuntimeEventPayload`)

Khi ứng dụng Flutter chạy trên điện thoại hoặc máy ảo, mọi hành động được gửi qua WebSocket tới `/ws` theo định dạng:

```typescript
export interface RuntimeStepEvent {
  type: 'RUNTIME_STEP' | 'SESSION_CONNECTED' | 'SESSION_RESET';
  sessionId: string;           // VD: "iphone_16_pro_ios_18"
  deviceName: string;
  timestamp: number;
  sequenceOrder: number;       // Số thứ tự bước: 1, 2, 3, 4...
  eventKind:
    | 'ROUTE_PUSH'
    | 'ROUTE_POP'
    | 'ROUTE_REPLACE'
    | 'DIALOG_OPEN'
    | 'BOTTOM_SHEET_OPEN'
    | 'SNACKBAR_SHOW'
    | 'API_REQUEST'
    | 'API_RESPONSE'
    | 'STATE_EMITTED'
    | 'BRANCH_HIT'
    | 'LOGOUT_TRIGGERED';
  
  // Ánh xạ trực tiếp lên Node / Edge trên Web Studio:
  matchedNodeId?: string;
  matchedBranchId?: string;    // VD: "true_branch" hoặc "false_branch"
  routeName?: string;
  stateTypeName?: string;      // VD: "LoginSuccessState"
  
  // Chi tiết phục vụ Dev debug & Tester xuất báo cáo lỗi:
  apiDetails?: {
    method: string;
    url: string;
    statusCode?: number;
    durationMs?: number;
    requestBody?: unknown;
    responseBody?: unknown;
  };
  customPayload?: Record<string, unknown>;
}
```

## 5. Đặc tả Thuật toán Phân tích Tĩnh AST (`lib/src/analyzer/`)

Đây là phần quan trọng nhất để **chỉ vẽ luồng logic liên quan đến Chuyển màn hình, Show Dialog, Gọi API, Logout** mà **không bị nhiễu bởi hàng nghìn câu lệnh `if/else` của giao diện UI/UX**. AI Coding Agent cần cài đặt đúng 5 bước trong pipeline dưới đây:

### 5.1. Bước 1: Quét toàn bộ Điểm đích (`SinkDetectorVisitor`)

Viết class `SinkDetectorVisitor extends RecursiveAstVisitor<void>` quét qua từng `CompilationUnit` trong `lib/`:

1. **Nhận diện `SCREEN` Nodes:**
   * Mọi `ClassDeclaration` kế thừa `StatelessWidget`, `StatefulWidget`, `ConsumerWidget`, `ConsumerStatefulWidget`, `HookWidget`, `GetView` mà:
     * Có tên class kết thúc bằng `Screen`, `Page`, `View`, hoặc
     * Được tham chiếu trực tiếp trong bảng khai báo Route (`MaterialApp.routes`, `onGenerateRoute`, `GoRoute(builder: ...)`, `@RoutePage()`), hoặc
     * Là đích đến của một lệnh `Navigator.push` / `MaterialPageRoute(builder: (_) => TargetWidget())`.
2. **Nhận diện `NAVIGATION_SINK` (Điểm đích chuyển màn hình):**
   * `MethodInvocation` có tên hàm thuộc tập `{'push', 'pushNamed', 'pushReplacement', 'pushReplacementNamed', 'pushAndRemoveUntil', 'pushNamedAndRemoveUntil', 'popAndPushNamed', 'go', 'goNamed', 'replace', 'replaceNamed', 'to', 'off', 'offAll', 'offNamed', 'offAllNamed'}` trên các đối tượng `Navigator`, `BuildContext` (extension của `go_router` / `auto_route`), `StackRouter`, hoặc `Get`.
3. **Nhận diện `DIALOG_SINK` (Điểm đích mở thông báo):**
   * `MethodInvocation` có tên hàm thuộc tập `{'showDialog', 'showGeneralDialog', 'showCupertinoDialog', 'showModalBottomSheet', 'showBottomSheet', 'showSnackBar', 'dialog', 'bottomSheet', 'snackbar', 'showToast'}`.
4. **Nhận diện `API_SINK` (Điểm đích gọi mạng):**
   * `MethodInvocation` gọi `.get()`, `.post()`, `.put()`, `.delete()`, `.patch()`, `.request()`, `.fetch()`, `.query()`, `.mutate()` trên các biến có kiểu hoặc tên khớp với `Dio`, `Client` (`http`), `GraphQLClient`, `SupabaseClient`, hoặc các method nằm trong abstract class có gắn annotation `@RestApi()` (Retrofit) / `@ChopperApi()`.
5. **Nhận diện `LOGOUT_SINK` (Điểm đích đăng xuất):**
   * Các hàm hoặc lời gọi hàm có tên khớp biểu thức chính quy (case-insensitive): `^(logout|signOut|logOut|clearSession|revokeToken|forceLogout|onUnauthorized)$`, hoặc chuỗi hành động xóa token trong storage kèm điều hướng `pushAndRemoveUntil` về màn hình Login.

### 5.2. Bước 2: Thuật toán Quét ngược Cây điều khiển (`BackwardControlFlowSlicer`)

**Quy tắc cốt lõi:** Không bao giờ quét xuôi mọi câu lệnh `if/else` trong hàm `build()`. Chỉ xuất phát từ các **Điểm đích (Sinks)** đã tìm thấy ở Bước 1 (hoặc các lệnh `emit(State)` dẫn tới Sink) và leo ngược lên theo con trỏ `node.parent`:

```dart
/// Mã giả thuật toán leo ngược AST để lấy đúng các nhánh if/else nghiệp vụ
List<DecisionChainStep> sliceBackwardFromSink(AstNode sinkNode) {
  final chain = <DecisionChainStep>[];
  AstNode? current = sinkNode;
  AstNode? child = null;

  while (current != null &&
      current is! MethodDeclaration &&
      current is! FunctionDeclaration) {
    
    // 1. Bắt câu lệnh if / else if / else
    if (current is IfStatement) {
      final conditionCode = current.expression.toSource();
      final isInThenBranch = (child == current.thenStatement);
      final isInElseBranch = (child == current.elseStatement);
      chain.add(DecisionChainStep(
        astNode: current,
        kind: DecisionKind.ifElse,
        expression: conditionCode,
        takenBranch: isInThenBranch ? 'true' : (isInElseBranch ? 'false' : 'unknown'),
      ));
    }
    // 2. Bắt câu lệnh switch / case
    else if (current is SwitchMember || current is SwitchPatternCase) {
      final switchStmt = current.parent as SwitchStatement;
      chain.add(DecisionChainStep(
        astNode: switchStmt,
        kind: DecisionKind.switchCase,
        expression: switchStmt.expression.toSource(),
        takenBranch: extractCaseLabel(current),
      ));
    }
    // 3. Bắt khối try / catch (Xử lý lỗi API / Exception)
    else if (current is CatchClause) {
      final tryStmt = current.parent as TryStatement;
      chain.add(DecisionChainStep(
        astNode: tryStmt,
        kind: DecisionKind.tryCatch,
        expression: 'try { ... }',
        takenBranch: 'catch (${current.exceptionParameter?.toSource() ?? "Exception"})',
      ));
    }
    // 4. Bắt biểu thức Either.fold(onFailure, onSuccess) hoặc AsyncValue.when()
    else if (current is MethodInvocation &&
        const {'fold', 'when', 'map', ' maybeWhen'}.contains(current.methodName.name)) {
      final argIndex = current.argumentList.arguments.indexOf(child as Expression);
      chain.add(DecisionChainStep(
        astNode: current,
        kind: DecisionKind.eitherFold,
        expression: current.target?.toSource() ?? current.methodName.name,
        takenBranch: argIndex == 0 ? 'Failure / Left' : 'Success / Right',
      ));
    }

    child = current;
    current = current.parent;
  }
  return chain.reversed.toList(); // Đảo lại để có thứ tự từ đầu hàm -> if/else -> Sink
}
```

**Bộ lọc chống nhiễu UI/UX (Anti-UI-Noise Guard):**
* Nếu một `IfStatement` hoặc `ConditionalExpression` nằm trực tiếp bên trong danh sách `children: [...]` của một Widget (như `Column`, `Row`, `Stack`) và nhánh của nó chỉ trả về các Widget hiển thị (`Text`, `Container`, `SizedBox`, `CircularProgressIndicator`) mà **không chứa bất kỳ Sink nào** (không chuyển màn, không mở Dialog, không gọi API, không Logout), bộ lọc sẽ **loại bỏ hoàn toàn** nhánh đó khỏi đồ thị.

### 5.3. Bước 3: Bắc cầu Xuyên tầng (`CrossLayerLinker`)

Để nối liền mạch từ nút bấm trên màn hình qua tầng State Management (BLoC, Cubit, Riverpod, Provider, GetX) tới lệnh mở Dialog hoặc chuyển màn hình:

1. **Ánh xạ `UI Trigger -> Logic Method`:**
   * Quét các thuộc tính callback trong Widget (`onPressed`, `onTap`, `onLongPress`, `onSubmitted`, `onRefresh`, `initState`).
   * Tìm lời gọi bên trong callback:
     * Với `flutter_bloc`: `context.read<MyBloc>().add(MyEvent())` hoặc `BlocProvider.of<MyBloc>(context).add(MyEvent())` ➔ Nối tới handler `on<MyEvent>((event, emit) { ... })` bên trong `MyBloc`.
     * Với `Cubit` / `Provider` / `Riverpod` / `GetX`: `context.read<MyCubit>().doAction()`, `ref.read(myProvider.notifier).doAction()`, `controller.doAction()` ➔ Nối trực tiếp tới `MethodDeclaration` `doAction`.
2. **Ánh xạ `Repository / API Call -> Logic Method`:**
   * Nếu bên trong `doAction` gọi `await _authRepository.login(...)`, tiếp tục nhảy vào `MethodDeclaration` `login` trong `AuthRepository` để lấy node `API_SINK` (`POST /api/v1/login`) gắn vào luồng.
3. **Ánh xạ `State Emission -> UI Listener -> Terminal Sink`:**
   * Ghi nhận mọi lệnh phát trạng thái trong tầng Logic: `emit(LoginSuccess())`, `emit(state.copyWith(status: Status.failure))`, `state = AsyncData(...)`.
   * Quét trên các `SCREEN` Nodes tìm các khối lắng nghe: `BlocListener<B, S>`, `BlocConsumer<B, S>`, `ref.listen(provider, (prev, next) { ... })`, `ever(rxVar, (val) { ... })`.
   * Khớp kiểu State (`state is LoginSuccess`, `state.status == Status.failure`) giữa nơi phát (`emit`) và nơi nhận (`listener`), từ đó nối thẳng nhánh `if/else` trong BLoC/Notifier tới lệnh `Navigator.push` hoặc `showDialog` nằm trong Listener!

### 5.4. Bước 4: Bộ Dịch Ngôn ngữ Tự nhiên cho BA, Tester & Low-Code (`HumanReadableTranslator`)

Để BA, Tester và người dùng Low-Code đọc hiểu sơ đồ ngay lập tức mà không cần biết cú pháp Dart, `HumanReadableTranslator` chuyển đổi tên hàm và biểu thức điều kiện theo 2 quy tắc:

1. **Ưu tiên 1 — Đọc chú thích đặc tả nếu có (`/// @flow:` hoặc `// Flow:`):**
   * Nếu lập trình viên hoặc AI gắn comment ngay trước hàm hoặc câu lệnh `if`:
     ```dart
     // Flow: Kiểm tra tài khoản đã xác thực KYC và đủ số dư ví
     if (user.isKycVerified && wallet.balance >= order.totalAmount) { ... }
     ```
     Bộ dịch sẽ lấy nguyên văn dòng chú thích này làm `businessTitle` trên Web Studio.
2. **Ưu tiên 2 — Tự động dịch cú pháp AST sang tiếng Việt / tiếng Anh tự nhiên (Rule-based AST Beautifier):**
   * Chuyển `camelCase` / `snake_case` thành cụm từ tự nhiên và dịch các toán tử phổ biến:
     * `statusCode == 200` / `res.isOk` ➔ `"API Thành công (HTTP 200)"`
     * `statusCode == 401` / `statusCode == 403` ➔ `"Hết hạn phiên / Chưa đăng nhập (401/403)"`
     * `statusCode >= 500` ➔ `"Lỗi máy chủ (5xx)"`
     * `.isEmpty` ➔ `"Trống / Rỗng"` | `.isNotEmpty` ➔ `"Có dữ liệu"`
     * `== null` ➔ `"Chưa có giá trị (Null)"` | `!= null` ➔ `"Đã có dữ liệu"`
     * `&&` ➔ `" VÀ "` | `||` ➔ `" HOẶC "` | `!` ➔ `"Không "`

### 5.5. Bước 5: Bộ Kiểm toán Chất lượng Luồng cho BA & Dev (`FlowHealthAuditor`)

Sau khi dựng xong đồ thị `FlowGraphPayload`, `FlowHealthAuditor` chạy kiểm tra tự động và sinh danh sách `healthIssues`:

* **`MISSING_ELSE_BRANCH`:** Phát hiện một `IfStatement` có nhánh `then` dẫn tới chuyển màn hình hoặc gọi API, nhưng **không có nhánh `else`** (và phía sau hàm không có lệnh fallback). Cảnh báo cho BA: *"Khi điều kiện sai, ứng dụng đang im lặng không thông báo Dialog/SnackBar cho người dùng"*.
* **`UNHANDLED_API_ERROR`:** Phát hiện một lệnh gọi `API` nhưng không nằm trong khối `try/catch`, không có `.catchError()`, và không dùng `Either.fold()`. Cảnh báo cho BA & Tester: *"Luồng gọi API này chưa xử lý kịch bản mất mạng hoặc lỗi máy chủ"*.
* **`ORPHAN_SCREEN`:** Phát hiện một class Màn hình (`Screen`) tồn tại trong code nhưng không có bất kỳ mũi tên điều hướng nào trỏ tới nó (màn hình mồ côi hoặc code dư thừa).

## 6. Đặc tả Bộ Bắt Sự kiện Thời gian thực (`lib/src/runtime/`) & Đường chạy Màu Xanh

### 6.1. Cơ chế Tự động Bắt 100% Chuyển màn hình, Dialog, BottomSheet & API

1. **Bắt cả Màn hình lẫn Dialog/BottomSheet qua `FlowStudioNavigatorObserver`:**
   * Trong Flutter, `showDialog()` đẩy một `DialogRoute` và `showModalBottomSheet()` đẩy một `ModalBottomSheetRoute` vào `Navigator`.
   * Khi `didPush(Route route, Route? previousRoute)` được gọi:
     * Nếu `route is PopupRoute` (bao gồm `DialogRoute`, `ModalBottomSheetRoute`): Gửi sự kiện `DIALOG_OPEN` hoặc `BOTTOM_SHEET_OPEN` kèm tên Widget Dialog trích xuất từ `route.settings.name` hoặc `route.runtimeType`.
     * Nếu `route is PageRoute`: Gửi sự kiện `ROUTE_PUSH` kèm tên màn hình và `route.settings.arguments`.
2. **Bắt 100% API bằng `FlowStudioHttpOverrides` (Không phụ thuộc thư viện mạng):**
   * Khi gọi `FlutterFlowStudio.init()`, SDK bọc `HttpOverrides.global` bằng một `HttpClient` proxy ghi nhận mọi request/response (`method`, `uri.path`, `statusCode`, thời gian chạy `durationMs`), đồng thời cung cấp thêm `FlowStudioDioInterceptor` để lấy đầy đủ JSON body nếu dự án dùng `Dio`.
3. **Suy luận Nhánh `if/else` thông minh kết hợp `--deep-trace`:**
   * **Chế độ Mặc định (Zero-Instrumentation):** Trên Web Studio, file `pathInference.ts` tìm đường đi ngắn nhất trên đồ thị AST nối giữa sự kiện trước (ví dụ: `API POST /login trả về 400`) và sự kiện ngay sau đó (ví dụ: `Mở Dialog LoginErrorDialog`). Nếu nhánh `else (statusCode != 200)` là đường nối duy nhất giữa 2 node này, Web Studio **tự động tô xanh toàn bộ nhánh `else` đó**.
   * **Chế độ Chính xác Tuyệt đối (`--deep-trace`):** Khi chạy `dart run flutter_flow_studio --deep-trace`, `DeepTraceInstrumenter` tự động chèn `FlowProbe.hit('decision_id:branch_id');` vào dòng đầu tiên của các nhánh `if/else` có chứa Sink, và tự khôi phục (restore) file gốc khi nhấn `Ctrl+C` dừng server.

### 6.2. Tính năng Đo Độ phủ Kiểm thử trên Cây (QA Test Coverage Tracker)

Dành riêng cho **Tester / QA** khi bật chế độ `🧪 Tester Mode` trên Web Studio:
* Mỗi nhánh đầu ra của Node `DECISION` (`if/else`, `switch`, `try/catch`) có trạng thái `isVisited: boolean`.
* Khi Tester thao tác trên điện thoại và đi qua nhánh nào, nhánh đó chuyển sang **Màu xanh lá (`#10B981`)** và được đánh dấu `Tested ✅`.
* Các nhánh chưa đi qua được hiển thị bằng **đường nét đứt màu vàng cam nhạt (`Untested ⏳`)**.
* Thanh trạng thái góc trái hiển thị trực tiếp: **`Flow Coverage: 14 / 20 nhánh đã kiểm thử (70%)`**, giúp Tester nhìn vào sơ đồ biết ngay còn trường hợp `else` hoặc lỗi API nào mình chưa test tới.

## 7. Thiết kế Theme, Style & Chuẩn UI/UX cho Web Studio

### 7.1. Hệ màu "Precision Dark Canvas" & Quy tắc Độc quyền Màu Xanh Lá

* **Quy tắc vàng:** **Không một loại Node tĩnh nào được sử dụng màu xanh lá cây (`#10B981` / `#22C55E`).** Màu xanh lá phát sáng (Neon Emerald) được **độc quyền 100%** cho **Đường chạy thực thi thời gian thực (Live Green Execution Path)** và các nhánh đã được kiểm thử qua.

| Thành phần | Mã màu Dark Mode (Mặc định) | Mã màu Light Mode (Khi in/xuất) | Quy cách hiển thị |
| :--- | :--- | :--- | :--- |
| **Mặt phẳng Canvas** | `#0B0F17` (Chấm bi `#1E293B`) | `#F8FAFC` (Chấm bi `#CBD5E1`) | Lưới chấm bi cách nhau `20px`, chiếm `100vw x 100vh`. |
| **Thanh nổi (Floating Panels)** | `rgba(17, 24, 39, 0.88)` | `rgba(255, 255, 255, 0.92)` | Hiệu ứng kính mờ `backdrop-filter: blur(12px)`, viền `1px`. |
| **Node `SCREEN` (Màn hình)** | `#3B82F6` (Royal Blue) | `#2563EB` | Thẻ rộng `260px`, bo góc `12px`, icon `Smartphone`. |
| **Node `ACTION` (Sự kiện/Hàm)** | `#8B5CF6` (Electric Violet) | `#7C3AED` | Thẻ rộng `220px`, bo góc `10px`, icon `Zap` / `MousePointerClick`. |
| **Node `DECISION` (`if/else`)** | `#F59E0B` (Amber Gold) | `#D97706` | Thẻ rộng `250px`, cổng ra gắn nhãn rõ `TRUE` / `FALSE`, icon `GitBranch`. |
| **Node `API` (Network Call)** | `#06B6D4` (Cyan / Sky) | `#0891B2` | Badge hiển thị rõ `GET`/`POST`/`PUT`/`DELETE`, icon `Globe`. |
| **Node `DIALOG` (Thông báo)** | `#EC4899` (Magenta Pink) | `#DB2777` | Hiển thị rõ `Dialog` / `BottomSheet` / `SnackBar`, icon `MessageSquareWarning`. |
| **Node `LOGOUT` (Đăng xuất)** | `#F43F5E` (Crimson Rose) | `#E11D48` | Viền đỏ cảnh báo điểm kết thúc phiên, icon `LogOut`. |
| **Đường chạy Real-time (Active)** | **`#10B981` -> `#34D399`** | **`#059669`** | Dày `3px`, phát sáng `drop-shadow(0 0 8px #10B981)`, hạt chạy động liên tục + Huy hiệu số bước `①`, `②`, `③`. |

### 7.2. Bốn Chế độ Hiển thị theo Vai trò (Role-Based View Switcher)

Trên thanh Header chính của Web Studio có bộ chuyển đổi 4 chế độ xem tức thì:

1. **`👨‍💻 Dev Mode`:** Hiển thị tên hàm/class gốc (`AuthCubit.login`), biểu thức code thật (`res.statusCode == 200`), đường dẫn file, các node State Bridge và nút mở nhanh trong VS Code / Cursor.
2. **`📊 BA Mode`:** Chuyển toàn bộ tiêu đề Node và nhãn mũi tên sang `businessTitle` (ngôn ngữ tự nhiên), bật nổi bật các huy hiệu cảnh báo **`⚠️ Flow Health Issues`** (như nhánh `if` thiếu `else` hoặc API thiếu xử lý lỗi) để BA rà soát và cải thiện quy trình.
3. **`🧪 Tester Mode`:** Bật thanh tiến độ **`Branch Coverage (%)`**, tô sáng các nhánh đã test (màu xanh lá) và làm nổi bật các nhánh chưa test (viền nét đứt màu vàng cam), kèm nút **"Export Bug Repro"** để xuất ngay kịch bản vừa chạy.
4. **`🧩 Low-Code Mode`:** Tự động thu gọn (collapse) các node kỹ thuật trung gian (như State emission, Repository call), chỉ giữ lại các khối trực quan dễ hiểu: **`Màn hình ➔ Bấm nút ➔ Gọi API ➔ Kiểm tra Điều kiện ➔ Hiện Hộp thoại / Chuyển màn hình`**.

### 7.3. Hộp thoại Tùy chọn Xuất file Đa định dạng (Multi-Format Export Modal)

Khi bấm nút **Export**, người dùng được chọn kết hợp giữa **Định dạng**, **Phạm vi** và **Góc nhìn**:

* **Định dạng xuất (6 định dạng):**
  1. **Draw.io (`.drawio`):** File XML chuẩn mở trực tiếp trên `app.diagrams.net` với đầy đủ tọa độ khối, màu sắc và mũi tên để BA vẽ tiếp.
  2. **Mermaid.js (`.mmd`):** Mã `flowchart LR` hoặc `flowchart TD` để Dev/BA dán vào Notion, GitHub README, GitLab, Confluence.
  3. **Excalidraw (`.excalidraw`):** File JSON chuẩn mở trên Excalidraw để thảo luận nhóm.
  4. **PlantUML (`.puml`):** Chuẩn tài liệu thiết kế hệ thống.
  5. **Hình ảnh (`PNG 2x` / `SVG`):** Tùy chọn xuất nền Tối (Dark) hoặc nền Sáng (Light).
  6. **Flow Studio Snapshot (`.flow.json`):** Lưu toàn bộ đồ thị + lịch sử đường chạy màu xanh + log API để gửi cho đồng nghiệp nạp lại vào Web Studio xem ngay.
* **Phạm vi & Nhãn xuất:**
  * Xuất **Toàn bộ dự án**, **Chỉ cụm Feature đang chọn**, hoặc **Chỉ xuất riêng Đường màu xanh vừa chạy (Active Green Path Only)**.
  * Chọn xuất nhãn theo **Ngôn ngữ Nghiệp vụ (cho BA/Low-Code)** hoặc **Tên Hàm/Code (cho Dev)**.

## 8. Lộ trình Triển khai & Hướng dẫn Từng bước cho AI Coding Agent (Step-by-Step Implementation Plan)

Khi giao tài liệu này cho AI Coding Agent thực thi, hãy yêu cầu AI triển khai lần lượt theo 5 Phase dưới đây:

### Phase 1: Khởi tạo Package, Schema & LAN Server (`Tuần 1`)
* **Bước 1.1:** Tạo `pubspec.yaml` với đầy đủ dependencies (`analyzer`, `shelf`, `shelf_static`, `shelf_web_socket`, `web_socket_channel`, `args`, `yaml`) và khai báo `executables: flutter_flow_studio: flutter_flow_studio`.
* **Bước 1.2:** Cài đặt các model trong `lib/src/schema/` (`FlowGraphPayload`, `FlowNodeData`, `FlowEdgeData`, `FlowHealthIssue`, `RuntimeStepEvent`) kèm hàm `toJson()` / `fromJson()`.
* **Bước 1.3:** Cài đặt `ProjectInspector` trong `lib/src/analyzer/project_inspector.dart` để đọc `pubspec.yaml`, `pubspec.lock` và phân loại toàn bộ dependencies của dự án đích.
* **Bước 1.4:** Cài đặt `StudioLanServer` trong `lib/src/server/studio_lan_server.dart` bind vào `0.0.0.0:<port>`, cung cấp API `GET /api/graph`, WebSocket `/ws`, và in bảng thông tin kèm IP LAN ra Terminal.

### Phase 2: Bộ Phân tích Tĩnh AST, Backward Slicing & Dịch Ngôn ngữ Tự nhiên (`Tuần 2 - 3`)
* **Bước 2.1:** Cài đặt `SinkDetectorVisitor` và bộ `adapters/` nhận diện đầy đủ Screen, Navigation (`Navigator`, `GoRouter`, `AutoRoute`, `GetX`), Dialog (`showDialog`, `showModalBottomSheet`, `SnackBar`), API (`Dio`, `http`, `Retrofit`) và `Logout`.
* **Bước 2.2:** Cài đặt `BackwardControlFlowSlicer` leo ngược từ Sink lên hàm chứa nó để bóc tách chính xác các nhánh `if/else`, `switch/case`, `try/catch`, `Either.fold` và lọc bỏ 100% các câu lệnh `if/else` thuần UI.
* **Bước 2.3:** Cài đặt `CrossLayerLinker` để nối `UI Trigger (onPressed)` ➔ `Logic Method (BLoC/Cubit/Riverpod/Provider/GetX)` ➔ `State Emission` ➔ `UI Listener (BlocListener/ref.listen)` ➔ `Sink`.
* **Bước 2.4:** Cài đặt `HumanReadableTranslator` (dịch code sang nhãn nghiệp vụ cho BA/Low-Code) và `FlowHealthAuditor` (phát hiện nhánh `if` thiếu `else`, API thiếu bắt lỗi).

### Phase 3: Giao diện Web Studio (React Flow) & 4 Chế độ Vai trò (`Tuần 4 - 5`)
* **Bước 3.1:** Khởi tạo dự án React + TypeScript + Vite + TailwindCSS + `@xyflow/react` + `elkjs` + `zustand` trong thư mục `web_studio/`.
* **Bước 3.2:** Xây dựng 6 Custom Nodes (`ScreenNode`, `ActionNode`, `DecisionNode`, `ApiNode`, `DialogNode`, `LogoutNode`) theo bảng màu **Precision Dark Canvas** và `AnimatedGreenEdge` (đường chạy màu xanh lá `#10B981` phát sáng kèm số bước).
* **Bước 3.3:** Xây dựng `RoleModeSwitcher` (`Dev`, `BA`, `Tester`, `Low-Code`), `LeftProjectPanel` (thông tin SDK, packages, BA Health Warnings, QA Coverage %), và `RightInspectorDrawer` (Code Snippet, nút Open in VS Code, API Payload).
* **Bước 3.4:** Xây dựng `ExportModal` cùng các bộ chuyển đổi xuất ra `.drawio`, `.mmd`, `.excalidraw`, `.puml`, `.png/.svg`, `.flow.json`.

### Phase 4: Runtime SDK, Đường chạy Màu Xanh & QA Coverage (`Tuần 6 - 7`)
* **Bước 4.1:** Cài đặt `FlutterFlowStudio.init()`, `FlowStudioNavigatorObserver` (bắt cả Screen lẫn Dialog/BottomSheet), `FlowStudioHttpOverrides`, `FlowStudioDioInterceptor`, `FlowStudioBlocObserver`, `FlowStudioProviderObserver`.
* **Bước 4.2:** Cài đặt `pathInference.ts` trên Web Studio để tự động suy luận và tô xanh nhánh `if/else` ngay khi nhận chuỗi sự kiện WebSocket từ điện thoại, đồng thời cập nhật bộ đếm `% Branch Coverage` cho Tester.
* **Bước 4.3:** Cài đặt `DeepTraceInstrumenter` cho cờ `--deep-trace` và thanh `LiveTimelineBar` cho phép tua lại (Replay) từng bước người dùng vừa thao tác.

### Phase 5: Đóng gói Tĩnh, Dự án Mẫu (`example/`) & Xuất bản `pub.dev` (`Tuần 8`)
* **Bước 5.1:** Viết script build tự động chuyển `web_studio/dist/` vào `lib/src/web_assets/`.
* **Bước 5.2:** Tạo ứng dụng Flutter mẫu trong `example/` có đầy đủ luồng Đăng nhập, Gọi API, Rẽ nhánh `if/else`, Hiện Dialog lỗi, Chuyển màn hình Trang chủ và Đăng xuất để kiểm thử đầu-cuối.
* **Bước 5.3:** Viết Unit Tests trong `test/`, hoàn thiện tài liệu theo [mục 9.4](#94-review-và-cập-nhật-tài-liệu), và kiểm tra `dart pub publish --dry-run`.
* **Bước 5.4:** Chạy toàn bộ [mục 9 — Chuẩn Handover](#9-chuẩn-handover). Thiếu một mục bắt buộc thì chưa được gọi là xong.

## 9. Chuẩn Handover

Đây là cổng bàn giao. Agent chỉ được nói “xong” khi cả bốn mục 9.1–9.4 đều có bằng chứng trong `docs/progress/HANDOVER.md`. Không có log thì ghi `Chưa đạt`, không ghi `Đạt`.

Package phải chạy được với app Flutter trên **Android, iOS, Web và Windows**. macOS và Linux desktop dùng cùng runtime `dart:io` với Windows, không viết fork riêng. CLI (máy dev) chạy trên Windows, macOS và Linux.

Ràng buộc SDK ghi đúng vào `pubspec.yaml` của runtime, thay cho câu `Dart SDK >= 3.2.0` ở mục 2:

```yaml
environment:
  sdk: '>=3.8.0 <4.0.0'
  flutter: '>=3.32.8'
```

`3.32.8` kèm Dart `3.8.1`. `3.41.9` kèm Dart `3.11.5`. Mọi bản stable mới hơn (kể cả nhánh 3.44 / 3.47) nằm trong tập “mới hơn” và cũng phải được test.

### 9.1. Test pass trên mọi platform được hỗ trợ

Mỗi ô dưới đây phải `Đạt` trước handover. Lệnh chạy trong `example/` trừ khi ghi CLI.

| Hạng mục | Lệnh phải xanh | Runner |
| --- | --- | --- |
| Phân tích example | `flutter analyze` | mọi OS |
| Unit / widget test | `flutter test` | mọi OS |
| Web | `flutter build web` | Linux hoặc macOS hoặc Windows |
| Android | `flutter build apk --debug` và `flutter test` cho observer (route giả) | Linux hoặc macOS hoặc Windows |
| iOS | `flutter build ios --no-codesign` | macOS |
| Windows | `flutter build windows` | Windows |
| CLI | `dart test` trong package CLI | Linux, macOS và Windows |
| Web không kéo `dart:io` | build web của example không lỗi `dart:io` | cùng job web |

Luật:

* Bốn target **Android, iOS, Web, Windows** là bắt buộc. Không được ghi `N/A` chỉ vì máy đang code là Linux. Job iOS chạy trên runner macOS; job Windows chạy trên runner Windows.
* Test instrumented trên emulator/simulator: Android emulator và iOS Simulator mỗi nền ít nhất một lần cho luồng Login → API → nhánh đúng/sai → Dialog → Home → Logout. Nếu CI không có emulator, ghi rõ log máy thật hoặc emulator trong `HANDOVER.md`; không bỏ hẳn.
* `flutter test` và `flutter analyze` phải xanh trên cả ba SDK ở mục 9.2, không chỉ trên SDK máy dev đang mở.
* Runtime release (`--release`) không được mở socket studio. Có test hoặc assert chứng minh `init()` trả về ngay khi `kReleaseMode == true`.
* Còn một test đỏ trên một platform trong bảng thì handover **trượt**.

### 9.2. Test trên Flutter 3.32.8, 3.41.9, hoặc mới hơn

Chạy đủ bộ 9.1 trên đúng ba SDK, không thay bằng “SDK gần đó”:

| SDK | Dart đi kèm | Vai trò |
| --- | --- | --- |
| Flutter `3.32.8` | `3.8.1` | Sàn. App cũ nhất còn nhận package |
| Flutter `3.41.9` | `3.11.5` | Bản pin giữa |
| Flutter stable mới nhất tại thời điểm chạy, phải `>` `3.41.9` | theo bản đó | “Hoặc mới hơn” |

Việc phải làm trên **mỗi** SDK:

1. `flutter pub get` trong `example/` và trong package runtime.
2. `flutter analyze` và `flutter test`.
3. `flutter build web`.
4. Trên CLI: `dart test` bằng đúng Dart SDK đi kèm Flutter đó (`<flutter>/bin/dart test`).
5. Ghi version thật (`flutter --version`) vào `docs/progress/HANDOVER.md`. Cấm ghi đè version cho đủ bảng.

`analyzer` không được pin một major chỉ chạy trên Dart 3.13, vì như vậy `3.32.8` và `3.41.9` không resolve được. CLI để dải `analyzer` mà pub giải được trên cả ba SDK. Mọi gọi element AST đi qua một facade. Nếu một API analyzer không biên dịch được trên cả ba, sửa facade; không nâng sàn SDK lên để né `3.32.8`.

### 9.3. UI/UX đạt bộ kiểm thử WCAG, axe, Nielsen và Lighthouse

Đối tượng đo là **Web Studio đã build** (`vite build` rồi `vite preview`), mở cùng đồ thị mẫu của example (Login → API → điều kiện → Dialog / Home). Cấm đo trang trống cho có điểm.

**WCAG 2.2 mức AA**

* Chữ trên node và thanh công cụ đạt contrast **≥ 4.5:1**. Nền amber `#F59E0B` và cyan `#06B6D4` không được ép chữ trắng nếu đo dưới 4.5:1; đổi màu chữ (ví dụ `#111827`), giữ màu nhận diện của node.
* Mọi nút toolbar, ô search, nút đóng drawer có focus nhìn thấy được và bấm được bằng bàn phím. `Escape` đóng drawer. Kích thước bấm tối thiểu 24×24 px.
* `prefers-reduced-motion: reduce` thì tắt animation cạnh và không tự bay camera.
* Tested / Untested / đường suy luận không phân biệt chỉ bằng màu: có chữ hoặc icon (`Tested`, `Untested`, `Inferred`).
* `html` có `lang` đúng ngôn ngữ đang xem (`vi` hoặc `en`).

**axe**

* Chạy `@axe-core/playwright` (hoặc tương đương) lên các màn: canvas có graph, drawer inspector mở, export modal mở, thanh coverage Tester.
* **0** vi phạm `critical` và **0** vi phạm `serious`. `moderate` / `minor` phải có dòng trong `HANDOVER.md`: sửa, hoặc lý do giữ lại. Không để axe chỉ chạy local không lưu report.

**Nielsen (10 heuristic)** — file `docs/progress/nielsen_review.md`, mỗi heuristic một dòng `Đạt` hoặc `Không đạt` kèm màn đã xem. `Không đạt` thì chưa handover.

| # | Heuristic | Điều kiện Đạt trên studio |
| --- | --- | --- |
| 1 | Visibility of system status | Thấy trạng thái socket, tên platform (android/ios/web/windows), và coverage không giả dạng một số % khi chỉ là suy luận |
| 2 | Match system / real world | Mode BA và Low-Code dùng nhãn nghiệp vụ, không bắt người đọc phải hiểu `Cubit` mới xem được luồng |
| 3 | User control and freedom | Reset đường chạy có xác nhận; đóng được drawer; xóa được ô search |
| 4 | Consistency and standards | Một bộ icon, cùng language cho 6 loại node, cùng vị trí nút Export |
| 5 | Error prevention | Export mặc định không kèm payload API; bật kèm payload thì phải confirm |
| 6 | Recognition rather than recall | Có legend màu; untested có nhãn chữ |
| 7 | Flexibility and efficiency | Search theo tên node; có lệnh fit-view; phím tắt chuyển 4 mode được ghi trong UI |
| 8 | Aesthetic and minimalist | Low-Code ẩn node kỹ thuật trung gian; panel không che kín canvas |
| 9 | Recover from errors | Token sai, graph rỗng, step không map được: có câu nói rõ việc tiếp theo, không crash trắng |
| 10 | Help and documentation | Footer trỏ tới README và trang giới hạn đã biết |

**Lighthouse** (CI, chống build preview, không phải `vite dev`)

| Hạng mục | Ngưỡng | Ghi chú |
| --- | --- | --- |
| Accessibility | ≥ 95 | Cùng đồ thị mẫu, không phải trang rỗng |
| Best practices | ≥ 95 | |
| Performance | ≥ 80 | ELK trên graph mẫu; không đòi 100 |
| SEO | không chặn | App local. Đặt `noindex`. Không được fail handover vì SEO |

Report Lighthouse và axe lưu đường dẫn trong `HANDOVER.md`.

### 9.4. Review và cập nhật tài liệu

Tài liệu chia **hai loại**. Không trộn.

**Ngắn hạn — tiến độ dev** (chỉ người làm việc nội bộ, được phép dở dang, có ngày cập nhật):

| File | Nội dung được phép |
| --- | --- |
| `docs/progress/STATUS.md` | Bảng phase và platform: `Xong` / `Đang làm` / `Chưa làm`. Không viết hướng dẫn cài đặt |
| `docs/progress/HANDOVER.md` | Checklist 9.1–9.4, version `flutter --version`, đường dẫn log, axe, Lighthouse |
| `docs/progress/nielsen_review.md` | Biên bản heuristic, ngày review |

Mỗi phase xong phải sửa `STATUS.md` trong cùng thay đổi. File ngắn hạn **không** được đưa vào package publish như tài liệu người dùng (`dart pub publish` không ship `docs/progress/` như README).

**Dài hạn — người dùng và người bảo trì** (chỉ mô tả cái đã chạy; không có “tuần 1”, không có TODO sprint):

| File | Nội dung |
| --- | --- |
| `README.md` (repo và từng package) | Cài đặt, lệnh chạy, snippet `init`, bốn platform, host mặc định (Android emulator, iOS simulator, Windows, Web), việc cleartext / ATS / firewall |
| `CHANGELOG.md` | [Keep a Changelog](https://keepachangelog.com/). Chỉ behavior đã phát hành. Sửa spec mà chưa có release thì ghi dưới `## [Unreleased]`, không bịa version |
| `SECURITY.md` | Bind mặc định, token, redact, không telemetry |
| `docs/platforms.md` | Bảng Android / iOS / Web / Windows: cái runtime bắt được và cái không bắt được |
| `docs/limitations.md` | Non-goals đã biết (Cronet, cupertino_http, coverage VM Service trên web, v.v.) |

Luật review lúc handover:

* Đọc lại README và CHANGELOG sau khi code đã đổi. Câu nào mô tả tính năng chưa có trong bản build thì xóa hoặc chuyển xuống `docs/limitations.md`.
* `STATUS.md` không được để phase đã merge ở trạng thái `Chưa làm`, và không được để phase chưa có test ở trạng thái `Xong`.
* README không chứa bảng tiến độ. `STATUS.md` không chứa hướng dẫn publish.
* `CHANGELOG.md` của bản handover có mục `Unreleased` hoặc version sắp gắn, liệt kê thay đổi người dùng thấy được. Để file rỗng là trượt.

### 9.5. Định nghĩa “đã handover”

`docs/progress/HANDOVER.md` mở đầu bằng một dòng duy nhất:

```text
Handover: DAT
```

chỉ khi 9.1, 9.2, 9.3 và 9.4 đều `Đạt`. Ngược lại dòng đó phải là `Handover: CHUA DAT` và liệt kê mục còn thiếu. Agent không được đổi dòng này thành `DAT` nếu thiếu log.