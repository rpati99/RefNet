import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { list, create, getById, remove, getLink, resolve } from "../controllers/advocatesController.js";

const router = Router();

router.get("/:programId/advocates", requireAuth, list);
router.post("/:programId/advocates", requireAuth, create);
router.get("/:programId/advocates/:advocateId", requireAuth, getById);
router.delete("/:programId/advocates/:advocateId", requireAuth, remove);
router.get("/:programId/advocates/:advocateId/link", requireAuth, getLink);
router.get("/ref/:referralCode", resolve);

export default router;