// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { OpeningMoment } from "@realms-world/identity";

// The opening interface as the HUD calls it, on the lab's game and the lab's signed-in player, whose account record the
// lab keeps in the tab as the identity service keeps it. Only the network stands in.
const { identityClient, useIdentitySessionStore } = await import("@/hooks/context/identity-session");
const { LAB_SESSION } = await import("@/shell/lab/app-lab-fixtures");
const { answerLabOpening } = await import("@/lab/lab-opening");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { UnifiedHudLab } = await import("@/ui/features/debug/kit-lab/unified-hud-lab");
const { buildingOutput } = await import("@/ui/shared/lib/building-output");
const { setBuildingCount } = await import("@bibliothecadao/eternum");
const { BuildingType, formatAmount, RESOURCE_PRECISION, ResourcesIds } = await import("@bibliothecadao/types");
const { OPENING_PARTS } = await import("./opening");
const { OPENING_LINE_MS, OpeningLine } = await import("./opening-line");
const { ShowEverything } = await import("./show-everything");
const { useOpeningInterface, useOpens, useOpeningStore } = await import("./use-opening");

type Part = keyof typeof OPENING_PARTS;
const PARTS = Object.keys(OPENING_PARTS) as Part[];
const OWNER = LAB_SESSION.user.realmsId!;

let host: HTMLDivElement;
let root: Root;
let restoreOpening: () => void;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  Element.prototype.scrollIntoView = () => {};
  useIdentitySessionStore.getState().applySession(LAB_SESSION);
  useOpeningStore.setState({ owner: null, record: null, opened: "all", lines: [] });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  restoreOpening?.();
  vi.useRealTimers();
});

/** The lab realm's facts a moment reads: its first Barracks, its Essence. */
const barracks = () => ({
  model: "StructureBuildings",
  key: "0xb7",
  value: {
    game_id: 1,
    entity_id: "7",
    ...Object.fromEntries(
      setBuildingCount(BuildingType.ResourceKnightT1, [0n, 0n, 0n], 1).map((packed, index) => [
        `packed_counts_${index + 1}`,
        String(packed),
      ]),
    ),
    population: { current: 2, max: 6 },
  },
});
const essence = (amount: number) => ({
  model: "ResourceBalance",
  key: `0xb5${ResourcesIds.Essence}`,
  value: {
    game_id: 1,
    entity_id: 7,
    resource_type: ResourcesIds.Essence,
    balance: String(BigInt(amount) * BigInt(RESOURCE_PRECISION)),
  },
});

const Part = ({ part }: { part: Part }) => (useOpens(part) ? <i data-part={part} /> : null);

/** The player's own realm as the HUD opens it: which parts show, the line in front, and Settings' switch. */
const Opening = ({ store }: { store: NativeFactStore }) => {
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  useOpeningInterface(realm);
  return (
    <>
      {PARTS.map((part) => (
        <Part key={part} part={part} />
      ))}
      <OpeningLine realm={realm} />
      <ShowEverything />
    </>
  );
};

/** The lab's game with the account's kept moments; `facts` the realm holds before the HUD opens. */
const renderOpening = async (reached: OpeningMoment[], facts: unknown[] = []) => {
  restoreOpening = answerLabOpening(OWNER, reached);
  let shown!: NativeFactStore;
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LabGame preset={5} facts={() => facts}>
            {(store) => {
              shown = store;
              return <Opening store={store} />;
            }}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  return shown;
};

const parts = () => [...host.querySelectorAll("[data-part]")].map((part) => part.getAttribute("data-part"));
const line = () => host.querySelector("[role='status']")?.textContent ?? null;
const gotIt = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Got it");
const kept = async () => {
  const record = await identityClient.getInterfaceOpening();
  return { ...record, reached: record.reached.toSorted() };
};

describe("the interface that opens as you play", () => {
  it("opens a new account's realm on its launch: no part that waits, and the first line", async () => {
    await renderOpening([]);
    expect(parts()).toEqual([]);
    expect(line()).toBe("This is your Realm. Build on the lit plot, then send an army into the mist.Got it");
    expect(await kept()).toEqual({ owner: OWNER, reached: ["launch"], showAll: false });
  });

  it("shows a line once per account: Got it puts it away, and the next session has none", async () => {
    await renderOpening([]);
    await act(async () => gotIt()!.click());
    expect(line()).toBeNull();

    await act(async () => root.unmount());
    root = createRoot(host);
    useOpeningStore.setState({ owner: null, record: null, opened: "all", lines: [] });
    restoreOpening();
    await renderOpening(["launch"]);
    expect(line()).toBeNull();
  });

  it("lets a line go by itself once it has been read", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await renderOpening([]);
    expect(gotIt()).toBeDefined();
    await act(async () => vi.advanceTimersByTime(OPENING_LINE_MS));
    expect(line()).toBeNull();
  });

  it("opens troops at home and the list of buildings with the first Barracks, and says what one raises", async () => {
    const store = await renderOpening(["launch"]);
    await act(async () => store.applyFacts([barracks()] as never));
    const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
    const knights = buildingOutput(store, realm, BuildingType.ResourceKnightT1, 0).base * 3600;
    expect(knights).toBeGreaterThan(0);
    expect(parts()).toEqual(["troops-store", "building-list"]);
    expect(line()).toBe(`A Barracks raises ${formatAmount(knights)} Knights an hour. Knights fill your armies.Got it`);
    expect(await kept()).toEqual({ owner: OWNER, reached: ["barracks", "launch"], showAll: false });
  });

  it("opens Essence, Research and Today with the first Essence", async () => {
    const store = await renderOpening(["launch", "barracks"]);
    await act(async () => store.applyFacts([essence(1_500)] as never));
    expect(parts()).toEqual(["troops-store", "building-list", "essence-store", "research", "today"]);
    expect(line()).toBe("Essence buys research and lores.Got it");
  });

  it("opens Essence, Research and Today with the first quest reward collected, before any Essence is held", async () => {
    const store = await renderOpening(["launch", "barracks"]);
    await act(async () =>
      store.applyFacts([
        {
          model: "LaborGrant",
          key: "0x9f1",
          value: { game_id: 1, home: 7, day: 0, account: 0x111n, amount: 1000n, essence: 0n },
        },
      ] as never),
    );
    expect(parts()).toEqual(["troops-store", "building-list", "essence-store", "research", "today"]);
    expect(line()).toBe("Essence buys research and lores.Got it");
  });

  it("opens the realm's Glory once it earned in the Deep, and says what each tick there costs an army", async () => {
    const store = await renderOpening(["launch", "barracks", "essence"], [barracks(), essence(1_500)]);
    await act(async () =>
      store.applyFacts([
        {
          model: "DeepRules",
          key: "0xd1",
          value: {
            game_id: 1,
            foundation: { alt: false, x: 25, y: 35 },
            quarry: { alt: false, x: 12, y: 20 },
            altar: { alt: false, x: 38, y: 20 },
            beast_count: 10_000n * BigInt(RESOURCE_PRECISION),
            loss_per_tick: 200n * BigInt(RESOURCE_PRECISION),
            quarry_per_tick: 500n,
            altar_per_tick: 5,
            altar_threshold: 1500,
          },
        },
        { model: "RaceMember", key: "0xd2", value: { game_id: 1, entity_id: 7, glory: 0n, contribution: 0n } },
      ] as never),
    );
    const tick = store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds;
    expect(parts()).toEqual(["troops-store", "building-list", "essence-store", "research", "today", "glory"]);
    expect(line()).toBe(
      `Every tick (${formatAmount(Number(tick))} seconds) here, each army loses 200 troops. Hold a site to earn.Got it`,
    );
    expect((await kept()).reached).toEqual(["barracks", "deep", "essence", "launch"]);
  });

  it("keeps without a line what a player's realm already showed before the interface opened", async () => {
    await renderOpening([], [barracks(), essence(1_500)]);
    expect(parts()).toEqual(["troops-store", "building-list", "essence-store", "research", "today"]);
    expect(line()).toBeNull();
    expect(await kept()).toEqual({ owner: OWNER, reached: ["barracks", "essence", "launch"], showAll: false });
  });

  it("keeps a part an earlier day earned: an army that fought is gone, its XP stays shown", async () => {
    await renderOpening(["launch", "fight"]);
    expect(parts()).toEqual(["army-xp"]);
    expect(line()).toBeNull();
  });

  it("shows everything at once, and no line, from Settings' switch, kept on the account", async () => {
    await renderOpening([]);
    const toggle = host.querySelector<HTMLElement>("[role='switch']")!;
    await act(async () => toggle.click());
    expect(parts()).toEqual(PARTS);
    expect(gotIt()).toBeUndefined();
    expect((await kept()).showAll).toBe(true);
  });

  it("shows every part to a signed-out player, who has no account to keep the opening on", async () => {
    useIdentitySessionStore.getState().applySession(null);
    await renderOpening([]);
    expect(parts()).toEqual(PARTS);
    expect(line()).toBeNull();
  });
});

describe("a new player's first minute on the HUD (/lab/kit/unified/frontier-new)", () => {
  const renderView = (view: string) =>
    act(async () =>
      root.render(
        <MemoryRouter initialEntries={[`/unified/${view}`]}>
          <QueryClientProvider client={new QueryClient()}>
            <Routes>
              <Route path="unified/:view?" element={<UnifiedHudLab />} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    );
  const named = (word: string) =>
    [...host.querySelectorAll("button")].some((button) => button.getAttribute("aria-label") === word);

  it("draws the HUD without Research, Today or the stores a new realm has not made, with its first line", async () => {
    await renderView("frontier-new");
    expect(named("Research")).toBe(false);
    expect(named("Today")).toBe(false);
    expect(host.textContent).toContain("This is your Realm.");
  });

  it("draws a seasoned account's HUD whole", async () => {
    await renderView("frontier");
    expect(named("Research")).toBe(true);
    expect(named("Today")).toBe(true);
    expect(host.textContent).not.toContain("This is your Realm.");
  });
});
