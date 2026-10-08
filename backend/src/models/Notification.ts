import { Schema, model } from "mongoose";
export const Notification = model(
  "Notification",
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
      type: String,
      message: String,
      read: { type: Boolean, default: false },
    },
    { timestamps: true },
  ),
);
