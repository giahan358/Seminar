// src/services/authService.js
import apiClient from "./apiClient";

export const authService = {
  // public
  login: (username, password) =>
    apiClient.post("/auth/login", { username, password }),

  refresh: (refreshToken) =>
    apiClient.post("/auth/refresh", { refreshToken }),

  logout: (refreshToken) =>
    apiClient.post("/auth/logout", { refreshToken }),

  // cần Bearer
  getMe: () =>
    apiClient.get("/auth/me"),

  changePassword: (currentPassword, newPassword) =>
    apiClient.post("/auth/change-password", { currentPassword, newPassword }),
};