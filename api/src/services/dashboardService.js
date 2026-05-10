import * as dashboardRepo from "../repos/dashboardRepo.js";

export async function getMerchantStats(merchantId) {
  return dashboardRepo.getMerchantStats(merchantId);
}

export async function getProgramStats(programId, merchantId) {
  const stats = await dashboardRepo.getProgramStats(programId, merchantId);
  if (!stats) {
    const err = new Error("Program not found");
    err.status = 404;
    throw err;
  }
  return stats;
}