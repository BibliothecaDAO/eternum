import { formatExact } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudRow } from "@/ui/design-system/kit/hud-elements";
import { AUTOMATIC_LORDS_PAYOUT, LINK_WALLET } from "@/ui/design-system/kit/words";
/**
 * The season-over card keeps the LORDS owed visible until the ledger pays them, or they lapse: the sweep pays a linked
 * wallet; an account with none is told by when to link one (`linkWalletLine`), with Link wallet.
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
