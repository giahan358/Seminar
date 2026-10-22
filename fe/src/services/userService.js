import apiClient from "./apiClient";

export const userService = {
  // Lấy danh sách user (có phân trang, tìm kiếm)
  getUsers: (params) => {
    // params: { page, pageSize, search }
    return apiClient.get("/users", { params });
  },

  // Tạo user mới
  createUser: (data) => {
    return apiClient.post("/users", data);
  },

  // Khóa/Mở khóa tài khoản
  toggleUserStatus: (id, isActive) => {
    return apiClient.patch(`/users/${id}`, { isActive });
  },
};