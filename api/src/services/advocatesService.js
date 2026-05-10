import crypto from "crypto";
import * as programsRepo from "../repos/programsRepo.js";
import * as advocatesRepo from "../repos/advocatesRepo.js";

function generateReferralCode() {
  return crypto.randomBytes(8).toString("base64url");
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function list(programId, merchantId) {
  const program = await programsRepo.findById(programId, merchantId);
  if (!program) {
    const err = new Error("Program not found");
    err.status = 404;
    throw err;
  }
  return advocatesRepo.findByProgramId(programId);
}

export async function create(programId, merchantId, { email, referralCode }) {
  const program = await programsRepo.findById(programId, merchantId);
  if (!program) {
    const err = new Error("Program not found");
    err.status = 404;
    throw err;
  }

  if (!email || !isValidEmail(email)) {
    const err = new Error("A valid email is required");
    err.status = 400;
    throw err;
  }

  const existing = await advocatesRepo.existsByProgramAndEmail(programId, email);
  if (existing) {
    const err = new Error("An advocate with this email already exists in this program");
    err.status = 409;
    throw err;
  }

  const code = referralCode && typeof referralCode === "string" && referralCode.length > 0
    ? referralCode
    : generateReferralCode();

  return advocatesRepo.create({ programId, email, referralCode: code });
}

export async function getById(advocateId, merchantId) {
  const advocate = await advocatesRepo.findByIdWithMerchantCheck(advocateId, merchantId);
  if (!advocate) {
    const err = new Error("Advocate not found");
    err.status = 404;
    throw err;
  }
  return advocate;
}

export async function remove(advocateId, merchantId) {
  const advocate = await advocatesRepo.findByIdWithMerchantCheck(advocateId, merchantId);
  if (!advocate) {
    const err = new Error("Advocate not found");
    err.status = 404;
    throw err;
  }

  const deleted = await advocatesRepo.deleteById(advocateId);
  if (!deleted) {
    const err = new Error("Advocate not found");
    err.status = 404;
    throw err;
  }
  return deleted;
}

export async function getLink(advocateId, merchantId) {
  const advocate = await advocatesRepo.findByIdWithMerchantCheck(advocateId, merchantId);
  if (!advocate) {
    const err = new Error("Advocate not found");
    err.status = 404;
    throw err;
  }

  const baseUrl = process.env.REFERRAL_BASE_URL ?? "http://localhost:5173/ref";
  return {
    referralLink: `${baseUrl}/${advocate.referral_code}`,
  };
}

export async function resolve(referralCode) {
  const advocate = await advocatesRepo.findByReferralCode(referralCode);
  if (!advocate) {
    const err = new Error("Referral code not found");
    err.status = 404;
    throw err;
  }

  return {
    email: advocate.email,
    referralCode: advocate.referral_code,
    program: {
      name: advocate.program_name,
      rewardAmountCents: advocate.reward_amount_cents,
      rewardDescription: advocate.reward_description,
    },
  };
}