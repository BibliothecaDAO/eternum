/**
 * The docs state a few rules the contracts hold as literals the client schema does not export. Each lives once, in
 * docs/utils/contract-constants.json, beside the line of Cairo it copies: a changed contract fails here, not on a page.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("..", import.meta.url));
const constants = JSON.parse(readFileSync(join(app, "docs/utils/contract-constants.json"), "utf8"));
const source = (file) => readFileSync(join(app, "../../contracts/l3/world-native/src", file), "utf8");

test("every copied contract constant still reads as its Cairo line says", () => {
  for (const { key, file, source: line, value, fixed64 } of constants) {
    assert.ok(source(file).includes(line), `${key}: ${file} no longer holds "${line}"`);
    // A 64.64 fixed-point literal is stored as Cairo writes it, and its value is that literal over 2^64.
    const literal = fixed64 ?? String(value);
    assert.ok(line.includes(literal), `${key}: ${literal} is not the value "${line}" states`);
    if (fixed64) assert.equal(BigInt(fixed64), BigInt(value * 2 ** 64), `${key}: ${fixed64} is not ${value} in 64.64`);
  }
});

test("each constant has one key", () => {
  const keys = constants.map(({ key }) => key);
  assert.deepEqual(keys, [...new Set(keys)]);
});
