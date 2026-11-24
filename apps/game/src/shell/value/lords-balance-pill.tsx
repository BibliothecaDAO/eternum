import "./lords-balance-pill.css";

import { ANCIENT_SEAL, FRAGMENTS, formatShort, LORDS } from "@bibliothecadao/types";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { Icon } from "@/ui/design-system/icon";
import { SEAL_CODE_WORDS } from "@/ui/design-system/kit/words";

import { useDirectory } from "../herald";
import { useSealCode } from "../play/seal-code";
import { holdingsOf } from "./holdings-pill";
import { useLordsBalance } from "./use-lords-balance";
import { usePayer } from "./use-payer";

const TopBarHoldings = ({ owner }: { owner: string | null }) => {
  const { payer } = usePayer();
  const { lords } = useLordsBalance(payer ?? null);
  const directory = useDirectory();
  const holdings = holdingsOf(directory.data?.games ?? []);
  const seal = useSealCode(owner);
  const fragments = holdings?.fragments ?? null;
  const sealHeld = seal.data?.held === true || holdings?.ancientSeal === true;
  if (lords === null && fragments === null && !sealHeld) return null;
  return (
    <span className="app-bar__holdings" data-topbar-holdings>
      {lords !== null && (
        <span className="app-bar__balance" data-lords-balance aria-label={`${formatShort(lords)} ${LORDS}`}>
          <Icon name="lords" size={18} />
          <span>{formatShort(lords)}</span>
        </span>
      )}
      {fragments !== null && (
        <span className="app-bar__balance" data-fragments-balance aria-label={`${formatShort(fragments)} ${FRAGMENTS}`}>
          <Icon name="fragment" size={18} />
          <span>{formatShort(fragments)}</span>
        </span>
      )}
      {sealHeld && (
        <span
          className="app-bar__balance app-bar__seal"
          data-seal-held
          title={SEAL_CODE_WORDS.held}
          aria-label={SEAL_CODE_WORDS.held}
        >
          <Icon name="final-seal" size={18} />
          <span className="app-bar__seal-label">{ANCIENT_SEAL}</span>
        </span>
      )}
    </span>
  );
};

export const LordsBalancePill = () => {
  const { session } = useIdentitySession();
  if (!session) return null;
  return <TopBarHoldings owner={session.user.realmsId ?? null} />;
};
