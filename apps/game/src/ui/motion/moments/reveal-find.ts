import { onOutcome, onSent } from "@/hooks/store/use-actions-in-flight";
import { iconUrl } from "@/ui/design-system/icon-meaning";
import { holdOathPick } from "@/ui/features/frontier/army/oath-pick";
import { armyBar } from "@/ui/features/frontier/hud/dock-armies";
import { Position } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { formatGain } from "@bibliothecadao/types";

import { flySprites, riseSprite } from "../motion-layer";

type Hex = { col: number; row: number };
type Point = { x: number; y: number };

export interface ArmyAtReveal {
  tile: (Hex & { alt: boolean }) | null;
  stamina: number | undefined;
  revealCost: number;
  oathPick: number;
  revealed: boolean;
  occupied: boolean;
}

type RevealFind = { kind: "well"; gain: number } | { kind: "shrine"; offered: boolean } | null;

const FIND_SCALE = 2.4;
const MOTES = 5;
const POP_MS = 400;
const BEAT_MS = 900;

const sameTile = (a: ArmyAtReveal["tile"], b: ArmyAtReveal["tile"]) =>
  a !== null && b !== null && a.col === b.col && a.row === b.row && a.alt === b.alt;

export const classifyRevealFind = (before: ArmyAtReveal, after: ArmyAtReveal): RevealFind => {
  if (before.revealed || !after.revealed || after.occupied || !sameTile(before.tile, after.tile)) return null;
  if (before.stamina !== undefined && after.stamina !== undefined && after.stamina >= before.stamina)
    return { kind: "well", gain: after.stamina - before.stamina + before.revealCost };
  return { kind: "shrine", offered: before.oathPick === 0 && after.oathPick !== 0 };
};

const readArmyAtReveal = (
  store: NativeFactStore,
  gameId: number,
  explorerId: number,
  target: Hex,
  now: number,
): ArmyAtReveal => {
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: explorerId });
  const stands = store.entityOccupancy(gameId, explorerId);
  const tile = stands ? { col: stands.col, row: stands.row, alt: stands.alt } : null;
  const bar = army ? armyBar(store, army, now).stamina : undefined;
  const contract = Position.fromNormalized({ x: target.col, y: target.row }).getContract();
  const at = { game_id: gameId, alt: tile?.alt ?? false, col: contract.x, row: contract.y };
  return {
    tile,
    stamina: bar?.current,
    revealCost: bar?.perExplore ?? 0,
    oathPick: store.get("ArmyProgress", { game_id: gameId, explorer_id: explorerId })?.oath_pick ?? 0,
    revealed: store.get("TileOpt", at) !== undefined,
    occupied: store.get("TileOccupancy", at) !== undefined,
  };
};

const playRevealFind = (find: Exclude<RevealFind, null>, explorerId: number, at: { tile: Point; army: Point }) => {
  riseSprite({ at: at.tile, icon: iconUrl(find.kind), label: "", scale: FIND_SCALE });
  if (find.kind === "well") {
    flySprites({
      from: at.tile,
      to: at.army,
      icon: iconUrl("stamina"),
      count: MOTES,
      popMs: POP_MS,
      onArrive: (index) => {
        if (index === 0) riseSprite({ at: at.army, icon: iconUrl("stamina"), label: formatGain(find.gain) });
      },
    });
    return;
  }
  if (!find.offered) return;
  holdOathPick(explorerId, BEAT_MS);
  flySprites({
    from: at.tile,
    to: at.army,
    icon: iconUrl("shrine"),
    count: 1,
    popMs: POP_MS,
    onArrive: () => riseSprite({ at: at.army, icon: iconUrl("shrine"), label: "" }),
  });
};

export const watchRevealFinds = ({
  store,
  gameId,
  now,
  project,
}: {
  store: NativeFactStore;
  gameId: () => number;
  now: () => number;
  project: (hex: Hex) => Point;
}): (() => void) => {
  const explores = new Map<string, { target: Hex; before: ArmyAtReveal }>();
  const stopSent = onSent("army", (key, flight) => {
    if (flight.order !== "explore" || !flight.to) return;
    explores.set(key, { target: flight.to, before: readArmyAtReveal(store, gameId(), Number(key), flight.to, now()) });
  });
  const stopOutcome = onOutcome("army", (key) => {
    const explore = explores.get(key);
    explores.delete(key);
    if (!explore) return;
    const after = readArmyAtReveal(store, gameId(), Number(key), explore.target, now());
    const find = classifyRevealFind(explore.before, after);
    if (!find || !after.tile) return;
    const army = Position.fromContract({ x: after.tile.col, y: after.tile.row }).getNormalized();
    playRevealFind(find, Number(key), { tile: project(explore.target), army: project({ col: army.x, row: army.y }) });
  });
  return () => {
    stopSent();
    stopOutcome();
  };
};
