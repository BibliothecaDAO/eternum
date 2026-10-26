import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useDocumentClass } from "@/hooks/use-document-class";
import { useHudMode } from "@/hooks/use-hud-mode";
import { SurfaceHost } from "@/ui/design-system/molecules/popover";
import { FrontierHud } from "@/ui/features/frontier/frontier-hud";
import { QuickAttackPreview } from "@/ui/features/military/battle/quick-attack-preview";
import { ArenaHud } from "@/ui/features/world/hud/arena-hud";
import { usePointsGoal } from "@/ui/features/world/hud/points-goal";
import { gameStartHeadline } from "@/ui/features/news-headlines/news-headline-bridge";
import { NewsHeadlineBanner } from "@/ui/features/news-headlines/news-headline-banner";
import { readExpeditionRules, structureMapPosition } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ActorType, RESOURCE_PRECISION, ResourcesIds, StructureType, TileOccupier } from "@bibliothecadao/types";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

import ROW_SET from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { PLAYER } from "./fixture-game";
import { LabGame } from "./lab-game";

/**
 * The views the lab draws: each mode's player (Blitz's, its Build order panel read from the lab realm, and its army's
 * attack forecast on an enemy army beside it, or stocked for its build steps, also as the game begins with its news
 * over the HUD; Frontier's, and with an army out whose XP buys a tier), a spectator
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
  frontier: { preset: 5, spectating: false, finished: false, army: false, attack: false },
  "frontier-army": { preset: 5, spectating: false, finished: false, army: true, attack: false },
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
 * lab's game, at /lab/kit/unified/<view>: blitz, blitz-attack, blitz-build, blitz-start, frontier, frontier-army,
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
  const frontier = preset === VIEWS.frontier.preset;
  useDocumentClass(frontier ? "frontier-hud" : "classic-hud");
  useHudMode(frontier ? "frontier" : "blitz");
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]"
      />
      <LabGame
        preset={preset}
        spectating={spectating}
        finished={finished}
        facts={
          army
            ? (store) => [...labArmyOut(store), ...(attack ? enemyArmyBeside(store) : [])]
            : stocked
              ? stockedRealm
              : out
                ? lastRealmLost
                : undefined
        }
        systemCalls={army ? (store) => ({ buy_tier: recordTierBought(store) }) : undefined}
      >
        {(store) => {
          const rules = frontier ? readExpeditionRules(store, 1) : null;
          return frontier ? (
            rules && <FrontierHud rules={rules} />
          ) : (
            <>
              <ArenaHud />
              {attack && <AttackForecast store={store} />}
              {start && <GameStartNews />}
            </>
          );
        }}
      </LabGame>
    </>
  );
};

/** The news that the game has begun, as the game shows it over the HUD. */
const GameStartNews = () => {
  const goal = usePointsGoal();
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

export const labArmyOut = (store: NativeFactStore): unknown[] => {
  const site = structureMapPosition(store, store.require("Structure", { game_id: 1, entity_id: 7 }));
  if (!site) throw new Error("The lab realm has no site today");
  return [
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
          stamina: { Inline: { amount: "90", settled_at: "350000", remainder: "0" } },
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
  return <SurfaceHost />;
};

const LAB_PROGRESS = { game_id: 1, xp: 260, battle: 1, logistics: 1, scouting: 1, scouting_kinds: 0, homecoming: 1 };
const LAB_PROGRESSION_RULES = {
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  uncommon_xp: 100,
  rare_xp: 200,
  epic_xp: 400,
  legendary_xp: 800,
};

/**
 * buy_tier as the lab proves it: what the sheet sent, kept on the page (window.__labTierBought) for the proof to read,
 * and the tier applied to the army's progress as the game's facts would bring it.
 */
const recordTierBought =
  (store: NativeFactStore) => (call: { explorerId: number; attribute: string; scoutingKind?: string }) => {
    const sent = { explorerId: call.explorerId, attribute: call.attribute, scoutingKind: call.scoutingKind ?? null };
    (window as unknown as { __labTierBought?: unknown[] }).__labTierBought = [
      ...((window as unknown as { __labTierBought?: unknown[] }).__labTierBought ?? []),
      sent,
    ];
    const progress = store.require("ArmyProgress", { game_id: 1, explorer_id: call.explorerId });
    const key = call.attribute.toLowerCase() as "battle" | "logistics" | "scouting" | "homecoming";
    store.applyFacts([
      {
        model: "ArmyProgress",
        key: "0x9a2",
        value: { ...progress, [key]: progress[key] + 1, xp: progress.xp - LAB_PROGRESSION_RULES.uncommon_xp },
      },
    ] as never);
    return Promise.resolve();
  };
