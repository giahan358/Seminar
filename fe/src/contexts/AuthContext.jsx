import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import {
  getAccessToken,
  getRefreshToken,
  getCurrentUser,
  setSession,
  clearSession,
} from "../services/session";

const AuthContext = createContext(null);

/** Quản lý phiên thật qua API, phục hồi sau reload và cô lập mỗi effect để StrictMode hủy rồi chạy lại an toàn */
export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    let cancelled = false;

    /** Đọc me từ server và giữ token hiện tại sau interceptor refresh, không ghi đè bằng access trước lúc chờ */
    async function restore() {
      const accessToken = getAccessToken();
      if (!accessToken) {
        setLoading(false);
        return;
      }

      const cached = getCurrentUser();
      if (cached) setUser(cached);

      try {
        const fresh = await authService.getMe();
        if (cancelled) return;
        setUser(fresh);
        setSession({
          accessToken: getAccessToken(),
          refreshToken: getRefreshToken(),
          user: fresh,
        });
      } catch {
        if (cancelled) return;
        // 401 đã được apiClient xử lý (clear + event)
        // lỗi khác: nếu không có cached thì coi như chưa đăng nhập
        if (!cached) {
          clearSession();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    /** Nhận thay đổi phiên từ interceptor để đồng bộ hồ sơ mà không cần reload trang */
    const onUpdated = (event) => setUser(event.detail);
    const onUnauthorized = () => {
      clearSession();
      setUser(null);
      navigate("/login", {
        replace: true,
        state: { message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." },
      });
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    window.addEventListener("auth:updated", onUpdated);
    return () => {
      window.removeEventListener("auth:unauthorized", onUnauthorized);
      window.removeEventListener("auth:updated", onUpdated);
    };
  }, [navigate]);

  /** Xác thực credential qua BE, chỉ lưu khi cặp token và hồ sơ đầy đủ để không tạo phiên dở dang */
  const login = useCallback(async (username, password) => {
    const result = await authService.login(username, password);
    // contract login: { accessToken, refreshToken, tokenType, expiresIn, user }
    const { accessToken, refreshToken, user: nextUser } = result ?? {};

    if (!accessToken || !refreshToken || !nextUser) {
      throw {
        message: "Phản hồi đăng nhập không hợp lệ (thiếu token hoặc user).",
      };
    }

    setSession({ accessToken, refreshToken, user: nextUser });
    setUser(nextUser);
    return nextUser;
  }, []);

  /** Thu hồi refresh nếu có, luôn xóa phiên local khi API thất bại và chỉ log câu an toàn không kèm token/password */
  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      console.warn("Không thể thu hồi phiên trên máy chủ. Phiên trên thiết bị đã được xóa.");
    } finally {
      clearSession();
      setUser(null);
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  /** Lưu nguyên cặp token mới sau đổi mật khẩu, BE đã thu hồi version và mọi refresh của phiên cũ */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const pair = await authService.changePassword(currentPassword, newPassword);
    if (!pair?.accessToken || !pair?.refreshToken || !pair?.user) throw new Error("Phản hồi đổi mật khẩu không hợp lệ.");
    setSession(pair);
    setUser(pair.user);
    return pair.user;
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    changePassword,
    role: user?.role ?? null,
    mustChangePassword: !!user?.mustChangePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Lấy trạng thái xác thực trong cây provider, báo lỗi cấu hình giao diện bằng tiếng Việt nếu dùng ngoài phạm vi */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được sử dụng bên trong AuthProvider.");
  return ctx;
};
