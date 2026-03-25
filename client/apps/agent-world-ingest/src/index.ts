import { Hono } from "hono";

import { worldIngestJobSchema } from "@bibliothecadao/types";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.post("/jobs/world-ingest", async (c) => {
  const job = worldIngestJobSchema.parse(await c.req.json());
  return c.json({
    accepted: true,
    worldId: job.worldId,
    message: "Bind a concrete WorldIngestServices implementation to execute world ingest jobs in this service.",
  });
});

export default app;
