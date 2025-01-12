import useUIStore from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { InfoIcon } from "lucide-react";
import { STRUCTURE_IMAGE_PATHS } from "./structure-construction-menu";

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
      onClick={onClick}
      className={clsx(
        "text-gold bg-brown/30 overflow-hidden text-ellipsis cursor-pointer relative h-36 min-w-20 hover:bg-gold/20 rounded-xl",
        {
          "!border-lightest": active,
        },
        className,
      )}
    >
      <img
        src={STRUCTURE_IMAGE_PATHS[structureId]}
        alt={name}
        className="absolute inset-0 w-full h-full object-contain"
      />
      {!canBuild && (
        <div className="absolute w-full h-full bg-brown/70 p-4 text-xs flex justify-center">
          <div className="self-center flex items-center space-x-2">
            <ResourceIcon tooltipText="Need More Resources" resource="Silo" size="lg" />
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <div className="truncate">{name}</div>
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
      <div className="flex relative flex-col items-end p-2 rounded">
        <div className="rounded p-1 bg-brown/10">
          <ResourceIcon withTooltip={false} resource={name} size="lg" />
        </div>
      </div>
    </div>
  );
};
