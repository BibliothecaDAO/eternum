import { expect, test } from "bun:test";

// A subprocess makes the real fatal exit observable without replacing process.exit.
test("a worker crash exits the proxy process for supervisor recovery", async () => {
  const script = `
    import { startStampPool } from ${JSON.stringify(new URL("./pool.ts", import.meta.url).href)};
    import { identity, invoke } from ${JSON.stringify(new URL("./fixtures.ts", import.meta.url).href)};
    globalThis.Worker = class {
      postMessage(message) {
        if (message.kind === "start")
          queueMicrotask(() => this.onmessage({ data: { kind: "ready", publicKey: identity.vrfPublicKey } }));
        else queueMicrotask(() => this.onerror({ preventDefault() {} }));
      }
      terminate() {}
    };
    const pool = await startStampPool("unused", identity, 2);
    console.log("ready");
    await pool.stamp(invoke()).catch(() => {});
    process.exit(0);
  `;
  const child = Bun.spawn([process.execPath, "--eval", script], { stdout: "pipe", stderr: "pipe" });
  expect(await new Response(child.stdout).text()).toBe("ready\n");
  expect(await child.exited).toBe(1);
});
