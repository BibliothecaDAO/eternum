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
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { NextUpView } from "@/ui/features/world/hud/next-up";
import type { NextStep } from "@/ui/features/world/hud/next-step";
import { type CoachArmy, type CoachStep, type CoachTarget, coachSteps } from "@/ui/features/world/hud/coach";
import { buildStoryEventPresentation, configManager } from "@bibliothecadao/eternum";
import { relicChestRelics, ResourcesIds } from "@bibliothecadao/types";
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

/**
 * What a newcomer's first minutes write to the game's history, oldest first: an explore's find, a level-up, a crate, a
 * fight lost, another player's fight.
 */
const labStories = (store: NativeFactStore): ProcessedStoryEvent[] => {
  const chest = { pack: "War", lucky: false } as const;
  const scaledPoints = (points: number) => BigInt(points) * 1_000_000n;
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
      "crate",
      "RelicChestOpened",
      {
        explorer_id: 70,
        coord: { x: 2147483651, y: 2147483652 },
        chest,
        relics: relicChestRelics(chest),
        points: scaledPoints(configManager.getVictoryPointGrants().openRelicCrate),
      },
      346_000,
    ),
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
  const told = selectEventStories(labStories(store), filter, PLAYER, () => false).slice(0, 3);
  return (
    <HudPanel label="Events" title="Events" cue={<EventsFilterSwitch />} bodyClassName="flex flex-col gap-1">
      {told.map((event) => (
        <FeedRowLine key={event.id} event={event} />
      ))}
    </HudPanel>
  );
};

/** The fixture realm's army, standing at (10, 10). */
const ARMY: CoachArmy = {
  entityId: 1,
  hex: { col: 10, row: 10 },
  home: { realmId: 7, name: "Egonal" },
  canExplore: true,
  selected: false,
};
const CRATE: CoachTarget = { kind: "crate", name: "the relic crate", hex: { col: 12, row: 10 } };
const CAMP: CoachTarget = { kind: "site", name: "Camp", hex: { col: 14, row: 10 } };
const HYPERSTRUCTURE: CoachTarget = {
  kind: "hyperstructure",
  name: "Obsidian Hyperstructure",
  hex: { col: 18, row: 10 },
};
const TROOPS = { realmId: 7, realmName: "'oak Leukue", troops: 1_000 };

/** The coach's steps for a state, as Next up shows them (their buttons do nothing here). */
const coached = (state: Partial<Parameters<typeof coachSteps>[0]>): NextStep[] =>
  coachSteps({
    armies: [],
    targets: [],
    troopsOnHand: TROOPS,
    certainLoss: () => false,
    grants: configManager.getVictoryPointGrants(),
    ...state,
  }).map(labStep);

const labStep = ({ key, line, verb, act }: CoachStep): NextStep =>
  act?.kind === "level-up"
    ? { key, kind: "level-up", realmId: act.realmId, name: act.name, why: line }
    : { key, kind: "order", line, verb, busy: false, run: act ? () => undefined : null };

/** Next up in each state the coach reads, the step it puts first named above it; read once the fixture game is in. */
const nextUpStates = (): { label: string; steps: NextStep[]; refusal?: string }[] => [
  { label: "Before play opens", steps: coached({}), refusal: "Starts in 2m 42s" },
  {
    label: "Army lost: raise where troops are",
    steps: [
      {
        key: "lost",
        kind: "order",
        line: "Army lost: 1,000 Paladins. Raise another at 'oak Leukue (1,000 troops on hand).",
        verb: "Raise an army",
        busy: false,
        run: () => undefined,
      },
    ],
  },
  { label: "No troops anywhere", steps: coached({ troopsOnHand: null }) },
  {
    label: "Army beside a crate",
    steps: coached({ armies: [ARMY], targets: [{ ...CRATE, hex: { col: 11, row: 10 } }, CAMP, HYPERSTRUCTURE] }),
  },
  { label: "Army idle, can explore", steps: coached({ armies: [ARMY], targets: [CRATE, CAMP, HYPERSTRUCTURE] }) },
  { label: "Army selected", steps: coached({ armies: [{ ...ARMY, selected: true }] }) },
  {
    label: "Fight unwinnable",
    steps: coached({
      armies: [{ ...ARMY, canExplore: false }],
      targets: [HYPERSTRUCTURE],
      certainLoss: () => true,
    }),
  },
];

/** The top bar's player chip as a player reads it: name, rank, points and the game's goal. */
const LabPlayerPill = () => <HudPill>{playerReadings("clientlane", { rank: 1, points: 310 })}</HudPill>;

/**
 * Dev only: the points-first guidance a newcomer sees, the real components on the deploy fixture in the War room skin,
 * at /lab/kit/guidance: the top bar's goal beside the points, Next up in each state its coach reads, and Events rows
 * with their outcomes.
 */
export const GuidanceLab = () => {
  useDocumentClass("classic-hud");
  const [store] = useState(installFixtureGame);
  return (
    <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
      <div className="flex min-h-screen flex-col items-start gap-6 bg-[#0b1418] p-6 text-gold">
        <div data-lab="top-bar">
          <LabPlayerPill />
        </div>
        <div data-lab="next-up" className="grid grid-cols-4 gap-4">
          {nextUpStates().map(({ label, steps, refusal }) => (
            <div key={label} className="flex w-[320px] flex-col gap-1">
              <span className="text-xs text-gold/60">{label}</span>
              <NextUpView steps={steps} refusal={refusal} />
            </div>
          ))}
        </div>
        <div data-lab="events" className="flex w-[320px] flex-col gap-1">
          <LabEvents store={store} />
        </div>
      </div>
    </GameProvider>
  );
};
