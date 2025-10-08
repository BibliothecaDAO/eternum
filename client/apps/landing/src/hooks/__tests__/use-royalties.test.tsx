import { renderHook } from "@testing-library/react";
import { useRoyalties, useBatchRoyalties } from "../use-royalties";
import { useReadContract } from "@starknet-react/core";
import { parseUnits } from "viem";

// Mock the dependencies
jest.mock("@starknet-react/core");
jest.mock("viem");

const mockUseReadContract = useReadContract as jest.MockedFunction<typeof useReadContract>;
const mockParseUnits = parseUnits as jest.MockedFunction<typeof parseUnits>;

describe("useRoyalties", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseUnits.mockImplementation((value, decimals) => BigInt(value) * BigInt(10 ** decimals));
  });

  it("should calculate royalties correctly", () => {
    // Mock royalty data: 5% royalty
    mockUseReadContract.mockReturnValue({
      data: ["0x123456789", "50000000000000000"], // receiver and 5% of 1 ETH = 0.05 ETH
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() =>
      useRoyalties({
        collection: "beasts",
        tokenId: "1",
        salePrice: "1", // 1 ETH
      })
    );

    // Sale price: 1 ETH = 1000000000000000000 wei
    const expectedSalePrice = BigInt("1000000000000000000");
    const expectedMarketplaceFee = (expectedSalePrice * BigInt(250)) / BigInt(10000); // 2.5%
    const expectedRoyaltyAmount = BigInt("50000000000000000"); // 5%
    const expectedSellerProceeds = expectedSalePrice - expectedMarketplaceFee - expectedRoyaltyAmount;

    expect(result.current.totalPrice).toBe(expectedSalePrice);
    expect(result.current.marketplaceFee).toBe(expectedMarketplaceFee);
    expect(result.current.royaltyInfo?.royaltyAmount).toBe(expectedRoyaltyAmount);
    expect(result.current.royaltyPercentage).toBe(5);
    expect(result.current.sellerProceeds).toBe(expectedSellerProceeds);
  });

  it("should handle zero royalties", () => {
    mockUseReadContract.mockReturnValue({
      data: ["0x0", "0"], // No royalty
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() =>
      useRoyalties({
        collection: "realms",
        tokenId: "1",
        salePrice: "1",
      })
    );

    const expectedSalePrice = BigInt("1000000000000000000");
    const expectedMarketplaceFee = (expectedSalePrice * BigInt(250)) / BigInt(10000);
    const expectedSellerProceeds = expectedSalePrice - expectedMarketplaceFee;

    expect(result.current.royaltyInfo?.royaltyAmount).toBe(BigInt(0));
    expect(result.current.royaltyPercentage).toBe(0);
    expect(result.current.sellerProceeds).toBe(expectedSellerProceeds);
  });

  it("should handle loading state", () => {
    mockUseReadContract.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    const { result } = renderHook(() =>
      useRoyalties({
        collection: "beasts",
        tokenId: "1",
        salePrice: "1",
      })
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.royaltyInfo).toBe(null);
  });
});

describe("useBatchRoyalties", () => {
  it("should aggregate royalties for multiple tokens", () => {
    // Mock different royalties for different tokens
    mockUseReadContract
      .mockReturnValueOnce({
        data: ["0x123", "50000000000000000"], // 5% of 1 ETH
        isLoading: false,
        error: null,
      } as any)
      .mockReturnValueOnce({
        data: ["0x456", "40000000000000000"], // 2% of 2 ETH
        isLoading: false,
        error: null,
      } as any);

    const { result } = renderHook(() =>
      useBatchRoyalties([
        { collection: "beasts", tokenId: "1", salePrice: "1" },
        { collection: "beasts", tokenId: "2", salePrice: "2" },
      ])
    );

    const expectedTotalPrice = BigInt("3000000000000000000"); // 3 ETH total
    const expectedTotalMarketplaceFee = (expectedTotalPrice * BigInt(250)) / BigInt(10000);
    const expectedTotalRoyaltyAmount = BigInt("90000000000000000"); // 0.05 + 0.04 ETH
    const expectedTotalSellerProceeds = expectedTotalPrice - expectedTotalMarketplaceFee - expectedTotalRoyaltyAmount;

    expect(result.current.totalRoyalties.totalPrice).toBe(expectedTotalPrice);
    expect(result.current.totalRoyalties.totalMarketplaceFee).toBe(expectedTotalMarketplaceFee);
    expect(result.current.totalRoyalties.totalRoyaltyAmount).toBe(expectedTotalRoyaltyAmount);
    expect(result.current.totalRoyalties.totalSellerProceeds).toBe(expectedTotalSellerProceeds);
  });
});