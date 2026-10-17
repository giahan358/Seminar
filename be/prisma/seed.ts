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

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const now = new Date();
const timestampFields = { createdAt: now, updatedAt: now };
const periodId = "00000000-0000-4000-8000-000000000001";
const adminId = "00000000-0000-4000-8000-000000000002";

const units = Array.from({ length: 34 }, (_, index) => {
  const number = index + 1;
  const suffix = String(number).padStart(2, "0");

  return {
    id: `00000000-0000-4000-8000-${String(100 + number).padStart(12, "0")}`,
    code: `COSO-DEMO-${suffix}`,
    name: `Cơ sở Đoàn demo ${suffix}`,
    username: `coso${suffix}`,
  };
});

const ratingThresholds = [
  { rating: "EXCELLENT", label: "Hoàn thành xuất sắc nhiệm vụ", minPercent: 85, minExclusive: true, color: "#16a34a" },
  { rating: "GOOD", label: "Hoàn thành tốt nhiệm vụ", minPercent: 65, minExclusive: false, color: "#eab308" },
  { rating: "PASS", label: "Hoàn thành nhiệm vụ", minPercent: 50, minExclusive: false, color: "#f97316" },
  { rating: "FAIL", label: "Không hoàn thành nhiệm vụ", minPercent: 0, minExclusive: false, color: "#dc2626" },
] as const;

async function main(): Promise<void> {
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@seminar.local";
  const rotatePasswords = process.env.SEED_ROTATE_PASSWORDS === "true";
  const credentialsFile = process.env.SEED_CREDENTIALS_FILE;
  const usernames = [adminUsername, ...units.map((unit) => unit.username)];
  const existingUsers = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { username: true },
  });
  const existingUsernames = new Set(existingUsers.map((user) => user.username));
  const credentialsWillBeGenerated =
    rotatePasswords || usernames.some((username) => !existingUsernames.has(username));

  if (credentialsWillBeGenerated && !credentialsFile) {
    throw new Error(
      "SEED_CREDENTIALS_FILE must point to a secure local file before creating or rotating account passwords.",
    );
  }

  const generatedCredentials: { username: string; password: string }[] = [];

  await prisma.$transaction(async (tx) => {
    const adminPasswordHash = await bcrypt.hash(seedAdminPassword, 12);
    const existingAdmin = await tx.user.findUnique({
      where: { username: adminUsername },
      select: { id: true },
    });
    const admin = await tx.user.upsert({
      where: { username: adminUsername },
      update: {
        email: adminEmail,
        fullName: "Quản trị viên Ban Thanh niên CATP",
        ...(rotatePasswords ? { passwordHash: adminPasswordHash, mustChangePassword: true } : {}),
      },
      create: {
        id: adminId,
        username: adminUsername,
        email: adminEmail,
        passwordHash: adminPasswordHash,
        mustChangePassword: true,
        fullName: "Quản trị viên Ban Thanh niên CATP",
        role: "ADMIN",
        unitId: null,
        isActive: true,
        ...timestampFields,
      },
    });
    if (!existingAdmin || rotatePasswords) {
      generatedCredentials.push({ username: adminUsername, password: seedAdminPassword });
    }

    const period = await tx.evaluationPeriod.upsert({
      where: { year: 2026 },
      update: { name: "Đợt thi đua năm 2026", maxTotalScore: 300, supplementHours: 48 },
      create: {
        id: periodId,
        year: 2026,
        name: "Đợt thi đua năm 2026",
        phase: "SETUP",
        maxTotalScore: 300,
        supplementHours: 48,
        createdById: admin.id,
        ...timestampFields,
      },
    });

    for (const threshold of ratingThresholds) {
      await tx.ratingThreshold.upsert({
        where: { periodId_rating: { periodId: period.id, rating: threshold.rating } },
        update: {
          label: threshold.label,
          minPercent: threshold.minPercent,
          minExclusive: threshold.minExclusive,
          color: threshold.color,
        },
        create: {
          id: `00000000-0000-4000-8000-${String(200 + ratingThresholds.indexOf(threshold) + 1).padStart(12, "0")}`,
          periodId: period.id,
          ...threshold,
        },
      });
    }

    for (const [index, unitSeed] of units.entries()) {
      const unit = await tx.unit.upsert({
        where: { code: unitSeed.code },
        update: { name: unitSeed.name, unitType: "DON_VI_TRUC_THUOC", sortOrder: index + 1 },
        create: {
          id: unitSeed.id,
          code: unitSeed.code,
          name: unitSeed.name,
          unitType: "DON_VI_TRUC_THUOC",
          sortOrder: index + 1,
          isActive: true,
          ...timestampFields,
        },
      });

      const existingUser = await tx.user.findUnique({
        where: { username: unitSeed.username },
        select: { id: true },
      });
      const newPassword = !existingUser || rotatePasswords
        ? randomBytes(18).toString("base64url")
        : null;

      if (newPassword) {
        generatedCredentials.push({ username: unitSeed.username, password: newPassword });
      }
      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: `Tài khoản ${unit.name}`,
            role: "UNIT",
            unitId: unit.id,
            isActive: true,
            ...(newPassword
              ? { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: true }
              : {}),
          },
        });
      } else {
        if (!newPassword) {
          throw new Error(`Could not generate an initial password for ${unitSeed.username}.`);
        }
        await tx.user.create({
          data: {
            id: `00000000-0000-4000-8000-${String(300 + index + 1).padStart(12, "0")}`,
            username: unitSeed.username,
            passwordHash: await bcrypt.hash(newPassword, 12),
            mustChangePassword: true,
            fullName: `Tài khoản ${unit.name}`,
            role: "UNIT",
            unitId: unit.id,
            isActive: true,
            ...timestampFields,
          },
        });
      }

      await tx.evaluation.upsert({
        where: { periodId_unitId: { periodId: period.id, unitId: unit.id } },
        update: {},
        create: {
          id: `00000000-0000-4000-8000-${String(400 + index + 1).padStart(12, "0")}`,
          periodId: period.id,
          unitId: unit.id,
          status: "DRAFT",
          ...timestampFields,
        },
      });
    }
  }, { maxWait: 10_000, timeout: 120_000 });

  console.info(`Seeded the 2026 period, ${units.length} demo units, accounts, and rating thresholds.`);
  if (generatedCredentials.length > 0) {
    if (!credentialsFile) {
      throw new Error("SEED_CREDENTIALS_FILE is required to save newly generated credentials.");
    }
    const filePath = resolve(credentialsFile);
    await writeFile(filePath, `${JSON.stringify(generatedCredentials, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    console.info(`New account credentials were written to ${filePath}. Store them securely and delete the file after use.`);
  }
  console.info("No criteria were seeded because the project brief does not specify the individual criteria.");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
