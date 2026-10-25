import { playerAvatarUrl, usePlayerName, usePlayerProfile } from "@/hooks/use-player-profile";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { iconDefinition, orderMeaning } from "@/ui/design-system/icon-meaning";
import { HudPortrait } from "@/ui/design-system/kit/hud-elements";
import { REACH_NUMERALS, RESEARCH_TREE, YOU } from "@/ui/design-system/kit/words";
import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { rankName } from "@bibliothecadao/types";

/** Each reach's painting, I to III. */
const REACH_ICONS = ["depth-1", "depth-2", "depth-3"] as const;

/**
 * A realm on the season's board as the owner asked (22 October): its rank's painting, and the deepest Ethereal reach it
 * has gone to as a badge on its corner (none before the first).
 */
export const RealmBadge = ({ level, reach }: { level: number; reach: number }) => {
  const step = Math.min(reach, REACH_NUMERALS.length);
  const line = step > 0 ? `${rankName(level)} · ${RESEARCH_TREE.reach(REACH_NUMERALS[step - 1])}` : rankName(level);
  return (
    <span role="img" aria-label={line} data-tip={line} className="relative inline-flex size-7 shrink-0">
      <Icon name={realmMeaning(level)} size={28} />
      {step > 0 && (
        <span
          aria-hidden
          className="absolute -bottom-1 -right-2 inline-flex items-center rounded-full border border-hud-line-strong bg-hud-surface pl-0.5 pr-1 text-hud-badge leading-4 text-hud-accent"
        >
          <Icon name={REACH_ICONS[step - 1]} size={12} />
          {REACH_NUMERALS[step - 1]}
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
