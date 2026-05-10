import { Router } from "express";
import { postOrder } from "../controllers/webhooksController.js";

const router = Router();

router.post(
  "/order",
  (req, res, next) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      req.rawBody = Buffer.concat(chunks);
      next();
    });
  },
  postOrder
);

export default router;
