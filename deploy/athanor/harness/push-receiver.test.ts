import { expect, test } from "bun:test";
import { decryptPush } from "./push-receiver";

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
