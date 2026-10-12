import { command } from "./process";
import { PublicError } from "./dates";
import type { Deployment } from "./main";
import type { Step } from "./run";

export function addressBookStep(context: Deployment): Step {
  const wait = (detail: string) => ({ done: false, waiting: detail, detail });
  return {
    name: "Public address book commit",
    payer: "none",
    cost: "0 STRK",
    inspect: async () => {
      if (!context.assets) return wait("Contracts not yet published");
      const book = `contracts/common/addresses/${context.target.book}`;
      const diff = await command({ argv: ["git", "status", "--porcelain", "--", book] });
      return {
        done: !diff.trim(),
        detail: "commit and push only the public address book; no private state enters git",
      };
    },
    apply: async () => {
      const book = `contracts/common/addresses/${context.target.book}`;
      const staged = (await command({ argv: ["git", "diff", "--cached", "--name-only"] }))
        .trim()
        .split("\n")
        .filter(Boolean);
      if (staged.some((path) => path !== book))
        throw new Error("Unrelated staged changes must be handled before publishing the address book");
      const dirty = (await command({ argv: ["git", "status", "--porcelain", "--", book] })).trim();
      const branch = (await command({ argv: ["git", "branch", "--show-current"] })).trim();
      if (!branch || branch === "next")
        throw new PublicError("Create a branch for the public address book, push it to origin, then rerun.");
      if (dirty) {
        await command({ argv: ["git", "add", "--", book] });
        await command({
          argv: ["git", "commit", "-m", `Publish ${context.environment} value contract addresses`, "--", book],
        });
      }
      await command({ argv: ["git", "fetch", "origin"] });
      const remote = (
        await command({ argv: ["git", "for-each-ref", "--format=%(refname)", `refs/remotes/origin/${branch}`] })
      ).trim();
      await command({ argv: ["git", "rebase", remote || "origin/next"] });
      await command({ argv: ["git", "push", "origin", `HEAD:${branch}`] });
      throw new PublicError(
        "Public address book pushed. Rerun from this pushed commit; production requires its merge to next and green push validation.",
      );
    },
  };
}
