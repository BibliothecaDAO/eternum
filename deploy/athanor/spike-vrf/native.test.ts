import { expect, test } from "bun:test";
import { feltBytes, NativeProver } from "./native";

// Public upstream known-answer fixture; never used as a deployed credential.
const key = () => feltBytes("190");
const expectedRoot = 1749760720107131022781690892024891617311129198096286233628341005792224087740n;
const expectedGamma = [1506339363762384048749124975867331702319430609263271304275332020910807468800n, 36259598506905210600179635686591002688831785399437338349196739602416217657n];

test("native construction matches the independent Cairo known-answer vector", () => {
  const prover = new NativeProver(key());
  try {
    const result = prover.proofs(["42"])[0];
    expect(result.slice(0, 2).map(BigInt)).toEqual(expectedGamma);
    expect(BigInt(result[5])).toBe(expectedRoot);
    expect(prover.publicKey().map(BigInt)).toEqual([
      2465182048640915825114623967805639036884813714770257338089158027381626459289n,
      3038635738014387716559859267483610492356329532552881764846792983975787300333n,
    ]);
  } finally { prover.close(); }
});

test("threads preserve proof bytes and input order, including distinct seeds", () => {
  const prover = new NativeProver(key());
  try {
    const seeds = Array.from({ length: 12 }, (_, index) => String(index + 42));
    const expected = prover.proofs(seeds, 1);
    expect(new Set(expected.map((value) => value[5])).size).toBe(seeds.length);
    expect(prover.proofs(seeds, 2)).toEqual(expected);
    expect(prover.proofs(seeds, 4)).toEqual(expected);
  } finally { prover.close(); }
});

test("bad inputs fail closed and a closed native handle cannot be used", () => {
  const prover = new NativeProver(key());
  expect(() => prover.proofs([])).toThrow("1..4096");
  expect(() => prover.proofs(["-1"])).toThrow("Noncanonical");
  prover.close();
  expect(() => prover.publicKey()).toThrow("closed");
  expect(() => prover.proofs(["42"])).toThrow("closed");
  const zero = new NativeProver(feltBytes("0"));
  try { expect(() => zero.publicKey()).toThrow("failed (2)"); }
  finally { zero.close(); }
});
