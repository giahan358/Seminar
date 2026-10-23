import apiClient from "./apiClient";

export const auditLogService = {
  // Lấy danh sách lịch sử thao tác
  getAuditLogs: (params) => {
    // params: { page, pageSize }
    return apiClient.get("/audit-logs", { params });
  },

  getAuditLogStats: (params) => {
    return apiClient.get("/audit-logs/stats", { params });
  },
};
