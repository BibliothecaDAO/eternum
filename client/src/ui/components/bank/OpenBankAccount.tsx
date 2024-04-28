import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
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
  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const onClick = () => {
    setIsLoading(true);
    open_account({ realm_entity_id: realmEntityId, bank_entity_id, signer: account }).finally(() =>
      setIsLoading(false),
    );
  };

  return (
    <div className="w-full flex justify-center">
      <Button isLoading={isLoading} onClick={onClick}>
        Open Bank Account
      </Button>
    </div>
  );
};
