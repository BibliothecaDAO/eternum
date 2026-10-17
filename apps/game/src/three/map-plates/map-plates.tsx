import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { TroopTierChip } from "@/ui/design-system/kit/troop-tier-chip";

import { formatCount, type MapPlate, type PlateTroops } from "./map-plate-model";
import { plateRows, type PlateSegment } from "./map-plate-rows";

/**
 * A map plate (the owner's pick, map-labels rounds 2 to 5): the rows `plateRows` says, on the HUD panel's surface. A
 * painting only for a troop stack, where it reads faster than a word; everything else said in words.
 */
export const Plate = ({ plate, open }: { plate: MapPlate; open: boolean }) => (
  <div className="mp-plate" data-open={open}>
    {plateRows(plate, open).map((row, index) => (
      <div key={index} className="mp-plate__row">
        {row.map((segment, at) => (
          <Segment key={at} segment={segment} />
        ))}
      </div>
    ))}
    {plate.kind === "army" && plate.stamina !== undefined && (
      <span className="mp-plate__meter" aria-label="Stamina">
        <i style={{ width: `${100 * plate.stamina}%` }} />
      </span>
    )}
  </div>
);

/** A plate with no room beside its neighbours: the kind's painting in a disk ringed in the side's colour. */
export const Pin = ({ plate }: { plate: MapPlate }) => (
  <div className="mp-pin">
    <Icon name={plate.kind === "army" ? "map-army" : plate.icon} size={18} />
  </div>
);

const Segment = ({ segment }: { segment: PlateSegment }) => {
  switch (segment.kind) {
    case "troops":
      return <Troops troops={segment.troops} />;
    case "next":
      return <span className="mp-next">›</span>;
    case "divider":
      return <span className="mp-divider" />;
    default:
      return <span className={`mp-${segment.kind}`}>{segment.text}</span>;
  }
};

/** A troop stack, its type shown by its painting: "[crossbow] T3 1,500". */
const Troops = ({ troops }: { troops: PlateTroops }) => (
  <span className="mp-troops">
    <Icon name={`${troops.type}-t${troops.tier}` as IconMeaning} size={20} />
    <TroopTierChip tier={`T${troops.tier}`} size="label" />
    <span className="mp-count">{formatCount(troops.count)}</span>
  </span>
);
