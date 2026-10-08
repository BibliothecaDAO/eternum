import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { MOVE, SHRINE, STAMINA, USE, USING, WELL, XP } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { configManager } from "@bibliothecadao/eternum";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

import { useOrderAt } from "../hud/army-order";
import { armyArt, useDockArmies } from "../hud/dock-armies";
import { useApproachTile } from "./approach";
import { type MapSiteKind, mapSiteKind, readMapSite } from "./map-site-plan";
import { useSelectedOwnArmy } from "./selected-army";
import { armWellRefill } from "./well-refill";

const MAP_SITE_MODELS = ["ArmyProgress", "ArmyProgressionRules", "ExplorerTroops", "TileOccupancy"] as const;

/** The map tile the player tapped, when a Shrine or Well stands on it. */
export const useSelectedMapSite = (): { kind: MapSiteKind; tile: TileSpatialRenderable } | null => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  const kind = mapSiteKind(tile?.occupierType);
  return isMapView && tile && kind ? { kind, tile } : null;
};

/**
 * A Shrine's or Well's card (wireframe 06): the army beside it and what one use gives it (a Well's stamina before and
 * after, never above the army's own maximum; a Shrine's XP), then Use, or Move until the army stands beside it. The
 * site is spent by that use, so the card closes as its tile empties.
 */
export const MapSiteCard = ({
  selected,
  onClose,
}: {
  selected: { kind: MapSiteKind; tile: TileSpatialRenderable };
  onClose: () => void;
}) => {
  const { setup, account } = useGame();
  const user = useSelectedOwnArmy();
  useNativeRevision(MAP_SITE_MODELS);
  const siteTile = selected.tile.hexCoords;
  const progress =
    user &&
    setup.store.get("ArmyProgress", { game_id: configManager.getActiveGameId(), explorer_id: user.army.explorer_id });
  const rules = setup.store.get("ArmyProgressionRules", { game_id: configManager.getActiveGameId() });
  const plan = readMapSite(selected.kind, siteTile, user && { ...user, progress: progress ?? undefined }, rules);
  const approach = useOrderAt(useApproachTile(siteTile, user !== null && !plan.usable));
  const stamina = useUserStamina(user?.army.explorer_id);
  const [sending, setSending] = useState(false);

  const use = async () => {
    if (!user || !account.account) return;
    setSending(true);
    try {
      playUnitCommandSound("move");
      await setup.systemCalls.interact_site({
        signer: account.account,
        explorer_id: user.army.explorer_id,
        coord: { alt: siteTile.alt, x: siteTile.col, y: siteTile.row },
      });
      if (plan.kind === "Well") armWellRefill(user.army.explorer_id);
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The site could not be used."));
    } finally {
      setSending(false);
    }
  };

  const word = plan.kind === "Shrine" ? SHRINE : WELL;
  return (
    <Sheet label={word} onClose={onClose}>
      <header className="flex items-center gap-3">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-kit-line2 bg-kit-ground">
          <KitIcon code={plan.kind === "Shrine" ? "Sh" : "Wl"} size={40} />
        </span>
        <h2 className="frontier-title flex-1">{word}</h2>
      </header>
      <div className="flex items-center justify-center gap-2.5">
        {user && (
          <span data-tone="lit" className="frontier-chip h-8 !py-0 !pl-1">
            <span className="contents">
              <img src={armyArt(user.army.troops)} alt="" className="size-[22px] rounded-full object-cover" />
              <span className="frontier-chip-number tabular-nums !text-[15px]">
                {formatExact(Number(user.army.troops.count / BigInt(RESOURCE_PRECISION)))}
              </span>
            </span>
          </span>
        )}
        {plan.kind === "Well" ? (
          <Chip icons={["St"]} label={STAMINA} value={wellGain(plan.gain, stamina)} />
        ) : (
          <Chip icons={[]} label={XP} value={plan.gain === undefined ? "—" : `+${formatAmount(plan.gain)}`} unit={XP} />
        )}
      </div>
      {plan.usable ? (
        <Button role="primary" word={USE} loading={sending ? USING : undefined} onClick={() => void use()} />
      ) : (
        approach && (
          <Button
            role="primary"
            icon="Bt"
            word={MOVE}
            prices={[
              { of: "stamina", amount: approach.stamina.cost },
              { of: "wheat", amount: Math.ceil(approach.wheat.cost) },
            ]}
            onClick={() => requestOrderAt(approach.target)}
          />
        )
      )}
    </Sheet>
  );
};

/** The selected army's stamina and its own maximum, from the dock's reading of it. */
const useUserStamina = (explorerId: number | undefined) => {
  const { setup } = useGame();
  const army =
    explorerId === undefined
      ? undefined
      : setup.store.get("ExplorerTroops", {
          game_id: configManager.getActiveGameId(),
          explorer_id: explorerId,
        });
  const home = army && setup.store.get("Structure", { game_id: army.game_id, entity_id: army.owner });
  const armies = useDockArmies(home ?? null);
  return armies.find((candidate) => candidate.explorerId === explorerId)?.stamina;
};

/** A Well's stamina: the army's bar before and after the refill, or what it adds when no army stands at it. */
const wellGain = (gain: number | undefined, stamina: { current: number; max: number } | undefined): string => {
  if (gain === undefined) return "—";
  return stamina
    ? `${formatAmount(stamina.current)} → ${formatAmount(Math.min(stamina.max, stamina.current + gain))}`
    : `+${formatAmount(gain)}`;
};
