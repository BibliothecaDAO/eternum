/** An address as the app shows one where no name stands for it: its head and its tail ("0x1a2b…9f3e"). */
export const shortAddress = (address: string): string =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
