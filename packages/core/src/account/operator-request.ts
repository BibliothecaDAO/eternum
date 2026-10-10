/** Operator credentials travel only to HTTPS endpoints and never follow redirects. */
export function operatorRequest(
  url: string,
  token: string,
  init: RequestInit,
  send: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<Response> {
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash)
    throw new Error("Operator endpoint must use HTTPS without credentials or fragment");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return send(url, { ...init, headers, redirect: "error" });
}
