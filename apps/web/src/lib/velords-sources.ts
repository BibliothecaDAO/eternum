import { formatAddress, SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";

import { StakingAddresses } from "@realms-world/constants";

const SOURCE_LABELS: Record<string, string> = {
  "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5":
    "Game + Marketplace Fees",
  "0x047230028629128ac5bfbb384d32f925e70e329b624fc5d82e9c60f5746795cd":
    "Crypts",
};

export function getVelordsSourceLabel(sender: string): string {
  const normalizedSender = formatAddress(sender);
  const velordsAddress = formatAddress(
    StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as string,
  );

  if (normalizedSender === velordsAddress) {
    return "VeLords Exit Fees";
  }

  return SOURCE_LABELS[normalizedSender] ?? sender;
}

