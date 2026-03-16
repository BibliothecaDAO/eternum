import { CallData, uint256, type Call } from "starknet";

const ENTRY_TOKEN_LOCK_ID = 69n;

interface BuildBlitzRegisterCallsParams {
  blitzSystemsAddress: string;
  entryTokenAddress?: string | null;
  usernameFelt: string;
  tokenId: bigint;
  cosmeticTokenIds?: readonly string[];
}

export const buildBlitzRegisterCalls = ({
  blitzSystemsAddress,
  entryTokenAddress,
  usernameFelt,
  tokenId,
  cosmeticTokenIds = [],
}: BuildBlitzRegisterCallsParams): Call[] => {
  const calls: Call[] = [];

  if (entryTokenAddress && tokenId > 0n) {
    const tokenIdUint256 = uint256.bnToUint256(tokenId);
    calls.push({
      contractAddress: entryTokenAddress,
      entrypoint: "token_lock",
      calldata: CallData.compile([tokenIdUint256, ENTRY_TOKEN_LOCK_ID]),
    });
  }

  const cosmeticCalldata =
    cosmeticTokenIds.length > 0 ? [String(cosmeticTokenIds.length), ...cosmeticTokenIds] : ["0"];

  calls.push({
    contractAddress: blitzSystemsAddress,
    entrypoint: "register",
    calldata: [usernameFelt, tokenId.toString(), ...cosmeticCalldata],
  });

  return calls;
};
