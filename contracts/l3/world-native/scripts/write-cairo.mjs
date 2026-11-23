import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

export async function writeCairo(path, value) {
  const temporary = await mkdtemp(fileURLToPath(new URL("src/.command-routes-", root)));
  try {
    const input = join(temporary, "routes.cairo");
    await writeFile(input, value);
    execFileSync("scarb", ["fmt", input], { cwd: fileURLToPath(root), encoding: "utf8" });
    const formatted = await readFile(input, "utf8");
    const target = new URL(path, root);
    if (process.argv.includes("--check")) {
      if ((await readFile(target, "utf8")) !== formatted) throw new Error(`Generated artifact differs: ${path}`);
    } else {
      await writeFile(target, formatted);
    }
  } finally {
    await rm(temporary, { recursive: true });
  }
}
