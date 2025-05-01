import type { TypedDocumentString } from "./graphql";

export async function execute<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
): Promise<TResult> {
  const fetchUrl = import.meta.env.VITE_PUBLIC_TORII + "/graphql";
  const response = await fetch(fetchUrl, {
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

  const json = await response.json();

  if ("data" in json) {
    return json.data as TResult;
  }

  throw new Error("No data returned from GraphQL");
}
