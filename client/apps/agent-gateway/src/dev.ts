import app from "./index";

const port = Number(process.env.PORT ?? 8787);

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`agent-gateway listening on http://127.0.0.1:${port}`);
