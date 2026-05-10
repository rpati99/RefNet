import * as dashboardService from "../services/dashboardService.js";

async function getDashboard(req, res, next) {
  try {
    const stats = await dashboardService.getMerchantStats(req.merchantId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

async function getProgramDetail(req, res, next) {
  try {
    const stats = await dashboardService.getProgramStats(req.params.programId, req.merchantId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

export { getDashboard, getProgramDetail };