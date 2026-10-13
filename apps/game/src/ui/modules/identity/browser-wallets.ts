/** The wallet extensions a player links; each injects itself into the page as `starknet_<id>`, its connector's id. */
const EXTENSIONS = ["argentX", "braavos"] as const;

type Extension = { request: (call: { type: string; params?: object }) => Promise<unknown> };

/** An account a wallet extension shares with this site, and the extension that holds it. */
interface BrowserWallet {
  extension: (typeof EXTENSIONS)[number];
  address: string;
}

/**
 * The accounts the browser's wallet extensions already share with this site, asked silently: an extension that is
 * locked, or was never connected here, answers none and shows nothing.
 */
export const readBrowserWallets = async (): Promise<BrowserWallet[]> => {
  const injected = window as unknown as Partial<Record<string, Extension>>;
  const answers = await Promise.all(
    EXTENSIONS.map(async (extension) =>
      (await sharedAccountsOf(injected[`starknet_${extension}`])).map((address) => ({ extension, address })),
    ),
  );
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
