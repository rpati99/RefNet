import { Router } from "express";
import { resolve } from "../controllers/advocatesController.js";

const router = Router();

router.get("/:referralCode", resolve);

export default router;