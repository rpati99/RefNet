import * as recordsRepo from "../repos/recordsRepo.js";

export async function list(merchantId, { page = "1", programId } = {}) {
  if (typeof page !== "string" || !/^[1-9]\d*$/.test(page) || Number(page) > 100000) {
    throw Object.assign(new Error("page must be an integer between 1 and 100000"), { status: 400 });
  }
  if (programId !== undefined && (typeof programId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId))) {
    throw Object.assign(new Error("programId must be a UUID"), { status: 400 });
  }
  const pageSize = 20;
  const rows = await recordsRepo.list(merchantId, { programId, offset: (Number(page) - 1) * pageSize, limit: pageSize + 1 });
  return { records: rows.slice(0, pageSize), page: Number(page), pageSize, hasMore: rows.length > pageSize };
}
