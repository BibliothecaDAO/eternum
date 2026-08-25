// @vitest-environment node
import { describe, it, expect } from "vitest";
import { comparePrices, BestPriceResult } from "./use-best-price";
import { MarketInterface, ResourcesIds } from "@bibliothecadao/types";

const WOOD = 1; // ResourcesIds.Wood equivalent

const makeAskOffer = (resourceId: number, perLords: number, amount: number): MarketInterface =>
  ({
    makerName: "seller",
    originName: "realm",
    tradeId: Math.floor(Math.random() * 10000),
    makerId: 100,
    takerId: 0,
    makerOrder: 0,
    makerGivesMinResourceAmount: 1,
    takerPaysMinResourceAmount: 1,
    makerGivesMaxResourceCount: 1,
    expiresAt: Date.now() + 86400,
    takerGets: [{ resourceId, amount }],
    makerGets: [{ resourceId: ResourcesIds.Lords, amount: Math.floor(amount * perLords) }],
    ratio: perLords,
    perLords,
  }) as unknown as MarketInterface;

const makeBidOffer = (resourceId: number, perLords: number, amount: number): MarketInterface =>
  ({
    makerName: "buyer",
    originName: "realm",
    tradeId: Math.floor(Math.random() * 10000),
    makerId: 200,
    takerId: 0,
    makerOrder: 0,
    makerGivesMinResourceAmount: 1,
    takerPaysMinResourceAmount: 1,
    makerGivesMaxResourceCount: 1,
    expiresAt: Date.now() + 86400,
    takerGets: [{ resourceId: ResourcesIds.Lords, amount: Math.floor(amount * perLords) }],
    makerGets: [{ resourceId, amount }],
    ratio: perLords,
    perLords,
  }) as unknown as MarketInterface;

describe("comparePrices", () => {
  describe("buy direction", () => {
    it("returns orderbook when OB ask is cheaper than AMM", () => {
      const result = comparePrices({
        direction: "buy",
        askOffers: [makeAskOffer(WOOD, 0.45, 500)],
        bidOffers: [],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: 0.5,
        ammSlippage: 1.2,
      });

      expect(result.bestVenue).toBe("orderbook");
      expect(result.obPrice).toBe(0.45);
      expect(result.ammPrice).toBe(0.5);
    });

    it("returns amm when AMM is cheaper than OB ask", () => {
      const result = comparePrices({
        direction: "buy",
        askOffers: [makeAskOffer(WOOD, 0.55, 500)],
        bidOffers: [],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: 0.48,
        ammSlippage: 0.5,
      });

      expect(result.bestVenue).toBe("amm");
    });

    it("falls back to AMM when no OB orders exist", () => {
      const result = comparePrices({
        direction: "buy",
        askOffers: [],
        bidOffers: [],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: 0.5,
        ammSlippage: 0.3,
      });

      expect(result.bestVenue).toBe("amm");
      expect(result.obPrice).toBeNull();
      expect(result.ammPrice).toBe(0.5);
    });

    it("falls back to OB when no AMM liquidity", () => {
      const result = comparePrices({
        direction: "buy",
        askOffers: [makeAskOffer(WOOD, 0.45, 500)],
        bidOffers: [],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: null,
        ammSlippage: 0,
      });

      expect(result.bestVenue).toBe("orderbook");
      expect(result.ammPrice).toBeNull();
    });

    it("returns null venue when neither is available", () => {
      const result = comparePrices({
        direction: "buy",
        askOffers: [],
        bidOffers: [],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: null,
        ammSlippage: 0,
      });

      expect(result.bestVenue).toBeNull();
      expect(result.obPrice).toBeNull();
      expect(result.ammPrice).toBeNull();
    });

    it("prefers AMM on tied prices", () => {
      const result = comparePrices({
        direction: "buy",
        askOffers: [makeAskOffer(WOOD, 0.5, 500)],
        bidOffers: [],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: 0.5,
        ammSlippage: 0,
      });

      expect(result.bestVenue).toBe("amm");
    });

    it("sums available volume at best OB price", () => {
      const result = comparePrices({
        direction: "buy",
        askOffers: [
          makeAskOffer(WOOD, 0.45, 200),
          makeAskOffer(WOOD, 0.45, 300),
          makeAskOffer(WOOD, 0.5, 100), // different price, should not be included
        ],
        bidOffers: [],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: 0.6,
        ammSlippage: 1.0,
      });

      expect(result.obPrice).toBe(0.45);
      expect(result.obAvailable).toBe(500);
    });

    it("filters offers by resource id", () => {
      const STONE = 2;
      const result = comparePrices({
        direction: "buy",
        askOffers: [
          makeAskOffer(STONE, 0.3, 500), // wrong resource
          makeAskOffer(WOOD, 0.55, 200), // correct resource
        ],
        bidOffers: [],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: 0.6,
        ammSlippage: 0.5,
      });

      expect(result.obPrice).toBe(0.55);
      expect(result.obAvailable).toBe(200);
    });
  });

  describe("sell direction", () => {
    it("returns orderbook when OB bid is higher than AMM", () => {
      const result = comparePrices({
        direction: "sell",
        askOffers: [],
        bidOffers: [makeBidOffer(WOOD, 0.5, 500)],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: 0.45,
        ammSlippage: 1.0,
      });

      expect(result.bestVenue).toBe("orderbook");
      expect(result.obPrice).toBe(0.5);
    });

    it("returns amm when AMM price is higher than OB bid", () => {
      const result = comparePrices({
        direction: "sell",
        askOffers: [],
        bidOffers: [makeBidOffer(WOOD, 0.4, 500)],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: 0.48,
        ammSlippage: 0.5,
      });

      expect(result.bestVenue).toBe("amm");
    });

    it("selects highest bid from multiple OB offers", () => {
      const result = comparePrices({
        direction: "sell",
        askOffers: [],
        bidOffers: [makeBidOffer(WOOD, 0.4, 300), makeBidOffer(WOOD, 0.5, 200), makeBidOffer(WOOD, 0.45, 100)],
        resourceId: WOOD as ResourcesIds,
        ammSpotPrice: 0.42,
        ammSlippage: 0.3,
      });

      expect(result.obPrice).toBe(0.5);
      expect(result.bestVenue).toBe("orderbook");
    });
  });
});
