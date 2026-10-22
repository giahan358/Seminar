import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    let cancelled = false;

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
          accessToken,
          refreshToken: getRefreshToken(),
          user: fresh,
        });
      } catch (err) {
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
    const onUnauthorized = () => {
      clearSession();
      setUser(null);
      navigate("/login", {
        replace: true,
        state: { message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." },
      });
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [navigate]);

  // ---------- Login ----------
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

  // ---------- Logout ----------
  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch (e) {
      console.warn("Logout API failed, clearing local session anyway", e);
    } finally {
      clearSession();
      setUser(null);
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // ---------- Change password ----------
  // contract: thành công trả hồ sơ user an toàn (shape /auth/me)
  // và thu hồi refresh token cũ → client cần đăng nhập lại nếu session bị thu hồi
  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const updatedUser = await authService.changePassword(
        currentPassword,
        newPassword
      );

      // cập nhật user mới + giữ nguyên token hiện tại (nếu backend còn cho dùng)
      if (updatedUser?.id) {
        setUser(updatedUser);
        setSession({
          accessToken: getAccessToken(),
          refreshToken: getRefreshToken(),
          user: updatedUser,
        });
      }

      // Nếu backend thu hồi luôn access token hiện tại → phải login lại.
      // clearSession(); setUser(null);
      // navigate("/login", { replace: true, state: { message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." } });

      return updatedUser;
    },
    [navigate]
  );

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

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};