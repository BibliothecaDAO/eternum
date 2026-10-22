import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { armyLabel } from "@/ui/features/frontier/hud/dock-armies";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { configManager } from "@bibliothecadao/eternum";
import { armyNumber, resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { formatCharge, formatExact } from "@bibliothecadao/types";

/** The complete army that remains, shown before the player confirms a full merge. */
export const ArmyMergePreview = ({
  survivorId,
  loserId,
  position,
  value,
}: {
  survivorId: number;
  loserId: number;
  position: { x: number; y: number };
  value: number | undefined;
}) => {
  const {
    setup: { store },
  } = useGame();
  const timestamp = useCurrentBlockTimestamp();
  useNativeRevision(["ExplorerTroops", "ArmyProgress", "ArmySlot", "EntityName"]);
  const gameId = configManager.getActiveGameId();
  const survivor = store.require("ExplorerTroops", { game_id: gameId, explorer_id: survivorId });
  const loser = store.require("ExplorerTroops", { game_id: gameId, explorer_id: loserId });
  const progress = store.get("ArmyProgress", { game_id: gameId, explorer_id: survivorId });
  const bars = [survivor, loser].map((army) =>
    getExplorerStaminaSnapshot({ timestamp, liveTroops: resolveExplorerTroops(store, army) }),
  );
  const stamina = bars[0] && bars[1] ? Math.min(bars[0].current, bars[1].current, bars[0].max) : undefined;
  const slot = armyNumber(survivor);
  return (
    <div className="rounded-md border border-hud-line bg-hud-well p-3 text-hud-body text-hud-ink" role="status">
      <p>
        {armyLabel(store, survivorId)} survives at ({position.x}, {position.y})
        {slot === undefined ? "" : ` · slot ${slot}`}.
      </p>
      {progress && value !== undefined && (
        <p>
          {formatExact(value)} progression value · {formatExact(progress.xp)} unspent XP. Keeps all its upgrades; the
          other army’s XP is lost.
        </p>
      )}
      <p>
        {stamina === undefined ? "Stamina —" : `${formatCharge(stamina)} stamina after merging`}.{" "}
        {slot === undefined ? "" : " The other army’s slot is released."}
      </p>
    </div>
  );
};
