import "./frontier-bar.css";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { aspectName, rankName, type AspectId } from "@bibliothecadao/types";

export const RealmHeaderChip = ({
  owner,
  name,
  level,
  aspect,
  expanded,
  onPress,
}: {
  owner: string | bigint;
  name: string;
  level: number;
  aspect?: AspectId;
  expanded?: boolean;
  onPress: () => void;
}) => {
  const profile = usePlayerProfile(owner);
  const rank = rankName(level);
  const subline = aspect ? `${rank} · ${aspectName(aspect)}` : rank;
  return (
    <button
      type="button"
      className="frontier-realm-chip"
      aria-label={`${name}, ${subline}`}
      aria-expanded={expanded}
      onClick={onPress}
    >
      <span className="frontier-realm-chip__avatar">
        <img
          src={playerPortraitUrl(owner, profile.portrait)}
          alt=""
          aria-hidden="true"
          className="frontier-realm-chip__portrait"
        />
        {aspect && (
          <span className="frontier-realm-chip__facet">
            <AspectMark aspect={aspect} size={14} decorative />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="frontier-realm-chip__name">{name}</span>
        <span className="frontier-realm-chip__sub">{subline}</span>
      </span>
    </button>
  );
};
