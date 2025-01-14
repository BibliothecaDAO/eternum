import { starknetKeccak } from "@dojoengine/torii-client";
import { Buffer } from "buffer";

export const getMessageKey = (addressOne: string | bigint, addressTwo: string | bigint) => {
  if (typeof addressOne === "string") {
    addressOne = BigInt(addressOne);
  }

  if (typeof addressTwo === "string") {
    addressTwo = BigInt(addressTwo);
  }

  const sortedAddresses = [addressOne, addressTwo].sort((a, b) => Number(a) - Number(b));

  return starknetKeccak(Buffer.from(sortedAddresses.join("")));
};
