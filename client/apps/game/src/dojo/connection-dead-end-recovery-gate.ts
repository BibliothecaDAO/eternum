interface ConnectionDeadEndRecoveryInput {
  toriiBaseUrl: string;
  reason?: string;
}

type ShouldRunDeadEndRecovery = (input: ConnectionDeadEndRecoveryInput) => boolean;

const normalizeRecoveryKeyPart = (value: string): string => value.trim().replace(/\/+$/, "");

const buildRecoveryKey = ({ toriiBaseUrl, reason = "unknown" }: ConnectionDeadEndRecoveryInput): string =>
  `${normalizeRecoveryKeyPart(toriiBaseUrl)}::${normalizeRecoveryKeyPart(reason)}`;

export const createConnectionDeadEndRecoveryGate = (): ShouldRunDeadEndRecovery => {
  const recoveredKeys = new Set<string>();

  return (input) => {
    const key = buildRecoveryKey(input);
    if (recoveredKeys.has(key)) {
      return false;
    }

    recoveredKeys.add(key);
    return true;
  };
};
