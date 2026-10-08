import { Schema, model } from "mongoose";
export const AuditLog = model(
  "AuditLog",
  new Schema(
    {
      actorId: Schema.Types.ObjectId,
      action: String,
      entityType: String,
      entityId: Schema.Types.ObjectId,
      metadata: Schema.Types.Mixed,
      timestamp: { type: Date, default: Date.now },
    },
    { versionKey: false },
  ),
);
