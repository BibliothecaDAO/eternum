import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { explorerTransferPlan } from "./army-merge";
import { useGame } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Icon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  AmountInput,
  HudButton,
  HudNotice,
  HudSheet,
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

import { AmountRange } from "../amount-range";
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
 * Troops sent from the picked army to the one tapped beside it: the map has chosen which army goes into which (owner,
 * 26 October 2026: the quick splits are "not needed since the player do it from the map"). The one control is the
 * amount sent, from none up to all the picked army holds, typed or dragged, and it opens at all: a merge (owner, the
 * same evening: "why doesnt it go from 0 to 600 with 600 (max picked)"). The cards say what happens, not a paragraph:
 * each army's troops, stamina and total XP now and after, and an army a merge empties faded. The one
 * verb names the army that stays. The game moves troops between alike armies only, within the receiving realm's limit.
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
  // The amount is a choice over the troops the armies hold when it is made: when either count changes (a fight, an
  // order landing) it starts again over the new counts, and says so, so no old choice turns into an impossible move.
  const counts = `${pair.picked.explorerId}:${pair.picked.troops}:${pair.tapped.explorerId}:${pair.tapped.troops}`;
  const [first] = useState(counts);
  return (
    <HudSheet label={TRANSFER_TROOPS.title} onClose={onClose}>
      {counts !== first && <HudNotice tone="warn" line={TRANSFER_TROOPS.changed} />}
      <TransferAmount key={counts} realm={realm} pair={pair} onSent={onClose} />
    </HudSheet>
  );
};

const TransferAmount = ({
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
  const capOf = (army: DockArmy) => configManager.getMaxArmySize(realm.base.level, army.troopsFact.tier as TroopTier);
  // The tapped army takes what fits under its realm's limit; the picked army can send no more than it holds.
  const room = Math.max(0, capOf(tapped) - tapped.troops);
  const most = Math.min(picked.troops, room);
  const [sent, setSent] = useState(most);
  const [confirmation, setConfirmation] = useState<{ sent: number; facts: unknown[] } | null>(null);
  const confirmed = confirmation?.sent === sent && confirmation.facts.every((fact, index) => fact === choice[index]);
  const chooseAmount = (value: number) => {
    setConfirmation(null);
    setSent(value);
  };
  const alike =
    picked.troopsFact.category === tapped.troopsFact.category && picked.troopsFact.tier === tapped.troopsFact.tier;

  const plan = explorerTransferPlan({
    sourceCount: picked.troops,
    targetCount: tapped.troops,
    targetCap: capOf(tapped),
    sourceProgress: progress(picked.explorerId),
    targetProgress: progress(tapped.explorerId),
    rules,
  });
  const fullMerge = sent > 0 && sent === picked.troops;
  const mergedStamina =
    fullMerge && tapped.stamina && picked.stamina
      ? Math.min(tapped.stamina.current, picked.stamina.current, tapped.stamina.max)
      : undefined;
  const valid = plan.known && (fullMerge ? plan.fullFits && mergedStamina !== undefined : sent <= plan.partialMax);
  const after = (army: DockArmy) => (army === picked ? picked.troops - sent : tapped.troops + sent);

  const send = async () => {
    const direction = getDirectionBetweenAdjacentHexes(pickedAt, tappedAt);
    // What goes leaves the picked army, which holds it, and fits the tapped army's limit.
    if (!account || direction === null || sent <= 0 || sent > most || !valid) return;
    try {
      if (readChoice().some((fact, index) => fact !== choice[index])) {
        throw new Error(TRANSFER_TROOPS.stale);
      }
      if (fullMerge && plan.confirmLoss && !confirmed) {
        setConfirmation({ sent, facts: choice });
        return;
      }
      await sendOnce("army", picked.explorerId, { order: "move" }, () =>
        systemCalls.explorer_explorer_swap({
          signer: account as unknown as Account,
          from_explorer_id: picked.explorerId,
          to_explorer_id: tapped.explorerId,
          to_explorer_direction: direction,
          count: multiplyByPrecision(sent),
        }),
      );
      onSent();
    } catch (error) {
      toast.failed(error, TRANSFER_TROOPS.failed);
    }
  };

  if (!alike) return <HudNotice tone="warn" line={TRANSFER_TROOPS.unalike(picked.label, tapped.label)} />;
  // A full merge whose progress is known: the army that stays and the one that leaves.
  const merge =
    fullMerge && plan.known && plan.sourceValue !== undefined
      ? { survivor: tapped, loser: picked, lostXp: plan.sourceValue }
      : null;
  const side = (army: DockArmy) => {
    const totalXp = army === picked ? plan.sourceValue : plan.targetValue;
    return (
      <ArmySide
        army={army}
        after={after(army)}
        totalXp={totalXp}
        xpAfter={plan.known ? (army === merge?.loser ? 0 : totalXp) : undefined}
        leaves={army === merge?.loser}
        staminaAfter={army === merge?.survivor ? mergedStamina : undefined}
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {!plan.known && <HudNotice tone="warn" line={TRANSFER_TROOPS.waiting} />}
      <div className="ui-transfer__preview">
        {side(picked)}
        <Icon name="transfer" size={28} />
        {side(tapped)}
      </div>
      {merge && merge.lostXp > 0 && <HudNotice tone="warn" line={TRANSFER_TROOPS.losesProgress(merge.loser.label)} />}
      {/* How many the picked army sends: typed, or dragged between none and all it holds, each end labelled. */}
      <div className="flex items-center gap-2">
        <AmountInput
          label={TRANSFER_TROOPS.amount(picked.label, tapped.label)}
          value={sent}
          max={most}
          onChange={chooseAmount}
        />
        <span className="flex-1">
          <AmountRange
            label={TRANSFER_TROOPS.amount(picked.label, tapped.label)}
            icon={picked.art}
            value={sent}
            min={0}
            max={picked.troops}
            stop={most}
            onChange={chooseAmount}
          />
        </span>
      </div>
      <HudWindowFoot note={room < picked.troops ? TRANSFER_TROOPS.cap(capOf(tapped)) : undefined}>
        <HudButton
          kind={confirmed && merge ? "danger" : "primary"}
          icon="transfer"
          disabled={sent === 0 || !valid}
          busy={sending ? TRANSFER_TROOPS.sending : undefined}
          onClick={send}
        >
          {sent === 0
            ? TRANSFER_TROOPS.pick
            : merge
              ? confirmed
                ? TRANSFER_TROOPS.confirmMerge(merge.survivor.label)
                : TRANSFER_TROOPS.merge(merge.survivor.label)
              : TRANSFER_TROOPS.move(sent, tapped.label)}
        </HudButton>
      </HudWindowFoot>
    </div>
  );
};

/**
 * Both cards count XP the same way: lifetime XP. A full transfer removes the source's
 * progress; the target keeps its own unchanged. A partial transfer keeps both progress bundles.
 */
const ArmySide = ({
  army,
  after,
  totalXp,
  xpAfter,
  leaves,
  staminaAfter,
}: {
  army: DockArmy;
  after: number;
  totalXp: number | undefined;
  xpAfter: number | undefined;
  leaves: boolean;
  staminaAfter: number | undefined;
}) => {
  return (
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
      {totalXp !== undefined && (
        <span
          role="group"
          aria-label={TRANSFER_TROOPS.totalXpFor(army.label)}
          className="flex flex-col items-center text-hud-label tabular-nums"
        >
          <span className="text-hud-muted">{TRANSFER_TROOPS.totalXp}</span>
          <span className="flex items-center gap-1">
            <span className="text-hud-muted">{formatAmount(totalXp)}</span>
            {xpAfter !== undefined && (
              <>
                <span className="text-hud-muted">→</span>
                <span className={leaves ? "text-hud-bad" : "text-hud-gold"}>{formatAmount(xpAfter)}</span>
              </>
            )}
          </span>
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
};
