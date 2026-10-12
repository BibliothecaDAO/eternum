/** Operator credentials travel only to HTTPS endpoints and never follow redirects. */
export async function operatorRequest(
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
  const response = await send(url, { ...init, headers, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) throw new Error("operator_redirect_refused");
  return response;
}
