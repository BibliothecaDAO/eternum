export function requireRpcUrl(value: string | undefined, source: string): string {
  const rpcUrl = value?.trim();
  if (!rpcUrl) {
    throw new Error(`${source} is required`);
  }
  return rpcUrl;
}
