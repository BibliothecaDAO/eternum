import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth";
import { availabilityService } from "../../services/torii-availability";

const availabilityRoutes = new Hono<AppEnv>();

availabilityRoutes.get("/worlds", (c) => {
  return c.json(availabilityService.getAvailability());
});

export default availabilityRoutes;
