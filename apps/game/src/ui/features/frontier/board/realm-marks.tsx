import { playerAvatarUrl, usePlayerName, usePlayerProfile } from "@/hooks/use-player-profile";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { iconDefinition, orderMeaning } from "@/ui/design-system/icon-meaning";
import { HudPortrait } from "@/ui/design-system/kit/hud-elements";
import { YOU } from "@/ui/design-system/kit/words";

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
