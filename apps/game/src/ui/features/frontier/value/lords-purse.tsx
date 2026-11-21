import { formatExact, LORDS, formatShort } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { SHOP_WORDS } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/**
 * Under the phone's strip, at its right: the realm's LORDS count (it opens Withdraw where one exists)
 * and, while the player's Realms have labor waiting today, the Realms chip beside it (the phone's Menu always has
 * Realms). A desktop's realm panel carries both, its Realms chip always.
 */
export const PurseRow = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-auto flex shrink-0 gap-1.5">{children}</div>
);

export const FragmentsPurse = ({ fragments, onOpen }: { fragments: number; onOpen: () => void }) => (
  <HudPill label={SHOP_WORDS.fragments(fragments)} onPress={onOpen}>
    {[
      <span key="fragments" className="flex items-center gap-1.5 tabular-nums">
        <SemanticIcon name="fragment" size={26} />
        {formatShort(fragments)}
      </span>,
    ]}
  </HudPill>
);

/**
 * The realm's LORDS, and what a chest just added to them; marked, its name saying why, when the account has no linked
 * wallet to receive them (`linkWalletLine`, useLinkWalletPrompt), Withdraw then offering to link one.
 */
export const LordsPurse = ({
  lords,
  gain,
  spendOnly,
  linkWalletLine = null,
  onOpen,
}: {
  lords: number | undefined;
  gain?: number;
  spendOnly?: bigint;
  linkWalletLine?: string | null;
  onOpen?: () => void;
}) => (
  <HudPill
    label={[
      `${LORDS} ${formatExact(lords)}`,
      spendOnly === undefined ? null : `${spendOnly} spend-only LORDS`,
      linkWalletLine,
    ]
      .filter(Boolean)
      .join(". ")}
    data-tip={linkWalletLine ?? undefined}
    role={onOpen ? undefined : "img"}
    onPress={onOpen}
  >
    {[
      <span key="lords" className="flex items-center gap-1.5 tabular-nums">
        <SemanticIcon name="lords" size={26} />
        {formatShort(lords)}
        {spendOnly !== undefined && <span className="text-hud-muted"> + {spendOnly.toString()} spend-only</span>}
        {linkWalletLine && <SemanticIcon name="warning" size={16} />}
      </span>,
      ...(gain === undefined
        ? []
        : [
            <span key="gain" className="tabular-nums text-hud-good">
              {formatShort(gain, { signed: true })}
            </span>,
          ]),
    ]}
  </HudPill>
);
