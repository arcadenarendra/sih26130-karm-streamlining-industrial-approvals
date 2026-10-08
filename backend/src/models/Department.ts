import { Schema, model } from "mongoose";

const departmentSchema = new Schema(
  {
    departmentId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Department = model("Department", departmentSchema);
