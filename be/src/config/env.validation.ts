import Joi from "joi";

const optionalSecret = Joi.string().allow("").optional();
const positiveInteger = Joi.number().integer().positive();

/** Chỉ yêu cầu credential khi tính năng bật, để unit test và phần lõi không cần SMTP/Zalo/storage thật */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().default(3000),
  APP_BASE_URL: Joi.string().uri({ scheme: ["http", "https"] }).optional(),
  WEB_ORIGINS: Joi.string().optional(),
  CORS_ORIGINS: Joi.string().optional(),
  DATABASE_URL: Joi.string().uri({ scheme: ["postgresql", "postgres"] }).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ISSUER: Joi.string().default("seminar-api"),
  JWT_AUDIENCE: Joi.string().default("seminar-web"),
  JWT_ACCESS_TTL: positiveInteger.default(900),
  JWT_REFRESH_TTL: positiveInteger.default(604800),
  BCRYPT_COST: Joi.number().integer().min(4).max(16).default(12),
  INITIAL_ACCOUNT_PASSWORD: Joi.string().when("NODE_ENV", { is: "production", then: Joi.required(), otherwise: Joi.string().default("123456") }),
  CREDENTIAL_DELIVERY_ENABLED: Joi.boolean().default(false),
  CREDENTIALS_ENCRYPTION_KEY: Joi.when("CREDENTIAL_DELIVERY_ENABLED", { is: true, then: Joi.string().base64().length(44).required(), otherwise: optionalSecret }),
  CREDENTIALS_ENCRYPTION_KEY_ID: Joi.when("CREDENTIAL_DELIVERY_ENABLED", { is: true, then: Joi.string().required(), otherwise: optionalSecret }),
  CREDENTIAL_DELIVERY_TTL_HOURS: positiveInteger.default(24),
  ONBOARDING_TOKEN_TTL_MINUTES: positiveInteger.default(15),
  IMPORT_MAX_FILE_BYTES: positiveInteger.default(5242880),
  IMPORT_MAX_ROWS: positiveInteger.default(100),
  IMPORT_SESSION_TTL_MINUTES: positiveInteger.default(30),
  EMAIL_ENABLED: Joi.boolean().default(false),
  EMAIL_DRY_RUN: Joi.boolean().default(true),
  SMTP_HOST: Joi.when("EMAIL_ENABLED", { is: true, then: Joi.string().hostname().required(), otherwise: optionalSecret }),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.when("EMAIL_ENABLED", { is: true, then: Joi.string().required(), otherwise: optionalSecret }),
  SMTP_PASSWORD: Joi.when("EMAIL_ENABLED", { is: true, then: Joi.string().required(), otherwise: optionalSecret }),
  MAIL_FROM: Joi.when("EMAIL_ENABLED", { is: true, then: Joi.string().email({ tlds: { allow: false } }).required(), otherwise: optionalSecret }),
  WEB_PUSH_ENABLED: Joi.boolean().default(false),
  WEB_PUSH_VAPID_PUBLIC_KEY: Joi.when("WEB_PUSH_ENABLED", { is: true, then: Joi.string().required(), otherwise: optionalSecret }),
  WEB_PUSH_VAPID_PRIVATE_KEY: Joi.when("WEB_PUSH_ENABLED", { is: true, then: Joi.string().required(), otherwise: optionalSecret }),
  WEB_PUSH_SUBJECT: Joi.when("WEB_PUSH_ENABLED", { is: true, then: Joi.string().uri({ scheme: ["mailto", "https"] }).required(), otherwise: optionalSecret }),
  // ZNS có phí và chưa dùng khi demo, mặc định tắt để không đòi tài khoản doanh nghiệp hoặc credential thật
  ZALO_ZNS_ENABLED: Joi.boolean().default(false),
  ZALO_APP_ID: Joi.when("ZALO_ZNS_ENABLED", { is: true, then: Joi.string().required(), otherwise: optionalSecret }),
  ZALO_APP_SECRET: Joi.when("ZALO_ZNS_ENABLED", { is: true, then: Joi.string().required(), otherwise: optionalSecret }),
  ZALO_OA_ID: Joi.when("ZALO_ZNS_ENABLED", { is: true, then: Joi.string().required(), otherwise: optionalSecret }),
  ZALO_ZNS_TEMPLATE_MAP: Joi.when("ZALO_ZNS_ENABLED", { is: true, then: Joi.string().required(), otherwise: optionalSecret }),
  STORAGE_PROVIDER: Joi.string().valid("none", "supabase").default("none"),
  SUPABASE_URL: Joi.when("STORAGE_PROVIDER", { is: "supabase", then: Joi.string().uri({ scheme: ["https"] }).required(), otherwise: optionalSecret }),
  SUPABASE_KEY: Joi.when("STORAGE_PROVIDER", { is: "supabase", then: Joi.string().required(), otherwise: optionalSecret }),
  STORAGE_SIGNED_URL_TTL_SECONDS: positiveInteger.default(300),
  UPLOAD_MAX_BYTES: positiveInteger.default(20971520),
  UPLOAD_MAX_FILES_PER_CRITERION: positiveInteger.default(10),
  REMINDER_LEAD_HOURS: positiveInteger.default(24),
  ENABLE_DEMO_TOOLS: Joi.boolean().default(false),
  SEED_DEMO_DATA: Joi.boolean().default(false),
  SEED_CREDENTIALS_FILE: Joi.string().default(".seed-credentials.json"),
  OPENAPI_OUTPUT_FILE: Joi.string().optional(),
}).or("WEB_ORIGINS", "CORS_ORIGINS");

/** Validate URL origin cụ thể từ env, không chấp nhận wildcard/credential/path vì CORS có dùng credential */
export function corsOrigins(config: Record<string, unknown>): string[] {
  const input = config.CORS_ORIGINS ?? config.WEB_ORIGINS;
  const origins = typeof input === "string" ? input.split(",").map((item) => item.trim()).filter(Boolean) : [];
  const valid = origins.length > 0 && origins.every((origin) => {
    try {
      const url = new URL(origin);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.origin === origin;
    } catch { return false; }
  });
  if (!valid) throw new Error("Cấu hình CORS_ORIGINS hoặc WEB_ORIGINS phải chứa origin HTTP/HTTPS cụ thể, không có đường dẫn hoặc dấu sao.");
  return [...new Set(origins)];
}

/** Chuyển lỗi Joi sang câu tiếng Việt chỉ kèm tên env, không đưa giá trị secret hay thông điệp thư viện vào log */
export function validateEnvironment(input: Record<string, unknown>): Record<string, unknown> {
  const result = envValidationSchema.validate(input, { abortEarly: false, allowUnknown: true });
  if (result.error) {
    const fields = [...new Set(result.error.details.map((detail) => detail.path.join(".") || "CORS_ORIGINS/WEB_ORIGINS"))];
    throw new Error(`Cấu hình môi trường thiếu hoặc không hợp lệ: ${fields.join(", ")}. Vui lòng kiểm tra cấu hình.`);
  }
  const config = result.value as Record<string, unknown>;
  corsOrigins(config);
  // AES-256 cần đúng 32 byte sau giải mã, chỉ kiểm độ dài chuỗi base64 có thể nhận nhầm khóa 31 byte có padding
  if (config.CREDENTIAL_DELIVERY_ENABLED === true && Buffer.from(String(config.CREDENTIALS_ENCRYPTION_KEY), "base64").length !== 32) {
    throw new Error("Cấu hình CREDENTIALS_ENCRYPTION_KEY phải là khóa base64 của đúng 32 byte.");
  }
  if (config.ZALO_ZNS_ENABLED === true) {
    // Bản đồ phải chứa tên sự kiện và template ID, không nhận JSON rỗng để tránh báo sẵn sàng giả
    try {
      const map: unknown = JSON.parse(String(config.ZALO_ZNS_TEMPLATE_MAP));
      if (!map || typeof map !== "object" || Array.isArray(map) || Object.keys(map).length === 0
        || !Object.values(map).every((id) => typeof id === "string" && id.trim().length > 0)) throw new Error("Bản đồ template không hợp lệ.");
    } catch { throw new Error("Cấu hình ZALO_ZNS_TEMPLATE_MAP phải là JSON ánh xạ sự kiện tới template hợp lệ."); }
  }
  return config;
}
