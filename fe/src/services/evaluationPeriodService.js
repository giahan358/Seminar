import apiClient from "./apiClient";

export const evaluationPeriodService = {
  // Lấy danh sách kỳ thi
  getEvaluationPeriods: (params) => {
    return apiClient.get("/evaluation-periods", { params });
  },

  // Tạo kỳ thi mới (Dành cho Admin)
  createEvaluationPeriod: (data) => {
    return apiClient.post("/evaluation-periods", data);
  },
};