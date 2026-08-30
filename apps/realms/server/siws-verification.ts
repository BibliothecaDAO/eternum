// Ported from apps/web/src/utils/auth/siws-verification.ts — the one SIWS
// authorization rule: a signature proves the key, consuming the nonce proves
// freshness, and both must pass in that order.
export class SiwsVerificationError extends Error {}

interface AuthorizeSiwsNonceOptions {
  verifySignature: () => Promise<boolean>;
  consumeNonce: () => Promise<boolean>;
}

export const authorizeSiwsNonce = async ({
  verifySignature,
  consumeNonce,
}: AuthorizeSiwsNonceOptions): Promise<void> => {
  if (!(await verifySignature())) {
    throw new SiwsVerificationError("Invalid signature");
  }

  if (!(await consumeNonce())) {
    throw new SiwsVerificationError("Invalid, expired, or already used nonce");
  }
};
