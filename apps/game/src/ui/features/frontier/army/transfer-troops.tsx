import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { explorerTransferPlan } from "./army-merge";
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
import { TRANSFER_TROOPS, XP } from "@/ui/design-system/kit/words";
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
 * troops either way and nothing needs a Swap. It opens as a merge into the army tapped: the map has chosen which army
 * goes into which (owner, 26 October 2026: the quick splits are "not needed since the player do it from the map").
 * The cards say what happens, not a paragraph: each army's troops, stamina and XP now and after, and an army a merge
 * empties faded with its XP struck out. The one verb names the army that stays. The game moves troops between alike
 * armies only, each within its realm's limit. A full merge keeps the chosen target.
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
    setup: { systemCalls, store },
  } = useGame();
  useNativeRevision([
    "ExplorerTroops",
    "ArmyProgress",
    "ArmyProgressionRules",
    "ArmySlot",
    "TileOccupancy",
    "Structure",
    "SliceRules",
    "GameRegistry",
  ]);
  const game_id = configManager.getActiveGameId();
  const progress = (id: number) => store.get("ArmyProgress", { game_id, explorer_id: id });
  const rules = store.get("ArmyProgressionRules", { game_id });
  // Immutable facts behind the rendered choice, read again synchronously before signing.
  const readChoice = () => [
    store.subscriptionScope().known?.expedition?.day,
    store.get("ArmyProgressionRules", { game_id }),
    store.get("SliceRules", { game_id }),
    store.get("GameRegistry", { game_id }),
    ...[picked, tapped].flatMap((army) => {
      const row = store.get("ExplorerTroops", { game_id, explorer_id: army.explorerId });
      const epoch = store.subscriptionScope().known?.expedition?.day;
      return [
        row,
        progress(army.explorerId),
        store.entityOccupancy(game_id, army.explorerId),
        row && store.get("Structure", { game_id, entity_id: row.owner }),
        row && "Slot" in row.troops.stamina && epoch !== undefined && epoch >= 0
          ? store.get("ArmySlot", {
              game_id,
              structure_id: row.owner,
              epoch: BigInt(epoch),
              slot: row.troops.stamina.Slot,
            })
          : undefined,
      ];
    }),
  ];
  const choice = readChoice();
  const account = useAccountStore((state) => state.account);
  const sending = useInFlight("army", picked.explorerId) !== undefined;
  const total = picked.troops + tapped.troops;
  const capOf = (army: DockArmy) => configManager.getMaxArmySize(realm.base.level, army.troopsFact.tier as TroopTier);
  const lowest = Math.max(0, total - capOf(tapped));
  const highest = Math.min(total, capOf(picked));
  const [split, setSplit] = useState(lowest);
  const pickedAfter = split;
  const [confirmation, setConfirmation] = useState<{ split: number; facts: unknown[] } | null>(null);
  const confirmed = confirmation?.split === split && confirmation.facts.every((fact, index) => fact === choice[index]);
  const chooseSplit = (value: number) => {
    setConfirmation(null);
    setSplit(value);
  };
  const alike =
    picked.troopsFact.category === tapped.troopsFact.category && picked.troopsFact.tier === tapped.troopsFact.tier;
  const moved = picked.troops - pickedAfter;
  const [from, to] = moved > 0 ? [picked, tapped] : [tapped, picked];
  const [fromAt, toAt] = moved > 0 ? [pickedAt, tappedAt] : [tappedAt, pickedAt];

  const plan = explorerTransferPlan({
    sourceCount: from.troops,
    targetCount: to.troops,
    targetCap: capOf(to),
    sourceProgress: progress(from.explorerId),
    targetProgress: progress(to.explorerId),
    rules,
  });
  const fullMerge = moved !== 0 && Math.abs(moved) === from.troops;
  const survivor = fullMerge ? to : null;
  const loser = fullMerge ? from : null;
  const mergedStamina =
    survivor?.stamina && loser?.stamina
      ? Math.min(survivor.stamina.current, loser.stamina.current, survivor.stamina.max)
      : undefined;
  const valid =
    plan.known && (fullMerge ? plan.fullFits && mergedStamina !== undefined : Math.abs(moved) <= plan.partialMax);
  const after = (army: DockArmy) =>
    survivor && plan.known ? (army === survivor ? total : 0) : army === picked ? pickedAfter : total - pickedAfter;

  const send = async () => {
    const direction = getDirectionBetweenAdjacentHexes(fromAt, toAt);
    // What goes leaves an army that holds it, and the split stands within both armies' limits.
    const holds = Math.abs(moved) <= from.troops && pickedAfter >= lowest && pickedAfter <= highest;
    if (!account || direction === null || moved === 0 || !holds || !valid) return;
    try {
      if (readChoice().some((fact, index) => fact !== choice[index])) {
        throw new Error(TRANSFER_TROOPS.stale);
      }
      if (fullMerge && plan.confirmLoss && !confirmed) {
        setConfirmation({ split, facts: choice });
        return;
      }
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
  // A full merge whose progress is known: the army that stays and the one that leaves.
  const merge = survivor && loser && plan.known ? { survivor, loser } : null;
  const side = (army: DockArmy) => (
    <ArmySide
      army={army}
      after={after(army)}
      leaves={army === merge?.loser}
      staminaAfter={army === merge?.survivor ? mergedStamina : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {confirmed && fullMerge && plan.confirmLoss && (
        <HudNotice tone="warn" line={TRANSFER_TROOPS.confirmLoss(from.label, plan.sourceValue!, plan.targetValue!)} />
      )}
      {!plan.known && <HudNotice tone="warn" line={TRANSFER_TROOPS.waiting} />}
      <div className="ui-transfer__preview">
        {side(picked)}
        <span className="flex flex-col items-center gap-1">
          <Icon name="transfer" size={28} className={cn(moved < 0 && "-scale-x-100")} />
          <HudChip tone={moved === 0 ? undefined : "good"}>{formatAmount(Math.abs(moved))}</HudChip>
        </span>
        {side(tapped)}
      </div>
      <HudSlider
        label={TRANSFER_TROOPS.split(picked.label, tapped.label)}
        value={pickedAfter}
        max={total}
        stop={highest}
        onChange={(value) => chooseSplit(Math.max(lowest, value))}
      />
      <HudWindowFoot
        note={
          !merge && total > Math.min(capOf(picked), capOf(tapped))
            ? TRANSFER_TROOPS.cap(Math.min(capOf(picked), capOf(tapped)))
            : undefined
        }
      >
        <HudButton
          kind="primary"
          icon="transfer"
          disabled={moved === 0 || !valid}
          busy={sending ? TRANSFER_TROOPS.sending : undefined}
          onClick={send}
        >
          {moved === 0
            ? TRANSFER_TROOPS.pick
            : merge
              ? confirmed
                ? TRANSFER_TROOPS.confirmMerge(merge.survivor.label)
                : TRANSFER_TROOPS.merge(merge.survivor.label)
              : TRANSFER_TROOPS.move(Math.abs(moved), to.label)}
        </HudButton>
      </HudWindowFoot>
    </div>
  );
};

/**
 * One army in the transfer: its portrait and name, its stamina, its XP, what it holds now and after. An army a merge
 * empties leaves the map with its XP: its portrait fades and its XP is struck out. The army that stays shows the
 * stamina the merge leaves it, when that is less than it has.
 */
const ArmySide = ({
  army,
  after,
  leaves,
  staminaAfter,
}: {
  army: DockArmy;
  after: number;
  leaves: boolean;
  staminaAfter: number | undefined;
}) => (
  <div className="flex flex-col items-center gap-1 rounded-lg border border-hud-line bg-hud-well p-2">
    <span
      className={cn(
        "flex size-12 items-center justify-center overflow-hidden rounded-full border-2 bg-hud-surface",
        leaves ? "border-hud-bad opacity-50 grayscale" : "border-hud-good",
      )}
    >
      <Icon name={army.art} size={44} />
    </span>
    <span className="text-hud-body text-hud-strong">{army.label}</span>
    {army.stamina && (
      <span className="flex items-center gap-1 text-hud-label text-hud-muted tabular-nums">
        <Icon name="stamina" size={16} />
        {formatAmount(Math.floor(army.stamina.current))}/{formatAmount(army.stamina.max)}
        {staminaAfter !== undefined && staminaAfter < Math.floor(army.stamina.current) && (
          <>
            <span>→</span>
            <span className="text-hud-bad">{formatAmount(staminaAfter)}</span>
          </>
        )}
      </span>
    )}
    {army.xp !== undefined &&
      (leaves ? (
        <s className="text-hud-label tabular-nums text-hud-bad">{`${formatAmount(army.xp)} ${XP}`}</s>
      ) : (
        <span className="text-hud-label tabular-nums text-hud-gold">{`${formatAmount(army.xp)} ${XP}`}</span>
      ))}
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
