import axios from "axios";
import { getAccessToken, clearSession } from "./session";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1`,         
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});


apiClient.interceptors.response.use(
  (response) => {
    if (response.status === 204) return null;
    if (response.config.responseType === "blob") return response;
    // theo contract đã chốt: { data, meta } | mảng trực tiếp
    return response.data?.data ?? response.data;
  },
  (error) => {
    const status  = error.response?.status;
    const payload = error.response?.data;

if (status === 401) {
  const url = error.config?.url ?? "";
  const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/refresh");
  if (!isAuthEndpoint) {
    clearSession();
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
}

return Promise.reject({
  status,
  code:        payload?.code ?? null,
  message:     payload?.message ?? (status ? `Lỗi ${status}` : "Lỗi kết nối"),
  fieldErrors: payload?.details ?? null,   // contract: details
  cause:       error,
});
  }
);

export default apiClient;