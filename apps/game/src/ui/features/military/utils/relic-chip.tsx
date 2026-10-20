import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudRelic } from "@/ui/design-system/kit/hud-elements";
import { getRelicInfo, ResourcesIds } from "@bibliothecadao/types";

type RelicKind = Parameters<typeof HudRelic>[0]["kind"];

/** A relic's kind as the sheet's relic chip colours it: its type, lower-cased ("Damage Reduction" is "damage-reduction"). */
const relicKind = (type: string) => type.toLowerCase().replace(" ", "-") as RelicKind;

/**
 * A relic as the sheet's chip, in its kind's colour, its effect on the app's tooltip. With `onPress` it is a button that
 * says whether pressing adds or removes the relic, and it is lit while chosen.
 */
export const RelicChip = ({
  relic,
  chosen,
  onPress,
}: {
  relic: ResourcesIds;
  chosen?: boolean;
  onPress?: () => void;
}) => {
  const info = getRelicInfo(relic);
  const name = info?.name ?? ResourcesIds[relic];
  return (
    <HudRelic
      icon={resourceMeaning(relic)}
      kind={info ? relicKind(info.type) : "production"}
      gives={name}
      tip={info?.effect}
      state={onPress ? (chosen ? "active" : "held") : undefined}
      label={onPress ? `${chosen ? "Remove" : "Add"} ${name}` : undefined}
      onPress={onPress}
    />
  );
};
