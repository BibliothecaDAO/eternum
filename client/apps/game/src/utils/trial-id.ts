const U32_MAX_TRIAL_ID = 4294967295n;

export const normalizeU32TrialId = (trialId: bigint | number | string): bigint => {
  let parsedTrialId: bigint;
  try {
    parsedTrialId = BigInt(trialId);
  } catch {
    throw new Error(
      `Invalid trial_id value "${String(trialId)}". trial_id must be a non-negative integer <= ${U32_MAX_TRIAL_ID.toString()}.`,
    );
  }

  if (parsedTrialId < 0n) {
    throw new Error(
      `Invalid trial_id value "${parsedTrialId.toString()}". trial_id must be a non-negative integer <= ${U32_MAX_TRIAL_ID.toString()}.`,
    );
  }

  if (parsedTrialId > U32_MAX_TRIAL_ID) {
    throw new Error(
      `Invalid trial_id value "${parsedTrialId.toString()}". trial_id exceeds u32::MAX (${U32_MAX_TRIAL_ID.toString()}).`,
    );
  }

  return parsedTrialId;
};

export const randomU32TrialId = (): bigint => {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return normalizeU32TrialId(BigInt(values[0] ?? 0));
  }

  return normalizeU32TrialId(BigInt(Math.floor(Math.random() * 0x1_0000_0000)));
};
