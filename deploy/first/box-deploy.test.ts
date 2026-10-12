import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as processTools from "./process";
import { deployShard } from "./box";
import { PublicError } from "./dates";
import { environments } from "./settings";

afterEach(() => mock.restore());

test("the laptop exposes the box's filtered Docker refusal as a public error", async () => {
  const message =
    "Shard deployment stopped at start Herald. failed to create network: all predefined address pools have been fully subnetted";
  spyOn(processTools, "command").mockRejectedValue(
    new processTools.CommandFailure(JSON.stringify({ kind: "shard-deployment-refused", message })),
  );
  const error = await deployShard(environments.dev, "a".repeat(40), "b".repeat(40)).catch((error) => error);
  expect(error).toBeInstanceOf(PublicError);
  expect(error.message).toBe(message);
});

test.each(["private output", JSON.stringify({ message: "private output" })])(
  "unstructured remote failures stay private",
  async (stdout) => {
    spyOn(processTools, "command").mockRejectedValue(new processTools.CommandFailure(stdout));
    await expect(deployShard(environments.dev, "a".repeat(40), "b".repeat(40))).rejects.toThrow(
      "Deployment subprocess failed; no captured output was printed",
    );
  },
);

test("command captures failed stdout for the structured boundary without adding it to the error message", async () => {
  const error = await processTools
    .command({ argv: [process.execPath, "-e", 'process.stdout.write("fixture-output"); process.exit(1)'] })
    .catch((error) => error);
  expect(error).toBeInstanceOf(processTools.CommandFailure);
  expect(error.stdout).toBe("fixture-output");
  expect(error.message).not.toContain("fixture-output");
});

test("the owner sees the public receipt refusal through the same structured deployment path", async () => {
  const message =
    "Shard deployment stopped at self-check. self-check failed at Explore: refused: insufficient stamina, you need: 30, and have: 20 (transaction 0x123); directory status unchanged";
  spyOn(processTools, "command").mockRejectedValue(
    new processTools.CommandFailure(JSON.stringify({ kind: "shard-deployment-refused", message })),
  );
  const error = await deployShard(environments.dev, "a".repeat(40), "b".repeat(40)).catch((error) => error);
  expect(error).toBeInstanceOf(PublicError);
  expect(error.message).toBe(message);
});

test.each([
  "self-check failed at Explore: arbitrary private detail",
  "Shard deployment stopped at self-check. private exception input",
  "Shard deployment stopped at self-check. self-check failed at Explore: refused: line\nbreak (transaction 0x123); directory status unchanged",
  "Shard deployment stopped at self-check. self-check failed at Explore: other: private exception; directory status unchanged",
])("the public self-check path rejects text outside its fixed shape", async (message) => {
  spyOn(processTools, "command").mockRejectedValue(
    new processTools.CommandFailure(JSON.stringify({ kind: "shard-deployment-refused", message })),
  );
  const error = await deployShard(environments.dev, "a".repeat(40), "b".repeat(40)).catch((error) => error);
  expect(error).not.toBeInstanceOf(PublicError);
});
