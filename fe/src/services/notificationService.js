import apiClient from "./apiClient";

export const notificationService = {
  // Get notifications list (paginated)
  // GET /notifications?page=1&pageSize=20&isRead=false
  getNotifications: (params) => apiClient.get("/notifications", { params }),

  // Mark notification as read
  // PATCH /notifications/:notificationId/read
  markAsRead: (notificationId) => apiClient.patch(`/notifications/${notificationId}/read`),

  // Mark all as read
  // POST /notifications/read-all
  markAllAsRead: () => apiClient.post("/notifications/read-all"),

  // Get unread count
  // GET /notifications/unread-count
  getUnreadCount: () => apiClient.get("/notifications/unread-count"),
};
