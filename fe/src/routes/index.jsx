import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RequirePasswordChanged, RequireRole } from "./guards";
import LoginPage from "../pages/auth/LoginPage";
import ChangePasswordPage from "../pages/auth/ChangePasswordPage";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminUnits from "../pages/admin/AdminUnits";
import AdminAuditLog from "../pages/admin/AdminAuditLog";
import AdminConfig from "../pages/admin/AdminConfig";
import AdminRecords from "../pages/admin/AdminRecords";
import AdminRecordReview from "../pages/admin/AdminRecordReview";
import UnitEvaluation from "../pages/unit/UnitEvaluation";
import NotificationInbox from "../pages/shared/NotificationInbox";
import AdminLayout from "../layouts/AdminLayout";
import UnitLayout from "../layouts/UnitLayout";

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
              <Route path="/admin/records/:evaluationId" element={<AdminRecordReview />} />
              <Route path="/admin/audit-log" element={<AdminAuditLog />} />
              <Route path="/admin/notifications" element={<NotificationInbox />} />
            </Route>
          </Route>

          {/* ================= KHU VỰC UNIT ================= */}
          <Route element={<RequireRole roles={["UNIT"]} />}>
            <Route element={<UnitLayout />}>
              <Route path="/unit/evaluation" element={<UnitEvaluation />} />
              <Route path="/unit/notifications" element={<NotificationInbox />} />
            </Route>
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