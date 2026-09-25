import { ArrowRightLeft, ShieldAlert, Sparkles } from "@/ui/design-system/atoms/game-icons";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import Button from "@/ui/design-system/atoms/button";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { getTileAt, configManager, entityMapPosition } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import type { ID } from "@bibliothecadao/types";
import { resolveSpireCrossing } from "./spire-crossing";

export const SpireTravelModal = ({
  explorerId,
  onTravelThroughSpire,
  essenceCost,
}: {
  explorerId: ID;
  onTravelThroughSpire: () => void;
  essenceCost: number;
}) => {
  const {
    setup: { store },
  } = useGame();
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const explorer = useNativeRow("ExplorerTroops", {
    game_id: configManager.getActiveGameId(),
    explorer_id: explorerId,
  });
  useNativeRevision(["TileOpt", "TileOccupancy"]);
  const position = explorer ? entityMapPosition(store, explorer.game_id, explorerId) : undefined;
  const explorerLayer = position?.alt ?? false;
  const destination = position ? getTileAt(store, !explorerLayer, position.x, position.y) : undefined;
  const crossing = resolveSpireCrossing(explorerLayer, destination);
  const sideName = crossing.toEthereal ? "the Ethereal Layer" : "the surface";

  const handleTravel = () => {
    closeSurface();
    onTravelThroughSpire();
  };

  return (
    <SurfaceFrame title="Spire" icon={Sparkles} onClose={closeSurface} className="w-[560px]" bodyClassName="p-5">
      <div className="flex flex-col gap-4 text-gold/90">
        {crossing.kind === "clear" ? (
          <div className="flex items-start gap-3 rounded border border-cyan-300/25 bg-cyan-500/10 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 text-cyan-200" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-cyan-100">Your hex on {sideName} is clear</p>
              <p className="text-xs text-gold/70">
                The army crosses to the same hex on {sideName}. It keeps its position and its stamina. The crossing
                costs {essenceCost} Essence from its home structure, on the way back too.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded border border-red-400/30 bg-red-500/10 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-red-200" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-red-100">
                {crossing.by === "army" ? "An army holds your hex on " : "A structure holds your hex on "}
                {sideName}
              </p>
              <p className="text-xs text-gold/70">
                A crossing needs that hex free. Move one hex along the spire and try again, or clear it first.
              </p>
            </div>
          </div>
        )}
        <Button
          size="md"
          forceUppercase={false}
          disabled={crossing.kind !== "clear"}
          className="w-full border-cyan-300/50 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25 disabled:opacity-50"
          onClick={handleTravel}
        >
          <span className="inline-flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            {crossing.toEthereal ? "Enter the Ethereal Layer" : "Return to the surface"}
          </span>
        </Button>
      </div>
    </SurfaceFrame>
  );
};
