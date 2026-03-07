import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express, type Request, type Response } from "express";
import type { PortalConfig } from "./config.js";
import { proxyJsonRequest, resolveUpstreamUrl } from "./proxy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const staticDir = join(__dirname, "static");

const proxyHandler =
  (config: PortalConfig, kind: "onboarding" | "channels" | "skills" | "auth") =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const subPath = req.path === "/" ? "" : req.path;
      const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      const targetUrl = resolveUpstreamUrl(config, kind, subPath, queryString);
      await proxyJsonRequest(req, res, targetUrl);
    } catch (error) {
      res.status(502).json({
        error: "upstream_proxy_failed",
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  };

export const createServer = (config: PortalConfig): Express => {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/onboarding", proxyHandler(config, "onboarding"));
  app.use("/api/channels", proxyHandler(config, "channels"));
  app.use("/api/skills", proxyHandler(config, "skills"));
  app.use("/api/auth", proxyHandler(config, "auth"));

  app.use(express.static(staticDir));

  // Serve SPA routes for browser-driven onboarding.
  app.get(/^\/(auth\/callback)?$/, (_req: Request, res: Response) => {
    res.sendFile(join(staticDir, "index.html"));
  });

  return app;
};
