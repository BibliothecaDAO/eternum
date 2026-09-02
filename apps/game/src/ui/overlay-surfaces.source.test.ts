// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Overlays have one primitive: the Popover. The surfaces it absorbed — the "not logged in" banner, the sign-in
 * modals, the leaderboard and settings windows — must not come back under another mount or another name.
 */
const SOURCE_ROOT = resolve(process.cwd(), "src");

const ABSORBED_SURFACES = [
  "ui/shared/components/not-logged-in-message.tsx",
  "ui/layouts/no-account-modal.tsx",
  "ui/layouts/sign-in-prompt-modal.tsx",
  "ui/features/social/components/social.tsx",
  "ui/components/transaction-center/transaction-window.tsx",
];

const ABSORBED_NAMES =
  /\b(NotLoggedInMessage|NoAccountModal|SignInPromptModal|SocialWindow|SettingsWindow|TransactionWindow|ShortcutsWindow|LatestFeaturesWindow)\b/;

const ABSORBED_WINDOW_NAMES = /"(Settings|Leaderboard|Rewards|Shortcuts|LatestFeatures|Transactions)"/;

const isSourceFile = (name: string) =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx");

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path);
    return isSourceFile(name) ? [path] : [];
  });

describe("overlay surfaces", () => {
  it("the login banner, the sign-in modals and the utility windows are gone", () => {
    for (const surface of ABSORBED_SURFACES) {
      expect(existsSync(resolve(SOURCE_ROOT, surface)), surface).toBe(false);
    }
  });

  it("nothing mounts them under another name", () => {
    const references = walk(SOURCE_ROOT)
      .filter((path) => ABSORBED_NAMES.test(readFileSync(path, "utf8")))
      .map((path) => relative(SOURCE_ROOT, path));
    expect(references).toEqual([]);
  });

  it("the migrated windows have no popup name left to open them", () => {
    const popupNames = readFileSync(resolve(SOURCE_ROOT, "ui/features/world/components/config.tsx"), "utf8");
    expect(popupNames).not.toMatch(ABSORBED_WINDOW_NAMES);
  });

  it("every sign-in prompt goes through the identity session store", () => {
    const prompts = walk(SOURCE_ROOT)
      .filter((path) => /requestSignIn\(/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SOURCE_ROOT, path))
      .toSorted();
    expect(prompts).toEqual(["ui/features/landing/views/play-view.tsx", "ui/shared/components/endgame-modal.tsx"]);
  });
});
