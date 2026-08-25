import { CallData, uint256, type Call } from "starknet";
import { resolveBlitzGrantStartingTroops } from "./blitz-settlement-options";

interface BuildBlitzSettleCallsParams {
  blitzSystemsAddress: string;
  signerAddress: string;
  usernameFelt: string;
  /** The chosen game's registry id — settle's first calldata slot on the appchain worlds. */
  gameId?: number | null;
  vrfProviderAddress?: string | null;
  entryTokenAddress?: string | null;
  feeTokenAddress?: string | null;
  feeAmount?: bigint;
  cosmeticTokenIds?: readonly string[];
}

const buildFeeApprovalCall = ({
  feeTokenAddress,
  blitzSystemsAddress,
  feeAmount,
}: {
  feeTokenAddress: string;
  blitzSystemsAddress: string;
  feeAmount: bigint;
}): Call => {
  const amountUint256 = uint256.bnToUint256(feeAmount);

  return {
    contractAddress: feeTokenAddress,
    entrypoint: "approve",
    calldata: CallData.compile([blitzSystemsAddress, amountUint256.low, amountUint256.high]),
  };
};

const buildEntryTokenApprovalCall = ({
  entryTokenAddress,
  blitzSystemsAddress,
  approved,
}: {
  entryTokenAddress: string;
  blitzSystemsAddress: string;
  approved: boolean;
}): Call => ({
  contractAddress: entryTokenAddress,
  entrypoint: "set_approval_for_all",
  calldata: CallData.compile([blitzSystemsAddress, approved]),
});

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
  entryTokenAddress,
  feeTokenAddress,
  feeAmount = 0n,
  cosmeticTokenIds = [],
}: BuildBlitzSettleCallsParams): Call[] => {
  const calls: Call[] = [];
  const requiresEntryTokenApproval = Boolean(entryTokenAddress && feeAmount > 0n);
  const grantStartingTroops = resolveBlitzGrantStartingTroops();

  if (feeAmount > 0n && !entryTokenAddress) {
    throw new Error("Blitz worlds with entry fees must define an entry token collection");
  }

  if (feeTokenAddress && feeAmount > 0n) {
    calls.push(buildFeeApprovalCall({ feeTokenAddress, blitzSystemsAddress, feeAmount }));
  }

  if (requiresEntryTokenApproval) {
    calls.push(
      buildEntryTokenApprovalCall({ entryTokenAddress: entryTokenAddress!, blitzSystemsAddress, approved: true }),
    );
  }

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

  if (requiresEntryTokenApproval) {
    calls.push(
      buildEntryTokenApprovalCall({ entryTokenAddress: entryTokenAddress!, blitzSystemsAddress, approved: false }),
    );
  }

  return calls;
};
