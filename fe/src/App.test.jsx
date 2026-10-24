import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App.jsx";

describe("App", () => {
  it("shows the login page for unauthenticated users", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Đăng Nhập Hệ Thống" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Đăng nhập" }),
    ).toBeInTheDocument();
  });
});
