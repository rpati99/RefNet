import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { resolve } from "../controllers/advocatesController.js";

const router = Router();

router.get("/:referralCode", resolve);

export default router;