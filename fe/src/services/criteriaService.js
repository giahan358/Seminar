import apiClient from "./apiClient";

export const criteriaService = {
  // Lấy danh sách tiêu chí của 1 kỳ thi
  getCriteria: (periodId, params) => {
    return apiClient.get(`/evaluation-periods/${periodId}/criteria`, { params });
  },

  // Tạo tiêu chí mới
  createCriteria: (periodId, data) => {
    return apiClient.post(`/evaluation-periods/${periodId}/criteria`, data);
  },
};