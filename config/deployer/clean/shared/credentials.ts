export interface AccountCredentials {
  accountAddress: string;
  privateKey: string;
}

export interface ResolveAccountCredentialsOptions {
  accountAddress?: string;
  privateKey?: string;
  fallbackAccountAddress?: string;
  fallbackPrivateKey?: string;
  context: string;
}

export function resolveAccountCredentials(options: ResolveAccountCredentialsOptions): AccountCredentials {
  const accountAddress = options.accountAddress || options.fallbackAccountAddress;
  const privateKey = options.privateKey || options.fallbackPrivateKey;

  if (!accountAddress || !privateKey) {
    throw new Error(`Missing account credentials for ${options.context}`);
  }

  return { accountAddress, privateKey };
}
