import { isPublicGameName } from "./schemas";
import { BLITZ_SLOT_NAME_PATTERN } from "@realms-world/identity";
import { Schema } from "effect";
import { Hono, type Context } from "hono";
import { isLauncher, type LaunchAccess, type LaunchAppEnv } from "./auth";
import { SlotConflict, SlotNotFound, type SlotStore } from "./slots";

const CreateSlotRequest = Schema.Struct({
  name: Schema.String.pipe(
    Schema.check(Schema.isPattern(BLITZ_SLOT_NAME_PATTERN)),
    Schema.check(Schema.makeFilter((name: string) => isPublicGameName(name) && isPublicGameName(`${name}-1`))),
  ),
  closesAt: Schema.String.pipe(Schema.check(Schema.makeFilter((value: string) => Number.isFinite(Date.parse(value))))),
});

class InvalidSlotRequest extends Error {}

/** A body read against its schema; an empty body is an empty object. */
const readBody = async <S extends Schema.Top>(context: Context<LaunchAppEnv>, schema: S): Promise<S["Type"]> => {
  const text = await context.req.text();
  try {
    return Schema.decodeUnknownSync(schema as never)(text.trim() ? JSON.parse(text) : {}) as S["Type"];
  } catch {
    throw new InvalidSlotRequest("Invalid slot request");
  }
};

/** Slot discovery and operator scheduling; players pay registration on the ledger. */
export function createSlotRoutes(store: SlotStore, access: Pick<LaunchAccess, "launcherAllowlist">) {
  const app = new Hono<LaunchAppEnv>();
  app.onError((error, context) => {
    if (error instanceof SlotNotFound) return context.json({ error: error.message }, 404);
    if (error instanceof SlotConflict) return context.json({ error: error.message }, 409);
    if (error instanceof InvalidSlotRequest) return context.json({ error: error.message }, 400);
    console.error("playtest_slot_failed", error);
    return context.json({ error: "Slot unavailable" }, 503);
  });
  const forbidden = (context: Context<LaunchAppEnv>) =>
    context.json({ error: "This identity is not allowed to launch games." }, 403);

  app.get("/", async (context) => context.json({ slots: await store.list() }));
  app.get("/:name", async (context) => {
    context.header("Cache-Control", "no-store");
    const name = context.req.param("name");
    if (!BLITZ_SLOT_NAME_PATTERN.test(name)) return context.json({ error: "Invalid slot name" }, 400);
    return context.json(await store.get(name));
  });

  app.post("/", async (context) => {
    if (!isLauncher(context.get("caller"), access)) return forbidden(context);
    const { name, closesAt } = await readBody(context, CreateSlotRequest);
    await store.create(name, closesAt);
    return context.json({ name, status: "opening" }, 202);
  });

  return app;
}
