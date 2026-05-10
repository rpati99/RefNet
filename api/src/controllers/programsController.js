import * as programsService from "../services/programsService.js";

async function list(req, res, next) {
  try {
    const programs = await programsService.list(req.merchantId);
    res.json({ programs });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, rewardDescription, rewardAmountCents } = req.body;
    const program = await programsService.create(req.merchantId, {
      name,
      rewardDescription,
      rewardAmountCents,
    });
    res.status(201).json(program);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const program = await programsService.getById(req.params.id, req.merchantId);
    res.json(program);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { name, rewardDescription, rewardAmountCents, isActive } = req.body;
    const program = await programsService.update(req.params.id, req.merchantId, {
      name,
      rewardDescription,
      rewardAmountCents,
      isActive,
    });
    res.json(program);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await programsService.softDelete(req.params.id, req.merchantId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export { list, create, getById, update, remove };