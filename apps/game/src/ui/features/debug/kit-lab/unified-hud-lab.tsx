import { SeasonOver } from "@/shell/season-tab/season-over";
import { answerLabOpening } from "@/lab/lab-opening";
import { frontierArmyRules } from "../../frontier/army/progression-rules-fixture";
import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { LAB_SESSION } from "@/shell/lab/app-lab-fixtures";
import { answerLabChat } from "@/shell/lab/lab-chat";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useDocumentClass } from "@/hooks/use-document-class";
import { useHudMode } from "@/hooks/use-hud-mode";
import { SurfaceHost } from "@/ui/design-system/molecules/popover";
import { FrontierHud } from "@/ui/features/frontier/frontier-hud";
import { QuickAttackPreview } from "@/ui/features/military/battle/quick-attack-preview";
import { ArenaHud } from "@/ui/features/world/hud/arena-hud";
import { useGoalLine } from "@/ui/features/world/hud/points-goal";
import { gameStartHeadline } from "@/ui/features/news-headlines/news-headline-bridge";
import { NewsHeadlineBanner } from "@/ui/features/news-headlines/news-headline-banner";
import {
  nativeGameModeOf,
  readExpeditionRules,
  structureMapPosition,
  type SkillPointChoice,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  ActorType,
  aspects,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
  TileOccupier,
} from "@bibliothecadao/types";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

import ROW_SET from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { nativeRuleConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import { frontierSeasonOnePreset } from "../../../../../../../config/source/frontier/season-one";
import { PLAYER } from "./fixture-game";
import { LabGame } from "./lab-game";

/**
 * The views the lab draws: each mode's player (Blitz's, its Build order panel read from the lab realm, and its army's
 * attack forecast on an enemy army beside it, or stocked for its build steps, also as the game begins with its news
 * over the HUD; Frontier's, and with an army out holding skill points), a spectator
 * of a game running and of one finished, and a Blitz player whose last realm fell, still holding a Hyperstructure, then watching.
 */
const VIEWS = {
  blitz: { preset: 2, spectating: false, finished: false, army: false, attack: false },
  "blitz-build": { preset: 2, spectating: false, finished: false, army: false, attack: false, stocked: true },
  "blitz-start": {
    preset: 2,
    spectating: false,
    finished: false,
    army: false,
    attack: false,
    stocked: true,
    start: true,
  },
  "blitz-attack": { preset: 2, spectating: false, finished: false, army: true, attack: true },
  // The same attack with the army at 5 stamina: no forecast, the sides with a dash and the shortfall under them.
  "blitz-attack-short": { preset: 2, spectating: false, finished: false, army: true, attack: true, tired: true },
  frontier: { preset: 5, spectating: false, finished: false, army: false, attack: false },
  // Eternum's player on the same HUD as Blitz's, in Eternum's own age colours.
  eternum: { preset: 3, spectating: false, finished: false, army: false, attack: false },
  "frontier-army": { preset: 5, spectating: false, finished: false, army: true, attack: false },
  // A new player's first minute: a fresh account on the fresh realm, the HUD as it opens, with its first line.
  "frontier-new": { preset: 5, spectating: false, finished: false, army: false, attack: false, fresh: true },
  // A Season 1 member back from the Deep: its Glory where LORDS stand elsewhere, and its Aspect's Triumph today.
  "season-one-deep": { preset: 7, spectating: false, finished: false, army: false, attack: false, deep: true },
  "blitz-spectator": { preset: 2, spectating: true, finished: false, army: false, attack: false },
  "blitz-finished": { preset: 2, spectating: true, finished: true, army: false, attack: false },
  "blitz-out": { preset: 2, spectating: false, finished: false, army: false, attack: false, out: true },
  "blitz-out-watching": { preset: 2, spectating: true, finished: false, army: false, attack: false, out: true },
} as const;

type View = keyof typeof VIEWS;
/** Every view, by the name in its address, with the game it plays: the HUD room lists them. */
export const UNIFIED_VIEWS = (Object.keys(VIEWS) as View[]).map((name) => ({
  name,
  frontier: VIEWS[name].preset === VIEWS.frontier.preset,
}));

/**
 * Dev only: the in-game HUD as the game mounts it (a desktop's columns, a phone's compact HUD), every mode's, on the
 * lab's game, at /lab/kit/unified/<view>: blitz, blitz-attack, blitz-attack-short, blitz-build, blitz-start, eternum, frontier, frontier-army, frontier-new, season-one-deep,
 * blitz-spectator, blitz-finished, blitz-out, blitz-out-watching. Frontier's states on the same HUD are the Frontier HUD
 * lab's, /lab/kit/hud/<state>.
 */
export const UnifiedHudLab = () => {
  const { view = "blitz" } = useParams();
  const shown: View = view in VIEWS ? (view as View) : "blitz";
  return <ViewLab key={shown} view={shown} />;
};

const ViewLab = ({ view }: { view: View }) => {
  const { preset, spectating, finished, army, attack } = VIEWS[view];
  const stocked = "stocked" in VIEWS[view];
  const start = "start" in VIEWS[view];
  const out = "out" in VIEWS[view];
  const tired = "tired" in VIEWS[view];
  const fresh = "fresh" in VIEWS[view];
  const deep = "deep" in VIEWS[view];
  const mode = nativeGameModeOf(preset);
  const frontier = mode === "frontier";
  useDocumentClass(frontier ? "frontier-hud" : "classic-hud");
  useHudMode(mode === "eternum" ? "eternum" : frontier ? "frontier" : "blitz");
  // The lab's player is signed in, as a player in a game is, and chat connects to the lab's chat server, in the tab.
  // Identity makes the lab player's shared links in the tab: one code for every link.
  useEffect(() => {
    const restoreChat = answerLabChat({});
    const restoreOpening = answerLabOpening(LAB_SESSION.user.realmsId, fresh ? [] : undefined);
    const { createShare } = identityClient;
    identityClient.createShare = async () => LAB_SHARE_CODE;
    useIdentitySessionStore.getState().applySession(LAB_SESSION);
    return () => {
      restoreChat();
      restoreOpening();
      identityClient.createShare = createShare;
    };
  }, [fresh]);
  return (
    <>
      <div
        aria-hidden
        data-lab="unified"
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]"
      />
      <LabGame
        preset={preset}
        spectating={spectating}
        finished={finished}
        facts={(store) => [
          ...(frontier ? seasonOneFacts() : []),
          ...(deep ? backFromTheDeep() : []),
          ...(army
            ? [
                ...labArmyOut(store, tired ? TIRED_STAMINA : LAB_ARMY_STAMINA),
                ...(attack ? enemyArmyBeside(store) : []),
              ]
            : stocked
              ? stockedRealm()
              : out
                ? lastRealmLost(store)
                : []),
        ]}
        systemCalls={army ? () => ({ spend_skill_point: recordSkillPointSpent }) : undefined}
      >
        {(store) => {
          const rules = frontier ? readExpeditionRules(store, 1) : null;
          return (
            <>
              {frontier ? (
                rules && <FrontierHud seasonOver={SeasonOver} rules={rules} />
              ) : (
                <>
                  <ArenaHud />
                  {attack && <AttackForecast store={store} />}
                  {start && <GameStartNews />}
                </>
              )}
              {/* The surfaces a HUD control opens, drawn where the game's world layout draws them. */}
              <SurfaceHost />
            </>
          );
        }}
      </LabGame>
    </>
  );
};

/** The news that the game has begun, as the game shows it over the HUD. */
const GameStartNews = () => {
  const goal = useGoalLine();
  return <NewsHeadlineBanner headline={gameStartHeadline(0, goal)} />;
};

/**
 * The lab realm stocked with the building inputs it lacks, 50,000 of each (it holds wheat already), so the build order's
 * next steps can be taken.
 */
const STOCKED = [ResourcesIds.Wood, ResourcesIds.Stone, ResourcesIds.Coal, ResourcesIds.Copper, ResourcesIds.Labor];

const stockedRealm = (): unknown[] =>
  STOCKED.map((resource) => ({
    model: "ResourceBalance",
    key: `0xb5${resource}`,
    value: {
      game_id: 1,
      entity_id: 7,
      resource_type: resource,
      balance: String(50_000n * BigInt(RESOURCE_PRECISION)),
    },
  }));

/**
 * The lab player entered the game and lost the lab realm to a rival, and still holds a Hyperstructure: the HUD says
 * they are out.
 */
const lastRealmLost = (store: NativeFactStore): unknown[] => {
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  return [
    { model: "PlayerEntry", key: "0xe1", value: { game_id: 1, owner: PLAYER, player: PLAYER } },
    { model: "Structure", key: "0x7", value: { ...realm, owner: "0x222" } },
    {
      model: "Structure",
      key: "0x50",
      value: {
        ...realm,
        entity_id: 50,
        owner: PLAYER,
        base: { ...realm.base, category: StructureType.Hyperstructure },
      },
    },
    {
      model: "TileOccupancy",
      key: "0x51",
      value: {
        game_id: 1,
        alt: false,
        col: 40,
        row: 40,
        entity_id: 50,
        category: TileOccupier.Hyperstructure,
        is_structure: true,
      },
    },
  ];
};

/** The lab realm's army out today: beside the realm's site, 5,000 Knights, 90 stamina, and 260 XP, which buys a tier. */
export const LAB_ARMY_ID = 90;

const LAB_ARMY_STAMINA = "90";
const TIRED_STAMINA = "5";

export const labArmyOut = (store: NativeFactStore, stamina = LAB_ARMY_STAMINA): unknown[] => {
  const site = structureMapPosition(store, store.require("Structure", { game_id: 1, entity_id: 7 }));
  if (!site) throw new Error("The lab realm has no site today");
  return [
    {
      model: "ArmyDay",
      key: "0xad90",
      value: { game_id: 1, explorer_id: LAB_ARMY_ID, day: 0 },
    },
    {
      model: "ExplorerTroops",
      key: "0x9a0",
      value: {
        game_id: 1,
        explorer_id: LAB_ARMY_ID,
        owner: 7,
        troops: {
          ...ROW_SET.expected.value.troops,
          count: String(5_000n * 1_000_000_000n),
          stamina: { Inline: { amount: stamina, settled_at: "350000", remainder: "0" } },
        },
      },
    },
    {
      model: "TileOccupancy",
      key: "0x9a1",
      value: {
        game_id: 1,
        alt: false,
        col: site.x + 1,
        row: site.y,
        entity_id: LAB_ARMY_ID,
        category: 15,
        is_structure: false,
      },
    },
    { model: "ArmyProgress", key: "0x9a2", value: { ...LAB_PROGRESS, explorer_id: LAB_ARMY_ID } },
    { model: "ArmyProgressionRules", key: "0x9a3", value: LAB_PROGRESSION_RULES },
  ];
};

/** An enemy army of 3,000 beside the lab army, sent out by an enemy realm. */
const ENEMY_ARMY_ID = 91;
const ENEMY_REALM_ID = 8;

const enemyArmyBeside = (store: NativeFactStore): unknown[] => {
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const site = structureMapPosition(store, realm)!;
  return [
    { model: "ArmyDay", key: "0xad91", value: { game_id: 1, explorer_id: ENEMY_ARMY_ID, day: 0 } },
    { model: "Structure", key: "0x9b0", value: { ...realm, entity_id: ENEMY_REALM_ID, owner: ENEMY } },
    {
      model: "ExplorerTroops",
      key: "0x9b1",
      value: {
        game_id: 1,
        explorer_id: ENEMY_ARMY_ID,
        owner: ENEMY_REALM_ID,
        troops: {
          ...ROW_SET.expected.value.troops,
          count: String(3_000n * 1_000_000_000n),
          stamina: { Inline: { amount: "90", settled_at: "350000", remainder: "0" } },
        },
      },
    },
    {
      model: "TileOccupancy",
      key: "0x9b2",
      value: {
        game_id: 1,
        alt: false,
        col: site.x + 2,
        row: site.y,
        entity_id: ENEMY_ARMY_ID,
        category: 15,
        is_structure: false,
      },
    },
  ];
};
const ENEMY = "0xe1";

/**
 * The lab army's attack on the enemy army, opened as the map opens it: the forecast surface over the HUD. Leaving the
 * view takes that surface away, and only that one: a surface opened after it stays.
 */
const AttackForecast = ({ store }: { store: NativeFactStore }) => {
  useEffect(() => {
    const site = structureMapPosition(store, store.require("Structure", { game_id: 1, entity_id: 7 }))!;
    const on = (id: number, col: number) => ({ id, hex: { x: col, y: site.y }, alt: false });
    usePopoverStore.getState().openSurface({
      id: "quick-attack",
      content: (
        <QuickAttackPreview
          attacker={{ type: ActorType.Explorer, ...on(LAB_ARMY_ID, site.x + 1) }}
          target={{ type: ActorType.Explorer, ...on(ENEMY_ARMY_ID, site.x + 2) }}
        />
      ),
    });
    const opened = usePopoverStore.getState().surface;
    return () => usePopoverStore.setState((now) => (now.surface === opened ? { openId: null, surface: null } : now));
  }, [store]);
  return null;
};

const LAB_PROGRESS = {
  common_points: 1,
  uncommon_points: 1,
  rare_points: 0,
  epic_points: 0,
  legendary_points: 0,
  game_id: 1,
  xp: 260,
  battle: 1,
  logistics: 1,
  scouting: 0,
  scouting_kinds: 0,
  homecoming: 1,
};
const LAB_PROGRESSION_RULES = frontierArmyRules();

/** Records the army panel's command at the network boundary; native tests prove its state changes. */
const recordSkillPointSpent = (call: { explorerId: number; choice: SkillPointChoice }) => {
  const sent = { explorerId: call.explorerId, choice: call.choice };
  const target = window as unknown as { __labSkillPointSpent?: unknown[] };
  target.__labSkillPointSpent = [...(target.__labSkillPointSpent ?? []), sent];
  return Promise.resolve();
};

/**
 * Season 1's quest rules as its preset writes them, and the lab realm a member of Harmony, so a Frontier view draws the
 * day's banner and the invite to its Aspect.
 */
const seasonOneFacts = (): unknown[] => {
  const { baseCounts, labor, essence, bonusPercent } = frontierSeasonOnePreset.dailyQuest;
  return [
    {
      model: "QuestRules",
      key: "0x9e1",
      value: {
        game_id: 1,
        base_counts: baseCounts,
        labor: BigInt(labor),
        essence: BigInt(essence),
        bonus_percent: bonusPercent,
      },
    },
    { model: "HomeAspect", key: "0x9e2", value: { game_id: 1, home: 7n, aspect: aspects[1].id } },
  ];
};

/**
 * The lab realm back from the Deep in a race game: Season 1's race rules as its preset writes them, 145 Glory earned
 * holding a site, and Harmony's Second Wind on the lab's day (0).
 */
const backFromTheDeep = (): unknown[] => {
  const { race } = frontierSeasonOnePreset;
  if (!race) throw new Error("Season 1's preset races no hyperstructures");
  const at = (index: number) => ({ alt: false, x: race.positions[index]![0]!, y: race.positions[index]![1]! });
  return [
    {
      model: "RaceRules",
      key: "0x9e3",
      value: {
        game_id: 1,
        season_days: BigInt(race.seasonDays),
        glory_per_tick: BigInt(race.gloryPerTick),
        height_per_tick: race.heightPerTick,
        stage_height: race.stageHeight,
        clear_mist_percent: race.clearMistPercent,
        second_wind_percent: race.secondWindPercent,
        pale_moon_percent: race.paleMoonPercent,
        spoils_percent: race.spoilsPercent,
        first: at(0),
        second: at(1),
        third: at(2),
        fourth: at(3),
      },
    },
    {
      model: "RaceMember",
      key: "0x9e4",
      value: { game_id: 1, entity_id: 7n, glory: BigInt(145 * RESOURCE_PRECISION), contribution: 0n },
    },
    {
      model: "TriumphDay",
      key: "0x9e5",
      value: { game_id: 1, aspect: aspects[1].id, stage: nativeRuleConstants.SECOND_WIND_STAGE, day: 0n },
    },
  ];
};

/** The code identity gives every link the lab player makes, as a link's code is spelled. */
const LAB_SHARE_CODE = "LABSHARE";
