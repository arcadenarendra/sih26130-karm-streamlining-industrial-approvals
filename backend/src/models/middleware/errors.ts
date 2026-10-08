import type { ErrorRequestHandler, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
export const requestId: RequestHandler = (req, res, next) => {
  res.setHeader("X-Request-Id", randomUUID());
  next();
};
export const notFound: RequestHandler = (_req, res) =>
  res.status(404).json({ message: "Not found", errors: [] });
export const errorHandler: ErrorRequestHandler = (e, _req, res, _next) => {
  const status = e.status ?? (e.name === "ValidationError" ? 400 : 500);
  res.status(status).json({
    message: status === 500 ? "Internal server error" : e.message,
    errors: e.errors ?? [],
  });
};
