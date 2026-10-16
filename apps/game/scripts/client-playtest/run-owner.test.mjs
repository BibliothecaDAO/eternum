import { describe, expect, it } from "vitest";

import { Cancelled, createRunOwner } from "./run-owner.mjs";

describe("createRunOwner", () => {
  it("releases what it holds last-acquired first, awaiting each, and records a failed release", async () => {
    const owner = createRunOwner();
    const order = [];
    owner.adopt("preview", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push("preview");
    });
    owner.adopt("browser", () => {
      throw new Error("already gone");
    });
    owner.adopt("profile", () => order.push("profile"));

    await owner.releaseAll();

    expect(order).toEqual(["profile", "preview"]);
    expect(owner.releaseFailures).toEqual(["browser: already gone"]);
    expect(owner.held()).toEqual([]);
  });

  it("releases a resource once, early or at the end", async () => {
    const owner = createRunOwner();
    let releases = 0;
    const release = owner.adopt("browser", () => (releases += 1));
    await release();
    await owner.releaseAll();
    expect(releases).toBe(1);
  });

  it("stops what waits on a cancel once, at the cancel or at once if already cancelled, unless withdrawn", () => {
    const owner = createRunOwner();
    const stopped = [];
    owner.onCancel(() => stopped.push("build"));
    const withdraw = owner.onCancel(() => stopped.push("withdrawn"));
    withdraw();
    owner.cancel("SIGTERM");
    owner.cancel("SIGINT");
    owner.onCancel(() => stopped.push("late"));
    expect(stopped).toEqual(["build", "late"]);
  });

  it("wakes a sleeping run when cancelled and throws at the next checkpoint", async () => {
    const owner = createRunOwner();
    const started = Date.now();
    const sleeping = owner.sleep(10_000);
    owner.cancel("SIGINT");
    await expect(sleeping).rejects.toThrow(Cancelled);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(() => owner.throwIfCancelled()).toThrow("cancelled: SIGINT");
  });
});
