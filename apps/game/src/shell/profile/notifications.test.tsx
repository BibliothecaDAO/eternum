import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  includesArmyRestedNotification,
  includesDeepSiteNotification,
  includesKind,
  includesStoryNotification,
  NOTIFICATION_KINDS,
  NOTIFICATION_LEVELS,
  storyNotificationRule,
} from "@bibliothecadao/notifications";
import { nativeStoryVariants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { NOTIFICATION_KIND_WORDS } from "@/ui/design-system/kit/words";

const save = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "0x7" } } }),
  notificationOwnerOf: () => "0x7",
  identityClient: { getPushConfiguration: async () => ({ enabled: false }) },
}));
vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: () => ({
    status: "ready",
    saved: { level: "important", revision: 1 },
    save,
    reload: vi.fn(),
  }),
}));

import { levelMeaning } from "./level-meaning";
import { NotificationsCard } from "./notifications";

it("offers three levels, lights the saved one with what it brings, and saves the level tapped", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<NotificationsCard />));
  try {
    const levels = [...container.querySelectorAll('[role="tab"]')];
    expect(levels.map((level) => level.textContent)).toEqual(["Off", "Important", "All"]);
    expect(levels.filter((level) => level.getAttribute("aria-selected") === "true").map((l) => l.textContent)).toEqual([
      "Important",
    ]);
    expect(container.textContent).toContain(
      "Each day's opening, rested armies, Deep sites you can take, fights, results and messages",
    );
    await act(async () => (levels[2] as HTMLButtonElement).click());
    expect(save).toHaveBeenCalledWith("all");
    expect(container.textContent).toContain("This device");
  } finally {
    await act(async () => root.unmount());
  }
});

it("says what each level brings in words the server delivers by", () => {
  expect(levelMeaning("off")).toBe("No alerts");
  expect(levelMeaning("all")).toBe("Important, plus deliveries and trades, Bitcoin payouts and Hyperstructure points");
});

/** Every kind a level's line names, with the lines of the levels below it, which it carries too. */
const namedAt = (level: (typeof NOTIFICATION_LEVELS)[number]) => {
  const lines = NOTIFICATION_LEVELS.slice(0, NOTIFICATION_LEVELS.indexOf(level) + 1)
    .map(levelMeaning)
    .join(" / ")
    .toLowerCase();
  return NOTIFICATION_KINDS.filter((kind) => lines.includes(NOTIFICATION_KIND_WORDS[kind].toLowerCase()));
};

it("names, at each level, exactly the kinds the server pushes at that level", () => {
  for (const level of NOTIFICATION_LEVELS) {
    const pushed = NOTIFICATION_KINDS.filter((kind) => includesKind(level, kind));
    expect(namedAt(level), level).toEqual(pushed);
    // The server's own deciders, story by story and for rested armies, agree with what Settings names.
    for (const story of [...nativeStoryVariants, "BattleEvent", "RaidEvent"]) {
      const rule = storyNotificationRule(story);
      if ("excluded" in rule) continue;
      expect(includesStoryNotification(level, story, "blitz"), `${story} at ${level}`).toBe(pushed.includes(rule.kind));
    }
    expect(includesArmyRestedNotification(level)).toBe(pushed.includes("army-rested"));
    expect(includesDeepSiteNotification(level)).toBe(pushed.includes("deep-sites"));
  }
});
