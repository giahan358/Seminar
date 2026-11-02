import Joi from "joi";

export const envValidationSchema = Joi.object({
  // Cấu hình ứng dụng
  PORT: Joi.number().port().default(3000),
  WEB_ORIGINS: Joi.string().optional(),
  CORS_ORIGINS: Joi.string().optional(),

  // Cơ sở dữ liệu và xác thực
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),

  // Lưu trữ Supabase
  SUPABASE_URL: Joi.string().uri().allow("").optional(),
  SUPABASE_KEY: Joi.string().required(),

  // Thông báo đẩy
  WEB_PUSH_VAPID_PUBLIC_KEY: Joi.string().required(),
  WEB_PUSH_VAPID_PRIVATE_KEY: Joi.string().required(),
  WEB_PUSH_SUBJECT: Joi.string().required(),

  // Dữ liệu khởi tạo
  SEED_CREDENTIALS_FILE: Joi.string().default(".seed-credentials.json"),
}).or("WEB_ORIGINS", "CORS_ORIGINS");
