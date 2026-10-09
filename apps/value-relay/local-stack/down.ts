import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readConfig, readPrivate, prepareState } from "./config";
import { Effect } from "effect";
const path = process.argv[2];
if (!path) throw new Error("Usage: value-stack:down CONFIG_JSON");
await Effect.runPromise(
  Effect.tryPromise({
    try: async () => {
      const state = await prepareState(await readConfig(path));
      const record = await readPrivate<{ pid: number; configPath: string }>(state.pid);
      const command = await readFile(`/proc/${record.pid}/cmdline`, "utf8");
      if (
        !Number.isSafeInteger(record.pid) ||
        record.pid <= 1 ||
        record.configPath !== resolve(path) ||
        !command.includes("local-stack/up.ts") ||
        !command.includes(path)
      )
        throw new Error("stack_process_identity_differs");
      process.kill(record.pid, "SIGTERM");
      for (let attempt = 0; attempt < 120; attempt++) {
        try {
          await readFile(state.pid);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            console.log("Local value stack stopped; protected rehearsal files are retained.");
            return;
          }
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error("stack_shutdown_timeout");
    },
    catch: () => new Error("Local stack shutdown refused: no matching owned supervisor."),
  }),
);
