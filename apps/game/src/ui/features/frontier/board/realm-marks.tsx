import { usePlayerName, usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { HudPortrait } from "@/ui/design-system/kit/hud-elements";
import { COSMETICS_WORDS, YOU } from "@/ui/design-system/kit/words";
import { isWonderPainting, type HomePaintingKind } from "@/ui/design-system/home-icons";
import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { layerName, rankName } from "@bibliothecadao/types";

const DEPTH_ICONS = ["depth-1", "depth-2", "depth-3"] as const;

export const RealmBadge = ({
  level,
  depth,
  hasWonder = false,
  painting,
}: {
  level: number;
  depth: number;
  hasWonder?: boolean;
  painting?: HomePaintingKind;
}) => {
  const step = Math.min(depth, 3);
  const showsWonder = isWonderPainting(painting);
  const name = showsWonder ? `${COSMETICS_WORDS.families.wonder} · ${rankName(level)}` : rankName(level);
  const line = step === 0 ? name : `${name} · ${layerName(step)}`;
  return (
    <span role="img" aria-label={line} data-tip={line} className="relative inline-flex size-7 shrink-0">
      <Icon name={realmMeaning(level, hasWonder, painting)} size={28} />
      {step > 0 && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1.5 inline-flex rounded-full border border-hud-line-strong bg-hud-surface p-px"
        >
          <Icon name={DEPTH_ICONS[step - 1]} size={14} />
        </span>
      )}
    </span>
  );
};

/**
 * A lord by the one name rule: the claimed name; else "Lord" and the account's last four, muted; "You" on the
 * player's own row. The portrait shows where there is room for it.
 */
export const LordName = ({
  account,
  you = false,
  portrait = false,
}: {
  account: string | bigint;
  you?: boolean;
  portrait?: boolean;
}) => {
  const profile = usePlayerProfile(account);
  const reading = usePlayerName(account)!;
  const name = you ? YOU : reading.text;
  const muted = !you && !(reading.state === "named" && reading.claimed);
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      {portrait && <HudPortrait src={playerPortraitUrl(account, profile.portrait)} label={name} />}
      <span className={cn("truncate", muted && "text-hud-muted")}>{name}</span>
    </span>
  );
};
