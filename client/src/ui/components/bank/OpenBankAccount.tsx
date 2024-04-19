import { useDojo } from "@/hooks/context/DojoContext";
import Button from "@/ui/elements/Button";
import { useState } from "react";

export const OpenBankAccount = ({ bank_entity_id }: { bank_entity_id: bigint }) => {
  const {
    account: { account },
    setup: {
      systemCalls: { open_account },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const onClick = () => {
    setIsLoading(true);
    open_account({ bank_entity_id, signer: account }).finally(() => setIsLoading(false));
  };

  return (
    <div className="w-full flex justify-center">
      <Button isLoading={isLoading} onClick={onClick}>
        Open Bank Account
      </Button>
    </div>
  );
};
