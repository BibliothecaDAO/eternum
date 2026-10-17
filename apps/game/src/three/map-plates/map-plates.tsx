import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { formatDuration } from "@/ui/design-system/kit/time";
import { TroopTierChip } from "@/ui/design-system/kit/troop-tier-chip";

import { armyFitsOneLine } from "./map-plate-layout";
import {
  attackOrder,
  formatCount,
  restingGuard,
  type ArmyPlate,
  type MapPlate,
  type PlateTroops,
  type StructurePlate,
} from "./map-plate-model";

/**
 * A map plate (the owner's pick, map-labels rounds 2 to 4): a painting only where it reads faster than a word (troop
 * type, resource, the open lock); a place's name set as a title, a player's in the side's colour; ids and levels muted.
 * At rest: a realm's name and one guard number; an army's owner over its troops and stamina; a nameless thing's
 * painting, what it yields and its guard. Opened (its tile hovered, or selected), it adds only what it does not say at
 * rest.
 */
export const Plate = ({ plate, open }: { plate: MapPlate; open: boolean }) =>
  plate.kind === "army" ? (
    <ArmyPlateView plate={plate} open={open} />
  ) : (
    <StructurePlateView plate={plate} open={open} />
  );

/** A plate with no room beside its neighbours: the kind's painting in a disk ringed in the side's colour. */
export const Pin = ({ plate }: { plate: MapPlate }) => (
  <div className="mp-pin">
    <Icon name={plate.kind === "army" ? "map-army" : plate.icon} size={18} />
  </div>
);

const StructurePlateView = ({ plate, open }: { plate: StructurePlate; open: boolean }) => (
  <div className="mp-plate" data-open={open}>
    {open && <StructureOpenLines plate={plate} />}
    <div className="mp-plate__row">
      {plate.title ? <span className="mp-title">{plate.title}</span> : <Icon name={plate.icon} size={20} />}
      {plate.yields !== undefined && <Icon name={resourceMeaning(plate.yields)} size={18} />}
      <RestingGuard guards={plate.guards} />
    </div>
  </div>
);

/**
 * What an opened structure adds: whose it is, its level or id, troops on their way to it, and its guard slots in the
 * order an attacker meets them.
 */
const StructureOpenLines = ({ plate }: { plate: StructurePlate }) => (
  <>
    <div className="mp-plate__more">
      <span className="mp-owner">{plate.owner}</span>
      <span className="mp-muted">{plate.level !== undefined ? `Level ${plate.level}` : plate.code}</span>
    </div>
    {plate.arrivals.length > 0 && (
      <div className="mp-plate__more" aria-label="Arriving">
        <Icon name="transfer" size={18} alt="Arriving" />
        {plate.arrivals.map((arrival, index) => (
          <span key={index} className="mp-troops">
            <Troops troops={arrival.troops} />
            <span className="mp-muted">{formatDuration(arrival.secondsLeft)}</span>
          </span>
        ))}
      </div>
    )}
    {plate.guards.length > 1 && (
      <div className="mp-plate__more" aria-label="Guards, first met first">
        {attackOrder(plate.guards).map((slot, index) => (
          <span key={index} className="mp-troops">
            {index > 0 && <span className="mp-next">›</span>}
            <Troops troops={slot} />
          </span>
        ))}
      </div>
    )}
  </>
);

const RestingGuard = ({ guards }: { guards: readonly PlateTroops[] }) => {
  const guard = restingGuard(guards);
  switch (guard.kind) {
    case "open":
      return (
        <span className="mp-guard">
          <Icon name="unlock" size={18} alt="Open" />
        </span>
      );
    case "slot":
      return (
        <span className="mp-guard">
          <Troops troops={guard.slot} />
        </span>
      );
    case "total":
      return <span className="mp-guard tabular-nums">{formatCount(guard.total)}</span>;
  }
};

/**
 * An army keeps one shape: its owner over its troops, the stamina bar at its foot. Opened, the same two lines carry
 * more, inline: the owner and the realm it comes from, then its id and its troops; on one line when that fits.
 */
const ArmyPlateView = ({ plate, open }: { plate: ArmyPlate; open: boolean }) => {
  const owner = <span className="mp-owner">{plate.owner}</span>;
  const home = <span className="mp-title">{plate.homeName}</span>;
  const id = <span className="mp-muted">{plate.code}</span>;
  const troops = <Troops troops={plate.troops} />;
  return (
    <div className="mp-plate" data-open={open}>
      {!open ? (
        <>
          <div className="mp-plate__name">{owner}</div>
          <div className="mp-plate__row">{troops}</div>
        </>
      ) : armyFitsOneLine(plate) ? (
        <div className="mp-plate__row">
          {owner}
          {home}
          {id}
          {troops}
        </div>
      ) : (
        <>
          <div className="mp-plate__name">
            {owner}
            {home}
          </div>
          <div className="mp-plate__row">
            {id}
            {troops}
          </div>
        </>
      )}
      {plate.stamina !== undefined && (
        <span className="mp-plate__meter" aria-label="Stamina">
          <i style={{ width: `${100 * plate.stamina}%` }} />
        </span>
      )}
    </div>
  );
};

/** A troop stack, its type shown by its painting: "[crossbow] T3 1,500". */
const Troops = ({ troops }: { troops: PlateTroops }) => (
  <span className="mp-troops">
    <Icon name={`${troops.type}-t${troops.tier}` as IconMeaning} size={20} />
    <TroopTierChip tier={`T${troops.tier}`} size="label" />
    <span className="tabular-nums">{formatCount(troops.count)}</span>
  </span>
);
