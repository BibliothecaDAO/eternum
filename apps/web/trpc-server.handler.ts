import { defineEventHandler, toWebRequest } from "@tanstack/start/server";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const t = initTRPC.create();

const POSTS = [
  { id: "1", title: "First post" },
  { id: "2", title: "Second post" },
  { id: "3", title: "Third post" },
  { id: "4", title: "Fourth post" },
  { id: "5", title: "Fifth post" },
  { id: "6", title: "Sixth post" },
  { id: "7", title: "Seventh post" },
  { id: "8", title: "Eighth post" },
  { id: "9", title: "Ninth post" },
  { id: "10", title: "Tenth post" },
];

const appRouter = t.router({
  hello: t.procedure.query(() => "Hello world!"),
  posts: t.procedure.query(async (_) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return POSTS;
  }),
  l1Realms: t.procedure /*.input(String)*/
    .query(async (req) => {
      await fetch(
        `https://api.reservoir.tools/api/users/0x7C3d89277fbDDDF9354a64A34257a1a42A2FAb04/tokens/v10?collection=0x07afe30cb3e53dba6801aa0ea647a0ecea7cbe18d&limit=24`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "c3324c8a-80c4-5983-bf8b-3033750c2e0a",
            "Access-Control-Allow-Origin": "*",
          },
        }
      ).then((res) => {
        return res.json();
      });
    }),
});

export type AppRouter = typeof appRouter;

export default defineEventHandler((event) => {
  const request = toWebRequest(event);
  if (request) {
    return fetchRequestHandler({
      endpoint: "/trpc",
      req: request,
      router: appRouter,
      createContext() {
        return {};
      },
    });
  }
});
