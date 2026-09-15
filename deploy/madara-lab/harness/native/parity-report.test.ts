import { describe, expect, test } from "bun:test";
import { parseWorldParity, requiredParityCases } from "./parity-report";

const felt = (value: string) => BigInt(`0x${Buffer.from(value).toString("hex")}`).toString();
function trace(): string {
  return Object.entries(requiredParityCases)
    .map(([name, method]) => {
      const id = `${felt(name)} 1 ${felt("Resource")} 123`;
      return [
        `FACT_SNAPSHOT ${id} 1 2`,
        `FACT_VALUE ${id} 0 1 1`,
        `FACT_VALUE ${id} 1 99 99`,
        `[PASS] eternum::native_parity::${method} (l2_gas: ~12)`,
      ].join("\n");
    })
    .join("\n");
}

describe("world parity report", () => {
  test("collects interleaved facts without mixing cases", () => {
    const lines = trace().split("\n");
    const headers = lines.filter((line) => line.startsWith("FACT_SNAPSHOT"));
    const rest = lines.filter((line) => !line.startsWith("FACT_SNAPSHOT")).reverse();
    const result = parseWorldParity([...headers, ...rest].join("\n"));
    expect(result).toHaveLength(Object.keys(requiredParityCases).length);
    expect(result.every((item) => item.facts[0].value[0] === "0x63")).toBe(true);
  });
  test("records exact root consumption and rejects an extra increment", () => {
    const frame = `PARITY_ROOT ${felt("surface")} 2 36 1468`;
    expect(parseWorldParity(`${trace()}\n${frame}`).find((item) => item.name === "surface")?.roots[0].rawRoot).toBe(
      "0x24",
    );
    expect(() => parseWorldParity(`${trace()}\n${frame.replace("1468", "2900")}`)).toThrow(
      "Invalid randomness consumption",
    );
  });
  test("rejects missing members despite passing test markers", () => {
    expect(() => parseWorldParity(trace().replace(/^FACT_VALUE .* 1 99 99\n/m, ""))).toThrow("Incomplete facts");
  });
  test("rejects unexplained fact differences", () => {
    expect(() => parseWorldParity(trace().replace("1 99 99", "1 99 98"))).toThrow("Gameplay divergence");
  });
  test("rejects missing cases", () => {
    expect(() => parseWorldParity(trace().replace(/^\[PASS\].*\n/m, ""))).toThrow("Missing passing parity case");
  });
  test("rejects a conflicting repeated snapshot", () => {
    const duplicate = `FACT_VALUE ${felt("creation")} 1 ${felt("Resource")} 123 1 98 98`;
    expect(() => parseWorldParity(`${trace()}\n${duplicate}`)).toThrow("Conflicting fact value");
  });
});
