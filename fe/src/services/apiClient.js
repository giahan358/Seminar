import axios from "axios";
import { getAccessToken, getRefreshToken, setSession, clearSession } from "./session";
import { normalizeApiError } from "./apiError";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1`, timeout: 15000, headers: { "Content-Type": "application/json" },
});

/** Gắn access token của phiên hiện tại vào request, không sao chép token vào lỗi hoặc thông báo hiển thị */
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Dùng client riêng để refresh không tự đi vào interceptor và chỉ có một lần xoay cho mọi request cùng phiên
const refreshClient = axios.create({ baseURL: `${API_BASE}/api/v1`, timeout: 15000 });
let refreshFlight = null;

/** Xóa phiên và phát sự kiện cho provider khi refresh thất bại, không phát lại request đã thất bại lần hai */
function expireSession() {
  clearSession();
  window.dispatchEvent(new CustomEvent("auth:unauthorized"));
}

/** Gộp refresh cạnh tranh, chỉ lưu kết quả khi chủ phiên chưa logout hoặc đổi credential trong lúc chờ */
async function refreshSession() {
  if (!refreshFlight) {
    const original = getRefreshToken();
    refreshFlight = Promise.resolve().then(async () => {
      try {
        if (!original) throw new Error("Phiên đăng nhập không còn mã làm mới.");
        const response = await refreshClient.post("/auth/refresh", { refreshToken: original });
        const pair = response.data?.data ?? response.data;
        if (getRefreshToken() !== original) throw new Error("Phiên đăng nhập đã thay đổi.");
        if (!pair?.accessToken || !pair?.refreshToken || !pair?.user) throw new Error("Phản hồi làm mới phiên không hợp lệ.");
        setSession(pair);
        window.dispatchEvent(new CustomEvent("auth:updated", { detail: pair.user }));
      } catch (error) {
        if (getRefreshToken() === original) expireSession();
        throw error;
      } finally {
        refreshFlight = null;
      }
    });
  }
  return refreshFlight;
}

apiClient.interceptors.response.use(
  /** Giữ response tải tệp, đổi 204 thành null và bóc data theo giao ước đang có để không làm đổi API của màn hình */
  (response) => {
    if (response.status === 204) return null;
    if (response.config.responseType === "blob") return response;
    return response.data?.data ?? response.data;
  },
  /** Với 401 nghiệp vụ chỉ retry một lần, dùng token vừa xoay nếu request cũ về trễ và không refresh các endpoint Auth */
  async (error) => {
    const config = error.config;
    const isAuth = /\/auth\/(login|refresh|logout|change-password)/.test(config?.url ?? "");
    if (error.response?.status === 401 && config && !isAuth) {
      if (config._authRetry) {
        expireSession();
      } else {
        config._authRetry = true;
        try {
          const current = getAccessToken();
          if (!current || config.headers?.Authorization === `Bearer ${current}`) await refreshSession();
          return apiClient.request(config);
        } catch {
          return Promise.reject(normalizeApiError(error));
        }
      }
    }
    return Promise.reject(normalizeApiError(error));
  },
);
export default apiClient;
