import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { Transaction } from "@/hooks/store/use-transaction-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ImportantFeedRow } from "@/ui/features/event-feed/important-feed-rows";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { buildStoryEventPresentation, configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { TransactionType } from "@bibliothecadao/provider";
import { relicChestRelics, ResourcesIds } from "@bibliothecadao/types";

/** The kit labs' one fixture game: the deploy fixture's realm, its player, and what a newcomer's Events show. */

/** The fixture's player, who holds its realm (entity 7) and has no army in the field. */
export const PLAYER = "0x111";

/**
 * The deploy fixture's game, made the one this page plays before anything draws: what the HUD reads that the fixture
 * leaves out, its clock, its player and its realm.
 */
export const installFixtureGame = () => {
  const { store } = frontierDay();
  // What the HUD reads that the deploy fixture leaves out: the game's upgrade limits.
  store.applyFacts([
    { model: "UpgradeLimits", key: "0x9", value: { game_id: 1, realm_max: 3, village_max: 3 } },
  ] as never);
  useChainTimeStore.getState().anchor({ timestamp: 350_000 });
  useAccountStore.setState({ account: { address: PLAYER } as never });
  useUIStore.setState({ structureEntityId: 7 });
  return store;
};

/** A story of the player's, worded by the game's one story formatter as the Log and Events both read it. */
const story = (store: NativeFactStore, id: string, kind: string, payload: Record<string, unknown>) =>
  ({
    id,
    event_id: id,
    story: kind,
    owner: PLAYER,
    participants: [PLAYER],
    tx_hash: `0x${id}`,
    timestamp: "350",
    timestampMs: 350_000,
    storyPayload: payload,
    presentation: buildStoryEventPresentation(
      {
        storyType: kind,
        storyPayload: payload,
        ownerAddress: PLAYER,
        viewerAddress: PLAYER,
        timestamp: 350_000,
      } as never,
      store,
      (address) => (BigInt(address) === BigInt(PLAYER) ? "clientlane" : null),
    ),
  }) as unknown as ProcessedStoryEvent;

const storyRow = (event: ProcessedStoryEvent): ImportantFeedRow => ({
  kind: "story",
  id: `story:${event.id}`,
  at: 350_000,
  event,
});

/** What a newcomer's first minutes write to Events: an explore with no find, one that found Essence, a crate, a fight lost. */
export const eventsRows = (store: NativeFactStore): ImportantFeedRow[] => {
  const chest = { pack: "War", lucky: false } as const;
  const scaledPoints = (points: number) => BigInt(points) * 1_000_000n;
  return [
    {
      kind: "transaction",
      id: "0xe1",
      at: 350_000,
      transaction: {
        hash: "0xe1",
        type: TransactionType.EXPLORE,
        status: "success",
        submittedAt: 350_000,
        confirmedAt: 350_000,
        description: "Scouts sent to explore new lands",
      } satisfies Transaction,
    },
    storyRow(
      story(store, "found", "ExplorationReward", {
        explorer_id: 70,
        receiver: 7,
        coord: { x: 2147483650, y: 2147483652 },
        resource_type: ResourcesIds.Essence,
        amount: "200000000000",
      }),
    ),
    storyRow(
      story(store, "crate", "RelicChestOpened", {
        explorer_id: 70,
        coord: { x: 2147483651, y: 2147483652 },
        chest,
        relics: relicChestRelics(chest),
        points: scaledPoints(configManager.getVictoryPointGrants().openRelicCrate),
      }),
    ),
    storyRow(
      story(store, "fight", "BattleEvent", {
        attacker_id: 70,
        defender_id: 900,
        attacker: { player: PLAYER, category: "Paladin", tier: "T1", before: "1000000000000", after: "0", roll: 0 },
        defender: {
          player: "0x0",
          category: "Knight",
          tier: "T2",
          before: "5066000000000",
          after: "4800000000000",
          roll: 0,
        },
      }),
    ),
  ];
};
