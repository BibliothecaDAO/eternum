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
      addEventListener() {}
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

for (const exit of ["process.exit(0)", "self.close()", "self.onmessage = null"]) {
  test(`a worker ending with ${exit} exits the proxy`, async () => {
    const script = `
      import { startStampPool } from ${JSON.stringify(new URL("./pool.ts", import.meta.url).href)};
      import { identity, invoke } from ${JSON.stringify(new URL("./fixtures.ts", import.meta.url).href)};
      const RealWorker = globalThis.Worker;
      const source = new Blob([\`
        self.onmessage = ({ data }) => {
          if (data.kind === "start") postMessage({ kind: "ready", publicKey: \${JSON.stringify(identity.vrfPublicKey)} });
          else { ${exit} }
        };
      \`], { type: "application/javascript" });
      globalThis.Worker = class extends RealWorker {
        constructor() { super(URL.createObjectURL(source)); }
      };
      const pool = await startStampPool("unused", identity, 1);
      console.log("ready");
      const timeout = setTimeout(() => process.exit(2), 2000);
      await pool.stamp(invoke()).catch(() => {});
      clearTimeout(timeout);
      process.exit(0);
    `;
    const child = Bun.spawn([process.execPath, "--eval", script], { stdout: "pipe", stderr: "pipe" });
    expect(await new Response(child.stdout).text()).toBe("ready\n");
    expect(await child.exited).toBe(1);
  });
}

test("closing the pool deliberately does not exit the proxy", async () => {
  const script = `
    import { startStampPool } from ${JSON.stringify(new URL("./pool.ts", import.meta.url).href)};
    import { identity } from ${JSON.stringify(new URL("./fixtures.ts", import.meta.url).href)};
    const RealWorker = globalThis.Worker;
    const source = new Blob([\`
      self.onmessage = () => postMessage({ kind: "ready", publicKey: \${JSON.stringify(identity.vrfPublicKey)} });
    \`], { type: "application/javascript" });
    globalThis.Worker = class extends RealWorker {
      constructor() { super(URL.createObjectURL(source)); }
    };
    const pool = await startStampPool("unused", identity, 2);
    pool.close();
    await Bun.sleep(50);
    console.log("closed");
  `;
  const child = Bun.spawn([process.execPath, "--eval", script], { stdout: "pipe", stderr: "pipe" });
  expect(await new Response(child.stdout).text()).toBe("closed\n");
  expect(await child.exited).toBe(0);
});
