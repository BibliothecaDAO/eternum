import { BLITZ_SLOT_NAME_PATTERN } from "@realms-world/identity";
import { Hono } from "hono";
import { SlotNotFound, type SlotStore } from "./slots";

export function createSlotRoutes(store: SlotStore) {
  const app = new Hono();
  app.onError((error, context) => {
    if (error instanceof SlotNotFound) return context.json({ error: error.message }, 404);
    console.error("playtest_slot_failed", error);
    return context.json({ error: "Slot unavailable" }, 503);
  });

  app.get("/", async (context) => context.json({ slots: await store.list() }));
  app.get("/:name", async (context) => {
    context.header("Cache-Control", "no-store");
    const name = context.req.param("name");
    if (!BLITZ_SLOT_NAME_PATTERN.test(name)) return context.json({ error: "Invalid slot name" }, 400);
    return context.json(await store.get(name));
  });

  app.post("/:name/refund", async (context) => {
    const name = context.req.param("name");
    if (!BLITZ_SLOT_NAME_PATTERN.test(name)) return context.json({ error: "Invalid slot name" }, 400);
    const retryAfterSeconds = await store.refund(name);
    return context.json(
      { refundsEnabled: retryAfterSeconds === null, retryAfterSeconds },
      retryAfterSeconds === null ? 200 : 409,
    );
  });
  return app;
}
