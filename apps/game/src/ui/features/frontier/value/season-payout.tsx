import { formatExact } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudRow } from "@/ui/design-system/kit/hud-elements";
import { AUTOMATIC_LORDS_PAYOUT, LINK_WALLET } from "@/ui/design-system/kit/words";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useLinkWallet, useLinkWalletPrompt } from "./link-wallet";
import { useRealmLords } from "./use-realm-lords";

export const SeasonPayout = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const lords = useRealmLords(realm);
  return <SeasonPayoutRow lords={lords} linkWalletLine={useLinkWalletPrompt(lords)} onLinkWallet={useLinkWallet()} />;
};

/**
 * The season-over card keeps the remaining balance visible until the confirmed sweep consumes it: the sweep pays a
 * linked wallet; an account with none is told how long it has to link one (`linkWalletLine`), with Link wallet.
 */
export const SeasonPayoutRow = ({
  lords,
  linkWalletLine,
  onLinkWallet,
}: {
  lords: number | undefined;
  linkWalletLine: string | null;
  onLinkWallet: () => void;
}) => {
  if (!lords) return null;
  return (
    <HudRow
      lead={<SemanticIcon name="lords" size={30} />}
      title={<span className="tabular-nums">{formatExact(lords)}</span>}
      detail={linkWalletLine ?? AUTOMATIC_LORDS_PAYOUT}
      controls={
        linkWalletLine ? (
          <HudButton kind="primary" size="sm" icon="share" onClick={onLinkWallet}>
            {LINK_WALLET}
          </HudButton>
        ) : undefined
      }
    />
  );
};
