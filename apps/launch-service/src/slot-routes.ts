import { Hono } from "hono";
import type { LaunchAppEnv } from "./auth";
import { SlotConflict, SlotNotFound, type SlotStore } from "./slots";

/** A player registers as their Realms account; the slot records the gameplay account it will have on the shard. */
export function createSlotRoutes(store: SlotStore, playerAccount: (realmsId: string) => Promise<string>) {
  const app = new Hono<LaunchAppEnv>();
  app.onError((error, context) => {
    if (error instanceof SlotNotFound) return context.json({ error: error.message }, 404);
    if (error instanceof SlotConflict) return context.json({ error: error.message }, 409);
    console.error("playtest_slot_failed", error);
    return context.json({ error: "Playtest registration unavailable" }, 503);
  });
  app.get("/", async (context) => context.json({ slots: await store.list() }));
  app.post("/:name/register", async (context) => {
    const { realmsId } = context.get("identity");
    const account = await playerAccount(realmsId);
    return context.json(await store.register(context.req.param("name"), { realmsId, account }));
  });
  return app;
}
