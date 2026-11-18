import { createHmac } from "node:crypto";

import { PRINTED_CODE_ALPHABET, PRINTED_CODE_LENGTH } from "@realms-world/identity";

export function generateCodes(scope: string, count: number, seed: string): string[] {
  const codes = new Set<string>();
  for (let draw = 0; codes.size < count; draw++) {
    const bytes = createHmac("sha256", seed).update(`${scope}:code:${draw}`).digest();
    let bits = 0n;
    for (const byte of bytes.subarray(0, 5)) bits = (bits << 8n) | BigInt(byte);
    let code = "";
    for (let letter = 0; letter < PRINTED_CODE_LENGTH; letter++)
      code += PRINTED_CODE_ALPHABET[Number((bits >> BigInt(5 * letter)) & 31n)];
    codes.add(code);
  }
  return [...codes];
}

export const readCodeSeed = (seed: string | undefined) => {
  if (!seed || seed.length < 32) throw new Error("CAMPAIGN_CODE_SEED must hold at least 32 secret characters.");
  return seed;
};
