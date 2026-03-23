import { describe, expect, it } from "vitest";
import { AdminTransactions } from "../src/transactions/admin";
import { LiquidityTransactions } from "../src/transactions/liquidity";
import { SwapTransactions } from "../src/transactions/swap";

const AMM_ADDRESS = "0x1234";
const TOKEN_ADDRESS = "0xabcd";
const LORDS_ADDRESS = "0x5678";

describe("SwapTransactions", () => {
  const swap = new SwapTransactions();

  it("should build swapLordsForToken call", () => {
    const call = swap.swapLordsForToken({
      ammAddress: AMM_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      lordsAmount: 1000n,
      minTokenOut: 900n,
      deadline: 9999999,
    });

    expect(call.contractAddress).toBe(AMM_ADDRESS);
    expect(call.entrypoint).toBe("swap_lords_for_token");
    expect(call.calldata).toBeDefined();
    expect(call.calldata!.length).toBeGreaterThan(0);
    // First element should be the token address
    expect(call.calldata![0]).toBe(TOKEN_ADDRESS);
  });

  it("should build swapTokenForLords call", () => {
    const call = swap.swapTokenForLords({
      ammAddress: AMM_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      tokenAmount: 500n,
      minLordsOut: 450n,
      deadline: 9999999,
    });

    expect(call.contractAddress).toBe(AMM_ADDRESS);
    expect(call.entrypoint).toBe("swap_token_for_lords");
    expect(call.calldata).toBeDefined();
    expect(call.calldata![0]).toBe(TOKEN_ADDRESS);
  });

  it("should build swapTokenForToken call", () => {
    const call = swap.swapTokenForToken({
      ammAddress: AMM_ADDRESS,
      tokenInAddress: TOKEN_ADDRESS,
      tokenOutAddress: "0xdead",
      amountIn: 1000n,
      minAmountOut: 800n,
      deadline: 9999999,
    });

    expect(call.contractAddress).toBe(AMM_ADDRESS);
    expect(call.entrypoint).toBe("swap_token_for_token");
    expect(call.calldata![0]).toBe(TOKEN_ADDRESS);
    expect(call.calldata![1]).toBe("0xdead");
  });

  it("should build swapLordsForTokenWithApproval calls", () => {
    const calls = swap.swapLordsForTokenWithApproval({
      ammAddress: AMM_ADDRESS,
      lordsAddress: LORDS_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      lordsAmount: 1000n,
      minTokenOut: 900n,
      deadline: 9999999,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].contractAddress).toBe(LORDS_ADDRESS);
    expect(calls[0].entrypoint).toBe("approve");
    expect(calls[1].entrypoint).toBe("swap_lords_for_token");
  });

  it("should build swapTokenForLordsWithApproval calls", () => {
    const calls = swap.swapTokenForLordsWithApproval({
      ammAddress: AMM_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      tokenAmount: 500n,
      minLordsOut: 450n,
      deadline: 9999999,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].contractAddress).toBe(TOKEN_ADDRESS);
    expect(calls[0].entrypoint).toBe("approve");
    expect(calls[1].entrypoint).toBe("swap_token_for_lords");
  });

  it("should build swapTokenForTokenWithApproval calls", () => {
    const calls = swap.swapTokenForTokenWithApproval({
      ammAddress: AMM_ADDRESS,
      tokenInAddress: TOKEN_ADDRESS,
      tokenOutAddress: "0xdead",
      amountIn: 1000n,
      minAmountOut: 800n,
      deadline: 9999999,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].contractAddress).toBe(TOKEN_ADDRESS);
    expect(calls[0].entrypoint).toBe("approve");
    expect(calls[1].entrypoint).toBe("swap_token_for_token");
  });

  it("should use default deadline when not provided", () => {
    const call = swap.swapLordsForToken({
      ammAddress: AMM_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      lordsAmount: 1000n,
      minTokenOut: 900n,
    });

    expect(call.calldata).toBeDefined();
    // Last element is the deadline, should be a numeric string
    const deadline = Number(call.calldata![call.calldata!.length - 1]);
    expect(deadline).toBeGreaterThan(0);
  });
});

describe("LiquidityTransactions", () => {
  const liquidity = new LiquidityTransactions();

  it("should build addLiquidity call", () => {
    const call = liquidity.addLiquidity({
      ammAddress: AMM_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      lordsAmount: 1000n,
      tokenAmount: 5000n,
      lordsMin: 900n,
      tokenMin: 4500n,
      deadline: 9999999,
    });

    expect(call.contractAddress).toBe(AMM_ADDRESS);
    expect(call.entrypoint).toBe("add_liquidity");
    expect(call.calldata![0]).toBe(TOKEN_ADDRESS);
  });

  it("should build addLiquidityWithApproval calls", () => {
    const calls = liquidity.addLiquidityWithApproval({
      ammAddress: AMM_ADDRESS,
      lordsAddress: LORDS_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      lordsAmount: 1000n,
      tokenAmount: 5000n,
      lordsMin: 900n,
      tokenMin: 4500n,
      deadline: 9999999,
    });

    expect(calls).toHaveLength(3);
    expect(calls[0].contractAddress).toBe(LORDS_ADDRESS);
    expect(calls[0].entrypoint).toBe("approve");
    expect(calls[1].contractAddress).toBe(TOKEN_ADDRESS);
    expect(calls[1].entrypoint).toBe("approve");
    expect(calls[2].entrypoint).toBe("add_liquidity");
  });

  it("should build removeLiquidity call", () => {
    const call = liquidity.removeLiquidity({
      ammAddress: AMM_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      lpAmount: 100n,
      lordsMin: 50n,
      tokenMin: 250n,
      deadline: 9999999,
    });

    expect(call.contractAddress).toBe(AMM_ADDRESS);
    expect(call.entrypoint).toBe("remove_liquidity");
    expect(call.calldata![0]).toBe(TOKEN_ADDRESS);
  });
});

describe("AdminTransactions", () => {
  const admin = new AdminTransactions();

  it("should build createPool call", () => {
    const call = admin.createPool({
      ammAddress: AMM_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      lpFeeNum: 3n,
      lpFeeDenom: 1000n,
      protocolFeeNum: 1n,
      protocolFeeDenom: 1000n,
    });

    expect(call.contractAddress).toBe(AMM_ADDRESS);
    expect(call.entrypoint).toBe("create_pool");
    expect(call.calldata![0]).toBe(TOKEN_ADDRESS);
  });

  it("should build setPoolFee call", () => {
    const call = admin.setPoolFee({
      ammAddress: AMM_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
      lpFeeNum: 5n,
      lpFeeDenom: 1000n,
      protocolFeeNum: 2n,
      protocolFeeDenom: 1000n,
    });

    expect(call.contractAddress).toBe(AMM_ADDRESS);
    expect(call.entrypoint).toBe("set_pool_fee");
  });

  it("should build setFeeRecipient call", () => {
    const call = admin.setFeeRecipient({
      ammAddress: AMM_ADDRESS,
      recipient: "0xfee",
    });

    expect(call.contractAddress).toBe(AMM_ADDRESS);
    expect(call.entrypoint).toBe("set_fee_recipient");
    expect(call.calldata![0]).toBe("0xfee");
  });

  it("should build setPaused call with true", () => {
    const call = admin.setPaused({
      ammAddress: AMM_ADDRESS,
      paused: true,
    });

    expect(call.contractAddress).toBe(AMM_ADDRESS);
    expect(call.entrypoint).toBe("set_paused");
    expect(call.calldata![0]).toBe("1");
  });

  it("should build setPaused call with false", () => {
    const call = admin.setPaused({
      ammAddress: AMM_ADDRESS,
      paused: false,
    });

    expect(call.calldata![0]).toBe("0");
  });
});
