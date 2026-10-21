import { Router } from "express";
import { resolve } from "../controllers/advocatesController.js";
import { requireAuth } from "../middleware/auth.js";
import { create } from "../controllers/demoOrdersController.js";

const router = Router();

router.get("/:referralCode", resolve);
router.post("/:referralCode/demo-order", requireAuth, create);

export default router;
