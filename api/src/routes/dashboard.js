import { Router } from "express";
import { getDashboard, getProgramDetail } from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, getDashboard);
router.get("/programs/:programId", requireAuth, getProgramDetail);

export default router;