import { Router } from "express";
import { postOrder } from "../controllers/webhooksController.js";

const router = Router();

router.post(
  "/order",
  (req, res, next) => {
    let data = "";
    req.setEncoding("buffer");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      req.rawBody = Buffer.from(data);
      next();
    });
  },
  postOrder
);

export default router;
