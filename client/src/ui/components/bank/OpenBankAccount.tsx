import { useDojo } from "@/hooks/context/DojoContext";
import Button from "@/ui/elements/Button";

export const OpenBankAccount = ({ bank_entity_id }: { bank_entity_id: bigint }) => {
  const {
    account: { account },
    setup: {
      systemCalls: { open_account },
    },
  } = useDojo();

  return <Button onClick={() => open_account({ bank_entity_id, signer: account })}>Open Bank Account</Button>;
};
