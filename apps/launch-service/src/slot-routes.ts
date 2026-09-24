import { Schema } from "effect";
import { Hono, type Context } from "hono";
import { isLauncher, type LaunchAccess, type LaunchAppEnv } from "./auth";
import { SlotConflict, SlotNotFound, type SlotPlayer, type SlotStore } from "./slots";

/** A launcher registers at most this many accounts per call; larger rosters take several calls. */
const ACCOUNTS_PER_CALL = 96;

const Hex = Schema.String.pipe(Schema.check(Schema.isPattern(/^0x[0-9a-fA-F]{1,64}$/)));
const RegisterRequest = Schema.Struct({
  accounts: Schema.optional(
    Schema.Array(Hex).pipe(Schema.check(Schema.isMinLength(1)), Schema.check(Schema.isMaxLength(ACCOUNTS_PER_CALL))),
  ),
});
const CreateSlotRequest = Schema.Struct({
  name: Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-z0-9][a-z0-9-]{0,23}$/))),
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

/**
 * Free Blitz slots. A player registers as their Realms account, and the slot records the gameplay account it will
 * have on the shard. A launcher (an allowlisted wallet or the operator) also creates slots off the timetable and
 * registers accounts directly, for harness runs and invited rosters, through the same store rules.
 */
export function createSlotRoutes(
  store: SlotStore,
  playerAccount: (realmsId: string) => Promise<string>,
  access: Pick<LaunchAccess, "launcherAllowlist">,
) {
  const app = new Hono<LaunchAppEnv>();
  app.onError((error, context) => {
    if (error instanceof SlotNotFound) return context.json({ error: error.message }, 404);
    if (error instanceof SlotConflict) return context.json({ error: error.message }, 409);
    if (error instanceof InvalidSlotRequest) return context.json({ error: error.message }, 400);
    console.error("playtest_slot_failed", error);
    return context.json({ error: "Playtest registration unavailable" }, 503);
  });
  const forbidden = (context: Context<LaunchAppEnv>) =>
    context.json({ error: "This identity is not allowed to launch games." }, 403);

  app.get("/", async (context) => context.json({ slots: await store.list() }));

  app.post("/", async (context) => {
    if (!isLauncher(context.get("caller"), access)) return forbidden(context);
    const { name, closesAt } = await readBody(context, CreateSlotRequest);
    return context.json(await store.create(name, closesAt));
  });

  app.post("/:name/register", async (context) => {
    const caller = context.get("caller");
    const { accounts } = await readBody(context, RegisterRequest);
    let players: SlotPlayer[];
    if (accounts) {
      if (!isLauncher(caller, access)) return forbidden(context);
      players = accounts.map((account) => ({ realmsId: null, account }));
    } else if (caller.kind === "session") {
      players = [{ realmsId: caller.realmsId, account: await playerAccount(caller.realmsId) }];
    } else {
      return context.json({ error: "Only a Realms account registers itself." }, 400);
    }
    return context.json(await store.register(context.req.param("name"), players));
  });
  return app;
}
