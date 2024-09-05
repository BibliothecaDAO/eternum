import useUIStore from "@/hooks/store/useUIStore";
import { ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import { STRUCTURE_IMAGE_PATHS } from "./StructureConstructionMenu";
import clsx from "clsx";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { InfoIcon } from "lucide-react";

export const StructureCard = ({
  structureId,
  onClick,
  active,
  name,
  toolTip,
  canBuild,
  className,
}: {
  structureId: StructureType;
  onClick: () => void;
  active: boolean;
  name: string;
  toolTip: React.ReactElement;
  canBuild?: boolean;
  resourceId?: ResourcesIds;
  className?: string;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  return (
    <div
      style={{
        backgroundImage: `url(${STRUCTURE_IMAGE_PATHS[structureId]})`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      onClick={onClick}
      className={clsx(
        "border-transparent text-gold overflow-hidden text-ellipsis cursor-pointer relative h-36 min-w-20 hover:border-gradient hover:border-2 hover:bg-gold/20",
        {
          "!border-lightest border-gradient border-2": active,
        },
        className,
      )}
    >
      {!canBuild && (
        <div className="absolute w-full h-full bg-black/70 text-white/60 p-4 text-xs  flex justify-center ">
          <div className="self-center">insufficient funds</div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 font-bold text-xs px-2 py-1 bg-black/90 ">
        <div className="truncate">{name}</div>
      </div>
      <div className="flex relative flex-col items-start text-xs font-bold p-2">
        <ResourceIcon resource={name} size="lg" />

        <InfoIcon
          onMouseEnter={() => {
            setTooltip({
              content: toolTip,
              position: "right",
            });
          }}
          onMouseLeave={() => {
            setTooltip(null);
          }}
          className="w-4 h-4 absolute top-2 right-2"
        />
      </div>
    </div>
  );
};
