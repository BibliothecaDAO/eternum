import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth";
import { availabilityService } from "../../services/torii-availability";

const worldsRoutes = new Hono<AppEnv>();

worldsRoutes.get("/summary", (c) => {
  const cacheControl = availabilityService.isSummaryReady() ? "public, max-age=10" : "no-store";
  return c.json(availabilityService.getSummaries(), 200, { "Cache-Control": cacheControl });
});

export default worldsRoutes;
