import { Effect, Schema } from "effect";
import { Hono } from "hono";
import { requireLauncher, type LaunchAccess, type LaunchAppEnv } from "./auth";
import { SlotConflict, SlotNotFound, type SlotStore } from "./slots";

const SlotRequest = Schema.Struct({
  name: Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-z0-9][a-z0-9-]{0,23}$/))),
  closesAt: Schema.NonEmptyString,
});

export function createSlotRoutes(store: SlotStore, config: LaunchAccess) {
  const app = new Hono<LaunchAppEnv>();
  app.onError((error, context) => {
    if (error instanceof SlotNotFound) return context.json({ error: error.message }, 404);
    if (error instanceof SlotConflict) return context.json({ error: error.message }, 409);
    console.error("playtest_slot_failed", error);
    return context.json({ error: "Playtest registration unavailable" }, 503);
  });
  app.get("/", async (context) => context.json({ slots: await store.list() }));
  app.post("/", requireLauncher(config), async (context) => {
    let request;
    try {
      request = await Effect.runPromise(Schema.decodeUnknownEffect(SlotRequest)(await context.req.json()));
      if (!Number.isFinite(Date.parse(request.closesAt))) throw new Error("Invalid registration deadline");
    } catch {
      return context.json({ error: "A slot name and valid registration deadline are required" }, 400);
    }
    return context.json(await store.create(request.name, new Date(request.closesAt).toISOString()), 201);
  });
  app.post("/:name/register", async (context) =>
    context.json(await store.register(context.req.param("name"), context.get("launcherAddress"))),
  );
  app.post("/:name/close", requireLauncher(config), async (context) =>
    context.json(await store.freeze(context.req.param("name"))),
  );
  return app;
}
