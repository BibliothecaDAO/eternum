// import { EternumGlobalConfig } from "@bibliothecadao/eternum";
// import { Component, Entity, getComponentValue } from "@dojoengine/recs";
// import { describe, expect, it, vi } from "vitest";
// import * as testedModule from "../useBattles";
// import { getBattle } from "../useBattles";
// import { generateMockBattle } from "./__mock__";

// vi.mock("@dojoengine/recs", async () => {
//   const actual = await vi.importActual("@dojoengine/recs");
//   return {
//     ...actual,
//     getComponentValue: vi.fn(),
//   };
// });

// const mockComponent = {} as Component;

// describe("getBattle", () => {
//   it("should return undefined when there are no battles", () => {
//     vi.mocked(getComponentValue).mockReturnValueOnce(undefined);

//     const battle = getBattle("0x0" as Entity, mockComponent);
//     expect(battle).toBeUndefined();
//   });

//   it("should return a battle for a valid battleEntityId", () => {
//     const mockBattle = generateMockBattle(true, true, false);
//     vi.mocked(getComponentValue).mockReturnValueOnce(mockBattle);

//     const expectedBattle = structuredClone(mockBattle);
//     const precisionFactor = BigInt(EternumGlobalConfig.resources.resourcePrecision);

//     const adjustHealth = (health: { current: bigint; lifetime: bigint }) => {
//       health.current = health.current / precisionFactor;
//       health.lifetime = health.lifetime / precisionFactor;
//     };

//     const battle = getBattle("0x123" as Entity, mockComponent);

//     expect(battle?.attack_army_health.current).toBeLessThan(expectedBattle?.attack_army_health.current);
//     expect(battle?.defence_army_health.current).toBeLessThan(expectedBattle?.defence_army_health.current);

//     adjustHealth(expectedBattle.attack_army_health);
//     adjustHealth(expectedBattle.defence_army_health);

//     expect(getComponentValue).toHaveBeenCalledWith(mockComponent, "0x123");

//     expect(battle).toBeDefined();
//     expect(battle).toStrictEqual(expectedBattle);
//   });
// });

// describe("getExtraBattleInformation", () => {
//   it("should return empty array for empty entity array", () => {
//     const battles = testedModule.getExtraBattleInformation([], mockComponent, mockComponent, mockComponent);
//     expect(battles).toHaveLength(0);
//   });

//   it("should return an empty array if getBattle doesn't return a battle for the entity id", () => {
//     vi.spyOn(testedModule, "getBattle").mockReturnValueOnce(undefined);
//     const battles = testedModule.getExtraBattleInformation(
//       ["0x123" as Entity],
//       mockComponent,
//       mockComponent,
//       mockComponent,
//     );
//     expect(battles).toBeDefined();
//     expect(battles).toHaveLength(0);
//   });

//   it("should return an empty array if entity id doesn't return a position", () => {
//     const mockBattle = generateMockBattle(true, true, false);
//     vi.spyOn(testedModule, "getBattle").mockReturnValueOnce(mockBattle);

//     vi.mocked(getComponentValue).mockReturnValueOnce(undefined);
//     const battles = testedModule.getExtraBattleInformation(
//       ["0x123" as Entity],
//       mockComponent,
//       mockComponent,
//       mockComponent,
//     );
//     expect(battles).toBeDefined();
//     expect(battles).toHaveLength(0);
//   });
// });
