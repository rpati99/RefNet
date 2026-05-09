import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as merchantRepo from "../repos/merchantRepo.js";

const JWT_EXPIRY = "7d";
const BCRYPT_ROUNDS = 10;

export async function register({ email, password, companyName }) {
  const existing = await merchantRepo.findByEmail(email);
  if (existing) {
    const err = new Error("Email already registered");
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const merchant = await merchantRepo.create({ email, passwordHash, companyName });
  const token = signToken(merchant.id);
  return { token, merchant };
}

export async function login({ email, password }) {
  const merchant = await merchantRepo.findByEmail(email);
  if (!merchant) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, merchant.password_hash);
  if (!valid) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const token = signToken(merchant.id);
  const { password_hash, ...profile } = merchant;
  return { token, merchant: profile };
}

export async function getMe(merchantId) {
  const merchant = await merchantRepo.findById(merchantId);
  if (!merchant) {
    const err = new Error("Merchant not found");
    err.status = 404;
    throw err;
  }
  return merchant;
}

function signToken(merchantId) {
  return jwt.sign({ merchantId }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
}