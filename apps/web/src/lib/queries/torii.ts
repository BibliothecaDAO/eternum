import type { TypedDocumentString } from "@/gql/graphql";
import { env } from "env";

export async function executeTorii<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const response = await fetch(
    (env.VITE_TORII_API_URL ??
      "https://api.cartridge.gg/x/eternum-empire-mainnet-2/torii") + "/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/graphql-response+json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const result = (await response.json()) as { data: TResult };
  return result.data;
}
