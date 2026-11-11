import { normalizeApiError } from "./apiError";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY;

/** Phân biệt lỗi đã dịch của ứng dụng với lỗi DOM/network thô để lớp ngoài chỉ hiển thị câu đã kiểm soát */
class PushError extends Error {}

/** Đổi khóa VAPID URL-safe thành byte cho browser; dữ liệu cấu hình sai sẽ được lớp bật Push chuyển thành câu an toàn */
function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

/** Gửi JSON với token đúng người nhận, chuẩn hóa lỗi HTTP/network và không đưa raw response hoặc subscription vào thông báo */
async function requestJson(path, accessToken, options = {}) {
  let response;
  try {
    response = await fetch(`${apiUrl}/api/v1${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new PushError("Không thể kết nối máy chủ thông báo đẩy. Vui lòng thử lại.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const safe = normalizeApiError({ response: { status: response.status, data: payload } });
    throw new PushError(safe.message);
  }
  if (response.status === 204) return null;
  try { return await response.json(); }
  catch { throw new PushError("Phản hồi máy chủ thông báo đẩy không hợp lệ."); }
}

/** Kiểm phiên, khả năng browser và quyền nhận Push trước khi đăng ký subscription thật với backend, chỉ trả khi lưu thành công */
export async function enableWebPush(accessToken) {
  if (!accessToken) throw new PushError("Bạn cần đăng nhập trước khi bật thông báo đẩy.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new PushError("Trình duyệt này không hỗ trợ thông báo đẩy.");
  }
  if (!vapidPublicKey) throw new PushError("Chưa cấu hình khóa công khai cho thông báo đẩy.");
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new PushError("Bạn chưa cấp quyền nhận thông báo đẩy.");
    const registration = await navigator.serviceWorker.register("/sw.js");
    const key = await requestJson("/notifications/web-push/public-key");
    if (key?.publicKey !== vapidPublicKey) {
      throw new PushError("Khóa thông báo đẩy của giao diện và máy chủ chưa khớp.");
    }
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    await requestJson("/notifications/web-push/subscriptions", accessToken, {
      method: "POST", body: JSON.stringify(subscription.toJSON()),
    });
    return subscription;
  } catch (error) {
    if (error instanceof PushError) throw error;
    throw new PushError("Không thể bật thông báo đẩy trên thiết bị. Vui lòng kiểm tra quyền và thử lại.");
  }
}

/** Thu hồi subscription ở backend trước khi hủy tại browser; không có đăng ký thì kết thúc mà không báo lỗi giả */
export async function disableWebPush(accessToken) {
  if (!accessToken) throw new PushError("Bạn cần đăng nhập trước khi tắt thông báo đẩy.");
  if (!("serviceWorker" in navigator)) throw new PushError("Trình duyệt này không hỗ trợ thông báo đẩy.");
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await requestJson("/notifications/web-push/subscriptions/current", accessToken, {
      method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  } catch (error) {
    if (error instanceof PushError) throw error;
    throw new PushError("Không thể tắt thông báo đẩy trên thiết bị. Vui lòng thử lại.");
  }
}
