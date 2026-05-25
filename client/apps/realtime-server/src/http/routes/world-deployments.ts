import { Hono } from "hono";

import { worldDeploymentService } from "../../services/world-deployments";
import type { AppEnv } from "../middleware/auth";

const SUPPORTED_CHAINS = new Set(["mainnet", "sepolia", "slot", "slottest", "local"]);

const worldDeploymentRoutes = new Hono<AppEnv>();

worldDeploymentRoutes.get("/:chain/:worldName", async (c) => {
  const chain = c.req.param("chain");
  const worldName = c.req.param("worldName");

  if (!SUPPORTED_CHAINS.has(chain)) {
    return c.json({ error: "invalid chain" }, 400);
  }

  try {
    const deployment = await worldDeploymentService.getWorldDeployment(chain, worldName);
    if (!deployment) {
      return c.json({ error: "world deployment not found" }, 404);
    }

    c.header("X-Cache-Status", deployment.cacheStatus);
    return c.json(deployment);
  } catch {
    return c.json({ error: "deployment lookup unavailable" }, 503);
  }
});

export default worldDeploymentRoutes;
