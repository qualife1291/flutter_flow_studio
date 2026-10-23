export type RoleViewMode = "DEV" | "BA" | "TESTER" | "LOW_CODE";

export type NodeKind =
  | "SCREEN" // Màn hình / Page / RouteWidget
  | "ACTION" // Sự kiện bấm nút / Hàm khởi phát / BLoC Event
  | "DECISION" // Nhánh điều kiện if/else, switch/case, try/catch, Either.fold
  | "API" // Lời gọi mạng HTTP / Dio / Retrofit / GraphQL
  | "DIALOG" // showDialog, showModalBottomSheet, SnackBar, Toast
  | "LOGOUT"; // Đăng xuất, xóa token, reset phiên về màn Login

export interface ProjectMetadata {
  projectRoot?: string;
  projectName: string;
  description: string;
  version: string;
  flutterSdkVersion: string;
  dartSdkConstraint: string;
  detectedArchitecture: {
    stateManagement: string[]; // VD: ["flutter_bloc (^8.1.6)", "provider (^6.1.2)"]
    routing: string[]; // VD: ["go_router (^14.2.0)"]
    networking: string[]; // VD: ["dio (^5.7.0)", "retrofit (^4.4.0)"]
    localStorage: string[]; // VD: ["shared_preferences (^2.3.2)", "flutter_secure_storage (^9.2.2)"]
  };
  allDependencies: Array<{
    name: string;
    version: string;
    category:
      "STATE" | "ROUTER" | "NETWORK" | "STORAGE" | "DI" | "UI_UTILS" | "DEV";
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
  id: string; // Định danh duy nhất, VD: "screen:LoginScreen", "decision:auth_cubit.dart:54"
  kind: NodeKind;
  featureGroup: string; // Tên cụm tính năng lấy theo thư mục, VD: "auth", "checkout", "profile"

  // Nhãn hiển thị thích ứng theo từng đối tượng người dùng (Role-Based Labels):
  technicalTitle: string; // Cho Dev: "AuthCubit.submitLogin()" hoặc "if (res.statusCode == 200)"
  businessTitle: string; // Cho BA & Low-Code: "Xử lý Đăng nhập" hoặc "Kiểm tra: Đăng nhập thành công?"
  description?: string; // Mô tả chi tiết lấy từ comment /// hoặc tự sinh

  // Thông tin vị trí mã nguồn (Cho Dev & Nút Open in IDE):
  sourceLocation?: {
    filePath: string; // VD: "lib/features/auth/cubit/auth_cubit.dart"
    line: number;
    column: number;
    codeSnippet: string; // 5-15 dòng code trích xuất quanh node
  };

  // Thuộc tính chuyên biệt cho từng loại Node:
  routeInfo?: {
    aliases?: string[];
    routePath: string; // VD: "/login", "/home/product/:id"
    isInitialRoute: boolean;
    parameters: string[];
  };
  apiInfo?: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "GRAPHQL";
    endpoint: string; // VD: "/api/v1/auth/login"
    clientType: string; // VD: "Dio", "Retrofit", "HttpClient"
    requestModel?: string;
    responseModel?: string;
  };
  decisionInfo?: {
    kind: "IF_ELSE" | "SWITCH" | "TRY_CATCH" | "EITHER_FOLD";
    rawExpression: string; // VD: "response.statusCode == 200 && user.isVerified"
    humanReadableRule: string; // VD: "API trả về 200 VÀ Tài khoản đã xác minh"
    branches: Array<{
      branchId: string; // VD: "true_branch", "false_branch", "catch_branch"
      technicalLabel: string; // VD: "true", "else (statusCode == 401)", "catch (DioException)"
      businessLabel: string; // VD: "Hợp lệ", "Hết hạn phiên (401)", "Lỗi kết nối mạng"
    }>;
  };
  dialogInfo?: {
    overlayType: "DIALOG" | "BOTTOM_SHEET" | "SNACKBAR" | "TOAST";
    widgetName: string; // VD: "OtpVerificationDialog"
    actions: string[]; // VD: ["Xác nhận", "Hủy"]
  };
}

export interface FlowEdgeData {
  id: string; // VD: "edge:decision_54->dialog_OtpDialog"
  source: string; // ID của Node nguồn
  target: string; // ID của Node đích
  sourceHandle?: string; // Cổng ra trên Decision Node (VD: "true_branch", "false_branch")
  technicalLabel?: string; // Nhãn cho Dev: "emit(LoginFailure) -> state is LoginFailure"
  businessLabel?: string; // Nhãn cho BA/Low-Code: "Khi sai mật khẩu"
  isStateBridge?: boolean; // true nếu cạnh này nối xuyên tầng từ BLoC/Notifier sang UI Listener
}

export interface FlowHealthIssue {
  id: string;
  severity: "WARNING" | "INFO";
  category:
    | "MISSING_ELSE_BRANCH"
    | "UNHANDLED_API_ERROR"
    | "ORPHAN_SCREEN"
    | "DEAD_END_ACTION";
  nodeId: string;
  title: string; // VD: "Thiếu nhánh xử lý khi điều kiện sai (Missing Else)"
  suggestionForBA: string; // VD: "Cần bổ sung thông báo Dialog/SnackBar nếu giỏ hàng rỗng."
  suggestionForDev: string; // VD: "Thêm khối else cho câu lệnh if tại checkout_cubit.dart:78."
}

export interface FlowGraphPayload {
  generatedAt: string;
  project: ProjectMetadata;
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  healthIssues: FlowHealthIssue[]; // Phục vụ BA & Dev cải thiện luồng
}

export interface RuntimeStepEvent {
  type: "RUNTIME_STEP" | "SESSION_CONNECTED" | "SESSION_RESET";
  sessionId: string; // VD: "iphone_16_pro_ios_18"
  deviceName: string;
  timestamp: number;
  sequenceOrder: number; // Số thứ tự bước: 1, 2, 3, 4...
  eventKind:
    | "ROUTE_PUSH"
    | "ROUTE_POP"
    | "ROUTE_REPLACE"
    | "DIALOG_OPEN"
    | "BOTTOM_SHEET_OPEN"
    | "SNACKBAR_SHOW"
    | "API_REQUEST"
    | "API_RESPONSE"
    | "STATE_EMITTED"
    | "BRANCH_HIT"
    | "LOGOUT_TRIGGERED";

  // Ánh xạ trực tiếp lên Node / Edge trên Web Studio:
  matchedNodeId?: string;
  matchedBranchId?: string; // VD: "true_branch" hoặc "false_branch"
  routeName?: string;
  stateTypeName?: string; // VD: "LoginSuccessState"

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
