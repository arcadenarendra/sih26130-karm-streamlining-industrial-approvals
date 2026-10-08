import { Schema, model } from "mongoose";
const doc = new Schema(
  {
    docType: { type: String, required: true },
    label: { type: String, required: true },
    required: { type: Boolean, default: true },
  },
  { _id: false },
);
export const ApprovalType = model(
  "ApprovalType",
  new Schema(
    {
      name: { type: String, required: true },
      department: { type: String, required: true, index: true },
      requiredDocuments: { type: [doc], default: [] },
      slaDays: { type: Number, required: true, min: 1 },
      description: { type: String, default: "" },
      isActive: { type: Boolean, default: true, index: true },
      sectors: [String],
      states: [String],
      projectSizes: [String],
      stages: [String],
    },
    { timestamps: true },
  ),
);
