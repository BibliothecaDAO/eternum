import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth";
import { availabilityService } from "../../services/torii-availability";

const worldsRoutes = new Hono<AppEnv>();

worldsRoutes.get("/summary", (c) => {
  c.header("Cache-Control", "public, max-age=10");
  return c.json(availabilityService.getSummaries());
});

export default worldsRoutes;
