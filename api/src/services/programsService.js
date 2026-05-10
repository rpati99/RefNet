import * as programsRepo from "../repos/programsRepo.js";

export async function list(merchantId) {
  return programsRepo.findByMerchantId(merchantId);
}

export async function create(merchantId, { name, rewardDescription, rewardAmountCents }) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    const err = new Error("name is required");
    err.status = 400;
    throw err;
  }
  return programsRepo.create(merchantId, {
    name: name.trim(),
    rewardDescription,
    rewardAmountCents: rewardAmountCents ?? 0,
  });
}

export async function getById(id, merchantId) {
  const program = await programsRepo.findById(id, merchantId);
  if (!program) {
    const err = new Error("Program not found");
    err.status = 404;
    throw err;
  }
  return program;
}

export async function update(id, merchantId, fields) {
  const allowedFields = ["name", "rewardDescription", "rewardAmountCents", "isActive"];
  const updateFields = {};
  for (const key of allowedFields) {
    if (fields[key] !== undefined) {
      updateFields[key] = fields[key];
    }
  }

  const updated = await programsRepo.update(id, merchantId, updateFields);
  if (!updated) {
    const err = new Error("Program not found");
    err.status = 404;
    throw err;
  }
  return updated;
}

export async function softDelete(id, merchantId) {
  const deleted = await programsRepo.softDelete(id, merchantId);
  if (!deleted) {
    const err = new Error("Program not found");
    err.status = 404;
    throw err;
  }
  return deleted;
}