import { Schema, model } from "mongoose";
export type Role = "applicant" | "authority" | "department_admin" | "admin" | "super_admin";
const schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["applicant", "authority", "department_admin", "admin", "super_admin"], default: "applicant" },
    department: { type: String, default: null, index: true },
    mustChangePassword: { type: Boolean, default: false },
    phone: { type: String, default: null },
  },
  { timestamps: true },
);
export const User = model("User", schema);
