import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { list } from "../controllers/recordsController.js";

const router = Router();
router.get("/", requireAuth, list);
export default router;
