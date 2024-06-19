import { BaseThreeTooltip } from "@/ui/elements/BaseThreeTooltip";
import { findResourceById } from "@bibliothecadao/eternum";
import ProgressBar from "../../elements/ProgressBar";
import { ResourceIcon } from "../../elements/ResourceIcon";

type BuildingTooltipProps = {
  resourceId: number;
};

export const BuildingTooltip = ({ resourceId }: BuildingTooltipProps) => {
  const resource = findResourceById(resourceId);

  return (
    <BaseThreeTooltip>
      <div className="flex items-center">
        <ResourceIcon resource={resource?.trait || ""} size="sm" />
        <div className=" ml-2 text-sm text-gold font-bold">{resource?.trait} Mine</div>
        <div className="flex flex-col ml-auto text-xxs">
          <div className="flex items-center mx-auto text-white/70">
            +0
            <ResourceIcon
              containerClassName="mx-0.5"
              className="!w-[12px]"
              resource={findResourceById(resourceId)?.trait as any}
              size="xs"
            />
            /h
          </div>
        </div>
      </div>
      <ProgressBar rounded progress={35} className="bg-white mt-2" />
      <div className="flex justtify-between mt-2 text-xxs">
        <div className="italic text-white/70">Generating</div>
        <div className="flex ml-auto">
          <ResourceIcon resource={resource?.trait || ""} size="xs" className="!w-[12px]" />
          <div className="mx-1 text-brilliance">{`+500`}</div>
        </div>
      </div>
    </BaseThreeTooltip>
  );
};
