import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, writeFileSync, linkSync, unlinkSync } from "node:fs";

/** Protected credentials belong to the reading process, with no group or other access. */
export function readPrivateJson<T>(path: string): T {
  const stat = lstatSync(path);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.uid !== process.geteuid!())
    throw new Error("Protected credential must be owned by the reading process with mode 0600");
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw new Error(
      "Incomplete credential: restore the same shard's private backup before retrying; never replace a deployed key",
    );
  }
}

/** Publish only a complete file; interruption must never strand a partially written key at its final path. */
export function writePrivateJsonOnce(path: string, value: unknown): void {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(value) + "\n", { mode: 0o600, flag: "wx" });
    linkSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
