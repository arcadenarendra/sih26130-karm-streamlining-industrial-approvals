import express from "express";
import cors from "cors";
import routes from "./routes.js";
import { env } from "./config/env.js";
import { requestId, notFound, errorHandler } from "./models/middleware/errors.js";
export const app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(requestId);
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/v1", routes);
app.use(notFound);
app.use(errorHandler);
