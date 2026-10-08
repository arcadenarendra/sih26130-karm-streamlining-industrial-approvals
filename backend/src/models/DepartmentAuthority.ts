import { Schema, model } from "mongoose";

const departmentAuthoritySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    enabled: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const DepartmentAuthority = model("DepartmentAuthority", departmentAuthoritySchema);
