import type { ControllerConnector } from "@cartridge/connector";
import type { TransactionSubmitGuardContext } from "@bibliothecadao/provider";
import type { AccountInterface } from "starknet";
import { waitForSessionPolicyRefresh } from "./session-policy-refresh-state";

type ControllerProvider = {
  account?: { address?: string };
  probe?: () => Promise<unknown>;
  waitForKeychain?: (options?: { timeout?: number }) => Promise<unknown>;
};

type TransactionSubmitGuardInput = {
  account: AccountInterface | null;
  connector: ControllerConnector | null;
  context: TransactionSubmitGuardContext;
};

const isMissingAddress = (address: string | undefined): boolean => !address || address === "0x0";

const resolveControllerProvider = (connector: ControllerConnector | null): ControllerProvider | null => {
  if (!connector) {
    return null;
  }

  const connectorRecord = connector as unknown as ControllerProvider & { controller?: ControllerProvider };
  return connectorRecord.controller ?? connectorRecord;
};

const waitForControllerKeychain = async (provider: ControllerProvider | null): Promise<void> => {
  if (typeof provider?.waitForKeychain !== "function") {
    return;
  }

  await provider.waitForKeychain({ timeout: 10_000 });
};

const probeControllerAccount = async (provider: ControllerProvider | null): Promise<void> => {
  if (typeof provider?.probe !== "function") {
    return;
  }

  await provider.probe();
};

const resolveSubmitAddress = (
  account: AccountInterface | null,
  controllerProvider: ControllerProvider | null,
  context: TransactionSubmitGuardContext,
): string | undefined => {
  return account?.address ?? controllerProvider?.account?.address ?? context.signerAddress;
};

export const waitForSafeTransactionSubmit = async ({
  account,
  connector,
  context,
}: TransactionSubmitGuardInput): Promise<void> => {
  await waitForSessionPolicyRefresh();

  const controllerProvider = resolveControllerProvider(connector);
  await waitForControllerKeychain(controllerProvider);
  await probeControllerAccount(controllerProvider);

  const submitAddress = resolveSubmitAddress(account, controllerProvider, context);
  if (isMissingAddress(submitAddress)) {
    throw new Error("No account connected");
  }
};
