import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth";
import { availabilityService } from "../../services/torii-availability";

const worldsRoutes = new Hono<AppEnv>();

worldsRoutes.get("/summary", (c) => {
  c.header("Cache-Control", availabilityService.isSummaryReady() ? "public, max-age=10" : "no-store");
  return c.json(availabilityService.getSummaries());
});

export default worldsRoutes;
