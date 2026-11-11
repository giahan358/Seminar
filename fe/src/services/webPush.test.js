import { afterEach, expect, it, vi } from "vitest";
import { disableWebPush, enableWebPush } from "./webPush";

/** Khôi phục browser sau mỗi ca lỗi để các test giao diện khác không dùng nhầm môi trường Push giả của ca trước */
afterEach(() => { vi.unstubAllGlobals(); });

/** Thiếu phiên phải bị từ chối trước mọi request, không báo thành công khi chưa xác minh người nhận */
it("bật Push yêu cầu đăng nhập bằng câu tiếng Việt", async () => {
  await expect(enableWebPush(null)).rejects.toThrow("Bạn cần đăng nhập trước khi bật thông báo đẩy.");
});

/** Mô phỏng DOMException từ browser, chỉ câu ứng dụng đã dịch được đưa lên UI và không lộ chi tiết nội bộ */
it("lỗi browser khi tắt Push được che an toàn", async () => {
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration: async () => { throw new Error("Lỗi thiết bị SECRET_PROVIDER"); } } });
  await expect(disableWebPush("token-thu")).rejects.toThrow("Không thể tắt thông báo đẩy trên thiết bị. Vui lòng thử lại.");
});

/** Phản hồi lỗi provider không được nối vào Error như trước, và backend thất bại thì subscription tại browser chưa bị hủy */
it("lỗi HTTP khi thu hồi Push không lộ raw response", async () => {
  const unsubscribe = vi.fn();
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => ({ endpoint: "https://push.example.test/device", unsubscribe }) } }) } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ message: "SQL SECRET_PROVIDER" }) }));
  await expect(disableWebPush("token-thu")).rejects.toThrow("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
  expect(unsubscribe).not.toHaveBeenCalled();
});
