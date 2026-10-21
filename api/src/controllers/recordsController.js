import * as recordsService from "../services/recordsService.js";

export async function list(req, res, next) {
  try {
    res.json(await recordsService.list(req.merchantId, req.query));
  } catch (err) {
    next(err);
  }
}
