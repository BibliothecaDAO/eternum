import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { formatExact } from "@/ui/design-system/kit/amount";
import { HudButton, HudRow } from "@/ui/design-system/kit/hud-elements";

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
    <HudRow
      lead={<SemanticIcon name="lords" size={30} />}
      title={<span className="tabular-nums">{formatExact(lords)}</span>}
      detail={closed ? WITHDRAWALS_CLOSED : withdrawUntil(formatMoment(closesAt, now))}
      trail={
        closed ? undefined : (
          <HudButton kind="primary" onClick={onOpen}>
            {WITHDRAW}
          </HudButton>
        )
      }
    />
  );
};
