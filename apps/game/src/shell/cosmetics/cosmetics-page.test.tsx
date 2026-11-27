import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { AccountInterface } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HeraldPlayerStructure } from "@bibliothecadao/eternum/game-sync";
import { TransactionNoAnswerError } from "@bibliothecadao/eternum/game-client";
import { aspectName, seasonGameName, StructureType } from "@bibliothecadao/types";

const directory = vi.hoisted(() => ({ games: [] as unknown[] | null, confirmedBlock: 10 }));
vi.mock("../herald", async (original) => ({
  ...(await original<typeof import("../herald")>()),
  useDirectory: () => ({
    data: directory.games === null ? undefined : { games: directory.games, confirmedBlock: directory.confirmedBlock },
    isPending: directory.games === null,
    isError: false,
    refetch: async () => {},
  }),
}));
const player = vi.hoisted(() => ({
  signedIn: false,
  refused: false,
  outcomeMissing: false,
  beforeOutcome: async () => {},
  reportedBlock: 11 as number | null,
  beforeAttach: () => {},
  activeGame: null as { chainId: string; gameId: number } | null,
  sent: [] as { context: unknown; command: unknown }[],
}));
vi.mock("@/hooks/context/identity-session", async (original) => {
  const actual = await original<typeof import("@/hooks/context/identity-session")>();
  const session = () => ({
    status: player.signedIn ? "signed-in" : "signed-out",
    session: player.signedIn
      ? { session: { id: "signed-in-test" }, user: { image: null, name: "Aldric", realmsId: "0x123" } }
      : null,
  });
  return {
    ...actual,
    useIdentitySession: session,
    useIdentitySessionStore: Object.assign(actual.useIdentitySessionStore, {
      getState: session,
    }),
  };
});
const testSigner = vi.hoisted(() => ({
  address: "0x1",
  getChainId: async () => "0x52",
  getTransactionReceipt: vi.fn<() => Promise<{ block_number: number }>>(async () => ({ block_number: 15 })),
}));
const joinGameplayAccount = vi.hoisted(() => vi.fn(async () => testSigner));
vi.mock("@/hooks/context/gameplay-account-sync", async (original) => ({
  ...(await original<typeof import("@/hooks/context/gameplay-account-sync")>()),
  joinGameplayAccount,
}));
vi.mock("@/runtime/world/store", async (original) => ({
  ...(await original<typeof import("@/runtime/world/store")>()),
  getActiveGame: () => player.activeGame,
}));
vi.mock("@/runtime/world/shards", () => ({
  requireOpenShard: async (chainId: string) => ({ chainId }),
}));
vi.mock("@/init/bootstrap", () => ({
  attachGameClient: async (context: unknown) => {
    player.beforeAttach();
    return {
      shard: { worldAddress: "0x1ab" },
      setup: {
        systemCalls: {
          set_realm_skin: async (command: unknown) => {
            player.sent.push({ context, command });
            return { transaction_hash: "0x1" };
          },
        },
      },
      waitForAction: async (hash: string) => {
        await player.beforeOutcome();
        if (player.outcomeMissing) throw new TransactionNoAnswerError(hash);
        return player.refused
          ? { hash, block: 11, status: "REJECTED", revertReason: "game is over" }
          : { hash, block: player.reportedBlock, status: "SUCCEEDED" };
      },
    };
  },
}));

import { DeviceLimitError, DeviceRemovedError, REALM_SKIN_FAMILIES } from "@bibliothecadao/eternum";
import { isAccountStatePrompt } from "@/hooks/context/gameplay-account-sync";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { REALM_SKINS } from "@/three/cosmetics/realm-skins";
import { COSMETICS_WORDS, DOORWAY_WORDS, TRY_AGAIN } from "@/ui/design-system/kit/words";

import { setViewportWidth } from "../frame/test-viewport";
import { DEVICES_PATH, PROFILE_PATH } from "../profile/settings-route";
import { FRAGMENTS_PATH } from "../shop/fragments-route";
import { CosmeticsPage } from "./cosmetics-page";
import { COSMETICS_HASH, COSMETICS_PATH } from "./cosmetics-route";

const NOW = Math.floor(Date.now() / 1000);

const realm = (over: Partial<HeraldPlayerStructure>): HeraldPlayerStructure => ({
  entity_id: 1,
  category: StructureType.Realm,
  level: 2,
  realm_id: 7,
  coord_x: 0,
  coord_y: 0,
  resources_packed: "0",
  aspect: null,
  has_wonder: false,
  realm_skin: 0,
  ...over,
});

const season = (structures: HeraldPlayerStructure[], ancient_seal: boolean) => ({
  chainId: "0x52",
  game_id: 1,
  name: seasonGameName(NOW - 1_000),
  mode: "frontier",
  status: "Live",
  realm_skin_enabled: true,
  clock: { start_main_at: NOW - 1_000, end_at: NOW + 100_000 },
  player_state: { registered: true, settled: true, structures, fragments: null, ancient_seal },
});

const Where = () => {
  const { pathname, hash } = useLocation();
  return <output data-where>{`${pathname}${hash}`}</output>;
};

let root: Root | null = null;
afterEach(async () => {
  if (root) {
    directory.confirmedBlock = 15;
    await drawAgain();
  }
  await act(async () => root?.unmount());
  root = null;
  player.signedIn = false;
  player.refused = false;
  player.outcomeMissing = false;
  player.beforeOutcome = async () => {};
  player.reportedBlock = 11;
  player.beforeAttach = () => {};
  player.activeGame = null;
  player.sent = [];
  directory.confirmedBlock = 10;
  joinGameplayAccount.mockClear();
  testSigner.getTransactionReceipt.mockReset().mockResolvedValue({ block_number: 15 });
  useAccountStore.getState().setGameplayAccount(null, null);
});

const open = async (width = 1440) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  root = createRoot(container);
  await drawAgain();
  return container;
};

const queries = new QueryClient();
const drawAgain = () =>
  act(async () =>
    root!.render(
      <QueryClientProvider client={queries}>
        <MemoryRouter initialEntries={[COSMETICS_PATH]}>
          <Routes>
            <Route path={COSMETICS_PATH} element={<CosmeticsPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );

const standings = (container: HTMLElement) =>
  Object.fromEntries(
    [...container.querySelectorAll<HTMLElement>("[data-skin]")].map((card) => [
      card.dataset.skin,
      card.dataset.standing,
    ]),
  );

const buttonNamed = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === name);

const press = (container: HTMLElement, name: string) =>
  act(async () => {
    buttonNamed(container, name)!.click();
    await vi.dynamicImportSettled();
  });

const pick = async (container: HTMLElement, skin: string) =>
  act(async () => container.querySelector<HTMLElement>(`[data-skin="${skin}"]`)!.click());

describe("the Cosmetics page", () => {
  it("shows every realm skin of the catalog once, each in its family", async () => {
    directory.games = [];
    const container = await open();
    expect(Object.keys(standings(container)).sort()).toEqual(REALM_SKINS.map((skin) => skin.id).sort());
    for (const skin of REALM_SKINS)
      expect(
        container.querySelector(`[data-family="${skin.family}"] [data-skin="${skin.id}"]`),
        skin.id,
      ).not.toBeNull();
  });

  it("owns only the base skin for a player the season knows nothing of", async () => {
    directory.games = [];
    const container = await open();
    expect(container.querySelector('[data-preview="base"]')).not.toBeNull();
    expect(container.querySelector('[data-standing="equipped"]')).toBeNull();
    expect(standings(container)).toEqual({
      "wonder-prowess": "wonder",
      "wonder-luminary": "wonder",
      "wonder-havoc": "wonder",
      "wonder-insight": "wonder",
      "season-1-prowess": "pass",
      "season-1-luminary": "pass",
      "season-1-havoc": "pass",
      "season-1-insight": "pass",
      devcon: "event",
      "devcon-golden": "event",
      base: "owned",
    });
  });

  it("owns all four Season 1 Aspect skins once the Seal is held, and only the Wonder skin of a Wonder realm", async () => {
    directory.games = [season([realm({ aspect: 3, has_wonder: true })], true)];
    const owned = Object.entries(standings(await open()))
      .filter(([, standing]) => standing === "owned")
      .map(([skin]) => skin);
    expect(owned.sort()).toEqual([
      "base",
      "season-1-havoc",
      "season-1-insight",
      "season-1-luminary",
      "season-1-prowess",
      "wonder-havoc",
    ]);
  });

  it("shows 4 of 4 Season 1 skins owned with Pass and marks the other three Aspects as not wearable on this Realm", async () => {
    player.signedIn = true;
    directory.games = [season([realm({ entity_id: 7, aspect: 2 })], true)];
    const container = await open();
    expect(container.textContent).toContain(COSMETICS_WORDS.ownedOfPass(4, 4));
    expect(container.querySelector(".cosmetics__owned")?.textContent).toBe(COSMETICS_WORDS.ownedCount(5));

    const luminaryCard = container.querySelector<HTMLElement>('[data-skin="season-1-luminary"]')!;
    expect(luminaryCard.dataset.standing).toBe("owned");
    expect(luminaryCard.dataset.wearable).toBe("true");
    expect(luminaryCard.dataset.otherAspect).toBeUndefined();

    for (const other of [
      { id: "season-1-prowess", aspect: 1 as const },
      { id: "season-1-havoc", aspect: 3 as const },
      { id: "season-1-insight", aspect: 4 as const },
    ]) {
      const card = container.querySelector<HTMLElement>(`[data-skin="${other.id}"]`)!;
      expect(card.dataset.standing).toBe("owned");
      expect(card.dataset.wearable).toBe("false");
      expect(card.dataset.otherAspect).toBe("true");
      expect(card.querySelectorAll(".cosmetics__badge")).toHaveLength(1);
      expect(card.textContent).toContain(COSMETICS_WORDS.otherAspect);

      await pick(container, other.id);
      expect(buttonNamed(container, COSMETICS_WORDS.equip)).toBeUndefined();
      expect(buttonNamed(container, COSMETICS_WORDS.notWearableOnRealm)?.disabled).toBe(true);
      expect(container.querySelector("[data-not-wearable]")?.textContent).toContain(
        COSMETICS_WORDS.otherAspectNote(aspectName(other.aspect), aspectName(2)),
      );
    }

    await pick(container, "season-1-luminary");
    expect(container.querySelector("[data-not-wearable]")).toBeNull();
    expect(player.sent).toEqual([]);
  });

  it("owns all four Season 1 skins for a Pass holder without a realm Aspect yet and offers no Equip button", async () => {
    player.signedIn = true;
    directory.games = [season([], true)];
    const container = await open();
    expect(container.textContent).toContain(COSMETICS_WORDS.ownedOfPass(4, 4));
    expect(container.querySelector(".cosmetics__owned")?.textContent).toBe(COSMETICS_WORDS.ownedCount(5));
    for (const id of ["season-1-prowess", "season-1-luminary", "season-1-havoc", "season-1-insight"]) {
      const card = container.querySelector<HTMLElement>(`[data-skin="${id}"]`)!;
      expect(card.dataset.standing).toBe("owned");
      expect(card.dataset.wearable).toBe("false");
      expect(card.dataset.otherAspect).toBeUndefined();
    }
    await pick(container, "season-1-luminary");
    expect(buttonNamed(container, COSMETICS_WORDS.equip)).toBeUndefined();
    expect(container.querySelector("[data-not-wearable]")?.textContent).toBe(
      COSMETICS_WORDS.noRealmAspectNote(aspectName(2)),
    );
  });

  it("leaves all four Season 1 skins locked to the pass while the Seal is not held", async () => {
    directory.games = [season([realm({ aspect: 3 })], false)];
    const container = await open();
    expect(container.textContent).toContain(COSMETICS_WORDS.ownedOfPass(0, 4));
    for (const id of ["season-1-prowess", "season-1-luminary", "season-1-havoc", "season-1-insight"]) {
      expect(standings(container)[id]).toBe("pass");
    }
  });

  it("opens on the player's first owned skin in the default order, seen at their rank", async () => {
    directory.games = [season([realm({ aspect: 1, has_wonder: true, level: 3 })], false)];
    const container = await open();
    const stage = container.querySelector<HTMLElement>("[data-preview]")!;
    expect(stage.dataset.preview).toBe("wonder-prowess");
    expect(stage.dataset.rank).toBe("3");
  });

  it("moves the preview to the player's own skin and rank once the directory answers, until they pick one", async () => {
    directory.games = null;
    const container = await open();
    const stage = () => container.querySelector<HTMLElement>("[data-preview]")!;
    expect(stage().dataset.preview).toBe("base");
    directory.games = [season([realm({ aspect: 4, has_wonder: true, level: 1 })], false)];
    await drawAgain();
    expect([stage().dataset.preview, stage().dataset.rank]).toEqual(["wonder-insight", "1"]);
    await pick(container, "devcon");
    directory.games = [season([realm({ aspect: 4, has_wonder: true, level: 2 })], false)];
    await drawAgain();
    expect([stage().dataset.preview, stage().dataset.rank]).toEqual(["devcon", "2"]);
  });

  it("sends a skin locked to the pass to the Shop", async () => {
    directory.games = [];
    const container = await open();
    await pick(container, "season-1-insight");
    await press(container, COSMETICS_WORDS.unlockInPass);
    expect(container.querySelector("[data-where]")!.textContent).toBe(FRAGMENTS_PATH);
  });

  it("offers nothing to press for a skin only an event gave", async () => {
    directory.games = [];
    const container = await open();
    await pick(container, "devcon-golden");
    expect(buttonNamed(container, COSMETICS_WORDS.eventExclusive)!.disabled).toBe(true);
  });

  it("says a skin's preview is coming while it has no art yet, and only then", async () => {
    directory.games = [];
    const container = await open();
    const stage = () => container.querySelector<HTMLElement>("[data-preview]")!;
    expect(stage().textContent).not.toContain(COSMETICS_WORDS.previewSoon);
    await pick(container, "season-1-luminary");
    expect(stage().textContent).toContain(COSMETICS_WORDS.previewSoon);
    expect(
      container.querySelector('[data-skin="season-1-luminary"]')!.querySelectorAll(".cosmetics__badge"),
    ).toHaveLength(1);
  });

  it("asks a player not signed in to connect before equipping a skin they would own", async () => {
    directory.games = [];
    const container = await open();
    await pick(container, "base");
    expect(buttonNamed(container, COSMETICS_WORDS.connectToEquip)).toBeDefined();
  });

  it("offers nothing to equip without a realm in the season, saying the default order the game wears", async () => {
    player.signedIn = true;
    directory.games = [];
    const container = await open();
    await pick(container, "base");
    expect(buttonNamed(container, COSMETICS_WORDS.equip)).toBeUndefined();
    expect(container.querySelector(".cosmetics__note")!.textContent).toBe(
      COSMETICS_WORDS.defaultOrder([
        COSMETICS_WORDS.families.wonder,
        COSMETICS_WORDS.families["season-1"],
        COSMETICS_WORDS.families.base,
      ]),
    );
  });

  it("joins the season shard from a fresh tab and equips a skin through that game's client", async () => {
    player.signedIn = true;
    directory.games = [season([realm({ entity_id: 7, aspect: 3, has_wonder: true })], false)];
    const container = await open();
    expect(container.querySelector('[data-skin="wonder-havoc"] [data-standing="equipped"]')).not.toBeNull();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(joinGameplayAccount).toHaveBeenCalledWith({ chainId: "0x52" }, "0x123");
    expect(player.sent).toEqual([
      {
        context: expect.objectContaining({ chainId: "0x52", gameId: 1, intent: "play" }),
        command: { signer: testSigner, entity_id: 7, family: REALM_SKIN_FAMILIES.BASE_REALM_SKIN },
      },
    ]);
  });

  it("equips the player's live rehearsal realm when the official season has no realm for them", async () => {
    player.signedIn = true;
    directory.games = [
      season([], false),
      { ...season([realm({ entity_id: 8, aspect: 3, has_wonder: true })], false), game_id: 2, name: "rehearsal" },
    ];
    const container = await open();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(player.sent).toEqual([
      {
        context: expect.objectContaining({ gameId: 2 }),
        command: { signer: testSigner, entity_id: 8, family: REALM_SKIN_FAMILIES.BASE_REALM_SKIN },
      },
    ]);
  });

  it("equips the realm in the last game played when both live games have a realm", async () => {
    player.signedIn = true;
    player.activeGame = { chainId: "0x52", gameId: 2 };
    directory.games = [
      season([realm({ entity_id: 7, aspect: 3, has_wonder: true })], false),
      { ...season([realm({ entity_id: 8, aspect: 3, has_wonder: true })], false), game_id: 2, name: "rehearsal" },
    ];
    const container = await open();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(player.sent.map(({ command }) => command)).toEqual([
      { signer: testSigner, entity_id: 8, family: REALM_SKIN_FAMILIES.BASE_REALM_SKIN },
    ]);
  });

  it("offers the existing sign-in recovery when the gameplay device has been revoked", async () => {
    player.signedIn = true;
    joinGameplayAccount.mockRejectedValueOnce(new DeviceRemovedError("0x1"));
    directory.games = [season([realm({ aspect: 3, has_wonder: true })], false)];
    const container = await open();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(buttonNamed(container, "Sign in again")).toBeDefined();
    expect(buttonNamed(container, TRY_AGAIN)).toBeUndefined();
  });

  it("rechecks a cached device before retrying a refused equip", async () => {
    player.signedIn = true;
    player.refused = true;
    useAccountStore.getState().setGameplayAccount(testSigner as unknown as AccountInterface, "0x123");
    joinGameplayAccount.mockRejectedValueOnce(new DeviceRemovedError("0x1"));
    directory.games = [season([realm({ aspect: 3, has_wonder: true })], false)];
    const container = await open();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(player.sent).toHaveLength(1);
    await press(container, TRY_AGAIN);
    expect(isAccountStatePrompt(useAccountStore.getState().provisioningError)).toBe(true);
    expect(player.sent).toHaveLength(1);
  });

  it("links to device management when the gameplay device limit is reached", async () => {
    player.signedIn = true;
    joinGameplayAccount.mockRejectedValueOnce(new DeviceLimitError());
    directory.games = [season([realm({ aspect: 3, has_wonder: true })], false)];
    const container = await open();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(container.querySelector(`a[href="${DEVICES_PATH}"]`)?.textContent).toBe(DOORWAY_WORDS.removeDevice);
    expect(player.sent).toEqual([]);
  });

  it("keeps both actions locked until the directory reaches the receipt's block, even if the previous skin is back", async () => {
    player.signedIn = true;
    const home = realm({ aspect: 3, has_wonder: true, realm_skin: REALM_SKIN_FAMILIES.BASE_REALM_SKIN });
    directory.games = [season([home], false)];
    const container = await open();
    await pick(container, "wonder-havoc");
    await press(container, COSMETICS_WORDS.equip);
    await pick(container, "base");
    expect(buttonNamed(container, COSMETICS_WORDS.useDefaultOrder)?.disabled).toBe(true);
    await pick(container, "wonder-havoc");
    expect(buttonNamed(container, COSMETICS_WORDS.equip)?.disabled).toBe(true);
    expect(player.sent).toHaveLength(1);

    directory.confirmedBlock = 11;
    await drawAgain();
    expect(buttonNamed(container, COSMETICS_WORDS.equip)?.disabled).toBe(false);
  });

  it("does not restore a signer or submit if the player signs out while the client attaches", async () => {
    player.signedIn = true;
    player.beforeAttach = () => {
      player.signedIn = false;
    };
    directory.games = [season([realm({ aspect: 3, has_wonder: true })], false)];
    const container = await open();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(player.sent).toEqual([]);
    expect(useAccountStore.getState().account).toBeNull();
  });

  it("waits for the transaction's block when the first status has no block", async () => {
    player.signedIn = true;
    player.reportedBlock = null;
    directory.games = [season([realm({ aspect: 3, has_wonder: true })], false)];
    const container = await open();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(testSigner.getTransactionReceipt).toHaveBeenCalledWith("0x1");
    directory.confirmedBlock = 14;
    await drawAgain();
    expect(buttonNamed(container, COSMETICS_WORDS.equip)?.disabled).toBe(true);
    directory.confirmedBlock = 15;
    await drawAgain();
    expect(buttonNamed(container, COSMETICS_WORDS.equip)?.disabled).toBe(false);
  });

  it("releases an applied equip when the directory shows it during a receipt outage", async () => {
    player.signedIn = true;
    player.reportedBlock = null;
    testSigner.getTransactionReceipt.mockRejectedValue(new Error("receipt unavailable"));
    const home = realm({ aspect: 3, has_wonder: true });
    directory.games = [season([home], false)];
    const container = await open();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(buttonNamed(container, COSMETICS_WORDS.equip)?.disabled).toBe(true);
    directory.games = [season([{ ...home, realm_skin: REALM_SKIN_FAMILIES.BASE_REALM_SKIN }], false)];
    await drawAgain();
    expect(buttonNamed(container, COSMETICS_WORDS.useDefaultOrder)?.disabled).toBe(false);
  });

  it("does not attach the old game when the player leaves Cosmetics during the account join", async () => {
    player.signedIn = true;
    const attach = vi.fn();
    player.beforeAttach = attach;
    let finishJoin!: (signer: typeof testSigner) => void;
    joinGameplayAccount.mockImplementationOnce(() => new Promise((resolve) => (finishJoin = resolve)));
    directory.games = [season([realm({ aspect: 3, has_wonder: true })], false)];
    const container = await open();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    await act(async () => root?.unmount());
    root = null;
    await act(async () => finishJoin(testSigner));
    expect(attach).not.toHaveBeenCalled();
    expect(player.sent).toEqual([]);
  });

  it("retains a submitted equip across a remount while its outcome is unknown", async () => {
    player.signedIn = true;
    player.outcomeMissing = true;
    let finishWait!: () => void;
    player.beforeOutcome = () => new Promise((resolve) => (finishWait = resolve));
    directory.games = [season([realm({ aspect: 3, has_wonder: true })], false)];
    const first = await open();
    await pick(first, "base");
    await press(first, COSMETICS_WORDS.equip);
    await act(async () => root?.unmount());
    root = null;
    const reopened = await open();
    await pick(reopened, "base");
    expect(buttonNamed(reopened, COSMETICS_WORDS.equip)?.disabled).toBe(true);
    expect(player.sent).toHaveLength(1);
    await act(async () => finishWait());
    expect(buttonNamed(reopened, TRY_AGAIN)?.disabled).toBe(false);
  });

  it("offers the unaligned Wonder to a Wonder realm without an Aspect", async () => {
    player.signedIn = true;
    const home = realm({ has_wonder: true, realm_skin: REALM_SKIN_FAMILIES.BASE_REALM_SKIN });
    directory.games = [season([home], false)];
    const container = await open();
    await pick(container, "wonder");
    await press(container, COSMETICS_WORDS.equip);
    expect(player.sent.map(({ command }) => command)).toEqual([
      { signer: testSigner, entity_id: home.entity_id, family: REALM_SKIN_FAMILIES.WONDER_REALM_SKIN },
    ]);
  });

  it("wears and equips the Season 1 Aspect skin at Empire rank once the Seal is held", async () => {
    player.signedIn = true;
    useAccountStore.setState({ account: { address: "0x1" } } as never);
    directory.games = [season([realm({ entity_id: 7, aspect: 3, level: 3 })], true)];
    const container = await open();
    expect(container.querySelector<HTMLElement>("[data-preview]")!.dataset.preview).toBe("season-1-havoc");
    expect(container.querySelector('[data-skin="season-1-havoc"] [data-standing="equipped"]')).not.toBeNull();
    await pick(container, "base");
    await press(container, COSMETICS_WORDS.equip);
    expect(player.sent.map(({ command }) => command)).toEqual([
      { signer: testSigner, entity_id: 7, family: REALM_SKIN_FAMILIES.BASE_REALM_SKIN },
    ]);
  });

  it("wears and equips the Season 1 Aspect skin at Kingdom rank once the Seal is held", async () => {
    player.signedIn = true;
    useAccountStore.setState({ account: { address: "0x1" } } as never);
    directory.games = [season([realm({ entity_id: 7, aspect: 3, level: 2 })], true)];
    const container = await open();
    expect(container.querySelector<HTMLElement>("[data-preview]")!.dataset.preview).toBe("season-1-havoc");
    expect(container.querySelector('[data-skin="season-1-havoc"] [data-standing="equipped"]')).not.toBeNull();
    await pick(container, "base");
    expect(buttonNamed(container, COSMETICS_WORDS.equip)).toBeDefined();
  });

  it("leaves Equip unavailable when the live game's rules do not enable it", async () => {
    player.signedIn = true;
    const game = season([realm({ aspect: 3, has_wonder: true })], false);
    directory.games = [{ ...game, realm_skin_enabled: false }];
    const container = await open();
    await pick(container, "base");
    expect(buttonNamed(container, COSMETICS_WORDS.equip)).toBeUndefined();
  });

  it("says Try again only on the skin whose submitted equip was rejected", async () => {
    player.signedIn = true;
    player.refused = true;
    useAccountStore.setState({ account: { address: "0x1" } } as never);
    const equipped = realm({
      entity_id: 7,
      aspect: 3,
      has_wonder: true,
      realm_skin: REALM_SKIN_FAMILIES.BASE_REALM_SKIN,
    });
    directory.games = [season([equipped], false)];
    const container = await open();
    await pick(container, "wonder-havoc");
    await press(container, COSMETICS_WORDS.equip);
    expect(buttonNamed(container, TRY_AGAIN)).toBeDefined();
    await pick(container, "base");
    expect(buttonNamed(container, COSMETICS_WORDS.useDefaultOrder)).toBeDefined();
    expect(buttonNamed(container, TRY_AGAIN)).toBeUndefined();
  });

  it("shows the equipped skin worn, and its owner may go back to the default order", async () => {
    player.signedIn = true;
    useAccountStore.setState({ account: { address: "0x1" } } as never);
    const equipped = realm({
      entity_id: 7,
      aspect: 3,
      has_wonder: true,
      realm_skin: REALM_SKIN_FAMILIES.BASE_REALM_SKIN,
    });
    directory.games = [season([equipped], false)];
    const container = await open();
    expect(container.querySelector<HTMLElement>("[data-preview]")!.dataset.preview).toBe("base");
    expect(container.querySelector('[data-skin="base"] [data-standing="equipped"]')).not.toBeNull();
    await press(container, COSMETICS_WORDS.useDefaultOrder);
    expect(player.sent.map(({ command }) => command)).toEqual([
      { signer: testSigner, entity_id: 7, family: REALM_SKIN_FAMILIES.DEFAULT_REALM_SKIN },
    ]);
  });

  it("only offers default order when it would change the worn skin", async () => {
    player.signedIn = true;
    useAccountStore.setState({ account: { address: "0x1" } } as never);
    const owningWonder = realm({ aspect: 3, has_wonder: true, realm_skin: REALM_SKIN_FAMILIES.BASE_REALM_SKIN });
    directory.games = [season([owningWonder], false)];
    const container = await open();
    await pick(container, "wonder-havoc");
    await press(container, COSMETICS_WORDS.equip);
    expect(player.sent.map(({ command }) => command)).toEqual([
      { signer: testSigner, entity_id: owningWonder.entity_id, family: REALM_SKIN_FAMILIES.WONDER_REALM_SKIN },
    ]);
    directory.games = [season([{ ...owningWonder, realm_skin: REALM_SKIN_FAMILIES.WONDER_REALM_SKIN }], false)];
    await drawAgain();
    expect(container.querySelector('[data-skin="wonder-havoc"] [data-standing="equipped"]')).not.toBeNull();
    expect(buttonNamed(container, COSMETICS_WORDS.useDefaultOrder)).toBeUndefined();
  });

  it("opens inside You on a phone", async () => {
    directory.games = [];
    const container = await open(390);
    expect(container.querySelector("[data-where]")!.textContent).toBe(`${PROFILE_PATH}${COSMETICS_HASH}`);
  });
});
