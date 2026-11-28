export const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const SPL_MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const SOLANA_MAINNET_CHAIN = "solana:mainnet";

const SPL_ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SOLANA_USDC_DECIMALS = 6;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_LOOKUP = new Map([...BASE58_ALPHABET].map((char, index) => [char, BigInt(index)]));
const SPL_TRANSFER_CHECKED_TAG = 12;
const MAX_U64 = (1n << 64n) - 1n;
const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress");
const ED25519_P = (1n << 255n) - 19n;

const modP = (value: bigint): bigint => ((value % ED25519_P) + ED25519_P) % ED25519_P;

const powModP = (base: bigint, exponent: bigint): bigint => {
  let result = 1n;
  let current = modP(base);
  let remaining = exponent;
  while (remaining > 0n) {
    if (remaining & 1n) result = (result * current) % ED25519_P;
    current = (current * current) % ED25519_P;
    remaining >>= 1n;
  }
  return result;
};

const ED25519_D = modP(-121665n * powModP(121666n, ED25519_P - 2n));
const ED25519_SQRT_M1 = powModP(2n, (ED25519_P - 1n) / 4n);

export interface SolanaWalletAccount {
  readonly address: string;
  readonly publicKey: Uint8Array;
}

export interface SolanaStandardWallet {
  readonly name: string;
  readonly icon?: string;
  readonly accounts: readonly SolanaWalletAccount[];
  readonly features: {
    readonly "standard:connect"?: {
      readonly connect: () => Promise<{ readonly accounts: readonly SolanaWalletAccount[] }>;
    };
    readonly "solana:signAndSendTransaction"?: {
      readonly signAndSendTransaction: (
        ...inputs: readonly {
          readonly transaction: Uint8Array;
          readonly account: SolanaWalletAccount;
          readonly chain: string;
        }[]
      ) => Promise<readonly { readonly signature: Uint8Array }[]>;
    };
  };
}

export const decodeBase58 = (input: string): Uint8Array => {
  if (input.length === 0) throw new Error("Empty base58 string");
  let value = 0n;
  for (const char of input) {
    const digit = BASE58_LOOKUP.get(char);
    if (digit === undefined) throw new Error(`Invalid base58 character: ${char}`);
    value = value * 58n + digit;
  }
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  bytes.reverse();
  let leadingZeros = 0;
  for (const char of input) {
    if (char === "1") leadingZeros += 1;
    else break;
  }
  const out = new Uint8Array(leadingZeros + bytes.length);
  out.set(bytes, leadingZeros);
  return out;
};

export const encodeBase58 = (bytes: Uint8Array): string => {
  if (bytes.length === 0) return "";
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  const chars: string[] = [];
  while (value > 0n) {
    chars.push(BASE58_ALPHABET[Number(value % 58n)]!);
    value /= 58n;
  }
  let leadingZeros = 0;
  for (const byte of bytes) {
    if (byte === 0) leadingZeros += 1;
    else break;
  }
  return "1".repeat(leadingZeros) + chars.reverse().join("");
};

const decodePubkey32 = (address: string, label: string): Uint8Array => {
  const bytes = decodeBase58(address);
  if (bytes.length !== 32) throw new Error(`Invalid Solana ${label}: expected 32 bytes, got ${bytes.length}`);
  return bytes;
};

const isOnEd25519Curve = (bytes: Uint8Array): boolean => {
  if (bytes.length !== 32) return false;
  let y = 0n;
  for (let i = 31; i >= 0; i -= 1) {
    y = (y << 8n) + BigInt(i === 31 ? bytes[i]! & 0x7f : bytes[i]!);
  }
  if (y >= ED25519_P) return false;
  const y2 = modP(y * y);
  const u = modP(y2 - 1n);
  const v = modP(ED25519_D * y2 + 1n);
  const v3 = modP(v * v * v);
  const v7 = modP(v3 * v3 * v);
  let x = modP(u * v3 * powModP(modP(u * v7), (ED25519_P - 5n) / 8n));
  const vx2 = modP(v * x * x);
  if (vx2 === u) return !(x === 0n && (bytes[31]! & 0x80) !== 0);
  if (vx2 === modP(-u)) {
    x = modP(x * ED25519_SQRT_M1);
    return modP(v * x * x) === u && !(x === 0n && (bytes[31]! & 0x80) !== 0);
  }
  return false;
};

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const SHA256_K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

const rotr32 = (value: number, bits: number): number => (value >>> bits) | (value << (32 - bits));

const sha256 = (data: Uint8Array): Uint8Array => {
  const bitLen = data.length * 8;
  const paddedLen = Math.ceil((data.length + 9) / 64) * 64;
  const buf = new Uint8Array(paddedLen);
  buf.set(data);
  buf[data.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr32(words[i - 15]!, 7) ^ rotr32(words[i - 15]!, 18) ^ (words[i - 15]! >>> 3);
      const s1 = rotr32(words[i - 2]!, 17) ^ rotr32(words[i - 2]!, 19) ^ (words[i - 2]! >>> 10);
      words[i] = (words[i - 16]! + s0 + words[i - 7]! + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[i]! + words[i]!) >>> 0;
      const s0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((word, index) => outView.setUint32(index * 4, word, false));
  return out;
};

export const deriveAssociatedTokenAddress = (owner: string, mint: string): string => {
  const ownerBytes = decodePubkey32(owner, "owner");
  const tokenProgramBytes = decodePubkey32(SPL_TOKEN_PROGRAM_ID, "token program");
  const mintBytes = decodePubkey32(mint, "mint");
  const ataProgramBytes = decodePubkey32(SPL_ASSOCIATED_TOKEN_PROGRAM_ID, "associated token program");
  for (let nonce = 255; nonce >= 0; nonce -= 1) {
    const preimage = concatBytes([
      ownerBytes,
      tokenProgramBytes,
      mintBytes,
      Uint8Array.of(nonce),
      ataProgramBytes,
      PDA_MARKER,
    ]);
    const digest = sha256(preimage);
    if (!isOnEd25519Curve(digest)) return encodeBase58(digest);
  }
  throw new Error("Could not derive Solana associated token address");
};

const encodeShortVec = (length: number): Uint8Array => {
  const out: number[] = [];
  let remaining = length;
  for (;;) {
    let elem = remaining & 0x7f;
    remaining >>= 7;
    if (remaining === 0) {
      out.push(elem);
      break;
    }
    elem |= 0x80;
    out.push(elem);
  }
  return Uint8Array.from(out);
};

export const encodeSplTransferCheckedData = (amount: bigint, decimals = SOLANA_USDC_DECIMALS): Uint8Array => {
  if (amount <= 0n || amount > MAX_U64) throw new Error(`Invalid SPL USDC amount: ${amount}`);
  const out = new Uint8Array(10);
  out[0] = SPL_TRANSFER_CHECKED_TAG;
  let remaining = amount;
  for (let i = 0; i < 8; i += 1) {
    out[1 + i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  out[9] = decimals;
  return out;
};

interface AccountMeta {
  readonly address: string;
  readonly isSigner: boolean;
  readonly isWritable: boolean;
}

interface RawInstruction {
  readonly programId: string;
  readonly keys: readonly AccountMeta[];
  readonly data: Uint8Array;
}

export const buildSolanaUsdcTransferTransaction = ({
  payer,
  sourceAta,
  mint,
  destinationAta,
  amount,
  quoteId,
  recentBlockhash,
}: {
  readonly payer: string;
  readonly sourceAta: string;
  readonly mint: string;
  readonly destinationAta: string;
  readonly amount: bigint;
  readonly quoteId: string;
  readonly recentBlockhash: string;
}): Uint8Array => {
  const instructions: RawInstruction[] = [
    {
      programId: SPL_TOKEN_PROGRAM_ID,
      keys: [
        { address: sourceAta, isSigner: false, isWritable: true },
        { address: mint, isSigner: false, isWritable: false },
        { address: destinationAta, isSigner: false, isWritable: true },
        { address: payer, isSigner: true, isWritable: false },
      ],
      data: encodeSplTransferCheckedData(amount, SOLANA_USDC_DECIMALS),
    },
    {
      programId: SPL_MEMO_PROGRAM_ID,
      keys: [{ address: payer, isSigner: true, isWritable: false }],
      data: new TextEncoder().encode(quoteId),
    },
  ];

  const metaByAddress = new Map<string, { isSigner: boolean; isWritable: boolean }>();
  metaByAddress.set(payer, { isSigner: true, isWritable: true });
  for (const ix of instructions) {
    for (const key of ix.keys) {
      const existing = metaByAddress.get(key.address);
      metaByAddress.set(key.address, {
        isSigner: (existing?.isSigner ?? false) || key.isSigner,
        isWritable: (existing?.isWritable ?? false) || key.isWritable,
      });
    }
    if (!metaByAddress.has(ix.programId)) {
      metaByAddress.set(ix.programId, { isSigner: false, isWritable: false });
    }
  }

  const ordered = [...metaByAddress.entries()].sort((a, b) => {
    if (a[0] === payer) return -1;
    if (b[0] === payer) return 1;
    if (a[1].isSigner !== b[1].isSigner) return a[1].isSigner ? -1 : 1;
    if (a[1].isWritable !== b[1].isWritable) return a[1].isWritable ? -1 : 1;
    return 0;
  });

  const indexOf = new Map(ordered.map(([address], index) => [address, index]));
  const numRequiredSignatures = ordered.filter(([, meta]) => meta.isSigner).length;
  const numReadonlySigned = ordered.filter(([, meta]) => meta.isSigner && !meta.isWritable).length;
  const numReadonlyUnsigned = ordered.filter(([, meta]) => !meta.isSigner && !meta.isWritable).length;

  const keyBytes = ordered.map(([address]) => decodePubkey32(address, "account"));
  const blockhashBytes = decodePubkey32(recentBlockhash, "recentBlockhash");
  const compiledInstructions = instructions.map((ix) =>
    concatBytes([
      Uint8Array.of(indexOf.get(ix.programId)!),
      encodeShortVec(ix.keys.length),
      Uint8Array.from(ix.keys.map((key) => indexOf.get(key.address)!)),
      encodeShortVec(ix.data.length),
      ix.data,
    ]),
  );

  const message = concatBytes([
    Uint8Array.of(numRequiredSignatures, numReadonlySigned, numReadonlyUnsigned),
    encodeShortVec(keyBytes.length),
    ...keyBytes,
    blockhashBytes,
    encodeShortVec(compiledInstructions.length),
    ...compiledInstructions,
  ]);

  return concatBytes([encodeShortVec(numRequiredSignatures), new Uint8Array(64 * numRequiredSignatures), message]);
};

const isUsableSolanaWallet = (candidate: unknown): candidate is SolanaStandardWallet => {
  if (typeof candidate !== "object" || candidate === null) return false;
  const wallet = candidate as Partial<SolanaStandardWallet>;
  return (
    typeof wallet.name === "string" &&
    typeof wallet.features?.["standard:connect"]?.connect === "function" &&
    typeof wallet.features?.["solana:signAndSendTransaction"]?.signAndSendTransaction === "function"
  );
};

export const discoverSolanaWallets = (target: Window = window, waitMs = 150): Promise<SolanaStandardWallet[]> =>
  new Promise((resolve) => {
    const byName = new Map<string, SolanaStandardWallet>();
    const register = (...wallets: readonly unknown[]) => {
      for (const wallet of wallets) {
        if (isUsableSolanaWallet(wallet)) byName.set(wallet.name, wallet);
      }
      return () => undefined;
    };
    const onRegister = (event: Event) => {
      const callback = (event as CustomEvent<(api: { register: typeof register }) => void>).detail;
      if (typeof callback === "function") callback({ register });
    };
    target.addEventListener("wallet-standard:register-wallet", onRegister);
    target.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: { register } }));
    setTimeout(() => {
      target.removeEventListener("wallet-standard:register-wallet", onRegister);
      resolve([...byName.values()]);
    }, waitMs);
  });

export const sendSolanaUsdcTransfer = async (
  wallet: SolanaStandardWallet,
  account: SolanaWalletAccount,
  params: {
    readonly sourceAta: string;
    readonly mint: string;
    readonly destinationAta: string;
    readonly amount: bigint;
    readonly quoteId: string;
    readonly recentBlockhash: string;
  },
): Promise<string> => {
  const transaction = buildSolanaUsdcTransferTransaction({
    payer: account.address,
    ...params,
  });
  const signAndSend = wallet.features["solana:signAndSendTransaction"]?.signAndSendTransaction;
  if (!signAndSend) throw new Error("Solana wallet cannot sign and send transactions");
  const results = await signAndSend({ transaction, account, chain: SOLANA_MAINNET_CHAIN });
  const signature = results[0]?.signature;
  if (!signature || signature.length === 0) throw new Error("Solana wallet did not return a signature");
  return encodeBase58(signature);
};
