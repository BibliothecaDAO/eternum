import type { TypedDocumentString } from "@/gql/graphql";

export async function executeTorii<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const response = await fetch("https://api.cartridge.gg/x/eternum-prod/torii/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/graphql-response+json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const result = (await response.json()) as { data: TResult };
  return result.data;
} 