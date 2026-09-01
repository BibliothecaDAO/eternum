import { describe, expect, it } from "vitest";

import { OverlayLedger } from "./overlay-ledger";
import type { DecodedRecord, FoldChange, FoldSet } from "./types";

const row = (key: string, value: string): FoldSet => ({ key, model: "TestModel", value: { game_id: "0x7", value } });
const set = (key: string, value: string): FoldChange => ({ gameId: "7", set: row(key, value) });
const chainSet = (key: string, value: string): FoldChange => ({ set: row(key, value) });
const del = (key: string): FoldChange => ({ del: { key, model: "TestModel" }, gameId: "7" });
const nestedSet = (value: DecodedRecord): FoldChange => ({
  gameId: "7",
  set: { key: "0x1", model: "TestModel", value },
});

describe("OverlayLedger", () => {
  it("keeps only the changes that alter what subscribers hold", () => {
    const ledger = new OverlayLedger();

    expect(ledger.delta([set("0xabc", "0x1"), set("0xdef", "0x2")])).toHaveLength(2);
    expect(ledger.delta([set("0xabc", "0x1"), set("0xdef", "0x3")])).toEqual([set("0xdef", "0x3")]);
    expect(ledger.delta([del("0xabc"), del("0xabc")])).toEqual([del("0xabc")]);
  });

  it("compares row values structurally regardless of key order", () => {
    const ledger = new OverlayLedger();
    ledger.delta([nestedSet({ a: "0x1", b: { c: ["0x2", true] } })]);

    expect(ledger.delta([nestedSet({ b: { c: ["0x2", true] }, a: "0x1" })])).toEqual([]);
    expect(ledger.delta([nestedSet({ a: "0x1", b: { c: ["0x2", false] } })])).toHaveLength(1);
    expect(ledger.delta([nestedSet({ a: "0x1", b: { c: { 0: "0x2", 1: false } } })])).toHaveLength(1);
    expect(ledger.delta([nestedSet({ a: "0x1", b: { c: { 0: "0x2", 1: false } }, d: null })])).toHaveLength(1);
  });

  it("reverts rows the rebuilt overlay did not touch to confirmed state", () => {
    const ledger = new OverlayLedger();
    const confirmedRow = (_model: string, key: string) => (key === "0x1" ? row("0x1", "0x0") : undefined);
    ledger.delta([set("0xabc", "0x2"), set("0xdef", "0x4"), chainSet("0x1", "0x5")]);

    ledger.reset();
    expect(ledger.delta([set("0xabc", "0x2"), set("0xdef", "0x6")])).toEqual([set("0xdef", "0x6")]);
    expect(ledger.settleReverts(confirmedRow)).toEqual([chainSet("0x1", "0x0")]);

    expect(ledger.delta([set("0xabc", "0x2")])).toEqual([]);
    expect(ledger.settleReverts(confirmedRow)).toEqual([]);
  });

  it("deletes a reverted row the confirmed fold does not hold", () => {
    const ledger = new OverlayLedger();
    ledger.delta([set("0xdef", "0x4")]);

    ledger.reset();
    expect(ledger.settleReverts(() => undefined)).toEqual([del("0xdef")]);
  });

  it("forgets a row once a confirmed diff carries it", () => {
    const ledger = new OverlayLedger();
    ledger.delta([set("0xabc", "0x2")]);
    ledger.forgetConfirmed([set("0xabc", "0x3")]);

    ledger.reset();
    expect(ledger.delta([set("0xabc", "0x2")])).toEqual([set("0xabc", "0x2")]);
    expect(ledger.settleReverts(() => undefined)).toEqual([]);
  });
});
