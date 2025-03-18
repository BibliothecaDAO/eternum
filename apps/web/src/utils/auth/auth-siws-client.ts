import type { BetterAuthClientPlugin } from "better-auth";

import type { siws } from "./auth-siws-plugin";

type SignInWithStarknetPlugin = typeof siws;

export const siwsClientPlugin = () => {
  return {
    id: "sign-in-with-starknet",
    $InferServerPlugin: {} as ReturnType<SignInWithStarknetPlugin>,
  } satisfies BetterAuthClientPlugin;
};
