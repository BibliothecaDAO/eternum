import { describe, expect, it } from "vitest";

import { collapseChanges, OverlayLedger } from "./overlay-ledger";
import type { DecodedRecord, FoldChange, FoldSet } from "./types";

const row = (key: string, value: string): FoldSet => ({ key, model: "TestModel", value: { game_id: "0x7", value } });
const set = (key: string, value: string): FoldChange => ({ gameId: "7", set: row(key, value) });
const chainSet = (key: string, value: string): FoldChange => ({ set: row(key, value) });
const del = (key: string): FoldChange => ({ del: { key, model: "TestModel" }, gameId: "7" });
const nestedSet = (value: DecodedRecord): FoldChange => ({
  gameId: "7",
  set: { key: "0x1", model: "TestModel", value },
});
const noConfirmedRow = () => undefined;

describe("collapseChanges", () => {
  it("keeps one change per row with its last value, in first-appearance order", () => {
    expect(collapseChanges([set("0xabc", "0x1"), set("0xdef", "0x2"), set("0xabc", "0x3")])).toEqual([
      set("0xabc", "0x3"),
      set("0xdef", "0x2"),
    ]);
    expect(collapseChanges([set("0xabc", "0x1"), del("0xabc")])).toEqual([del("0xabc")]);
    expect(collapseChanges([del("0xabc"), set("0xabc", "0x4")])).toEqual([set("0xabc", "0x4")]);
  });
});

describe("OverlayLedger", () => {
  it("keeps only the changes that alter what subscribers hold", () => {
    const ledger = new OverlayLedger();

    expect(ledger.delta([set("0xabc", "0x1"), set("0xdef", "0x2")], noConfirmedRow)).toHaveLength(2);
    expect(ledger.delta([set("0xabc", "0x1"), set("0xdef", "0x3")], noConfirmedRow)).toEqual([set("0xdef", "0x3")]);
    expect(ledger.delta([del("0xabc"), del("0xabc")], noConfirmedRow)).toEqual([del("0xabc")]);
  });

  it("compares row values structurally regardless of key order", () => {
    const ledger = new OverlayLedger();
    ledger.delta([nestedSet({ a: "0x1", b: { c: ["0x2", true] } })], noConfirmedRow);

    expect(ledger.delta([nestedSet({ b: { c: ["0x2", true] }, a: "0x1" })], noConfirmedRow)).toEqual([]);
    expect(ledger.delta([nestedSet({ a: "0x1", b: { c: ["0x2", false] } })], noConfirmedRow)).toHaveLength(1);
    expect(ledger.delta([nestedSet({ a: "0x1", b: { c: { 0: "0x2", 1: false } } })], noConfirmedRow)).toHaveLength(1);
    expect(
      ledger.delta([nestedSet({ a: "0x1", b: { c: { 0: "0x2", 1: false } }, d: null })], noConfirmedRow),
    ).toHaveLength(1);
  });

  it("omits a pending write that repeats the confirmed row and never holds it", () => {
    const ledger = new OverlayLedger();
    const confirmedRow = (_model: string, key: string) => (key === "0xabc" ? row("0xabc", "0x2") : undefined);

    expect(ledger.delta([set("0xabc", "0x2"), set("0xdef", "0x3")], confirmedRow)).toEqual([set("0xdef", "0x3")]);

    ledger.reset();
    expect(ledger.settleReverts(confirmedRow)).toEqual([del("0xdef")]);
  });

  it("reverts rows the rebuilt overlay did not touch to confirmed state", () => {
    const ledger = new OverlayLedger();
    const confirmedRow = (_model: string, key: string) => (key === "0x1" ? row("0x1", "0x0") : undefined);
    ledger.delta([set("0xabc", "0x2"), set("0xdef", "0x4"), chainSet("0x1", "0x5")], confirmedRow);

    ledger.reset();
    expect(ledger.delta([set("0xabc", "0x2"), set("0xdef", "0x6")], confirmedRow)).toEqual([set("0xdef", "0x6")]);
    expect(ledger.settleReverts(confirmedRow)).toEqual([chainSet("0x1", "0x0")]);

    expect(ledger.delta([set("0xabc", "0x2")], confirmedRow)).toEqual([]);
    expect(ledger.settleReverts(confirmedRow)).toEqual([]);
  });

  it("deletes a reverted row the confirmed fold does not hold", () => {
    const ledger = new OverlayLedger();
    ledger.delta([set("0xdef", "0x4")], noConfirmedRow);

    ledger.reset();
    expect(ledger.settleReverts(noConfirmedRow)).toEqual([del("0xdef")]);
  });

  it("keeps a confirmed row off the wire when subscribers already hold its value", () => {
    const ledger = new OverlayLedger();
    ledger.delta([set("0xabc", "0x2"), set("0xdef", "0x4")], noConfirmedRow);

    expect(ledger.settleConfirmed([set("0xabc", "0x2"), set("0xdef", "0x5"), set("0x9", "0x9")])).toEqual([
      set("0xdef", "0x5"),
      set("0x9", "0x9"),
    ]);

    // Confirmed rows are no longer overlay rows: nothing to revert, and a fresh pending value is a real change.
    ledger.reset();
    expect(ledger.settleReverts(noConfirmedRow)).toEqual([]);
    const confirmedRow = (_model: string, key: string) => (key === "0xabc" ? row("0xabc", "0x2") : undefined);
    expect(ledger.delta([set("0xabc", "0x2"), set("0xdef", "0x6")], confirmedRow)).toEqual([set("0xdef", "0x6")]);
  });
});
