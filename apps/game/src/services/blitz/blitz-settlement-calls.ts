import { CallData, type Call } from "starknet";
import { resolveBlitzGrantStartingTroops } from "./blitz-settlement-options";

interface BuildBlitzSettleCallsParams {
  blitzSystemsAddress: string;
  signerAddress: string;
  usernameFelt: string;
  /** The chosen game's registry id — settle's first calldata slot on the appchain worlds. */
  gameId?: number | null;
  vrfProviderAddress?: string | null;
  cosmeticTokenIds?: readonly string[];
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
  blitzSystemsAddress,
  signerAddress,
}: {
  vrfProviderAddress: string;
  blitzSystemsAddress: string;
  signerAddress: string;
}): Call => ({
  contractAddress: vrfProviderAddress,
  entrypoint: "request_random",
  calldata: CallData.compile([blitzSystemsAddress, 0, signerAddress]),
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
    // `Option<u128>::None` serializes as enum index `1` in the current manifest.
    calldata: CallData.compile([
      ...gameCalldata,
      usernameFelt,
      "1",
      ...cosmeticCalldata,
      grantStartingTroops ? "1" : "0",
    ]),
  };
};

export const buildBlitzSettleCalls = ({
  blitzSystemsAddress,
  signerAddress,
  usernameFelt,
  gameId,
  vrfProviderAddress,
  cosmeticTokenIds = [],
}: BuildBlitzSettleCallsParams): Call[] => {
  const calls: Call[] = [];
  const grantStartingTroops = resolveBlitzGrantStartingTroops();

  if (hasConfiguredAddress(vrfProviderAddress)) {
    calls.push(buildRequestRandomCall({ vrfProviderAddress, blitzSystemsAddress, signerAddress }));
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
