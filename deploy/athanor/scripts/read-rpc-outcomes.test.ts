import { afterEach, expect, spyOn, test } from "bun:test";
import { hash } from "starknet";
import { identity, invoke } from "../vrf/fixtures";
import { STAMP_TAG, type PlayInvoke } from "../vrf/transaction";
import { startReadRpc } from "./read-rpc";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function fixture(
  options: {
    stampFails?: boolean;
    admissionFails?: boolean;
    forwardWait?: Promise<void>;
    accountClass?: string;
    stampWait?: Promise<void>;
    admissionWait?: Promise<void>;
    stampStarted?: () => void;
  } = {},
) {
  const writes: unknown[] = [];
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = await request.json();
      if (call.method === "starknet_getNonce" || call.method === "starknet_getClassHashAt") {
        await options.admissionWait;
        if (options.admissionFails) return Response.json({ error: { code: 99, data: "internal diagnostic" } });
        return Response.json({
          result: call.method === "starknet_getNonce" ? "0x0" : (options.accountClass ?? identity.accountClassHash),
        });
      }
      writes.push(call);
      await options.forwardWait;
      return Response.json({ jsonrpc: "2.0", id: call.id, result: { transaction_hash: "0x777" } });
    },
  });
  const stamper = {
    async stamp(_transaction: PlayInvoke) {
      options.stampStarted?.();
      await options.stampWait;
      if (options.stampFails) throw new Error("internal stamping diagnostic");
      return { transactionHash: "0x777", suffix: [STAMP_TAG, "0x1", "0x2", "0x3", "0x4", "0x5"] };
    },
  };
  const proxy = startReadRpc(node.url.origin, 0, identity, stamper, undefined, "127.0.0.1");
  return {
    writes,
    node,
    proxy,
    call(method: string, params: unknown, id = 42) {
      return originalFetch(proxy.url, {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      }).then((response) => response.json());
    },
    intercept(answer: (call: { method: string; id: number }) => Promise<Response>) {
      return spyOn(globalThis, "fetch").mockImplementation((async (url, init) => {
        if (new URL(String(url)).origin !== node.url.origin) return originalFetch(url, init);
        const call = JSON.parse(String(init?.body));
        if (call.id === 1 && (call.method === "starknet_getNonce" || call.method === "starknet_getClassHashAt"))
          return originalFetch(url, init);
        writes.push(call);
        return answer(call);
      }) as typeof fetch);
    },
    close() {
      proxy.stop(true);
      node.stop(true);
    },
  };
}

test("a failed stamp or private preflight refuses before any write reaches the node", async () => {
  for (const options of [{ stampFails: true }, { admissionFails: true }, { accountClass: "0x999" }]) {
    const f = await fixture(options);
    try {
      expect(await f.call("starknet_addInvokeTransaction", [invoke()])).toEqual({
        jsonrpc: "2.0",
        id: 42,
        error: { code: -32010, message: "Transaction refused" },
      });
      expect(f.writes).toHaveLength(0);
    } finally {
      f.close();
    }
  }
});

for (const [name, answer] of [
  [
    "lost response",
    async () => {
      throw new TypeError("fetch failed");
    },
  ],
  [
    "timeout",
    async () => {
      throw new DOMException("timed out", "TimeoutError");
    },
  ],
  ["unparsable response", async () => new Response("not JSON")],
  ["missing hash", async () => Response.json({ jsonrpc: "2.0", id: 42, result: {} })],
  ["mismatching hash", async () => Response.json({ jsonrpc: "2.0", id: 42, result: { transaction_hash: "0x888" } })],
  ["mismatching id", async () => Response.json({ jsonrpc: "2.0", id: 43, result: { transaction_hash: "0x777" } })],
  [
    "node error with proof data",
    async () =>
      Response.json({
        jsonrpc: "2.0",
        id: 42,
        error: { code: 55, message: "internal diagnostic", data: { signature: [STAMP_TAG, "0x9"] } },
      }),
  ],
  [
    "HTTP failure with a hash",
    async () => Response.json({ jsonrpc: "2.0", id: 42, result: { transaction_hash: "0x777" } }, { status: 503 }),
  ],
] as const) {
  test(`a forwarded play's ${name} is unknown with only its expected hash`, async () => {
    const f = await fixture();
    const intercepted = f.intercept(answer);
    try {
      expect(await f.call("starknet_addInvokeTransaction", [invoke()])).toEqual({
        jsonrpc: "2.0",
        id: 42,
        error: { code: -32011, message: "Transaction outcome unknown", data: { transaction_hash: "0x777" } },
      });
      expect(f.writes).toHaveLength(1);
    } finally {
      intercepted.mockRestore();
      f.close();
    }
  });
}

test("an ambiguous unstamped administrative write omits the unknown hash", async () => {
  const f = await fixture();
  const intercepted = f.intercept(async () => {
    throw new TypeError("response lost");
  });
  try {
    const transaction = {
      ...invoke(),
      calldata: ["0x1", identity.games, hash.getSelectorFromName("create_game"), "0x1", "0x1"],
    };
    expect(await f.call("starknet_addInvokeTransaction", [transaction])).toEqual({
      jsonrpc: "2.0",
      id: 42,
      error: { code: -32011, message: "Transaction outcome unknown" },
    });
  } finally {
    intercepted.mockRestore();
    f.close();
  }
});

for (const method of ["starknet_getTransactionStatus", "starknet_getTransactionReceipt"]) {
  test(`${method} preserves a successful not-found answer but discards diagnostics`, async () => {
    const f = await fixture();
    const intercepted = f.intercept(async () =>
      Response.json({
        jsonrpc: "2.0",
        id: 42,
        error: { code: 29, message: "internal diagnostic", data: { signature: [STAMP_TAG] } },
      }),
    );
    try {
      expect(await f.call(method, ["0x777"])).toEqual({
        jsonrpc: "2.0",
        id: 42,
        error: { code: 29, message: "Transaction hash not found" },
      });
    } finally {
      intercepted.mockRestore();
      f.close();
    }
  });
  test(`${method} never converts a failed read into not found`, async () => {
    const f = await fixture();
    try {
      for (const answer of [
        async () => {
          throw new TypeError("fetch failed");
        },
        async () => {
          throw new DOMException("timed out", "TimeoutError");
        },
        async () => new Response("not JSON"),
        async () => Response.json({ error: { code: 29, message: "ignored" } }, { status: 503 }),
        async () => Response.json({ result: "0x1", error: { code: 29 } }),
        async () => Response.json({ error: { code: 99, data: [STAMP_TAG] } }),
        async () => Response.json({}),
      ]) {
        const intercepted = f.intercept(answer);
        try {
          expect(await f.call(method, ["0x777"])).toEqual({
            jsonrpc: "2.0",
            id: 42,
            error: { code: -32012, message: "RPC read unavailable" },
          });
        } finally {
          intercepted.mockRestore();
        }
      }
    } finally {
      f.close();
    }
  });
}

test("ordinary read not-found kinds retain their codes without backend data", async () => {
  const f = await fixture();
  try {
    for (const [code, message] of [
      [20, "Contract not found"],
      [24, "Block not found"],
      [28, "Class hash not found"],
    ] as const) {
      const intercepted = f.intercept(async () =>
        Response.json({ jsonrpc: "2.0", id: 42, error: { code, message: "ignored", data: [STAMP_TAG] } }),
      );
      try {
        expect((await f.call("starknet_getClassHashAt", ["latest", "0x1"])).error).toEqual({ code, message });
      } finally {
        intercepted.mockRestore();
      }
    }
  } finally {
    f.close();
  }
});

test("an unavailable account-class lookup refuses the whole batch before forwarding", async () => {
  const f = await fixture({ admissionFails: true });
  try {
    const transaction = {
      ...invoke(),
      calldata: ["0x1", invoke().sender_address, hash.getSelectorFromName("revoke_device"), "0x3", "0x1", "0x2", "0x3"],
    };
    expect(await f.call("starknet_addInvokeTransaction", [transaction])).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32010, message: "Transaction refused" },
    });
    expect(f.writes).toHaveLength(0);
  } finally {
    f.close();
  }
});

test("the forward timeout is ambiguous even after the node received the write", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  const timed = spyOn(AbortSignal, "timeout").mockImplementation((ms) => timeout(ms === 5000 ? 20 : ms));
  const f = await fixture({ forwardWait: waiting });
  try {
    expect(await f.call("starknet_addInvokeTransaction", [invoke()])).toEqual({
      jsonrpc: "2.0",
      id: 42,
      error: { code: -32011, message: "Transaction outcome unknown", data: { transaction_hash: "0x777" } },
    });
    expect(f.writes).toHaveLength(1);
  } finally {
    timed.mockRestore();
    release();
    f.close();
  }
});

test("one ambiguous batch write does not erase its successful sibling", async () => {
  const f = await fixture();
  const intercepted = f.intercept(async (call) => {
    if (call.id === 43) throw new TypeError("response lost");
    return Response.json({ jsonrpc: "2.0", id: call.id, result: { transaction_hash: "0x777" } });
  });
  try {
    const response = await originalFetch(f.proxy.url, {
      method: "POST",
      body: JSON.stringify(
        [invoke(), { ...invoke(), sender_address: "0x43" }].map((transaction, index) => ({
          jsonrpc: "2.0",
          id: 42 + index,
          method: "starknet_addInvokeTransaction",
          params: [transaction],
        })),
      ),
    });
    expect(await response.json()).toEqual([
      { jsonrpc: "2.0", id: 42, result: { transaction_hash: "0x777" } },
      {
        jsonrpc: "2.0",
        id: 43,
        error: { code: -32011, message: "Transaction outcome unknown", data: { transaction_hash: "0x777" } },
      },
    ]);
    expect(f.writes).toHaveLength(2);
  } finally {
    intercepted.mockRestore();
    f.close();
  }
});

test("a malformed or mismatching read reply is unavailable, never positive absence", async () => {
  const f = await fixture();
  try {
    for (const answer of [
      { jsonrpc: "2.0", id: 99, error: { code: 29 } },
      { jsonrpc: "1.0", id: 42, error: { code: 29 } },
      { jsonrpc: "2.0", id: 42, error: { code: 25 } },
      { jsonrpc: "2.0", id: 42, error: { code: "29" } },
      null,
    ]) {
      const intercepted = f.intercept(async () => Response.json(answer));
      try {
        expect((await f.call("starknet_getTransactionStatus", ["0x777"])).error).toEqual({
          code: -32012,
          message: "RPC read unavailable",
        });
      } finally {
        intercepted.mockRestore();
      }
    }
    const intercepted = f.intercept(async () => Response.json({ jsonrpc: "2.0", id: 42, error: { code: 29 } }));
    try {
      expect((await f.call("starknet_getEvents", [])).error).toEqual({ code: -32012, message: "RPC read unavailable" });
    } finally {
      intercepted.mockRestore();
    }
  } finally {
    f.close();
  }
});

test("forwarded account management is unknown, and a failed estimate is only a read failure", async () => {
  const f = await fixture();
  const intercepted = f.intercept(async () => {
    throw new TypeError("response lost");
  });
  const transaction = {
    ...invoke(),
    calldata: ["0x1", invoke().sender_address, hash.getSelectorFromName("revoke_device"), "0x3", "0x1", "0x2", "0x3"],
  };
  const deploy = {
    type: "DEPLOY_ACCOUNT",
    version: "0x3",
    tip: "0x0",
    class_hash: identity.accountClassHash,
    constructor_calldata: ["0x42", identity.guardianPublicKey],
    contract_address_salt: "0x42",
    signature: ["0x1", "0x2", "0x3", "0x4", "0x5"],
  };
  try {
    for (const [method, params] of [
      ["starknet_addInvokeTransaction", [transaction]],
      ["starknet_addDeployAccountTransaction", [deploy]],
    ] as const)
      expect((await f.call(method, params)).error).toEqual({ code: -32011, message: "Transaction outcome unknown" });
    expect((await f.call("starknet_estimateFee", [[transaction], [], "pre_confirmed"])).error).toEqual({
      code: -32012,
      message: "RPC read unavailable",
    });
  } finally {
    intercepted.mockRestore();
    f.close();
  }
});

for (const phase of ["admission", "preflight", "stamp"] as const) {
  test(`the preparation deadline bounds ${phase} and discards a late completion`, async () => {
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const timed = spyOn(AbortSignal, "timeout").mockImplementation((ms) => timeout(ms === 2000 ? 30 : ms));
    const f = await fixture(phase === "stamp" ? { stampWait: waiting } : { admissionWait: waiting });
    try {
      const transaction =
        phase !== "admission"
          ? invoke()
          : {
              ...invoke(),
              calldata: [
                "0x1",
                invoke().sender_address,
                hash.getSelectorFromName("revoke_device"),
                "0x3",
                "0x1",
                "0x2",
                "0x3",
              ],
            };
      expect((await f.call("starknet_addInvokeTransaction", [transaction])).error).toEqual({
        code: -32010,
        message: "Transaction refused",
      });
      release();
      await Bun.sleep(20);
      expect(f.writes).toHaveLength(0);
      timed.mockRestore();
      expect((await f.call("starknet_addInvokeTransaction", [invoke()])).result).toEqual({ transaction_hash: "0x777" });
    } finally {
      timed.mockRestore();
      release();
      f.close();
    }
  });
}

test("disconnecting while a stamp is queued never forwards its late result", async () => {
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const stamping = new Promise<void>((resolve) => {
    started = resolve;
  });
  const f = await fixture({ stampWait: waiting, stampStarted: started });
  const controller = new AbortController();
  try {
    const sent = originalFetch(f.proxy.url, {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({ jsonrpc: "2.0", id: 42, method: "starknet_addInvokeTransaction", params: [invoke()] }),
    }).catch(() => undefined);
    await stamping;
    controller.abort();
    await sent;
    await Bun.sleep(30);
    release();
    await Bun.sleep(30);
    expect(f.writes).toHaveLength(0);
    expect((await f.call("starknet_addInvokeTransaction", [invoke()])).result).toEqual({ transaction_hash: "0x777" });
  } finally {
    release();
    f.close();
  }
});

for (const method of ["starknet_estimateFee", "starknet_estimateMessageFee"]) {
  test(`${method} distinguishes deterministic refusal without leaking diagnostics`, async () => {
    const f = await fixture();
    const transaction = {
      ...invoke(),
      calldata: ["0x1", invoke().sender_address, hash.getSelectorFromName("revoke_device"), "0x3", "0x1", "0x2", "0x3"],
    };
    const params = method === "starknet_estimateFee" ? [[transaction], [], "pre_confirmed"] : [];
    try {
      for (const code of [-32602, 21, 40, 41, 52, 53, 54, 55, 58, 61, 64, 65, 69]) {
        const intercepted = f.intercept(async () =>
          Response.json({
            jsonrpc: "2.0",
            id: 42,
            error: { code, message: "internal diagnostic", data: { signature: [STAMP_TAG] } },
          }),
        );
        try {
          expect((await f.call(method, params)).error).toEqual({ code: -32013, message: "Estimate refused" });
        } finally {
          intercepted.mockRestore();
        }
      }
      for (const code of [20, 24, 28]) {
        const intercepted = f.intercept(async () => Response.json({ jsonrpc: "2.0", id: 42, error: { code } }));
        try {
          expect((await f.call(method, params)).error.code).toBe(code);
        } finally {
          intercepted.mockRestore();
        }
      }
      for (const answer of [
        { jsonrpc: "2.0", id: 42, error: { code: 63 } },
        { jsonrpc: "2.0", id: 42, error: { code: -32603 } },
        { jsonrpc: "2.0", id: 42, error: { code: 99 } },
        { jsonrpc: "2.0", id: 42, error: { code: "41" } },
        { jsonrpc: "2.0", id: 43, error: { code: 41 } },
        { jsonrpc: "2.0", id: 42, result: [], error: { code: 41 } },
      ]) {
        const intercepted = f.intercept(async () => Response.json(answer));
        try {
          expect((await f.call(method, params)).error).toEqual({ code: -32012, message: "RPC read unavailable" });
        } finally {
          intercepted.mockRestore();
        }
      }
      const intercepted = f.intercept(async () =>
        Response.json({ jsonrpc: "2.0", id: 42, error: { code: 41 } }, { status: 503 }),
      );
      try {
        expect((await f.call(method, params)).error).toEqual({ code: -32012, message: "RPC read unavailable" });
      } finally {
        intercepted.mockRestore();
      }
    } finally {
      f.close();
    }
  });
}

test("a deterministic execution error on an ordinary read remains read unavailable", async () => {
  const f = await fixture();
  const intercepted = f.intercept(async () => Response.json({ jsonrpc: "2.0", id: 42, error: { code: 41 } }));
  try {
    expect((await f.call("starknet_call", [])).error).toEqual({ code: -32012, message: "RPC read unavailable" });
  } finally {
    intercepted.mockRestore();
    f.close();
  }
});
