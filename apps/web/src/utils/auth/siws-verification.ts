export class SiwsVerificationError extends Error {}

export interface AuthorizeSiwsNonceOptions {
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
