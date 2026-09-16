import { writeFile } from "node:fs/promises";

/** Bun's file redirection overwrites from offset zero without truncating an existing log. */
export async function executionLog(path: string) {
  await writeFile(path, "");
  return Bun.file(path);
}
