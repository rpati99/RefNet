import { Router } from "express";
import pool from "../db/pool.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1 AS alive");
    if (result.rows[0]?.alive === 1) {
      res.json({ status: "ok", db: "connected" });
    } else {
      res.status(503).json({ status: "error", db: "disconnected" });
    }
  } catch (err) {
    console.error("Health check failed:", err.message);
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

export default router;