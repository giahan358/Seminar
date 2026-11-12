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

// ================= MOCK DATA CHO LUỒNG HỒ SƠ THI ĐUA =================

// Tiêu chí mẫu
const MOCK_CRITERIA = [
  { criterionId: "crit-1", code: "1.1", name: "Công tác tuyên truyền, giáo dục chính trị tư tưởng", maxScore: 15, evidenceRequirement: "Báo cáo, hình ảnh", evidenceRequired: true },
  { criterionId: "crit-2", code: "1.2", name: "Hoạt động tình nguyện, hiến máu", maxScore: 10, evidenceRequirement: "Ảnh minh chứng", evidenceRequired: true },
  { criterionId: "crit-3", code: "2.1", name: "Phong trào 'Tuổi trẻ sáng tạo'", maxScore: 10, evidenceRequirement: "Báo cáo kết quả", evidenceRequired: true },
  { criterionId: "crit-4", code: "2.2", name: "Hoạt động văn hóa, thể thao", maxScore: 10, evidenceRequirement: "Kế hoạch, hình ảnh", evidenceRequired: false },
  { criterionId: "crit-5", code: "3.1", name: "Quản lý đoàn viên", maxScore: 15, evidenceRequirement: "Sổ đoàn viên", evidenceRequired: true },
  { criterionId: "crit-6", code: "3.2", name: "Sinh hoạt chi đoàn định kỳ", maxScore: 10, evidenceRequirement: "Biên bản sinh hoạt", evidenceRequired: true },
  { criterionId: "crit-7", code: "4.1", name: "Công tác phát triển Đảng viên", maxScore: 15, evidenceRequirement: "Danh sách, quyết định", evidenceRequired: true },
  { criterionId: "crit-8", code: "4.2", name: "Đào tạo, bồi dưỡng cán bộ Đoàn", maxScore: 10, evidenceRequirement: "Chứng nhận, báo cáo", evidenceRequired: false },
  { criterionId: "crit-9", code: "5.1", name: "Phối hợp với các tổ chức trong đơn vị", maxScore: 10, evidenceRequirement: "Kế hoạch phối hợp", evidenceRequired: false },
  { criterionId: "crit-10", code: "5.2", name: "Tham gia công tác xã hội", maxScore: 10, evidenceRequirement: "Báo cáo, hình ảnh", evidenceRequired: true },
  { criterionId: "crit-11", code: "6.1", name: "Phong trào 'Thanh niên xung kích'", maxScore: 15, evidenceRequirement: "Kế hoạch, báo cáo", evidenceRequired: true },
  { criterionId: "crit-12", code: "6.2", name: "Chương trình 'Vì đàn em thân yêu'", maxScore: 10, evidenceRequirement: "Hình ảnh, biên bản", evidenceRequired: false },
  { criterionId: "crit-13", code: "7.1", name: "Công tác xây dựng tổ chức Đoàn", maxScore: 15, evidenceRequirement: "Báo cáo tổng kết", evidenceRequired: true },
  { criterionId: "crit-14", code: "7.2", name: "Thi đua khen thưởng nội bộ", maxScore: 10, evidenceRequirement: "Quyết định khen thưởng", evidenceRequired: false },
  { criterionId: "crit-15", code: "8.1", name: "Nộp báo cáo đúng hạn", maxScore: 10, evidenceRequirement: "Xác nhận nộp", evidenceRequired: true },
];

// Hồ sơ giả cho 34 đơn vị
const MOCK_EVALUATIONS = Array.from({ length: 34 }).map((_, i) => {
  const statuses = ["DRAFT", "PENDING_REVIEW", "SUPPLEMENT_REQUESTED", "SUPPLEMENT_SUBMITTED", "FINALIZED"];
  const status = statuses[i % 5];
  const selfTotal = Math.floor(Math.random() * 100) + 180;
  const adminTotal = status === "FINALIZED" ? selfTotal - Math.floor(Math.random() * 30) : null;
  
  return {
    id: `eval-${i + 1}`,
    periodId: "period-2026",
    unit: {
      id: `unit-${i + 1}`,
      code: `COSO-${String(i + 1).padStart(2, "0")}`,
      name: `Đoàn cơ sở ${i + 1}`,
    },
    status,
    submittedAt: status !== "DRAFT" ? new Date(Date.now() - i * 86400000).toISOString() : null,
    supplementDeadline: status === "SUPPLEMENT_REQUESTED" ? new Date(Date.now() + 48 * 3600000).toISOString() : null,
    selfTotalScore: selfTotal,
    adminTotalScore: adminTotal,
    classification: status === "FINALIZED"
      ? (adminTotal / 300 >= 0.9 ? "EXCELLENT" : adminTotal / 300 >= 0.8 ? "GOOD" : adminTotal / 300 >= 0.65 ? "FAIR" : "AVERAGE")
      : null,
    criteria: MOCK_CRITERIA.map((crit, ci) => {
      const selfScore = Math.min(crit.maxScore, Math.floor(Math.random() * crit.maxScore) + 1);
      return {
        ...crit,
        selfScore,
        selfNote: ci % 3 === 0 ? "Đã thực hiện đầy đủ theo kế hoạch." : "",
        adminScore: status === "FINALIZED" || status === "PENDING_REVIEW" ? Math.min(crit.maxScore, selfScore - Math.floor(Math.random() * 3)) : null,
        adminComment: status === "FINALIZED" ? "Đạt yêu cầu." : null,
        needsSupplement: status === "SUPPLEMENT_REQUESTED" && ci % 4 === 0,
        evidences: ci % 2 === 0 ? [
          { id: `ev-${i}-${ci}-1`, kind: "FILE", fileName: "bao-cao.pdf", mimeType: "application/pdf", sizeBytes: 125000, round: "INITIAL", description: "Báo cáo tổng kết" },
          { id: `ev-${i}-${ci}-2`, kind: "FILE", fileName: "hinh-anh.jpg", mimeType: "image/jpeg", sizeBytes: 280000, round: "INITIAL", description: "Hình ảnh hoạt động" },
        ] : ci % 3 === 0 ? [
          { id: `ev-${i}-${ci}-3`, kind: "LINK", externalUrl: "https://example.com/bai-viet", round: "INITIAL", description: "Bài viết hoạt động" },
        ] : [],
      };
    }),
  };
});

// Thông báo giả
const MOCK_NOTIFICATIONS = Array.from({ length: 30 }).map((_, i) => {
  const types = ["DEADLINE_REMINDER", "SUPPLEMENT_REQUEST", "SCORE_FINALIZED", "ADMIN_FEEDBACK", "SYSTEM"];
  const titles = ["Nhắc hạn nộp hồ sơ", "Yêu cầu bổ sung minh chứng", "Điểm đã được chốt", "Phản hồi từ Admin", "Thông báo hệ thống"];
  const contents = [
    "Hạn nộp hồ sơ thi đua còn 24 giờ. Vui lòng hoàn tất.",
    "Admin yêu cầu bổ sung minh chứng cho tiêu chí 1.1, 3.1. Hạn: 48 giờ.",
    "Hồ sơ thi đua của đơn vị đã được chốt điểm chính thức.",
    "Admin đã phản hồi về tiêu chí 2.1. Vui lòng xem chi tiết.",
    "Kỳ thi đua năm 2026 đã được mở. Vui lòng bắt đầu tự chấm.",
  ];
  return {
    id: `notif-${i + 1}`,
    type: types[i % 5],
    title: titles[i % 5],
    content: contents[i % 5],
    isRead: i > 5,
    evaluationId: i % 3 === 0 ? `eval-${(i % 34) + 1}` : null,
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  };
});

// Feedback giả
const MOCK_FEEDBACK = [
  { id: "fb-1", evaluationId: "eval-1", authorId: "u-admin", type: "ADMIN_COMMENT", content: "Tiêu chí 1.1 cần bổ sung thêm báo cáo chi tiết.", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "fb-2", evaluationId: "eval-1", authorId: "u-coso01", type: "UNIT_REPLY", content: "Đơn vị đã bổ sung tài liệu theo yêu cầu.", createdAt: new Date(Date.now() - 43200000).toISOString() },
  { id: "fb-3", evaluationId: "eval-1", authorId: "u-admin", type: "ADMIN_COMMENT", content: "Đã nhận được. Cảm ơn đơn vị.", createdAt: new Date(Date.now() - 3600000).toISOString() },
];

// Status history giả
const MOCK_STATUS_HISTORY = [
  { fromStatus: "DRAFT", toStatus: "PENDING_REVIEW", actorId: null, comment: "Hết hạn tự chấm, hệ thống tự khóa.", createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
  { fromStatus: "PENDING_REVIEW", toStatus: "SUPPLEMENT_REQUESTED", actorId: "u-admin", comment: "Yêu cầu bổ sung tiêu chí 1.1, 3.1", createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { fromStatus: "SUPPLEMENT_REQUESTED", toStatus: "SUPPLEMENT_SUBMITTED", actorId: "u-coso01", comment: null, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
];

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

  // ---------- UNIT: Lấy hồ sơ của đơn vị mình ----------
  http.get("*/api/v1/evaluations", ({ request }) => {
    const username = usernameFromAuth(request);
    const record = username && USERS[username];
    const unitId = record?.user?.unitId || "unit-01";
    const unitEvals = MOCK_EVALUATIONS.filter(e => e.unit.id === unitId);

    return HttpResponse.json({
      items: unitEvals.length > 0 ? unitEvals : [MOCK_EVALUATIONS[0]], // Fallback cho demo
      total: unitEvals.length || 1,
      page: 1,
      pageSize: 20,
    });
  }),

  // ---------- Lấy chi tiết 1 hồ sơ ----------
  http.get("*/api/v1/evaluations/:evaluationId", ({ params }) => {
    const evaluation = MOCK_EVALUATIONS.find(e => e.id === params.evaluationId);
    if (!evaluation) {
      return HttpResponse.json(
        { statusCode: 404, code: "NOT_FOUND", message: "Không tìm thấy hồ sơ", details: [] },
        { status: 404 }
      );
    }
    return HttpResponse.json(evaluation);
  }),

  // ---------- Lưu điểm tự chấm ----------
  http.put("*/api/v1/evaluations/:evaluationId/scores/:criterionId/self", async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      evaluationId: params.evaluationId,
      criterionId: params.criterionId,
      selfScore: body.selfScore,
      selfNote: body.selfNote,
      updatedAt: new Date().toISOString(),
    });
  }),

  // ---------- Upload URLs ----------
  http.post("*/api/v1/evaluations/:evaluationId/evidences/upload-urls", async ({ request }) => {
    const body = await request.json();
    const items = (body.items || []).map((item, i) => ({
      uploadUrl: `https://storage.example.com/mock-upload-${Date.now()}-${i}`,
      method: "PUT",
      requiredHeaders: { "Content-Type": item.mimeType },
      storagePath: `private/evaluations/mock-${Date.now()}-${i}.${item.fileName.split('.').pop()}`,
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    }));
    return HttpResponse.json({ items });
  }),

  // ---------- Lưu metadata minh chứng ----------
  http.post("*/api/v1/evaluations/:evaluationId/evidences", async ({ request }) => {
    const body = await request.json();
    const items = (body.items || []).map((item, i) => ({
      id: `ev-new-${Date.now()}-${i}`,
      kind: item.kind,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      externalUrl: item.externalUrl,
      round: item.round,
      description: item.description,
      previewStatus: "NOT_REQUIRED",
      createdAt: new Date().toISOString(),
    }));
    return HttpResponse.json({ items }, { status: 201 });
  }),

  // ---------- Preview minh chứng ----------
  http.get("*/api/v1/evaluations/:evaluationId/evidences/:evidenceId/preview", ({ params }) => {
    return HttpResponse.json({
      url: `https://via.placeholder.com/800x600.png?text=Preview+${params.evidenceId}`,
      downloadUrl: `https://example.com/download/${params.evidenceId}`,
    });
  }),

  // ---------- Nộp bổ sung ----------
  http.post("*/api/v1/evaluations/:evaluationId/supplement-submit", ({ params }) => {
    return HttpResponse.json({
      evaluationId: params.evaluationId,
      status: "SUPPLEMENT_SUBMITTED",
    });
  }),

  // ---------- Feedback ----------
  http.get("*/api/v1/evaluations/:evaluationId/feedback", ({ params }) => {
    return HttpResponse.json({
      items: MOCK_FEEDBACK.filter(fb => fb.evaluationId === params.evaluationId || params.evaluationId === "eval-1"),
    });
  }),

  http.post("*/api/v1/evaluations/:evaluationId/feedback", async ({ request, params }) => {
    const body = await request.json();
    const newFb = {
      id: `fb-${Date.now()}`,
      evaluationId: params.evaluationId,
      authorId: usernameFromAuth(request) || "u-unknown",
      type: body.type,
      content: body.content,
      createdAt: new Date().toISOString(),
    };
    MOCK_FEEDBACK.push(newFb);
    return HttpResponse.json(newFb, { status: 201 });
  }),

  // ---------- Status history ----------
  http.get("*/api/v1/evaluations/:evaluationId/status-history", () => {
    return HttpResponse.json({ items: MOCK_STATUS_HISTORY });
  }),

  // ---------- ADMIN: Danh sách hồ sơ ----------
  http.get("*/api/v1/admin/evaluations", ({ request }) => {
    const url = new URL(request.url);
    const periodId = url.searchParams.get("periodId");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search") || "";
    const page = Number(url.searchParams.get("page")) || 1;
    const pageSize = Number(url.searchParams.get("pageSize")) || 20;

    let filtered = MOCK_EVALUATIONS;
    if (periodId) filtered = filtered.filter(e => e.periodId === periodId);
    if (status) filtered = filtered.filter(e => e.status === status);
    if (search) filtered = filtered.filter(e => 
      e.unit.name.toLowerCase().includes(search.toLowerCase()) ||
      e.unit.code.toLowerCase().includes(search.toLowerCase())
    );

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json({ items, total: filtered.length, page, pageSize });
  }),

  // ---------- ADMIN: Chấm điểm ----------
  http.put("*/api/v1/admin/evaluations/:evaluationId/scores/:criterionId/review", async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      evaluationId: params.evaluationId,
      criterionId: params.criterionId,
      adminScore: body.adminScore,
      adminComment: body.adminComment,
      needsSupplement: body.needsSupplement,
      reviewedAt: new Date().toISOString(),
    });
  }),

  // ---------- ADMIN: Yêu cầu bổ sung ----------
  http.post("*/api/v1/admin/evaluations/:evaluationId/supplement-request", async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      evaluationId: params.evaluationId,
      status: "SUPPLEMENT_REQUESTED",
      supplementDeadline: new Date(Date.now() + 48 * 3600000).toISOString(),
      feedbackId: `fb-${Date.now()}`,
    });
  }),

  // ---------- ADMIN: Chốt hồ sơ ----------
  http.post("*/api/v1/admin/evaluations/:evaluationId/finalize", ({ params }) => {
    return HttpResponse.json({
      evaluationId: params.evaluationId,
      status: "FINALIZED",
      finalizedAt: new Date().toISOString(),
    });
  }),

  // ================= THÔNG BÁO =================

  http.get("*/api/v1/notifications", ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page")) || 1;
    const pageSize = Number(url.searchParams.get("pageSize")) || 20;
    const isRead = url.searchParams.get("isRead");

    let filtered = [...MOCK_NOTIFICATIONS];
    if (isRead === "true") filtered = filtered.filter(n => n.isRead);
    if (isRead === "false") filtered = filtered.filter(n => !n.isRead);

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json({ items, total: filtered.length, page, pageSize });
  }),

  http.patch("*/api/v1/notifications/:notificationId/read", ({ params }) => {
    const notif = MOCK_NOTIFICATIONS.find(n => n.id === params.notificationId);
    if (notif) notif.isRead = true;
    return HttpResponse.json({ isRead: true });
  }),

  http.post("*/api/v1/notifications/read-all", () => {
    let count = 0;
    MOCK_NOTIFICATIONS.forEach(n => { if (!n.isRead) { n.isRead = true; count++; } });
    return HttpResponse.json({ updated: count });
  }),

  http.get("*/api/v1/notifications/unread-count", () => {
    const count = MOCK_NOTIFICATIONS.filter(n => !n.isRead).length;
    return HttpResponse.json({ count });
  }),
];
