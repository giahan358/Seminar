import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before running the seed.");
}

const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword) {
  throw new Error("SEED_ADMIN_PASSWORD must be set before creating the seed admin.");
}
const seedAdminPassword: string = adminPassword;

const credentialsFile = process.env.SEED_CREDENTIALS_FILE;
const rotatePasswords = process.env.SEED_ROTATE_PASSWORDS === "true";
const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@seminar.local";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const now = new Date();

const uuid = (number: number): string =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

const units = Array.from({ length: 34 }, (_, index) => {
  const number = index + 1;
  const suffix = String(number).padStart(2, "0");
  return {
    id: uuid(101 + index),
    code: `COSO-DEMO-${suffix}`,
    name: `Cơ sở Đoàn demo ${suffix}`,
    username: `coso${suffix}`,
  };
});

const periods = [
  {
    id: uuid(1),
    year: 2026,
    name: "Đợt thi đua năm 2026",
    phase: "FIRST_REVIEW",
    maxTotalScore: 300,
    selfEvalStart: new Date("2026-01-15T00:00:00.000Z"),
    selfEvalDeadline: new Date("2026-03-15T23:59:59.000Z"),
    supplementHours: 48,
    publishedAt: new Date("2026-01-10T08:00:00.000Z"),
    finalizedAt: null,
  },
  {
    id: uuid(2),
    year: 2025,
    name: "Đợt thi đua năm 2025",
    phase: "CLOSED",
    maxTotalScore: 300,
    selfEvalStart: new Date("2025-01-15T00:00:00.000Z"),
    selfEvalDeadline: new Date("2025-03-15T23:59:59.000Z"),
    supplementHours: 48,
    publishedAt: new Date("2025-01-10T08:00:00.000Z"),
    finalizedAt: new Date("2025-04-30T10:00:00.000Z"),
  },
] as const;

const thresholds = [
  { rating: "EXCELLENT", label: "Hoàn thành xuất sắc nhiệm vụ", minPercent: 85, minExclusive: true, color: "#16a34a" },
  { rating: "GOOD", label: "Hoàn thành tốt nhiệm vụ", minPercent: 65, minExclusive: false, color: "#eab308" },
  { rating: "PASS", label: "Hoàn thành nhiệm vụ", minPercent: 50, minExclusive: false, color: "#f97316" },
  { rating: "FAIL", label: "Không hoàn thành nhiệm vụ", minPercent: 0, minExclusive: false, color: "#dc2626" },
] as const;

const criterionDefinitions = [
  { code: "A", name: "Công tác giáo dục chính trị tư tưởng", maxScore: 50, parent: true },
  { code: "A1", name: "Tổ chức học tập nghị quyết, chủ trương", maxScore: 25, parent: false },
  { code: "A2", name: "Tuyên truyền, giáo dục đoàn viên", maxScore: 25, parent: false },
  { code: "B", name: "Tổ chức phong trào hành động cách mạng", maxScore: 100, parent: true },
  { code: "B1", name: "Phong trào tình nguyện vì cộng đồng", maxScore: 50, parent: false },
  { code: "B2", name: "Phong trào sáng tạo và chuyển đổi số", maxScore: 50, parent: false },
  { code: "C", name: "Công tác xây dựng tổ chức Đoàn", maxScore: 75, parent: true },
  { code: "C1", name: "Quản lý đoàn viên và phát triển lực lượng", maxScore: 40, parent: false },
  { code: "C2", name: "Kiểm tra, giám sát và sinh hoạt chi đoàn", maxScore: 35, parent: false },
  { code: "D", name: "Công tác tham mưu, phối hợp", maxScore: 75, parent: true },
  { code: "D1", name: "Tham mưu cấp ủy, chính quyền", maxScore: 40, parent: false },
  { code: "D2", name: "Chế độ thông tin, báo cáo", maxScore: 35, parent: false },
] as const;

type EvaluationStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "NEEDS_SUPPLEMENT" | "FINALIZED";
type DatabaseEvaluationStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "SUPPLEMENT_REQUESTED"
  | "FINALIZED";

function databaseStatus(status: EvaluationStatus): DatabaseEvaluationStatus {
  if (status === "SUBMITTED" || status === "IN_REVIEW") return "PENDING_REVIEW";
  if (status === "NEEDS_SUPPLEMENT") return "SUPPLEMENT_REQUESTED";
  return status;
}

function statusFor(index: number, periodYear: number): EvaluationStatus {
  if (periodYear === 2025) return index % 2 === 0 ? "FINALIZED" : "SUBMITTED";
  return ["DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_SUPPLEMENT", "FINALIZED"][index % 5] as EvaluationStatus;
}

function statusChain(status: EvaluationStatus): EvaluationStatus[] {
  switch (status) {
    case "DRAFT": return ["DRAFT"];
    case "SUBMITTED": return ["DRAFT", "SUBMITTED"];
    case "IN_REVIEW": return ["DRAFT", "SUBMITTED", "IN_REVIEW"];
    case "NEEDS_SUPPLEMENT": return ["DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_SUPPLEMENT"];
    case "FINALIZED": return ["DRAFT", "SUBMITTED", "IN_REVIEW", "FINALIZED"];
  }
}

async function main(): Promise<void> {
  const generatedCredentials: { username: string; password: string }[] = [];
  const existingUsers = await prisma.user.findMany({
    where: { username: { in: [adminUsername, ...units.map((unit) => unit.username)] } },
    select: { username: true },
  });
  const existingUsernames = new Set(existingUsers.map((user) => user.username));

  if ((!credentialsFile && (rotatePasswords || existingUsernames.size < units.length + 1))) {
    throw new Error(
      "SEED_CREDENTIALS_FILE must point to a secure local file before creating or rotating account passwords.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const adminHash = await bcrypt.hash(seedAdminPassword, 12);
    const admin = await tx.user.upsert({
      where: { username: adminUsername },
      update: {
        email: adminEmail,
        fullName: "Quản trị viên Ban Thanh niên CATP",
        role: "ADMIN",
        isActive: true,
        ...(rotatePasswords ? { passwordHash: adminHash, mustChangePassword: true } : {}),
      },
      create: {
        id: uuid(10),
        username: adminUsername,
        email: adminEmail,
        passwordHash: adminHash,
        mustChangePassword: true,
        fullName: "Quản trị viên Ban Thanh niên CATP",
        role: "ADMIN",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    if (!existingUsernames.has(adminUsername) || rotatePasswords) {
      generatedCredentials.push({ username: adminUsername, password: seedAdminPassword });
    }

    const unitUsers: { unitId: string; userId: string; username: string }[] = [];
    for (const [index, unitSeed] of units.entries()) {
      await tx.unit.upsert({
        where: { code: unitSeed.code },
        update: { name: unitSeed.name, unitType: "DON_VI_TRUC_THUOC", sortOrder: index + 1, isActive: true, updatedAt: now },
        create: { id: unitSeed.id, code: unitSeed.code, name: unitSeed.name, unitType: "DON_VI_TRUC_THUOC", sortOrder: index + 1, isActive: true, createdAt: now, updatedAt: now },
      });

      const existing = await tx.user.findUnique({
        where: { username: unitSeed.username },
        select: { id: true },
      });
      const password = !existing || rotatePasswords ? randomBytes(18).toString("base64url") : null;
      const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
      const createPasswordHash = passwordHash ?? (await bcrypt.hash(randomBytes(18).toString("base64url"), 12));
      const user = await tx.user.upsert({
        where: { username: unitSeed.username },
        update: {
          fullName: `Tài khoản ${unitSeed.name}`,
          role: "UNIT",
          unitId: unitSeed.id,
          isActive: true,
          ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}),
        },
        create: {
          id: uuid(301 + index),
          username: unitSeed.username,
          passwordHash: createPasswordHash,
          mustChangePassword: true,
          fullName: `Tài khoản ${unitSeed.name}`,
          role: "UNIT",
          unitId: unitSeed.id,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      });
      if (password) generatedCredentials.push({ username: unitSeed.username, password });
      unitUsers.push({ unitId: unitSeed.id, userId: user.id, username: unitSeed.username });
    }

    for (const periodSeed of periods) {
      const period = await tx.evaluationPeriod.upsert({
        where: { year: periodSeed.year },
        update: { name: periodSeed.name, phase: periodSeed.phase, maxTotalScore: periodSeed.maxTotalScore, selfEvalStart: periodSeed.selfEvalStart, selfEvalDeadline: periodSeed.selfEvalDeadline, supplementHours: periodSeed.supplementHours, publishedAt: periodSeed.publishedAt, finalizedAt: periodSeed.finalizedAt, updatedAt: now },
        create: { ...periodSeed, createdById: admin.id, createdAt: now, updatedAt: now },
      });

      for (const [index, threshold] of thresholds.entries()) {
        await tx.ratingThreshold.upsert({
          where: { periodId_rating: { periodId: period.id, rating: threshold.rating } },
          update: threshold,
          create: { id: uuid(1000 + (periodSeed.year - 2025) * 10 + index), periodId: period.id, ...threshold },
        });
      }

      const parentIds = new Map<string, string>();
      for (const [index, definition] of criterionDefinitions.entries()) {
        const parentCode = definition.code.length > 1 ? definition.code[0] : null;
        const criterion = await tx.criterion.upsert({
          where: { periodId_code: { periodId: period.id, code: definition.code } },
          update: { name: definition.name, maxScore: definition.maxScore, parentId: parentCode ? parentIds.get(parentCode) : null, sortOrder: index + 1, updatedAt: now },
          create: { id: uuid(1100 + (periodSeed.year - 2025) * 100 + index), periodId: period.id, parentId: parentCode ? parentIds.get(parentCode) : null, code: definition.code, name: definition.name, description: `Minh chứng cho tiêu chí ${definition.code}.`, maxScore: definition.maxScore, evidenceRequirement: "Tối thiểu một minh chứng phù hợp.", allowText: true, allowFile: true, allowLink: true, evidenceRequired: !definition.parent, sortOrder: index + 1, createdAt: now, updatedAt: now },
        });
        if (definition.parent) parentIds.set(definition.code, criterion.id);
      }

      const criteria = await tx.criterion.findMany({ where: { periodId: period.id }, orderBy: { sortOrder: "asc" } });
      const evaluationCount = periodSeed.year === 2026 ? unitUsers.length : 8;
      for (let index = 0; index < evaluationCount; index += 1) {
        const unitUser = unitUsers[index];
        const status = statusFor(index, periodSeed.year);
        const evaluationId = uuid(2000 + (periodSeed.year - 2025) * 100 + index);
        const submittedAt = status === "DRAFT" ? null : new Date(periodSeed.year, 1, 10 + index);
        const inReview = status === "IN_REVIEW" || status === "NEEDS_SUPPLEMENT" || status === "FINALIZED";
        const finalized = status === "FINALIZED";
        const finalScore = finalized ? 210 + (index % 8) * 7 : null;
        const evaluation = await tx.evaluation.upsert({
          where: { periodId_unitId: { periodId: period.id, unitId: unitUser.unitId } },
          update: { status: "DRAFT", submittedAt: null, firstReviewedAt: null, supplementRequestedAt: null, supplementDeadline: null, supplementSubmittedAt: null, finalizedAt: null, finalizedById: null, finalScore: null, finalPercent: null, finalRating: null, updatedAt: now },
          create: { id: evaluationId, periodId: period.id, unitId: unitUser.unitId, status: "DRAFT", createdAt: now, updatedAt: now },
        });

        const leafCriteria = criteria.filter((criterion) => criterion.parentId !== null);
        for (const [criterionIndex, criterion] of leafCriteria.entries()) {
          const scoreId = uuid(4000 + (periodSeed.year - 2025) * 1000 + index * 20 + criterionIndex);
          const selfScore = status === "DRAFT" ? null : Math.round(Number(criterion.maxScore) * (0.55 + (index % 4) * 0.1) * 100) / 100;
          const seededSelfScore = Math.round(Number(criterion.maxScore) * (0.55 + (index % 4) * 0.1) * 100) / 100;
          const score = await tx.criterionScore.upsert({
            where: { evaluationId_criterionId: { evaluationId: evaluation.id, criterionId: criterion.id } },
            update: { selfScore: status === "DRAFT" ? null : seededSelfScore, selfNote: status === "DRAFT" ? null : `Tự đánh giá của ${unitUser.username}.`, adminScore: null, adminComment: null, needsSupplement: false, supplementNote: null, reviewedById: null, reviewedAt: null, updatedAt: now },
            create: { id: scoreId, evaluationId: evaluation.id, criterionId: criterion.id, selfScore: status === "DRAFT" ? null : seededSelfScore, selfNote: status === "DRAFT" ? null : `Tự đánh giá của ${unitUser.username}.`, adminScore: null, adminComment: null, needsSupplement: false, supplementNote: null, reviewedById: null, reviewedAt: null, createdAt: now, updatedAt: now },
          });

          if (status !== "DRAFT" && (!inReview || criterionIndex % 2 === 0)) {
            await tx.evidence.upsert({
              where: { id: uuid(6000 + (periodSeed.year - 2025) * 1000 + index * 20 + criterionIndex) },
              update: { description: "Minh chứng mẫu phục vụ kiểm thử.", previewStatus: "READY" },
              create: { id: uuid(6000 + (periodSeed.year - 2025) * 1000 + index * 20 + criterionIndex), criterionScoreId: score.id, uploaderId: unitUser.userId, kind: criterionIndex % 2 === 0 ? "FILE" : "LINK", round: "INITIAL", fileName: criterionIndex % 2 === 0 ? `minh-chung-${index + 1}-${criterion.code}.pdf` : null, mimeType: criterionIndex % 2 === 0 ? "application/pdf" : null, sizeBytes: criterionIndex % 2 === 0 ? BigInt(1024 + criterionIndex * 256) : null, storagePath: criterionIndex % 2 === 0 ? `seed/evidences/${evaluation.id}/${criterion.code}.pdf` : null, externalUrl: criterionIndex % 2 === 0 ? null : `https://example.com/evidence/${evaluation.id}/${criterion.code}`, description: "Minh chứng mẫu phục vụ kiểm thử.", previewStatus: criterionIndex % 2 === 0 ? "READY" : "NOT_REQUIRED", previewPath: criterionIndex % 2 === 0 ? `seed/previews/${evaluation.id}/${criterion.code}.png` : null, createdAt: now },
            });
          }
        }

        const dbEvaluationStatus = databaseStatus(status);
        for (const [criterionIndex, criterion] of leafCriteria.entries()) {
          const criterionSelfScore = Math.round(Number(criterion.maxScore) * (0.55 + (index % 4) * 0.1) * 100) / 100;
          const adminScore = finalized ? Math.round(criterionSelfScore * 0.95 * 100) / 100 : null;
          await tx.criterionScore.update({
            where: { evaluationId_criterionId: { evaluationId: evaluation.id, criterionId: criterion.id } },
            data: {
              selfScore: status === "DRAFT" ? null : criterionSelfScore,
              adminScore,
              adminComment: adminScore ? "Đã kiểm tra minh chứng." : null,
              needsSupplement: status === "NEEDS_SUPPLEMENT" && criterionIndex % 2 === 0,
              supplementNote: status === "NEEDS_SUPPLEMENT" && criterionIndex % 2 === 0 ? "Bổ sung tài liệu còn thiếu." : null,
              reviewedById: inReview ? admin.id : null,
              reviewedAt: inReview ? new Date(periodSeed.year, 1, 18 + index) : null,
              updatedAt: now,
            },
          });
        }

        await tx.evaluation.update({
          where: { id: evaluation.id },
          data: { status: dbEvaluationStatus, submittedAt, firstReviewedAt: inReview ? new Date(periodSeed.year, 1, 18 + index) : null, supplementRequestedAt: status === "NEEDS_SUPPLEMENT" ? new Date(periodSeed.year, 1, 20 + index) : null, supplementDeadline: status === "NEEDS_SUPPLEMENT" ? new Date(periodSeed.year, 2, 5 + index) : null, supplementSubmittedAt: finalized ? new Date(periodSeed.year, 2, 1 + index) : null, finalizedAt: finalized ? new Date(periodSeed.year, 3, 10 + index) : null, finalizedById: finalized ? admin.id : null, finalScore, finalPercent: finalScore ? Number(finalScore) / 3 : null, finalRating: finalScore ? (Number(finalScore) >= 255 ? "EXCELLENT" : "GOOD") : null, updatedAt: now },
        });

        for (const [historyIndex, toStatus] of statusChain(status).entries()) {
          await tx.statusHistory.upsert({
            where: { id: uuid(8000 + (periodSeed.year - 2025) * 1000 + index * 10 + historyIndex) },
            update: { toStatus: databaseStatus(toStatus), createdAt: new Date(periodSeed.year, 1, 5 + historyIndex + index) },
            create: { id: uuid(8000 + (periodSeed.year - 2025) * 1000 + index * 10 + historyIndex), evaluationId: evaluation.id, actorId: historyIndex === 0 ? unitUser.userId : admin.id, fromStatus: historyIndex === 0 ? null : databaseStatus(statusChain(status)[historyIndex - 1]), toStatus: databaseStatus(toStatus), comment: `Chuyển trạng thái mẫu sang ${toStatus}.`, createdAt: new Date(periodSeed.year, 1, 5 + historyIndex + index) },
          });
        }

        if (status === "IN_REVIEW" || status === "NEEDS_SUPPLEMENT" || status === "FINALIZED") {
          await tx.evaluationFeedback.upsert({
            where: { id: uuid(9000 + (periodSeed.year - 2025) * 100 + index) },
            update: { content: status === "NEEDS_SUPPLEMENT" ? "Đề nghị đơn vị bổ sung minh chứng cho các tiêu chí được đánh dấu." : "Hồ sơ đã được tiếp nhận và đang xử lý." },
            create: { id: uuid(9000 + (periodSeed.year - 2025) * 100 + index), evaluationId: evaluation.id, authorId: admin.id, type: status === "NEEDS_SUPPLEMENT" ? "SUPPLEMENT_REQUEST" : "GENERAL", content: status === "NEEDS_SUPPLEMENT" ? "Đề nghị đơn vị bổ sung minh chứng cho các tiêu chí được đánh dấu." : "Hồ sơ đã được tiếp nhận và đang xử lý.", createdAt: now },
          });
        }

        await tx.notification.upsert({
          where: { id: uuid(10000 + (periodSeed.year - 2025) * 100 + index) },
          update: { title: `Cập nhật hồ sơ ${periodSeed.year}`, body: `Hồ sơ của ${unitUser.username} đang ở trạng thái ${status}.`, isRead: index % 3 === 0 },
          create: { id: uuid(10000 + (periodSeed.year - 2025) * 100 + index), userId: unitUser.userId, channel: index % 2 === 0 ? "SYSTEM" : "WEB_PUSH", type: "EVALUATION_STATUS_CHANGED", title: `Cập nhật hồ sơ ${periodSeed.year}`, body: `Hồ sơ của ${unitUser.username} đang ở trạng thái ${status}.`, refType: "EVALUATION", refId: evaluation.id, isRead: index % 3 === 0, scheduledAt: null, sentAt: index % 3 === 0 ? now : null, createdAt: now },
        });

        await tx.auditLog.upsert({
          where: { id: uuid(12000 + (periodSeed.year - 2025) * 100 + index) },
          update: { action: "SEED_EVALUATION", entity: "Evaluation", entityId: evaluation.id, after: { status, periodYear: periodSeed.year } },
          create: { id: uuid(12000 + (periodSeed.year - 2025) * 100 + index), actorId: status === "DRAFT" ? unitUser.userId : admin.id, action: "SEED_EVALUATION", entity: "Evaluation", entityId: evaluation.id, after: { status, periodYear: periodSeed.year }, ip: "127.0.0.1", createdAt: now },
        });

        if (index < 3) {
          await tx.reportExport.upsert({
            where: { id: uuid(14000 + (periodSeed.year - 2025) * 100 + index) },
            update: { storagePath: `seed/reports/${periodSeed.year}/${unitUser.username}.xlsx` },
            create: { id: uuid(14000 + (periodSeed.year - 2025) * 100 + index), periodId: period.id, evaluationId: evaluation.id, reportType: "UNIT_APPRAISAL_MINUTES", format: index % 2 === 0 ? "XLSX" : "PDF", storagePath: `seed/reports/${periodSeed.year}/${unitUser.username}.${index % 2 === 0 ? "xlsx" : "pdf"}`, createdById: admin.id, createdAt: now },
          });
        }
      }
    }

    const tokenUsers = [admin.id, ...unitUsers.slice(0, 6).map((user) => user.userId)];
    for (const [index, userId] of tokenUsers.entries()) {
      await tx.refreshToken.upsert({
        where: { tokenHash: `seed-refresh-token-hash-${index}` },
        update: { expiresAt: new Date("2027-01-01T00:00:00.000Z"), revokedAt: index % 3 === 0 ? now : null },
        create: { id: uuid(15000 + index), userId, tokenHash: `seed-refresh-token-hash-${index}`, expiresAt: new Date("2027-01-01T00:00:00.000Z"), revokedAt: index % 3 === 0 ? now : null, createdAt: now },
      });
      await tx.webPushSubscription.upsert({
        where: { endpoint: `https://push.example.test/subscription/${index}` },
        update: { userId, userAgent: "Seed Browser", revokedAt: index % 4 === 0 ? now : null, updatedAt: now },
        create: { id: uuid(16000 + index), userId, endpoint: `https://push.example.test/subscription/${index}`, p256dh: `seed-p256dh-${index}`, auth: `seed-auth-${index}`, expirationTime: null, userAgent: "Seed Browser", createdAt: now, updatedAt: now, revokedAt: index % 4 === 0 ? now : null },
      });
    }
  }, { maxWait: 10_000, timeout: 120_000 });

  if (generatedCredentials.length > 0) {
    if (!credentialsFile) throw new Error("SEED_CREDENTIALS_FILE is required to save newly generated credentials.");
    const filePath = resolve(credentialsFile);
    await writeFile(filePath, `${JSON.stringify(generatedCredentials, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    console.info(`Credentials written to ${filePath}. Store them securely and delete the file after use.`);
  }
  console.info(`Seeded ${units.length} units, ${unitUsersCount()} unit accounts, 2 periods, evaluations and all schema tables.`);
}

function unitUsersCount(): number {
  return units.length;
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
