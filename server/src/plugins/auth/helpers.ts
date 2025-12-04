import crypto from "node:crypto";
import { promisify } from "node:util";
import { RequestHandler } from "express";

const hashPromise = promisify(crypto.pbkdf2);

export const hashFunction = async (
  password: string,
  salt: Buffer = crypto.randomBytes(16)
): Promise<{ hashedPassword: Buffer; salt: Buffer }> => {
  const hashedPassword = await hashPromise(
    password,
    salt,
    310000,
    32,
    "sha256"
  );
  return { hashedPassword, salt };
};

export const matchPassword = async (
  stringPassword: string,
  correctPassword: Buffer,
  salt: Buffer
) => {
  const { hashedPassword } = await hashFunction(stringPassword, salt);
  return crypto.timingSafeEqual(correctPassword, hashedPassword);
};

export const requireLogin: RequestHandler = (req, _, next) => {
  if (!req.session.user) {
    throw {
      status: 401,
      message: "Your session may have expired. Please login to continue.",
    };
  }
  next();
};
