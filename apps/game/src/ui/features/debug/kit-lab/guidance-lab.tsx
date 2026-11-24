import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useDocumentClass } from "@/hooks/use-document-class";
import { FeedRowLine } from "@/ui/features/event-feed/feed-row-line";
import { selectEventStories } from "@/ui/features/event-feed/event-stories";
import { EventsFilterSwitch } from "@/ui/features/event-feed/events-filter-switch";
import { useEventsFilter } from "@/hooks/store/use-events-filter-store";
import { HudPanel, HudPill } from "@/ui/design-system/kit/hud-elements";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { playerReadings } from "@/ui/features/world/containers/top-header/identity-chip";
import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

/** The fixture's player, who holds its realm (entity 7) and has no army in the field. */
const PLAYER = "0x111";

/**
 * The deploy fixture's game, made the one this page plays before anything draws: what the HUD reads that the fixture
 * leaves out, its clock, its player and its realm.
 */
const installFixtureGame = () => {
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

/** The lab's players by address. */
const NAMES: Record<string, string> = { [PLAYER]: "clientlane", "0x5": "uxplay", "0x6": "mira" };

/** A story told at `at` (ms), by its owner, worded by the game's one story formatter as the Log and Events read it. */
const story = (
  store: NativeFactStore,
  id: string,
  kind: string,
  payload: Record<string, unknown>,
  at: number,
  owner = PLAYER,
) =>
  ({
    id,
    event_id: id,
    story: kind,
    owner,
    participants: [owner],
    tx_hash: `0x${id}`,
    timestamp: String(at / 1_000),
    timestampMs: at,
    storyPayload: payload,
    presentation: buildStoryEventPresentation(
      { storyType: kind, storyPayload: payload, ownerAddress: owner, viewerAddress: PLAYER, timestamp: at } as never,
      store,
      (address) => NAMES[`0x${BigInt(address).toString(16)}`] ?? null,
    ),
  }) as unknown as ProcessedStoryEvent;

const labStories = (store: NativeFactStore): ProcessedStoryEvent[] => {
  const side = (player: string, category: string, before: string, after: string) => ({
    player,
    category,
    tier: "T1",
    before,
    after,
    roll: 0,
  });
  return [
    story(
      store,
      "found",
      "ExplorationReward",
      {
        explorer_id: 70,
        receiver: 7,
        coord: { x: 2147483650, y: 2147483652 },
        resource_type: ResourcesIds.Essence,
        amount: "200000000000",
      },
      341_000,
    ),
    story(store, "up", "StructureLevelUpStory", { new_level: 1 }, 345_000),
    story(
      store,
      "fight",
      "BattleEvent",
      {
        attacker_id: 70,
        defender_id: 900,
        attacker: side(PLAYER, "Paladin", "1000000000000", "0"),
        defender: side("0x0", "Knight", "5066000000000", "4800000000000"),
      },
      348_000,
    ),
    story(
      store,
      "theirs",
      "BattleEvent",
      {
        attacker_id: 71,
        defender_id: 72,
        attacker: side("0x5", "Knight", "2000000000000", "1500000000000"),
        defender: side("0x6", "Crossbowman", "1000000000000", "0"),
      },
      355_000,
      "0x5",
    ),
  ];
};

/** Events as the rail draws it, on the lab's stories: the player's filter (its switch works here) and the newest three. */
const LabEvents = ({ store }: { store: NativeFactStore }) => {
  const [filter] = useEventsFilter();
  const told = selectEventStories(labStories(store), filter, PLAYER).slice(0, 3);
  return (
    <HudPanel label="Events" title="Events" cue={<EventsFilterSwitch />} bodyClassName="flex flex-col gap-1">
      {told.map((event) => (
        <FeedRowLine key={event.id} event={event} />
      ))}
    </HudPanel>
  );
};

const LabPlayerPill = () => <HudPill>{playerReadings("clientlane")}</HudPill>;

export const GuidanceLab = () => {
  useDocumentClass("classic-hud");
  const [store] = useState(installFixtureGame);
  return (
    <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
      <div className="flex min-h-screen flex-col items-start gap-6 bg-[#0b1418] p-6 text-gold">
        <div data-lab="top-bar">
          <LabPlayerPill />
        </div>
        <div data-lab="events" className="flex w-[320px] flex-col gap-1">
          <LabEvents store={store} />
        </div>
      </div>
    </GameProvider>
  );
};
