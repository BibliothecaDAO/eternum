import { formatExact } from "@bibliothecadao/types";
import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudStamina, HudTierChip, type StaminaBar } from "@/ui/design-system/kit/hud-elements";

import { type MapPlate, type PlateTroops } from "./map-plate-model";
import { plateRows, type PlateSegment } from "./map-plate-rows";

/**
 * A map plate (the owner's pick, map-labels rounds 2 to 5), opened in its token's place: the rows `plateRows` says, on
 * the HUD panel's surface. A painting only for a troop stack, where it reads faster than a word; everything else said
 * in words.
 */
export const Plate = ({ plate }: { plate: MapPlate }) => (
  <div className="mp-plate" data-open="true">
    {plateRows(plate).map((row, index) => (
      <div key={index} className="mp-plate__row">
        {row.map((segment, at) => (
          <Segment key={at} segment={segment} />
        ))}
      </div>
    ))}
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
      return <Stamina stamina={segment} />;
    default:
      return <span className={`mp-${segment.kind}`}>{segment.text}</span>;
  }
};

/**
 * A troop stack, its type shown by its painting: "[crossbow] T3 1,500"; a guard slot's stamina, where the plate carries
 * it, as a tight bar under it.
 */
const Troops = ({ troops }: { troops: PlateTroops }) => (
  <span className="mp-troops">
    <Icon
      name={troops.beast ? beastMeaning(troops.beast) : (`${troops.type}-t${troops.tier}` as IconMeaning)}
      size={20}
    />
    {!troops.beast && <HudTierChip tier={troops.tier} />}
    <span className="mp-count">{formatExact(troops.count)}</span>
    {troops.stamina && (
      <span
        className="mp-plate__stamina mp-troops__stamina"
        role="img"
        aria-label={`Guard stamina ${formatExact(troops.stamina.current)}/${formatExact(troops.stamina.max)}`}
      >
        <HudStamina stamina={troops.stamina} />
      </span>
    )}
  </span>
);

/** An army's stamina: its bar, then exactly how much of how much ("84/150"). */
const Stamina = ({ stamina }: { stamina: StaminaBar }) => (
  <span className="mp-stamina" aria-label={`Stamina ${formatExact(stamina.current)} of ${formatExact(stamina.max)}`}>
    <span className="mp-plate__meter">
      <HudStamina stamina={stamina} />
    </span>
    <span className="mp-label">
      {formatExact(stamina.current)}/{formatExact(stamina.max)}
    </span>
  </span>
);
