import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as processTools from "./process";
import { ALERT_WEBHOOK_RECORD, payoutAlertSteps } from "./payout-alerts";
import { PrivateStore } from "./private-store";
import { runSteps } from "./run";
import { environments, type Environment } from "./settings";
import type { Deployment } from "./main";

// A deliberately fake address; it never leaves the mocked transport.
const webhook = "https://discord.com/api/webhooks/123/fixture-webhook-token";
const temporary: string[] = [];
afterEach(() => {
  mock.restore();
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function deployment(environment: Environment, saved?: string): Deployment {
  const base = mkdtempSync(join(tmpdir(), "payout-alerts-step-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  mkdirSync(join(base, "private"), { mode: 0o700 });
  if (saved !== undefined) writeFileSync(join(base, "private", ALERT_WEBHOOK_RECORD), saved, { mode: 0o600 });
  return {
    environment,
    target: environments[environment],
    store: new PrivateStore(join(base, "private"), join(base, "repo"), false),
    apply: true,
    revision: "a".repeat(40),
    output: () => {},
  };
}
const boxAnswers = (...answers: string[]) =>
  spyOn(processTools, "command").mockImplementation(async () => `${answers.shift()}\n`);

test("dev sends no alerts, so its setup has no alert step", () => {
  expect(payoutAlertSteps(deployment("dev", webhook))).toEqual([]);
});

test("production checks the box with the webhook on standard input only", async () => {
  const box = boxAnswers("installed");
  const [step] = payoutAlertSteps(deployment("production", webhook));
  expect(await step!.inspect()).toMatchObject({ done: true });
  const call = box.mock.calls[0]![0];
  expect(call.input).toBe(webhook);
  expect(call.argv.join(" ")).not.toContain("fixture-webhook-token");
  expect(call.argv).toContain(environments.production.box);
  expect(call.argv.at(-1)).toStartWith("sudo -n python3 -c ");
  expect(call.argv.at(-1)).toEndWith(" inspect");
});

test("setup waits for the co-signer and its current checkout, then installs once and confirms", async () => {
  const lines: string[] = [];
  const context = deployment("production", `${webhook}\n`);
  boxAnswers("no-cosigner");
  expect(await runSteps(payoutAlertSteps(context), true, (line) => lines.push(line))).toBe(false);
  expect(lines.at(-1)).toBe("Install and start the payout co-signer (deploy/athanor/README.md), then run setup again.");
  mock.restore();
  boxAnswers("old-checkout");
  expect(await runSteps(payoutAlertSteps(context), true, (line) => lines.push(line))).toBe(false);
  expect(lines.at(-1)).toBe("Update the co-signer's checkout at /opt/eternum to this commit, then run setup again.");
  mock.restore();
  const box = boxAnswers("missing", "installed", "installed");
  expect(await runSteps(payoutAlertSteps(context), true, () => {})).toBe(true);
  expect(box.mock.calls.map(([call]) => call.argv.at(-1)!.split(" ").at(-1))).toEqual([
    "inspect",
    "install",
    "inspect",
  ]);
  expect(box.mock.calls.every(([call]) => call.input === webhook)).toBe(true);
});

test("setup is done only once Discord accepted the wired message; until then it stays pending and retries", async () => {
  const lines: string[] = [];
  const modes: string[] = [];
  const context = deployment("production", webhook);
  const answer = (...answers: string[]) =>
    spyOn(processTools, "command").mockImplementation(async ({ argv }) => {
      modes.push(argv.at(-1)!.split(" ").at(-1)!);
      return `${answers.shift()}\n`;
    });
  answer("missing", "unconfirmed", "unconfirmed");
  expect(await runSteps(payoutAlertSteps(context), true, (line) => lines.push(line))).toBe(false);
  expect(lines.at(-1)).toBe("Payout alerts is pending; run the same command again.");
  mock.restore();
  answer("unconfirmed", "installed", "installed");
  expect(await runSteps(payoutAlertSteps(context), true, () => {})).toBe(true);
  expect(modes).toEqual(["inspect", "install", "inspect", "inspect", "install", "inspect"]);
});

test("a missing or malformed webhook is refused by name, never by its contents", async () => {
  const box = boxAnswers("installed");
  await expect(payoutAlertSteps(deployment("production"))[0]!.inspect()).rejects.toThrow(
    `Save the owner's Discord webhook as ${ALERT_WEBHOOK_RECORD} in the private directory`,
  );
  const error = await payoutAlertSteps(deployment("production", "https://example.com/hook-secret"))[0]!
    .inspect()
    .catch((caught: Error) => caught);
  expect((error as Error).message).toBe(`${ALERT_WEBHOOK_RECORD} is not a Discord webhook address`);
  expect(box).not.toHaveBeenCalled();
});

test("an unknown answer from the box is refused", async () => {
  boxAnswers("Traceback (most recent call last)");
  await expect(payoutAlertSteps(deployment("production", webhook))[0]!.inspect()).rejects.toThrow(
    "The box answered the payout alert check with an unknown state",
  );
});
