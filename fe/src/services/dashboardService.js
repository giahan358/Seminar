import apiClient from "./apiClient";

export const dashboardService = {
  getDashboardStats: (periodId) => {
    return apiClient.get("/admin/dashboard", { params: { periodId } });
  },
  
  // Hàm mới: Lấy dữ liệu tiêu chí bị trừ điểm
  getCriteriaDeductions: (periodId) => {
    return apiClient.get("/admin/dashboard/deductions", { params: { periodId } });
  }
};