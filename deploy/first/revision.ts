import { command, CommandFailure } from "./process";
import { PublicError } from "./dates";
import type { Environment } from "./settings";

export async function deploymentRevision(environment: Environment): Promise<string> {
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
