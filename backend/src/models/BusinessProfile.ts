import { Schema, model } from "mongoose";
export const BusinessProfile = model(
  "BusinessProfile",
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: "User", unique: true, required: true },
      businessName: { type: String, required: true },
      sector: { type: String, required: true },
      location: {
        state: { type: String, required: true },
        district: { type: String, required: true },
      },
      projectSize: { type: String, required: true },
      stage: { type: String, required: true },
    },
    { timestamps: true },
  ),
);
