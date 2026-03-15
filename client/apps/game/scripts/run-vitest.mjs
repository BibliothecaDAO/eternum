import { spawn } from "node:child_process";

import { normalizeVitestTargetArgs } from "./vitest-target-args.mjs";

const forwardedArgs = normalizeVitestTargetArgs(process.argv.slice(2));
const child = spawn("pnpm", ["exec", "vitest", "run", ...forwardedArgs], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
