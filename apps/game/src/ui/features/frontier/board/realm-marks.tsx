import { playerAvatarUrl, usePlayerName, usePlayerProfile } from "@/hooks/use-player-profile";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { iconDefinition, orderMeaning } from "@/ui/design-system/icon-meaning";
import { HudPortrait } from "@/ui/design-system/kit/hud-elements";
import { DEPTH_NUMERALS, depthName, YOU } from "@/ui/design-system/kit/words";
import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { rankName } from "@bibliothecadao/types";

/** Each depth's painting, I to III. */
const DEPTH_ICONS = ["depth-1", "depth-2", "depth-3"] as const;

/**
 * A realm on the season's board as the owner asked (22 October): its rank's painting, and the deepest depth it has
 * gone to as that depth's painting on its corner (none before the first), named on its tip ("City · Ethereal II"). No
 * numeral: on the board a numeral would read as a tier.
 */
export const RealmBadge = ({ level, depth }: { level: number; depth: number }) => {
  const step = Math.min(depth, DEPTH_NUMERALS.length) as 0 | 1 | 2 | 3;
  const line = step === 0 ? rankName(level) : `${rankName(level)} · ${depthName(step)}`;
  return (
    <span role="img" aria-label={line} data-tip={line} className="relative inline-flex size-7 shrink-0">
      <Icon name={realmMeaning(level)} size={28} />
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

/** A realm's Order, as its painting named for assistive technology. */
export const OrderMark = ({ order, size = 24 }: { order: number; size?: number }) => (
  <Icon name={orderMeaning(order)} size={size} alt={iconDefinition(orderMeaning(order)).label} />
);

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
      {portrait && <HudPortrait src={playerAvatarUrl(account, profile)} label={name} />}
      <span className={cn("truncate", muted && "text-hud-muted")}>{name}</span>
    </span>
  );
};
