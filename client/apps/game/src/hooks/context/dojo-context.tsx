import { ReactNode, useContext, useMemo } from "react";

import { displayAddress } from "@/ui/utils/utils";
import { SetupResult } from "@bibliothecadao/dojo";
import { DojoContext } from "@bibliothecadao/react";
import { Account, AccountInterface, RpcProvider } from "starknet";

import { env } from "../../../env";

interface DojoProviderProps {
  children: ReactNode;
  value: SetupResult;
  account: Account | AccountInterface;
}

const requiredEnvs: Array<keyof typeof env> = [
  "VITE_PUBLIC_MASTER_ADDRESS",
  "VITE_PUBLIC_MASTER_PRIVATE_KEY",
  "VITE_PUBLIC_ACCOUNT_CLASS_HASH",
];

requiredEnvs.forEach((key) => {
  if (!env[key]) {
    throw new Error(`Environment variable ${key} is not set!`);
  }
});

const createRpcProvider = () =>
  new RpcProvider({
    nodeUrl: env.VITE_PUBLIC_NODE_URL,
  });

const createMasterAccount = (rpcProvider: RpcProvider) =>
  new Account({
    provider: rpcProvider,
    address: env.VITE_PUBLIC_MASTER_ADDRESS,
    signer: env.VITE_PUBLIC_MASTER_PRIVATE_KEY,
  });

export const DojoProvider = ({ children, value, account }: DojoProviderProps) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) {
    throw new Error("DojoProvider can only be used once");
  }

  const rpcProvider = useMemo(() => createRpcProvider(), []);
  const masterAccount = useMemo(() => createMasterAccount(rpcProvider), [rpcProvider]);
  const accountAddress = "address" in account ? account.address : "";

  return (
    <DojoContext.Provider
      value={{
        ...value,
        masterAccount,
        account: {
          account,
          accountDisplay: displayAddress(accountAddress ?? ""),
        },
      }}
    >
      {children}
    </DojoContext.Provider>
  );
};
