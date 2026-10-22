import { http, HttpResponse } from "msw";

// ================= DỮ LIỆU GIẢ =================

const evaluationPeriods = [
  {
    id: "period-2026",
    name: "Thi đua công tác Đoàn năm 2026",
    year: 2026,
    phase: "SELF_EVALUATION",
    selfEvalStart: "2026-10-01T00:00:00.000Z",
    selfEvalDeadline: "2026-11-01T23:59:59.000Z",
    supplementHours: 48,
    maxTotalScore: 300,
  },
];

// tài khoản giả
const USERS = {
  admin: {
    password: "admin123",
    user: {
      id: "u-admin",
      username: "admin",
      fullName: "Quản trị viên",
      role: "ADMIN",
      unitId: null,
      mustChangePassword: false,
    },
  },
  coso01: {
    password: "coso123",
    user: {
      id: "u-coso01",
      username: "coso01",
      fullName: "Cơ sở demo 01",
      role: "UNIT",
      unitId: "unit-01",
      mustChangePassword: true, 
    },
  },
};


const REFRESH_STORE = new Map(); // refreshToken -> username
let refreshSeq = 1;

function issueTokens(username) {
  const accessToken = `access-${username}-${Date.now()}`;
  const refreshToken = `refresh-${username}-${refreshSeq++}`;
  REFRESH_STORE.set(refreshToken, username);
  return { accessToken, refreshToken, tokenType: "Bearer", expiresIn: 900 };
}

// token giả dạng: "access-<username>-<ts>"
function usernameFromAuth(request) {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer access-([^-]+)-/);
  return m?.[1] ?? null;
}

function unauthorized(code = "UNAUTHORIZED", message = "Token không hợp lệ") {
  return HttpResponse.json(
    { statusCode: 401, code, message, details: [] },
    { status: 401 }
  );
}

// ================= HANDLERS =================

export const handlers = [
  // ---------- AUTH ----------

  http.post("*/api/v1/auth/login", async ({ request }) => {
    const body = await request.json();
    const record = USERS[body?.username];
    if (!record || record.password !== body?.password) {
      return HttpResponse.json(
        { statusCode: 401, code: "INVALID_CREDENTIALS", message: "Sai tên đăng nhập hoặc mật khẩu", details: [] },
        { status: 401 }
      );
    }
    const tokens = issueTokens(body.username);
    return HttpResponse.json({ ...tokens, user: record.user });
  }),

  http.get("*/api/v1/auth/me", ({ request }) => {
    const username = usernameFromAuth(request);
    const record = username && USERS[username];
    if (!record) return unauthorized();
    return HttpResponse.json(record.user);
  }),

  http.post("*/api/v1/auth/refresh", async ({ request }) => {
    const { refreshToken } = await request.json();
    const username = REFRESH_STORE.get(refreshToken);
    if (!username) return unauthorized("INVALID_REFRESH_TOKEN", "Refresh token không hợp lệ");
    REFRESH_STORE.delete(refreshToken);
    const tokens = issueTokens(username);
    return HttpResponse.json({ ...tokens, user: USERS[username].user });
  }),

  http.post("*/api/v1/auth/logout", async ({ request }) => {
    const { refreshToken } = await request.json().catch(() => ({}));
    if (refreshToken) REFRESH_STORE.delete(refreshToken);
    return HttpResponse.json({ success: true });
  }),

  http.post("*/api/v1/auth/change-password", async ({ request }) => {
    const username = usernameFromAuth(request);
    const record = username && USERS[username];
    if (!record) return unauthorized();

    const { currentPassword, newPassword } = await request.json();

    if (currentPassword !== record.password) {
      return HttpResponse.json(
        { statusCode: 401, code: "INVALID_CREDENTIALS", message: "Mật khẩu hiện tại không đúng", details: [] },
        { status: 401 }
      );
    }
    if (!newPassword || newPassword.length < 6) {
      return HttpResponse.json(
        { statusCode: 400, code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ", details: [{ field: "newPassword", message: "Mật khẩu tối thiểu 6 ký tự" }] },
        { status: 400 }
      );
    }

    record.password = newPassword;
    record.user.mustChangePassword = false;
    for (const [k, v] of REFRESH_STORE) if (v === username) REFRESH_STORE.delete(k);

    return HttpResponse.json(record.user);
  }),

  // ---------- DASHBOARD ----------

  http.get("*/api/v1/admin/dashboard", ({ request }) => {
    const url = new URL(request.url);
    const periodId = url.searchParams.get("periodId") || "period-2026"; 
    
    return HttpResponse.json({
      periodId: periodId,
      totalUnits: 34,
      submittedCount: 12,
      notSubmittedCount: 18,
      supplementPendingCount: 4,
      progressPercent: 35.29,
    });
  }),

  http.get("*/api/v1/admin/dashboard/deductions", ({ request }) => {
    return HttpResponse.json({
      items: [
        { criterionId: "c1", code: "1.1", name: "Công tác tuyên truyền", unitsDeducted: 15, totalPointsDeducted: 25.5 },
        { criterionId: "c2", code: "2.3", name: "Hoạt động tình nguyện", unitsDeducted: 12, totalPointsDeducted: 18.0 },
        { criterionId: "c3", code: "3.1", name: "Quản lý đoàn viên", unitsDeducted: 8, totalPointsDeducted: 10.0 },
      ]
    });
  }),


  // ---------- USERS ----------
  http.get("*/api/v1/users", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page")) || 1;
    const pageSize = Number(url.searchParams.get("pageSize")) || 20;
    const search = url.searchParams.get("search") || "";

    // Tạo giả 34 users
    const allUsers = Array.from({ length: 34 }).map((_, i) => ({
      id: `u-${i}`,
      username: `coso${String(i + 1).padStart(2, "0")}`,
      fullName: `Cơ sở Đoàn ${i + 1}`,
      role: i === 0 ? "ADMIN" : "UNIT",
      unitName: i === 0 ? null : `Đơn vị ${i + 1}`,
      isActive: i % 5 !== 0, // Cứ 5 user thì có 1 user bị khóa
    }));

    // Lọc theo search
    const filtered = allUsers.filter(u => 
      u.username.toLowerCase().includes(search.toLowerCase()) || 
      u.fullName.toLowerCase().includes(search.toLowerCase())
    );

    // Phân trang
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      items,
      total: filtered.length,
      page,
      pageSize
    });
  }),


    // ---------- UNITS ----------
  http.get("*/api/v1/units", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page")) || 1;
    const pageSize = Number(url.searchParams.get("pageSize")) || 20;
    const search = url.searchParams.get("search") || "";

    // Tạo giả 34 đơn vị
    const allUnits = Array.from({ length: 34 }).map((_, i) => {
      const types = ["CONG_AN_QUAN_HUYEN", "PHONG_NGHIEP_VU", "DON_VI_TRUC_THUOC"];
      return {
        id: `unit-${i + 1}`,
        code: `COSO-${String(i + 1).padStart(2, "0")}`,
        name: `Đoàn cơ sở ${i + 1}`,
        unitType: types[i % 3], // Xoay vòng 3 loại đơn vị
        isActive: true,
      };
    });

    const filtered = allUnits.filter(u => 
      u.name.toLowerCase().includes(search.toLowerCase()) || 
      u.code.toLowerCase().includes(search.toLowerCase())
    );

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json({ items, total: filtered.length, page, pageSize });
  }),

    // ---------- AUDIT LOGS ----------
  http.get("*/api/v1/audit-logs", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page")) || 1;
    const pageSize = Number(url.searchParams.get("pageSize")) || 20;

    // Tạo giả 50 dòng lịch sử
    const actions = ["Cập nhật điểm", "Thêm tài khoản", "Xóa đơn vị", "Đổi trạng thái"];
    const entities = ["Hồ sơ Đoàn A", "Tài khoản coso01", "Đơn vị Quận 1", "Hồ sơ Đoàn B"];
    
    const allLogs = Array.from({ length: 50 }).map((_, i) => ({
      id: `log-${i}`,
      actorName: i % 2 === 0 ? "Quản trị viên" : "Admin cấp 2",
      action: actions[i % 4],
      entity: entities[i % 4],
      detail: "Thay đổi từ 8 điểm thành 7 điểm", // Chi tiết ngắn gọn
      ipAddress: "192.168.1." + (i + 10),
      createdAt: new Date(Date.now() - i * 3600000).toISOString(), // Lùi thời gian 1 giờ mỗi dòng
    }));

    const start = (page - 1) * pageSize;
    const items = allLogs.slice(start, start + pageSize);

    return HttpResponse.json({
      items,
      total: allLogs.length,
      page,
      pageSize,
    });
  }),


    // ---------- AUDIT LOGS STATS ----------
  http.get("*/api/v1/audit-logs/stats", ({ request }) => {
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "7d";

    let data = [];
    if (range === "7d") {
      data = [
        { label: "T2", count: 12 }, { label: "T3", count: 19 }, { label: "T4", count: 5 },
        { label: "T5", count: 25 }, { label: "T6", count: 32 }, { label: "T7", count: 10 }, { label: "CN", count: 8 }
      ];
    } else {
      data = Array.from({ length: 10 }).map((_, i) => ({
        label: `Tuần ${i + 1}`,
        count: Math.floor(Math.random() * 50) + 10
      }));
    }
    return HttpResponse.json({ items: data });
  }),

  // ---------- CREATE EVALUATION PERIOD ----------
  // ---------- CREATE EVALUATION PERIOD ----------
  http.post("*/api/v1/evaluation-periods", async ({ request }) => {
    const body = await request.json();
    
    const newPeriod = {
      id: `period-${Date.now()}`,
      year: body.year,
      name: body.name,
      phase: "SETUP",
      maxTotalScore: body.maxTotalScore,
      selfEvalStart: body.selfEvalStart,
      selfEvalDeadline: body.selfEvalDeadline,
      supplementHours: body.supplementHours,
      createdAt: new Date().toISOString(),
    };

    // 🔥 QUAN TRỌNG: Thêm kỳ thi mới vào mảng để GET có thể lấy được
    evaluationPeriods.push(newPeriod);

    return HttpResponse.json(newPeriod, { status: 201 });
  }),

  // ---------- CRITERIA ----------
  http.get("*/api/v1/evaluation-periods/:periodId/criteria", ({ request }) => {
    // Tạo giả 15 tiêu chí (để test phân trang)
    const allCriteria = Array.from({ length: 15 }).map((_, i) => ({
      id: `crit-${i + 1}`,
      periodId: "period-2026",
      parentId: null,
      code: `${i + 1}.0`,
      name: `Tiêu chí đánh giá số ${i + 1}`,
      description: "Nội dung đánh giá chi tiết...",
      maxScore: 20,
      evidenceRequirement: "Nộp báo cáo",
      allowText: true,
      allowFile: true,
      allowLink: true,
      evidenceRequired: true,
      sortOrder: i + 1,
    }));

    return HttpResponse.json({ items: allCriteria, total: allCriteria.length });
  }),

  http.post("*/api/v1/evaluation-periods/:periodId/criteria", async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: `crit-${Date.now()}`,
      periodId: params.periodId,
      ...body,
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  // ---------- EVALUATION PERIODS ----------
  http.get("*/api/v1/evaluation-periods", ({ request }) => {
    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    const phase = url.searchParams.get("phase");
    const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize")) || 20, 1), 100);

    const filteredPeriods = evaluationPeriods.filter(
      (period) => (!year || String(period.year) === year) && (!phase || period.phase === phase)
    );
    const start = (page - 1) * pageSize;

    return HttpResponse.json({
      items: filteredPeriods.slice(start, start + pageSize),
      page,
      pageSize,
      total: filteredPeriods.length,
    });
  }),
];