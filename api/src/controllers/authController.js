import * as authService from "../services/authService.js";

async function register(req, res, next) {
  try {
    const { email, password, companyName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = await authService.register({ email, password, companyName });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    res.json({ message: "ok" });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const merchant = await authService.getMe(req.merchantId);
    res.json({ merchant });
  } catch (err) {
    next(err);
  }
}

export { register, login, logout, me };