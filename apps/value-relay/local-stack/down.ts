import { Effect } from "effect";
import { readConfig, prepareState } from "./config";
import { stopStack } from "./lifetime";
const path = process.argv[2];
if (!path) throw new Error("Usage: value-stack:down CONFIG_JSON");
await Effect.runPromise(
  Effect.tryPromise({
    try: async () => {
      const state = await prepareState(await readConfig(path));
      await stopStack(state, path);
      console.log("Local value stack stopped; containers and generated rehearsal state removed.");
    },
    catch: () => new Error("Local stack shutdown failed; no unrelated process was signalled."),
  }),
);
