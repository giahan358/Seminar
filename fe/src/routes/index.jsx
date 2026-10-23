import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RequirePasswordChanged, RequireRole } from "./guards";
import LoginPage from "../pages/auth/LoginPage";
import ChangePasswordPage from "../pages/auth/ChangePasswordPage";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminUnits from "../pages/admin/AdminUnits";
import AdminAuditLog from "../pages/admin/AdminAuditLog";
import AdminConfig from "../pages/admin/AdminConfig";
// 1. Import AdminLayout vào
import AdminLayout from "../layouts/AdminLayout";

// Tạm thời tạo các trang giả để test Layout
const AdminRecords = () => <div style={{ fontSize: 24, fontWeight: "bold" }}>Xử lý Hồ sơ</div>;
const UnitRecords = () => <div style={{ padding: 20 }}>Trang tự chấm của UNIT</div>;
const Forbidden = () => <div style={{ padding: 20, color: "red" }}>403 - Bạn không có quyền truy cập!</div>;

export default function AppRoutes() {
  return (
    <Routes>
      {/* Trang public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Đã đăng nhập mới được vào */}
      <Route element={<RequireAuth />}>
        
        {/* Bị ép đổi mật khẩu thì chỉ hiện trang này */}
        <Route path="/change-password" element={<ChangePasswordPage />} />

        {/* Đã đổi mật khẩu rồi mới được vào các trang dưới */}
        <Route element={<RequirePasswordChanged />}>
          
          {/* ================= KHU VỰC ADMIN ================= */}
          <Route element={<RequireRole roles={["ADMIN"]} />}>
            {/* 2. Bọc AdminLayout ở đây. Các trang con sẽ tự động lọt vào <Outlet /> của Layout này */}
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/units" element={<AdminUnits />} />
              <Route path="/admin/config" element={<AdminConfig />} />
              <Route path="/admin/records" element={<AdminRecords />} />
              <Route path="/admin/audit-log" element={<AdminAuditLog />} />
            </Route>
          </Route>

          {/* ================= KHU VỰC UNIT ================= */}
          <Route element={<RequireRole roles={["UNIT"]} />}>
            <Route path="/unit/records" element={<UnitRecords />} />
          </Route>

        </Route>
      </Route>

      {/* Lỗi 403 */}
      <Route path="/403" element={<Forbidden />} />

      {/* Mặc định vào trang login nếu gõ sai đường dẫn */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}