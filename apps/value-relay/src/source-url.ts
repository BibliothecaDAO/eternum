/** The box reads its own node and Herald without DNS or the public tunnel. */
export const isLoopbackHttp = (url: URL): boolean =>
  url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname) && !url.username && !url.password;
