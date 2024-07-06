import { Hono } from "hono";
import users from "./routes/users";

const app = new Hono();

const routes = app.route("/users", users);

export type AppType = typeof routes;

export default {
  port: 7070,
  fetch: app.fetch,
};
