import { readFileSync } from "node:fs";
import { command, CommandFailure } from "./process";
import { PublicError } from "./errors";
import type { Environment } from "./settings";

export const archivedRevision = (): string | undefined => {
  const revision = readFileSync(new URL("./commit.txt", import.meta.url), "utf8").trim();
  return /^[0-9a-f]{40}$/.test(revision) ? revision : undefined;
};

export async function deploymentRevision(environment: Environment): Promise<string> {
  const archived = archivedRevision();
  if (archived) return archived;
  try {
    return JSON.parse(await command({ argv: ["python3", "deploy/athanor/scripts/revision.py", environment] })).revision;
  } catch (error) {
    if (error instanceof CommandFailure) {
      let report;
      try {
        report = JSON.parse(error.stdout);
      } catch {
        /* Subprocess output is private unless it is a structured refusal. */
      }
      if (typeof report?.error === "string") throw new PublicError(report.error);
    }
    throw error;
  }
}
