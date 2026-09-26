import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { configManager } from "@bibliothecadao/eternum";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { useMemo, useState } from "react";
import { Chip } from "../frontier-chips";
import { BoltGlyph, CardFanGlyph } from "../glyphs";
import { type MapSiteKind, mapSiteKind, readMapSite } from "./map-site-plan";
import { useSelectedOwnArmy } from "./selected-army";

const MAP_SITE_MODELS = ["ArmyProgress", "ExplorerTroops", "TileOccupancy"] as const;

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
 * A Shrine's or Well's tile card: its art and name, what one use gives as an icon and number (a level and its pick,
 * or stamina), and one Use button for the selected army standing beside it. The site is spent by that use, so the
 * card closes as its tile empties.
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
  const plan = readMapSite(selected.kind, siteTile, user && { ...user, progress: progress ?? undefined });
  const [pending, setPending] = useState(false);

  const use = async () => {
    if (!user || !account.account) return;
    setPending(true);
    try {
      playUnitCommandSound("move");
      await setup.systemCalls.interact_site({
        signer: account.account,
        explorer_id: user.army.explorer_id,
        coord: { alt: siteTile.alt, x: siteTile.col, y: siteTile.row },
      });
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, `The ${plan.kind} could not be used.`));
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-label={plan.kind}
      data-frontier-sheet
      className={cn(
        "frontier-sheet pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans",
        "landscape:inset-x-auto landscape:bottom-4 landscape:left-1/2 landscape:w-[min(520px,60vw)] landscape:-translate-x-1/2",
      )}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="-mt-2 flex h-6 justify-center">
        <span className="frontier-handle mt-1" />
      </button>
      <header className="flex items-center gap-3">
        <img src={plan.art} alt="" className="size-24 shrink-0 rounded-xl bg-black/50 object-contain p-2" />
        <span className="flex flex-col items-start gap-2">
          <h2 className="frontier-title">{plan.kind}</h2>
          {plan.kind === "Shrine" ? (
            <Chip tone="gain" label="Levels" icon={<CardFanGlyph />} value={`+${plan.gain}`} />
          ) : (
            <Chip tone="gain" label="Stamina" icon={<BoltGlyph />} value={`+${plan.gain}`} />
          )}
        </span>
      </header>
      <button
        type="button"
        disabled={pending || !plan.usable}
        onClick={() => void use()}
        className="frontier-primary flex items-center justify-center gap-3"
      >
        Use
      </button>
    </section>
  );
};
