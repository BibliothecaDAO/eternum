/** The wallet extensions a player links, by the name each injects itself into the page under. */
const EXTENSIONS = ["starknet_argentX", "starknet_braavos"] as const;

type Extension = { request: (call: { type: string; params?: object }) => Promise<unknown> };

/**
 * The accounts the browser's wallet extensions already share with this site, asked silently: an extension that is
 * locked, or was never connected here, answers none and shows nothing. For display only; a wallet signs through the
 * wallet rows, which connect it.
 */
export const readBrowserWallets = async (): Promise<string[]> => {
  const injected = window as unknown as Partial<Record<(typeof EXTENSIONS)[number], Extension>>;
  const answers = await Promise.all(EXTENSIONS.map((name) => sharedAccountsOf(injected[name])));
  return answers.flat();
};

const sharedAccountsOf = async (extension: Extension | undefined): Promise<string[]> => {
  if (!extension) return [];
  try {
    const accounts = await extension.request({ type: "wallet_requestAccounts", params: { silent_mode: true } });
    return Array.isArray(accounts) ? accounts.filter((account) => typeof account === "string") : [];
  } catch {
    return [];
  }
};
