import apiClient from "./apiClient";

export const unitService = {
  // Lấy danh sách đơn vị (phân trang, tìm kiếm)
  getUnits: (params) => {
    return apiClient.get("/units", { params });
  },

  // Tạo đơn vị mới
  createUnit: (data) => {
    return apiClient.post("/units", data);
  },
};