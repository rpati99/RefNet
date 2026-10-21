import { simulateOrder } from "../services/demoOrdersService.js";

export async function create(req, res, next) {
  try {
    const result = await simulateOrder(req.merchantId, req.params.referralCode, req.body ?? {});
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
}
