import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App.jsx";

describe("App", () => {
  it("shows the frontend starter page and API documentation link", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Đánh giá KPI" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Mở tài liệu API (Swagger)" }),
    ).toHaveAttribute("href", "http://localhost:3000/api/docs");
  });
});
