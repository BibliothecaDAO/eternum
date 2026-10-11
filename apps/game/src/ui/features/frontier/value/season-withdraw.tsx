import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { formatMoment } from "@/ui/design-system/kit/time";
import { WITHDRAW, WITHDRAWALS_CLOSED, withdrawUntil } from "@/ui/design-system/kit/words";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { useWithdrawalsCloseAt } from "./frontier-withdraw";
import { useRealmLords } from "./use-realm-lords";

/**
 * On the season-over card, over the game's facts: the LORDS the realm still holds can leave until the season's
 * withdrawals close, and are lost to the player after. Without this the card covers the HUD's own way to Withdraw.
 */
export const SeasonWithdraw = ({ realm, onOpen }: { realm: NativeRows["Structure"]; onOpen: () => void }) => (
  <SeasonWithdrawRow
    lords={useRealmLords(realm)}
    closesAt={useWithdrawalsCloseAt()}
    now={useNowSeconds()}
    onOpen={onOpen}
  />
);

/**
 * The realm's LORDS after the season: how many, until when they can be withdrawn, and Withdraw; from the close on, that
 * withdrawals have closed. Nothing for a realm that holds none.
 */
export const SeasonWithdrawRow = ({
  lords,
  closesAt,
  now,
  onOpen,
}: {
  lords: number | undefined;
  closesAt: number | undefined;
  now: number;
  onOpen: () => void;
}) => {
  if (!lords) return null;
  const closed = closesAt !== undefined && now >= closesAt;
  return (
    <div className="frontier-card flex w-full items-center gap-2.5 !rounded-xl px-3 py-2">
      <KitIcon code="Lo" size={30} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[18px] tabular-nums text-kit-cream">{formatExact(lords)}</span>
        <span className="text-[13px] text-kit-muted">
          {closed ? WITHDRAWALS_CLOSED : withdrawUntil(formatMoment(closesAt, now))}
        </span>
      </span>
      {!closed && <Button role="primary" word={WITHDRAW} onClick={onOpen} className="!h-11" />}
    </div>
  );
};
