export const isConnectedGameplayAccount = (address: string | undefined): boolean =>
  address !== undefined && BigInt(address) !== 0n;
