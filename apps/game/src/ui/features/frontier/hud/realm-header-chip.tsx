import "./frontier-bar.css";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { aspectName, rankName, type AspectId } from "@bibliothecadao/types";

export const RealmHeaderChip = ({
  name,
  level,
  aspect,
  expanded,
  onPress,
}: {
  name: string;
  level: number;
  aspect?: AspectId;
  expanded?: boolean;
  onPress: () => void;
}) => {
  const address = useAccountStore((state) => state.account?.address ?? null);
  const profile = usePlayerProfile(address);
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
          src={playerPortraitUrl(address ?? name, profile.portrait)}
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
