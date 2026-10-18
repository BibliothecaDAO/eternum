import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudTierChip } from "@/ui/design-system/kit/hud-elements";

import { formatCount, type MapPlate, type PlateTroops } from "./map-plate-model";
import { plateRows, restingStamina, type PlateSegment } from "./map-plate-rows";

/**
 * A map plate (the owner's pick, map-labels rounds 2 to 5): the rows `plateRows` says, on the HUD panel's surface. A
 * painting only for a troop stack, where it reads faster than a word; everything else said in words.
 */
export const Plate = ({ plate, open }: { plate: MapPlate; open: boolean }) => {
  const stamina = restingStamina(plate, open);
  return (
    <div className="mp-plate" data-open={open}>
      {plateRows(plate, open).map((row, index) => (
        <div key={index} className="mp-plate__row">
          {row.map((segment, at) => (
            <Segment key={at} segment={segment} />
          ))}
        </div>
      ))}
      {stamina !== null && (
        <span className="mp-plate__stamina" role="img" aria-label={`Stamina ${Math.round(stamina * 100)}%`}>
          <i style={{ width: `${stamina * 100}%` }} />
        </span>
      )}
    </div>
  );
};

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
    case "stamina":
      return <Stamina current={segment.current} max={segment.max} />;
    default:
      return <span className={`mp-${segment.kind}`}>{segment.text}</span>;
  }
};

/** A troop stack, its type shown by its painting: "[crossbow] T3 1,500". */
const Troops = ({ troops }: { troops: PlateTroops }) => (
  <span className="mp-troops">
    <Icon name={`${troops.type}-t${troops.tier}` as IconMeaning} size={20} />
    <HudTierChip tier={troops.tier} />
    <span className="mp-count">{formatCount(troops.count)}</span>
  </span>
);

/** An army's stamina: its bar, then exactly how much of how much ("84/150"). */
const Stamina = ({ current, max }: { current: number; max: number }) => (
  <span className="mp-stamina" aria-label={`Stamina ${formatCount(current)} of ${formatCount(max)}`}>
    <span className="mp-plate__meter">
      <i style={{ width: `${(100 * current) / max}%` }} />
    </span>
    <span className="mp-label">
      {formatCount(current)}/{formatCount(max)}
    </span>
  </span>
);
