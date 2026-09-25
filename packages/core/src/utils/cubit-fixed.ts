/**
 * The contract's 64.64 fixed-point arithmetic (vendored cubit f128), operation for operation in BigInt, so a forecast
 * reproduces the contract's truncation and polynomial approximations rather than a float estimate of them.
 */
export interface Fixed {
  readonly mag: bigint;
  readonly sign: boolean;
}

const ONE_MAG = 1n << 64n;
const HALF_MAG = 1n << 63n;
const U128_LIMIT = 1n << 128n;

export const fixed = (mag: bigint, sign = false): Fixed => {
  if (mag < 0n || mag >= U128_LIMIT) throw new Error("Fixed magnitude outside u128");
  return { mag, sign };
};

export const unscaled = (whole: bigint | number): Fixed => fixed(BigInt(whole) * ONE_MAG);

export const ZERO: Fixed = fixed(0n);
export const ONE: Fixed = fixed(ONE_MAG);

export const add = (a: Fixed, b: Fixed): Fixed => {
  if (a.sign === b.sign) return fixed(a.mag + b.mag, a.sign);
  if (a.mag === b.mag) return ZERO;
  return a.mag > b.mag ? fixed(a.mag - b.mag, a.sign) : fixed(b.mag - a.mag, b.sign);
};

const neg = (a: Fixed): Fixed => (a.mag === 0n ? a : fixed(a.mag, !a.sign));

export const sub = (a: Fixed, b: Fixed): Fixed => add(a, neg(b));

export const mul = (a: Fixed, b: Fixed): Fixed => fixed((a.mag * b.mag) / ONE_MAG, a.sign !== b.sign);

export const div = (a: Fixed, b: Fixed): Fixed => {
  if (b.mag === 0n) throw new Error("Fixed division by zero");
  return fixed((a.mag * ONE_MAG) / b.mag, a.sign !== b.sign);
};

export const gte = (a: Fixed, b: Fixed): boolean =>
  a.sign !== b.sign ? !a.sign : a.mag === b.mag || a.mag > b.mag !== a.sign;

export const lte = (a: Fixed, b: Fixed): boolean =>
  a.sign !== b.sign ? a.sign : a.mag === b.mag || a.mag < b.mag !== a.sign;

const splitUnsigned = (a: Fixed): [bigint, bigint] => [a.mag / ONE_MAG, a.mag % ONE_MAG];

export const round = (a: Fixed): Fixed => {
  const [whole, rest] = splitUnsigned(a);
  return fixed(ONE_MAG * (rest >= HALF_MAG ? whole + 1n : whole), a.sign);
};

export const ceil = (a: Fixed): Fixed => {
  const [whole, rest] = splitUnsigned(a);
  if (rest === 0n) return a;
  if (!a.sign) return fixed((whole + 1n) * ONE_MAG);
  return whole === 0n ? ZERO : fixed(whole * ONE_MAG, true);
};

/** The unscaled whole part, rounding down, as the contract's Fixed → integer conversion does; refuses a negative. */
export const toWhole = (a: Fixed): bigint => {
  if (a.sign) throw new Error("Negative fixed value has no unsigned integer");
  return a.mag / ONE_MAG;
};

const bitLength = (value: bigint): number => value.toString(2).length;

/** cubit's msb lookup: the index of the highest set bit of a whole number, and that power of two. */
const msb = (whole: bigint): [bigint, bigint] => {
  if (whole < 2n) return [0n, 1n];
  const index = BigInt(bitLength(whole) - 1);
  return [index, 1n << index];
};

const LOG2_TERMS: readonly Fixed[] = [
  fixed(2284550827067371376n),
  fixed(13804762162529339368n, true),
  fixed(48676798788932142400n),
  fixed(110928274989790216568n, true),
  fixed(171296190111888966192n),
  fixed(184599081115266689944n, true),
  fixed(150429590981271126408n),
];

const log2 = (a: Fixed): Fixed => {
  if (a.sign) throw new Error("log2 of a negative fixed value");
  if (a.mag === ONE_MAG) return ZERO;
  if (a.mag < ONE_MAG) return neg(log2(div(ONE, a)));
  const [index, power] = msb(a.mag / ONE_MAG);
  const norm = div(a, unscaled(power));
  let series = mul(fixed(167660832607149504n, true), norm);
  for (const term of LOG2_TERMS) series = mul(add(series, term), norm);
  return add(add(series, fixed(63187350828072553424n, true)), unscaled(index));
};

const EXP2_TERMS: readonly Fixed[] = [
  fixed(231817862090993n),
  fixed(2911875592466782n),
  fixed(24539637786416367n),
  fixed(177449490038807528n),
  fixed(1023863119786103800n),
  fixed(4431397849999009866n),
  fixed(12786308590235521577n),
];

const exp2 = (a: Fixed): Fixed => {
  if (a.mag === 0n) return ONE;
  const [whole, rest] = splitUnsigned(a);
  let result = unscaled(1n << whole);
  if (rest !== 0n) {
    const fraction = fixed(rest);
    let series = mul(fixed(41691949755436n), fraction);
    for (const term of EXP2_TERMS) series = mul(add(series, term), fraction);
    result = mul(result, add(series, ONE));
  }
  return a.sign ? div(ONE, result) : result;
};

const LN_2 = fixed(12786308645202655660n);
const LOG2_E = fixed(26613026195688644984n);

const ln = (a: Fixed): Fixed => mul(LN_2, log2(a));

const exp = (a: Fixed): Fixed => exp2(mul(LOG2_E, a));

const powInt = (base: Fixed, exponent: bigint, sign: boolean): Fixed => {
  let x = sign ? div(ONE, base) : base;
  let n = exponent;
  if (n === 0n) return ONE;
  let y = ONE;
  while (n > 1n) {
    if (n % 2n === 1n) y = mul(x, y);
    x = mul(x, x);
    n /= 2n;
  }
  return mul(x, y);
};

export const pow = (a: Fixed, b: Fixed): Fixed => {
  const [, rest] = splitUnsigned(b);
  if (rest === 0n) return powInt(a, b.mag / ONE_MAG, b.sign);
  return exp(mul(b, ln(a)));
};
