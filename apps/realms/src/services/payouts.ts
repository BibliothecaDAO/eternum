/**
 * The parametric payout curve from the backend brief (B.1): W = ceil(N ×
 * paid_fraction / 10000) winners, weight decay^(k−1), allocations floored over
 * the pool after the protocol cut. Weights use 1e9 fixed point so bigint pools
 * never round through floats. Pure math — the contract runs the same curve and
 * presets are write-once, so screen and payout cannot drift.
 */
interface PayoutCurveInput {
  pool: bigint;
  protocolCutBps: number;
  paidFractionBps: number;
  decayBps: number;
  seats: number;
}

export const computePayouts = (
  input: PayoutCurveInput,
): { winners: number; cut: bigint; prizePool: bigint; allocations: bigint[] } => {
  const cut = (input.pool * BigInt(input.protocolCutBps)) / 10_000n;
  const prizePool = input.pool - cut;
  const winners = Math.ceil((input.seats * input.paidFractionBps) / 10_000);
  if (winners === 0 || prizePool <= 0n) return { winners: 0, cut, prizePool, allocations: [] };

  const WEIGHT_SCALE = 1_000_000_000;
  const decay = input.decayBps / 10_000;
  const weights: bigint[] = [];
  let weight = 1;
  for (let position = 0; position < winners; position += 1) {
    weights.push(BigInt(Math.round(weight * WEIGHT_SCALE)));
    weight *= decay;
  }
  const totalWeight = weights.reduce((sum, value) => sum + value, 0n);
  const allocations = weights.map((value) => (prizePool * value) / totalWeight);
  return { winners, cut, prizePool, allocations };
};

export interface RegistrationPricing {
  readonly entryFee: bigint;
  readonly swordPrice: bigint;
  readonly shieldPrice: bigint;
}

export interface RegisterOptions {
  readonly sword: boolean;
  readonly shield: boolean;
}

export const registrationTotal = (pricing: RegistrationPricing, options: RegisterOptions): bigint =>
  pricing.entryFee + (options.sword ? pricing.swordPrice : 0n) + (options.shield ? pricing.shieldPrice : 0n);
