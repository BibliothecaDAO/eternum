import { Login } from "@/components/modules/governance/sign-in-with-starknet";
import { useAppSession } from "@/utils/session";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/start";
import { getHeader } from "@tanstack/start/server";
import { RpcProvider } from "starknet";

import { SiwsTypedData } from "@realms-world/siws";

//import { hashPassword, prismaClient } from '~/utils/prisma'

export const loginFn = createServerFn()
  .validator(
    (d) => d as { credentials: { message: string; signature: string[] } },
  )
  .handler(async ({ data }) => {
    // Generate a CSRF token for this transaction.
    console.log(getHeader("host"));
    const csrf = "0x0x9e9eew";

    // Optionally, you might want to store the CSRF token in the session
    // to validate it later. For example:
    // const session = await useAppSession();

    const signindata = SiwsTypedData.fromJson(data.credentials.message);
    const chainId = signindata.domain.chainId;

    const mainProvider = new RpcProvider({
      nodeUrl: "https://starknet-mainnet.public.blastapi.io",
    });

    const result = await signindata.verify(
      {
        signature: data.credentials.signature,
        domain: getHeader("host") ?? "http://localhost:3000",
        nonce: csrf,
        network: chainId,
      },
      { provider: mainProvider as any },
    );
    console.log(result);
    if (result.success) {
      return {
        id: signindata.message.address,
      };
    }

    // Create a session
    const session = await useAppSession();

    // Store the user's email in the session
    await session.update({
      address: user.email,
    });
  });

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context }) => {
    if (!context.session.address) {
      throw new Error("Not authenticated");
    }
  },
  errorComponent: ({ error }) => {
    if (error.message === "Not authenticated") {
      return <Login />;
    }

    throw error;
  },
});
