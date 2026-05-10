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
  if (name.length > 255) {
    const err = new Error("name must be at most 255 characters");
    err.status = 400;
    throw err;
  }
  if (rewardDescription && rewardDescription.length > 1000) {
    const err = new Error("rewardDescription must be at most 1000 characters");
    err.status = 400;
    throw err;
  }
  if (rewardAmountCents !== undefined && (typeof rewardAmountCents !== "number" || rewardAmountCents < 0)) {
    const err = new Error("rewardAmountCents must be a non-negative number");
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

  if (updateFields.name !== undefined) {
    if (typeof updateFields.name !== "string" || updateFields.name.trim() === "") {
      const err = new Error("name cannot be empty");
      err.status = 400;
      throw err;
    }
    if (updateFields.name.length > 255) {
      const err = new Error("name must be at most 255 characters");
      err.status = 400;
      throw err;
    }
    updateFields.name = updateFields.name.trim();
  }

  if (updateFields.rewardDescription !== undefined) {
    if (updateFields.rewardDescription && updateFields.rewardDescription.length > 1000) {
      const err = new Error("rewardDescription must be at most 1000 characters");
      err.status = 400;
      throw err;
    }
  }

  if (updateFields.rewardAmountCents !== undefined && (typeof updateFields.rewardAmountCents !== "number" || updateFields.rewardAmountCents < 0)) {
    const err = new Error("rewardAmountCents must be a non-negative number");
    err.status = 400;
    throw err;
  }

  if (updateFields.isActive !== undefined && typeof updateFields.isActive !== "boolean") {
    const err = new Error("isActive must be a boolean");
    err.status = 400;
    throw err;
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