import { useGame } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Icon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  HudButton,
  HudChip,
  HudNotice,
  HudSheet,
  HudSlider,
  HudTierChip,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { TRANSFER_TROOPS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { configManager, multiplyByPrecision } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatAmount, getDirectionBetweenAdjacentHexes, type TroopTier } from "@bibliothecadao/types";
import { useState } from "react";
import type { Account } from "starknet";

import { type DockArmy, useDockArmies } from "../hud/dock-armies";

/** Two of the realm's armies standing side by side: the one picked, the one tapped, and where the tapped one stands. */
type TransferPair = {
  picked: DockArmy;
  tapped: DockArmy;
  pickedAt: { col: number; row: number };
  tappedAt: { col: number; row: number };
};

/**
 * The transfer the map has selected: the picked army acting on the tile of another of the realm's armies beside it
 * (the picked army's Help order there). Null for anything else.
 */
export const useSelectedTransfer = (realm: NativeRows["Structure"] | null): TransferPair | null => {
  const { setup } = useGame();
  const armies = useDockArmies(realm);
  const selection = useUIStore((state) => state.mapSelection);
  if (selection?.kind !== "army" || !selection.tile || selection.tile === "own") return null;
  const tile = selection.tile;
  const gameId = configManager.getActiveGameId();
  const at = (army: DockArmy) => {
    const tile = setup.store.entityOccupancy(gameId, army.explorerId);
    return tile ? { col: tile.col, row: tile.row } : null;
  };
  const picked = armies.find((army) => army.explorerId === selection.entityId);
  const tapped = armies.find((army) => {
    const stands = army.explorerId === selection.entityId ? null : at(army);
    return stands?.col === tile.col && stands.row === tile.row;
  });
  const pickedAt = picked && at(picked);
  const tappedAt = tapped && at(tapped);
  if (!picked || !tapped || !pickedAt || !tappedAt) return null;
  if (getDirectionBetweenAdjacentHexes(pickedAt, tappedAt) === null) return null;
  return { picked, tapped, pickedAt, tappedAt };
};

/**
 * Troops between two of the realm's armies side by side, as one split (owner, 22 October 2026: "the merge panel can be
 * redone for desktop & mobile"; direction A): the slider is where the line between them falls, so one control moves
 * troops either way and nothing needs a Swap. It opens as a merge into the army tapped. Each army shows what it holds
 * now and after; three quick splits cover the common asks; the one verb says what will happen. The game moves troops
 * between alike armies only, each within its realm's limit, and an army left with none leaves the map.
 */
export const TransferTroopsSheet = ({
  realm,
  pair,
  onClose,
}: {
  realm: NativeRows["Structure"];
  pair: TransferPair;
  onClose: () => void;
}) => {
  // The split is a choice over the troops the armies hold when it is made: when either count changes (a fight, an
  // order landing) it starts again over the new counts, and says so, so no old choice turns into an impossible move.
  const counts = `${pair.picked.explorerId}:${pair.picked.troops}:${pair.tapped.explorerId}:${pair.tapped.troops}`;
  const [first] = useState(counts);
  return (
    <HudSheet label={TRANSFER_TROOPS.title} onClose={onClose}>
      {counts !== first && <HudNotice tone="warn" line={TRANSFER_TROOPS.changed} />}
      <TransferSplit key={counts} realm={realm} pair={pair} onSent={onClose} />
    </HudSheet>
  );
};

const TransferSplit = ({
  realm,
  pair: { picked, tapped, pickedAt, tappedAt },
  onSent,
}: {
  realm: NativeRows["Structure"];
  pair: TransferPair;
  onSent: () => void;
}) => {
  const {
    setup: { systemCalls },
  } = useGame();
  const account = useAccountStore((state) => state.account);
  const sending = useInFlight("army", picked.explorerId) !== undefined;
  const total = picked.troops + tapped.troops;
  const capOf = (army: DockArmy) => configManager.getMaxArmySize(realm.base.level, army.troopsFact.tier as TroopTier);
  const lowest = Math.max(0, total - capOf(tapped));
  const highest = Math.min(total, capOf(picked));
  const [pickedAfter, setPickedAfter] = useState(lowest);
  const alike =
    picked.troopsFact.category === tapped.troopsFact.category && picked.troopsFact.tier === tapped.troopsFact.tier;
  const moved = picked.troops - pickedAfter;
  const [from, to] = moved > 0 ? [picked, tapped] : [tapped, picked];
  const [fromAt, toAt] = moved > 0 ? [pickedAt, tappedAt] : [tappedAt, pickedAt];

  const send = async () => {
    const direction = getDirectionBetweenAdjacentHexes(fromAt, toAt);
    // What goes leaves an army that holds it, and the split stands within both armies' limits.
    const holds = Math.abs(moved) <= from.troops && pickedAfter >= lowest && pickedAfter <= highest;
    if (!account || direction === null || moved === 0 || !holds) return;
    try {
      await sendOnce("army", picked.explorerId, { order: "move" }, () =>
        systemCalls.explorer_explorer_swap({
          signer: account as unknown as Account,
          from_explorer_id: from.explorerId,
          to_explorer_id: to.explorerId,
          to_explorer_direction: direction,
          count: multiplyByPrecision(Math.abs(moved)),
        }),
      );
      onSent();
    } catch (error) {
      toast.failed(error, TRANSFER_TROOPS.failed);
    }
  };

  if (!alike) return <HudNotice tone="warn" line={TRANSFER_TROOPS.unalike(picked.label, tapped.label)} />;
  const splits: [string, number][] = [
    [TRANSFER_TROOPS.allTo(picked.label), highest],
    [TRANSFER_TROOPS.even, Math.min(highest, Math.max(lowest, Math.round(total / 2)))],
    [TRANSFER_TROOPS.allTo(tapped.label), lowest],
  ];
  const emptied = pickedAfter === 0 ? picked : pickedAfter === total ? tapped : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="ui-transfer__preview">
        <ArmySide army={picked} after={pickedAfter} />
        <span className="flex flex-col items-center gap-1">
          <Icon name="transfer" size={28} className={cn(moved < 0 && "-scale-x-100")} />
          <HudChip tone={moved === 0 ? undefined : "good"}>{formatAmount(Math.abs(moved))}</HudChip>
        </span>
        <ArmySide army={tapped} after={total - pickedAfter} />
      </div>
      <HudSlider
        label={TRANSFER_TROOPS.split(picked.label, tapped.label)}
        value={pickedAfter}
        max={total}
        stop={highest}
        onChange={(value) => setPickedAfter(Math.max(lowest, value))}
      />
      <div className="grid grid-cols-3 gap-1.5">
        {splits.map(([word, value]) => (
          <HudButton
            key={word}
            kind="secondary"
            size="sm"
            aria-pressed={pickedAfter === value}
            onClick={() => setPickedAfter(value)}
          >
            {word}
          </HudButton>
        ))}
      </div>
      <HudWindowFoot
        note={
          emptied
            ? TRANSFER_TROOPS.leaves(emptied.label)
            : total > Math.min(capOf(picked), capOf(tapped))
              ? TRANSFER_TROOPS.cap(Math.min(capOf(picked), capOf(tapped)))
              : undefined
        }
      >
        <HudButton
          kind="primary"
          icon="transfer"
          disabled={moved === 0}
          busy={sending ? TRANSFER_TROOPS.sending : undefined}
          onClick={send}
        >
          {moved === 0 ? TRANSFER_TROOPS.pick : TRANSFER_TROOPS.move(Math.abs(moved), to.label)}
        </HudButton>
      </HudWindowFoot>
    </div>
  );
};

/** One army in the transfer: its portrait and name, its stamina, what it holds now and after. */
const ArmySide = ({ army, after }: { army: DockArmy; after: number }) => (
  <div className="flex flex-col items-center gap-1 rounded-lg border border-hud-line bg-hud-well p-2">
    <span className="flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-hud-good bg-hud-surface">
      <Icon name={army.art} size={44} />
    </span>
    <span className="text-hud-body text-hud-strong">{army.label}</span>
    {army.stamina && (
      <span className="flex items-center gap-1 text-hud-label text-hud-muted">
        <Icon name="stamina" size={16} />
        {formatAmount(Math.floor(army.stamina.current))}/{formatAmount(army.stamina.max)}
      </span>
    )}
    <span className="flex items-center gap-1 tabular-nums">
      <HudTierChip tier={army.troopsFact.tier === "T3" ? 3 : army.troopsFact.tier === "T2" ? 2 : 1} />
      <span className="text-hud-label text-hud-muted">{formatAmount(army.troops)}</span>
      <span className="text-hud-muted">→</span>
      <span
        className={cn(
          "text-hud-title",
          after === 0 ? "text-hud-bad" : after === army.troops ? "text-hud-ink" : "text-hud-gold",
        )}
      >
        {formatAmount(after)}
      </span>
    </span>
  </div>
);
