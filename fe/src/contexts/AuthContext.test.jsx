import { StrictMode } from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { server } from "../mocks/server";
import { AuthProvider, useAuth } from "./AuthContext";
import { setSession, getAccessToken, getRefreshToken } from "../services/session";

/** Hiển thị trạng thái provider thật và nút đổi mật khẩu, không gán state trực tiếp thay cho luồng API */
function Probe() {
  const auth = useAuth();
  return <><span>{auth.loading ? "Đang tải" : auth.user?.fullName ?? "Chưa đăng nhập"}</span><button onClick={() => auth.changePassword("123456", "MatKhauMoi98")}>Đổi mật khẩu</button></>;
}
/** Render StrictMode để effect phục hồi bị hủy rồi chạy lại như môi trường phát triển thật */
function mount() { return render(<StrictMode><MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter></StrictMode>); }
/** Dọn component và phiên để các trường hợp reload/đổi mật khẩu không truyền trạng thái sang nhau */
afterEach(() => { cleanup(); sessionStorage.clear(); });
/** Reload phải hoàn tất loading dù StrictMode hủy effect đầu tiên, token hết hạn được refresh rồi không bị ghi đè */
it("khôi phục phiên hết hạn trong StrictMode và giữ cặp token đã refresh", async () => {
  setSession({ accessToken: "cu", refreshToken: "r-cu", user: { id: "unit", fullName: "Bản lưu" } });
  server.use(http.get("*/api/v1/auth/me", async ({ request }) => {
    await delay(10); return request.headers.get("authorization") === "Bearer moi" ? HttpResponse.json({ id: "unit", fullName: "Hồ sơ mới" }) : HttpResponse.json({}, { status: 401 });
  }), http.post("*/api/v1/auth/refresh", () => HttpResponse.json({ accessToken: "moi", refreshToken: "r-moi", user: { id: "unit", fullName: "Hồ sơ mới" } })));
  mount(); expect(await screen.findByText("Hồ sơ mới")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("Đang tải")).not.toBeInTheDocument());
  expect(getAccessToken()).toBe("moi"); expect(getRefreshToken()).toBe("r-moi");
});
/** Response đổi mật khẩu có token mới phải thay cả cặp và hồ sơ, không tiếp tục dùng phiên cũ đã bị BE thu hồi */
it("lưu cặp token mới khi đổi mật khẩu", async () => {
  setSession({ accessToken: "cu", refreshToken: "r-cu", user: { id: "unit" } });
  server.use(http.get("*/api/v1/auth/me", () => HttpResponse.json({ id: "unit", fullName: "Chờ đổi" })),
    http.post("*/api/v1/auth/change-password", () => HttpResponse.json({ accessToken: "sau-doi", refreshToken: "r-sau-doi", user: { id: "unit", fullName: "Đã đổi", mustChangePassword: false } })));
  mount(); await screen.findByText("Chờ đổi"); fireEvent.click(screen.getByText("Đổi mật khẩu"));
  await screen.findByText("Đã đổi"); expect(getAccessToken()).toBe("sau-doi"); expect(getRefreshToken()).toBe("r-sau-doi");
});

/** Hủy component khi me đang chờ không được ghi lại hồ sơ vào storage, tránh effect cũ phục hồi phiên sau unmount */
it("không lưu hồ sơ từ effect đã bị hủy", async () => {
  setSession({ accessToken: "cu", refreshToken: "r-cu", user: { id: "unit", fullName: "Bản lưu" } });
  let resolveResponse;
  const responseGate = new Promise(resolve => { resolveResponse = resolve; });
  server.use(http.get("*/api/v1/auth/me", async () => { await responseGate; return HttpResponse.json({ id: "unit", fullName: "Không được lưu" }); }));
  const view = mount(); view.unmount(); resolveResponse();
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(JSON.parse(sessionStorage.getItem("currentUser")).fullName).toBe("Bản lưu");
});
