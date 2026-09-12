import { CallData, type Call } from "starknet";

interface BuildBlitzSettleCallsParams {
  blitzSystemsAddress: string;
  signerAddress: string;
  usernameFelt: string;
  /** The chosen game's registry id — settle's first calldata slot on the appchain worlds. */
  gameId?: number | null;
  vrfProviderAddress?: string | null;
  cosmeticTokenIds?: readonly string[];
  /** Whether settle seeds the realm with its starting troops; the web client's dev override may withhold them. */
  grantStartingTroops: boolean;
}

interface BuildEternumSettleCallsParams {
  realmSystemsAddress: string;
  signerAddress: string;
  usernameFelt: string;
  gameId: number;
  vrfProviderAddress?: string | null;
}

const hasConfiguredAddress = (value?: string | null): value is string => {
  if (!value) return false;

  try {
    return BigInt(value) !== 0n;
  } catch {
    return false;
  }
};

const buildRequestRandomCall = ({
  vrfProviderAddress,
  systemsAddress,
  signerAddress,
}: {
  vrfProviderAddress: string;
  systemsAddress: string;
  signerAddress: string;
}): Call => ({
  contractAddress: vrfProviderAddress,
  entrypoint: "request_random",
  calldata: CallData.compile([systemsAddress, 0, signerAddress]),
});

const buildSettleCall = ({
  blitzSystemsAddress,
  usernameFelt,
  gameId,
  cosmeticTokenIds,
  grantStartingTroops,
}: {
  blitzSystemsAddress: string;
  usernameFelt: string;
  gameId?: number | null;
  cosmeticTokenIds: readonly string[];
  grantStartingTroops: boolean;
}): Call => {
  const cosmeticCalldata = cosmeticTokenIds.length > 0 ? [String(cosmeticTokenIds.length), ...cosmeticTokenIds] : ["0"];
  const gameCalldata = gameId && gameId > 0 ? [String(gameId)] : [];

  return {
    contractAddress: blitzSystemsAddress,
    entrypoint: "settle",
    calldata: CallData.compile([...gameCalldata, usernameFelt, ...cosmeticCalldata, grantStartingTroops ? "1" : "0"]),
  };
};

export const buildBlitzSettleCalls = ({
  blitzSystemsAddress,
  signerAddress,
  usernameFelt,
  gameId,
  vrfProviderAddress,
  cosmeticTokenIds = [],
  grantStartingTroops,
}: BuildBlitzSettleCallsParams): Call[] => {
  const calls: Call[] = [];

  if (hasConfiguredAddress(vrfProviderAddress)) {
    calls.push(buildRequestRandomCall({ vrfProviderAddress, systemsAddress: blitzSystemsAddress, signerAddress }));
  }

  calls.push(
    buildSettleCall({
      blitzSystemsAddress,
      usernameFelt,
      gameId,
      cosmeticTokenIds,
      grantStartingTroops,
    }),
  );

  return calls;
};

export const buildEternumSettleCalls = ({
  realmSystemsAddress,
  signerAddress,
  usernameFelt,
  gameId,
  vrfProviderAddress,
}: BuildEternumSettleCallsParams): Call[] => {
  if (!Number.isInteger(gameId) || gameId <= 0) throw new Error("A game id is required for settlement");
  const calls: Call[] = [];
  if (hasConfiguredAddress(vrfProviderAddress)) {
    calls.push(buildRequestRandomCall({ vrfProviderAddress, systemsAddress: realmSystemsAddress, signerAddress }));
  }
  calls.push({
    contractAddress: realmSystemsAddress,
    entrypoint: "settle",
    calldata: CallData.compile([gameId, usernameFelt]),
  });
  return calls;
};
