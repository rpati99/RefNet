import * as advocatesService from "../services/advocatesService.js";

async function list(req, res, next) {
  try {
    const advocates = await advocatesService.list(req.params.programId, req.merchantId);
    res.json({ advocates });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { email, referralCode } = req.body;
    const advocate = await advocatesService.create(req.params.programId, req.merchantId, {
      email,
      referralCode,
    });
    res.status(201).json(advocate);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const advocate = await advocatesService.getById(req.params.advocateId, req.merchantId);
    res.json(advocate);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await advocatesService.remove(req.params.advocateId, req.merchantId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function getLink(req, res, next) {
  try {
    const result = await advocatesService.getLink(req.params.advocateId, req.merchantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function resolve(req, res, next) {
  try {
    const result = await advocatesService.resolve(req.params.referralCode);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export { list, create, getById, remove, getLink, resolve };