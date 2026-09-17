import { byteArray, CallData, hash } from "starknet";

export function byteArrayHash(value: string): string {
  return hash.computePoseidonHashOnElements(CallData.compile(byteArray.byteArrayFromString(value)));
}

export function resourceSelector(namespace: string, name: string): string {
  return hash.computePoseidonHashOnElements([byteArrayHash(namespace), byteArrayHash(name)]);
}
