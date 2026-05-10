import express from "express";
import cors from "cors";
import { config } from "dotenv";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import programsRouter from "./routes/programs.js";
import advocatesRouter from "./routes/advocates.js";
import refRouter from "./routes/ref.js";
import webhooksRouter from "./routes/webhooks.js";

config();

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/programs", programsRouter);
app.use("/api/programs", advocatesRouter);
app.use("/api/ref", refRouter);
app.use("/webhooks", webhooksRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status ?? 500;
  res.status(status).json({ error: status === 500 ? "Internal server error" : err.message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;