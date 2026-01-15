import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { ClientComponents } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

interface CompactStructureInfoProps {
  isMine: boolean;
  ownerDisplayName: string;
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
}

export const CompactStructureInfo = ({ isMine, ownerDisplayName, structure }: CompactStructureInfoProps) => {
  const mode = useGameModeConfig();
  return (
    <div className="flex text-gold text-xxs flex-col w-1/5">
      <div className="nowrap truncate max-w-full">
        {isMine ? "🟢" : "🔴"} {ownerDisplayName}
      </div>
      <div className="nowrap truncate max-w-full">{mode.structure.getName(structure).name}</div>
    </div>
  );
};
