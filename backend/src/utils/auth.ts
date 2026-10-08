import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const signToken = (id: string, role: string) =>
  jwt.sign({ sub: id, role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });

export const verifyToken = (token: string) =>
  jwt.verify(token, env.jwtSecret) as { sub: string; role: string };
