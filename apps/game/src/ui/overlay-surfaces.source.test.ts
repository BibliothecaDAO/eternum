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
  "ui/features/economy/resources/realm-transfer-manager.tsx",
  "ui/features/infrastructure/automation/production-automation-dashboard.tsx",
  "ui/features/military/components/exploration-automation-dashboard.tsx",
  "ui/features/world/containers/top-navigation.tsx",
  "ui/features/world/components/config.tsx",
  "hooks/store/use-popups-store.ts",
  "ui/shared/components/endgame-modal.tsx",
  "ui/features/landing/components/game-is-over-modal.tsx",
];

const ABSORBED_NAMES =
  /\b(NotLoggedInMessage|NoAccountModal|SignInPromptModal|SocialWindow|SettingsWindow|TransactionWindow|ShortcutsWindow|LatestFeaturesWindow|RealmTransferManager|ProductionAutomationWindow|ExplorationAutomationWindow|TopNavigation|openedPopups|togglePopup|isPopupOpen|EndgameModal|GameIsOverModal)\b/;

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

  it("every sign-in prompt goes through the identity session store", () => {
    const prompts = walk(SOURCE_ROOT)
      .filter((path) => /requestSignIn\(/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SOURCE_ROOT, path))
      .toSorted();
    expect(prompts).toEqual(["ui/features/landing/views/play-view.tsx"]);
  });
});
