/**
 * TypeScript port of ABDK Math 64.64 Library plus modifications
 * Original: https://github.com/abdk-consulting/abdk-libraries-solidity/blob/master/ABDKMath64x64.sol
 * Original Copyright © 2019 by ABDK Consulting
 * Original Author: Mikhail Vladimirov <mikhail.vladimirov@gmail.com>
 *
 * Modified by: Credence <hello@zerocredence.com>
 *
 * Modifications:
 *  - mul and div are handled differently from the original library, which may affect the precision.
 */

// Constants
const MIN_64x64 = BigInt("0x80000000000000000000000000000000") * BigInt(-1);
const MAX_64x64 = BigInt("0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
const ONE_64x64 = BigInt(1) << BigInt(64);

export class Fixed {
  public value: bigint;

  constructor(value: bigint) {
    this.value = value;
  }

  mul(other: Fixed): Fixed {
    return FixedTrait.mul(this, other);
  }

  div(other: Fixed): Fixed {
    return FixedTrait.div(this, other);
  }

  add(other: Fixed): Fixed {
    return FixedTrait.add(this, other);
  }

  sub(other: Fixed): Fixed {
    return FixedTrait.sub(this, other);
  }

  abs(): Fixed {
    return FixedTrait.abs(this);
  }

  sqrt(): Fixed {
    return FixedTrait.sqrt(this);
  }

  floor(): Fixed {
    return FixedTrait.floor(this);
  }

  mod(other: Fixed): Fixed {
    return FixedTrait.mod(this, other);
  }

  rem(other: Fixed): Fixed {
    return FixedTrait.rem(this, other);
  }

  neg(): Fixed {
    return FixedTrait.neg(this);
  }
}

export class FixedTrait {
  static ONE_64x64 = ONE_64x64;

  static ONE = new Fixed(ONE_64x64);
  static ZERO = new Fixed(0n);

  /**
   * Convert a ratio to a fixed point number
   */
  static fromRatio(numerator: bigint, denominator: bigint): Fixed {
    return FixedTrait.divi(FixedTrait.fromInt(numerator), FixedTrait.fromInt(denominator));
  }

  /**
   * Convert signed integer to 64.64 fixed point
   */
  static fromInt(x: bigint): Fixed {
    if (x < -0x8000000000000000n || x > 0x7fffffffffffffffn) {
      throw new Error("Input out of bounds");
    }
    return new Fixed(x << 64n);
  }

  /**
   * Convert 64.64 fixed point to integer (rounding down)
   */
  static toInt(x: Fixed): Fixed {
    return new Fixed(x.value >> 64n);
  }

  /**
   * Convert unsigned integer to 64.64 fixed point
   */
  static fromUInt(x: bigint): Fixed {
    if (x > 0x7fffffffffffffffn) {
      throw new Error("Input out of bounds");
    }
    return new Fixed(x << 64n);
  }

  /**
   * Convert 64.64 fixed point to unsigned integer (rounding down)
   */
  static toUInt(x: Fixed): bigint {
    if (x.value < 0n) {
      throw new Error("Input must be positive");
    }
    return x.value >> 64n;
  }

  /**
   * Add two 64.64 fixed point numbers
   */
  static add(x: Fixed, y: Fixed): Fixed {
    const result = x.value + y.value;
    if (result < MIN_64x64 || result > MAX_64x64) {
      throw new Error("Overflow add");
    }
    return new Fixed(result);
  }

  /**
   * Subtract two 64.64 fixed point numbers
   */
  static sub(x: Fixed, y: Fixed): Fixed {
    const result = x.value - y.value;
    if (result < MIN_64x64 || result > MAX_64x64) {
      throw new Error("Overflow sub");
    }
    return new Fixed(result);
  }

  /**
   * Multiply two 64.64 fixed point numbers (rounding down)
   * Handles sign separately from magnitude for better precision
   *
   * Note: This is a replica of the way it is handled in the cubit starknet library
   *  e.g of difference:
   *
   *  ABDKMath64x64: -3952873730080618200n * 24233599860844537324  = 5192914255895257994
   *  cubit: -3952873730080618200n * 24233599860844537324  = -5192914255895257993
   */
  static mul(x: Fixed, y: Fixed): Fixed {
    // Extract signs
    const xNegative = x.value < 0n;
    const yNegative = y.value < 0n;

    // Work with absolute values
    const xAbs = xNegative ? -x.value : x.value;
    const yAbs = yNegative ? -y.value : y.value;

    // Perform multiplication and scaling
    const result = (xAbs * yAbs) >> 64n;

    // Apply combined sign
    const finalResult = xNegative !== yNegative ? -result : result;

    if (finalResult < MIN_64x64 || finalResult > MAX_64x64) {
      throw new Error("Overflow mul");
    }
    return new Fixed(finalResult);
  }

  /**
   * Divide two 64.64 fixed point numbers (rounding down)
   * Handles sign separately from magnitude for better precision
   *
   * Note: This is a modified version of the original div function.
   *  It handles overflow differently, which may affect the precision.
   *
   *  This is a replica of the way it is handled in the cubit starknet library
   *  e.g of difference:
   */
  static div(x: Fixed, y: Fixed): Fixed {
    if (y.value === 0n) {
      throw new Error("Division by zero");
    }

    // Extract signs
    const xNegative = x.value < 0n;
    const yNegative = y.value < 0n;

    // Work with absolute values
    const xAbs = xNegative ? -x.value : x.value;
    const yAbs = yNegative ? -y.value : y.value;

    // Perform division with scaling
    const result = (xAbs << 64n) / yAbs;

    // Apply combined sign
    const finalResult = xNegative !== yNegative ? -result : result;

    if (finalResult < MIN_64x64 || finalResult > MAX_64x64) {
      throw new Error("Overflow div");
    }
    return new Fixed(finalResult);
  }

  static divi(x: Fixed, y: Fixed): Fixed {
    if (y.value === 0n) {
      throw new Error("Division by zero");
    }

    let negativeResult = false;
    if (x.value < 0n) {
      x.value = -x.value; // We rely on overflow behavior here
      negativeResult = true;
    }
    if (y.value < 0n) {
      y.value = -y.value; // We rely on overflow behavior here
      negativeResult = !negativeResult;
    }
    const absoluteResult = FixedTrait.divuu(x, y);
    if (negativeResult) {
      if (absoluteResult.value <= 0x80000000000000000000000000000000n) {
        return new Fixed(-absoluteResult.value); // We rely on overflow behavior here
      } else {
        throw new Error("Overflow divi");
      }
    }
    return absoluteResult;
  }

  static divuu(x: Fixed, y: Fixed): Fixed {
    if (y.value === 0n) {
      throw new Error("Division by zero");
    }

    let result;

    if (x.value <= 0xffffffffffffffffffffffffffffffffffffffffffffffffn) {
      result = (x.value << 64n) / y.value;
    } else {
      let msb = 192n;
      let xc = x.value >> 192n;
      if (xc >= 0x100000000n) {
        xc >>= 32n;
        msb += 32n;
      }
      if (xc >= 0x10000n) {
        xc >>= 16n;
        msb += 16n;
      }
      if (xc >= 0x100n) {
        xc >>= 8n;
        msb += 8n;
      }
      if (xc >= 0x10n) {
        xc >>= 4n;
        msb += 4n;
      }
      if (xc >= 0x4n) {
        xc >>= 2n;
        msb += 2n;
      }
      if (xc >= 0x2n) msb += 1n; // No need to shift xc anymore

      result = (x.value << (255n - msb)) / (((y.value - 1n) >> (msb - 191n)) + 1n);
      if (result > 0xffffffffffffffffffffffffffffffffn) {
        throw new Error("Overflow divuu");
      }

      let hi = result * (y.value >> 128n);
      let lo = result * (y.value & 0xffffffffffffffffffffffffffffffffn);

      let xh = x.value >> 192n;
      let xl = x.value << 64n;

      if (xl < lo) xh -= 1n;
      xl -= lo; // We rely on overflow behavior here
      lo = hi << 128n;
      if (xl < lo) xh -= 1n;
      xl -= lo; // We rely on overflow behavior here

      result += xh == hi >> 128n ? xl / y.value : 1n;
    }

    if (result > 0xffffffffffffffffffffffffffffffffn) {
      throw new Error("Overflow divuu");
    }
    return new Fixed(result);
  }

  static divu(x: Fixed, y: Fixed): Fixed {
    if (y.value === 0n) {
      throw new Error("Division by zero");
    }

    const result = FixedTrait.divuu(x, y);
    if (result.value > MAX_64x64) {
      throw new Error("Overflow divu");
    }
    return result;
  }

  /**
   * Calculate absolute value
   */
  static abs(x: Fixed): Fixed {
    if (x.value === MIN_64x64) {
      throw new Error("Overflow abs");
    }
    return x.value < 0n ? new Fixed(-x.value) : x;
  }

  /**
   * Calculate square root (rounding down)
   */
  static sqrt(x: Fixed): Fixed {
    if (x.value < 0n) {
      throw new Error("Input must be positive");
    }

    if (x.value === 0n) return new Fixed(0n);

    // Initial estimate using integer square root
    let r = 1n;
    let xx = x.value;

    // Binary search for the square root
    if (xx >= 1n << 128n) {
      xx >>= 128n;
      r <<= 64n;
    }
    if (xx >= 1n << 64n) {
      xx >>= 64n;
      r <<= 32n;
    }
    if (xx >= 1n << 32n) {
      xx >>= 32n;
      r <<= 16n;
    }
    if (xx >= 1n << 16n) {
      xx >>= 16n;
      r <<= 8n;
    }
    if (xx >= 1n << 8n) {
      xx >>= 8n;
      r <<= 4n;
    }
    if (xx >= 1n << 4n) {
      xx >>= 4n;
      r <<= 2n;
    }
    if (xx >= 1n << 2n) {
      r <<= 1n;
    }

    // Newton's method iterations
    r = (r + x.value / r) >> 1n;
    r = (r + x.value / r) >> 1n;
    r = (r + x.value / r) >> 1n;
    r = (r + x.value / r) >> 1n;
    r = (r + x.value / r) >> 1n;
    r = (r + x.value / r) >> 1n;
    r = (r + x.value / r) >> 1n;

    const r1 = FixedTrait.div(x, new Fixed(r));
    return r < r1.value ? new Fixed(r) : r1;
  }

  static floor(a: Fixed): Fixed {
    return new Fixed((a.value >> 64n) * FixedTrait.ONE_64x64);
  }

  static mod(a: Fixed, b: Fixed): Fixed {
    return new Fixed(a.value % b.value);
  }

  static rem(a: Fixed, b: Fixed): Fixed {
    return new Fixed(a.value % b.value);
  }

  static neg(a: Fixed): Fixed {
    return new Fixed(-a.value);
  }
}
