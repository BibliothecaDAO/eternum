import { describe, expect, it } from "vitest";
import { LiquidityTransactions } from "../src/transactions/liquidity";
import { SwapTransactions } from "../src/transactions/swap";

describe("AMMv2 transaction builders", () => {
  it("builds approve + exact-in swap calls", () => {
    const tokenInAddress = "0x101";
    const lordsAddress = "0x202";
    const tokenOutAddress = "0x303";
    const routerAddress = "0x404";
    const recipientAddress = "0x505";
    const transactions = new SwapTransactions();
    const calls = transactions.swapExactTokensForTokensWithApproval({
      routerAddress,
      tokenInAddress,
      amountIn: 123n,
      minAmountOut: 77n,
      path: [tokenInAddress, lordsAddress, tokenOutAddress],
      recipientAddress,
      deadline: 3600,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      contractAddress: tokenInAddress,
      entrypoint: "approve",
    });
    expect(calls[1]).toMatchObject({
      contractAddress: routerAddress,
      entrypoint: "swap_exact_tokens_for_tokens",
    });
    expect(calls[1].calldata).toContain(BigInt(tokenInAddress).toString());
    expect(calls[1].calldata).toContain(BigInt(lordsAddress).toString());
    expect(calls[1].calldata).toContain(BigInt(tokenOutAddress).toString());
    expect(calls[1].calldata.at(-2)).toBe(BigInt(recipientAddress).toString());
    expect(calls[1].calldata.at(-1)).toBe("3600");
  });

  it("builds approve + remove-liquidity calls", () => {
    const lordsAddress = "0x101";
    const tokenAddress = "0x202";
    const lpTokenAddress = "0x303";
    const routerAddress = "0x404";
    const recipientAddress = "0x505";
    const transactions = new LiquidityTransactions();
    const calls = transactions.removeLiquidityWithApproval({
      routerAddress,
      tokenAAddress: lordsAddress,
      tokenBAddress: tokenAddress,
      lpTokenAddress,
      liquidity: 456n,
      amountAMin: 12n,
      amountBMin: 34n,
      recipientAddress,
      deadline: 7200,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      contractAddress: lpTokenAddress,
      entrypoint: "approve",
    });
    expect(calls[1]).toMatchObject({
      contractAddress: routerAddress,
      entrypoint: "remove_liquidity",
    });
    expect(calls[1].calldata).toContain(BigInt(lordsAddress).toString());
    expect(calls[1].calldata).toContain(BigInt(tokenAddress).toString());
    expect(calls[1].calldata.at(-2)).toBe(BigInt(recipientAddress).toString());
    expect(calls[1].calldata.at(-1)).toBe("7200");
  });
});
