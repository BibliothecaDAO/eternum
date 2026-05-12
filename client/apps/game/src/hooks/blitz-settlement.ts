import { CallData, uint256, type Call } from "starknet";
import { resolveBlitzGrantStartingTroops } from "@/services/blitz/blitz-settlement-options";

interface BuildBlitzSettleCallsParams {
  blitzSystemsAddress: string;
  usernameFelt: string;
  entryTokenAddress?: string | null;
  feeTokenAddress?: string | null;
  feeAmount?: bigint;
  cosmeticTokenIds?: readonly string[];
}

export const buildBlitzSettleCalls = ({
  blitzSystemsAddress,
  usernameFelt,
  entryTokenAddress,
  feeTokenAddress,
  feeAmount = 0n,
  cosmeticTokenIds = [],
}: BuildBlitzSettleCallsParams): Call[] => {
  const cosmeticCalldata = cosmeticTokenIds.length > 0 ? [String(cosmeticTokenIds.length), ...cosmeticTokenIds] : ["0"];
  const grantStartingTroopsCalldata = resolveBlitzGrantStartingTroops() ? "1" : "0";
  const calls: Call[] = [];
  const requiresEntryTokenApproval = Boolean(entryTokenAddress && feeAmount > 0n);

  if (feeAmount > 0n && !entryTokenAddress) {
    throw new Error("Blitz worlds with entry fees must define an entry token collection");
  }

  if (feeTokenAddress && feeAmount > 0n) {
    const amountUint256 = uint256.bnToUint256(feeAmount);
    calls.push({
      contractAddress: feeTokenAddress,
      entrypoint: "approve",
      calldata: CallData.compile([blitzSystemsAddress, amountUint256.low, amountUint256.high]),
    });
  }

  if (requiresEntryTokenApproval) {
    calls.push({
      contractAddress: entryTokenAddress!,
      entrypoint: "set_approval_for_all",
      calldata: CallData.compile([blitzSystemsAddress, true]),
    });
  }

  calls.push({
    contractAddress: blitzSystemsAddress,
    entrypoint: "settle",
    // `Option<u128>::None` serializes as enum index `1` in the current manifest.
    calldata: CallData.compile([usernameFelt, "1", ...cosmeticCalldata, grantStartingTroopsCalldata]),
  });

  if (requiresEntryTokenApproval) {
    calls.push({
      contractAddress: entryTokenAddress!,
      entrypoint: "set_approval_for_all",
      calldata: CallData.compile([blitzSystemsAddress, false]),
    });
  }

  return calls;
};
