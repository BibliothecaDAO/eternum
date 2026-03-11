import type { BigNumberish, Call } from "starknet";

const VRF_SOURCE_NONCE = 0;
const VRF_SOURCE_SALT = 1;

type NormalizeAddress = (address: BigNumberish | undefined | null) => string | undefined;

export type VrfSource = { type: "nonce"; value: BigNumberish } | { type: "salt"; value: BigNumberish };

export const isVrfEnabled = (vrfProviderAddress?: string): vrfProviderAddress is string =>
  vrfProviderAddress !== undefined && Number(vrfProviderAddress) !== 0;

const encodeVrfSource = (source: VrfSource): [number, BigNumberish] => {
  if (source.type === "salt") {
    return [VRF_SOURCE_SALT, source.value];
  }

  return [VRF_SOURCE_NONCE, source.value];
};

export const createVrfRequestRandomCall = ({
  vrfProviderAddress,
  addressToCall,
  source,
}: {
  vrfProviderAddress: string;
  addressToCall: string;
  source: VrfSource;
}): Call => ({
  contractAddress: vrfProviderAddress,
  entrypoint: "request_random",
  calldata: [addressToCall, ...encodeVrfSource(source)],
});

export const isVrfRequestRandomCall = ({
  call,
  vrfProviderAddress,
  normalizeAddress,
}: {
  call: Call;
  vrfProviderAddress?: string;
  normalizeAddress: NormalizeAddress;
}): boolean => {
  if (call.entrypoint !== "request_random") {
    return false;
  }

  const providerAddress = normalizeAddress(vrfProviderAddress);
  const callAddress = normalizeAddress(call.contractAddress);
  return providerAddress !== undefined && providerAddress === callAddress;
};

export const getVrfRequestCallKey = ({
  call,
  normalizeAddress,
}: {
  call: Call;
  normalizeAddress: NormalizeAddress;
}): string => {
  const callAddress = normalizeAddress(call.contractAddress) ?? "";
  const calldata = Array.isArray(call.calldata)
    ? call.calldata.map((item) => normalizeAddress(item as BigNumberish) ?? String(item))
    : [];
  return `${callAddress}:${call.entrypoint}:${calldata.join(",")}`;
};
