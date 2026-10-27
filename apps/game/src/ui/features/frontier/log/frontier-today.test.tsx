import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { StructureType } from "@bibliothecadao/types";

/** The watched realm's owner; the viewer is a spectator, signed in to no account. */
const OWNER = 0x5eed0154n;
const NOW = 60;
const asked = vi.hoisted(() => ({
  owners: [] as Array<string | undefined>,
  failed: false,
  retried: 0,
  siteBenefits: false,
}));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => NOW }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: new NativeFactStore() } }) }));
vi.mock("../hud/dock-armies", () => ({
  useDockArmies: (realm: unknown) => (realm ? [{ explorerId: 9, canBuyTier: true }] : []),
}));
// History answers for the owner it is asked about: the watched player cleared a camp today.
vi.mock("@/hooks/store/use-story-events-store", () => ({
  useStoryEvents: (_limit: number, _story: string | undefined, owner: string | undefined) => {
    asked.owners.push(owner);
    const theirs = owner !== undefined && BigInt(owner) === OWNER;
    // A failed first read, as the query library leaves it: not pending, an error, and no history behind it.
    if (asked.failed)
      return {
        data: [],
        isPending: false,
        isSuccess: false,
        isError: true,
        refetch: () => (asked.retried += 1),
      };
    return {
      data: theirs
        ? asked.siteBenefits
          ? [{ Shrine: 200 }, { Well: 5 }].map((benefit, index) => {
              const storyPayload = { explorer_id: 9, coord: { x: 3, y: 4 }, benefit };
              return {
                id: `site-use-${index}`,
                story: "SiteUsed",
                owner: `0x${OWNER.toString(16)}`,
                timestampMs: 30_000,
                storyPayload,
                presentation: buildStoryEventPresentation({
                  storyType: "SiteUsed",
                  storyPayload,
                  entityId: 9,
                  ownerAddress: `0x${OWNER.toString(16)}`,
                  viewerAddress: `0x${OWNER.toString(16)}`,
                } as never),
              };
            })
          : [
              {
                id: "clear",
                story: "SitePayout",
                owner: `0x${OWNER.toString(16)}`,
                timestampMs: 30_000,
                storyPayload: { category: StructureType.Camp, reward: null },
                presentation: { title: "Embergrasp cleared" },
              },
            ]
        : [],
      isPending: false,
      isSuccess: true,
      isError: false,
      // The owner's whole history fits the read.
      holdsSince: 0,
      refetch: vi.fn(),
    };
  },
}));

const { FrontierToday } = await import("./frontier-today");

it("shows a spectator the watched realm's day, its owner's clears counted, with no armies row to open", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const rules = { dayUnitSeconds: 100, seed: 1n, startMainAt: 0 } as never;
  const watched = { entity_id: 7, owner: OWNER } as never;
  act(() => root.render(<FrontierToday rules={rules} realm={watched} onClose={() => undefined} />));
  try {
    expect(asked.owners.at(-1)).toBeDefined();
    expect(BigInt(asked.owners.at(-1)!)).toBe(OWNER);
    expect(host.querySelector('[role="img"][aria-label="Sites cleared 1"]')).not.toBeNull();
    expect(host.textContent).toContain("Embergrasp cleared");
    // Upgrading armies is the owner's to do: a spectator's Today offers no row for it.
    expect(host.querySelector('[data-icon="picks"]')).toBeNull();
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("leaves every total unknown when the history read fails, with Retry, never six zeroes (review P3)", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  asked.failed = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const rules = { dayUnitSeconds: 100, seed: 1n, startMainAt: 0 } as never;
  const watched = { entity_id: 7, owner: OWNER } as never;
  act(() => root.render(<FrontierToday rules={rules} realm={watched} onClose={() => undefined} />));
  try {
    expect(BigInt(asked.owners.at(-1)!)).toBe(OWNER);
    expect(
      [...host.querySelectorAll('[role="img"][aria-label]')].map((cell) => cell.getAttribute("aria-label")),
    ).toEqual(["Reveals —", "Sites cleared —", "Chests —", "Essence —", "Labor —", "LORDS —"]);
    const retry = [...host.querySelectorAll("button")].find((button) => button.textContent === "Try again")!;
    act(() => retry.click());
    expect(asked.retried).toBe(1);
  } finally {
    asked.failed = false;
    act(() => root.unmount());
    host.remove();
  }
});

it("Today loads the owner's shrine and well use from history, with the exact recorded benefits", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  asked.failed = false;
  asked.siteBenefits = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <FrontierToday
          rules={{ dayUnitSeconds: 100, seed: 1n, startMainAt: 0 } as never}
          realm={{ entity_id: 7, owner: OWNER } as never}
          onClose={() => undefined}
        />,
      ),
    );
    expect(host.textContent).toContain("Shrine used, +200 XP");
    expect(host.textContent).toContain("Well used, +5 stamina");
    expect(host.textContent).not.toContain("+60 stamina");
    expect(host.querySelector('[role="img"][aria-label="Sites cleared 0"]')).not.toBeNull();
  } finally {
    act(() => root.unmount());
    asked.siteBenefits = false;
  }
});
