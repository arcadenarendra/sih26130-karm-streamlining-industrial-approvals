import { Schema, model } from "mongoose";
const risk = new Schema(
  { score: Number, summary: String, flags: [String], generatedAt: Date },
  { _id: false },
);
const document = new Schema(
  {
    docType: String,
    fileUrl: String,
    storagePath: String,
    originalName: String,
    mimeType: String,
    verificationStatus: { type: String, enum: ["pending", "verified", "invalid"], default: "pending" },
    verificationNotes: { type: String, default: null },
    uploadedAt: Date,
    preValidationStatus: { type: String, enum: ["pending", "passed", "failed"] },
    preValidationNotes: [String],
    riskBrief: { type: risk, default: null },
  },
  { _id: false },
);
const history = new Schema(
  {
    action: String,
    byUserId: Schema.Types.ObjectId,
    byRole: String,
    reason: { type: String, default: null },
    timestamp: Date,
  },
  { _id: false },
);
const item = new Schema({
  approvalTypeId: { type: Schema.Types.ObjectId, ref: "ApprovalType" },
  status: {
    type: String,
    enum: ["draft", "submitted", "in_review", "query_raised", "approved", "rejected"],
    default: "draft",
  },
  assignedOfficerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  submittedAt: { type: Date, default: null },
  slaDeadline: { type: Date, default: null },
  documents: [document],
  history: [history],
});
export const Application = model(
  "Application",
  new Schema(
    {
      referenceNumber: { type: String, required: true, unique: true, index: true },
      applicantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
      businessProfileId: { type: Schema.Types.ObjectId, ref: "BusinessProfile", required: true },
      departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null, index: true },
      approvalItems: [item],
      overallStatus: {
        type: String,
        enum: ["draft", "in_progress", "action_required", "approved", "rejected"],
        default: "draft",
      },
    },
    { timestamps: true },
  ),
);
