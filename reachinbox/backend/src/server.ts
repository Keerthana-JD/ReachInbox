import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { emailQueue } from "./queue";
import emailsRouter from "./routes/emails";
import slackRouter from "./routes/slack";
import { ensureEmailIndex } from "./elastic";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// ---------- Live BullMQ dashboard (required by assignment) ----------
// Visit http://localhost:4000/admin/queues to see jobs in real time.
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter,
});
app.use("/admin/queues", serverAdapter.getRouter());

// ---------- API routes ----------
app.use("/api/emails", emailsRouter);
app.use("/api/slack", slackRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
ensureEmailIndex()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 API running at http://localhost:${PORT}`);
      console.log(`📊 Queue dashboard at http://localhost:${PORT}/admin/queues`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to initialize Elasticsearch:", err);
    process.exit(1);
  });
