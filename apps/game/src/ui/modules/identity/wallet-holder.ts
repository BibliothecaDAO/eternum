import { isSameStarknetAddress, normalizeStarknetAddress } from "@realms-world/identity";
import type { Connector } from "@starknet-react/core";

import { readBrowserWallets } from "./browser-wallets";

const OPENED_WALLETS = "realms.opened-wallets";

/**
 * The connector that holds `owner`, so an action prompts that wallet and no other is offered: the extension already
 * sharing the address with this site, else the wallet this browser last opened it with (a locked extension, Ready by
 * email and Controller share nothing silently). Undefined when this browser has never opened the wallet.
 */
export const connectorHolding = async (
  owner: string,
  connectors: readonly Connector[],
): Promise<Connector | undefined> => {
  const shared = (await readBrowserWallets()).find((wallet) => isSameStarknetAddress(wallet.address, owner));
  const id = shared?.extension ?? lastOpenedWith(owner);
  return connectors.find((connector) => connector.id === id && connector.available());
};

/**
 * Every wallet a connector opens is noted under its address, so the linked one stays known when its extension is on
 * another account: that account is then refused by name instead of the wallets being offered again.
 */
export const rememberOpened = (address: string, connectorId: string): void => {
  try {
    const opened = { ...openedWallets(), [normalizeStarknetAddress(address)]: connectorId };
    localStorage.setItem(OPENED_WALLETS, JSON.stringify(opened));
  } catch {
    // A browser that keeps nothing asks which wallet again next time; the action itself is not affected.
  }
};

const lastOpenedWith = (owner: string): string | undefined => {
  try {
    return openedWallets()[normalizeStarknetAddress(owner)];
  } catch {
    return undefined;
  }
};

/** Connector ids by the address each opened, as this browser keeps them. */
const openedWallets = (): Record<string, string> => JSON.parse(localStorage.getItem(OPENED_WALLETS) ?? "{}");
