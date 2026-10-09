import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Caller holds the shared build lock; this also builds the exact bundles exercised by the local topology test. */
export const buildBundles = async (root: string, directory: string) => {
  for (const [app, config] of [
    ["guardian", "wrangler.jsonc"],
    ["realms", "wrangler.jsonc"],
    ["launch-service", "wrangler.jsonc"],
    ["value-relay", "wrangler.jsonc"],
    ["value-relay", "monitor.wrangler.jsonc"],
    ["value-relay", "local-stack/edge.wrangler.jsonc"],
  ] as const) {
    const output = join(directory, app, config.replaceAll("/", "-").replace(".jsonc", ""));
    await mkdir(output, { recursive: true, mode: 0o700 });
    execFileSync(
      "pnpm",
      ["exec", "wrangler", "deploy", "--dry-run", "--env", "staging", "--config", config, "--outdir", output],
      { cwd: join(root, "apps", app), stdio: "ignore" },
    );
  }
};
if (process.argv[1]?.endsWith("/local-stack/bundle.ts")) {
  if (!process.argv[2]) throw new Error("Bundle output directory required");
  await buildBundles(resolve(import.meta.dirname, "../../.."), process.argv[2]);
}
