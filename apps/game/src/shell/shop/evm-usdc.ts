export const ETH_MAINNET_CHAIN_ID = "0x1";

const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const EVM_QUOTE_MEMO_PATTERN = /^[0-9a-fA-F]{32}$/;
const MAX_UINT256 = (1n << 256n) - 1n;

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export interface Eip6963ProviderInfo {
  readonly uuid: string;
  readonly name: string;
  readonly icon: string;
  readonly rdns: string;
}

export interface Eip6963ProviderDetail {
  readonly info: Eip6963ProviderInfo;
  readonly provider: Eip1193Provider;
}

export class EvmChainRefusedError extends Error {
  readonly chainId: string;
  constructor(chainId: string) {
    super(`Ethereum mainnet (${ETH_MAINNET_CHAIN_ID}) required, got ${chainId || "unknown"}`);
    this.name = "EvmChainRefusedError";
    this.chainId = chainId;
  }
}

const normalizeEvmChainId = (value: unknown): string => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return `0x${value.toString(16)}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (/^0x[0-9a-f]+$/.test(trimmed)) return `0x${BigInt(trimmed).toString(16)}`;
    if (/^\d+$/.test(trimmed)) return `0x${BigInt(trimmed).toString(16)}`;
  }
  return "";
};

export const encodeErc20Transfer = (recipient: string, amount: bigint, quoteMemo: string): string => {
  if (!EVM_ADDRESS_PATTERN.test(recipient)) throw new Error(`Invalid EVM recipient: ${recipient}`);
  if (amount <= 0n || amount > MAX_UINT256) throw new Error(`Invalid ERC-20 transfer amount: ${amount}`);
  if (!EVM_QUOTE_MEMO_PATTERN.test(quoteMemo)) throw new Error(`Invalid EVM quote memo: ${quoteMemo}`);
  const paddedRecipient = recipient.slice(2).toLowerCase().padStart(64, "0");
  const paddedAmount = amount.toString(16).padStart(64, "0");
  return `${ERC20_TRANSFER_SELECTOR}${paddedRecipient}${paddedAmount}${quoteMemo.toLowerCase()}`;
};

export const discoverEip6963Providers = (target: Window = window, waitMs = 150): Promise<Eip6963ProviderDetail[]> =>
  new Promise((resolve) => {
    const byUuid = new Map<string, Eip6963ProviderDetail>();
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (!detail?.info?.uuid || !detail.provider) return;
      byUuid.set(detail.info.uuid, detail);
    };
    target.addEventListener("eip6963:announceProvider", onAnnounce);
    target.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      target.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve([...byUuid.values()]);
    }, waitMs);
  });

export const ensureEthereumMainnet = async (provider: Eip1193Provider): Promise<void> => {
  const initial = normalizeEvmChainId(await provider.request({ method: "eth_chainId" }));
  if (initial === ETH_MAINNET_CHAIN_ID) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ETH_MAINNET_CHAIN_ID }],
    });
  } catch {
    throw new EvmChainRefusedError(initial);
  }
  const switched = normalizeEvmChainId(await provider.request({ method: "eth_chainId" }));
  if (switched !== ETH_MAINNET_CHAIN_ID) throw new EvmChainRefusedError(switched);
};

export const sendEvmUsdcTransfer = async (
  provider: Eip1193Provider,
  transfer: { readonly usdc: string; readonly treasury: string; readonly usdcAmount: string; readonly memo: string },
): Promise<string> => {
  if (!EVM_ADDRESS_PATTERN.test(transfer.usdc)) throw new Error(`Invalid USDC contract address: ${transfer.usdc}`);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as unknown;
  const from = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
  if (!from || !EVM_ADDRESS_PATTERN.test(from)) throw new Error("No EVM account returned by wallet");
  await ensureEthereumMainnet(provider);
  const data = encodeErc20Transfer(transfer.treasury, BigInt(transfer.usdcAmount), transfer.memo);
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to: transfer.usdc, data, value: "0x0" }],
  });
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error("Wallet did not return a valid Ethereum transaction hash");
  }
  return hash;
};
