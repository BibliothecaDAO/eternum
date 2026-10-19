import { useDocumentClass } from "@/hooks/use-document-class";
import { useHudMode } from "@/hooks/use-hud-mode";
import { FrontierHud } from "@/ui/features/frontier/frontier-hud";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { DesktopHud } from "@/ui/features/world/hud/desktop-hud";
import { readExpeditionRules, structureMapPosition } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useParams } from "react-router-dom";

import ROW_SET from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { LabGame } from "./lab-game";

/**
 * The views the lab draws: each mode's player (Blitz's, its Build order panel read from the lab realm; Frontier's,
 * and with an army out whose XP buys a tier), and a spectator of a game running and of one finished.
 */
const VIEWS = {
  blitz: { preset: 2, spectating: false, finished: false, army: false },
  frontier: { preset: 5, spectating: false, finished: false, army: false },
  "frontier-army": { preset: 5, spectating: false, finished: false, army: true },
  "blitz-spectator": { preset: 2, spectating: true, finished: false, army: false },
  "blitz-finished": { preset: 2, spectating: true, finished: true, army: false },
} as const;

type View = keyof typeof VIEWS;

/**
 * Dev only: the in-game HUD on a desktop as the game mounts it, every mode's, on the lab's game, at
 * /lab/kit/unified/<view>: blitz, frontier, frontier-army, blitz-spectator, blitz-finished. Frontier's states on the same
 * HUD are the Frontier HUD lab's, /lab/kit/hud/<state>.
 */
export const UnifiedHudLab = () => {
  const { view = "blitz" } = useParams();
  const shown: View = view in VIEWS ? (view as View) : "blitz";
  return <ViewLab key={shown} view={shown} />;
};

const ViewLab = ({ view }: { view: View }) => {
  const { preset, spectating, finished, army } = VIEWS[view];
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
        facts={army ? armyOut : undefined}
        systemCalls={army ? (store) => ({ buy_tier: recordTierBought(store) }) : undefined}
      >
        {(store) => {
          const rules = frontier ? readExpeditionRules(store, 1) : null;
          return frontier ? (
            rules && <FrontierHud rules={rules} />
          ) : (
            <>
              <TopHeader />
              <DesktopHud />
            </>
          );
        }}
      </LabGame>
    </>
  );
};

/** The lab realm's army out today: beside the realm's site, 5,000 Knights, 90 stamina, and 260 XP, which buys a tier. */
const ARMY_ID = 90;

const armyOut = (store: NativeFactStore): unknown[] => {
  const site = structureMapPosition(store, store.require("Structure", { game_id: 1, entity_id: 7 }));
  if (!site) throw new Error("The lab realm has no site today");
  return [
    {
      model: "ExplorerTroops",
      key: "0x9a0",
      value: {
        game_id: 1,
        explorer_id: ARMY_ID,
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
        entity_id: ARMY_ID,
        category: 15,
        is_structure: false,
      },
    },
    { model: "ArmyProgress", key: "0x9a2", value: { ...LAB_PROGRESS, explorer_id: ARMY_ID } },
    { model: "ArmyProgressionRules", key: "0x9a3", value: LAB_PROGRESSION_RULES },
  ];
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
