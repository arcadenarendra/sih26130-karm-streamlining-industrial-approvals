import type { RequestHandler } from "express";
import { User } from "../User.js";
import { HttpError } from "../../utils/http.js";
import { verifyToken } from "../../utils/auth.js";
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; department: string | null };
    }
  }
}
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) throw new HttpError(401, "Authentication required");
    const p = verifyToken(h.slice(7));
    const u = await User.findById(p.sub);
    if (!u) throw new HttpError(401, "Invalid token");
    req.user = { id: u.id, role: u.role, department: u.department ?? null };
    next();
  } catch (e) {
    next(e);
  }
};
export const roles =
  (...allowed: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !allowed.includes(req.user.role))
      return next(new HttpError(403, "Insufficient permissions"));
    next();
  };
