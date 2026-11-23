import "./lords-balance-pill.css";

import { formatShort, LORDS } from "@bibliothecadao/types";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { Icon } from "@/ui/design-system/icon";

import { useLordsBalance } from "./use-lords-balance";
import { usePayer } from "./use-payer";

const LordsBalanceAmount = ({ owner }: { owner: string }) => {
  const { lords } = useLordsBalance(owner);
  if (lords === null) return null;
  return (
    <span className="app-bar__balance" data-lords-balance aria-label={`${formatShort(lords)} ${LORDS}`}>
      <Icon name="lords" size={18} />
      <span>{formatShort(lords)}</span>
    </span>
  );
};

const LordsBalanceForPayer = () => {
  const { payer } = usePayer();
  if (!payer) return null;
  return <LordsBalanceAmount owner={payer} />;
};

export const LordsBalancePill = () => {
  const { session } = useIdentitySession();
  if (!session) return null;
  return <LordsBalanceForPayer />;
};
