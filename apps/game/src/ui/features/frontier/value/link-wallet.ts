import { LINK_WALLET_FOR_LORDS, linkWalletBy } from "@/ui/design-system/kit/words";
import { formatMoment } from "@bibliothecadao/types";

export const linkWalletLine = (deadline: number | undefined, endsAt: number | undefined, now: number): string =>
  deadline !== undefined && endsAt !== undefined && now >= endsAt
    ? linkWalletBy(formatMoment(deadline, now))
    : LINK_WALLET_FOR_LORDS;
