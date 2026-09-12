import assert from "node:assert/strict";

export const NOTIFICATION_FIXTURE_PATH = "/play/madara/notification-check/map";

/** Uses the emitted worker, native notifications and real IndexedDB; the page has no game backend dependencies. */
export async function verifyLocalNotifications(browser, origin) {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  await context.grantPermissions(["notifications"], { origin });
  try {
    const first = await context.newPage();
    await first.goto(origin + NOTIFICATION_FIXTURE_PATH);
    await first.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
    });
    const second = await context.newPage();
    await second.goto(origin + NOTIFICATION_FIXTURE_PATH);
    const device = (await command(first, "enable")).value;
    const createdAt = Date.now();
    const payload = {
      version: 1,
      id: "browser-race",
      owner: "0x1",
      title: "Realms test",
      body: "Local notification verification",
      target: "/enter/madara/notification-check",
      createdAt,
      expiresAt: createdAt + 120_000,
    };
    const input = { token: device.token, payload };
    // Manual tests share the same durable delivery path but are intentionally allowed while the page is focused.
    const replies = await Promise.all([command(first, "test", input), command(second, "test", input)]);
    assert.deepEqual(replies.map((reply) => reply.value).sort(), ["shown", "suppressed"], JSON.stringify(replies));
    assert.equal(await closeNotifications(first), 1);
    assert.equal((await command(second, "test", input)).value, "suppressed", "Dismissal must not permit replay");

    const cdp = await context.newCDPSession(first);
    await cdp.send("ServiceWorker.enable");
    await cdp.send("ServiceWorker.stopAllWorkers");
    assert.equal((await command(first, "test", input)).value, "suppressed", "Worker restart must retain delivery IDs");
    assert.equal(await closeNotifications(first), 0);

    assert.equal(
      (await command(first, "test", { ...input, payload: { ...payload, expiresAt: Date.now() - 1 } })).ok,
      false,
    );
    await command(first, "disable");
    assert.equal(
      (await command(first, "test", { ...input, payload: { ...payload, id: "disabled" } })).value,
      "suppressed",
    );
    const replacement = (await command(second, "enable")).value;
    assert.notEqual(replacement.token, device.token);
    assert.equal(
      (await command(first, "test", { ...input, payload: { ...payload, id: "old-token", createdAt: Date.now() } }))
        .value,
      "suppressed",
    );
    await command(first, "disable");
    return {
      nativeNotifications: true,
      tabRace: true,
      dismissalReplay: true,
      workerRestart: true,
      expiry: true,
      disable: true,
      staleToken: true,
    };
  } finally {
    await context.close();
  }
}

async function command(page, action, input = {}) {
  return page.evaluate(
    async ({ action, input }) => {
      const registration = await navigator.serviceWorker.ready;
      return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => {
          channel.port1.close();
          reject(new Error("Notification worker response timed out"));
        }, 10_000);
        channel.port1.onmessage = ({ data }) => {
          clearTimeout(timeout);
          channel.port1.close();
          resolve(data);
        };
        registration.active.postMessage({ type: "GAME_NOTIFICATION", owner: "0x1", action, ...input }, [channel.port2]);
      });
    },
    { action, input },
  );
}

async function closeNotifications(page) {
  return page.evaluate(async () => {
    const notifications = await (await navigator.serviceWorker.ready).getNotifications();
    for (const notification of notifications) notification.close();
    return notifications.length;
  });
}
