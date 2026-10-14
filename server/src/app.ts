import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import type { DB } from "./lib/db.js";
import { errorMiddleware } from "./lib/http.js";
import { buildRouter } from "./routes/index.js";

export interface AppOptions {
  db: DB;
  uploadDir: string;
  /** Built web app (web/dist). Served when present so the mini PC runs one process. */
  staticDir?: string;
}

export function createApp({ db, uploadDir, staticDir }: AppOptions): express.Express {
  fs.mkdirSync(uploadDir, { recursive: true });
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  app.use("/api", buildRouter(db, uploadDir));

  if (staticDir && fs.existsSync(path.join(staticDir, "index.html"))) {
    app.use(express.static(staticDir, { maxAge: "1h", index: false }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.use(errorMiddleware);
  return app;
}
