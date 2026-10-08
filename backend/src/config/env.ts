import "dotenv/config";
import path from "node:path";
const required = (key: string, fallback?: string) =>
  process.env[key] ??
  fallback ??
  (() => {
    throw new Error(`Missing environment variable ${key}`);
  })();
export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required("MONGODB_URI", "mongodb://localhost:27017/karm"),
  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  corsOrigins: (
    process.env.CORS_ORIGIN ??
    "http://localhost:5173,http://localhost:5174,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:8080"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? "uploads"),
  maxFileSize: Number(process.env.MAX_FILE_SIZE_MB ?? 10) * 1024 * 1024,
  warningDays: Number(process.env.SLA_WARNING_DAYS ?? 2),
};
