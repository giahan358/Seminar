import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

// Chỉ mô phỏng lỗi đã chuẩn hóa tại ranh giới component, đây không phải bằng chứng thay cho HTTP/DB tích hợp thật
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: null, login: async () => {
  throw { code: "VALIDATION_ERROR", message: "Dữ liệu gửi lên không hợp lệ.",
    fieldErrors: [{ field: "username", messages: ["Tên đăng nhập không đáp ứng điều kiện."] }] };
} }) }));

/** Gửi form rồi kiểm câu tiếng Việt tại ô username, dành tối đa 20 giây cho render Ant Design trên máy chạy build đồng thời */
it("form đăng nhập hiển thị lỗi trường đã dịch từ API", async () => {
  render(<MemoryRouter><LoginPage /></MemoryRouter>);
  fireEvent.change(screen.getByPlaceholderText("Tên đăng nhập (vd: coso01)"), { target: { value: "admin" } });
  fireEvent.change(screen.getByPlaceholderText("Mật khẩu (vd: coso123)"), { target: { value: "mat-khau-thu" } });
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
  expect(await screen.findByText("Tên đăng nhập không đáp ứng điều kiện.", {}, { timeout: 10000 })).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Tên đăng nhập (vd: coso01)")).toHaveAttribute("aria-invalid", "true");
}, 20000);
