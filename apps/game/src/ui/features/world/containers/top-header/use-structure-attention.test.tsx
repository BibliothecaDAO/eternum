import { storyParticipants } from "@bibliothecadao/eternum/game-client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const ME = "0xabc";
const THEM = "0xdef";

/** The chain's history as Herald serves it, and how its read is going. */
const chain = vi.hoisted(() => ({
  stories: [] as {
    story: string;
    owner: string;
    storyPayload: Record<string, unknown>;
    position: { block: number; transactionIndex: number; eventIndex: number };
    confirmation: { preconfirmed: boolean; confirmedAfterAttach: boolean };
    streamGeneration: number | null;
  }[],
  read: "success" as "pending" | "success" | "error",
}));

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: { store: { inGame: () => [{ structure_id: 1n, troops: { battle_cooldown_end: 150 } }] } },
  }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowMs: () => 100_000 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: unknown) => unknown) => select({ account: { address: ME } }),
}));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (select: (state: unknown) => unknown) => select({ arrivedArrivalStructureIds: [] }),
}));
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => [{ entityId: 1 }] }));
vi.mock("@/sync/fact-views", () => ({ playerStructuresView: {} }));
vi.mock("@/three/utils/utils", () => ({
  isAddressEqualToAccount: (address: string) => BigInt(address) === BigInt(ME),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  activeCombatRules: () => ({ cooldownSeconds: 60 }),
  configManager: { getActiveGameId: () => 1 },
}));
// A story read filters the chain the way Herald's history does: by story, and by every player a story names.
vi.mock("@/hooks/store/use-story-events-store", () => ({
  useStoryEvents: (limit: number, story?: string, owner?: string) => ({
    isSuccess: chain.read === "success",
    isError: chain.read === "error",
    data:
      chain.read === "success"
        ? chain.stories
            .filter((event) => !story || event.story === story)
            .filter(
              (event) =>
                !owner ||
                storyParticipants(event.storyPayload).owners.some((address) => BigInt(address) === BigInt(owner)),
            )
            .toSorted((a, b) => b.position.block - a.position.block)
            .slice(0, limit)
        : [],
  }),
}));

import { useStructureAttention } from "./use-structure-attention";

/** A battle in `block`, delivered live this session unless read from history only. */
const battle = (block: number, defender: number, striker: string, holder: string, live = true) => ({
  story: "BattleEvent",
  owner: striker,
  position: { block, transactionIndex: 0, eventIndex: 0 },
  confirmation: { preconfirmed: false, confirmedAfterAttach: live },
  streamGeneration: live ? 0 : null,
  storyPayload: {
    attacker_id: 900,
    defender_id: defender,
    attacker: { player: striker },
    defender: { player: holder },
  },
});

const Probe = () => <>{[...useStructureAttention().attackedIds].join(",")}</>;
const underAttack = () => renderToStaticMarkup(<Probe />);

beforeEach(() => {
  chain.stories = [];
  chain.read = "success";
});

it("flags the player's structure that another player struck while they held it", () => {
  chain.stories = [battle(95, 1, THEM, ME)];
  expect(underAttack()).toBe("1");
});

it("flags nothing while the combat history loads or after its read fails, and flags once it is read", () => {
  chain.stories = [battle(95, 1, THEM, ME)];
  chain.read = "pending";
  expect(underAttack()).toBe("");
  chain.read = "error";
  expect(underAttack()).toBe("");
  chain.read = "success";
  expect(underAttack()).toBe("1");
});

it("finds the hit behind the cooldown however many other battles the game has had since", () => {
  const elsewhere = Array.from({ length: 120 }, (_, index) => battle(96 + index, 500 + index, "0x7", "0x8"));
  chain.stories = [battle(95, 1, THEM, ME), ...elsewhere];
  expect(underAttack()).toBe("1");
});

it("never flags the player's own capture, but flags a hostile hit after it", () => {
  chain.stories = [battle(80, 1, THEM, "0xf0"), battle(95, 1, ME, "0xf0")];
  expect(underAttack()).toBe("");
  chain.stories = [battle(80, 1, ME, "0xf0"), battle(95, 1, THEM, ME)];
  expect(underAttack()).toBe("1");
});

it("after a reload, stays silent on a hit read from history only until a hit arrives live", () => {
  chain.stories = [battle(95, 1, THEM, ME, false)];
  expect(underAttack()).toBe("");
  chain.stories = [battle(95, 1, THEM, ME, false), battle(97, 1, THEM, ME)];
  expect(underAttack()).toBe("1");
});
