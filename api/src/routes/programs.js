import { Router } from "express";
import { list, create, getById, update, remove } from "../controllers/programsController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.get("/:id", requireAuth, getById);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);

export default router;