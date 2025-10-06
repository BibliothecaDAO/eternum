import { ReactNode, useContext, useMemo } from "react";

import { useControllerAccount } from "@/hooks/context/use-controller-account";
import { useDojoAccessGate } from "@/hooks/context/use-dojo-access-gate";
import { displayAddress } from "@/ui/utils/utils";
import { SetupResult } from "@bibliothecadao/dojo";
import { DojoContext } from "@bibliothecadao/react";
import { Account, RpcProvider } from "starknet";

import { env } from "../../../env";

interface DojoProviderProps {
  children: ReactNode;
  value: SetupResult;
  backgroundImage: string;
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

export const DojoProvider = ({ children, value, backgroundImage }: DojoProviderProps) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) {
    throw new Error("DojoProvider can only be used once");
  }

  const rpcProvider = useMemo(() => createRpcProvider(), []);
  const masterAccount = useMemo(() => createMasterAccount(rpcProvider), [rpcProvider]);
  const controllerAccount = useControllerAccount();
  const gateState = useDojoAccessGate({
    backgroundImage,
    setupResult: value,
    controllerAccount: controllerAccount ?? null,
  });

  if (gateState.type !== "ready") {
    return gateState.fallback;
  }

  const resolvedAccount = gateState.account;
  const accountAddress = "address" in resolvedAccount ? resolvedAccount.address : "";

  return (
    <DojoContext.Provider
      value={{
        ...value,
        masterAccount,
        account: {
          account: resolvedAccount,
          accountDisplay: displayAddress(accountAddress ?? ""),
        },
      }}
    >
      {children}
    </DojoContext.Provider>
  );
};
