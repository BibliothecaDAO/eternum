import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { Transaction } from "@/hooks/store/use-transaction-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useDocumentClass } from "@/hooks/use-document-class";
import { FeedRowLine } from "@/ui/features/event-feed/feed-row-line";
import type { ImportantFeedRow } from "@/ui/features/event-feed/important-feed-rows";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { PlayerLabel } from "@/ui/features/world/containers/top-header/identity-chip";
import { TOP_PILL } from "@/ui/features/world/containers/top-header/top-pill";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { NextUpView } from "@/ui/features/world/hud/next-up";
import type { NextStep } from "@/ui/features/world/hud/next-step";
import { type CoachArmy, type CoachStep, type CoachTarget, coachSteps } from "@/ui/features/world/hud/coach";
import { configManager } from "@bibliothecadao/eternum";
import { TransactionType } from "@bibliothecadao/provider";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
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

const story = (id: string, kind: string, payload: Record<string, unknown>, title: string, description = "") =>
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
    presentation: { title, description },
  }) as unknown as ProcessedStoryEvent;

/** What a newcomer's first minutes write to Events: an explore with no find, one that found Essence, a crate, a fight lost. */
const ROWS: ImportantFeedRow[] = [
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
  {
    kind: "story",
    id: "story:found",
    at: 350_000,
    event: story("found", "ExplorationReward", { coord: { x: 2147483650, y: 2147483652 } }, "+200 Essence"),
  },
  {
    kind: "story",
    id: "story:crate",
    at: 350_000,
    event: story("crate", "RelicChestOpened", {}, "War pack: 3 relics to the army Stolsli T1"),
  },
  {
    kind: "story",
    id: "story:fight",
    at: 350_000,
    event: story(
      "fight",
      "BattleEvent",
      {
        attacker: { player: PLAYER, category: "Knight", before: "1000000000000", after: "0" },
        defender: { player: "0x0", category: "Knight", before: "5066000000000", after: "4800000000000" },
      },
      "Battle resolved",
      "Attacker [clientlane] · Defender [The Vanguard] · Outcome: The Vanguard wins",
    ),
  },
];

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

/** Next up in each state the coach reads, the step it puts first named above it. */
const NEXT_UP_STATES: { label: string; steps: NextStep[]; refusal?: string }[] = [
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
        <div data-lab="top-bar" className={cn(TOP_PILL, HUD_LABEL_BRIGHT)}>
          <PlayerLabel name="clientlane" standing={{ rank: 1, points: 310 }} />
        </div>
        <div data-lab="next-up" className="grid grid-cols-4 gap-4">
          {NEXT_UP_STATES.map(({ label, steps, refusal }) => (
            <div key={label} className="flex w-[320px] flex-col gap-1">
              <span className="text-xs text-gold/60">{label}</span>
              <NextUpView steps={steps} refusal={refusal} />
            </div>
          ))}
        </div>
        <div data-lab="events" className="flex w-[320px] flex-col gap-1">
          {ROWS.map((row) => (
            <FeedRowLine key={row.id} row={row} />
          ))}
        </div>
      </div>
    </GameProvider>
  );
};
