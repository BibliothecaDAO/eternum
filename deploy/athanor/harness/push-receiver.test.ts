import { expect, test } from "bun:test";
import { decryptPush, receivePushes } from "./push-receiver";

// RFC 8291, Appendix A: the worked example's receiver keys, authentication secret and encrypted body.
const bytes = (text: string) => new Uint8Array(Buffer.from(text, "base64url"));
const receiverPublicKey = bytes(
  "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
);

test("decrypts the RFC 8291 example push", async () => {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
      x: Buffer.from(receiverPublicKey.slice(1, 33)).toString("base64url"),
      y: Buffer.from(receiverPublicKey.slice(33)).toString("base64url"),
    },
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const body = bytes(
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
  );
  const plaintext = await decryptPush(body, {
    privateKey,
    publicKey: receiverPublicKey,
    authSecret: bytes("BTBZMqHH6r4Tts7J_aSIgg"),
  });
  expect(new TextDecoder().decode(plaintext)).toBe("When I grow up, I want to be a watermelon");
});

test("keeps its subscription across a dropped connection, receiving what was sent while it reconnected", async () => {
  // A push service that registers, drops the idle connection, and delivers only to a hello that resumes the uaid.
  const hellos: { uaid: string; channelIDs: string[] }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: (request, server) => (server.upgrade(request) ? undefined : new Response("WebSocket only", { status: 400 })),
    websocket: {
      message(socket, data) {
        const message = JSON.parse(String(data));
        if (message.messageType === "hello") {
          hellos.push({ uaid: message.uaid, channelIDs: message.channelIDs });
          socket.send(JSON.stringify({ messageType: "hello", uaid: "uaid-1", status: 200 }));
          if (hellos.length === 2)
            socket.send(JSON.stringify({ messageType: "notification", channelID: message.channelIDs[0], version: "v1" }));
        } else if (message.messageType === "register") {
          socket.send(
            JSON.stringify({ messageType: "register", channelID: message.channelID, status: 200, pushEndpoint: "https://push.test/1" }),
          );
          socket.close();
        }
      },
    },
  });
  const pushes: unknown[] = [];
  const receiver = await receivePushes("BApplicationServerKey", (push) => pushes.push(push.payload), `ws://127.0.0.1:${server.port}`);
  try {
    expect(receiver.subscription.endpoint).toBe("https://push.test/1");
    const deadline = Date.now() + 5_000;
    while (pushes.length === 0 && Date.now() < deadline) await Bun.sleep(50);
    expect(hellos[1]).toMatchObject({ uaid: "uaid-1", channelIDs: [expect.any(String)] });
    expect(pushes).toEqual([null]);
  } finally {
    receiver.close();
    server.stop(true);
  }
});
