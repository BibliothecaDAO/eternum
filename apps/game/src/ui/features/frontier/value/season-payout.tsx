import { formatExact } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudRow } from "@/ui/design-system/kit/hud-elements";
import { AUTOMATIC_LORDS_PAYOUT } from "@/ui/design-system/kit/words";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useRealmLords } from "./use-realm-lords";

export const SeasonPayout = ({ realm }: { realm: NativeRows["Structure"] }) => (
  <SeasonPayoutRow lords={useRealmLords(realm)} />
);

/** The season-over card keeps the remaining balance visible until the confirmed sweep consumes it. */
export const SeasonPayoutRow = ({ lords }: { lords: number | undefined }) => {
  if (!lords) return null;
  return (
    <HudRow
      lead={<SemanticIcon name="lords" size={30} />}
      title={<span className="tabular-nums">{formatExact(lords)}</span>}
      detail={AUTOMATIC_LORDS_PAYOUT}
    />
  );
};
