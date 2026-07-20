export function resolveConfiguredAddress(address: string | undefined | null): string {
  return address ?? "0x0";
}
